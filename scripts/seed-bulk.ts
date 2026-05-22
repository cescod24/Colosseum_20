/**
 * scripts/seed-bulk.ts — generate N synthetic C-material products and link
 * them to the seeded project. Lets the catalog demo at "real supplier-
 * catalog scale" (tens of thousands of SKUs) without changing the real
 * fixture seed.
 *
 * Idempotent on its own slice: every synthetic SKU starts with `BULK-`,
 * and this script deletes prior `BULK-%` rows before inserting fresh ones.
 * The real ~80 CSV rows (kits, orders, discovery anchors) are untouched.
 *
 * Usage:
 *   npm run seed:bulk                       # default count (50_000)
 *   npx tsx --env-file=.env.local scripts/seed-bulk.ts 10000
 *
 * Performance: batches inserts at 1000/round, so ~50 trips for 50_000.
 * Real time on the shared Supabase project is roughly 60–120 s.
 *
 * Safety:
 *   - Writes to the SHARED Supabase project. Coordinate in team chat.
 *   - Every generated name is run through the A-material blocklist; any
 *     accidental match is dropped (defence in depth).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isABlockedTerm } from "../lib/constants/blocklist";
import type { CategoryKey } from "../lib/constants/categories";

const DEFAULT_COUNT = 50_000;
const BATCH = 1_000;
const SKU_PREFIX = "BULK-";

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
// Generator templates per category (C-materials only, no blocklist terms)
// ---------------------------------------------------------------------------

type GenRow = {
  name: string;
  unit: string;
  unit_price: number;
  product_group: CategoryKey;
  hazardous: boolean;
};

const COLORS_DE = [
  "rot", "blau", "grün", "gelb", "schwarz", "weiß", "grau", "orange",
];
const RAL = ["RAL 1015", "RAL 5010", "RAL 6018", "RAL 7035", "RAL 9010"];
const TX = [10, 15, 20, 25, 30, 40, 50];
const DIAM = [3, 3.5, 4, 4.5, 5, 6, 7, 8, 10, 12];
const LEN = [12, 16, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100, 120, 140, 160];
const M = [4, 5, 6, 8, 10, 12, 16];
const DRILL_D = [3, 4, 5, 6, 7, 8, 10, 12, 14, 16];
const SIZE = [6, 7, 8, 9, 10, 11];
const ML = [100, 150, 250, 300, 400, 500, 750, 1000];
const LEN_TAPE_MM = [19, 25, 30, 38, 50, 75];
const LEN_TAPE_M = [10, 25, 33, 50, 66];
const SHEET_W = [2, 3, 4, 5];
const SHEET_H = [3, 4, 5, 6, 8];
const PACK = [10, 25, 50, 100, 200, 500, 1000];
const SAND_GRIT = [40, 60, 80, 100, 120, 150, 180, 220, 240, 320, 400];
const BLADE_D = [115, 125, 150, 180, 230];
const VEST_SIZE = ["S", "M", "L", "XL", "XXL"];
const GLOVE_CLASS = ["3", "5", "Cut-5", "Allround"];
const PAINT_L = [1, 2.5, 5, 10];

const pick = <T,>(arr: readonly T[], r: number) => arr[r % arr.length];

// Pseudo-random in [a, b] from index — deterministic so re-runs match.
function rndPrice(i: number, lo: number, hi: number): number {
  // xorshift-ish from i
  let x = (i * 2654435761) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  const f = (x % 100000) / 100000;
  return Math.round((lo + f * (hi - lo)) * 100) / 100;
}

function gen(i: number): GenRow | null {
  // Round-robin across 9 categories, varied templates.
  const cats: CategoryKey[] = [
    "fasteners",
    "electrical",
    "ppe",
    "tools",
    "covers_tape",
    "sealants",
    "paint",
    "cleaning_chemicals",
    "misc",
  ];
  const cat = cats[i % cats.length];
  const slot = Math.floor(i / cats.length);

  let row: GenRow;
  switch (cat) {
    case "fasteners": {
      const variant = slot % 6;
      if (variant === 0)
        row = {
          name: `Schraube TX${pick(TX, slot)} ${pick(DIAM, slot >> 1)}x${pick(LEN, slot >> 2)}`,
          unit: "Stk",
          unit_price: rndPrice(i, 0.05, 0.6),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 1)
        row = {
          name: `Dübel ${pick(DIAM, slot)}mm`,
          unit: "Stk",
          unit_price: rndPrice(i, 0.05, 0.4),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 2)
        row = {
          name: `Mutter M${pick(M, slot)}`,
          unit: "Stk",
          unit_price: rndPrice(i, 0.03, 0.25),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 3)
        row = {
          name: `Unterlegscheibe M${pick(M, slot)}`,
          unit: "Stk",
          unit_price: rndPrice(i, 0.02, 0.2),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 4)
        row = {
          name: `Gewindestange M${pick(M, slot)} ${pick(LEN, slot >> 1)}mm`,
          unit: "Stk",
          unit_price: rndPrice(i, 1.2, 6.5),
          product_group: cat,
          hazardous: false,
        };
      else
        row = {
          name: `Tellerkopfschraube TX${pick(TX, slot)} ${pick(DIAM, slot >> 1)}x${pick(LEN, slot >> 2)}`,
          unit: "Stk",
          unit_price: rndPrice(i, 0.1, 0.9),
          product_group: cat,
          hazardous: false,
        };
      break;
    }
    case "electrical": {
      const variant = slot % 5;
      if (variant === 0)
        row = {
          name: `Kabelbinder ${pick([100, 150, 200, 250, 300, 380, 450], slot)}mm (Btl. ${pick(PACK, slot >> 1)})`,
          unit: "Beutel",
          unit_price: rndPrice(i, 1.5, 14),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 1)
        row = {
          name: `Isolierband ${pick(COLORS_DE, slot)} ${pick(LEN_TAPE_MM, slot >> 1)}mm`,
          unit: "Rolle",
          unit_price: rndPrice(i, 1.1, 3.2),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 2)
        row = {
          name: `Aderendhülse ${pick([0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10], slot)}mm² (Btl. ${pick(PACK, slot >> 1)})`,
          unit: "Beutel",
          unit_price: rndPrice(i, 2.5, 18),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 3)
        row = {
          name: `Verlängerungskabel ${pick([3, 5, 10, 15, 20, 25], slot)}m`,
          unit: "Stk",
          unit_price: rndPrice(i, 12, 65),
          product_group: cat,
          hazardous: false,
        };
      else
        row = {
          name: `Klemme ${pick([2, 3, 4, 5, 6, 8], slot)}-polig`,
          unit: "Stk",
          unit_price: rndPrice(i, 0.4, 3.5),
          product_group: cat,
          hazardous: false,
        };
      break;
    }
    case "ppe": {
      const variant = slot % 5;
      if (variant === 0)
        row = {
          name: `Arbeitshandschuh ${pick(GLOVE_CLASS, slot)} Gr.${pick(SIZE, slot >> 1)}`,
          unit: "Paar",
          unit_price: rndPrice(i, 1.5, 6.5),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 1)
        row = {
          name: `Schutzbrille ${pick(["klar", "getönt", "kratzfest"], slot)}`,
          unit: "Stk",
          unit_price: rndPrice(i, 3.5, 9),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 2)
        row = {
          name: `Warnweste ${pick(COLORS_DE, slot)} Gr.${pick(VEST_SIZE, slot >> 1)}`,
          unit: "Stk",
          unit_price: rndPrice(i, 4, 13),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 3)
        row = {
          name: `Gehörschutzstöpsel (Box ${pick([50, 100, 200, 500], slot)})`,
          unit: "Box",
          unit_price: rndPrice(i, 6, 22),
          product_group: cat,
          hazardous: false,
        };
      else
        row = {
          name: `Atemschutzmaske FFP${pick([1, 2, 3], slot)}`,
          unit: "Stk",
          unit_price: rndPrice(i, 0.8, 3.5),
          product_group: cat,
          hazardous: false,
        };
      break;
    }
    case "tools": {
      const variant = slot % 5;
      if (variant === 0)
        row = {
          name: `Bohrer HSS ${pick(DRILL_D, slot)}mm`,
          unit: "Stk",
          unit_price: rndPrice(i, 1.5, 12),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 1)
        row = {
          name: `Bit TX${pick(TX, slot)} (Pack ${pick([5, 10, 25, 50], slot)})`,
          unit: "Pack",
          unit_price: rndPrice(i, 2.5, 18),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 2)
        row = {
          name: `Trennscheibe Inox ${pick(BLADE_D, slot)}mm`,
          unit: "Stk",
          unit_price: rndPrice(i, 1.8, 9),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 3)
        row = {
          name: `Schleifpapier P${pick(SAND_GRIT, slot)} (Pack ${pick([10, 25, 50], slot)})`,
          unit: "Pack",
          unit_price: rndPrice(i, 3, 16),
          product_group: cat,
          hazardous: false,
        };
      else
        row = {
          name: `Cuttermesser ${pick([9, 18, 25], slot)}mm`,
          unit: "Stk",
          unit_price: rndPrice(i, 3, 9),
          product_group: cat,
          hazardous: false,
        };
      break;
    }
    case "covers_tape": {
      const variant = slot % 4;
      if (variant === 0)
        row = {
          name: `Klebeband ${pick(["universal", "Gewebe", "doppelseitig", "PVC"], slot)} ${pick(LEN_TAPE_MM, slot >> 1)}mm x ${pick(LEN_TAPE_M, slot >> 2)}m`,
          unit: "Rolle",
          unit_price: rndPrice(i, 2.2, 18),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 1)
        row = {
          name: `Malerkrepp ${pick([18, 25, 30, 38, 50], slot)}mm x ${pick(LEN_TAPE_M, slot >> 1)}m`,
          unit: "Rolle",
          unit_price: rndPrice(i, 1.8, 7),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 2)
        row = {
          name: `Abdeckfolie ${pick(SHEET_W, slot)}x${pick(SHEET_H, slot >> 1)}m`,
          unit: "Stk",
          unit_price: rndPrice(i, 3, 14),
          product_group: cat,
          hazardous: false,
        };
      else
        row = {
          name: `Malervlies ${pick([1, 2, 5, 10, 25], slot)}m`,
          unit: "Rolle",
          unit_price: rndPrice(i, 8, 38),
          product_group: cat,
          hazardous: false,
        };
      break;
    }
    case "sealants": {
      const variant = slot % 4;
      if (variant === 0)
        row = {
          name: `Silikon ${pick(["sanitär", "neutral", "essig"], slot)} ${pick(COLORS_DE, slot >> 1)} ${pick([280, 290, 310], slot >> 2)}ml`,
          unit: "Kartusche",
          unit_price: rndPrice(i, 3.5, 11),
          product_group: cat,
          hazardous: true,
        };
      else if (variant === 1)
        row = {
          name: `Acryl ${pick(COLORS_DE, slot)} ${pick([280, 310], slot >> 1)}ml`,
          unit: "Kartusche",
          unit_price: rndPrice(i, 2.5, 6),
          product_group: cat,
          hazardous: true,
        };
      else if (variant === 2)
        row = {
          name: `PU-Schaum ${pick([500, 750, 1000], slot)}ml`,
          unit: "Dose",
          unit_price: rndPrice(i, 4, 12),
          product_group: cat,
          hazardous: true,
        };
      else
        row = {
          name: `Montagekleber MS-Polymer ${pick([290, 310], slot)}ml`,
          unit: "Kartusche",
          unit_price: rndPrice(i, 5.5, 13),
          product_group: cat,
          hazardous: false,
        };
      break;
    }
    case "paint": {
      const variant = slot % 4;
      if (variant === 0)
        row = {
          name: `Markierspray ${pick(COLORS_DE, slot)} fluoreszierend 500ml`,
          unit: "Dose",
          unit_price: rndPrice(i, 5.5, 9),
          product_group: cat,
          hazardous: true,
        };
      else if (variant === 1)
        row = {
          name: `Farbroller ${pick(["klein", "mittel", "groß"], slot)} ${pick(LEN_TAPE_MM, slot >> 1)}mm`,
          unit: "Stk",
          unit_price: rndPrice(i, 3.5, 9),
          product_group: cat,
          hazardous: false,
        };
      else if (variant === 2)
        row = {
          name: `Pinsel ${pick([25, 35, 50, 70, 100], slot)}mm`,
          unit: "Stk",
          unit_price: rndPrice(i, 2.4, 8),
          product_group: cat,
          hazardous: false,
        };
      else
        row = {
          name: `Dispersionsfarbe ${pick(["weiß", "creme", "grau"], slot)} ${pick(PAINT_L, slot >> 1)}L (${pick(RAL, slot >> 2)})`,
          unit: "Eimer",
          unit_price: rndPrice(i, 12, 75),
          product_group: cat,
          hazardous: true,
        };
      break;
    }
    case "cleaning_chemicals": {
      const variant = slot % 4;
      if (variant === 0)
        row = {
          name: `Industriereiniger Konzentrat ${pick([500, 1000, 5000], slot)}ml`,
          unit: "Flasche",
          unit_price: rndPrice(i, 4, 22),
          product_group: cat,
          hazardous: true,
        };
      else if (variant === 1)
        row = {
          name: `Bremsenreiniger ${pick(ML, slot)}ml`,
          unit: "Dose",
          unit_price: rndPrice(i, 3.5, 7),
          product_group: cat,
          hazardous: true,
        };
      else if (variant === 2)
        row = {
          name: `Mikrofasertuch (Pack ${pick([5, 10, 25, 50], slot)})`,
          unit: "Pack",
          unit_price: rndPrice(i, 4, 22),
          product_group: cat,
          hazardous: false,
        };
      else
        row = {
          name: `Abfallsack ${pick([60, 90, 120, 240], slot)}L (Rolle ${pick([10, 25, 50], slot >> 1)})`,
          unit: "Rolle",
          unit_price: rndPrice(i, 4, 14),
          product_group: cat,
          hazardous: false,
        };
      break;
    }
    case "misc":
    default: {
      const variant = slot % 4;
      if (variant === 0)
        row = {
          name: `Baustellenmarker ${pick(COLORS_DE, slot)}`,
          unit: "Stk",
          unit_price: rndPrice(i, 1.2, 3.5),
          product_group: "misc",
          hazardous: false,
        };
      else if (variant === 1)
        row = {
          name: `Bleistift Zimmermann Pack ${pick([5, 10, 25, 50], slot)}`,
          unit: "Pack",
          unit_price: rndPrice(i, 2.5, 11),
          product_group: "misc",
          hazardous: false,
        };
      else if (variant === 2)
        row = {
          name: `Baukreide ${pick(COLORS_DE, slot)}`,
          unit: "Stk",
          unit_price: rndPrice(i, 0.9, 2.4),
          product_group: "misc",
          hazardous: false,
        };
      else
        row = {
          name: `Putzeimer ${pick([5, 10, 12, 15, 20], slot)}L`,
          unit: "Stk",
          unit_price: rndPrice(i, 2.5, 9),
          product_group: "misc",
          hazardous: false,
        };
      break;
    }
  }
  // Defence in depth: blocklist scrub. (Templates avoid the terms, but if
  // we ever broaden them, this catches accidents.)
  if (isABlockedTerm(row.name)) return null;
  return row;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const arg = process.argv[2];
  const targetCount = arg ? Math.max(1, parseInt(arg, 10)) : DEFAULT_COUNT;
  if (!Number.isFinite(targetCount)) {
    throw new Error(`bad count argument: ${arg}`);
  }

  const db = getClient();

  // Project + suppliers
  const { data: project, error: projErr } = await db
    .from("projects")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (projErr) throw new Error(`projects load: ${projErr.message}`);
  if (!project) throw new Error("no project — run `npm run seed` first.");

  const { data: supplierRows, error: supErr } = await db
    .from("suppliers")
    .select("id")
    .order("created_at", { ascending: true });
  if (supErr) throw new Error(`suppliers load: ${supErr.message}`);
  const supplierIds = (supplierRows ?? []).map((s) => s.id as string);
  if (supplierIds.length === 0) {
    throw new Error("no suppliers — run `npm run seed` first.");
  }

  console.log(
    `[seed-bulk] project=${project.id} suppliers=${supplierIds.length} target=${targetCount}`,
  );

  // Wipe prior BULK rows (cascades to project_products on FK).
  const { error: wipeErr } = await db
    .from("products")
    .delete()
    .like("supplier_sku", `${SKU_PREFIX}%`);
  if (wipeErr) throw new Error(`bulk wipe: ${wipeErr.message}`);
  console.log("[seed-bulk] wiped prior BULK-% rows");

  // Generate + insert in batches.
  let inserted = 0;
  let skipped = 0;
  let nextId = 1;
  while (inserted < targetCount) {
    const batchSize = Math.min(BATCH, targetCount - inserted);
    const productPayload: Array<Record<string, unknown>> = [];
    while (productPayload.length < batchSize) {
      const i = nextId++;
      const r = gen(i);
      if (!r) {
        skipped++;
        continue;
      }
      const supplier_id = supplierIds[i % supplierIds.length];
      const sku = `${SKU_PREFIX}${i.toString().padStart(7, "0")}`;
      productPayload.push({
        supplier_id,
        supplier_sku: sku,
        name: r.name,
        product_group: r.product_group,
        trade: null,
        unit: r.unit,
        unit_price: r.unit_price,
        currency: "CHF",
        hazardous: r.hazardous,
        status: "active",
        confidence: 1,
      });
    }
    const { data: ins, error: insErr } = await db
      .from("products")
      .insert(productPayload)
      .select("id");
    if (insErr) throw new Error(`products batch: ${insErr.message}`);
    const linkPayload = (ins ?? []).map((row) => ({
      project_id: project.id as string,
      product_id: row.id as string,
    }));
    if (linkPayload.length > 0) {
      const { error: linkErr } = await db
        .from("project_products")
        .insert(linkPayload);
      if (linkErr) throw new Error(`project_products batch: ${linkErr.message}`);
    }
    inserted += productPayload.length;
    if (inserted % 5000 === 0 || inserted === targetCount) {
      console.log(`[seed-bulk]   inserted ${inserted} / ${targetCount}`);
    }
  }

  console.log(
    `[seed-bulk] done. inserted=${inserted} skipped(blocklist)=${skipped}`,
  );
}

main().catch((err) => {
  console.error("[seed-bulk] failed:", err);
  process.exit(1);
});
