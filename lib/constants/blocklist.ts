// A-material substring blocklist. Applied:
//   1. at the foreman search input (Phase 7) — match → friendly redirect, no
//      OpenAI call;
//   2. at every ingestion path (Phase 6) — match → row is dropped (or, on
//      ambiguous PDFs, flagged for procurement review) so A/B-material can
//      never enter the catalog.
//
// Match is **case-insensitive substring**. Keep entries lowercase; the
// matcher lowercases its input.

export const A_MATERIAL_BLOCKLIST: readonly string[] = [
  "beton",
  "zement",
  "stahl",
  "bewehrung",
  "rebar",
  "concrete",
  "steel",
  "schacht",
  "schachtring",
  "schachtdeckel",
  "kabelschutzrohr",
  "betonrohr",
  "granit",
  "gneiss",
  "pflasterstein",
];

export function isABlockedTerm(input: string): boolean {
  const haystack = input.toLowerCase();
  return A_MATERIAL_BLOCKLIST.some((needle) => haystack.includes(needle));
}
