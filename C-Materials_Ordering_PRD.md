# PRD — "Site Order" (working title)

### A C-materials ordering app for construction foremen, built on comstruct

**Document type:** MVP Product Requirements Document (hackathon scope)
**Build approach:** Vibe-coded on lovable.dev
**Status:** Draft for build
**Last updated:** 21 May 2026

---

## 1. What is the app?

**One-liner:** A mobile-first ordering app that lets a foreman (Polier) order everyday site consumables — screws, gloves, tape, spray cans — in under a minute, while procurement keeps control through spend thresholds and approvals.

**The problem it replaces.** Today, ordering C-materials on a construction site is a phone call to a merchant, followed by a paper delivery note that sits in a container, sometimes typed into Excel, and reconciled against invoices by hand at headquarters once a week. This is cheap material handled by an expensive process: C-materials are roughly 5% of purchasing *value* but around 60% of *orders*, 75% of *suppliers*, and 85% of *items* — the "tail spend." Every one of those small orders costs phone time and creates reconciliation errors.

**What the app does instead.** It gives the foreman a shopping-list interface seeded with the products their company has under contract, lets them find items by *task* rather than by SKU ("fix gypsum board to metal stud"), and submits a structured order. Small orders auto-approve; larger ones route to procurement. Everyone sees a single status trail: Draft → Pending → Approved → Ordered → Delivered. The order is structured data from the first tap, so the back-office reconciliation step largely disappears.

**Where it sits relative to comstruct.** comstruct is the procurement *backbone* — its existing API handles projects, deliveries, and invoices flowing into the construction company's ERP, but it has **no foreman-facing ordering front-end and no catalog/product-search endpoint.** That gap is exactly what this app fills. The app is the new ordering layer; at fulfilment it would hand a confirmed order to comstruct's existing delivery/invoice pipeline. For the hackathon, that handoff is mocked.

**Scope boundary — C-materials only.** A-materials (concrete, steel) are deliberately out of scope. For A-materials the decision is *which supplier*, prices are indexed and volume-rebated, and procurement leads. For C-materials, substituting one SKU or supplier for another barely matters ("it doesn't matter much which brand of hammer"), so the site can largely self-serve. The app must make this boundary obvious and prevent misuse (see §4 and Feature F7).

---

## 2. How do I use the app? (User journeys)

### Persona A — The Foreman / Polier (primary)
Not a digital native. On site, often gloved, dusty, poor reception, time-poor. The hard rule: **if it takes longer than a phone call, they won't use it.**

**Journey A1 — Reorder (the 80% case, target < 30 seconds):**
1. Open app → lands on the current project, "Order again" front and centre.
2. Sees "Most ordered on this project" and "Your last order" as tappable rows.
3. Taps **+ / −** to adjust quantities. No modals, no typing.
4. Taps **Send order.** Done. Status shows Draft → (auto-approved) → Ordered.

**Journey A2 — Find something by task (the discovery case, target < 90 seconds):**
1. Taps **Find materials** → either browses big-icon categories (Fasteners, Consumables, PPE, Tools…) or types/says a task: *"seal a window"*, *"fix plasterboard to metal stud."*
2. App returns a short recommended list (good / better / best where relevant), not 5,000 SKUs.
3. Adjusts quantities with + / − → adds to cart → **Send order.**

**Journey A3 — Check status:**
1. Taps **Orders** → sees each order as a horizontal status pill: Draft → Pending → Approved → Ordered → Delivered.
2. If something is Pending approval, it says *who* it's waiting on, in plain words.

### Persona B — Procurement / Bauleiter (control side)
Wants control without micro-managing every order. May be one person across several sites.

**Journey B1 — Configure a project (setup):**
1. Selects a project → defines the approval threshold (e.g. auto-approve under 200 CHF).
2. Optionally restricts which suppliers/product groups this site may order.
3. Optionally defines a "C-material set" (template) for a project phase.

**Journey B2 — Approve (the daily action):**
1. Gets a list of pending orders above threshold.
2. Sees order total, items, project, who ordered → **Approve** or **Reject** with one tap.

