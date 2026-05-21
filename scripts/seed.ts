/**
 * scripts/seed.ts — idempotent seed for the Site Order demo.
 *
 * Phase 1 (the schema half) is shipped in Step 0; the real seed logic lands
 * in Phase 1's data half. For now this is a stub so `npm run seed` exists.
 *
 * Run with: `npm run seed`  (uses tsx + the service-role key from .env.local)
 *
 * Plan reminders (Phase 1):
 *   * TRUNCATE … RESTART IDENTITY CASCADE then re-insert — keep it idempotent.
 *   * Apply the A-material blocklist on every CSV row (drop with a warning).
 *   * Map kategorie → product_group via lib/constants/categories.ts;
 *     einheit → unit; preis_eur → unit_price with currency='CHF';
 *     gefahrgut → hazardous; typische_baustelle → trade.
 *   * One supplier per distinct `lieferant`. DO NOT seed ACME — that one is
 *     onboarded live in Phase 6 via the contract PDF.
 *   * Project "Baustelle Zürich-West", auto_approve_threshold=200.
 *   * approval_rules row: restricted_groups=['Hazardous'] (or German equiv).
 *   * 3 profiles: foreman A (PPE/consumables-heavy), foreman B (tools-heavy),
 *     procurement.
 *   * 8–12 orders per foreman across the last ~28 days, dates spread,
 *     skewed by trade. Include ONE sub-threshold hazardous order so the
 *     restricted-group rule has a fixture.
 *   * Three material_sets + items:
 *       "PPE-Set neuer Mitarbeiter",
 *       "Trockenbau-Set 50 m²",
 *       "Werkzeug-Grundausstattung".
 */

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "[seed] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }
  console.log("[seed] stub — Phase 1 will fill this in.");
  console.log("[seed] target:", url);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
