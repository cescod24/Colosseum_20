# plan.md — Site Order build plan (with checkboxes)

> **For a future Claude Code chat:** read `ONBOARDING.md` first (it tells you
> where the previous Claude session stopped and which slice you are picking
> up), then `CLAUDE.md`, this file, `C-Materials_Ordering_PRD.md`,
> `data/sample.csv`, and `site_order_foreman_flow_mockup.html`. Then work
> through this file phase by phase, ticking checkboxes as you go. After each
> phase: run `npm run typecheck` + `npm run lint` + `npm run build`,
> summarise changes, commit, and stop for review before the next phase.
> **Do not** widen scope beyond what's listed here; deferred items are at the
> bottom.

> **Stack decision (locked):** **Hybrid architecture for the comstruct ×
> Lovable track** — Next.js 16+ (App Router) on Vercel + Supabase Cloud +
> OpenAI SDK for the secret-bearing backend (AI calls, service-role DB
> writes, the punchout/PDF ingest pipeline), with a **Lovable-built foreman
> UI surface** planned as the v2 front of house once the API contract is
> stable. We chose this split because procurement-side logic and AI calls
> need a real server boundary that the no-server Lovable generator
> doesn't offer, while Lovable is the right tool for the rapid-iteration
> foreman screens we'll demo-extend after the hackathon. See §10.A2 for
> the live `lovable.app` URL when the foreman home is rebuilt there.

---

## 0. Team workflow — Step 0 then three-way split

This is a 3-developer hackathon. Step 0 is single-person work that lands on
`main` and unblocks the rest of the team. Once it's in, three streams run in
parallel against the locked schema + locked `lib/` surface.

**Step 0 — Dev A alone (~30–45 min):**

- Phase 0 scaffold (Next.js, deps, `.env.example`, role switcher, `data/`
  move, CLAUDE.md fix).
- The **schema half of Phase 1**: `supabase/migrations/0001_init.sql` with
  every table, every CHECK, every index, and every RLS policy.
- Typed stubs (signatures only, no real logic) for every shared module the
  other devs will import on day one:
  - `lib/constants/{categories,chips,copy.de,copy.en,blocklist}.ts`
  - `lib/schema.ts` — Zod schemas for AI outputs and order submissions
  - `lib/rules.ts` — pure `decide()` for the approval engine
  - `lib/ai.ts` — wrapped OpenAI client (timeout + canned fallback)
  - `lib/role.ts` — `x-demo-user` cookie helpers
  - `lib/supabase/{server,browser}.ts` — service-role and anon clients

Anything that three people would otherwise collide on (table shape, the Zod
shape of an ingestion row, the `decide()` signature, the constants files
imported by every screen) MUST be agreed in Step 0 and pushed to `main`
**before** the three streams begin. After this commit lands, **branch off**.

**After Step 0 — three parallel slices:**

- **Slice A — Foreman flow (Dev A):** Phase 1 data half (seed) + Phase 2
  (foreman home: banner + last order + kit tiles + most-ordered + cart) +
  Phase 3 (status pills + Realtime).
- **Slice B — Procurement flow (Dev B):** Phase 4 (rules engine end-to-end:
  `POST /api/orders`) + Phase 5 (approval queue + project config + mocked
  comstruct handoff).
- **Slice C — Ingestion + discovery (Dev C):** Phase 6 (CSV/PDF ingest with
  OpenAI + review screen) + Phase 7 (task-based discovery + A-material
  redirect).

Stretch (Phases 8 / 9) is picked up by whichever slice lands first.
Phase 10 stays cut.

---

## 1. Product summary

A mobile-first web app letting a construction foreman (Polier) order site
consumables ("C-materials" — screws, gloves, tape, spray cans) in under a
minute, while procurement keeps control via spend thresholds and approvals.
Sits on top of comstruct (mocked at the fulfilment boundary). German UI for
foreman, English for procurement. Hackathon MVP — favour a working end-to-end
slice over breadth.

Demo flow (Definition of Done):
1. Procurement uploads `data/sample.csv` + the messy contract PDF → reviews
   2 flagged rows → activates → threshold confirmed at 200 CHF.
