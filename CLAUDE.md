# CLAUDE.md — Site Order (C-materials ordering app)

> This file is read at the start of every Claude Code session. Keep it lean.
> The full build plan lives in `SPEC.md` — read it before starting any phase.

## What we're building
A mobile-first web app that lets a construction foreman order low-value site
consumables (screws, gloves, tape, spray cans — "C-materials") in under a
minute, while procurement keeps control via spend thresholds and approvals.
Built on top of comstruct (a construction procurement data platform). Hackathon
MVP — favour a working end-to-end slice over breadth. Full context: `SPEC.md`.

## Tech stack (decided — do not substitute without asking)
- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database/Auth/Realtime:** Supabase (managed Postgres). Schema lives in
  `supabase/migrations/*.sql` as versioned SQL.
- **AI:** `@anthropic-ai/sdk`, model `claude-sonnet-4-5`. Used for contract-PDF
  extraction and task-based product search.
- **Charts:** Recharts. **CSV parsing:** PapaParse. **Validation:** Zod.

## Commands
- Install: `npm install`
- Dev server: `npm run dev` (http://localhost:3000)
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- DB migrations (local Supabase): `npx supabase db reset` then re-apply migrations
- Seed catalog: `npm run seed` (loads `data/sample.csv` into the products table)

## Immutable rules
- **NEVER call the Anthropic API or use the API key from client components.**
  All AI calls go through Next.js Route Handlers under `app/api/**` (server-side
  only). The key is read from `process.env.ANTHROPIC_API_KEY`. This is the single
  most important security rule in the project.
- **Never let the AI invent SKUs or prices.** Extraction is extract-or-null.
  Validate every AI JSON response with Zod before it touches the database; route
  low-confidence / null-price rows to a review state, not straight to the catalog.
- Secrets live in `.env.local` (gitignored). Never commit keys. Provide
  `.env.example` with placeholder names only.
- C-materials only. A-materials (concrete, steel) are out of scope and must be
  kept out of the catalog and the foreman flow by design.
- Use plain language in all user-facing copy ("everyday site items"), never the
  jargon "Class C materials". Foreman UI is for non-digital-natives: big tap
  targets, +/- steppers, no modal dialogs, minimal typing.

## Working style
- Work through `SPEC.md` phase by phase. After each phase: run lint + typecheck,
  confirm the app still builds, then summarise what changed and stop for review
  before the next phase.
- Track phase progress with `[ ]` / `[x]` checkboxes in `SPEC.md`.
- Ask before destructive actions (dropping tables, rewriting migrations,
  `git reset`). Commit at the end of each phase with a descriptive message.
- Prefer small, readable components. Don't add features not in `SPEC.md`.
