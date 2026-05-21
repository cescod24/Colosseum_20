# pitch.md — comstruct × Lovable hackathon

> Internal pitch workbook. **Do not show this file on stage.** It tells
> the story behind the demo and tracks the operational checklist for
> demo day. See `plan.md` §10 for the implementation checkboxes that
> feed into this.

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

## 1. Persona

**Stefan Müller, 53. Polier on Baustelle Zürich-West.**

- Works 6 days a week, 11 hours a day.
- Has a 5-year-old Samsung Galaxy A-series with one cracked corner.
- Five apps installed: WhatsApp, Outlook, the Swiss weather one, the
  union app, and Google Maps.
- Today: **14 supplier calls per week** for C-materials. Average call
  18 minutes including hold time. Mike at Würth knows him by voice.
- Hates Excel. Has never used SAP.
- Site Order has to be **obviously faster than calling Mike.**

**Anna Keller, Procurement / Bauleitung.**

- Manages framework contracts with 33 suppliers.
- Today: phone-call orders arrive untracked; she sees them on the
  weekly invoice run, by which point Stefan has already received
  the goods.
- Cares about **kickback compliance, project budget, and ESG
  reporting** — not micro-managing Stefan's screws.

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
| Time saved per order (vs phone) | 5 min | 12 min |
| Orders / week / company | 200 | 200 |
| Working weeks / year | 50 | 50 |
| Loaded labour cost / hour | 80 CHF | 80 CHF |
| **Annual savings / company** | **~66 000 CHF** | **~160 000 CHF** |

Frame the slide as "**we give Stefan back ~4 hours a week** — and
that's 66 000 CHF a year if he's one Polier in a 50-person firm."

---

## 4. Live demo script (5 minutes)

Two Chrome windows side-by-side, both pre-logged in (see §G1
below). Stopwatch running in the corner of the foreman window.

1. **00:00** — Foreman window: tap "Stefan Müller". Land on the home.
2. **00:04** — Banner already dismissed (sticky localStorage). Show
   "Dein letzter Auftrag" with the inline stepper.
3. **00:08** — Tap "Bestellung senden". (No tweaks needed for the
   stopwatch shot. Total ~40 CHF, auto-approve.)
4. **00:12** — Foreman lands on `/foreman/orders`. Pill: **Approved
   → Ordered → Delivered** flips live within ~8 s.
5. **00:20** — Switch to a second order: search "Fenster abdichten".
   Three items with reasons. Bump quantity, submit. Total ~310 CHF
   → **Pending** (over threshold).
6. **00:35** — Procurement window: see the pending order at the top
   of the queue with full unit prices, hazardous flag where present.
   Click Approve.
7. **00:38** — Foreman pill flips Approved → Ordered live.
   `console.log("[mock-comstruct] handoff", …)` visible in the
   demo terminal.
8. **00:46** — **The wow moment (B1):** Foreman opens the just-
   delivered order, taps the camera input, snaps a photo of a paper
   delivery note. OCR returns the order ref + line counts. One tap
   "Geliefert" — status flips to Delivered without waiting for the
   timer.
9. **01:10** — Procurement: switch to `/procurement/ingest/punchout`
   (C1). Click "Connect to Häfele (mock)". Twelve SKUs appear under
   a new "Häfele DE" supplier in `/procurement/catalog`.
10. **01:25** — Procurement: `/procurement/dashboard`. Show the
    Recharts bars. One line: "**Anna sees the tail spend instead of
    discovering it on an invoice three weeks late.**"
11. **01:35** — Show `/foreman/info` briefly. Show the "Beton"
    redirect on `/foreman/discover`.
12. **02:00** — Close pitch (slide 5: ROI + ask).

---

## 5. Five-slide outline (F1)

### Slide 1 — Cold-open hook

