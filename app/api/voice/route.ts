// POST /api/voice — conversational foreman assistant
//
// Accepts EITHER:
//   - multipart/form-data with `audio` (audio/webm preferred), and optional
//     `project_id`, `history`, `cart` (JSON-stringified).
//   - JSON { text, history?, project_id?, cart? } when the user typed.
//
// Pipeline:
//   1. Parse body (multipart OR JSON).
//   2. If audio: transcribeAudio via Whisper (canned fallback on no-key).
//      If text:  use the text as the transcript directly.
//   3. A-material blocklist on the transcript → early redirect.
//   4. Load project catalog + project context (rules / last order / kits)
//      so the system prompt can reason about the project.
//   5. callAI() with a German assistant prompt → AiAssistantReply.
//      Canned fallback comes from cannedAssistantFor(transcript).
//   6. Resolve SKUs in items + alternatives; orphans → unmatched.
//   7. Return AssistantResponse.

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { callAI, transcribeAudio } from "@/lib/ai";
import {
  aiAssistantReplySchema,
  assistantResponseSchema,
  assistantTurnSchema,
  type AiAssistantItem,
  type AiAssistantReply,
  type AssistantItem,
  type AssistantResponse,
  type AssistantTurn,
  type VoiceUnmatched,
} from "@/lib/schema";
import { isABlockedTerm } from "@/lib/constants/blocklist";
import {
  CANNED_VOICE_TRANSCRIPT,
  cannedAssistantFor,
} from "@/lib/canned/voice";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_BYTES = 4 * 1024;
const MAX_TEXT_LEN = 1000;
const MAX_HISTORY_TURNS = 4;
const CATALOG_LIMIT_FOR_PROMPT = 80; // keep the prompt small

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CatalogRow = {
  product_id: string;
  supplier_sku: string;
  name: string;
  unit: string;
  product_group: string | null;
  unit_price: number | null;
  hazardous: boolean;
};

type CartLineLite = { supplier_sku?: string; product_id?: string; qty: number };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maybeServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadCatalog(
  db: SupabaseClient,
  projectId: string | undefined,
): Promise<CatalogRow[]> {
  let q = db
    .from("products")
    .select(
      "id, supplier_sku, name, unit, product_group, unit_price, hazardous, status, project_products!inner(project_id)",
    )
    .eq("status", "active");
  if (projectId) q = q.eq("project_products.project_id", projectId);
  const { data, error } = await q.limit(500);
  if (error) {
    console.warn("[voice/assistant] catalog load failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    product_id: row.id as string,
    supplier_sku: row.supplier_sku as string,
    name: row.name as string,
    unit: (row.unit as string) ?? "Stk",
    product_group: (row.product_group as string | null) ?? null,
    unit_price: row.unit_price != null ? Number(row.unit_price) : null,
    hazardous: Boolean(row.hazardous),
  }));
}

