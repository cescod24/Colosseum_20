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

> **Stack decision (locked):** Custom Next.js 16+ (App Router) on Vercel +
> Supabase Cloud + OpenAI SDK. **Lovable was evaluated and dropped** so
> we keep real server-side route handlers for AI/secret-bearing code and
> avoid the no-separate-server constraint of Lovable's React+Supabase
> generator. The trade is a slower start, paid for in faster iteration
> afterwards.

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
- [ ] Create `.env.local` (gitignored) — values supplied by the user.
      (The repo can't ship secrets — each dev creates their own
      `.env.local` from `.env.example` before running `npm run seed`.)
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

### Phase 1 — Data model + seed  `[x]`
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
- **Checkpoint:** `npm run seed` is written and idempotent (wipes in reverse
  dependency order, then inserts). It needs a linked Supabase project +
  `.env.local` to actually run — that's the team-unblock step, not a code
  gap.

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

### Phase 4 — Approval rules engine (F3, weight 14)  `[ ]`
- [ ] `lib/rules.ts` — pure `decide(total, items, rules)` returning
      `'approved' | 'pending'`. Trips pending if: `total >= threshold`, **or**
      any item's `product_group ∈ restricted_groups`, **or** any item is
      `hazardous=true`.
- [ ] Unit tests (Vitest or `node --test`) for `decide()` covering all three
      branches plus the safe path.
- [ ] `/api/orders` (POST): server fetches authoritative `unit_price` per item
      (clients cannot spoof the total), computes total, calls `decide()`,
      INSERTs `orders` + `order_items`, returns assigned status.
- **Checkpoint:** ~40 CHF safe order auto-approves; ~310 CHF order → pending;
  ~50 CHF hazardous order → pending.

### Phase 5 — Procurement approval queue (F4, weight 12)  `[ ]`
- [ ] `(procurement)/queue/page.tsx`: pending orders with total, items count,
      project, orderer, created-at. **Unit prices visible per line.** Two
      buttons: Approve / Reject.
- [ ] `/api/orders/[id]/decide` (POST):
  - [ ] On Approve: build comstruct-shaped payload (project ref, supplier_id,
        supplier_sku, qty, unit, unit_price, currency, hazardous, totals) →
        INSERT into `mock_comstruct_orders` → `console.log` → set
        `orders.status='ordered'`, `decided_by`, `decided_at`.
  - [ ] Schedule a follow-up flip to `delivered` ~8 s later (fire-and-forget
        `setTimeout` calling an internal RPC is fine for the hackathon).
  - [ ] On Reject: set `status` to a terminal rejected state (or back to
        `draft` with a rejection reason — keep it simple; status enum already
        covers `pending → approved/rejected` semantics; if no rejected state
        is wanted, just mark `decided_*` and leave it visible).
- [ ] `(procurement)/project/page.tsx`: edit `auto_approve_threshold` and
      `restricted_groups`. Form POSTs to a small project-update handler.
- **Checkpoint:** approving flips foreman's pill live → Approved → Ordered →
  Delivered ~8 s later. A `mock_comstruct_orders` row exists with a
  comstruct-shaped payload.

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

### Phase 8 — A-material explainer (F7, weight 8) — formalisation, stretch  `[ ]`

The core deliverable (the dismissible home banner) is already shipped in
Phase 2; the search-side redirect is shipped in Phase 7. This phase formalises
the explainer further if time allows. Drop entirely if short.

- [ ] Dedicated `/info` route reachable from a small "?" icon in the header,
      showing a one-screen plain-language explanation: what counts as
      C-Material (with icons), what doesn't (Beton/Stahl/Bewehrung/Schalung),
      and how to get those instead ("frag deinen Bauleiter").
- [ ] Surface the same friendly redirect copy used in Phase 7 on this page so
      a foreman who lands here from the search redirect has a single,
      consistent explanation.

### Phase 9 — Spend dashboard (F8, weight 6) — stretch  `[ ]`
- [ ] `(procurement)/dashboard/page.tsx` with Recharts:
  - [ ] Bar: spend by supplier (top N).
  - [ ] Bar: spend by product group.
  - [ ] Table: top foremen by tail-spend (sum qty × unit_price grouped by
        `created_by`).
- [ ] All amounts in CHF. Filter by project (default = the one seeded project).

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

- [ ] **Never** call OpenAI or use `SUPABASE_SERVICE_ROLE_KEY` from client
      components. All AI + privileged DB writes live in `app/api/**`.
- [ ] **Never** let the AI invent SKUs or prices. Validate every AI response
      with Zod **before** it touches the DB. Null prices / low confidence →
      `status='review'`.
- [ ] All foreman-facing copy in plain German (no "Klasse C"); all procurement
      copy in English. All tunable strings live in `lib/constants/copy.*.ts`.
- [ ] All AI calls go through the single wrapper in `lib/ai.ts` (timeout
      + canned fallback). No direct SDK calls from route handlers.
- [ ] Foreman screens never display per-item `unit_price`. Only the cart total.
- [ ] A-material blocklist applied at search **and** at ingestion.
- [ ] Seed must remain idempotent — re-running it must not create duplicates.

---

## 6. Verification (run after every phase + at the end)

