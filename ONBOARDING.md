# ONBOARDING.md — pick this up where Step 0 left off

> **First file to read** for any new Claude Code chat on this repo. After
> this, read `CLAUDE.md`, then `plan.md`, then `C-Materials_Ordering_PRD.md`
> as needed.

## Current state (updated 2026-05-21) — READ THIS FIRST

We are **past Step 0**. What has landed on `main`:

- **Step 0** (scaffold + schema + locked `lib/` surfaces).
- **Slice C** (data + AI): the seed, `/api/ingest`, `/api/discover`, the
  procurement ingest review screen, and a `/procurement/discover-test` dev
  tool.
- **AI provider is OpenAI**, not Anthropic. Wrapper is `lib/ai.ts`; env vars
  are `OPENAI_API_KEY` + `OPENAI_MODEL` (default `gpt-4o-mini`). The switch
  happened because the team has an OpenAI key.

**Infrastructure is live:**

- Supabase Cloud project is up, `0001_init.sql` is **already applied**, and
  `npm run seed` has **already been run** against it (99 products, 33
  suppliers, 3 profiles, 3 kits, 20 orders). The DB is **shared** — you do
  **not** need to re-apply the migration or re-run the seed. Re-running
  `npm run seed` wipes and reseeds the shared data, so only do it if you
  intend to reset it (e.g. before a clean demo).
- The 5 env values have been **shared in the team chat** (private). They are
  never committed. To work locally: `cp .env.example .env.local` and paste
  the values from chat.

**What works end-to-end right now** (with the real OpenAI key + seeded DB):

- Ingestion: upload a CSV or contract PDF at `/procurement/ingest` → real
  OpenAI extraction → rows persist to `products` with the review/active
  split.
- Discovery: `/api/discover` (and the `/procurement/discover-test` page) →
  real catalog → real OpenAI ranking → A-material redirect on blocked terms.

**What's still missing for the full demo:**

- **Foreman UI** (slice A — Phases 2/3): exists on the `dev-a` branch, **not
  yet merged** to `main`.
- **Procurement approval queue** (slice B — Phases 4/5): `dev-b` branch is
  empty / not built.
- No Vercel deployment yet — everything runs locally via `npm run dev`.

Everything below describes how we got here and the team workflow.

## What "Step 0" got us

Step 0 is the foundation commit that **Dev A** (cescod24) landed on `main`
before the three-way parallel work begins. After Step 0 the repo has:

- A working Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui scaffold —
  `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint` all
  pass.
- A role-switcher landing at `/` (server actions, cookie-based; see
  `app/page.tsx` and `lib/role.ts`). Placeholder pages at `/foreman` and
  `/procurement/queue` route there from the picker.
- The complete database schema: `supabase/migrations/0001_init.sql`. Every
  table from `plan.md` §"Data model" with CHECK constraints, indexes, and
  RLS policies written as if Supabase Auth were live. The demo bypasses RLS
  via the service-role key.
- Typed stubs for every shared module the team will import on day one:
  - `lib/ai.ts` — wrapped OpenAI client with timeout + canned-fallback
    plumbing (the real prompts land per-phase)
  - `lib/rules.ts` — pure `decide(total, items, rules)` (the implementation
    is the three branches from plan.md §Phase 4; usable today)
  - `lib/schema.ts` — Zod schemas for ingestion, discovery, and order
    submission
  - `lib/role.ts` — `x-demo-user` cookie helpers
  - `lib/supabase/{server,browser}.ts` — service-role / anon clients
  - `lib/constants/{categories,chips,copy.de,copy.en,blocklist}.ts` —
    typed maps; the A-material blocklist is fully populated, the rest are
    intentionally empty for the phase owners to fill
- The CSV and clean ACME PDF moved into `data/`. The reference Swiss
  Angebot PDF stays at repo root (shape reference only, not ingested).
- All `Lovable.dev` references removed from the PRD and `CLAUDE.md`. The
  stack decision is now: custom Next.js + Vercel + Supabase Cloud.

## What Step 0 deliberately did NOT do

- The Phase 1 **seed script** (`scripts/seed.ts`) was a stub at Step 0.
  **Since done by slice C and run against the live DB** — see §Current state.
  (Ownership note: the two planning docs disagreed on who owned the seed;
  the team decided slice C's seed wins, and it's the one on `main`.)