A photo of a stack of crumpled paper delivery notes piled in a site
container. (From the brief: "delivery notes are taken and stored in
their container.") Title overlay: **"This is procurement today."**

No spoken intro. Hold the silence for two seconds.

### Slide 2 — Persona + numbers

Stefan Müller's face / silhouette + the 5/60/75/85 stats from the
brief on the right. One sentence: **"Stefan makes 14 supplier calls
a week to spend 5 % of the budget."**

### Slide 3 — The demo

Play the E1 stopwatch screencast (or live if WiFi cooperates). Goal:
a sub-30 s reorder, ending in "Delivered" within the same shot.
Cut to the B1 OCR moment.

### Slide 4 — Architecture (the hybrid Lovable story)

Diagram: **Lovable foreman home → Next.js API gateway → Supabase
+ OpenAI**. Speak it as: "the foreman screen is exactly where
Lovable shines — speed-to-iterate. The procurement backbone, the
AI extraction, the secret-bearing route handlers — that's where the
Next.js server boundary earns its keep. We chose the split
deliberately."

(If A2 is done, embed a thumbnail of the live `lovable.app` screen.)

### Slide 5 — ROI + ask

The 66 000 CHF / company / year number. Then: **"Site Order is
the C-materials front door for comstruct's customers. We're ready
to deploy on one Baustelle next sprint."**

---

## 6. Architecture talk-track (slide-4 backup)

If a judge asks "why didn't you build it in Lovable?":

> "We did — for the foreman home. **<LOVABLE_FOREMAN_HOME_URL>**.
> But every screen that handles AI prompts, service-role DB writes,
> or the punchout/PDF ingest pipeline needed a real server boundary,
> so those live in Next.js route handlers. The two halves talk over
> a stable JSON API. Lovable wins the foreman iteration loop; the
> Next.js half wins the security story. Both shipped."

(If the Lovable rebuild isn't done yet, **answer the same question
with the future tense**: "Lovable owns v2's foreman home — the API
contract we've built is exactly the surface a Lovable front-end
calls into.")

---

## 7. Operational checklist (G1 / G2 / G3)

### G1 — Two Chrome profiles

1. `chrome --user-data-dir="%TEMP%\siteorder-foreman" http://localhost:3000`
2. In window 1, pick **Stefan Müller**. URL settles on
   `/foreman` (or `/foreman/orders` after one submit).
3. `chrome --user-data-dir="%TEMP%\siteorder-procurement" http://localhost:3000`
4. In window 2, pick **Anna Keller**. URL settles on
   `/procurement/queue`.
5. Side-by-side both windows on the demo screen. **Do not log
   either out for the duration of the pitch.**

### G2 — Migration 0003 chat ping (paste in team channel)

> Heads-up: I just merged `feat(orders): per-project price
> override on project_products` to main (commit `498e05e`). It
> adds an additive migration `0003_project_product_price.sql`.
>
> Please run `npx supabase db push` (or paste the migration into
> the dashboard SQL editor) against the shared project before
> the demo run-through. The order route falls back to
> `products.unit_price` if the override column isn't present, so
> nothing breaks if you delay — but the override feature won't
> demo until the column exists.

### G3 — Demo-day smoke test

After `npm run dev` starts, in PowerShell:

```powershell
$cookie = "x-demo-user=foreman-a"
Invoke-WebRequest http://localhost:3000/api/orders/list -Headers @{Cookie=$cookie}
```

Expect 200. Repeat with `procurement` cookie against
`/procurement/dashboard`, `/procurement/catalog`,
`/procurement/queue`. If any returns 401/500, **don't go live** —
fall back to the E2 screencast.

---

## 8. Fallback inventory (for when WiFi dies)

- **E1** — `demo/reorder-stopwatch.mp4` (TODO, user task)
- **E2** — `demo/full-flow.mp4` (TODO, user task)
- A2 — `LOVABLE_FOREMAN_HOME_URL` (TODO, user task)

Once recorded, paste the links in this section. If all three are
filled in, the pitch can run **entirely off the screencasts** with
zero live API risk.

---

## 9. Risk register (what could kill the pitch)

| Risk | Likelihood | Mitigation |
|---|---|---|
| WiFi flaky at venue | Medium | E1 + E2 screencasts. |
| OpenAI slow / rate-limited | Medium | `lib/ai.ts` falls back to canned for both discovery and OCR. Demo-watcher won't notice. |
| Migration 0003 not applied yet | Medium | `/api/orders` falls back to catalog price; nothing breaks. Don't trigger an override during demo unless G2 is confirmed done. |
| Realtime drops during the pill flip | Low | 3 s polling fallback already in place. |
| Shared DB state shifts mid-demo (another dev seeds) | Low-Medium | Lock the demo slot in team chat 30 min ahead. |
| Judge asks "where's Lovable?" before slide 4 | Medium | Answer with the slide-4 talk-track above. **Never apologise.** |

---

## 10. Post-demo asks (the slide-5 close)

- **Pilot:** One Baustelle, one comstruct customer, one month.
  We onboard their top 5 suppliers' contracts via the ingest flow,
  set the threshold and restricted groups with the Bauleitung,
  hand 3 Poliere a QR code to the Lovable foreman home, and report
  back hours-saved + tail-spend visibility after 30 days.
- **comstruct integration:** swap the mock comstruct handoff for
  the real comstruct order endpoint. Half a day of plumbing.
- **Second wow moment:** voice ordering on top of the existing
  discovery prompt — `lib/ai.ts` already accepts text from the
  browser; Web Speech adds a 200-line client component.

---

*Last updated automatically when §10 boxes are ticked. If you're a
fresh Claude session reading this for the first time, also read
`plan.md` §10 and §10.8.*
