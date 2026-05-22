/**
 * scripts/seed.ts — idempotent seed for the Site Order demo (Phase 1 data half).
 *
 * Reads `data/sample.csv`, drops any A-material row via the blocklist,
 * normalises the surviving rows into the `products` schema and writes them
 * to the linked Supabase project together with:
 *   - one project ("Baustelle Zürich-West")
 *   - one approval_rules row (threshold 200 CHF, restricted_groups=['paint'])
 *   - three profiles (foreman A, foreman B, procurement)
 *   - four material_sets (PPE, Trockenbau, Elektro, Maler) with items
 *   - 8–12 orders per foreman, trade-skewed, including one sub-threshold
 *     hazardous fixture for the restricted-group rule to fire on
 *
 * ACME is NOT seeded — it's onboarded live in Phase 6 by uploading
 * `data/fake_contract_products_with_logo.pdf` (see plan.md §2).
 *
 * Run with: `npm run seed`. Re-running drops everything first, so the
 * outcome is deterministic.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { categoryFor } from "../lib/constants/categories";
import { isABlockedTerm } from "../lib/constants/blocklist";

// ---------------------------------------------------------------------------
// Types — mirror the CSV columns exactly
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

// ---------------------------------------------------------------------------
// Env + client
// ---------------------------------------------------------------------------

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NULL_UUID = "00000000-0000-0000-0000-000000000000";

async function wipe(db: SupabaseClient) {
  // Reverse dependency order so FK cascade is not relied on. Each table is
  // emptied with a `not("id", "is", null)` filter — Supabase requires a
  // filter on .delete() for safety.
  const tables = [
    "mock_comstruct_orders",
    "order_items",
    "orders",
    "material_set_items",
    "material_sets",
    "approval_rules",
    "project_products",
    "profiles",
    "products",
    "suppliers",
    "projects",
  ];
  // Composite-PK tables have no `id` column; filter by a column they do have.
  const filterCol: Record<string, string> = {
    project_products: "project_id",
    material_set_items: "set_id",
  };
  for (const t of tables) {
    const col = filterCol[t];
    const { error } = col
      ? await db.from(t).delete().neq(col, NULL_UUID)
      : await db.from(t).delete().not("id", "is", null);
    if (error) throw new Error(`wipe ${t}: ${error.message}`);
  }
}

function chooseN<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function rngFromSeed(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function isoDaysAgo(d: number) {
  const t = Date.now() - d * 86_400_000;
  return new Date(t).toISOString();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const csvPath = resolve(process.cwd(), "data/sample.csv");
  const text = readFileSync(csvPath, "utf8");
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    console.warn("[seed] CSV parse warnings:", parsed.errors.slice(0, 3));
  }

  const rows = parsed.data
    .filter((r) => r.artikel_id && r.artikelname)
    .filter((r) => {
      if (isABlockedTerm(`${r.artikelname} ${r.kategorie}`)) {
        console.warn("[seed] blocked A-material row:", r.artikel_id, r.artikelname);
        return false;
      }
      return true;
    });

  console.log(`[seed] CSV: ${parsed.data.length} → ${rows.length} after blocklist`);

  const db = getClient();
  await wipe(db);

  // -- project --------------------------------------------------------------
  const { data: projectRow, error: projectErr } = await db
    .from("projects")
    .insert({
      name: "Baustelle Zürich-West",
      currency: "CHF",
      auto_approve_threshold: 200,
    })
    .select("id")
    .single();
  if (projectErr || !projectRow) throw projectErr ?? new Error("no project row");
  const projectId = projectRow.id as string;

  // -- approval rules -------------------------------------------------------
  // Restricted groups uses the canonical category keys from
  // lib/constants/categories.ts. Hazardous gefahrgut=true items in the
  // 'paint' group trip the rule alongside any item where hazardous=true.
  const { error: ruleErr } = await db.from("approval_rules").insert({
    project_id: projectId,
    threshold: 200,
    restricted_groups: ["paint"],
    restricted_suppliers: [],
  });
  if (ruleErr) throw ruleErr;

  // -- profiles -------------------------------------------------------------
  const { data: profileRows, error: profileErr } = await db
    .from("profiles")
    .insert([
      {
        role: "foreman",
        display_name: "Polier A (Hochbau / PPE)",
        project_id: projectId,
      },
      {
        role: "foreman",
        display_name: "Polier B (Werkzeug / Befestigung)",
        project_id: projectId,
      },
      {
        role: "procurement",
        display_name: "Bauleitung Zürich-West",
        project_id: projectId,
      },
    ])
    .select("id, display_name, role");
  if (profileErr || !profileRows) throw profileErr ?? new Error("no profile rows");
  const foremanA = profileRows.find((p) => p.display_name.includes("Polier A"))!;
  const foremanB = profileRows.find((p) => p.display_name.includes("Polier B"))!;

  // -- suppliers ------------------------------------------------------------
  const supplierNames = Array.from(new Set(rows.map((r) => r.lieferant.trim())))
    .filter((s) => s.length > 0)
    .filter((s) => s.toUpperCase() !== "ACME");
  const { data: supplierRows, error: supplierErr } = await db
    .from("suppliers")
    .insert(supplierNames.map((name) => ({ name })))
    .select("id, name");
  if (supplierErr || !supplierRows) throw supplierErr ?? new Error("no supplier rows");
  const supplierByName: Record<string, string> = {};
  for (const s of supplierRows) supplierByName[s.name as string] = s.id as string;

  // -- products -------------------------------------------------------------
  type ProductInsert = {
    supplier_id: string;
    supplier_sku: string;
    name: string;
    product_group: string;
    trade: string | null;
    unit: string;
    unit_price: number;
    currency: string;
    hazardous: boolean;
    status: "active";
    confidence: number;
  };
  const productInserts: ProductInsert[] = rows
    .filter((r) => supplierByName[r.lieferant.trim()])
    .map((r) => ({
      supplier_id: supplierByName[r.lieferant.trim()],
      supplier_sku: r.artikel_id,
      name: r.artikelname,
      product_group: categoryFor(r.kategorie),
      trade: r.typische_baustelle || null,
      unit: r.einheit,
      unit_price: Number(r.preis_eur),
      currency: "CHF",
      hazardous: r.gefahrgut === "true",
      status: "active",
      confidence: 1,
    }));
  const { data: productRows, error: productErr } = await db
    .from("products")
    .insert(productInserts)
    .select("id, supplier_sku, product_group, hazardous, unit, unit_price");
  if (productErr || !productRows) throw productErr ?? new Error("no product rows");
  const productBySku: Record<string, (typeof productRows)[number]> = {};
  for (const p of productRows) productBySku[p.supplier_sku as string] = p;

  // -- project_products -----------------------------------------------------
  await db.from("project_products").insert(
    productRows.map((p) => ({ project_id: projectId, product_id: p.id })),
  );

  // -- material_sets --------------------------------------------------------
  // Four kits across four distinct trades so the home grid feels varied:
  // safety, drywall, electrical, painting.
  const kits = [
    {
      // PSA für einen neuen Mann auf der Baustelle.
      name: "PPE-Set neuer Mitarbeiter",
      skus: ["C073", "C019", "C021", "C024", "C022", "C023"],
      qty: [1, 2, 1, 1, 2, 5],
    },
    {
      // Trockenbau: Schrauben, Dübel, Fugen.
      name: "Trockenbau-Set 50 m²",
      skus: ["C003", "C005", "C027", "C036", "C041", "C042"],
      qty: [200, 100, 2, 5, 3, 2],
    },
    {
      // Elektro-Erstausstattung für einen Bauabschnitt.
      name: "Elektro-Set",
      skus: ["C013", "C015", "C017", "C057", "C059", "C056"],
      qty: [50, 3, 50, 1, 1, 1],
    },
    {
      // Maler: Rollen, Pinsel, Abdeckung, Farbe. Die Farbe (Gruppe 'paint')
      // ist eine 'restricted_group' — dieses Set löst bewusst eine Freigabe
      // beim Einkauf aus und zeigt so den Approval-Flow.
      name: "Maler-Set",
      skus: ["C065", "C067", "C025", "C026", "C040", "C069"],
      qty: [2, 3, 1, 3, 2, 2],
    },
  ];
  for (const kit of kits) {
    const { data: setRow } = await db
      .from("material_sets")
      .insert({ project_id: projectId, name: kit.name })
      .select("id")
      .single();
    if (!setRow) continue;
    const items = kit.skus
      .map((sku, i) => ({
        set_id: setRow.id as string,
        product_id: productBySku[sku]?.id,
        default_qty: kit.qty[i],
      }))
      .filter((it) => it.product_id);
    if (items.length) await db.from("material_set_items").insert(items);
  }

  // -- orders ---------------------------------------------------------------
  // Skipped entirely with `--no-orders` (npm run seed:clean) for a truly
  // empty slate: catalog + kits but ZERO order history, so the foreman's
  // Aktuell *and* Verlauf start empty.
  let orderCount = 0;
  if (!process.argv.includes("--no-orders")) {
  // Foreman A is PPE/consumables-heavy; foreman B is tools/fasteners-heavy.
  const groupsA = new Set([
    "ppe",
    "cleaning_chemicals",
    "covers_tape",
    "misc",
    "sealants",
  ]);
  const groupsB = new Set(["tools", "fasteners", "electrical"]);
  const productsA = productRows.filter((p) => groupsA.has(p.product_group as string));
  const productsB = productRows.filter((p) => groupsB.has(p.product_group as string));

  type OrderPlan = {
    profile_id: string;
    daysAgo: number;
    items: { product_id: string; qty: number; unit_price: number }[];
    status: "delivered" | "approved" | "ordered";
  };

  const rng = rngFromSeed(20260521);
  const planOrders = (
    profile_id: string,
    pool: typeof productRows,
    count: number,
    startDay: number,
    label: string,
  ): OrderPlan[] => {
    const plans: OrderPlan[] = [];
    for (let i = 0; i < count; i++) {
      const lineCount = 3 + Math.floor(rng() * 2); // 3 or 4
      const picks = chooseN(pool, lineCount, rng);
      plans.push({
        profile_id,
        daysAgo: startDay + Math.floor(rng() * 24),
        items: picks.map((p) => ({
          product_id: p.id as string,
          qty: 1 + Math.floor(rng() * 20),
          unit_price: Number(p.unit_price),
        })),
        status: "delivered",
      });
      void label;
    }
    return plans;
  };

  const plans: OrderPlan[] = [
    ...planOrders(foremanA.id as string, productsA, 10, 2, "A"),
    ...planOrders(foremanB.id as string, productsB, 9, 2, "B"),
  ];

  // One sub-threshold hazardous order for foreman B — gives the
  // restricted-group rule a fixture to fire on at demo time.
  const markingSpray = productRows.find((p) => p.supplier_sku === "C029");
  const tape = productRows.find((p) => p.supplier_sku === "C027");
  if (markingSpray && tape) {
    plans.push({
      profile_id: foremanB.id as string,
      daysAgo: 4,
      items: [
        {
          product_id: markingSpray.id as string,
          qty: 4,
          unit_price: Number(markingSpray.unit_price),
        },
        {
          product_id: tape.id as string,
          qty: 2,
          unit_price: Number(tape.unit_price),
        },
      ],
      status: "delivered",
    });
  }

  for (const plan of plans) {
    const total = plan.items.reduce(
      (s, it) => s + it.qty * it.unit_price,
      0,
    );
    const { data: orderRow } = await db
      .from("orders")
      .insert({
        project_id: projectId,
        created_by: plan.profile_id,
        status: plan.status,
        total: Math.round(total * 100) / 100,
        currency: "CHF",
        created_at: isoDaysAgo(plan.daysAgo),
        decided_at: isoDaysAgo(plan.daysAgo - 0.01),
      })
      .select("id")
      .single();
    if (!orderRow) continue;
    await db.from("order_items").insert(
      plan.items.map((it) => ({
        order_id: orderRow.id as string,
        product_id: it.product_id,
        qty: it.qty,
        unit_price: Math.round(it.unit_price * 10000) / 10000,
      })),
    );
  }
    orderCount = plans.length;
  }

  console.log("[seed] done:");
  console.log("  project:", projectId);
  console.log("  suppliers:", supplierRows.length);
  console.log("  products:", productRows.length);
  console.log("  profiles:", profileRows.length);
  console.log("  kits:", kits.length);
  console.log("  orders:", orderCount);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