function fallbackCatalog(): CatalogRow[] {
  function uuidFor(sku: string): string {
    function fnv(s: string, seed: number): string {
      let h = seed >>> 0;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return h.toString(16).padStart(8, "0");
    }
    const tail = (fnv(sku, 0x811c9dc5) + fnv(sku, 0xdeadbeef)).slice(0, 12);
    return `00000000-0000-4000-8000-${tail}`;
  }
  const skus: Array<Omit<CatalogRow, "product_id">> = [
    { supplier_sku: "C003", name: "Schraube TX25 6x80", unit: "Stk", product_group: "fasteners", unit_price: 0.18, hazardous: false },
    { supplier_sku: "C005", name: "Dübel 8mm", unit: "Stk", product_group: "fasteners", unit_price: 0.15, hazardous: false },
    { supplier_sku: "C019", name: "Arbeitshandschuhe Gr.9", unit: "Paar", product_group: "ppe", unit_price: 2.5, hazardous: false },
    { supplier_sku: "C021", name: "Schutzbrille klar", unit: "Stk", product_group: "ppe", unit_price: 4.8, hazardous: false },
    { supplier_sku: "C022", name: "Gehörschutzstöpsel", unit: "Paar", product_group: "ppe", unit_price: 0.9, hazardous: false },
    { supplier_sku: "C024", name: "Warnweste orange", unit: "Stk", product_group: "ppe", unit_price: 4.0, hazardous: false },
    { supplier_sku: "C027", name: "Panzertape silber", unit: "Rolle", product_group: "covers_tape", unit_price: 6.9, hazardous: false },
    { supplier_sku: "C032", name: "Bit TX20", unit: "Stk", product_group: "tools", unit_price: 1.9, hazardous: false },
    { supplier_sku: "C033", name: "Bit TX25", unit: "Stk", product_group: "tools", unit_price: 1.9, hazardous: false },
    { supplier_sku: "C034", name: "Bohrer 8mm", unit: "Stk", product_group: "tools", unit_price: 4.5, hazardous: false },
    { supplier_sku: "C039", name: "Silikon transparent", unit: "Stk", product_group: "sealants", unit_price: 3.8, hazardous: true },
    { supplier_sku: "C040", name: "Silikon weiß", unit: "Stk", product_group: "sealants", unit_price: 3.8, hazardous: true },
    { supplier_sku: "C043", name: "Reinigungsalkohol", unit: "Flasche", product_group: "cleaning_chemicals", unit_price: 4.2, hazardous: true },
    { supplier_sku: "C046", name: "Wasserwaage 60cm", unit: "Stk", product_group: "tools", unit_price: 18.0, hazardous: false },
    { supplier_sku: "C047", name: "Zollstock", unit: "Stk", product_group: "tools", unit_price: 3.2, hazardous: false },
  ];
  return skus.map((s) => ({ ...s, product_id: uuidFor(s.supplier_sku) }));
}

function buildSystemPrompt(opts: {
  catalog: CatalogRow[];
  cartLines: Array<{ supplier_sku: string; name: string; qty: number }>;
  threshold: number;
}): string {
  const catalogShortlist = opts.catalog.slice(0, CATALOG_LIMIT_FOR_PROMPT);
  const promptCatalog = catalogShortlist
    .map(
      (c) =>
        `- ${c.supplier_sku}\t${c.name} (${c.unit}, ${c.product_group ?? "misc"}${c.unit_price != null ? `, ${c.unit_price.toFixed(2)} CHF` : ""}${c.hazardous ? ", GEFAHRGUT" : ""})`,
    )
    .join("\n");
  const cart =
    opts.cartLines.length === 0
      ? "(leer)"
      : opts.cartLines
          .map((l) => `- ${l.qty}× ${l.supplier_sku} ${l.name}`)
          .join("\n");
  return [
    "Du bist Polier-Assistent für die Schweizer Baustelle Zürich-West.",
    "Du sprichst kurz, direkt und auf Deutsch. Du verstehst Bestellungen,",
    "gibst Vorschläge zu Aufgaben und beantwortest kurze Fragen zum",
    "Materialbedarf. Du erfindest keine Artikel.",
    "",
    `Bestellungen über ${opts.threshold} CHF gehen automatisch an den Bauleiter`,
    "zur Freigabe. Beton, Stahl, Bewehrung und Schalung sind A-Material und",
    "gehen NICHT über diese App — wenn der Polier sowas erwähnt, sag das.",
    "",
    "Antworte IMMER mit reinem JSON dieser Form:",
    '{ "reply": <kurze deutsche Antwort>,',
    '  "intent": "order"|"suggest"|"ask"|"clarify"|"remove"|"none",',
    '  "items": [{ "supplier_sku", "qty" }],          // max 8',
    '  "alternatives": [{ "supplier_sku", "qty" }],   // max 5; günstigere oder bessere Optionen',
    '  "removals": ["<supplier_sku>", ...],           // max 8; wenn der Polier sagt "entferne X"',
    '  "follow_up": <eine deutsche Klärungsfrage oder null> }',
    "",
    "Regeln:",
    "- Jedes supplier_sku MUSS exakt im Katalog stehen.",
    "- qty ist eine positive ganze Zahl. Wenn keine Menge genannt: qty=1.",
    "- Bei mehrdeutigen Begriffen ('Schrauben') WÄHLE EINEN sku — keine Duplikate.",
    "- Wenn nichts zum Bestellen ist, items=[]. reply muss IMMER da sein.",
    "- Kurzantwort: max 2 Sätze. Keine Floskeln.",
    "",
    "Aktueller Warenkorb des Poliers:",
    cart,
    "",
    "Katalog (supplier_sku\tname (unit, group, preis, gefahrgut)):",
    promptCatalog,
  ].join("\n");
}

