// Hand-curated `kategorie → { label_de, label_en, icon }` map used by:
// - the foreman discovery icon grid (Phase 7)
// - the ingestion normaliser (Phase 6) when mapping CSV `kategorie` rows to
//   the canonical `product_group` value
//
// Keys MUST match the CSV's `kategorie` column casing. Icon names refer to
// lucide-react icon component names (see https://lucide.dev/icons).
//
// Step 0 ships the type + an empty record. Filling this in is Phase 2 work.

export type CategoryDefinition = {
  label_de: string;
  label_en: string;
  icon: string; // lucide-react icon component name
};

export const categories: Record<string, CategoryDefinition> = {
  // TODO(phase-2): populate ~8 plain-language tiles + a "Sonstiges" catch-all.
};
