// English microcopy for procurement-facing screens. Mirror structure with
// `copy.de.ts` where both personas share a screen.

import type { Copy } from "./copy.de";

export const copyEn: Copy = {
  "nav.queue": "Approval queue",
  "nav.project": "Project rules",
  "nav.role_pill": "Procurement",
  "nav.switch_role": "Switch role",

  "queue.title": "Pending approvals",
  "queue.empty": "No pending orders. Foremen will land here when an order trips a rule.",
  "queue.col_foreman": "Foreman",
  "queue.col_items": "Items",
  "queue.col_total": "Total",
  "queue.col_submitted": "Submitted",
  "queue.col_actions": "",
  "queue.approve": "Approve",
  "queue.reject": "Reject",
  "queue.line_unit_price": "Unit price",
  "queue.line_qty": "Qty",
  "queue.line_total": "Line total",
  "queue.hazardous_flag": "Hazardous",

  "project.title": "Project rules",
  "project.threshold_label": "Auto-approve threshold (CHF)",
  "project.threshold_help": "Orders at or above this total go to pending approval.",
  "project.restricted_groups_label": "Restricted product groups",
  "project.restricted_groups_help": "Comma-separated. Any order containing these groups goes to pending.",
  "project.save": "Save rules",
  "project.saved": "Saved.",
  "project.missing": "No project found for the procurement profile. Run the seed first.",

  "comstruct.sent": "Sent to comstruct.",
};