- No `.env.local` is committed (it can't be — secrets). Each dev creates
  their own from `.env.example` using the values shared in the team chat.
- No real foreman or procurement UI — only placeholders so the role switcher
  has somewhere to land.
- No AI prompts in Step 0. The wrapper exists; phases 6 and 7 write the
  prompts (now landed on `main` — slice C).
- shadcn/ui is initialised but only the default `Button` is installed.
  Phases add components on demand via `npx shadcn@latest add <name>`.

## Three-way parallel work after Step 0

| Slice | Owner | Phases | Surface |
|-------|-------|--------|---------|
| **A — Foreman flow** | Dev A | Phase 2 (foreman home) → Phase 3 (status pills + Realtime) — _seed moved to slice C, already done_ | `app/foreman/**`, `app/orders/**`, Realtime client |
| **B — Procurement flow** | Dev B | Phase 4 (rules engine + `POST /api/orders`) → Phase 5 (queue, decide, mock comstruct) | `app/api/orders/**`, `app/procurement/**` |
| **C — Ingestion + discovery** | Dev C | Phase 6 (CSV/PDF ingest + review) → Phase 7 (task search + A-material redirect) | `app/api/ingest/**`, `app/api/discover/**`, `app/procurement/ingest/**`, `app/foreman/discover/**` |

Stretch (Phase 8 `/info` route, Phase 9 spend dashboard) is picked up by
whichever slice finishes first. Phase 10 (procurement kit editor) stays cut.

## Locked surfaces — change only with team agreement

If you touch any of these, message the other devs first:

- `supabase/migrations/0001_init.sql` — the schema is the most expensive
  thing to change because everyone is reading from it. Add a new migration
  rather than editing the first one.
- `lib/schema.ts` — Zod shapes for AI outputs and order submissions. The
  ingestion and discovery handlers parse against this; the foreman cart
  submits against this.
- `lib/rules.ts` — `decide()` signature is the contract between Phase 4
  (engine) and Phase 5 (queue).
- `lib/role.ts` — the `x-demo-user` cookie name and the three role strings
  are referenced everywhere; don't rename.
- `lib/constants/blocklist.ts` — applied at search AND at ingestion. Adding
  new substrings is fine; removing one needs a reason.

## Local setup (one-time per dev)

```bash
git pull
npm install
cp .env.example .env.local
# Paste the values from the team chat:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY   (server-only — never import into a client component)
#   OPENAI_API_KEY              (server-only — used via lib/ai.ts)
#   OPENAI_MODEL                (optional — defaults to gpt-4o-mini)

npm run dev    # http://localhost:3000
```

**You do NOT need to apply the migration or run the seed** — the shared
Supabase Cloud project is already migrated and seeded (see §Current state).
There is no local Docker Supabase; everyone develops against the same cloud
project, so the data is shared.

If you ever need to reset the shared catalog to a clean state (e.g. before a
demo), `npm run seed` is idempotent — it wipes and re-inserts. Don't run it
while a teammate is mid-demo. To apply a *new* migration, add a new file
under `supabase/migrations/` and paste it into the dashboard SQL editor (or
`npx supabase db push` if you've linked the project) — don't edit
`0001_init.sql`.

## Daily commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Re-seed full demo (⚠ wipes shared DB; catalog + ~20 seeded orders) | `npm run seed` |
| Clean slate (⚠ wipes shared DB; catalog + kits, **zero orders**) | `npm run seed:clean` |
| Add shadcn component | `npx shadcn@latest add <name>` |

## Phase ownership cheat-sheet

When you start a new chat:

1. Read this file.
2. Read `CLAUDE.md`.
3. Read the phase block in `plan.md` for the slice you own.
4. Skim `lib/schema.ts`, `lib/rules.ts`, and the relevant `lib/constants/*`
   stub so you know the shapes you're building against.
5. Branch off `main` (`git checkout -b slice-a/phase-2-home` or similar).
6. Tick checkboxes in `plan.md` as you go.
7. After each phase: typecheck + lint + build + commit + push + open a PR or
   merge into `main` per the team's agreed cadence.

## If something contradicts itself

`plan.md` wins over `SPEC.md`. `CLAUDE.md` wins over both for the immutable
rules (server-only keys, no AI-invented SKUs, A-material blocklist, plain
language). If you find a real contradiction, flag it in the team chat
before you change anything — the locked surfaces (above) need consensus.
