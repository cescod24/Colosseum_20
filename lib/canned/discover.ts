// Canned discovery responses (OpenAI) for the rehearsed demo prompts.
//
// Returned by `/api/discover` when:
//   - the query (lowercased) matches one of the entries below
//   - AND the live AI call would otherwise be needed (no key / timeout /
//     error), OR there is no DB to fetch a real catalog from.
//
// The route handler then resolves the SKUs to UUIDs from the seeded catalog
// (when the DB is available) or returns the canned items with deterministic
// placeholder UUIDs (no-DB demo mode).

import type { AiDiscoverResponse } from "../schema";

export type CannedDiscoverHit = AiDiscoverResponse;

const HITS: ReadonlyArray<{ matches: readonly string[]; response: CannedDiscoverHit }> = [
  {
    matches: ["fenster abdichten", "fenster", "abdichten"],
    response: {
      items: [
        {
          supplier_sku: "C039",
          reason: "Silikon transparent — schließt die Fuge zwischen Rahmen und Mauerwerk dauerhaft.",
        },
        {
          supplier_sku: "C043",
          reason: "Reinigungsalkohol — entfettet die Flächen, bevor das Silikon aufgetragen wird.",
        },
        {
          supplier_sku: "C027",
          reason: "Panzertape silber — fixiert die Abklebung sauber während der Arbeit.",
        },
      ],
    },
  },
  {
    matches: [
      "gipskarton",
      "gipskarton auf metallständer befestigen",
      "trockenbau",
      "rigips",
    ],
    response: {
      items: [
        {
          supplier_sku: "C003",
          reason: "Schraube TX25 6x80 — passt durch zwei Lagen Gipskarton in den CW-Profil.",
        },
        {
          supplier_sku: "C032",
          reason: "Bit TX20 — universeller Bit-Kopf für TX20-Schrauben, Akkuschrauber-tauglich.",
        },
        {
          supplier_sku: "C033",
          reason: "Bit TX25 — passend für die TX25-Schrauben oben, getrennt von TX20 lagern.",
        },
        {
          supplier_sku: "C027",
          reason: "Panzertape silber — Stoßstellen verstärken oder Folien fixieren.",
        },
      ],
    },
  },
  {
    matches: ["werkzeug nachbestellen", "werkzeug", "tools"],
    response: {
      items: [
        {
          supplier_sku: "C034",
          reason: "Bohrer 8mm — verschleißt am schnellsten, gehört in jeden Werkzeugkasten.",
        },
        {
          supplier_sku: "C032",
          reason: "Bit TX20 — Bits gehen verloren, immer Reserve mitführen.",
        },
        {
          supplier_sku: "C047",
          reason: "Zollstock — Standardausrüstung, zwei Stück pro Trupp.",
        },
        {
          supplier_sku: "C048",
          reason: "Bleistift Baustelle — günstig, geht ständig verloren.",
        },
      ],
    },
  },
];

export function cannedDiscoverFor(query: string): CannedDiscoverHit | null {
  const lower = query.toLowerCase().trim();
  for (const hit of HITS) {
    if (hit.matches.some((m) => lower.includes(m))) {
      return hit.response;
    }
  }
  return null;
}

export function cannedDiscoverEmpty(): CannedDiscoverHit {
  return { items: [] };
}