**Journey B3 — Watch spend:**
1. Opens a simple dashboard: C-material spend per project, per supplier, per product group; which sites/foremen drive the most tail spend.

### Admin / ingestion (setup, can be done by procurement)
Upload a supplier price list (CSV/Excel) **or** a contract PDF → the app extracts and normalizes products into the catalog → procurement reviews flagged rows → catalog goes live for that project.

---

## 3. The patterns behind the app

These are the conceptual models the whole build rests on. Get these right and the features fall out naturally.

**Pattern 1 — Tail spend / the A-B-C split.** The core insight is that *value* and *order-count* are inversely distributed. The app optimizes for order *frequency and speed*, not per-item value scrutiny — the opposite of how A-materials are handled. This justifies auto-approval for small orders and task-based (not SKU-based) discovery.

**Pattern 2 — The normalized product model.** Every supplier ships data differently (your CSV uses `artikel_id, artikelname, kategorie, einheit, preis_eur, lieferant`; a contract PDF uses `Product ID, Product Name, Unit, Unit Price`). The app maps all of them onto **one internal product shape**:
`{ id, name, supplier_sku, supplier, product_group, trade, unit, pack_size, unit_price, currency, hazardous }`.
Discovery, kits, and filters all read from this single shape — that is what keeps the foreman's view simple no matter how messy the source data was.

**Pattern 3 — Ingestion as an AI extraction + human-review step.** CSV/Excel is a direct parse. A contract PDF goes to the Anthropic API, which returns structured JSON *and* infers `product_group` / `trade` from the description ("Torx 4×40" → Fasteners). Crucially, the model is constrained to *extract-or-null* on prices — never invent — and low-confidence rows are flagged for procurement to confirm. Ingestion is a batch job, off the foreman's critical path.

