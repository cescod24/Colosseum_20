// Per-unit quick-pick chip presets for the foreman cart Stepper.
//
// Stk      → 10 / 25 / 50 / 100
// Rolle    → 1 / 2 / 5 / 10
// Liter    → 1 / 2 / 5 / 10
// Dose     → 1 / 2 / 5 / 10
// Eimer    → 1 / 2 / 5 / 10
// Paar     → 1 / 2 / 5 / 10
// default  → 1 / 2 / 5 / 10
//
// Numeric keypad is intentionally absent — see plan.md §2.

export type ChipPreset = readonly number[];

export const chipsByUnit: Record<string, ChipPreset> = {
  Stk: [10, 25, 50, 100],
  Rolle: [1, 2, 5, 10],
  Liter: [1, 2, 5, 10],
  Dose: [1, 2, 5, 10],
  Eimer: [1, 2, 5, 10],
  Paar: [1, 2, 5, 10],
  m: [10, 25, 50, 100],
  Flasche: [1, 2, 5, 10],
  Tub: [1, 2, 5, 10],
};

export const defaultChips: ChipPreset = [1, 2, 5, 10];

export function chipsFor(unit: string | null | undefined): ChipPreset {
  if (!unit) return defaultChips;
  return chipsByUnit[unit] ?? defaultChips;
}
