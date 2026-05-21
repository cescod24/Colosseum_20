// Canonical category map. The key is the `product_group` value stored in
// the `products` table and used in approval rules. The display info drives:
//   - the foreman discovery icon grid (Phase 7)
//   - the procurement ingest review screen badges
//
// `kategorieToCategory` folds the CSV's free-text `kategorie` column into
// the canonical key at ingestion (`scripts/seed.ts`) so the catalog stays
// consistent regardless of supplier vocabulary.
//
// Icon names are lucide-react component names — see https://lucide.dev.

export type CategoryDefinition = {
  label_de: string;
  label_en: string;
  icon: string;
};

export const categories = {
  fasteners: {
    label_de: "Befestigung & Kleinteile",
    label_en: "Fasteners & small parts",
    icon: "Wrench",
  },
  electrical: {
    label_de: "Elektro",
    label_en: "Electrical",
    icon: "Plug",
  },
  ppe: {
    label_de: "Schutzkleidung & PSA",
    label_en: "PPE",
    icon: "HardHat",
  },
  tools: {
    label_de: "Werkzeug & Messen",
    label_en: "Tools & measuring",
    icon: "Hammer",
  },
  covers_tape: {
    label_de: "Abdeckung & Kleben",
    label_en: "Covers & tape",
    icon: "Tape",
  },
  sealants: {
    label_de: "Dichten & Fugen",
    label_en: "Sealants & joints",
    icon: "Droplet",
  },
  paint: {
    label_de: "Farbe & Maler",
    label_en: "Paint & decorating",
    icon: "Paintbrush",
  },
  cleaning_chemicals: {
    label_de: "Reinigung & Chemie",
    label_en: "Cleaning & chemicals",
    icon: "Sparkles",
  },
  misc: {
    label_de: "Sonstiges / Kleinmaterial",
    label_en: "Misc / small bits",
    icon: "Boxes",
  },
} as const satisfies Record<string, CategoryDefinition>;

export type CategoryKey = keyof typeof categories;

export const CATEGORY_KEYS: readonly CategoryKey[] = Object.keys(
  categories,
) as CategoryKey[];

// CSV `kategorie` values seen in `data/sample.csv` and the supplier PDFs
// we expect to ingest, folded into the canonical group.
const KATEGORIE_TO_CATEGORY: Record<string, CategoryKey> = {
  Befestigung: "fasteners",
  Kunststoff: "fasteners",
  Kleinmaterial: "fasteners",
  Elektro: "electrical",
  PSA: "ppe",
  Werkzeug: "tools",
  Handwerkzeug: "tools",
  Messwerkzeug: "tools",
  Abdeckung: "covers_tape",
  Klebeband: "covers_tape",
  Verpackung: "covers_tape",
  Abdichtung: "sealants",
  Dichtstoffe: "sealants",
  Farbe: "paint",
  Malerbedarf: "paint",
  Reinigung: "cleaning_chemicals",
  "Behälter": "cleaning_chemicals",
  Entsorgung: "cleaning_chemicals",
  Chemie: "cleaning_chemicals",
  Schreibwaren: "misc",
  Markierung: "misc",
  Transport: "misc",
  Konsum: "misc",
};

export function categoryFor(kategorie: string | null | undefined): CategoryKey {
  if (!kategorie) return "misc";
  return KATEGORIE_TO_CATEGORY[kategorie.trim()] ?? "misc";
}

export function labelDe(key: CategoryKey): string {
  return categories[key].label_de;
}

export function labelEn(key: CategoryKey): string {
  return categories[key].label_en;
}
