// Canned Anthropic ingestion responses. Used when:
//   - ANTHROPIC_API_KEY is missing (local demo without a key)
//   - the live call times out or errors
//
// Two fixtures, matched against the uploaded filename:
//   * `fake_contract_products_with_logo.pdf`  → 8 clean ACME rows (all
//     active). Mirrors the C-numbers picked in plan.md Phase 6.
//   * `sample-contract-messy.pdf`             → 6 rows, 4 of which land in
//     review (null price, price range, missing unit, merged line).
//
// If the filename matches neither, a small one-row generic response is
// returned so the UI still has something to render.

import type { IngestResponse } from "../schema";

const ACME_SUPPLIER = "ACME Bauzulieferung AG";

export const CANNED_CLEAN_ACME: IngestResponse = {
  supplier_name: ACME_SUPPLIER,
  rows: [
    {
      name: "Schraube TX20 4x40",
      supplier_sku: "ACME-C001",
      unit: "Stk",
      unit_price: 0.09,
      product_group: "fasteners",
      hazardous: false,
      confidence: 0.97,
    },
    {
      name: "Kabelbinder 200mm",
      supplier_sku: "ACME-C013",
      unit: "Stk",
      unit_price: 0.07,
      product_group: "electrical",
      hazardous: false,
      confidence: 0.95,
    },
    {
      name: "Arbeitshandschuhe Gr.9",
      supplier_sku: "ACME-C019",
      unit: "Paar",
      unit_price: 2.7,
      product_group: "ppe",
      hazardous: false,
      confidence: 0.96,
    },
    {
      name: "Malervlies",
      supplier_sku: "ACME-C025",
      unit: "Rolle",
      unit_price: 19.5,
      product_group: "covers_tape",
      hazardous: false,
      confidence: 0.94,
    },
    {
      name: "Markierspray rot",
      supplier_sku: "ACME-C029",
      unit: "Dose",
      unit_price: 7.8,
      product_group: "paint",
      hazardous: true,
      confidence: 0.93,
    },
    {
      name: "Bohrer 10mm",
      supplier_sku: "ACME-C035",
      unit: "Stk",
      unit_price: 5.6,
      product_group: "tools",
      hazardous: false,
      confidence: 0.96,
    },
    {
      name: "Wasserwaage 60cm",
      supplier_sku: "ACME-C046",
      unit: "Stk",
      unit_price: 19.2,
      product_group: "tools",
      hazardous: false,
      confidence: 0.95,
    },
    {
      name: "Baustellenlampe LED",
      supplier_sku: "ACME-C056",
      unit: "Stk",
      unit_price: 31,
      product_group: "electrical",
      hazardous: false,
      confidence: 0.94,
    },
  ],
};

export const CANNED_MESSY_ACME: IngestResponse = {
  supplier_name: ACME_SUPPLIER,
  rows: [
    {
      name: "Bauschaum XL 750 ml",
      supplier_sku: "ACME-200",
      unit: "Dose",
      unit_price: null, // "auf Anfrage"
      product_group: "sealants",
      hazardous: true,
      confidence: 0.42,
    },
    {
      name: "Putzeimer Mehrzweck 15L",
      supplier_sku: "ACME-201",
      unit: "Stk",
      unit_price: null, // "5 – 8 CHF" range, can't pick a value
      product_group: "cleaning_chemicals",
      hazardous: false,
      confidence: 0.52,
    },
    {
      name: "Reinigungstücher Industrie",
      supplier_sku: "ACME-202",
      unit: null, // missing unit on the source row
      unit_price: 12.4,
      product_group: "cleaning_chemicals",
      hazardous: false,
      confidence: 0.45,
    },
    {
      name: "Schraube TX25 6x80 / passender Dübel 8mm",
      supplier_sku: "ACME-203",
      unit: "Stk",
      unit_price: 0.32,
      product_group: "fasteners",
      hazardous: false,
      confidence: 0.55,
    },
    {
      name: "Klebeband universal 50mm",
      supplier_sku: "ACME-204",
      unit: "Rolle",
      unit_price: 6.1,
      product_group: "covers_tape",
      hazardous: false,
      confidence: 0.92,
    },
    {
      name: "Schutzhandschuh Cut-5 Gr.10",
      supplier_sku: "ACME-205",
      unit: "Paar",
      unit_price: 3.6,
      product_group: "ppe",
      hazardous: false,
      confidence: 0.91,
    },
  ],
};

export const CANNED_GENERIC: IngestResponse = {
  supplier_name: "Unbekannter Lieferant",
  rows: [
    {
      name: "Mustereintrag — bitte prüfen",
      supplier_sku: "GENERIC-001",
      unit: null,
      unit_price: null,
      product_group: null,
      hazardous: false,
      confidence: 0.3,
    },
  ],
};

export function cannedIngestFor(filename: string | undefined | null): IngestResponse {
  const lower = (filename ?? "").toLowerCase();
  if (lower.includes("messy")) return CANNED_MESSY_ACME;
  if (lower.includes("fake_contract") || lower.includes("logo")) {
    return CANNED_CLEAN_ACME;
  }
  return CANNED_GENERIC;
}
