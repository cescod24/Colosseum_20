-- 0004_partial_order_decisions.sql — partial-decline + suggested alternatives.
--
-- Procurement can now decide each line of an order independently: approve,
-- or decline-with-reason and (optionally) suggest a replacement product.
-- The foreman sees declined lines on their order detail with the reason and
-- can one-tap the suggestion into their cart for a new Bestellung.
--
-- All additive. Existing single-action approve/reject paths keep working
-- via the existing `orders.status` flow; per-line fields default to
-- 'approved' for legacy rows so dashboards and seed history stay consistent.

alter table order_items
  add column if not exists line_status text not null default 'approved'
    check (line_status in ('approved', 'rejected'));

alter table order_items
  add column if not exists decline_reason text;

alter table order_items
  add column if not exists suggested_product_id uuid
    references products(id) on delete set null;

alter table order_items
  add column if not exists suggested_qty numeric(12, 3)
    check (suggested_qty is null or suggested_qty > 0);

create index if not exists idx_order_items_suggested_product
  on order_items (suggested_product_id);
