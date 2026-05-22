// POST /api/voice — single-shot foreman order builder.
//
// Foremen don't chat. One utterance in → one decisive recommendation out.
// No history, no follow-up questions, no alternatives. The client renders
// the items + total + a single "Bestellung senden · X CHF" button.
//
// Accepts EITHER:
//   - multipart/form-data with `audio` (audio/webm preferred), and optional
//     `project_id`, `cart` (JSON-stringified, used as context so the AI
//     doesn't suggest stuff already pending in the cart).
//   - JSON { text, project_id?, cart? } when the user typed.
//
// Pipeline:
//   1. Parse multipart OR JSON.
//   2. Transcribe via Whisper if audio, else use text.
//   3. A-material blocklist on the transcript → early redirect.
//   4. Load project catalog (real DB or fallbackCatalog).
//   5. callAI() with a decisive German prompt → AiAssistantReply = { reply, items }.
//   6. Resolve SKUs from catalog; orphans go into `unmatched`. Server attaches
//      unit_price (server-authoritative) so the client can compute the total
//      without ever displaying per-line prices.
//   7. Return AssistantResponse.

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { callAI, transcribeAudio } from "@/lib/ai";
import {
  aiAssistantReplySchema,
  assistantResponseSchema,
  type AiAssistantItem,
  type AiAssistantReply,
  type AssistantItem,
  type AssistantResponse,
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
const CATALOG_LIMIT_FOR_PROMPT = 200; // full seeded catalog fits

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
// Helpers (inlined from /api/discover — see plan.md §12 for why we don't
// extract a shared module).
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
    console.warn("[voice] catalog load failed:", error.message);
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
    "Du bist der Polier-Ordnungsassistent für die Baustelle Zürich-West.",
    "Der Polier hat KEINE Zeit zu plaudern. Er sagt was er braucht oder",
    "was er macht — du antwortest IMMER mit einer konkreten Bestellungs-",
    "Empfehlung aus dem Katalog. Niemals eine leere items-Liste.",
    "",
    "AUSGABE-FORMAT (immer reines JSON, nichts anderes):",
    '{ "reply": <ein kurzer deutscher Satz>, "items": [{"supplier_sku", "qty"}] }',
    "- reply: max 12 Wörter, kein Fragezeichen, KEINE Floskeln.",
    '  Beispiel: "10× Schraube TX25 6×80, 2× Panzertape, 1× Bohrer 8 mm."',
    "- items: 1–8 Einträge. Jedes supplier_sku MUSS exakt im Katalog stehen.",
    "",
    "WICHTIG — ABSOLUTE TABUS (verletze diese NIEMALS):",
    "- KEINE Rückfragen.",
    "- KEINE Alternativen anbieten — wähle einen sku und steh dazu.",
    '- VERBOTEN: "frag den Bauleiter", "wende dich an deinen Bauleiter",',
    '  "geht über den Bauleiter", "an den Bauleiter wenden", "Materialien beim',
    '  Bauleiter anfragen", oder ähnliche Verweise. Wenn du sowas im reply',
    "  schreibst, ist die Antwort falsch.",
    '- VERBOTEN: "Ich kann das nicht", "Ich verstehe nicht", "nicht sicher".',
    "  Versuche immer deine beste Schätzung aus dem Katalog.",
    "- KEINE leere items-Liste. Wenn nichts perfekt passt, wähle 1–3",
    "  plausible Artikel.",
    "",
    "MENGEN-REGELN (sehr wichtig):",
    '- Wenn der Polier eine Zahl sagt ("500 Schrauben", "drei Tuben",',
    '  "vier Rollen Tape", "fünfhundert"), NIMM DIESE EXAKTE ZAHL.',
    "  Niemals durch eine Standard-Menge ersetzen.",
    "- Erkenne Zahlwörter: zwei=2, drei=3, vier=4, fünf=5, sechs=6,",
    "  sieben=7, acht=8, neun=9, zehn=10, zwanzig=20, fünfzig=50,",
    "  hundert=100, fünfhundert=500, tausend=1000.",
    "- Sonst nimm Baustellen-Defaults: Handschuhe 4, Tape 2, Schrauben 50,",
    "  Dübel 50, Bohrer 1, Wasserwaage 1, Silikon 3, Kabelbinder 100.",
    "",
    "SPRACHE: Der Polier kann auf Deutsch, Italienisch oder Englisch sprechen.",
    "Verstehe alle drei und antworte immer auf Deutsch.",
    "",
    "BEISPIELE (Aufgabe → empfohlene Artikel):",
    '- "Fenster abdichten" → Silikon transparent, Reinigungsalkohol, Panzertape',
    '- "PSA neuer Mitarbeiter" → Handschuhe, Helm, Schutzbrille, Warnweste, Gehörschutz',
    '- "Tür einbauen" / "porta da montare" → Schrauben TX25, Dübel 8mm, Silikon, Bohrer 8mm',
    '- "Trockenbau 50 m²" → Schrauben TX25, Dübel, Spachtel, Spachtelmasse, Klebeband',
    '- "Werkzeug nachbestellen" → Bits TX20+TX25, Bohrer, Wasserwaage, Zollstock',
    '- "Kabel verlegen" → Kabelbinder, Isolierband, Installationsdraht',
    '- "500 Schrauben TX25" → 500× C003 (genau diese Menge)',
    "",
    `Genehmigungsschwelle: ${opts.threshold} CHF. Erwähne das NICHT im reply.`,
    "",
    "Aktueller Warenkorb des Poliers (NICHT doppelt empfehlen):",
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
      unit_price: hit.unit_price,
      qty: it.qty,
    });
  }
  return { items, unmatched };
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

