# pitch.md — comstruct × Lovable hackathon

> Internal pitch workbook. **Do not show this file on stage.** It tells
> the story behind the demo and tracks the operational checklist for
> demo day. See `plan.md` §10–§17 for the implementation checkboxes
> that feed into this.

## Pitch-language rule (F2)

When pitching, **never say**:

- "stretch" / "stretch goal"
- "cut" / "cut for hackathon"
- "Phase 10" / "Phase 8 stretch" / any internal phase number
- "intentional hackathon collapse"
- "we evaluated and dropped …"
- "we'll add this later"

Tell the story of **what exists**, not what was de-scoped. If asked
"do you support X?" and X isn't built, answer **"v2 already has the
extension point — happy to walk through the schema"** rather than
"we cut it".

---

## 0. What ships today (open this 5 min before going on stage)

The pitch leans on a dozen real, demoable features. Each is one
sentence so the pitcher can speak to it without flipping files.

- **Sprachassistent (`AssistantSheet`)** — sparkle button in the
  bottom nav, foreman speaks OR types in **German, Italian, or
  English**, AI returns checkable items with unit-aware steppers,
  one tap merges them into the cart.
- **Voice search** — Web Speech mic in the discover search bar,
  zero server round-trip, fills the input with the transcript and
  fires the existing search.
- **Delivery-note OCR** — foreman snaps a paper Lieferschein on
  their phone, vision model extracts order ref + line count + date,
  status flips to *Delivered* without waiting for the timer.
- **Per-line procurement decisions** — Anna approves/declines each
  line independently, attaches a reason, and picks a suggested
  replacement product the foreman can one-tap into a fresh order.
- **Sub-second live updates** — 1 s polling + Supabase Realtime;
  pills flip **Approved → Ordered → Delivered** without a refresh.
- **Mock Häfele DE punchout** — one click onboards 12 SKUs under a
  new supplier with idempotent upsert — the second supplier channel
  promised by the brief.
- **CSV + PDF ingest** — PapaParse for CSV, OpenAI extraction +
  Zod validation for PDF, automatic review/active split on low
  confidence or missing fields.
- **Catalog admin** — inline edit name / group / price, activate
  review rows, per-project price override (migration 0003).
- **Spend dashboard** — Recharts bars by supplier + product group,
  top-foremen table, mocked compliance alert at the top, decision
  recap below.
- **Three kit tiles** — PPE-Set, Trockenbau-Set, Werkzeug-
  Grundausstattung; one tap fills the cart at default quantities.
- **Misuse prevention** — A-material blocklist enforced at search,
  ingestion, AND inside the voice/AI prompt path; friendly redirect
  to the Bauleiter, never a dead end.
- **Plain-language onboarding** — dismissible "C-Material erklärt"
  banner on the home + a dedicated `/foreman/info` route.
- **Offline-tolerant cart** — localStorage queue with explicit
  "wird gesendet, sobald wieder online" badge, flushes on `online`
  event.
- **Mobile-first, works on a real phone** — HTTPS dev server
  (`npm run dev:https`), tested over LAN with mic + camera
  permissions, safe-area-inset-aware bottom nav.
- **Modern UI, comstruct-branded** — Plus Jakarta Sans display font,
  the comstruct palette (teal `#33687B` primary, gold `#EBB94C`
  accent, cool-gray canvas), animated pending-chip ping dot,
  persona-named role picker on `/`. Reinforces "the C-material front
  door for comstruct" — the app looks like part of their product.

---

## 1. Persona

**Stefan Müller, 53. Polier on Baustelle Zürich-West.**

- Works 6 days a week, 11 hours a day.
- Has a 5-year-old Samsung Galaxy A-series with one cracked corner.
- Five apps installed: WhatsApp, Outlook, the Swiss weather one, the
  union app, and Google Maps.
- Today: **14 supplier calls per week** for C-materials. Average call
  18 minutes including hold time. Mike at Würth knows him by voice.
- Hates Excel. Has never used SAP.
- His site team is mixed German / Italian / Turkish-speaking — most
  Swiss building sites are — so **the assistant takes DE, IT, and EN
  out of the box**.
- Site Order has to be **obviously faster than calling Mike.**

**Anna Keller, Procurement / Bauleitung.**

- Manages framework contracts with 33 suppliers.
- Today: phone-call orders arrive untracked; she sees them on the
  weekly invoice run, by which point Stefan has already received
  the goods.
- Cares about **kickback compliance, project budget, and ESG
  reporting** — not micro-managing Stefan's screws.
