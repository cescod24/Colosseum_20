// Per-unit quick-pick chip presets for the foreman cart Stepper.
//
// Why: the foreman uses gloves, dust, poor reception — no numeric keypad
// anywhere. The chips are the *only* way to enter quantities besides the
// +/- stepper. Numbers picked to match how the unit is actually ordered
// on site (you order screws in tens, not in ones; you order tape rolls
// one at a time).

export type ChipPreset = readonly number[];

export const chipsByUnit: Record<string, ChipPreset> = {
  Stk: [10, 25, 50, 100],
  Paar: [1, 2, 5, 10],
  Rolle: [1, 2, 5, 10],
  Dose: [1, 2, 5, 10],
  Eimer: [1, 2, 5, 10],
  Liter: [1, 2, 5, 10],
  Flasche: [1, 2, 5, 10],
  Tub: [1, 2, 5, 10],
  m: [1, 5, 10, 25],
};

export const defaultChips: ChipPreset = [1, 2, 5, 10];

export function chipsFor(unit: string | null | undefined): ChipPreset {
  if (!unit) return defaultChips;
  return chipsByUnit[unit] ?? defaultChips;
}