**Pattern 4 — Discovery as ranking, not search.** Because a C-catalog is small per project (hundreds, not millions, once filtered to one company's contracts), task-based discovery is "rank the catalog against this natural-language task," which fits in a single AI prompt — no vector database needed at hackathon scale.

**Pattern 5 — The order state machine.** Draft → Pending → Approved → Ordered → Delivered, with the Pending state entered *only* when an order trips an approval rule. This single enum drives both the foreman's status view and procurement's queue.

**Pattern 6 — Rules as data, not code.** Approval thresholds and supplier/group restrictions are rows in a table keyed to a project, evaluated at submit time — so procurement can change them without a redeploy.

---

## 4. Making it most useful for the target audience

The make-or-break judging criterion is *"could a non-digital native use it without training?"* Design decisions that serve that:

- **Reorder is the home screen, not search.** The common case (buy the same stuff again) must be the first thing visible and require zero typing.
- **Big tap targets, + / − steppers, no modal dialogs.** Designed for gloves and a cracked phone screen in sunlight. High contrast, large type.
- **Task language, never jargon.** The UI says *"Small everyday items & consumables for your site,"* not "Class C materials." Categories use plain icons + words (Fasteners, Tape & seals, PPE, Tools).
- **Offline-tolerant.** Poor reception is a given. The cart must survive a dropped connection and submit when signal returns (queue locally, sync later).
- **Voice/task entry as an accelerator** for the foreman who can't find a category — types or speaks the task, gets a short list.
- **Price visibility is role-gated.** Per the domain input, foremen often *shouldn't* see prices for some categories; procurement does. Make price display a role/config setting, not a hardcoded assumption.
- **Misuse prevention as information architecture.** A-materials simply aren't in this catalog. If someone searches for "concrete," the app explains — in one friendly line — that big structural materials are ordered through a different process, with no dead-end.

---

## 5. Limitations to plan for

**On lovable.dev / the generated stack:**
- Lovable produces a **React + Supabase** app with **no separate API server** — the frontend talks directly to Supabase. Your Anthropic API key therefore **cannot live in the frontend** (it would be exposed). AI ingestion and task-search must run inside a **Supabase Edge Function** (server-side), called from the app. Plan this from day one; it's the single most common architecture mistake on this stack.
- Generated code "runs in production but typically needs developer review before real load." Fine for a hackathon; note it as a known debt.
- You build *within* Lovable's stack, not across languages — no Python backend. Your CSV/PDF ingestion logic runs as TypeScript in an Edge Function, or as a one-off local script that seeds the database before the demo.

**On the AI ingestion:**
- **Non-determinism** — extraction varies run-to-run; validate prices numerically and flag low-confidence rows rather than trusting blindly.
- **Large catalogs don't fit one prompt** — 50,000 SKUs must be batched/chunked; at hackathon scale (≤ a few hundred) this isn't a concern, but say so in the technical concept.
- **Never let the model invent SKUs or prices** — constrain to extract-or-null.

**On comstruct integration:**
- The real comstruct API is access-gated (key from a customer success manager) and has **no ordering or catalog endpoint** — so the fulfilment handoff is *mocked* for the demo and *described* in the technical concept. Don't promise a live comstruct call you can't make.

**On scope/time:**
- One project, 1–2 suppliers, ~100 products is enough for a convincing demo. Resist building breadth.

**On the domain:**
- Who can order/approve varies by site size and company — model it as configurable roles, don't hardcode one org structure.

---

## 6. Key features — MVP (scored, total = 100)

The score is a **priority weighting**: each feature's share of MVP value, summing to 100. Build top-down. If you run out of time, the lowest-scored items are the ones to cut — they are ordered so the demo still tells a complete story without them.

| # | Feature | What it must do | Score |
|---|---------|-----------------|------:|
| **F1** | **Foreman reorder flow** | Home screen = "order again": last order + most-ordered on project, + / − steppers, one-tap submit. The single most important screen. | **18** |
| **F2** | **Order state machine + status view** | Draft → Pending → Approved → Ordered → Delivered, visible to foreman with plain-language "waiting on X." | **15** |
| **F3** | **Approval rules engine** | Threshold per project (e.g. < 200 CHF auto-approve); above → Pending. Rules stored as data. Enforced at submit. | **14** |
| **F4** | **Procurement approval queue** | List of pending orders with total/items/project/orderer; Approve / Reject in one tap. | **12** |
| **F5** | **Catalog ingestion (CSV + PDF)** | CSV/Excel parse + AI extraction of a contract PDF into the normalized product model, with flagged-row review. Two channels = the "integration thinking" criterion. | **12** |
| **F6** | **Task-based discovery** | Natural-language task or big-icon categories → short ranked recommendation list (not a SKU dump). AI-ranked. | **11** |
| **F7** | **C-materials explainer + misuse prevention** | Plain-language framing of what belongs here; A-materials kept out by IA; friendly redirect on out-of-scope searches. | **8** |
| **F8** | **Spend dashboard** | Spend per project / supplier / product group; top tail-spend sites. Simple charts. | **6** |
| **F9** | **C-material set templates** | Procurement defines a set per phase; foreman picks set + tweaks quantities. | **4** |
| | **Total** | | **100** |

**Recommended build order for the demo:** F5 (so you have data) → F1 → F2 → F3 → F4 (this is the end-to-end spine: order → rule → approve → status) → F6 → F7 → F8 → F9. After F4 you already have a complete demo-able loop; everything after is enrichment.

---

## 7. Explicitly out of scope for the MVP (cut nice-to-haves)

These were tempting but are **removed** so the MVP stays buildable and the demo stays sharp:

- **Live comstruct API integration** — mocked at the fulfilment boundary instead.
- **Vector search / embeddings** — single-prompt ranking is enough at this catalog size.
- **Native mobile app (React Native/Expo)** — responsive PWA only; install via URL.
- **Real offline sync engine** — a simple "queue and retry" is enough to *demonstrate* the idea; full conflict resolution is post-MVP.
- **Multi-language UI** — pick one (German or English) for the demo.
- **Supplier-side accounts / supplier portal** — out of scope; suppliers enter only as catalog data.
- **Invoice ↔ delivery-note reconciliation** — that's comstruct's existing job downstream; the app's value is producing clean structured orders, not closing that loop.
- **Punchout/IDS live connection** — describe as the second supplier channel in the technical concept; demo the CSV/PDF channel.
- **Good/better/best AI variant grading** — keep as a stretch inside F6 only if time allows; not required for the core demo.
- **Push notifications, in-app chat, photo-of-the-shelf reordering** — all post-MVP.

---

## 8. Frameworks, libraries & packages

Because you're committing to **lovable.dev**, most of the stack is decided *for* you — which is good for speed. Here's the stack you'll actually be in, plus what to add.

**Generated by Lovable (you don't choose these, you work within them):**
- **Frontend:** React + TypeScript, **Vite** build, **Tailwind CSS** + **shadcn/ui** components. This is genuinely strong for the big-button mobile UI you need.
- **Backend:** **Supabase** — managed PostgreSQL, Auth, Storage, Realtime, and **Edge Functions** (Deno/TypeScript serverless). There is no separate Node/Express server; the frontend talks to Supabase directly.
- **Schema:** SQL migration files in the repo (versioned).
- **Hosting:** Lovable Cloud one-click deploy; code exportable to GitHub (no lock-in).

**What you add on top:**
- **Anthropic SDK** (`@anthropic-ai/sdk`) — called **only from a Supabase Edge Function**, never the browser. This is your ingestion (PDF → JSON) and task-search (task → ranked items) engine. Use **Claude Sonnet** for cost/quality on extraction volume.
- **Supabase Auth + Row-Level Security** — gives you the foreman vs procurement role split (and price-visibility gating) without building an auth system.
- **Supabase Realtime** — pushes order-status changes live to the foreman's status screen (Pending → Approved appears without refresh). High demo value.
- **PapaParse** — CSV parsing for the Excel/CSV ingestion channel (runs client-side or in an Edge Function).
- **Recharts** — the spend dashboard charts (pairs cleanly with the React/shadcn stack).
- **PWA config** (Vite PWA plugin) — makes it installable to the home screen and gives you the offline cart shell.
- **Zod** — validate the AI's JSON output against your product schema before it touches the database (your guard against hallucinated/null prices).

**The one architecture rule to tell Lovable explicitly in your prompts:** *"Put all Anthropic API calls in a Supabase Edge Function and call it from the frontend; never expose the API key client-side."* Lovable won't always do this unprompted, and it's the difference between a secure demo and a leaked key.

**Why not a custom Next.js + Postgres stack (the usual alternative):** it's a perfectly good stack and slightly more flexible (you'd get real server API routes), but it costs you the speed Lovable gives you, and Lovable is your sponsor — leaning into its strengths (instant full-stack scaffold, Supabase auth/realtime for free) is the right call for a hackathon. The trade-off you accept is the no-separate-server constraint above, which the Edge Function pattern fully resolves.

---

## 9. Demo scenario (the slice that wins)

One project ("Baustelle Zürich-West"), two suppliers — **one via CSV upload (Würth-style fastener list), one via contract PDF (the ACME-style framework contract)** — both ingested into one catalog.

1. **Procurement** uploads the CSV and the PDF → reviews two flagged rows → catalog goes live; sets auto-approve threshold at 200 CHF.
2. **Foreman** opens the app → reorders "last order" (gloves + screws + tape, ~40 CHF) → **auto-approved → Ordered** in 20 seconds.
3. **Foreman** searches *"seal a window"* → gets silicone + cleaner + tape → adds a larger quantity → order total **310 CHF → routes to Pending.**
4. **Procurement** sees it in the queue → **Approves** in one tap → foreman's screen flips to **Approved → Ordered** live (Realtime).
5. **Procurement** opens the spend dashboard → sees the project's tail spend split by supplier and product group.

That sequence hits every judging criterion — foreman ease, procurement control, complexity handling, and integration thinking — in under three minutes.
