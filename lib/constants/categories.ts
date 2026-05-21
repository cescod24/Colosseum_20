// Hand-curated `kategorie → { label_de, label_en, icon }` map used by:
// - the foreman discovery icon grid (Phase 7)
// - the ingestion normaliser (Phase 6) when mapping CSV `kategorie` rows to
//   the canonical `product_group` value
//
// Keys MUST match the CSV's `kategorie` column casing. Icon names refer to
// lucide-react icon component names (see https://lucide.dev/icons).
//
// The CSV ships ~25 distinct `kategorie` values; we surface 8 of them as
// first-class tiles on the discovery grid. Every other `kategorie` rolls up
// into the `Sonstiges` catch-all so the long tail still has a tile to land on.

export type CategoryDefinition = {
  label_de: string;
  label_en: string;
  icon: string; // lucide-react icon component name
};

export const SONSTIGES_KEY = "Sonstiges";

export const categories: Record<string, CategoryDefinition> = {
  Befestigung: {
    label_de: "Schrauben & Dübel",
    label_en: "Fasteners",
    icon: "Wrench",
  },
  PSA: {
    label_de: "Schutzausrüstung",
    label_en: "Personal protective equipment",
    icon: "HardHat",
  },
  Elektro: {
    label_de: "Elektromaterial",
    label_en: "Electrical",
    icon: "Zap",
  },
  Werkzeug: {
    label_de: "Werkzeug",
    label_en: "Tools",
    icon: "Hammer",
  },
  Handwerkzeug: {
    label_de: "Handwerkzeug",
    label_en: "Hand tools",
    icon: "Wrench",
  },
  Farbe: {
    label_de: "Farben & Marker",
    label_en: "Paint & markers",
    icon: "PaintRoller",
  },
  Klebeband: {
    label_de: "Klebeband",
    label_en: "Tape",
    icon: "Tag",
  },
  Reinigung: {
    label_de: "Reinigung",
    label_en: "Cleaning",
    icon: "Trash2",
  },
  Chemie: {
    label_de: "Chemie & Sprays",
    label_en: "Chemicals & sprays",
    icon: "SprayCan",
  },
  [SONSTIGES_KEY]: {
    label_de: "Sonstiges",
    label_en: "Everything else",
    icon: "Package",
  },
};

/** All distinct kategorie keys we know about (CSV cover). */
export const CATEGORY_KEYS = Object.keys(categories) as readonly string[];

/** Map a raw CSV `kategorie` to a canonical product_group string. */
export function productGroupFor(kategorie: string | null | undefined): string {
  if (!kategorie) return SONSTIGES_KEY;
  if (kategorie in categories) return kategorie;
  return SONSTIGES_KEY;
}
