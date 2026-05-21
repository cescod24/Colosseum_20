// English microcopy for procurement-facing screens. Mirror structure with
// `copy.de.ts` where both personas share a screen.

import type { Copy } from "./copy.de";

export const copyEn: Copy = {
  "nav.queue": "Approval queue",
  "nav.project": "Project rules",
  "nav.catalog": "Catalog",
  "nav.dashboard": "Spend",
  "nav.role_pill": "Procurement",
  "nav.switch_role": "Switch role",

  "catalog.title": "Catalog",
  "catalog.subtitle": "Active products on this project",
  "catalog.empty": "No products linked to this project yet. Ingest a CSV or PDF to populate the catalog.",
  "catalog.col_name": "Name",
  "catalog.col_supplier": "Supplier",
  "catalog.col_sku": "SKU",
  "catalog.col_group": "Group",
  "catalog.col_unit": "Unit",
  "catalog.col_price": "Unit price",
  "catalog.col_save": "Save",

  "dashboard.title": "Spend dashboard",
  "dashboard.subtitle": "C-material tail spend",
  "dashboard.by_supplier": "Spend by supplier",
  "dashboard.by_group": "Spend by product group",
  "dashboard.by_foreman": "Top foremen by spend",
  "dashboard.foreman": "Foreman",
  "dashboard.spend": "Spend",
  "dashboard.alert_title": "3 orders this month went to non-framework suppliers",
  "dashboard.alert_body":
    "Mocked compliance gate: a live version would join approval_rules to a supplier-framework table and surface every non-framework order here within the polling window.",
  "dashboard.alert_cta": "Review queue",

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
  "queue.decision.approve_all": "Approve all",
  "queue.decision.reject_all": "Reject all",
  "queue.decision.line_approve": "Approve",
  "queue.decision.line_decline": "Decline",
  "queue.decision.reason_label": "Reason (visible to the foreman)",
  "queue.decision.reason_placeholder":
    "e.g. supplier out of stock, wrong size, prefer framework alternative",
  "queue.decision.suggest_label": "Suggested replacement",
  "queue.decision.suggest_none": "— no suggestion —",
  "queue.decision.suggest_qty_label": "Qty",
  "queue.decision.approved_total": "Approved total",
  "queue.decision.submit": "Submit decision",
  "queue.decision.submitting": "Submitting…",

  "project.title": "Project rules",
  "project.threshold_label": "Auto-approve threshold (CHF)",
  "project.threshold_help": "Orders at or above this total go to pending approval.",
  "project.restricted_groups_label": "Restricted product groups",
  "project.restricted_groups_help": "Comma-separated. Any order containing these groups goes to pending.",
  "project.save": "Save rules",
  "project.saved": "Saved.",
  "project.missing": "No project found for the procurement profile. Run the seed first.",

  "comstruct.sent": "Sent to comstruct.",

  "nav.punchout": "Punchout",
  "punchout.title": "Punchout / IDS",
  "punchout.subtitle":
    "Second supplier ingestion channel alongside CSV and contract-PDF uploads.",
  "punchout.haefele_description":
    "Mock IDS round-trip to Häfele DE: pulls 12 furniture-fitting and tool SKUs into the catalog under a new Häfele DE supplier and links them to this project.",
  "punchout.connect": "Connect to Häfele (mock)",
  "punchout.note":
    "After connecting, the rows appear in the active catalog —",
  "punchout.view_catalog": "view catalog",
  "punchout.success":
    "✓ Connected. 12 Häfele DE SKUs are now in the catalog and linked to this project.",
  "punchout.architecture_label": "Why this is mocked",
  "punchout.architecture_body":
    "A real punchout / IDS handshake is supplier-by-supplier integration work measured in weeks. The hackathon demo proves the data path: API hit → upsert into `products` keyed by (supplier_id, supplier_sku) → link via `project_products` → instant availability on the foreman discovery search.",
};
