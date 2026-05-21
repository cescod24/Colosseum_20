// POST /api/discover
//
// Body (JSON):
//   { task: string, project_id?: string }
//
// Pipeline:
//   1. Reject A-material searches via the blocklist BEFORE any AI call;
//      the route returns { items: [], redirect: true }.
//   2. Fetch the project's active catalog (when Supabase env is present).
//      Each row is { product_id, supplier_sku, name, unit, product_group }.
//   3. Ask OpenAI for ≤ 5 items as `{ supplier_sku, reason }`, with the
//      catalog passed in the prompt. The model never sees UUIDs.
//   4. Validate with Zod (aiDiscoverResponseSchema), drop items whose
//      supplier_sku is not in the catalog, then resolve to full UUIDs.
//   5. Canned fallback runs when:
//        - the A-material short-circuit doesn't fire AND
//        - OPENAI_API_KEY is missing OR the live call times out / errors,
//          OR the call returns zero usable items.
//
// Local-no-DB mode: when there is no Supabase, the route fabricates a tiny
// catalog from the canned ingest fixture (so the route still answers) and
// uses deterministic placeholder UUIDs for product_id.

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { callAI } from "@/lib/ai";
import {
  aiDiscoverResponseSchema,
  discoverResponseSchema,
  type AiDiscoverResponse,
  type DiscoverItem,
  type DiscoverResponse,
} from "@/lib/schema";
import { isABlockedTerm } from "@/lib/constants/blocklist";
import { cannedDiscoverFor } from "@/lib/canned/discover";
import { CANNED_CLEAN_ACME } from "@/lib/canned/ingest";

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

const bodySchema = z.object({
  task: z.string().min(1).max(200),
  project_id: z.string().uuid().optional(),
});

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
      "id, supplier_sku, name, unit, product_group, status, project_products!inner(project_id)",
    )
    .eq("status", "active");
  if (projectId) {
    q = q.eq("project_products.project_id", projectId);
  }
  const { data, error } = await q.limit(500);
  if (error) {
    console.warn("[discover] catalog load failed:", error.message);
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
  // Deterministic placeholder UUIDs let the foreman UI render canned hits
  // when there is no DB yet. The format is RFC-4122 v4-compliant
  // (`xxxxxxxx-xxxx-4xxx-8xxx-XXXXXXXXXXXX`) so `z.string().uuid()` accepts
  // them; the last 12 chars are derived from the supplier_sku so the same
  // sku → same id across requests.
  function uuidFor(sku: string): string {
    // Derive a stable 12-hex tail from the sku via FNV-1a 32-bit hash so any
    // sku string (incl. non-hex letters like 'm' in "ACME-…") produces valid
    // hex. Hash twice with different seeds to fill 12 chars.
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
  // Use the seeded CSV C-numbers we know the canned discover responses
  // reference, plus the canned ACME rows.
  const skus: Array<{ sku: string; name: string; unit: string; group: string }> = [
    { sku: "C003", name: "Schraube TX25 6x80", unit: "Stk", group: "fasteners" },
    { sku: "C005", name: "Dübel 8mm", unit: "Stk", group: "fasteners" },
    { sku: "C015", name: "Isolierband schwarz", unit: "Rolle", group: "electrical" },
    { sku: "C027", name: "Panzertape silber", unit: "Rolle", group: "covers_tape" },
    { sku: "C032", name: "Bit TX20", unit: "Stk", group: "tools" },
    { sku: "C033", name: "Bit TX25", unit: "Stk", group: "tools" },
    { sku: "C034", name: "Bohrer 8mm", unit: "Stk", group: "tools" },
    { sku: "C035", name: "Bohrer 10mm", unit: "Stk", group: "tools" },
    { sku: "C039", name: "Silikon transparent", unit: "Stk", group: "sealants" },
    { sku: "C040", name: "Silikon weiß", unit: "Stk", group: "sealants" },
    { sku: "C043", name: "Reinigungsalkohol", unit: "Flasche", group: "cleaning_chemicals" },
    { sku: "C047", name: "Zollstock", unit: "Stk", group: "tools" },
    { sku: "C048", name: "Bleistift Baustelle", unit: "Stk", group: "misc" },
  ];
  const acme = CANNED_CLEAN_ACME.rows.map((r) => ({
    sku: r.supplier_sku,
    name: r.name,
    unit: r.unit ?? "Stk",
    group: r.product_group ?? "misc",
  }));
  return [...skus, ...acme].map((s) => ({
    product_id: uuidFor(s.sku),
    supplier_sku: s.sku,
    name: s.name,
    unit: s.unit,
    product_group: s.group,
  }));
}

function resolve(
  ai: AiDiscoverResponse,
  catalog: CatalogRow[],
): DiscoverItem[] {
  const bySku = new Map(catalog.map((c) => [c.supplier_sku, c]));
  const items: DiscoverItem[] = [];
  for (const it of ai.items) {
    const hit = bySku.get(it.supplier_sku);
    if (!hit) continue;
    items.push({
      product_id: hit.product_id,
      supplier_sku: hit.supplier_sku,
      name: hit.name,
      unit: hit.unit,
      product_group: hit.product_group,
      reason: it.reason,
    });
  }
  return items.slice(0, 5);
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid body", detail: String(err) },
      { status: 400 },
    );
  }

  // 1. A-material short-circuit
  if (isABlockedTerm(body.task)) {
    const empty: DiscoverResponse = { items: [], canned: false };
    return NextResponse.json({
      ...empty,
      redirect: true,
      message:
        "Beton, Stahl und Bewehrung gehen über deinen Bauleiter — nicht über Site Order.",
    });
  }

  // 2. Catalog
  const db = maybeServerClient();
  let catalog: CatalogRow[];
  if (db) {
    catalog = await loadCatalog(db, body.project_id);
    if (catalog.length === 0) {
      console.warn("[discover] DB returned empty catalog — using fallback");
      catalog = fallbackCatalog();
    }
  } else {
    catalog = fallbackCatalog();
  }

  // 3. AI (with canned fallback)
  const canned = cannedDiscoverFor(body.task);
  const fallback: AiDiscoverResponse = canned ?? { items: [] };

  const promptCatalog = catalog
    .map(
      (c) => `- ${c.supplier_sku}\t${c.name} (${c.unit}, ${c.product_group ?? "misc"})`,
    )
    .join("\n");

  const system =
    "You are a German-speaking foreman's assistant. Given a task and the project's catalog, return at most 5 items as JSON: { items: [{ supplier_sku, reason }] }. Each supplier_sku MUST appear verbatim in the catalog. Each reason is one short German sentence specific to the task — no filler.";

  const ai = await callAI<AiDiscoverResponse>({
    system,
    userText: `Aufgabe: ${body.task}\n\nKatalog (supplier_sku\tname (unit, group)):\n${promptCatalog}\n\nReturn JSON only.`,
    fallback,
    parse: (text) => {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("no JSON in response");
      return aiDiscoverResponseSchema.parse(JSON.parse(m[0]));
    },
  });

  const items = resolve(ai, catalog);
  const isCanned = ai === fallback || !process.env.OPENAI_API_KEY;

  const response: DiscoverResponse = {
    items,
    canned: isCanned,
  };

  // Final validation (defence in depth)
  const validated = discoverResponseSchema.safeParse(response);
  if (!validated.success) {
    console.warn("[discover] response failed schema:", validated.error);
    return NextResponse.json(
      { items: [], canned: true, error: "response invalid" },
      { status: 200 },
    );
  }
  return NextResponse.json(validated.data);
}
