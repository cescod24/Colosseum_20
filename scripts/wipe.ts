/**
 * scripts/wipe.ts — empty the catalog + all dependent data so the demo
 * can be (re-)populated entirely through the procurement ingest UI.
 *
 * Keeps: projects, profiles, approval_rules.
 * Wipes:  order_items, orders (+ mock_comstruct_orders via cascade),
 *         material_sets (+ material_set_items via cascade), products
 *         (+ project_products via cascade), suppliers.
 *
 * Use when you want to demo "an empty database → upload a PDF/CSV →
 * watch the catalog grow." After this, /procurement/catalog is empty,
 * the foreman home renders its no-data states, and the only path to
 * put product rows back is `/procurement/ingest` or a re-seed.
 *
 * Run with: `npm run wipe`. WARNING: writes to the SHARED Supabase
 * project. Coordinate in team chat first.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

// Batched delete: Supabase's REST endpoint enforces a ~3 s statement
// timeout, so deleting 50 k rows in a single call fails. We page through
// ids in batches of 500 instead — small tables finish in one round-trip,
// huge ones (products at bulk scale) finish in ~100 round-trips.
const BATCH = 500;
async function wipeAll(db: SupabaseClient, table: string): Promise<void> {
  let total = 0;
  while (true) {
    const { data, error } = await db
      .from(table)
      .select("id")
      .limit(BATCH);
    if (error) throw new Error(`${table} select: ${error.message}`);
    const ids = (data ?? []).map((r) => (r as { id: string }).id);
    if (ids.length === 0) break;
    const { error: dErr } = await db.from(table).delete().in("id", ids);
    if (dErr) throw new Error(`${table} delete: ${dErr.message}`);
    total += ids.length;
    if (total % (BATCH * 10) === 0) {
      console.log(`[wipe]   ${table}: ${total}…`);
    }
    if (ids.length < BATCH) break;
  }
  console.log(`[wipe]   ${table} (${total} rows)`);
}

async function countAll(db: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    console.warn(`[wipe] count ${table}: ${error.message}`);
    return -1;
  }
  return count ?? 0;
}

async function main() {
  const db = getClient();
  console.log("[wipe] starting — keeps projects, profiles, approval_rules");

  // Order matters: respects FK constraints.
  //   order_items.product_id  → products  ON DELETE RESTRICT  ⇒ delete items first
  //   orders.id               cascades to mock_comstruct_orders
  //   material_sets.id        cascades to material_set_items
  //   products.id             cascades to project_products + remaining material_set_items
  //   products.supplier_id    → suppliers ON DELETE RESTRICT  ⇒ delete products before suppliers
  await wipeAll(db, "order_items");
  await wipeAll(db, "orders");
  await wipeAll(db, "material_sets");
  await wipeAll(db, "products");
  await wipeAll(db, "suppliers");

  const tables = [
    "projects",
    "profiles",
    "approval_rules",
    "suppliers",
    "products",
    "project_products",
    "material_sets",
    "material_set_items",
    "orders",
    "order_items",
    "mock_comstruct_orders",
  ];
  console.log("[wipe] final counts:");
  for (const t of tables) {
    const c = await countAll(db, t);
    console.log(`  ${t.padEnd(24)} ${c}`);
  }
  console.log(
    "[wipe] done — catalog is empty. Use /procurement/ingest to populate.",
  );
}

main().catch((err) => {
  console.error("[wipe] failed:", err);
  process.exit(1);
});
