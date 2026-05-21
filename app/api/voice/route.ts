// POST /api/voice
//
// Body: multipart/form-data with field `audio` (audio/webm preferred) and an
// optional `project_id` field. Pipeline mirrors /api/discover:
//   1. Multipart parse, validate File presence + size.
//   2. transcribeAudio() — Whisper via lib/ai.ts (canned fallback on no-key).
//   3. A-material blocklist on the transcript → early redirect.
//   4. Load project catalog (real DB or fallbackCatalog when no DB).
//   5. callAI() — German extraction prompt → { items: [{ supplier_sku, qty }] }.
//   6. Resolve SKUs from catalog; anything unresolved becomes `unmatched`.
//   7. Return { transcript, items, unmatched, canned, redirect?, message? }.
//
// Local-no-DB mode: catalog comes from a deterministic placeholder set so the
// route still answers when the Supabase env vars are absent. Same trick as
// /api/discover.

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { callAI, transcribeAudio } from "@/lib/ai";
import {
  aiVoiceResponseSchema,
  voiceResponseSchema,
  type AiVoiceResponse,
  type VoiceItem,
  type VoiceResponse,
  type VoiceUnmatched,
} from "@/lib/schema";
import { isABlockedTerm } from "@/lib/constants/blocklist";
import {
  CANNED_VOICE_TRANSCRIPT,
  cannedVoiceFor,
} from "@/lib/canned/voice";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — generous for ~60 s webm/opus
const MIN_BYTES = 4 * 1024; // Whisper's minimum-useful payload heuristic

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CatalogRow = {
  product_id: string;
  supplier_sku: string;
  name: string;
  unit: string;
  product_group: string | null;
};

// ---------------------------------------------------------------------------
// Helpers (inlined from /api/discover/route.ts to avoid cross-slice edits to
// shared catalog code — same pattern, do not extract for the hackathon merge)
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
      "id, supplier_sku, name, unit, product_group, status, project_products!inner(project_id)",
    )
    .eq("status", "active");
  if (projectId) {
    q = q.eq("project_products.project_id", projectId);
  }
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
  }));
}

function fallbackCatalog(): CatalogRow[] {
  // Mirrors /api/discover/route.ts:fallbackCatalog — deterministic v4 UUIDs
  // so the no-DB demo still passes z.string().uuid().
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
  // Same seed SKUs the canned voice fallback references, plus a couple of
  // PPE items so the canned PSA-keyword hit resolves.
  const skus: Array<{ sku: string; name: string; unit: string; group: string }> = [
    { sku: "C003", name: "Schraube TX25 6x80", unit: "Stk", group: "fasteners" },
    { sku: "C019", name: "Arbeitshandschuhe Gr.9", unit: "Paar", group: "ppe" },
    { sku: "C021", name: "Schutzbrille klar", unit: "Stk", group: "ppe" },
    { sku: "C022", name: "Gehörschutzstöpsel", unit: "Paar", group: "ppe" },
    { sku: "C024", name: "Warnweste orange", unit: "Stk", group: "ppe" },
    { sku: "C027", name: "Panzertape silber", unit: "Rolle", group: "covers_tape" },
    { sku: "C032", name: "Bit TX20", unit: "Stk", group: "tools" },
    { sku: "C033", name: "Bit TX25", unit: "Stk", group: "tools" },
    { sku: "C034", name: "Bohrer 8mm", unit: "Stk", group: "tools" },
    { sku: "C039", name: "Silikon transparent", unit: "Stk", group: "sealants" },
    { sku: "C043", name: "Reinigungsalkohol", unit: "Flasche", group: "cleaning_chemicals" },
    { sku: "C046", name: "Wasserwaage 60cm", unit: "Stk", group: "tools" },
    { sku: "C047", name: "Zollstock", unit: "Stk", group: "tools" },
  ];
  return skus.map((s) => ({
    product_id: uuidFor(s.sku),
    supplier_sku: s.sku,
    name: s.name,
    unit: s.unit,
    product_group: s.group,
  }));
}