function safeJson(s: string | null): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

type Parsed = {
  transcript: string;
  projectId?: string;
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
    const cartJson = (form.get("cart") as string | null) ?? null;
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "audio required" }, { status: 400 });
    }
    if (audio.size > MAX_BYTES) {
      return NextResponse.json({ error: "audio too large" }, { status: 413 });
    }
    const cart = Array.isArray(safeJson(cartJson)) ? (safeJson(cartJson) as CartLineLite[]) : [];
    if (audio.size < MIN_BYTES) {
      return { transcript: "", projectId, cart, tooShort: true };
    }
    const transcript = await transcribeAudio({
      file: audio,
      language: "de",
      fallback: CANNED_VOICE_TRANSCRIPT,
    });
    return { transcript, projectId, cart };
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
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  return {
    transcript: text,
    projectId: typeof obj.project_id === "string" ? obj.project_id : undefined,
    cart: Array.isArray(obj.cart) ? (obj.cart as CartLineLite[]) : [],
  };
}

export async function POST(req: Request) {
  const parsed = await parseRequest(req);
  if (parsed instanceof NextResponse) return parsed;

  const { transcript, projectId, cart: cartLines, tooShort } = parsed;

  if (tooShort) {
    const body: AssistantResponse = {
      transcript: "",
      reply: "Halt das Mikrofon etwas länger gedrückt — ich hab nichts gehört.",
      items: [],
      unmatched: [],
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
        "Beton, Stahl & Bewehrung gehen über deinen Bauleiter. Hier nicht bestellbar.",
      items: [],
      unmatched: [],
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
  const fallback: AiAssistantReply = { ...cannedAssistantFor(transcript) };
  const system = buildSystemPrompt({
    catalog,
    cartLines: cartSummary,
    threshold: 200,
  });
  const userText = `Polier sagt: "${transcript}"\n\nReturn JSON only.`;

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

  const { items, unmatched } = resolveItems(ai.items, catalog);
  const canned = !process.env.OPENAI_API_KEY || ai === fallback;

  const body: AssistantResponse = {
    transcript,
    reply: ai.reply,
    items,
    unmatched,
    canned,
  };

  const validated = assistantResponseSchema.safeParse(body);
  if (!validated.success) {
    console.warn("[voice] response failed schema:", validated.error);
    return NextResponse.json(
      {
        transcript,
        reply: "Hab gerade was nicht verstanden. Versuch's nochmal.",
        items: [],
        unmatched: [],
        canned: true,
      },
      { status: 200 },
    );
  }
  return NextResponse.json(validated.data);
}