function resolveItems(
  skuQtys: AiAssistantItem[],
  catalog: CatalogRow[],
): { items: AssistantItem[]; unmatched: VoiceUnmatched[] } {
  const bySku = new Map(catalog.map((c) => [c.supplier_sku, c]));
  const items: AssistantItem[] = [];
  const unmatched: VoiceUnmatched[] = [];
  for (const it of skuQtys) {
    const hit = bySku.get(it.supplier_sku);
    if (!hit) {
      unmatched.push({ name: it.supplier_sku, qty: it.qty });
      continue;
    }
    items.push({
      product_id: hit.product_id,
      supplier_sku: hit.supplier_sku,
      name: hit.name,
      unit: hit.unit,
      qty: it.qty,
    });
  }
  return { items, unmatched };
}

function parseHistory(raw: unknown): AssistantTurn[] {
  if (!Array.isArray(raw)) return [];
  const safe: AssistantTurn[] = [];
  for (const t of raw.slice(-MAX_HISTORY_TURNS)) {
    const parsed = assistantTurnSchema.safeParse(t);
    if (parsed.success) safe.push(parsed.data);
  }
  return safe;
}

function summariseCart(
  cartLines: CartLineLite[],
  catalog: CatalogRow[],
): Array<{ supplier_sku: string; name: string; qty: number }> {
  const byId = new Map(catalog.map((c) => [c.product_id, c]));
  const bySku = new Map(catalog.map((c) => [c.supplier_sku, c]));
  const out: Array<{ supplier_sku: string; name: string; qty: number }> = [];
  for (const line of cartLines) {
    const hit =
      (line.product_id && byId.get(line.product_id)) ||
      (line.supplier_sku && bySku.get(line.supplier_sku));
    if (!hit) continue;
    out.push({ supplier_sku: hit.supplier_sku, name: hit.name, qty: Number(line.qty) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

type Parsed = {
  transcript: string;
  fromAudio: boolean;
  projectId?: string;
  history: AssistantTurn[];
  cart: CartLineLite[];
  tooShort?: boolean;
};

async function parseRequest(req: Request): Promise<Parsed | NextResponse> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch (err) {
      return NextResponse.json({ error: "invalid form", detail: String(err) }, { status: 400 });
    }
    const audio = form.get("audio");
    const projectId = (form.get("project_id") as string | null) ?? undefined;
    const historyJson = (form.get("history") as string | null) ?? null;
    const cartJson = (form.get("cart") as string | null) ?? null;
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "audio required" }, { status: 400 });
    }
    if (audio.size > MAX_BYTES) {
      return NextResponse.json({ error: "audio too large" }, { status: 413 });
    }
    if (audio.size < MIN_BYTES) {
      return {
        transcript: "",
        fromAudio: true,
        projectId,
        history: parseHistory(historyJson ? safeJson(historyJson) : []),
        cart: Array.isArray(safeJson(cartJson))
          ? (safeJson(cartJson) as CartLineLite[])
          : [],
        tooShort: true,
      };
    }
    const transcript = await transcribeAudio({
      file: audio,
      language: "de",
      fallback: CANNED_VOICE_TRANSCRIPT,
    });
    return {
      transcript,
      fromAudio: true,
      projectId,
      history: parseHistory(historyJson ? safeJson(historyJson) : []),
      cart: Array.isArray(safeJson(cartJson))
        ? (safeJson(cartJson) as CartLineLite[])
        : [],
    };
  }
  // JSON text path
  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "invalid json", detail: String(err) }, { status: 400 });
  }
  const obj = (body ?? {}) as Record<string, unknown>;
  const text = typeof obj.text === "string" ? obj.text.trim().slice(0, MAX_TEXT_LEN) : "";
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  return {
    transcript: text,
    fromAudio: false,
    projectId: typeof obj.project_id === "string" ? obj.project_id : undefined,
    history: parseHistory(obj.history),
    cart: Array.isArray(obj.cart) ? (obj.cart as CartLineLite[]) : [],
  };
}

