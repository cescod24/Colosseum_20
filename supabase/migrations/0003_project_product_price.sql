-- 0003_project_product_price.sql — add per-project price override.
--
-- Phase 9.3.4. The brief calls out "different price structures (contract
-- prices, discounts, project-specific prices)" — `products.unit_price` is
-- the catalog price; this column on `project_products` lets procurement
-- override the price for a specific project without touching the shared
-- catalog row.
--
-- Additive: existing rows get NULL (no override), and POST /api/orders
-- falls back to `products.unit_price` when the override is NULL — so the
-- existing demo behaviour is preserved bit-for-bit.
--
-- After pulling this commit, run `npx supabase db push` against your
-- cloud project (or paste the migration into the dashboard SQL editor).

alter table project_products
  add column if not exists unit_price numeric(12, 4);

comment on column project_products.unit_price is
  'Per-project price override. NULL = use products.unit_price (default).';