- Spends ~2 hours a week triaging "we ordered the wrong thing —
  can you reach out to the supplier?" — exactly what per-line
  decisions with suggested replacements automates.

---

## 2. The problem in their words

From the brief itself:

> "On a construction site, they order by telephone, then the delivery
> comes together with a paper delivery note. This delivery note is
> taken and stored in their container. Sometimes the values are
> written into an Excel list manually."

Tail spend is the punchline:

- **~5 %** of total purchasing value
- **~60 %** of all orders
- **~75 %** of suppliers
- **~85 %** of items

So every C-material order is a friction tax: cheap goods, expensive
process. Multiply by 200 orders/week for a 50-Polier construction
firm and you have a quiet six-figure leak.

---

## 3. ROI math (the slide-3 number)

| Variable | Conservative | Aggressive |
|---|---|---|
| Foreman time saved per order (vs phone) | 5 min | 12 min |
| Orders / week / company | 200 | 200 |
| Working weeks / year | 50 | 50 |
| Loaded labour cost / hour | 80 CHF | 80 CHF |
| **Annual foreman savings / company** | **~66 000 CHF** | **~160 000 CHF** |
| Procurement triage hours saved (per-line decisions vs phone-rounds) | 2 h/wk | 4 h/wk |
| Procurement cost / hour | 80 CHF | 80 CHF |
| **Annual procurement savings / company** | **~8 000 CHF** | **~16 000 CHF** |
| **Combined / company / year** | **~74 000 CHF** | **~176 000 CHF** |

Frame the slide as "**200 orders × 5 minutes saved × 80 CHF/hour =
66 000 CHF per company per year on the foreman side alone.** Add
Anna's tail-spend triage and the combined number clears 74 000 CHF
— for a single 50-Polier firm, and the gap only widens with scale."

---

## 4. Live demo script (5 minutes, 8 beats)

Two Chrome windows side-by-side, both pre-logged in (see §G1 below).
Stopwatch in the corner of the foreman window. **One demo phone
(connected to the dev HTTPS server over LAN)** sits next to the
laptop for the OCR beat — if WiFi cooperates you hand it to a
judge.

> **Talking-rhythm rule:** one sentence per beat. Show the UI doing
> the work; do not narrate the schema. The clock is the killer
> argument.

1. **00:00 — Open as Stefan.** Tap "Stefan Müller · Polier ·
   Baustelle Zürich-West" on the role picker. Land on `/foreman`.
   Banner already dismissed (sticky localStorage). Show the three
   kit tiles + "Dein letzter Auftrag" with the inline stepper.
   *"This is Stefan's start screen. No menus, no SKUs — just the
   stuff he ordered yesterday."*

2. **00:15 — Wow #1: Sprachassistent in Italian.** Tap the
   sparkle button in the bottom nav. Sheet slides up. Speak:
   *"Mi serve il materiale per costruire una porta."* (Italian on
   purpose — the multi-lingual flex.) Within ~2 s: transcript
   appears, one-line German reply, **four checkable items with
   unit-aware steppers** (screws step by 10, tape by 1). Tap
   **"In den Warenkorb übernehmen"**. Sheet closes; the cart icon
   in the bottom nav now shows a red dot.
   *"Speak the job. The AI picks the parts. One tap."*
   **(Note: the foreman sees NO price anywhere — that's the control
   story. Procurement owns cost; Stefan just orders.)**

3. **00:45 — Send the order.** Tap the cart icon → CartSheet
   drawer slides up (quantities only, no prices). Tap **"Bestellung
   senden"**. The order is ~40 CHF server-side — under the
   auto-approve threshold → land on `/foreman/orders`. **Live pill
   flips Approved → Ordered → Delivered within ~8 s** (1 s polling).
   The demo terminal shows `[mock-comstruct] handoff …`.
   *"Stefan never waited for procurement, and never saw a franc.
   Anna sees the spend on her dashboard."*

4. **01:05 — Second order (intentionally over threshold).** Tap
   Discover in the bottom nav. Search *"Fenster abdichten"* (or use
   the Web Speech mic in the search bar — second voice surface).
   Three cards with German "why this fits" reasons. Bump qty with
   a chip preset. Submit. The order is **~310 CHF server-side → over
   the threshold → Pending**; Stefan just sees "Wartet auf Freigabe".

5. **01:30 — Wow #2: Per-line decline with a suggested
   replacement.** Switch to Anna's window. Within 1 s the new
   pending order is at the top of `/procurement/queue` with full
   unit prices and the hazardous flag where present. Flip one
   line to **Decline**, type *"Out of stock — try Würth
   alternative"*, pick a replacement from the catalog dropdown,
   set qty. Click **Submit decision**. The card collapses
   instantly to a green "Decision applied — handing off to
   comstruct" banner.
   *"This is where the brief's vision lives — procurement isn't
   a yes/no rubber stamp anymore."*