function safeJson(s: string | null): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const parsed = await parseRequest(req);
  if (parsed instanceof NextResponse) return parsed;

  const {
    transcript,
    fromAudio,
    projectId,
    history,
    cart: cartLines,
    tooShort,
  } = parsed;

  if (tooShort) {
    const body: AssistantResponse = {
      transcript: "",
      reply: "Halt das Mikrofon etwas länger gedrückt — ich hab nichts gehört.",
      intent: "none",
      items: [],
      alternatives: [],
      removals: [],
      unmatched: [],
      follow_up: null,
      canned: true,
      message: "too_short",
    };
    return NextResponse.json(body);
  }

  // A-material guard
  if (isABlockedTerm(transcript)) {
    const body: AssistantResponse = {
      transcript,
      reply:
        "Beton, Stahl und Bewehrung gehen über deinen Bauleiter — die hat die Rahmenverträge dafür. Sprich kurz mit ihm.",
      intent: "ask",
      items: [],
      alternatives: [],
      removals: [],
      unmatched: [],
      follow_up: null,
      redirect: true,
      message: "blocked",
    };
    return NextResponse.json(body);
  }

  // Catalog + cart summary
  const db = maybeServerClient();
  let catalog: CatalogRow[] = [];
  if (db) {
    catalog = await loadCatalog(db, projectId);
    if (catalog.length === 0) catalog = fallbackCatalog();
  } else {
    catalog = fallbackCatalog();
  }
  const cartSummary = summariseCart(cartLines, catalog);

  // LLM call (with canned fallback)
  const fallback: AiAssistantReply = {
    ...cannedAssistantFor(transcript),
  };
  const system = buildSystemPrompt({
    catalog,
    cartLines: cartSummary,
    threshold: 200,
  });
  const userText =
    history.length === 0
      ? `Polier sagt: "${transcript}"\n\nReturn JSON only.`
      : `Bisheriger Dialog:\n${history.map((t) => `${t.role === "user" ? "Polier" : "Assistent"}: ${t.text}`).join("\n")}\n\nPolier sagt jetzt: "${transcript}"\n\nReturn JSON only.`;

  const ai = await callAI<AiAssistantReply>({
    system,
    userText,
    fallback,
    parse: (text) => {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("no JSON");
      return aiAssistantReplySchema.parse(JSON.parse(m[0]));
    },
  });

  // Resolve items + alternatives
  const itemRes = resolveItems(ai.items, catalog);
  const altRes = resolveItems(ai.alternatives, catalog);
  // Normalize removals: keep only SKUs the catalog knows about
  const knownSkus = new Set(catalog.map((c) => c.supplier_sku));
  const removals = ai.removals.filter((s) => knownSkus.has(s));

  const canned = !process.env.OPENAI_API_KEY || ai === fallback;

  const body: AssistantResponse = {
    transcript,
    reply: ai.reply,
    intent: ai.intent,
    items: itemRes.items,
    alternatives: altRes.items,
    removals,
    unmatched: [...itemRes.unmatched, ...altRes.unmatched],
    follow_up: ai.follow_up,
    canned,
  };
  // touch fromAudio so the type narrowing isn't unused
  void fromAudio;

  const validated = assistantResponseSchema.safeParse(body);
  if (!validated.success) {
    console.warn("[voice/assistant] response failed schema:", validated.error);
    return NextResponse.json(
      {
        transcript,
        reply: "Hab gerade was nicht verstanden, versuch's nochmal.",
        intent: "none",
        items: [],
        alternatives: [],
        removals: [],
        unmatched: [],
        follow_up: null,
        canned: true,
      },
      { status: 200 },
    );
  }
  return NextResponse.json(validated.data);
}
