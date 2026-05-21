// German microcopy for foreman-facing screens. Keep entries flat and short;
// no jargon ("Klasse C"), plain-language only — see CLAUDE.md.
//
// Step 0 ships the type and an empty bag; phases that need new strings add
// them here.

export type Copy = Record<string, string>;

export const copyDe: Copy = {
  // TODO(phase-2+): fill in as foreman screens land.
  // Examples (keys to be added by the owning phase):
  //   "home.title": "Bestellung",
  //   "home.last_order": "Dein letzter Auftrag",
  //   "home.most_ordered": "Am meisten bestellt auf dieser Baustelle",
  //   "cart.submit": "Bestellung senden",
};