function resolve(
  ai: AiVoiceResponse,
  catalog: CatalogRow[],
): { items: VoiceItem[]; unmatched: VoiceUnmatched[] } {
  const bySku = new Map(catalog.map((c) => [c.supplier_sku, c]));
  const items: VoiceItem[] = [];
  const unmatched: VoiceUnmatched[] = [];
  for (const it of ai.items) {
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
  return { items: items.slice(0, 8), unmatched: unmatched.slice(0, 8) };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // 1. Multipart parse
  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: "invalid form data", detail: String(err) },
      { status: 400 },
    );
  }
  const audio = form.get("audio");
  const projectId = (form.get("project_id") as string | null) ?? undefined;
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "audio required" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "audio too large" }, { status: 413 });
  }
  if (audio.size < MIN_BYTES) {
    const body: VoiceResponse = {
      transcript: "",
      items: [],
      unmatched: [],
      canned: true,
      message: "too_short",
    };
    return NextResponse.json(body);
  }

  // 2. Transcribe
  const transcript = await transcribeAudio({
    file: audio,
    language: "de",
    fallback: CANNED_VOICE_TRANSCRIPT,
  });
  const isCannedTranscript = !process.env.OPENAI_API_KEY;

  // 3. A-material short-circuit (BEFORE the second AI call)
  if (isABlockedTerm(transcript)) {
    const body: VoiceResponse = {
      transcript,
      items: [],
      unmatched: [],
      redirect: true,
      message:
        "Beton, Stahl und Bewehrung gehen über deinen Bauleiter — nicht über Site Order.",
    };
    return NextResponse.json(body);
  }

  // 4. Catalog
  const db = maybeServerClient();
  let catalog: CatalogRow[];
  if (db) {
    catalog = await loadCatalog(db, projectId);
    if (catalog.length === 0) {
      console.warn("[voice] DB returned empty catalog — using fallback");
      catalog = fallbackCatalog();
    }
  } else {
    catalog = fallbackCatalog();
  }

  // 5. AI extraction (with canned fallback)
  const fallback: AiVoiceResponse = cannedVoiceFor(transcript);
  const promptCatalog = catalog
    .map(
      (c) => `- ${c.supplier_sku}\t${c.name} (${c.unit}, ${c.product_group ?? "misc"})`,
    )
    .join("\n");

  const system =
    'You are a German-speaking foreman\'s assistant. Given a spoken transcript and the project\'s catalog, extract the items the foreman wants to order. Return JSON of the shape { "items": [{ "supplier_sku", "qty" }] } with at most 8 items. Each supplier_sku MUST appear verbatim in the catalog. qty must be a positive integer. If a quantity is not stated, default to 1. If a word is ambiguous (e.g. "Schrauben"), pick ONE most likely sku from the catalog — do not return multiple skus for the same spoken term.';

  const ai = await callAI<AiVoiceResponse>({
    system,
    userText: `Transkript: "${transcript}"\n\nKatalog (supplier_sku\tname (unit, group)):\n${promptCatalog}\n\nReturn JSON only.`,
    fallback,
    parse: (text) => {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("no JSON in response");
      return aiVoiceResponseSchema.parse(JSON.parse(m[0]));
    },
  });

  // 6. Resolve SKUs → product_id
  const { items, unmatched } = resolve(ai, catalog);
  const canned = isCannedTranscript || ai === fallback;

  // 7. Final validation (defence in depth)
  const body: VoiceResponse = {
    transcript,
    items,
    unmatched,
    canned,
  };
  const validated = voiceResponseSchema.safeParse(body);
  if (!validated.success) {
    console.warn("[voice] response failed schema:", validated.error);
    return NextResponse.json(
      { transcript, items: [], unmatched: [], canned: true, error: "response invalid" },
      { status: 200 },
    );
  }
  return NextResponse.json(validated.data);
}
