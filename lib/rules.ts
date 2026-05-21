// Pure approval-rules engine. Unit-tested in Phase 4.
//
// `decide()` returns `'approved'` for the safe path and `'pending'` if any
// rule trips. Rules:
//   1. total >= threshold
//   2. any item's product_group is in restricted_groups
//   3. any item.hazardous is true
//
// Step 0 ships the function signature + a trivial implementation so route
// handlers and tests can already wire it up; the real logic is the same
// three branches, intentionally simple.

export type RuleItem = {
  product_group: string | null;
  hazardous: boolean;
};

export type Rules = {
  threshold: number;
  restricted_groups: readonly string[];
};

export type Decision = "approved" | "pending";

export function decide(total: number, items: readonly RuleItem[], rules: Rules): Decision {
  if (total >= rules.threshold) return "pending";
  if (items.some((it) => it.hazardous)) return "pending";
  const restricted = new Set(rules.restricted_groups);
  if (items.some((it) => it.product_group !== null && restricted.has(it.product_group))) {
    return "pending";
  }
  return "approved";
}