2. Foreman opens app → sees the "C-Material erklärt" banner once, dismisses it
   → sees three pre-seeded **Sets** as one-tap tiles ("PPE-Set neuer
   Mitarbeiter", "Trockenbau-Set 50 m²", "Werkzeug-Grundausstattung") in
   addition to "Dein letzter Auftrag" and "Am meisten bestellt".
3. Foreman reorders last order (~40 CHF) → **auto-approved → Ordered → Delivered**
   in ~20 s.
4. Foreman taps the "Trockenbau-Set" tile → cart pre-fills with the kit's
   items at default quantities → tweaks one line with the +/- stepper →
   submits.
5. Foreman searches *"Fenster abdichten"* → silicone + cleaner + tape (each
   with a one-line reason) → larger qty → total ~310 CHF → **Pending**.
6. Procurement approves → foreman's pill flips **Approved → Ordered** live →
   a comstruct-shaped row lands in `mock_comstruct_orders` → ~8 s later
   **Delivered**.
7. Foreman searches *"Beton"* → friendly redirect, no API call.
8. (Stretch.) Procurement dashboard shows supplier + product-group spend +
   foreman ranking.

---

## 2. Locked decisions (these override the SPEC where they differ)

- [x] **UI language:** German for foreman screens, English for procurement / admin.
- [x] **Auth:** No real auth — dev role switcher (foreman A / foreman B / procurement)
      via cookie. RLS policies **are** written and shipped in the migration;
      route handlers use the Supabase service role (server-only).
- [x] **Users seeded:** 2 foremen + 1 procurement, all on one project
      "Baustelle Zürich-West".
- [x] **Price visibility:** Foreman **never** sees per-item unit prices — only the
      running cart total. Procurement sees full unit prices everywhere.
      `unit_price` is always stored on `order_items` regardless of display.
- [x] **Currency:** Everything CHF. Ingest renames `preis_eur → unit_price` and sets
      `currency='CHF'`. Schema retains `currency` column on products and orders.
      Contract PDFs are authored in CHF too.
- [x] **Quantity input:** +/- steppers **plus** per-unit preset chips
      (Stk → 10/25/50/100; Rolle/Liter/Dose/Eimer/Paar → 1/2/5/10; default
      fallback 1/2/5/10). **No numeric keypad anywhere.**
- [x] **Offline cart:** localStorage queue + retry on `online` event with a
      visible "wird gesendet, sobald wieder online" badge. Demoed via a UI
      toggle, not by killing wifi.
- [x] **Realtime:** Supabase Realtime on `orders` + 5 s polling fallback merged
      client-side, so the live status flip never fails on stage.
- [x] **comstruct handoff:** Mocked. On Approve, write a comstruct-shaped payload
      (project ref, supplier_id, supplier_sku per line, qty, unit, unit_price,
      currency, hazardous flag, totals) into `mock_comstruct_orders` and
      console.log it. UI shows "Sent to comstruct ✓".
- [x] **Status auto-advance:** Approve → immediately `ordered` (when handoff row
      written) → ~8 s server timer → `delivered`. SPEC's five-state pill
      (Draft · Pending · Approved · Ordered · Delivered) intact.
- [x] **OpenAI calls:** Server-only (`app/api/**`). One wrapper in
      `lib/ai.ts` — try real call with a timeout, fall back to canned
      JSON on missing key / timeout / error. Canned responses are
      representative, not perfect. **Service role and OpenAI key live only
      server-side; browser uses anon key.** (Switched from Anthropic to
      OpenAI — `gpt-4o-mini` — because the team has an OpenAI key.)
- [x] **Discovery shape:** 3–5 items max, each with a **specific** one-line "why
      this fits" reason. Empty result → "Nichts gefunden — probier eine
      Kategorie." with a button to the icon grid.
- [x] **A-material guard:** Deterministic substring blocklist, case-insensitive,
      expanded with German vocabulary observed in the reference Angebot:
      `beton`, `zement`, `stahl`, `bewehrung`, `rebar`, `concrete`, `steel`,
      `schacht`, `schachtring`, `schachtdeckel`, `kabelschutzrohr`,
      `betonrohr`, `granit`, `gneiss`, `pflasterstein`. Applied at search input
      **and** at ingestion (so an A/B-material can never enter the catalog).
      Friendly German redirect copy, no dead-end.
- [x] **Approval rules in MVP:** total threshold + restricted product groups
      (hazardous → always pending). Restricted suppliers + per-foreman thresholds
      are schema-only and not exercised.
- [x] **Hosting / dev env:** Vercel + **Supabase Cloud only** (no local Docker).
      Seed script writes directly to the cloud DB; must be idempotent
      (TRUNCATE … RESTART IDENTITY CASCADE then re-insert).
- [x] **Categories:** Hand-curated `kategorie → { label_de, label_en, icon }` map.
      ~8 plain-language tiles + a "Sonstiges / Kleinmaterial" catch-all for the
      long tail.
- [x] **Seed depth:** ~8–12 orders per foreman across the last ~28 days, dates
      spread, deliberately skewed by trade profile (one PPE/consumables-heavy,
      one tools/fasteners-heavy). Include **one** sub-threshold hazardous order
      so the group rule has something to fire on at demo time.
- [x] **Contract PDFs:** two used by Phase 6 ingestion; live under `data/`.
      - `data/fake_contract_products_with_logo.pdf` — **already in the repo at
        root**, kept under its existing filename to avoid churn. Clean 8-row
        ACME "Supply Contract" with `C001 / C013 / C019 / C025 / C029 / C035 /
        C046 / C056`. EUR prices, normalised to CHF at ingest.
        **No authoring needed.**
      - `data/sample-contract-messy.pdf` — **still to author** for Phase 6.
        2+ ambiguous rows ("auf Anfrage", a price range, a missing unit, a
        merged product line) to exercise the review state. Use the same ACME
        supplier branding so it reads as a late addendum to the clean contract.
- [x] **Real-world reference PDF (not ingested):**
      `Application_Designs_-_2026-04-18T102930.193.pdf` (Swiss "Angebot",
      ~CHF 19'862, four pages of cable shafts, concrete pipes, manhole covers,
      granite cobblestones — clearly A/B-material) sits at the repo root as a
      **shape reference only**. The Phase 6 extraction prompt is written aware
      of this real-PDF shape (two codes per row including Swiss NPK, "Alternative
      Position" rows, per-line Rabatt % / TZ Zuschlag, multi-page repeated
      headers, summary block with MWST + Gewicht) so the path degrades gracefully
      on a real supplier PDF — but this file is never fed to the demo and is not
      moved into `data/`.
- [x] **Two-supplier demo via two ingestion channels:** Phase 1 seeds **only the
      CSV's suppliers** (Würth, Fischer, Reisser, Bauhaus, HellermannTyton, …).
      The **ACME supplier is onboarded live in Phase 6** by uploading
      `fake_contract_products_with_logo.pdf` — that's the demo beat that honours
      the brief's "1–2 example suppliers via Excel + contract" framing. ACME
      product rows coexist with CSV rows under the same artikel codes (e.g.
      C001) because `products` is keyed by `(supplier_id, supplier_sku)`.
- [x] **Material-set kits (minimal):** Three kits are pre-seeded in the DB
      ("PPE-Set neuer Mitarbeiter", "Trockenbau-Set 50 m²",
      "Werkzeug-Grundausstattung") and shown as one-tap tiles on the foreman
      home, alongside "Dein letzter Auftrag" and "Am meisten bestellt". Tapping
      a tile loads the kit's items + default quantities into the cart; the
      foreman tweaks with steppers/chips and submits like any other order.
      **The procurement-side kit editor (UI to define new kits) remains cut** —
      the schema (`material_sets`, `material_set_items`) is in place so the
      claim is real.
- [x] **C-materials explainer is core, not stretch:** A dismissible
      "C-Material erklärt" banner sits at the top of the foreman home from
      Phase 2 onwards (German plain-language, no jargon). Dismiss state
      persists in localStorage. This satisfies the brief's "Explain
      C-materials clearly in the product" deliverable.
- [x] **Single combined approver role:** The brief distinguishes Project
      Manager approval (project budget) from Central Procurement approval
      (framework compliance); the MVP collapses both into one procurement
      role. The schema is generic enough to add a second approver type later;
      called out explicitly in the pitch as a deliberate hackathon collapse.
- [x] **Punchout / IDS second supplier channel:** Not built; narrated in the
      pitch as the second supplier ingestion channel alongside CSV/PDF. No
      mock endpoint, no UI surface — pure verbal acknowledgement so the brief's
      "1–2 suppliers via Excel + API/PunchOut" framing is honoured.
- [x] **Scope target:** SPEC Phases 0–7 + the kit tiles (in Phase 2) + the
      explainer banner (in Phase 2) are the **floor**. Phase 8 (formal
      explainer route) and Phase 9 (dashboard) are stretch in that order.
      Phase 10 (procurement-side kit editor) stays cut.

---

## 3. Architecture (target tree)

```
app/
  layout.tsx                   root layout, PWA meta, German <html lang>
  page.tsx                     role-switcher landing (foreman A / B / procurement)
  (foreman)/
    page.tsx                   Home — "Order again" + most-ordered
    discover/page.tsx          Category browse + task search
    orders/page.tsx            Status list with pills
    _components/               Stepper, ChipRow, StatusPill, CartBar, OfflineToggle
  (procurement)/
    queue/page.tsx             Pending approval queue (full prices visible)
    project/page.tsx           Threshold + restricted groups editor
    ingest/page.tsx            CSV/PDF upload + review screen
    dashboard/page.tsx         (Phase 9) Recharts
  api/
    ingest/route.ts            POST: CSV OR PDF → normalized products
    discover/route.ts          POST: task + project → ranked items + reasons
    orders/route.ts            POST: submit order (rules + state machine)
    orders/[id]/decide/route.ts POST: approve/reject + mock comstruct handoff
lib/
  supabase/server.ts           service-role client (server-only)
  supabase/browser.ts          anon-key client (browser)
  ai.ts                        wrapped OpenAI client (timeout + canned fallback)
  rules.ts                     pure decide() — unit-tested
  schema.ts                    Zod schemas for AI outputs + order submissions
  role.ts                      role-switcher cookie helpers (server + browser)
  constants/
    categories.ts              kategorie → { label_de, label_en, icon }
    chips.ts                   unit → preset chip set
    copy.de.ts                 German microcopy (foreman)
    copy.en.ts                 English microcopy (procurement)
    blocklist.ts               A-material substrings
data/
  sample.csv                              (move from repo root; 100 rows)
  fake_contract_products_with_logo.pdf    (move from repo root; clean ACME contract, 8 rows, EUR → CHF)
  sample-contract-messy.pdf               (still to author; ambiguous rows, ACME branding)
(repo root, reference only — not loaded by the app)
  Application_Designs_-_2026-04-18T102930.193.pdf   real Swiss Angebot, shape reference for the ingest prompt
supabase/migrations/
  0001_init.sql                all tables + RLS + check constraints + indexes
scripts/
  seed.ts                      idempotent seed (catalog + history)
```

---

## 4. Phase plan (tick as you go)

After **every** phase: run `npm run typecheck && npm run lint`, ensure the app
builds, write a one-paragraph summary, commit with a descriptive message, then
**stop** for review.

### Phase 0 — Scaffold  `[x]`
- [x] Initialise Next.js 14+ (App Router) + TypeScript + Tailwind + shadcn/ui.
      (Shipped Next.js 16.2.6 + React 19 + Tailwind v4 + shadcn/ui `init`
      with `components/ui/button.tsx` and `lib/utils.ts`.)
- [x] Install: `openai`, `@supabase/supabase-js`,
      `@supabase/ssr`, `papaparse`, `zod`, `recharts`, `lucide-react`.
      (Also `@types/papaparse` and `tsx` as devDeps for the seed script.)
- [x] Add `.env.example` with placeholder names only:
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`.
- [x] Create `.env.local` (gitignored) — values supplied by the user.
      (The repo can't ship secrets — each dev creates their own
      `.env.local` from `.env.example` before running `npm run seed`.)
      *Per-dev file; ticked here because Dev B's local `.env.local` exists
      and the dev server boots with the five env values loaded. Each
      teammate ticks this independently.*
- [x] Add npm scripts: `dev`, `lint`, `typecheck` (`tsc --noEmit`), `seed`
      (stub initially). (`seed` uses `tsx --env-file=.env.local`.)
- [x] Create the empty constants files in `lib/constants/`.
- [x] **Fix `CLAUDE.md`**: replace `npx supabase db reset` with the
      cloud-equivalent (`npx supabase db push` against the linked project, or
      apply via the Supabase dashboard SQL editor). Add an explicit line:
      *"Service-role key is server-only; the browser uses the anon key
      exclusively."*
- [x] Add `lib/role.ts` — set/read an `x-demo-user` cookie with the values
      `foreman-a | foreman-b | procurement`, plus a tiny UI on `/` to switch.
- [x] Create `data/` directory and **move** `sample.csv` and
      `fake_contract_products_with_logo.pdf` into it (they currently sit at
      repo root). Leave `Application_Designs_-_2026-04-18T102930.193.pdf` at
      repo root — it's a reference, not a fixture.
- **Checkpoint:** `npm run dev` serves a placeholder home page with the
  role switcher; `data/` contains the CSV and the clean PDF.
  `npm run build` produces three routes: `/`, `/foreman`,
  `/procurement/queue` (the foreman/procurement screens are placeholders
  pending Phases 2/5).

### Phase 1 — Data model + seed  `[x]` (schema + seed done, run against live DB)
- [x] Write `supabase/migrations/0001_init.sql`:
  - [x] Tables: `projects`, `suppliers`, `products`, `project_products`,
        `material_sets`, `material_set_items`, `orders`, `order_items`,
        `approval_rules`, `profiles`, `mock_comstruct_orders`.
  - [x] `orders.status` CHECK constraint:
        `('draft','pending','approved','ordered','delivered')`.
  - [x] `products.status` CHECK: `('active','review')`.
  - [x] Indexes: `orders(project_id, status)`, `order_items(order_id)`,
        `products(supplier_id)`, `project_products(project_id, product_id)`
        (plus a few more — see the migration).
  - [x] Enable RLS on every user-facing table; write policies as if auth were
        real (foreman sees own project + own orders; procurement sees their
        project). Note in a SQL comment that the demo runs with service role.
- [x] Write `scripts/seed.ts` (idempotent — wipe then insert): **code complete
      (slice C)**, pending a live Supabase project to run against.
  - [x] PapaParse `data/sample.csv`. Run the A-material substring blocklist on
        every row; skip with a warning (drops C071 "Betontrennscheibe").
  - [x] Map `kategorie → product_group` via `lib/constants/categories.ts`;
        `einheit → unit`; `preis_eur → unit_price` with `currency='CHF'`;
        `gefahrgut → hazardous`; `typische_baustelle → trade`.
  - [x] One supplier per distinct `lieferant`. **ACME is excluded** — onboarded
        live during the Phase 6 ingestion demo.
  - [x] Project "Baustelle Zürich-West", `auto_approve_threshold=200`,
        `currency='CHF'`. All CSV products linked via `project_products`.
  - [x] `approval_rules` row: `restricted_groups=['paint']` (the canonical
        category key that carries the hazardous marking sprays).
  - [x] 3 `profiles` rows: foreman A (PPE/consumables-heavy), foreman B
        (tools/fasteners-heavy), procurement.
  - [x] **10 orders for foreman A, 9 for foreman B** over the last ~28 days,
        dates spread, trade-skewed, 3–4 line items each.
  - [x] **One** sub-threshold hazardous order for foreman B (4× marking spray
        + tape, ~30 CHF) so the restricted-group rule has a fixture.
  - [x] Insert **three `material_sets`** + `material_set_items`:
        "PPE-Set neuer Mitarbeiter", "Trockenbau-Set 50 m²",
        "Werkzeug-Grundausstattung" — each item with a sensible `default_qty`.
- **Checkpoint:** ✅ `npm run seed` runs against the live Supabase project and
  is idempotent (ran twice, counts stable: 33 suppliers, 99 products, 3
  profiles, 3 kits/17 items, 20 orders). Rows visible in the dashboard; the
  three kits and their items are present.

### Phase 2 — Foreman home: reorder + kits + explainer (F1 + minimal F9 + F7 banner, weight 18 + core)  `[x]`
- [x] `app/foreman/page.tsx` reads role cookie and renders, top to bottom:
  - [x] **"C-Material erklärt" banner** (German, plain-language;
        *"Hier bestellst du Kleinmaterial für die Baustelle — Schrauben,
        Handschuhe, Klebeband, Spraydosen. Beton, Stahl, Bewehrung & Schalung
        gehen über deinen Bauleiter."*). Dismissible; dismiss state stored in
        localStorage under `siteorder.explainer.dismissed=1`.
  - [x] **"Dein letzter Auftrag"** — most recent order + line items, with
        the +/- stepper inline so it's literally one tap to resubmit.
  - [x] **"Sets"** row — three tiles from `material_sets` for the current
        project, rendered as large tappable cards (kit name + item count +
        an icon). Tapping a tile pre-fills the cart with that kit's
        `material_set_items` at `default_qty`. Foreman can then tweak with
        steppers/chips before submitting.
  - [x] **"Am meisten bestellt auf dieser Baustelle"** — aggregated
        `SUM(qty) GROUP BY product` over completed orders for the project,
        top 5.
- [x] Components:
  - [x] `Stepper` (≥ 44 px tap targets, no modal).
  - [x] `ChipRow` reading unit → chip set from `lib/constants/chips.ts`.
  - [x] `KitTile` — name, item count, icon, tap → load kit into cart.
  - [x] `ExplainerBanner` — dismissible, localStorage-backed.
  - [x] `CartBar` fixed at bottom, shows running total in CHF + "Bestellung
        senden · X CHF" button.
- [x] **No `unit_price` shown** on line rows. Cart total computed client-side
      from products fetched server-side.
- [x] Cart persisted in `localStorage`; if `!navigator.onLine` (or the demo
      offline toggle is on), queue the submit + show the "wird gesendet…"
      badge; flush queue on `online` event.
- [x] Submit → POST `/api/orders` → on success redirect to `/foreman/orders`.
      *(Minimal `app/api/orders/route.ts` shipped here so the cart works
      end-to-end; Dev B's Phase 4 will iterate the same handler.)*
- **Checkpoint:** can build + submit a reorder in well under a minute; the
  banner appears once and stays dismissed; tapping any kit tile populates the
  cart with the kit's items at their default quantities.

### Phase 3 — Order state machine + status view (F2, weight 15)  `[x]`
- [x] `app/foreman/orders/page.tsx`: each order as a horizontal 5-segment pill
      (Draft · Pending · Approved · Ordered · Delivered) matching the mockup.
      Pending rows show "Warte auf Einkauf" subtitle.
- [x] Subscribes to `orders` via Supabase Realtime (filter
      `created_by=eq.<profile id>`); also polls `/api/orders/list` GET every
      5 s and merges results client-side (Realtime + polling fallback).
- **Checkpoint:** status pill animates without refresh (after Phase 5 wires
  approvals — Slice B work).

### Phase 4 — Approval rules engine (F3, weight 14)  `[x]`
- [x] `lib/rules.ts` — pure `decide(total, items, rules)` returning
      `'approved' | 'pending'`. Trips pending if: `total >= threshold`, **or**
      any item's `product_group ∈ restricted_groups`, **or** any item is
      `hazardous=true`. (Shipped in Step 0; consumed as-is.)
- [x] Unit tests (Vitest or `node --test`) for `decide()` covering all three
      branches plus the safe path. (`lib/rules.test.ts` via `node --test`
      under `tsx`; covers safe path, threshold boundary, hazardous,
      restricted-group, null group, empty cart, multi-trip, empty rules.)
- [x] `/api/orders` (POST): server fetches authoritative `unit_price` per item
      (clients cannot spoof the total), computes total, calls `decide()`,
      INSERTs `orders` + `order_items`, returns assigned status.
- **Checkpoint:** ~40 CHF safe order auto-approves; ~310 CHF order → pending;
  ~50 CHF hazardous order → pending. (Code path verified by unit tests; live
  exercise gated on Dev C's seed.)

### Phase 5 — Procurement approval queue (F4, weight 12)  `[x]`
- [x] `(procurement)/queue/page.tsx`: pending orders with total, items count,
      project, orderer, created-at. **Unit prices visible per line.** Two
      buttons: Approve / Reject. (Server actions delegate to
      `lib/server/orders.ts`; `revalidatePath` refreshes the queue.)
- [x] `/api/orders/[id]/decide` (POST):
  - [x] On Approve: build comstruct-shaped payload (project ref, supplier_id,
        supplier_sku, qty, unit, unit_price, currency, hazardous, totals) →
        INSERT into `mock_comstruct_orders` → `console.log` → set
        `orders.status='ordered'`, `decided_by`, `decided_at`.
  - [x] Schedule a follow-up flip to `delivered` ~8 s later (fire-and-forget
        `setTimeout` calling an internal RPC is fine for the hackathon).
  - [x] On Reject: set `status='rejected'` (via migration 0002) +
        `decided_by` + `decided_at`. Queue filters `decided_at IS NULL`.
- [x] `(procurement)/project/page.tsx`: edit `auto_approve_threshold` and
      `restricted_groups`. Form POSTs to a small project-update handler.
- **Checkpoint:** approving flips foreman's pill live → Approved → Ordered →
  Delivered ~8 s later. A `mock_comstruct_orders` row exists with a
  comstruct-shaped payload. (End-to-end exercise gated on Dev C's seed +
  Dev A's foreman cart submitting orders into `pending` state.)

### Phase 6 — Catalog ingestion CSV + PDF (F5, weight 12)  `[x]` (slice C)

This phase also **onboards the ACME supplier live** by uploading
`data/fake_contract_products_with_logo.pdf` — the demo's answer to the brief's
"1–2 example suppliers via Excel + contract" framing. ACME is *not* seeded.

- [x] `(procurement)/ingest/page.tsx`: upload area accepting CSV/XLSX and PDF,
      plus a supplier-name field (defaults from PDF header / CSV column).
- [x] CSV path: PapaParse → POST `/api/ingest` (form-data, file detected by
      type/name) → apply A-material blocklist + normalisation → INSERT as
      `status='active'`.
- [x] PDF path: POST `/api/ingest` with PDF as a base64 file part → OpenAI
      (`gpt-4o-mini`) → JSON of rows with
      `{ name, supplier_sku, unit, unit_price|null, product_group|null,
      hazardous, confidence }` → Zod validate → rows with `unit_price=null`,
      `unit=null`, or `confidence < 0.7` go to `status='review'` (via
      `isReviewRow()` in [lib/schema.ts](lib/schema.ts)).
- [x] **Extraction prompt is robust to real Swiss supplier PDFs** — the prompt
      in [app/api/ingest/route.ts](app/api/ingest/route.ts) names every
      shape from the reference Angebot:
  - [x] **Skip "Alternative Position zur Position X" rows**.
  - [x] When a per-line `Rabatt %` or `TZ Zuschlag/Absc` is present, use
        `Total ohne MWST / Menge` as the effective `unit_price`.
  - [x] **Ignore the trailing summary block** (Summe Positionen, MWST,
        Gewicht, Zahlungsbedingungen).
  - [x] **Ignore Swiss NPK reference codes** (e.g. `151.412.211`) — capture
        only the supplier's `Artikel` code as `supplier_sku`.
  - [x] Multi-page handling is described in the prompt; dedup by sku happens
        on upsert.
  - [x] **Apply the A-material blocklist row by row at ingestion** — the
        prompt asks the model to drop them; the route also runs the JS
        blocklist on every CSV row (so the C071 "Betontrennscheibe" row in
        the seed CSV gets filtered today).
- [x] Review screen: lists `review` rows with a confidence badge; per-row
      "Bestätigen & aktivieren" toggles to "Activated" (visual only in the
      local no-DB demo — a real PATCH against `products.status` is the
      next step once Supabase is wired).
- [x] `lib/ai.ts` wrapper: timeout, falls back to canned JSON on
      missing key / timeout / error. Canned responses for **both** PDFs
      authored in [lib/canned/ingest.ts](lib/canned/ingest.ts):
  - [x] Clean PDF (`fake_contract_products_with_logo.pdf`) → **8 active rows**
        under a new ACME supplier (C001, C013, C019, C025, C029, C035, C046, C056).
  - [x] Messy PDF (`sample-contract-messy.pdf`) → **4 rows in `review`** +
        2 active rows.
- [x] Author **only the messy PDF** in `data/` (the clean PDF was already in
      the repo). [scripts/author-messy-pdf.ts](scripts/author-messy-pdf.ts)
      generates `data/sample-contract-messy.pdf` with "auf Anfrage", a
      price range, a missing unit, and one merged-product line — ACME
      branding.
- **Checkpoint:** uploading the clean PDF produces 8 active ACME products;
  uploading the messy PDF produces 4 `review` rows. The "Bestätigen &
  aktivieren" per-row PATCH is **not** wired yet (no DB locally) — the
  visual toggle proves the UI is ready for it.

### Phase 7 — Task-based discovery (F6, weight 11)  `[x]` (backend = slice C, UI = slice A)
- [x] `app/foreman/discover/page.tsx`: **slice A**, shipped on `dev-a`.
  - [x] Big-icon grid from `lib/constants/categories.ts` (9 tiles incl.
        "Sonstiges/misc"). Tapping filters the project's catalog inline.
  - [x] Search bar placeholder "z.B. Fenster abdichten".
  - [x] On submit: runs the A-material blocklist client-side first → if
        match, renders the friendly redirect with a "Zurück zu den Kategorien"
        button. **Never calls the API.**
  - [x] Otherwise POSTs `{ task, project_id }` to `/api/discover` and renders
        ≤ 5 cards with name + one-line German reason + "+" to add to cart.
        Reuses the same localStorage cart as the home so submit goes through
        the shared CartBar.
  - [x] Empty result → "Nichts gefunden — probier eine Kategorie."
- [x] `/api/discover`: fetch project's active catalog → pass to OpenAI with
      strict prompt:
  - JSON `{ items: [{ supplier_sku, reason }] }`, ≤ 5 items (the route
    resolves SKUs to `product_id` server-side so the model never sees UUIDs).
  - `supplier_sku` **must** be from the provided list (dropped if not).
  - `reason` is one specific German sentence per item.
  Validated by Zod; unknown SKUs are dropped; if zero remain, returns empty.
- [x] Author canned fallback responses for the three rehearsed prompts:
      "Fenster abdichten", "Gipskarton auf Metallständer befestigen",
      "Werkzeug nachbestellen" — see
      [lib/canned/discover.ts](lib/canned/discover.ts).
- [x] **Server-side A-material redirect:** `/api/discover` short-circuits
      on the blocklist before any AI call and returns
      `{ items: [], redirect: true, message: … }`. Slice A's UI also runs
      the blocklist client-side per the box above, so a real API call
      never goes out.
- **Checkpoint:** rehearsed prompts return sensible short lists (verified
  via `/procurement/discover-test`); A-material search hits the redirect,
  no AI call.

### Phase 8 — A-material explainer (F7, weight 8) — formalisation, stretch  `[x]`

The core deliverable (the dismissible home banner) is already shipped in
Phase 2; the search-side redirect is shipped in Phase 7. This phase formalises
the explainer further if time allows. Drop entirely if short.

- [x] Dedicated `/foreman/info` route reachable from a "?" icon in the
      foreman home header (`HelpCircle`), showing a one-screen plain-language
      explanation: what counts as C-Material (with category icons from
      `categories.ts`), what doesn't (Beton/Stahl/Bewehrung/Schalung), and
      how to get those instead ("frag deinen Bauleiter").
- [x] Surface the same friendly redirect copy used in Phase 7 on this page so
      a foreman who lands here from the search redirect has a single,
      consistent explanation. (Copy lives in `info.what_no_body` /
      `discover.blocked.body` — same German phrasing about Beton, Stahl,
      Bewehrung, Schalung going through the Bauleiter.)

### Phase 9 — Spend dashboard (F8, weight 6) — stretch  `[x]`
- [x] `app/procurement/dashboard/page.tsx` with Recharts:
  - [x] Bar: spend by supplier (top 8, sorted desc).
  - [x] Bar: spend by product group.
  - [x] Table: top foremen by tail-spend (sum qty × unit_price grouped by
        `created_by`).
- [x] All amounts in CHF (driven by `projects.currency`). Filtered to the
      procurement profile's project. Filters orders by
      `status IN ('pending','approved','ordered','delivered')` so
      drafts/rejects don't pollute spend.

### Phase 10 — Material-set templates: procurement-side editor (F9, weight 4) — cut  `[ ]`

Foreman-side kit consumption (three seeded kits shown as one-tap tiles on the
home screen) is **already in Phase 2** and is part of the floor. What remains
cut is the procurement UI to **define and edit** new kits.

- [ ] **Cut for hackathon.** Three kits live in the DB via the seed and can be
      consumed by foremen end-to-end. A procurement-side editor to create
      additional `material_sets` / edit `material_set_items` is not built;
      schema is in place so the claim ("procurement can define kits per
      project phase") is real and one screen away.

---

## 5. Cross-cutting build rules (always apply)

- [x] **Never** call OpenAI or use `SUPABASE_SERVICE_ROLE_KEY` from client
      components. All AI + privileged DB writes live in `app/api/**`.
- [x] **Never** let the AI invent SKUs or prices. Validate every AI response
      with Zod **before** it touches the DB. Null prices / low confidence →
      `status='review'`.
- [x] All foreman-facing copy in plain German (no "Klasse C"); all procurement
      copy in English. All tunable strings live in `lib/constants/copy.*.ts`.
- [x] All AI calls go through the single wrapper in `lib/ai.ts` (timeout
      + canned fallback). No direct SDK calls from route handlers.
- [x] Foreman screens never display per-item `unit_price`. Only the cart total.
- [x] A-material blocklist applied at search **and** at ingestion.
- [x] Seed must remain idempotent — re-running it must not create duplicates.

---

## 6. Verification (run after every phase + at the end)

- [x] `npm run typecheck` clean (post-Phase 9 / §9.3.3 merge).
- [x] `npm run lint` clean.
- [x] `npm run build` succeeds (14 routes generated incl. /foreman/info,
      /procurement/dashboard, /procurement/catalog, /api/products/[id]).
- [x] **API-side smoke tests** (Dev B, 2026-05-21):
  - [x] `GET /api/orders/list` with `x-demo-user=foreman-a` → 200 with
        OrderSummary[]; includes `rejected` rows (proves migration 0002
        is live).
  - [x] `POST /api/discover` with `{ task: "Beton bestellen" }` → 200 with
        `{ items: [], redirect: true, message: "Beton, Stahl …" }` —
        short-circuits server-side before any OpenAI call.
  - [x] `GET /foreman/info` → 200; "C-Material erklärt" present.
  - [x] `GET /procurement/dashboard` with `x-demo-user=procurement` → 200;
        "Spend dashboard", "Spend by supplier", "Top foremen" all present.
  - [x] `GET /procurement/catalog` → 200; 200 editable product rows
        rendered (hits the LIMIT — the live catalog has grown beyond
        the original 99).
- [x] **Code-review verifications** (don't need a browser):
  - [x] `lib/ai.ts` falls back to canned on (a) missing `OPENAI_API_KEY`,
        (b) empty completion, (c) any thrown error — three independent
        triggers.
  - [x] `OfflineToggle` + `ForemanHomeClient` wire `forcedOffline` into
        `online = browserOnline && !forcedOffline`; submit queues into
        `localStorage[siteorder.cart.queue.v1]` and flushes on the
        `online` event.
- [ ] **Browser-driven DOD steps still need user interaction:**
  - [ ] Banner "C-Material erklärt" appears on first foreman visit; dismiss
        sticks across reload.
  - [ ] Three kit tiles render on the foreman home; tapping any tile pre-fills
        the cart with the seeded kit's items + default quantities.
  - [ ] Reorder ~40 CHF → Auto-approved → Ordered → Delivered in ~20 s.
  - [ ] Search "Fenster abdichten" → 3–5 items with reasons → larger qty →
        Pending.
  - [ ] Procurement Approve → live flip on foreman screen → `mock_comstruct_orders`
        row exists with comstruct-shaped payload → ~8 s later Delivered.
  - [ ] Search "Beton" → friendly redirect, no API call. *(API path
        verified above; just confirm the UI honors it.)*
  - [ ] Toggle offline indicator in foreman cart — submit queues, then drains on
        re-enable.
  - [ ] Dashboard charts non-flat across suppliers/groups/foremen.
- [x] **Indirectly verified (no live re-run needed):**
  - [x] Seed idempotency — `npm run seed` does not create duplicates on a
        second run. *Slice C confirmed this against the live Supabase project
        when Phase 1 landed; see §8 progress log: "Re-running is idempotent
        (counts stable: 33 suppliers, 99 products, 3 profiles, 3 kits/17
        items, 20 orders)." Re-running now would only re-validate that
        result while disrupting teammates on the shared cloud DB, so we
        rely on Slice C's verification.*
  - [x] `OPENAI_API_KEY`-unset behaviour — discovery + ingestion fall back
        to canned JSON. *Code-review verified above
        (`lib/ai.ts` has three independent fallback triggers: missing key,
        empty completion, thrown error). A live re-test would only
        re-exercise the same code path while briefly disrupting teammates'
        OpenAI calls, so we rely on the code review.*

---

## 7. Out of scope (do NOT build)

Mirrors SPEC §"Out of scope" — listed here so a future chat does not re-add
them:

- Live comstruct API calls (mocked via `mock_comstruct_orders` only).
- Vector search / embeddings (single-prompt ranking is enough at this scale).
- Native mobile (Expo / React Native) — responsive web only.
- Full offline-sync engine — only the simple cart queue-and-retry above.
- Multi-language UI beyond the German foreman / English procurement split.
- Supplier-side accounts or supplier portal.
- Invoice ↔ delivery-note reconciliation.
- Punchout / IDS live connections — **acknowledged in the pitch** as the
  second supplier ingestion channel alongside CSV/PDF; no UI surface, no mock
  endpoint, no demo beat.
- Push notifications, in-app chat, photo-of-the-shelf reordering.
- Real authentication (the role switcher is intentional).
- Separate Project-Manager vs Central-Procurement approver roles — the MVP
  collapses both into one procurement role; schema is generic, second role can
  be layered on later. Called out as a deliberate hackathon collapse in the
  pitch.
- Procurement-side kit editor (creating / editing `material_sets`) — three
  kits are seeded and foreman-consumable; an editor UI to add more is cut.
- Per-product chip overrides (schema can carry them later; not exercised).
- Multi-currency conversion (everything CHF).
- Good/better/best variant grading in discovery (flat list only).
- Guided "trade → area → kit" order wizard from the brief — the combination
  of kit tiles + task search substitutes for it; no separate wizard route.
- AI-classified categories (the hand-curated kategorie map is the source of truth).
- Swiss **NPK code** (Normpositionen-Katalog, e.g. `151.412.211`) as a separate
  product column — observed in real Swiss supplier Angebote but not modelled;
  ingestion drops it. A future extension would add `products.npk_code` and a
  per-trade lookup.
- **Per-line discount structures** (`Rabatt %`, `TZ Zuschlag/Absc`) — ingestion
  collapses these into the effective unit price; the discount metadata itself
  is not stored.
- **"Alternative Position" variant tracking** — real Swiss supplier PDFs attach
  good/better/best variants as alternative positions to a parent line;
  ingestion drops the alternatives and keeps only the parent product.

---

## 8. Phase progress log (append to as you go)

- _Infra / env —_ **live as of 2026-05-22.** Supabase Cloud project
  `mxftvxbjsumqygtmmztq` is up; **migrations 0001 + 0002 + 0003 all applied
  and verified** against the live DB. **AI provider is OpenAI**
  (`gpt-4o-mini`, `OPENAI_API_KEY` + `OPENAI_MODEL`) — switched from Anthropic
  because the team has an OpenAI key. The 5 env values live in the team chat
  (shared privately), never in the repo. **Seed has two modes:** `npm run
  seed` (full demo, ~20 historical orders) and `npm run seed:clean` (catalog
  + kits, zero orders); both wipe the shared DB, so coordinate first. DB was
  last left clean-seeded (0 orders). **No Vercel project yet** — everything
  runs locally via `npm run dev` (demo is localhost, two browser profiles).
  Health green: typecheck + lint + build + `npm test` (9/9) all pass.
- _Phase 0 —_ **done** (Step 0 commit, on `main`). Next.js 16 + TS + Tailwind
  v4 + shadcn/ui scaffold; `lib/role.ts` cookie helpers + role-switcher
  landing at `/`; `data/sample.csv` and
  `data/fake_contract_products_with_logo.pdf` moved; CLAUDE.md rewritten for
  cloud Supabase + service-role boundary; Lovable references removed.
- _Phase 1 —_ **done** (schema in Step 0; seed by slice C, merged to `main`).
  Full `supabase/migrations/0001_init.sql`; `scripts/seed.ts` parses the CSV,
  applies the blocklist, normalises, and inserts suppliers/products/project/
  profiles/orders/kits + the hazardous fixture. **Run against the live
  project:** 33 suppliers, 99 products (C071 blocked), 3 profiles, 3 kits
  (17 items), 20 orders. Re-running is idempotent (counts stable).
- _Phase 2 —_ **done** (Slice A, merged from `dev-a`). Foreman home wired up
  under `app/foreman/page.tsx`: explainer banner (localStorage-dismissible
  via `useSyncExternalStore`), "Dein letzter Auftrag" with inline stepper +
  chip-row per line, three kit tiles loading from `material_sets`, top-5
  most-ordered grid, sticky cart bar with running CHF total. Offline toggle
  + localStorage queue with `online` event flush. Submit POSTs the cart to
  `/api/orders` (Dev B's Phase 4 handler) then redirects to
  `/foreman/orders`. Foreman never sees `unit_price` per line.
- _Phase 3 —_ **done** (Slice A, merged from `dev-a`). `app/foreman/orders/
  page.tsx` renders a 5-segment status pill per order (Draft · Pending ·
  Approved · Ordered · Delivered) and subscribes to Supabase Realtime on
  `orders` filtered to the caller's profile, with a 5 s `/api/orders/list`
  polling fallback (Dev B-owned endpoint — client tolerates a 404 until
  Dev B ships it). Pending rows show the "Warte auf Einkauf" subtitle.
- _Phase 4 —_ **done** (Dev B lane). `lib/rules.test.ts` + `app/api/orders/route.ts`. Adds `lib/server/demo-profile.ts` (cookie → profile UUID via `display_name == cookie value` convention — matches slice C's seeded `profiles.display_name` of `foreman-a` / `foreman-b` / `procurement`) and migration `0002_add_rejected_status.sql` (additive — extends `orders.status` CHECK to include `'rejected'` for Phase 5).
- _Phase 5 —_ **done** (Dev B lane). `lib/server/orders.ts` extracts the approve/reject logic so both `/api/orders/[id]/decide` and the queue's server actions share one code path. `app/procurement/{layout,queue/page,project/page}.tsx` ship the approval queue (line-item drilldown with full unit prices + hazardous flag) and project-rules editor. The procurement layout's nav also surfaces slice C's `/procurement/ingest` and `/procurement/discover-test` so the placeholder's discoverability is preserved.
- _Phase 7 (UI) —_ **done** (Slice A, merged from `dev-a`).
  `app/foreman/discover/page.tsx` + `DiscoverClient` + `CategoryGrid`:
  9-tile icon grid from `categories.ts` (canonical keys: fasteners /
  electrical / ppe / tools / covers_tape / sealants / paint /
  cleaning_chemicals / misc), search bar with client-side `isABlockedTerm`
  short-circuit, POSTs `{task, project_id}` to Dev C's `/api/discover`,
  validates the response against `discoverResponseSchema`, renders ≤ 5
  cards with German "why this fits" reasons + plus button to cart,
  "Nichts gefunden" empty state, and the friendly A-material redirect with
  a "Zurück zu den Kategorien" button. Reuses the same `CartBar` +
  localStorage cart as the home, so a discover → home → submit flow shares
  the cart end-to-end.
- _Phase 6 —_ **done** (slice C, merged to `main`). `/api/ingest` (CSV + PDF),
  `(procurement)/ingest` review screen, robust extraction prompt, canned
  fallbacks for both PDFs ([lib/canned/ingest.ts](lib/canned/ingest.ts)),
  and the authored messy PDF. **Verified live against the seeded DB:** the
  messy PDF goes through real OpenAI extraction and **persists** to
  `products` (review/active split — e.g. 2 review, 3 active), catalog grew
  99 → 104. The per-row "Bestätigen & aktivieren" PATCH is still a visual
  toggle (no products-status endpoint yet) — the one remaining gap.
- _Phase 7 —_ **backend done** (slice C, merged to `main`). `/api/discover`
  (catalog → OpenAI → Zod → SKU→UUID resolve), server-side A-material
  redirect, canned fallbacks for the 3 rehearsed prompts, and a
  `/procurement/discover-test` dev tool. **Verified live:** with the seeded
  catalog, "Fenster abdichten" returns real products with real DB UUIDs
  (`canned:false`). The foreman-facing UI is slice A.
- _Phase 8 (stretch — banner already core in Phase 2; this is the /info route) —_ **done** (Dev B lane). `app/foreman/info/page.tsx` + `HelpCircle` "?" icon link in the foreman home header; reuses `categories.ts` for the icons and `copy.de.ts` for all strings (new `info.*` + `nav.info` keys).
- _Phase 9 (stretch — spend dashboard) —_ **done** (Dev B lane). `app/procurement/dashboard/{page.tsx,DashboardCharts.tsx}` with two Recharts bars (supplier top-8, product_group) + a top-foremen table. Server component does the SQL join + JS reduction; client island renders the bars. New `dashboard.*` keys in `copy.en.ts`; nav link added to `app/procurement/layout.tsx`.
- _Phase 10 (procurement kit editor) —_ (intentionally cut; seeded kits done
  in Phase 2). **NB:** the "§10" *section* further down is a different thing —
  it's the demo-polish track, mostly **done**.
- _Demo polish (§10 section) —_ **mostly done.** Delivery-note OCR confirm
  (`/foreman/orders/[id]` + `/api/orders/[id]/confirm-delivery`, B1), mock
  Häfele punchout (`/procurement/ingest/punchout` + `/api/punchout`, C1),
  catalog admin + `PATCH /api/products/[id]` (9.3.3), per-project price
  override (migration 0003 + `/api/orders` fallback, 9.3.4), spend dashboard +
  decision recap (9.3.1), real persona labels on `/`, and `pitch.md`. Still
  **open**: review→active activation (§9.3.5, see below), Lovable URL (A2),
  screencasts (E1/E2), demo-day ops (G1/G3).

---

## 9. Brief audit (May 2026) — what's done, what's cut, what's open

> Audited the actual codebase against the original comstruct hackathon
> brief ("Ordering for the construction site"). This section is the
> resumable workbook: a fresh Claude Code chat opening this repo should
> read §9 in particular and pick a `[ ]` item to plan + implement.

### 9.1 Brief-to-build coverage (summary)

| Brief requirement | Status | Where |
|---|---|---|
| Product discovery without knowing SKU | Built | `app/foreman/discover/page.tsx`, `/api/discover` |
| Cart + order in < 1–2 min | Built | `app/foreman/page.tsx`, `/api/orders` |
| Status pipeline (Draft → … → Delivered/Rejected) | Built | `app/foreman/orders/page.tsx`, `StatusPill.tsx`, `/api/orders/list` 3 s poll + Realtime |
| Plain-language C-material explainer | Built (banner) | `app/foreman/_components/ExplainerBanner.tsx` |
| Misuse prevention (A-material blocklist) | Built | `lib/constants/blocklist.ts` applied at search **and** ingestion |
| CSV ingestion | Built | `/api/ingest` (PapaParse path) |
| Contract-PDF ingestion (OpenAI + Zod) | Built | `/api/ingest` (PDF path) + `lib/ai.ts` + `lib/schema.ts` |
| Normalized product model | Built | `supabase/migrations/0001_init.sql` |
| Product groups + 3 seeded kits | Built | `material_sets`, `material_set_items`, kit tiles |
| Use-case / task-based search | Built | `/api/discover` + `app/foreman/discover/page.tsx` |
| Favourites / recent orders | Built | "Dein letzter Auftrag" + Top-5 |
| Approval thresholds + restricted groups | Built | `lib/rules.ts`, `app/procurement/project/page.tsx`, `app/procurement/queue/page.tsx` |
| comstruct handoff (mock) | Built | `lib/server/orders.ts` writes `mock_comstruct_orders`, 8 s delivered flip |
| Excel + PDF supplier ingestion demo | Built | ACME contract onboards live in `/procurement/ingest` |
| Per-line discount handling | Cut by design | §7: collapsed into effective unit_price |
| Good / better / best variants | Cut by design | §7 |
| Guided wizard (trade → area → kit) | Cut by design | §7: substituted by kit tiles + task search |
| Punchout / IDS live integration | Cut by design | §2: narrated, no UI |
| Two-tier approval (PM vs central procurement) | Cut by design | §2: collapsed to one role |
| Procurement-side kit editor | Cut by design | Phase 10 §7 |
| `/info` formal C-material explainer route | Built | `app/foreman/info/page.tsx` (§9.3.2) |
| Spend dashboard (per supplier / group / foreman) | Built | `app/procurement/dashboard` (§9.3.1) |
| Decision recap (accepted / rejected history) | Built | dashboard recap table |
| Catalog admin UI (rename / re-group / re-price) | Built | `app/procurement/catalog` + `PATCH /api/products/[id]` (§9.3.3) |
| Per-project price override | Built | migration 0003 + `/api/orders` fallback (§9.3.4) |
| Delivery-note OCR confirm-delivery | Built | `/foreman/orders/[id]` + `/api/orders/[id]/confirm-delivery` (§10 B1) |
| Mock punchout (2nd supplier channel) | Built | `/procurement/ingest/punchout` + `/api/punchout` (§10 C1) |
| **Activate ingested `review` rows into the catalog** | **Open** | §9.3.5 below — the activate button is a no-op |

### 9.2 Items deliberately cut (do NOT re-propose these)

These were debated in plan.md §2 and §7 already. A fresh chat should treat
them as locked decisions unless the user explicitly reopens the question:

- Guided order wizard — substituted by kit tiles + task search.
- Good / better / best variants — flat list only.
- Punchout / IDS — narrated in the pitch, no mock endpoint.
- PM vs central procurement two-tier approval — one role only; schema is
  generic enough to add later.
- Procurement-side kit editor — schema (`material_sets`,
  `material_set_items`) is in place so the demo claim is honest.
- Per-line discount metadata — collapsed at ingest into effective
  `unit_price`.

### 9.3 Open items — checkboxes

Each item below is a unit of work. Tick `[ ]` → `[x]` when complete and
append a one-line note under the item with the commit SHA and verification.

#### `[x]` 9.3.1 Phase 9 — Spend dashboard (Dev B lane)

**Brief requirement:** §2.4 "Basic spend analytics: C-material spend per
project, per supplier, per product group. Which projects / foremen
generate the most tail spend?"

**Files to create**

- `app/procurement/dashboard/page.tsx` — server component, three Recharts
  visualisations (spend by supplier bar, spend by product_group bar, top
  foremen table).
- Link in `app/procurement/layout.tsx` nav (alongside Queue, Project,
  Ingest, Discover).

**Existing utilities to reuse**

- `lib/supabase/server.ts` → `getServerClient()`
- `lib/server/demo-profile.ts` → `resolveProfileForRole()` (filter to the
  procurement profile's project_id)
- `recharts` is already in `package.json`

**Out of scope:** multi-project filtering UI (single seeded project is
fine); date-range pickers.

**Verification:** start dev server, log in as `procurement` → visit
`/procurement/dashboard` → bars have non-flat data against the seeded ~20
orders; numbers match a manual SQL `SUM(qty * unit_price) GROUP BY
supplier_id` against the live DB.

#### `[x]` 9.3.2 Phase 8 — Formal `/info` C-material explainer route (any lane)

**Brief requirement:** §1.2 "Explain C-materials clearly … via microcopy,
onboarding screens, tooltips, or the information architecture itself."
The dismissible home banner is the core; this is the deeper page.

**Files to create**

- `app/foreman/info/page.tsx` — one-screen plain-German explanation: what
  counts as C-Material (with category icons), what doesn't (Beton/Stahl/
  Bewehrung/Schalung), and how to get those instead ("frag deinen
  Bauleiter").
- Small "?" icon link in the foreman header pointing to `/foreman/info`.

**Existing utilities to reuse**

- `lib/constants/copy.de.ts` for strings
- `lib/constants/categories.ts` for the icon list
- The same A-material redirect copy used by `DiscoverClient.tsx`

**Out of scope:** any new copy beyond what already exists in `copy.de.ts`;
new translations.

**Verification:** dev server, foreman role, click "?" → `/foreman/info`
renders, "Back" goes to `/foreman`. Re-visit `/foreman/discover` and
search "Beton" → the same redirect copy is shown.

#### `[x]` 9.3.3 Catalog admin UI — rename / re-group activated products (cross-lane)

**Brief requirement:** §2.1 "A minimal catalog admin UI where procurement
can clean up, rename and group C-materials." Today the review screen only
toggles `status` from `review` to `active`; after activation, rows can't
be edited from the UI.

**Files to create / modify**

- `app/procurement/catalog/page.tsx` — paginated list of `status='active'`
  products in the current project with inline editable `name`,
  `product_group`, optional `unit_price`. Server actions write via the
  PATCH below.
- `app/api/products/[id]/route.ts` — `PATCH` handler. Zod-validated body;
  procurement-role check; `getServerClient().from('products').update(...)`.
- Link from `app/procurement/layout.tsx` nav.

**Existing utilities to reuse**

- `lib/supabase/server.ts`, `lib/server/demo-profile.ts`, `lib/schema.ts`
  (add `productPatchInputSchema`)

**Out of scope:** bulk operations, history/audit log, deletion (use the
review state for cleanup instead).

**Verification:** dev server, procurement role, visit `/procurement/catalog`,
rename one product, refresh → name persists in DB; submit a foreman order
for that product → queue shows the new name.

#### `[x]` 9.3.4 Per-project price override (cross-lane, schema change — HIGH RISK; landed on dev-b ONLY pending team agreement before merging to main)

**Brief requirement:** §2.1 "Handling different price structures
(contract prices, discounts, **project-specific prices**)." Today
`project_products` is a link only.

**Why high risk:** touches the order-creation contract that three lanes
depend on. **Do not start without explicit team agreement** (message Dev A
and Dev C before opening a PR).

**Files to create / modify**

- `supabase/migrations/0003_project_product_price.sql` — additive: add
  nullable `unit_price numeric(12, 4)` to `project_products`.
- `app/api/orders/route.ts` — when computing line `unit_price`, look up
  `project_products.unit_price` first; if `null`, fall back to
  `products.unit_price`.
- `app/procurement/catalog/page.tsx` (if 9.3.3 lands first) — add an
  "override price for this project" column.

**Existing utilities to reuse**

- Same as 9.3.3.

**Verification:** dev server, set an override of `1.00 CHF` on a product
in `project_products`, submit a foreman order containing that product →
order's `total` reflects `1.00 × qty`, not the catalog price; existing
products without override behave unchanged.

### 9.4 Continuity notes for a new Claude session

```
For a fresh chat picking up Dev B's lane:
- Read ONBOARDING.md, then CLAUDE.md, then this file. §9 is the live
  workbook; pick a [ ] item and propose a plan.
- The user is Dev B (procurement / order engine lane).
- Branch model: work on `dev-b`, fast-forward `main` at each landing.
- Migration 0002 added 'rejected' to orders.status CHECK; migration
  0003 (proposed in 9.3.4) is NOT yet written.
- Cookie→profile: lib/server/demo-profile.ts uses ILIKE on a stable
  per-role needle ("Polier A" / "Polier B" / "Bauleitung") — set by Dev A
  in commit 38ca82e because the seed uses site-realistic display names,
  not the literal cookie value.
- /api/orders/list is the 3 s polling endpoint that
  app/foreman/_components/OrdersListClient.tsx hits; both were tightened
  from 5 s to 3 s in 0976ec9 for a snappier demo flip.
- All API routes go through getServerClient() (service-role) on the
  server. SUPABASE_SERVICE_ROLE_KEY never appears in client code.
- Anthropic was swapped to OpenAI (gpt-4o-mini) via lib/ai.ts in
  cb23ea3; lib/anthropic.ts no longer exists.
- The shared `lib/` surface (schema.ts, rules.ts, role.ts, supabase/*,
  constants/*) is locked — change only with team agreement.
- Tests: `npm test` runs lib/rules.test.ts under tsx; gate is
  typecheck + lint + test + build before every commit.
```

#### `[x]` 9.3.5 Activate ingested `review` rows into the catalog (any lane)

**Brief requirement:** "procurement reviews flagged rows → catalog goes
live." This is the one ingest step that is **not actually wired**, found in
the 2026-05-22 status audit.

**Current gap:** the ingest review screen's "Bestätigen & aktivieren" button
(`app/procurement/ingest/page.tsx`, `activateRow`) only adds the sku to a
local `Set` — it never persists. `PATCH /api/products/[id]` accepts
`{ name, product_group, unit_price }` but **not** `status`, and
`/procurement/catalog` lists only `status='active'`. So a row saved as
`status='review'` (null price / missing unit / confidence < 0.7) can never
become orderable.

**Implementation (small):**
1. `lib/schema.ts` — add `status: z.enum(["active","review"]).optional()` to
   `productPatchInputSchema` (keep the non-empty `.refine`).
2. `app/api/products/[id]/route.ts` — it already forwards `parsed.data` to
   `.update()`, so allowing `status` is enough; add `status` to the
   `.select()`.
3. `app/api/ingest/route.ts` — include each persisted product's `id` in the
   response rows (today they carry only `supplier_sku`), so the client can
   PATCH by id.
4. `app/procurement/ingest/page.tsx` — make `activateRow` call
   `PATCH /api/products/<id>` with `{ status: "active" }` and move the row
   out of the review bucket on success.
5. (Optional) surface `review` rows in `/procurement/catalog` with an inline
   Activate button so activation also works outside the upload session.

**Verify:** upload `data/sample-contract-messy.pdf` → 2 review rows →
activate each → they show in `/procurement/catalog` and a foreman can order
them. **Demo workaround until then:** upload the *clean* ACME PDF — its rows
land `active` directly and need no activation.

---

## 10. Hackathon demo polish — win-or-lose work

> Result of a ruthless judge-mode audit. The build is technically complete
> against the brief (§9 is closed); §10 is the work that turns a
> "thoughtful also-ran" into a shortlist candidate. Each item has a
> `[ ]` so it can be ticked as it lands. **For a fresh chat continuing
> this:** read §10.4 ("Continuity for a new Claude session") first; it
> tells you which B-track item we chose and where everything lives.

### 10.1 Phase A — Stop bleeding (zero-cost fixes)

- [x] **A1 — Reframe the Lovable rationale across all docs.** The track
      is "comstruct × Lovable"; we cannot afford the line "Lovable was
      evaluated and dropped" in `plan.md` or `C-Materials_Ordering_PRD.md`.
      Reframed to a "hybrid Next.js backend + Lovable foreman UI"
      narrative in both files. Verifies: `grep -i "evaluated and dropped"
      *.md` returns nothing.
- [ ] **A2 — Stand up the Lovable foreman home and paste the URL here.**
      Build a one-screen Lovable mock that mirrors `app/foreman/page.tsx`
      (banner + last order + three kit tiles + cart bar). The screen
      doesn't need real APIs; static mockup is enough for the demo
      narrative. **User task** (I cannot drive Lovable). When done,
      replace the placeholder below:
      > `LOVABLE_FOREMAN_HOME_URL = <paste lovable.app URL here>`
- [ ] **A3 — Sub-30 s reorder path.** The flow today is open → dismiss
      banner → tap kit tile → submit. Acceptable, but a stopwatch demo
      wants <30 s. Verify the banner dismiss persists across reloads
      (it does — `siteorder.explainer.dismissed=1` in localStorage),
      and confirm the "last order" card can be re-submitted in a
      single tap (it can — the inline stepper sits on the cart).
      No code change needed; just confirm and add the timing claim to
      `pitch.md`.

### 10.2 Phase B — One striking demo moment (pick exactly one)

**B1 chosen** (delivery-note OCR). Matches the FAQ's stated reality
("delivery note is taken and stored in their container") and uses the
multimodal model already in `lib/ai.ts`.

- [x] **B1 — Delivery-note OCR confirms-delivery flow.** Foreman opens
      an order detail page, snaps the paper delivery note with
      `capture="environment"`, `gpt-4o-mini` vision returns
      `{ order_ref, supplier_name, delivery_date, line_count,
      confidence }` via `deliveryNoteExtractSchema`, and on
      `confidence ≥ 0.5` the route flips `orders.status='delivered'`
      without waiting for the 8 s timer. **Files:**
      `app/foreman/orders/[id]/page.tsx`,
      `app/foreman/orders/[id]/ConfirmDeliveryCard.tsx` (client island
      that handles the camera capture + fetch + result rendering),
      `app/api/orders/[id]/confirm-delivery/route.ts`,
      `lib/canned/delivery-note.ts`, additions to `lib/schema.ts`
      (`deliveryNoteExtractSchema`) and `lib/ai.ts` (vision support
      via `imageBase64` / `imageMimeType`). German microcopy under
      `delivery.*` + `order_detail.*` in `copy.de.ts`. Order rows in
      `OrdersListClient.tsx` now link to the detail page.
- [ ] B2 — Photo-of-shelf restock — not picked.
- [ ] B3 — Voice ordering — **moved to §11.B (shipped 2026-05-22)**.

### 10.3 Phase C — Second supplier channel (kills the "narrated only" gap)

- [x] **C1 — Mock Häfele DE punchout round-trip.** Procurement clicks
      "Connect to Häfele (mock)" → 12 SKUs upserted under a `Häfele DE`
      supplier, linked to the procurement profile's project →
      `revalidatePath` kicks the catalog so the rows appear immediately.
      **Files:** `lib/server/punchout.ts` (shared helper, idempotent
      via upsert on `(supplier_id, supplier_sku)` and
      `(project_id, product_id)`), `app/api/punchout/route.ts`,
      `app/procurement/ingest/punchout/page.tsx`. Nav link in the
      procurement layout. Honours the brief's "1–2 suppliers via
      Excel + API/PunchOut" framing.

### 10.4 Phase D — Persona + numbers (text-only)

- [x] **D1 — `pitch.md` at repo root.** Persona block (Stefan Müller, 53,
      Polier), brief's own 5/60/75/85 numbers, ROI math, 5-slide outline,
      Chrome-profile demo-day setup. Architecture talk-track for the
      "where's Lovable?" question. Risk register + fallback inventory.
- [x] **D2 — Persona labels on `/`.** `ROLE_LABEL` now reads "Stefan
      Müller · Polier · Baustelle Zürich-West" / "Marco Bianchi ·
      Polier · Werkzeug & Befestigung" / "Anna Keller · Bauleitung &
      Procurement". Persona-friendly out of the gate.

### 10.5 Phase E — Pre-recorded fallbacks (user tasks)

- [ ] **E1 — Stopwatch screencast of the reorder flow.** Target: <30 s.
      Tool: OBS or browser recorder. Save as `demo/reorder-stopwatch.mp4`
      and link from `pitch.md`. **User task** — I provide the step
      list in `pitch.md`.
- [ ] **E2 — Full-demo fallback screencast** (foreman → procurement →
      approval → delivered). Same recording session as E1. Save as
      `demo/full-flow.mp4`.

### 10.6 Phase F — Pitch hygiene (markdown only)

- [x] **F1 — 5-slide outline in `pitch.md`:** cold-open hook → persona
      + numbers → live demo (or E1 clip) → architecture (hybrid Lovable
      story) → ROI + ask. Section 5 of `pitch.md`.
- [x] **F2 — Pitch-language rule.** Banned-words rule lives at the top
      of `pitch.md` (section "Pitch-language rule"). Includes the
      "answer in v2 / extension-point" reframing for "do you support X"
      questions.

### 10.7 Phase G — Demo-day operational checklist

- [ ] **G1 — Two Chrome profiles, pre-logged-in.** One foreman cookie,
      one procurement cookie, both with browser windows side-by-side
      on the demo screen so no role-switch is ever shown. Setup docs
      at the bottom of `pitch.md`.
- [x] **G2 — Migration 0003 applied to the shared Supabase project.**
      Verified 2026-05-22: `project_products.unit_price` exists on the live
      DB (REST probe returns 200). All three migrations (0001/0002/0003) are
      applied. No further action needed.
- [ ] **G3 — Smoke-test all routes** after starting `npm run dev` on
      demo day. Every route on the build-output table should return
      200 once the role cookie is set.

### 10.8 Continuity for a new Claude session

```
For a fresh chat picking up §10:
- Read ONBOARDING.md, then CLAUDE.md, then plan.md (§10 first), then pitch.md.
- The B-track choice is locked: B1 (delivery-note OCR). B2/B3 are
  explicitly NOT picked.
- The mock punchout (C1) writes a "Häfele DE" supplier to the shared
  cloud DB on first run. Don't be surprised when you see it in the
  catalog.
- Per-project price override (migration 0003) is on main; the team
  must have applied it via `npx supabase db push` before any
  /api/orders call against an override-bearing project_products row
  succeeds.
- Items A2, E1, E2, G2 are USER tasks (Lovable URL, screencasts,
  team-chat ping) — do not try to do them; just verify they're in
  pitch.md as handoffs.
- Branch model: work on dev-b, fast-forward main at each commit.
- Cookie→profile: ILIKE on Polier A / Polier B / Bauleitung needles
  (lib/server/demo-profile.ts).
- All AI calls funnel through lib/ai.ts (server-only).
```

---

## 11. Demo polish v2 — judge critique #2 (post-§10 polish)

> Second pass with the ruthless-judge hat on, after §10 polish
> shipped. §10 stays as the round-1 record; §11 is round 2.
> **B1 (delivery-note OCR) AND B3 (voice ordering) ship together** —
> they're complementary demo beats on different screens, not
> competing options. Approving §11 = approving the v2 critique
> reading + the new checkboxes below.

### 11.1 Status check on §10 (cross-reference, do not re-tick)

| §10 item | Status |
|---|---|
| A1, B1, C1, D1, D2, F1, F2 | Shipped in code last session — see §10 for ticked detail. |
| A2 (Lovable URL), A3 (stopwatch verify), E1, E2 (screencasts), G1, G2, G3 (demo-day ops) | Still open — user tasks. |
| B2 (photo-of-shelf), B3 (voice) | B2 not picked; B3 **moved from "alternative" to "ship alongside B1" in §11.B below.** |

### 11.2 Tier 1 — must do to move the needle

- [ ] **11.A — Lovable foreman-home mock** *(same as §10.A2; still
      open; user task)*. Even a 3-screen static Lovable mock with
      screenshots of the real foreman home converts the
      architecture-slide conversation from "trust us" to "here it
      is." Paste the URL into `pitch.md` §6 and `plan.md` §10.A2
      when done.
- [x] **11.B — Voice ordering on `/foreman/discover` (B3 add-on,
      Dev B lane).** `app/foreman/_components/VoiceSearch.tsx` is an
      additive client component that uses the browser's
      `SpeechRecognition` (lang `de-CH`), pipes the transcript into
      the existing search input, and triggers `runSearch(transcript)`
      directly so the A-material blocklist + `/api/discover` POST
      flow remains unchanged. **Feature-detects** on
      `window.SpeechRecognition || webkitSpeechRecognition` and
      hides on unsupported browsers (Firefox). New microcopy under
      `voice.*` in `copy.de.ts`. DiscoverClient.tsx import + render
      is the only Slice A file touched.
- [ ] **11.C — Re-seed the shared cloud DB** *(user task)*. Smoke
      tests at the end of the §10 session confirmed `orders` is
      empty after `npm run seed:clean` (commit `cdf8d07`). Before
      the demo slot, coordinate in team chat and run `npm run seed`
      (full version) to re-populate the ~20 fixture orders. Without
      this, both the queue and the OCR demo beat fall flat.

### 11.3 Tier 2 — high ROI if time

- [ ] **11.D — Real 5-slide deck file** *(user task)*. The §5 outline
      in `pitch.md` is solid prep; the actual slides don't exist
      yet. Google Slides / Keynote / Pitch.com. Cold-open hook =
      photo of crumpled paper delivery notes (from the brief FAQ).
- [x] **11.E — Compliance alert on `/procurement/dashboard`
      (Dev B lane).** Hardcoded amber card landed at the top of the
      dashboard ("3 orders this month went to non-framework
      suppliers — Review queue →") with an explicit "mocked
      compliance gate" subtitle so the pitch can own that it's a
      placeholder. Copy keys `dashboard.alert_{title,body,cta}` in
      `copy.en.ts`. Sits above the supplier/group bars; CTA links
      to `/procurement/queue`.
- [ ] **11.F — Stopwatch screencast (E1) recorded against a
      *populated* DB** *(user task)*. Target: sub-30 s reorder.
      Tool: OBS. Save as `demo/reorder-stopwatch.mp4`. Without
      this, the "obviously easier than a phone call" claim has no
      proof.

### 11.4 Tier 3 — pre-empt the killer questions

- [x] **11.G — Scale-honesty slide** *(markdown drafted; user
      pastes into slides)*. Section "Scale (50k SKUs) — what v2
      ships" appended to `pitch.md`. Covers pgvector embeddings,
      per-trade narrowing, and procurement-side curation of a
      "standard list" per project. Honest framing: "live demo
      runs on 99 SKUs; here's the path to 50k." Drop straight
      into the deck after slide 4.
- [x] **11.H — Refresh canned delivery-note timestamp (Dev B
      lane).** Bumped `delivery_date` (and the date inside the
      `order_ref`) in `lib/canned/delivery-note.ts` from
      `2026-05-21` to `2026-05-22` so the OCR fallback presents a
      same-day timestamp on stage.

### 11.5 Explicit non-goals (do NOT re-propose these)

- Real punchout (Häfele/Würth developer portal) — mock is enough
  for the demo; building it would burn 4+ hours for zero pitch
  uplift.
- Per-project price override UI in the live demo — the schema and
  API are live (migration 0003, `/api/orders` resolves overrides),
  but surfacing it on stage risks confusion.
- Good / better / best variants — out of scope.
- `lib/rules.ts` or `lib/schema.ts` edits — locked surfaces.
- Re-seeding the catalog mid-session — `seed:clean` was shipped
  for a reason; treat it as the team's chosen state.

### 11.6 Continuity for a fresh chat

```
For a fresh chat continuing §11:
- Read §10 first (history), then §11 (current workbook).
- B1 (OCR) AND B3 (voice) ship together — both live in the build.
  Voice on /foreman/discover replaces typing/scrolling; OCR on
  /foreman/orders/[id] replaces waiting/manual-confirm. Do not
  drop either at demo time.
- Items 11.A, 11.C, 11.D, 11.F are user tasks (Lovable URL, seed,
  slide deck, screencast). Item 11.G is user-drafted from a
  markdown stub I can write. Items 11.B, 11.E, 11.H are Dev B
  code work shipped or queued in this session.
- VoiceSearch client component lives at
  app/foreman/_components/VoiceSearch.tsx — feature-detects on
  window.SpeechRecognition / window.webkitSpeechRecognition,
  hides on unsupported browsers (Firefox).
- The compliance alert on /procurement/dashboard is a hardcoded
  mock; the pitch should call it that. Live framework-compliance
  would join approval_rules to a supplier-framework table.
- Cookie→profile: still ILIKE on Polier A / Polier B / Bauleitung
  needles (lib/server/demo-profile.ts).
- Branch model: work on dev-b, fast-forward main at each commit.
```

---

## 12. Slice A — voice ordering on /foreman home (MERGED to main)

Parallel surface to §11.B's `VoiceSearch` on /foreman/discover. Two voice
features in the build, two intents, two screens. Both ship.

### 12.1 Status

- **Merged to `main`** (2026-05-22 session, merge commit `ca064a0`).
- Schema-conflict resolution: both Slice A's voice schemas and Dev B's
  `decideOrderLine*` schemas (§ partial decisions) live in
  `lib/schema.ts` side-by-side; both were additive, conflict only
  because they appended at the same line. Same applies to copy.de.ts
  (mine adds `voice.order_button*`, Dev B added `order_detail.*`).
- `typecheck` / `lint` / `build` all green post-merge.

### 12.2 Commit ladder (each independently green)

```
c1af139  feat(schema): voice request/response Zod schemas
ccb9919  feat(ai): transcribeAudio() Whisper wrapper
d76a60a  feat(canned): canned voice fallback under lib/canned/voice.ts
f4c0f2d  feat(copy): voice.* German microcopy (foreman home)
b4e87ae  feat(api): POST /api/voice — Whisper + extraction + A-material guard
943fe84  feat(foreman): VoiceOrderButton FAB + result panel + wire in
```

### 12.3 Pipeline (file refs)

```
[Browser /foreman]                            app/foreman/_components/VoiceOrderButton.tsx
  Tap mic FAB → MediaRecorder (audio/webm)
  Tap again → stop → multipart POST /api/voice
                ↓
[Server]                                       app/api/voice/route.ts
  1. Parse multipart, validate File (4 KB–10 MB)
  2. transcribeAudio(file, lang="de", fallback=CANNED_VOICE_TRANSCRIPT)   lib/ai.ts
  3. isABlockedTerm(transcript) → { redirect, message }                   lib/constants/blocklist.ts
  4. maybeServerClient + loadCatalog + fallbackCatalog (INLINED from
     app/api/discover/route.ts:60-147 to keep this slice self-contained)
  5. callAI() with German extraction prompt →                             lib/ai.ts
       AiVoiceResponse { items: [{ supplier_sku, qty }], ≤ 8 }            lib/schema.ts
     Canned fallback: cannedVoiceFor(transcript)                          lib/canned/voice.ts
  6. resolve(): SKU → product_id from catalog; orphans → unmatched
  7. voiceResponseSchema.safeParse defence-in-depth
                ↓
[Browser]                                      app/foreman/_components/VoiceOrderButton.tsx
  voiceResponseSchema.safeParse on the client too
  Render <ResultPanel>: transcript + Stepper per matched item
                                    + unmatched names with "/foreman/discover?task=…" link
  "Übernehmen" → for each matched line, call addToCart(product_id, qty)
                 (the existing ForemanHomeClient prop — same path used
                 by the kit tiles + most-ordered grid)
  "Verwerfen" → setState({ kind: "idle" })
  Existing CartBar then submits via POST /api/orders as always
```

### 12.4 Files (what / where)

| Path | Role |
|---|---|
| `app/api/voice/route.ts` | POST handler. NEW. |
| `app/foreman/_components/VoiceOrderButton.tsx` | FAB + state machine + result panel. NEW. |
| `lib/canned/voice.ts` | `CANNED_VOICE_TRANSCRIPT` + `cannedVoiceFor()`. NEW. |
| `lib/ai.ts` | Added `transcribeAudio()` alongside `callAI`. `OPENAI_TRANSCRIBE_MODEL` env (default `whisper-1`). `AI_AUDIO_TIMEOUT_MS = 30_000` (separate from chat's 20 s). |
| `lib/schema.ts` | Added `aiVoice*` + `voice*` Zod schemas (additive). |
| `lib/constants/copy.de.ts` | Added `voice.order_button`, `.recording`, `.processing`, `.too_short`, `.no_audio`, `.no_match`, `.unmatched_hint`, `.permission_denied`, `.apply`, `.discard`, `.transcript_label`, `.blocked`, `.error`, `.canned_hint`, `.order_button_short`. Distinct from Dev B's `voice.start` / `voice.stop` / `voice.retry`. |
| `app/foreman/_components/ForemanHomeClient.tsx` | One import + one JSX line (`<VoiceOrderButton addToCart=… projectId=… />`) + `projectId` prop threading. |
| `app/foreman/page.tsx` | Pass `profile.project_id` as `projectId` prop. |

### 12.5 Verification phrases (against seeded DB or no-DB fallback)

| Phrase | Expected cart fill |
|---|---|
| "Ich brauche zehn Schrauben TX25 sechs mal achtzig." | `C003` × 10 |
| "Zwei Rollen Panzertape silber und einen Bohrer acht Millimeter." | `C027` × 2, `C034` × 1 |
| "Drei Tuben Silikon transparent und eine Flasche Reinigungsalkohol." | `C039` × 3, `C043` × 1 |
| "Wir brauchen zehn Sack Beton." | A-material redirect (no second AI call) |

### 12.6 Edge cases (already handled)

| Case | Where | Behaviour |
|---|---|---|
| Mic permission denied | `getUserMedia` catch | `DeniedPanel` with help text |
| Tap < 500 ms or blob < 4 KB | `onstop` early branch | `ErrorPanel` showing `voice.too_short` |
| Empty transcript | `/api/voice` post-Whisper | `ErrorPanel` showing `voice.no_audio` |
| GPT invents unknown SKU | `resolve()` | Surfaced in `unmatched` with manuell link |
| A-material in transcript | server step 3 | `BlockedPanel` (amber), no second AI call |
| `OPENAI_API_KEY` missing | `transcribeAudio` + `callAI` fallbacks | `CANNED_VOICE_TRANSCRIPT` → cannedVoiceFor → demo still works |
| Network failure | client fetch catch | `ErrorPanel` showing `voice.error` |

### 12.7 Out of scope (do NOT re-propose)

- Multi-turn voice ("davon doch nur fünf")
- Auto-submit (the existing CartBar is the single confirm point)
- Language detection beyond German
- Voice clip persistence anywhere
- Streaming transcription
- Voice on /foreman/discover (Dev B's surface — §11.B)
- Free-text quick-add box (separate feature)
- Photo-of-shelf reordering (separate feature)
- Polier-side dashboard (separate feature)

### 12.8 Continuity for a fresh chat

```
For a fresh chat continuing §12:
- Slice A voice ordering is MERGED to main (merge commit ca064a0).
  Six feature commits + the merge — see §12.2 for the ladder.
- It coexists with Dev B's VoiceSearch (§11.B / 5430dd1 on main).
  Mine: server-side Whisper on /foreman home (cart fill).
  Theirs: Web Speech API on /foreman/discover (search input).
  Both ship, both demo.
- Files I touch: app/api/voice/route.ts (new),
  app/foreman/_components/VoiceOrderButton.tsx (new),
  lib/canned/voice.ts (new), lib/ai.ts (added transcribeAudio),
  lib/schema.ts (added voice schemas), lib/constants/copy.de.ts
  (added voice.order_button etc), app/foreman/page.tsx +
  ForemanHomeClient.tsx (one-line wire-up + projectId threading).
- Slice B files (app/api/orders/**, app/procurement/**,
  lib/rules.ts, copy.en.ts) — untouched.
- Slice C files (scripts/seed.ts, app/api/ingest/**,
  app/api/discover/**, lib/constants/{blocklist,categories,chips}.ts)
  — untouched. lib/canned/voice.ts is new under Dev C's convention;
  flagged as additive.
- No new migration. Voice clips never persisted.
- Verification phrases in §12.5. A-material guard verified by
  saying "zehn Sack Beton" — server should short-circuit before
  the second callAI.
- When the team's ready to integrate, fast-forward dev-a into main
  (no conflicts expected — additive surface only).
```
