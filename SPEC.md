# SPEC.md — Site Order build plan

This is the full build plan for the C-materials ordering app. Work through it
**phase by phase, top to bottom.** Each phase ends with a checkpoint: run lint +
typecheck, confirm the app builds, summarise changes, commit, and stop for
review before continuing. Tick the checkboxes as you go.

---

## Product context (read once)

**Problem.** Today a foreman orders site consumables by phone; a paper delivery
note ends up in a container and is reconciled against invoices by hand at HQ
once a week. C-materials are ~5% of purchasing value but ~60% of orders, ~75% of
suppliers and ~85% of items — "tail spend": cheap material, expensive process.

**Solution.** A mobile shopping-list app seeded from the company's contracted
products. The foreman reorders or finds items *by task* (not by SKU), submits a
structured order; small orders auto-approve, larger ones route to procurement.
Single status trail: Draft → Pending → Approved → Ordered → Delivered.

**Two personas.**
- *Foreman / Polier* (primary): not a digital native, gloved, poor reception,
  time-poor. Rule: if it's slower than a phone call, they won't use it.
- *Procurement / Bauleiter* (control): wants control without micro-managing;
  sets thresholds and approves the exceptions.

**Relation to comstruct.** comstruct is the back-office procurement backbone
(projects, deliveries, invoices → ERP). It has no foreman ordering front-end and
no catalog endpoint — that gap is what we fill. At fulfilment the confirmed order
would hand off to comstruct's delivery pipeline; **for this build that handoff is
mocked** (a stub function that logs the payload).

---

## Architecture rules

- Next.js App Router. Foreman and procurement are routes in one app, gated by
  Supabase Auth role (`foreman` | `procurement`).
- **All OpenAI calls live in `app/api/**` Route Handlers (server-side).** Two
  endpoints: `POST /api/ingest` (PDF/CSV → normalized products) and
  `POST /api/discover` (natural-language task → ranked product list).
- Approval logic runs server-side at order submit, reading rules from the DB.
- Supabase Realtime pushes order-status changes to the foreman's status screen.

## Data model (create as the first migration)

```
projects        (id, name, currency, auto_approve_threshold, created_at)
suppliers       (id, name)
products        (id, supplier_id, supplier_sku, name, product_group, trade,
                 unit, pack_size, unit_price, currency, hazardous,
                 status ['active'|'review'], confidence)
project_products(project_id, product_id)        -- which catalog a project sees
material_sets   (id, project_id, name)           -- templates ("Drywall kit")
material_set_items (set_id, product_id, default_qty)
orders          (id, project_id, created_by, status
                 ['draft'|'pending'|'approved'|'ordered'|'delivered'],
                 total, currency, created_at, decided_by, decided_at)
order_items     (id, order_id, product_id, qty, unit_price)
approval_rules  (id, project_id, threshold, restricted_groups[], restricted_suppliers[])
profiles        (id, role ['foreman'|'procurement'], display_name, project_id)
```

Seed data: `data/sample.csv` (100 real C-materials with columns
`artikel_id, artikelname, kategorie, einheit, preis_eur, lieferant,
verbrauchsart, gefahrgut, lagerort, typische_baustelle`). Map `kategorie`→
`product_group`, `einheit`→`unit`, `preis_eur`→`unit_price`, `lieferant`→
supplier, `gefahrgut`→`hazardous`, `typische_baustelle`→`trade` hint.

---

## Phase 0 — Scaffold  `[ ]`
- [ ] Create the Next.js + TypeScript + Tailwind + shadcn/ui project.
- [ ] Add Supabase client (server + browser helpers), `.env.example`, `.env.local`.
- [ ] Install: `openai`, `papaparse`, `zod`, `recharts`.
- [ ] Add `npm run typecheck` and a `seed` script stub.
- **Checkpoint:** `npm run dev` serves a placeholder home page.

## Phase 1 — Data model + seed  `[ ]`
- [ ] Write the first SQL migration creating all tables above + RLS policies
      (foreman sees own project; procurement sees their projects).
- [ ] Implement `npm run seed`: parse `data/sample.csv` with PapaParse, insert
      one supplier per distinct `lieferant`, insert products mapped to the
      normalized model, create one demo project "Baustelle Zürich-West" with an
      auto-approve threshold of 200, link all products to it.
- **Checkpoint:** seed runs; products visible in Supabase.