- [ ] `npm run typecheck` clean.
- [ ] `npm run lint` clean.
- [ ] `npm run build` succeeds.
- [ ] Manual exercise of the demo flow in §1 above:
  - [ ] Banner "C-Material erklärt" appears on first foreman visit; dismiss
        sticks across reload.
  - [ ] Three kit tiles render on the foreman home; tapping any tile pre-fills
        the cart with the seeded kit's items + default quantities.
  - [ ] Reorder ~40 CHF → Auto-approved → Ordered → Delivered in ~20 s.
  - [ ] Search "Fenster abdichten" → 3–5 items with reasons → larger qty →
        Pending.
  - [ ] Procurement Approve → live flip on foreman screen → `mock_comstruct_orders`
        row exists with comstruct-shaped payload → ~8 s later Delivered.
  - [ ] Search "Beton" → friendly redirect, no API call.
  - [ ] (Stretch.) Dashboard charts non-flat across suppliers/groups/foremen.
- [ ] Unset `OPENAI_API_KEY` and rerun discovery + ingestion — both work
      via canned fallback; UI identical.
- [ ] Run seed twice in a row — no duplicates.
- [ ] Toggle offline indicator in foreman cart — submit queues, then drains on
      re-enable.

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

- _Phase 0 —_ **done** (Step 0 commit). Next.js 16 + TS + Tailwind v4 +
  shadcn/ui scaffold; `lib/role.ts` cookie helpers + role-switcher landing
  at `/`; `data/sample.csv` and `data/fake_contract_products_with_logo.pdf`
  moved; CLAUDE.md rewritten for cloud Supabase + service-role boundary;
  Lovable references removed across the docs.
- _Phase 1 —_ **schema half done** (Step 0 commit) + **seed half code-complete**
  (slice C, merged from `dev-c`). Full `supabase/migrations/0001_init.sql`;
  `scripts/seed.ts` parses the CSV, applies the blocklist, normalises via
  `categoryFor()`, and inserts suppliers/products/project/profiles/orders/
  kits + the hazardous fixture. Needs a linked Supabase project to actually
  run.
- _Phase 2 —_ **done** (Slice A, `dev-a` branch). Foreman home wired up
  under `app/foreman/page.tsx`: explainer banner (localStorage-dismissible
  via `useSyncExternalStore`), "Dein letzter Auftrag" with inline stepper +
  chip-row per line, three kit tiles loading from `material_sets`, top-5
  most-ordered grid, sticky cart bar with running CHF total. Offline toggle
  + localStorage queue with `online` event flush. Submit POSTs the cart to
  `/api/orders` (Dev B's Phase 4 handler) then redirects to
  `/foreman/orders`. Foreman never sees `unit_price` per line.
- _Phase 3 —_ **done** (Slice A, `dev-a` branch). `app/foreman/orders/page.tsx`
  renders a 5-segment status pill per order (Draft · Pending · Approved ·
  Ordered · Delivered) and subscribes to Supabase Realtime on `orders`
  filtered to the caller's profile, with a 5 s `/api/orders/list` polling
  fallback (Dev B-owned endpoint — client tolerates a 404 until Dev B ships
  it). Pending rows show the "Warte auf Einkauf" subtitle.
- _Phase 7 (UI) —_ **done** (Slice A, `dev-a` branch). `app/foreman/discover/
  page.tsx` + `DiscoverClient` + `CategoryGrid`: 9-tile icon grid from
  `categories.ts` (canonical keys: fasteners / electrical / ppe / tools /
  covers_tape / sealants / paint / cleaning_chemicals / misc), search bar
  with client-side `isABlockedTerm` short-circuit, POSTs `{task, project_id}`
  to Dev C's `/api/discover`, validates the response against
  `discoverResponseSchema`, renders ≤ 5 cards with German "why this fits"
  reasons + plus button to cart, "Nichts gefunden" empty state, and the
  friendly A-material redirect with a "Zurück zu den Kategorien" button.
  Reuses the same `CartBar` + localStorage cart as the home, so a discover
  → home → submit flow shares the cart end-to-end.
- _Phase 4 —_ (not started)
- _Phase 5 —_ (not started)
- _Phase 6 —_ **done** (slice C, `dev-c` branch). `/api/ingest` (CSV + PDF),
  `(procurement)/ingest` review screen, robust extraction prompt, canned
  fallbacks for both PDFs ([lib/canned/ingest.ts](lib/canned/ingest.ts)),
  and the authored messy PDF. Per-row activate is a visual toggle until the
  DB is wired. Verified locally: clean PDF → 8 active, messy PDF → 4 review.
- _Phase 7 —_ **backend done** (slice C, `dev-c` branch). `/api/discover`
  (catalog → OpenAI → Zod → SKU→UUID resolve), server-side A-material
  redirect, canned fallbacks for the 3 rehearsed prompts, and a
  `/procurement/discover-test` dev tool. The foreman-facing UI is slice A.
- _Phase 8 (stretch — banner already core in Phase 2; this is the /info route) —_ (not started)
- _Phase 9 (stretch — spend dashboard) —_ (not started)
- _Phase 10 (cut — only the procurement kit editor; seeded kits done in Phase 2) —_ (intentionally cut)