6. **02:05 — Foreman sees the decision live.** Back to Stefan's
   window. The order's pill flips Approved → Ordered. On
   `/foreman/orders` the order card carries a red "1/3 abgelehnt"
   badge + an emerald "Vorschlag vom Einkauf" badge. Tap the card
   → detail page → the declined line is struck through with the
   reason, and a green card offers **"Vorschlag annehmen"**. One
   tap puts the suggested product in the cart for a fresh order.
   *"Two-way communication, in the app, without a phone call."*

7. **02:30 — Wow #3: OCR delivery-note confirm.** Pick up the
   demo phone (already on `/foreman/orders/<id>`). Tap the camera
   tile. Snap a printed sample delivery note. The vision model
   returns **order ref, supplier name, line count, date,
   confidence** in a side-by-side card. Tap **"Geliefert"** →
   status flips to Delivered before the 8 s timer would have.
   *"The crumpled paper that used to sit in a container is now
   structured data in two seconds."*

8. **03:00 — Anna's procurement story.** Anna's window:
   `/procurement/ingest/punchout`. Click **"Connect to Häfele
   (mock)"**. 12 new SKUs appear under "Häfele DE". Switch to
   `/procurement/catalog` — they're orderable immediately. Switch
   to `/procurement/dashboard`: Recharts bars by supplier + group,
   the amber **compliance alert** at the top ("3 orders this
   month went to non-framework suppliers"), the decision recap
   below.
   *"Anna onboards a supplier in one click and sees tail-spend
   the moment it lands."*

9. **03:40 — Mention-only.** *(Stay on Anna's dashboard — no
   window switch.)* "We block A-materials at search, at ingest,
   and inside the AI prompt — Stefan can't accidentally order
   concrete here; he gets a friendly redirect to his Bauleiter
   instead. There's also a plain-language `/foreman/info` page he
   can open from the home — onboarding is part of the product."

10. **04:00 — Slide 5 close.** ROI + ask (see §10).

**Cumulative wow count: 3 (voice → cart, per-line decline with
suggested replacement, OCR).** Total foreman taps in beats 1–3: **4**
(mic on, mic off, "In den Warenkorb", "Bestellung senden").

---

## 5. Five-slide outline (F1)

### Slide 1 — Cold-open hook

A photo of a stack of crumpled paper delivery notes piled in a site
container. (From the brief: "delivery notes are taken and stored in
their container.") Title overlay: **"This is procurement today."**

No spoken intro. Hold the silence for two seconds.

### Slide 2 — Persona + numbers

Stefan Müller's face / silhouette on the left + the 5/60/75/85 stats
from the brief on the right. Bottom strip: Anna Keller. One
sentence: **"Stefan makes 14 supplier calls a week to spend 5 % of
the budget. Anna learns about every one of them on the invoice run
three weeks later."**

### Slide 3 — The demo (3 wow moments in 3 minutes)

Play the E1 stopwatch screencast (or live if WiFi cooperates).
Goal: hit all three wow moments — **voice-to-cart, per-line decline
with suggested replacement, OCR delivery-note** — inside three
minutes, ending on a green "Delivered" status pill.

### Slide 4 — Architecture (the hybrid Lovable story + the safety net)

Diagram: **Lovable foreman home → Next.js API gateway → Supabase
+ OpenAI**. Lead with: **"every AI call and every privileged DB
write goes through one server chokepoint — `lib/ai.ts` and
`lib/supabase/server.ts`. Service-role keys never reach the
browser, AI output is Zod-validated before it touches the database,
and a canned fallback fires the moment the model returns garbage
or times out."** *That* is the architectural win for a procurement
audience, not the framework choice.

Speak the Lovable split as: "the foreman screen is exactly where
Lovable shines — speed-to-iterate. The procurement backbone, the
AI extraction, the secret-bearing route handlers — that's where
the Next.js server boundary earns its keep. We chose the split
deliberately."

(If A2 is done, embed a thumbnail of the live `lovable.app` screen.)

### Slide 5 — ROI + ask

The 74 000 CHF / company / year number (combined foreman +
procurement). Then: **"Site Order is the C-materials front door
for comstruct's customers. We're ready to deploy on one Baustelle
next sprint."**

---

## 6. Architecture talk-track (slide-4 backup)

If a judge asks "why didn't you build it in Lovable?":

> "Lovable owns v2's foreman home — the API contract we've shipped
> (POST `/api/voice`, POST `/api/orders`, GET `/api/orders/list`)
> is exactly the surface a Lovable front-end consumes. The
> `AssistantSheet` you just watched is a Next.js client island
> today; in v2 it's a Lovable component calling the same JSON
> route. We deliberately kept every screen that handles AI prompts,
> service-role DB writes, or the punchout/PDF ingest pipeline on
> the Next.js side because each one needs a real server boundary
> that a no-server generator can't provide. Lovable wins the
> foreman iteration loop; Next.js wins the security story. Both
> ship."

If A2 lands before the demo (live `lovable.app` URL), swap the
opening clause for: *"We did — for the foreman home.
**<LOVABLE_FOREMAN_HOME_URL>**. But every screen that handles
…"*

---

## 7. Operational checklist (G1 / G2 / G3 / G4)

### G1 — Two Chrome profiles

1. `chrome --user-data-dir="%TEMP%\siteorder-foreman" https://localhost:3000`
2. In window 1, pick **Stefan Müller**. URL settles on
   `/foreman` (or `/foreman/orders` after one submit).
3. `chrome --user-data-dir="%TEMP%\siteorder-procurement" https://localhost:3000`
4. In window 2, pick **Anna Keller**. URL settles on
   `/procurement/queue`.
5. Side-by-side both windows on the demo screen. **Do not log
   either out for the duration of the pitch.**

### G2 — Migrations 0003 + 0004 chat ping (DONE)

> ✅ **Both applied (verified 2026-05-22):** 0003
> (`project_products.unit_price`) and 0004
> (`order_items.line_status` / `decline_reason` /
> `suggested_product_id` / `suggested_qty`) are live on the shared
> DB. No ping needed; kept for the record.

### G3 — Demo-day smoke test

After `npm run dev` (or `npm run dev:https`) starts, in PowerShell:

```powershell
# If you started with `npm run dev:https`, swap http → https in the URL.
# Self-signed cert is trusted on the laptop where it was generated, so no
# extra flags needed.
$cookie = "x-demo-user=foreman-a"
Invoke-WebRequest http://localhost:3000/api/orders/list -Headers @{Cookie=$cookie}
```

Expect 200. Repeat with `procurement` cookie against
`/procurement/dashboard`, `/procurement/catalog`,
`/procurement/queue`, and `/api/punchout` (POST with empty body).
If any returns 401/500, **don't go live** — fall back to the E2
screencast.

### G4 — Phone HTTPS for the OCR beat

The OCR wow moment needs `getUserMedia` + `<input capture>` on a
real phone. Browser secure-context rules mean LAN IPs over HTTP
are blocked; HTTPS over LAN is fine even with a self-signed cert.

1. On the laptop: `npm run dev:https` (Next's
   `--experimental-https` uses mkcert under the hood).
2. Find the laptop's LAN IP: `Get-NetIPAddress -AddressFamily IPv4`.
3. On the demo phone, open `https://<laptop-ip>:3000`, accept the
   cert warning **once**.
4. Pick **Stefan Müller** on the phone. Park it on
   `/foreman/orders/<id>` of an already-delivered order.
5. On stage: pick up the phone, snap the printed delivery note, tap
   "Geliefert". If a judge wants to do step 5 themselves, hand
   them the phone — the cert is already trusted.

---

## 8. Fallback inventory (for when WiFi dies)

- **E1** — `demo/reorder-stopwatch.mp4` (TODO, user task)
- **E2** — `demo/full-flow.mp4` (TODO, user task) — covers all three
  wow moments end-to-end.
- A2 — `LOVABLE_FOREMAN_HOME_URL` (TODO, user task)

Once recorded, paste the links in this section. If E1 + E2 are
filled in, the pitch can run **entirely off the screencasts** with
zero live API risk. The canned fallbacks in `lib/canned/*` mean
even the *live* pitch survives an OpenAI outage — the demo just
gets faster.

---

## 9. Risk register (what could kill the pitch)

| Risk | Likelihood | Mitigation |
|---|---|---|
| WiFi flaky at venue | Medium | E1 + E2 screencasts. Phone HTTPS keeps the OCR beat alive even on a hotspot. |
| OpenAI slow / rate-limited | Medium | `lib/ai.ts` falls back to canned for discovery, extraction, voice, AND OCR. Five rehearsed voice prompts in `lib/canned/voice.ts` return hand-curated picks; the dashboard never goes empty. |
| `AssistantSheet` returns weird items on a live mic | Medium | Canned fallback fires on empty/error; the foreman can also uncheck unwanted lines in the result panel before the cart-merge tap. If the model picks 6 items when 2 would do, the foreman trims with checkboxes. |
| Realtime drops during the pill flip | Low | 1 s polling fallback already in place on the orders list, queue, and dashboard. |
| OCR low-confidence on the judge's snap | Low-Medium | Route refuses auto-flip below 0.5 confidence and shows "low_confidence" copy; the 8 s timer still flips the order to Delivered, so the demo continues either way. |
| Per-line decline UI confuses procurement on stage | Low | Approve-all / Reject-all shortcuts at the top of the decision card; falls back to the legacy whole-order Approve/Reject buttons automatically if migration 0004 isn't applied. |
| Shared DB state shifts mid-demo (another dev seeds) | Low-Medium | Lock the demo slot in team chat 30 min ahead; `npm run seed` is idempotent if a re-seed is needed. |
| Judge asks "where's Lovable?" before slide 4 | Medium | §6 talk-track. **Never apologise.** Lead with the v2 contract framing. |
| Judge asks "what about 50k SKUs?" | Medium | §11 scale slide. Honest framing: "99 today, pgvector + per-trade + procurement curation gets us to 50k in one sprint." |

---

## 10. Post-demo asks (the slide-5 close)

- **Pilot:** One Baustelle, one comstruct customer, one month.
  We onboard their top 5 suppliers' contracts via the ingest flow,
  set the threshold and restricted groups with the Bauleitung,
  hand 3 Poliere a QR code to the foreman app, and report back
  hours-saved + tail-spend visibility after 30 days.
- **comstruct integration:** swap the mock comstruct handoff for
  the real comstruct order endpoint. Half a day of plumbing — the
  payload shape already matches.
- **Scale to 50k SKUs:** pgvector embeddings on `products` +
  per-trade narrowing + procurement-curated "Standard list" per
  project (§11). One sprint, no UI rewrites.
- **Foreman analytics for procurement:** which kits get tweaked
  most? Signals for new kit templates. The `material_sets` schema
  is already in place; this is a dashboard query and a CSV export.
- **Compliance v2:** replace the mocked compliance alert with a
  live join of `approval_rules` against a supplier-framework
  table. Anna's first real ESG/kickback reporting surface — and
  it's two queries away from the current dashboard.

---

*Last updated 2026-05-22 alongside the §17 audit. If you're a fresh
Claude session reading this for the first time, also read `plan.md`
§10, §11, §15, §16, and §17 — they explain how the AssistantSheet,
per-line decisions, and OCR features were built and where the
"locked decisions" live.*

---

## 11. Scale (50k SKUs) — what v2 ships

A slide-ready honest answer to the killer question: *"what happens
when you give Stefan Würth's full DACH catalog?"*

**Today (demo).** ~110 SKUs across 33 seeded suppliers + Häfele's
12-line mock punchout + any rows ingested live from the ACME PDFs.
`/api/discover` and `/api/voice` ship the project's active catalog
(first 200 rows) to `gpt-5.5` as text and let the model rank ≤16
items. Works clean at hackathon scale; would hit OpenAI's token
budget above ~2 k SKUs.

**v2 (the slide).** Three changes, no rewrites, ~1 sprint each:

1. **pgvector embeddings on `products`.** One
   `embedding vector(1536)` column, populated at ingest with
   `text-embedding-3-small`. Replace the prompt's catalog dump with
   a cosine-distance Top-N retrieval against the foreman's task
   string. Drops the per-query token cost by ~50× and stays
   sub-second at 50k SKUs.
2. **Per-trade narrowing before retrieval.** Foreman profiles already
   carry `trade` (PPE/consumables-heavy, tools/fasteners-heavy).
   Filter the embedding search by `products.trade IN (foreman.trade,
   NULL)` first — typical narrowing 50k → 5k → vector search.
3. **Procurement-curated "Standard list" per project.** Anna Keller
   marks ~500 SKUs as "preferred for Baustelle Zürich-West" through
   `/procurement/catalog` (add an `is_standard` flag on
   `project_products`). Foreman discovery prefers standard items;
   non-standard appears behind a "Mehr zeigen" expander. Solves
   both the scale problem AND the "Stefan needs guidance" problem
   in one schema change.

**One slide bullet:** "Today: ~110 SKUs, single-prompt. Tomorrow:
pgvector + per-trade + procurement curation. Same UI, same
behaviour, 50k SKUs."

---

*The v2 implementation skeleton lives in `plan.md` §11.G. None of
the v2 pieces are in the repo yet — this is intentional pitch
material.*
