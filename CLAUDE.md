# CLAUDE.md — Site Order (C-materials ordering app)

> This file is read at the start of every Claude Code session. Keep it lean.
> The full build plan lives in `plan.md` (current — read this first); the
> earlier hand-spec in `SPEC.md` is kept for reference but `plan.md` is the
> source of truth. Read `ONBOARDING.md` if this is your first session — it
> tells you where Step 0 left things and how the three-way team split works.

## What we're building

A mobile-first web app that lets a construction foreman order low-value site
consumables (screws, gloves, tape, spray cans — "C-materials") in under a
minute, while procurement keeps control via spend thresholds and approvals.
Built on top of comstruct (a construction procurement data platform). Hackathon
MVP — favour a working end-to-end slice over breadth. Full context: `plan.md`.

## Tech stack (decided — do not substitute without asking)

- **Framework:** Next.js 16+ (App Router) + TypeScript + React 19
- **Styling:** Tailwind CSS v4. shadcn/ui can be added per-component when a
  phase needs one — not pre-installed in Step 0.
- **Database / Auth / Realtime:** **Supabase Cloud** (no local Docker). Schema
  lives in `supabase/migrations/*.sql` as versioned SQL.
- **AI:** `openai` SDK, model `gpt-4o-mini` (override via `OPENAI_MODEL`).
  Used for contract-PDF extraction and task-based product search. All calls
  go through `lib/ai.ts` (timeout + canned fallback).
- **Hosting:** Vercel.
- **Charts:** Recharts. **CSV parsing:** PapaParse. **Validation:** Zod.

## Commands

- Install: `npm install`
- Dev server: `npm run dev` (http://localhost:3000)
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`
- Seed catalog (Phase 1+): `npm run seed` — talks to **cloud** Supabase via the
  service-role key in `.env.local`; idempotent (TRUNCATE … RESTART IDENTITY
  CASCADE then re-insert).
- Apply migrations (cloud): `npx supabase db push` against the linked project,
  or paste the SQL into the Supabase dashboard SQL editor. **There is no
  local Docker Supabase — `npx supabase db reset` does not apply here.**

## Immutable rules

- **All OpenAI API calls AND all uses of `SUPABASE_SERVICE_ROLE_KEY` live
  in Next.js Route Handlers under `app/api/**` (server-only).** The browser
  uses the **anon key only**. The single chokepoint for AI is
  `lib/ai.ts`; the single chokepoint for privileged DB writes is
  `lib/supabase/server.ts`. This is the most important security rule in the
  project.
- **Never let the AI invent SKUs or prices.** Extraction is extract-or-null.
  Validate every AI JSON response with Zod (`lib/schema.ts`) before it touches
  the database; route low-confidence / null-price rows to `status='review'`,
  not straight to the catalog.
- Secrets live in `.env.local` (gitignored). `.env.example` is committed with
  placeholder names only. Never commit real keys.
- **C-materials only.** A-materials (concrete, steel, rebar) are out of scope
  and must be kept out of the catalog and the foreman flow by design. The
  blocklist in `lib/constants/blocklist.ts` is applied at search **and** at
  ingestion.
- Plain language in all user-facing copy ("Kleinmaterial für die Baustelle"),
  never the jargon "Klasse C"/"C-Material". Foreman UI is for non-digital
  natives: big tap targets, +/- steppers, no modal dialogs, no numeric
  keypad. UI language is **German for foreman screens, English for
  procurement / admin** — strings live in `lib/constants/copy.de.ts` and
  `lib/constants/copy.en.ts`.
- **Foreman never sees per-item unit prices.** Only the cart total. Procurement
  sees full prices everywhere.

## Working style

- Work through `plan.md` phase by phase. After each phase: run `npm run
  typecheck && npm run lint && npm run build`, summarise what changed, tick
  the relevant `[ ]` → `[x]` checkboxes in `plan.md`, commit, and stop for
  review before continuing.
- Ask before destructive actions (dropping tables, rewriting migrations,
  `git reset`, force-pushing).
- Prefer small, readable components. Don't add features not in `plan.md`.
- Three-person team: see `ONBOARDING.md` for which slice you're owning. The
  schema and the shared `lib/` surface are intentionally locked in Step 0 so
  three streams can run in parallel without merge collisions.