## Phase 2 — Foreman reorder flow (F1, weight 18 — highest priority)  `[ ]`
- [ ] Mobile-first home screen: "Order again" front and centre, showing
      "Your last order" and "Most ordered on this project" as tappable rows.
- [ ] Item rows use large +/- steppers, no modals, minimal typing.
- [ ] Cart + "Send order" creates an `orders` row with `order_items`.
- **Checkpoint:** a foreman can build and submit an order in well under a minute.

## Phase 3 — Order state machine + status view (F2, weight 15)  `[ ]`
- [ ] Implement status enum + transitions. On submit, compute total and apply
      rules (Phase 4) to decide `draft→pending` vs `draft→approved`.
- [ ] Foreman "Orders" screen: each order as a horizontal status pill
      (Draft → Pending → Approved → Ordered → Delivered), plain-language
      "waiting on procurement" when pending.
- [ ] Wire Supabase Realtime so status changes appear without refresh.
- **Checkpoint:** status updates live when procurement acts (after Phase 5).

## Phase 4 — Approval rules engine (F3, weight 14)  `[ ]`
- [ ] Server-side rule evaluation at submit: total ≥ project threshold OR item in
      a restricted group/supplier → `pending`, else `approved`.
- [ ] Rules read from `approval_rules` (data, not code).
- **Checkpoint:** a 40 CHF order auto-approves; a 310 CHF order goes pending.

## Phase 5 — Procurement approval queue (F4, weight 12)  `[ ]`
- [ ] Procurement view: list of pending orders (total, items, project, orderer);
      Approve / Reject in one tap; sets `decided_by`/`decided_at` and status.
- [ ] Project config screen: set `auto_approve_threshold`, restricted
      groups/suppliers.
- **Checkpoint:** approving flips the foreman's order to Approved live.

## Phase 6 — Catalog ingestion: CSV + PDF (F5, weight 12)  `[ ]`
- [ ] CSV/Excel upload → PapaParse → map columns → insert as `active` products.
- [ ] `POST /api/ingest`: accept a contract PDF, send to OpenAI as a file
      block, return JSON to the normalized schema; infer `product_group`/`trade`
      from descriptions; **extract-or-null on price**; validate with Zod.
- [ ] Rows with null price or low confidence land as `status='review'`; a small
      admin screen lets procurement confirm/edit/group them before activating.
- **Checkpoint:** uploading the sample contract PDF produces reviewable products.

## Phase 7 — Task-based discovery (F6, weight 11)  `[ ]`
- [ ] Big-icon category browse (Fasteners, Tape & seals, PPE, Tools, …).
- [ ] `POST /api/discover`: take a natural-language task ("seal a window",
      "fix plasterboard to metal stud"), pass it plus the project's catalog to
      OpenAI, return a short ranked list with reasons. Add to cart from there.
- **Checkpoint:** a task query returns a sensible short list, not a SKU dump.

## Phase 8 — C-materials explainer + misuse prevention (F7, weight 8)  `[ ]`
- [ ] One-screen plain-language onboarding: "what belongs here".
- [ ] If a search looks like an A-material ("concrete", "steel", "rebar"),
      show a friendly redirect explaining big structural materials use a
      different process — no dead end.

## Phase 9 — Spend dashboard (F8, weight 6)  `[ ]`
- [ ] Procurement charts (Recharts): spend per project / supplier / product
      group; top tail-spend foremen.

## Phase 10 — Material-set templates (F9, weight 4 — cut first if short on time) `[ ]`
- [ ] Procurement defines a set per phase; foreman picks set + tweaks quantities.

---

## Definition of done (demo acceptance test)
Run this end-to-end:
1. Procurement uploads `data/sample.csv` and a contract PDF → reviews 2 flagged
   rows → catalog live; threshold set to 200.
2. Foreman reorders last order (~40 CHF) → **auto-approved → Ordered** in ~20s.
3. Foreman searches "seal a window" → silicone + cleaner + tape → larger qty →
   total ~310 CHF → **Pending**.
4. Procurement approves in one tap → foreman screen flips to **Approved** live.
5. Procurement opens dashboard → spend split by supplier and product group.

## Out of scope (do NOT build)
Live comstruct API calls (mock the handoff); vector search/embeddings (single
prompt is enough at this catalog size); native mobile app; full offline sync
(a simple queue-and-retry on the cart is enough); multi-language UI (pick one);
supplier-side accounts; invoice/delivery-note reconciliation; punchout/IDS live
connection; push notifications.
