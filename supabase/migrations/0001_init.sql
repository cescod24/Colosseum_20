-- 0001_init.sql — Site Order initial schema
--
-- Notes for reviewers:
-- * RLS policies are written as if Supabase Auth were live (auth.uid() returns
--   the calling profile id). In the hackathon demo the server uses the
--   service-role key, which bypasses RLS — so these policies do not fire in
--   normal demo traffic. They ship anyway, so the security story is real and
--   so flipping on real auth later is a config change, not a schema change.
-- * All money columns are NUMERIC(12,2). Currency defaults to 'CHF'.
-- * Status values use CHECK constraints, not Postgres ENUMs, to keep
--   migrations simple.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists projects (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  currency                text not null default 'CHF',
  auto_approve_threshold  numeric(12, 2) not null default 200,
  created_at              timestamptz not null default now()
);

create table if not exists suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists products (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references suppliers(id) on delete restrict,
  supplier_sku    text not null,
  name            text not null,
  product_group   text,
  trade           text,
  unit            text not null,
  pack_size       numeric(12, 3),
  unit_price      numeric(12, 4),
  currency        text not null default 'CHF',
  hazardous       boolean not null default false,
  status          text not null default 'active'
                  check (status in ('active', 'review')),
  confidence      numeric(4, 3),
  created_at      timestamptz not null default now(),
  unique (supplier_id, supplier_sku)
);

create table if not exists project_products (
  project_id  uuid not null references projects(id) on delete cascade,
  product_id  uuid not null references products(id)  on delete cascade,
  primary key (project_id, product_id)
);

create table if not exists material_sets (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists material_set_items (
  set_id        uuid not null references material_sets(id) on delete cascade,
  product_id    uuid not null references products(id)      on delete cascade,
  default_qty   numeric(12, 3) not null,
  primary key (set_id, product_id)
);

create table if not exists profiles (
  id           uuid primary key default gen_random_uuid(),
  role         text not null check (role in ('foreman', 'procurement')),
  display_name text not null,
  project_id   uuid references projects(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists orders (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete restrict,
  created_by   uuid not null references profiles(id) on delete restrict,
  status       text not null default 'draft'
               check (status in ('draft', 'pending', 'approved', 'ordered', 'delivered')),
  total        numeric(12, 2) not null default 0,
  currency     text not null default 'CHF',
  created_at   timestamptz not null default now(),
  decided_by   uuid references profiles(id) on delete set null,
  decided_at   timestamptz
);

create table if not exists order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id)   on delete cascade,
  product_id  uuid not null references products(id) on delete restrict,
  qty         numeric(12, 3) not null check (qty > 0),
  unit_price  numeric(12, 4) not null
);

create table if not exists approval_rules (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references projects(id) on delete cascade,
  threshold             numeric(12, 2) not null default 200,
  restricted_groups     text[] not null default '{}',
  restricted_suppliers  uuid[] not null default '{}',
  created_at            timestamptz not null default now(),
  unique (project_id)
);

create table if not exists mock_comstruct_orders (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_orders_project_status     on orders (project_id, status);
create index if not exists idx_orders_created_by         on orders (created_by);
create index if not exists idx_order_items_order_id      on order_items (order_id);
create index if not exists idx_order_items_product_id    on order_items (product_id);
create index if not exists idx_products_supplier_id      on products (supplier_id);
create index if not exists idx_products_status           on products (status);
create index if not exists idx_project_products_project  on project_products (project_id, product_id);
create index if not exists idx_material_set_items_set    on material_set_items (set_id);
create index if not exists idx_profiles_project_id       on profiles (project_id);
create index if not exists idx_mock_comstruct_order_id   on mock_comstruct_orders (order_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- Demo runs with the service-role key, which bypasses these policies. They
-- are written as if Supabase Auth were live and auth.uid() returned the
-- caller's profile id.

alter table projects             enable row level security;
alter table suppliers            enable row level security;
alter table products             enable row level security;
alter table project_products     enable row level security;
alter table material_sets        enable row level security;
alter table material_set_items   enable row level security;
alter table profiles             enable row level security;
alter table orders               enable row level security;
alter table order_items          enable row level security;
alter table approval_rules       enable row level security;
alter table mock_comstruct_orders enable row level security;

-- Profiles: every signed-in user can read their own profile row.
create policy "profiles: self read"
  on profiles for select
  using (id = auth.uid());

-- Projects: any profile whose project_id matches can read.
create policy "projects: members read"
  on projects for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.project_id = projects.id
    )
  );

-- Suppliers and products are catalog data: every signed-in user reads them.
create policy "suppliers: signed-in read"
  on suppliers for select
  using (auth.uid() is not null);

create policy "products: signed-in read"
  on products for select
  using (auth.uid() is not null);

create policy "project_products: members read"
  on project_products for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.project_id = project_products.project_id
    )
  );

-- Material sets: project members can read.
create policy "material_sets: members read"
  on material_sets for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.project_id = material_sets.project_id
    )
  );

create policy "material_set_items: members read"
  on material_set_items for select
  using (
    exists (
      select 1
      from material_sets ms
      join profiles p on p.project_id = ms.project_id
      where ms.id = material_set_items.set_id and p.id = auth.uid()
    )
  );

-- Orders: foreman sees only orders they created; procurement sees every
-- order on their project.
create policy "orders: foreman sees own; procurement sees project"
  on orders for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'procurement'
        and p.project_id = orders.project_id
    )
  );

create policy "orders: foreman inserts own"
  on orders for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'foreman'
        and p.project_id = orders.project_id
    )
  );

create policy "orders: procurement decides"
  on orders for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'procurement'
        and p.project_id = orders.project_id
    )
  );

create policy "order_items: visible with parent order"
  on order_items for select
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (
          o.created_by = auth.uid()
          or exists (
            select 1 from profiles p
            where p.id = auth.uid()
              and p.role = 'procurement'
              and p.project_id = o.project_id
          )
        )
    )
  );

create policy "order_items: insert with own order"
  on order_items for insert
  with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.created_by = auth.uid()
    )
  );

-- Approval rules: procurement reads/writes their project's rules.
create policy "approval_rules: procurement reads"
  on approval_rules for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'procurement'
        and p.project_id = approval_rules.project_id
    )
  );

-- Mock comstruct handoff: procurement reads (foremen don't need it).
create policy "mock_comstruct_orders: procurement reads"
  on mock_comstruct_orders for select
  using (
    exists (
      select 1
      from orders o
      join profiles p on p.project_id = o.project_id
      where o.id = mock_comstruct_orders.order_id
        and p.id = auth.uid()
        and p.role = 'procurement'
    )
  );
