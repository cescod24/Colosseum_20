/**
 * scripts/seed.ts — idempotent seed for the Site Order demo.
 *
 * Run with: `npm run seed` (uses tsx + the service-role key from .env.local).
 *
 * Strategy:
 *   * Delete every table in reverse FK order, then re-insert. Cheaper than
 *     a real TRUNCATE via RPC, and works against Supabase Cloud without
 *     extra functions.
 *   * Suppliers live in the CSV (Würth, Fischer, …). ACME is NOT seeded —
 *     it is onboarded live in Phase 6 by uploading the contract PDF.
 *   * Three pre-baked material_sets per the plan.
 *   * 8–12 orders per foreman over the last ~28 days, with one sub-threshold
 *     hazardous order so the restricted-group rule has a fixture.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isABlockedTerm } from "../lib/constants/blocklist";
import { productGroupFor } from "../lib/constants/categories";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CsvRow = {
  artikel_id: string;
  artikelname: string;
  kategorie: string;
  einheit: string;
  preis_eur: string;
  lieferant: string;
  verbrauchsart: string;
  gefahrgut: string;
  lagerort: string;
  typische_baustelle: string;
};

type SupplierRow = { id: string; name: string };
type ProductRow = {
  id: string;
  supplier_id: string;
  supplier_sku: string;
  name: string;
  product_group: string;
  trade: string;
  unit: string;
  unit_price: number;
  currency: "CHF";
  hazardous: boolean;
  status: "active";
};

const PROJECT_NAME = "Baustelle Zürich-West";
const AUTO_APPROVE_THRESHOLD = 200;
const TRADE_FOREMAN_A = "Hochbau";
const TRADE_FOREMAN_B = "Stahlbau";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function envOrDie(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[seed] Missing ${name} in .env.local`);
    process.exit(1);
  }
  return v;
}

async function deleteAll(supabase: SupabaseClient, table: string) {
  // Supabase JS requires a filter on delete; use a tautology.
  const { error } = await supabase
    .from(table)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
}

async function deleteAllByPair(
  supabase: SupabaseClient,
  table: string,
  col: string,
) {
  // Junction tables without `id` use a real column for the tautology.
  const { error } = await supabase
    .from(table)
    .delete()
    .neq(col, "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
}

function daysAgo(d: number, hour: number, minute: number): string {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, minute, 0, 0);
  return t.toISOString();
}

function readCsv(): CsvRow[] {
  const path = join(process.cwd(), "data", "sample.csv");
  const text = readFileSync(path, "utf8");
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    console.warn("[seed] CSV parse warnings:", parsed.errors.slice(0, 3));
  }
  return parsed.data.filter((r) => r.artikel_id && r.artikelname);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const url = envOrDie("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = envOrDie("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("[seed] target:", url);

  // --- clear in reverse FK order
  console.log("[seed] clearing existing rows …");
  await deleteAll(supabase, "mock_comstruct_orders");
  await deleteAll(supabase, "order_items");
  await deleteAll(supabase, "orders");
  await deleteAllByPair(supabase, "material_set_items", "set_id");
  await deleteAll(supabase, "material_sets");
  await deleteAllByPair(supabase, "project_products", "project_id");
  await deleteAll(supabase, "approval_rules");
  await deleteAll(supabase, "products");
  await deleteAll(supabase, "profiles");
  await deleteAll(supabase, "suppliers");
  await deleteAll(supabase, "projects");

  // --- read + filter CSV
  const csv = readCsv();
  const blocked = csv.filter((r) => isABlockedTerm(r.artikelname));
  if (blocked.length) {
    console.warn(
      `[seed] skipping ${blocked.length} A-material row(s) from CSV:`,
      blocked.map((r) => r.artikelname).slice(0, 5),
    );
  }
  const safe = csv.filter((r) => !isABlockedTerm(r.artikelname));

  // --- project
  console.log("[seed] inserting project …");
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .insert({
      name: PROJECT_NAME,
      currency: "CHF",
      auto_approve_threshold: AUTO_APPROVE_THRESHOLD,
    })
    .select("id")
    .single();
  if (projErr || !project) throw projErr ?? new Error("no project");
  const projectId = project.id as string;

  // --- suppliers (one per distinct `lieferant`; NO ACME)
  const supplierNames = Array.from(
    new Set(safe.map((r) => r.lieferant.trim()).filter(Boolean)),
  ).filter((n) => n.toLowerCase() !== "acme");
  console.log(`[seed] inserting ${supplierNames.length} suppliers …`);
  const { data: supplierRows, error: supErr } = await supabase
    .from("suppliers")
    .insert(supplierNames.map((name) => ({ name })))
    .select("id, name");
  if (supErr || !supplierRows) throw supErr ?? new Error("no suppliers");
  const supplierByName = new Map<string, SupplierRow>(
    supplierRows.map((s) => [s.name, s as SupplierRow]),
  );

  // --- products
  const productPayload = safe.map((r) => {
    const supplier = supplierByName.get(r.lieferant.trim());
    if (!supplier) {
      throw new Error(`Unknown supplier for ${r.artikel_id}: ${r.lieferant}`);
    }
    const price = Number(r.preis_eur);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Bad price for ${r.artikel_id}: ${r.preis_eur}`);
    }
    return {
      supplier_id: supplier.id,
      supplier_sku: r.artikel_id,
      name: r.artikelname,
      product_group: productGroupFor(r.kategorie),
      trade: r.typische_baustelle || null,
      unit: r.einheit,
      // EUR → CHF: contract states everything CHF; CSV mislabels but is
      // representative — accept 1:1 for the demo (plan §2 currency lock).
      unit_price: price,
      currency: "CHF" as const,
      hazardous: r.gefahrgut?.toLowerCase() === "true",
      status: "active" as const,
    };
  });
  console.log(`[seed] inserting ${productPayload.length} products …`);
  const { data: productRows, error: prodErr } = await supabase
    .from("products")
    .insert(productPayload)
    .select(
      "id, supplier_sku, name, unit, unit_price, hazardous, product_group, trade",
    );
  if (prodErr || !productRows) throw prodErr ?? new Error("no products");
  const productBySku = new Map<string, ProductRow & { trade: string | null }>(
    productRows.map((p) => [p.supplier_sku, p as ProductRow & { trade: string | null }]),
  );

  // --- project_products: link every product to the one project
  console.log("[seed] linking project_products …");
  const linkPayload = productRows.map((p) => ({
    project_id: projectId,
    product_id: p.id,
  }));
  const { error: linkErr } = await supabase.from("project_products").insert(linkPayload);
  if (linkErr) throw linkErr;

  // --- approval_rules
  console.log("[seed] inserting approval_rules …");
  const { error: rulesErr } = await supabase.from("approval_rules").insert({
    project_id: projectId,
    threshold: AUTO_APPROVE_THRESHOLD,
    // Hazardous flag is the dominant signal, but the rule engine also reads
    // restricted_groups — seed it with the German group name so the engine
    // matches against product_group when we add non-haz restricted groups.
    restricted_groups: ["Farbe"],
    restricted_suppliers: [],
  });
  if (rulesErr) throw rulesErr;

  // --- profiles
  console.log("[seed] inserting profiles …");
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .insert([
      {
        role: "foreman",
        display_name: "Polier A — Hochbau / PPE",
        project_id: projectId,
      },
      {
        role: "foreman",
        display_name: "Polier B — Werkzeug / Befestigung",
        project_id: projectId,
      },
      {
        role: "procurement",
        display_name: "Procurement / Bauleiter",
        project_id: projectId,
      },
    ])
    .select("id, role, display_name");
  if (profErr || !profiles) throw profErr ?? new Error("no profiles");
  const foremanA = profiles[0];
  const foremanB = profiles[1];

  // --- material_sets + items
  console.log("[seed] inserting material sets …");
  const kitDefs: Array<{ name: string; skus: Array<[string, number]> }> = [
    {
      name: "PPE-Set neuer Mitarbeiter",
      skus: [
        ["C073", 1], // Bauhelm weiß
        ["C022", 2], // Gehörschutzstöpsel
        ["C019", 2], // Arbeitshandschuhe Gr.9
        ["C024", 1], // Warnweste orange
        ["C021", 1], // Schutzbrille klar
      ],
    },
    {
      name: "Trockenbau-Set 50 m²",
      skus: [
        ["C003", 200], // Schraube TX25 6x80
        ["C005", 50], // Dübel 8mm
        ["C027", 2], // Panzertape silber
        ["C062", 2], // Spachtel 50mm
        ["C091", 100], // Abstandskeile
        ["C040", 4], // Silikon weiß
      ],
    },
    {
      name: "Werkzeug-Grundausstattung",
      skus: [
        ["C047", 2], // Zollstock
        ["C048", 10], // Bleistift Baustelle
        ["C032", 4], // Bit TX20
        ["C033", 4], // Bit TX25
        ["C046", 1], // Wasserwaage 60cm
        ["C094", 1], // Gummihammer
      ],
    },
  ];
  for (const kit of kitDefs) {
    const { data: setRow, error: setErr } = await supabase
      .from("material_sets")
      .insert({ project_id: projectId, name: kit.name })
      .select("id")
      .single();
    if (setErr || !setRow) throw setErr ?? new Error("no material_set");
    const items = kit.skus
      .map(([sku, qty]) => {
        const p = productBySku.get(sku);
        if (!p) {
          console.warn(`[seed] kit "${kit.name}" missing sku ${sku}`);
          return null;
        }
        return { set_id: setRow.id, product_id: p.id, default_qty: qty };
      })
      .filter((x): x is { set_id: string; product_id: string; default_qty: number } => x !== null);
    if (items.length) {
      const { error: itemsErr } = await supabase.from("material_set_items").insert(items);
      if (itemsErr) throw itemsErr;
    }
  }

  // --- orders: 8–12 per foreman across last ~28 days
  console.log("[seed] inserting historical orders …");

  type LineSpec = { sku: string; qty: number };
  type OrderSpec = {
    foreman: { id: string };
    day: number; // days ago
    hour: number;
    minute: number;
    lines: LineSpec[];
    forceStatus?: "approved" | "ordered" | "delivered";
  };

  // Foreman A — PPE / consumables-heavy
  const aOrders: OrderSpec[] = [
    {
      foreman: foremanA,
      day: 26,
      hour: 7,
      minute: 30,
      lines: [
        { sku: "C019", qty: 4 },
        { sku: "C022", qty: 4 },
      ],
    },
    {
      foreman: foremanA,
      day: 24,
      hour: 10,
      minute: 5,
      lines: [
        { sku: "C023", qty: 10 },
        { sku: "C097", qty: 20 },
      ],
    },
    {
      foreman: foremanA,
      day: 21,
      hour: 8,
      minute: 15,
      lines: [
        { sku: "C055", qty: 2 },
        { sku: "C099", qty: 50 },
      ],
    },
    {
      foreman: foremanA,
      day: 18,
      hour: 12,
      minute: 0,
      lines: [
        { sku: "C021", qty: 3 },
        { sku: "C098", qty: 20 },
      ],
    },
    {
      foreman: foremanA,
      day: 14,
      hour: 9,
      minute: 30,
      lines: [
        { sku: "C027", qty: 4 },
        { sku: "C015", qty: 6 },
      ],
    },
    {
      foreman: foremanA,
      day: 11,
      hour: 7,
      minute: 45,
      lines: [
        { sku: "C073", qty: 2 },
        { sku: "C075", qty: 2 },
      ],
    },
    {
      foreman: foremanA,
      day: 8,
      hour: 13,
      minute: 0,
      lines: [
        { sku: "C019", qty: 6 },
        { sku: "C022", qty: 8 },
        { sku: "C098", qty: 30 },
      ],
    },
    {
      foreman: foremanA,
      day: 5,
      hour: 8,
      minute: 0,
      lines: [
        { sku: "C055", qty: 1 },
        { sku: "C089", qty: 1 },
        { sku: "C051", qty: 1 },
      ],
    },
    {
      // sub-threshold hazardous order — fixture for the restricted-group rule
      foreman: foremanA,
      day: 3,
      hour: 10,
      minute: 30,
      lines: [{ sku: "C029", qty: 6 }], // Markierspray rot (hazardous)
    },
    {
      foreman: foremanA,
      day: 1,
      hour: 9,
      minute: 15,
      lines: [
        { sku: "C019", qty: 2 }, // Arbeitshandschuhe Gr.9
        { sku: "C003", qty: 50 }, // Schraube TX25 — the famous "Gloves + Screws" of the mockup
      ],
    },
  ];

  // Foreman B — tools / fasteners-heavy
  const bOrders: OrderSpec[] = [
    {
      foreman: foremanB,
      day: 27,
      hour: 7,
      minute: 0,
      lines: [
        { sku: "C001", qty: 200 },
        { sku: "C002", qty: 200 },
      ],
    },
    {
      foreman: foremanB,
      day: 25,
      hour: 9,
      minute: 0,
      lines: [
        { sku: "C032", qty: 5 },
        { sku: "C033", qty: 5 },
        { sku: "C034", qty: 2 },
      ],
    },
    {
      foreman: foremanB,
      day: 22,
      hour: 11,
      minute: 30,
      lines: [
        { sku: "C047", qty: 4 },
        { sku: "C046", qty: 1 },
      ],
    },
    {
      foreman: foremanB,
      day: 19,
      hour: 8,
      minute: 0,
      lines: [
        { sku: "C007", qty: 100 },
        { sku: "C008", qty: 100 },
        { sku: "C009", qty: 50 },
      ],
    },
    {
      foreman: foremanB,
      day: 15,
      hour: 13,
      minute: 0,
      lines: [
        { sku: "C035", qty: 2 },
        { sku: "C072", qty: 4 },
      ],
    },
    {
      foreman: foremanB,
      day: 12,
      hour: 7,
      minute: 45,
      lines: [
        { sku: "C004", qty: 200 },
        { sku: "C005", qty: 200 },
      ],
    },
    {
      foreman: foremanB,
      day: 9,
      hour: 14,
      minute: 30,
      lines: [
        { sku: "C094", qty: 1 },
        { sku: "C062", qty: 2 },
        { sku: "C063", qty: 2 },
      ],
    },
    {
      foreman: foremanB,
      day: 6,
      hour: 8,
      minute: 30,
      lines: [
        { sku: "C084", qty: 4 },
        { sku: "C085", qty: 2 },
      ],
    },
    {
      foreman: foremanB,
      day: 2,
      hour: 9,
      minute: 0,
      lines: [
        { sku: "C001", qty: 300 },
        { sku: "C012", qty: 200 },
      ],
    },
  ];

  const allOrders: OrderSpec[] = [...aOrders, ...bOrders];

  for (const spec of allOrders) {
    const items = spec.lines.map((l) => {
      const p = productBySku.get(l.sku);
      if (!p) throw new Error(`Order seed: missing sku ${l.sku}`);
      return { product: p, qty: l.qty };
    });
    const total = items.reduce(
      (sum, it) => sum + it.product.unit_price * it.qty,
      0,
    );
    const hasHazardous = items.some((it) => it.product.hazardous);
    // Historical orders: anything haz or over threshold ends up delivered as
    // well (procurement already approved them in the past).
    const status: "approved" | "ordered" | "delivered" =
      spec.forceStatus ?? "delivered";
    const created_at = daysAgo(spec.day, spec.hour, spec.minute);

    const { data: orderRow, error: orderErr } = await supabase
      .from("orders")
      .insert({
        project_id: projectId,
        created_by: spec.foreman.id,
        status,
        total: Math.round(total * 100) / 100,
        currency: "CHF",
        created_at,
        decided_by:
          hasHazardous || total >= AUTO_APPROVE_THRESHOLD
            ? profiles[2].id
            : null,
        decided_at:
          hasHazardous || total >= AUTO_APPROVE_THRESHOLD ? created_at : null,
      })
      .select("id")
      .single();
    if (orderErr || !orderRow) throw orderErr ?? new Error("no order");

    const itemPayload = items.map((it) => ({
      order_id: orderRow.id,
      product_id: it.product.id,
      qty: it.qty,
      unit_price: it.product.unit_price,
    }));
    const { error: itemErr } = await supabase
      .from("order_items")
      .insert(itemPayload);
    if (itemErr) throw itemErr;
  }

  console.log("[seed] done");
  console.log(`  - products:    ${productRows.length}`);
  console.log(`  - suppliers:   ${supplierRows.length}`);
  console.log(`  - kits:        ${kitDefs.length}`);
  console.log(`  - orders:      ${allOrders.length}`);
  void TRADE_FOREMAN_A;
  void TRADE_FOREMAN_B;
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
