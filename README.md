# StarlynnCare

Memory care quality transparency: primary-source state regulator and CMS inspection data, cited facility profiles, no paid placement. Families use it to compare memory care homes for a parent, so a wrong fact is worse than a missing one (see the data-accuracy rules in [`CLAUDE.md`](CLAUDE.md)).

Covered states (11): California, Oregon, Washington, Minnesota, Utah, Illinois, Pennsylvania, Arizona, Missouri, Texas, Colorado. Texas and Colorado are pilots with a small published set. The list lives in [`src/lib/states.ts`](src/lib/states.ts).

## Stack

- **Next.js 16** (App Router) · **React 19** · **Tailwind CSS v4**
- **Supabase** (Postgres + RLS) — `@supabase/supabase-js` + `@supabase/ssr`
- **Clerk** (admin sign-in) · **Stripe** (existing Facility Watch subscribers) · **Loops** (email) · optional **Upstash Redis**
- **Vercel** — `main` deploys to production; pull requests get preview deploys
- Python scrapers and validators in [`scrapers/`](scrapers/) and [`scripts/`](scripts/)

Design tokens live in [`src/app/globals.css`](src/app/globals.css). Fonts: **Instrument Serif** (display), **Inter Tight** (sans), **JetBrains Mono** (data and citations), loaded in [`src/app/layout.tsx`](src/app/layout.tsx).

## Local development

```bash
npm install
cp .env.local.example .env.local
# Fill the values you need — each variable is described in .env.local.example
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Never commit `.env.local`.

If `npm run lint` hangs on Node 24, see the ESLint entry in [`ERRORS.md`](ERRORS.md).

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run verify-schema` | Check Supabase tables against the expected schema |

There is no JavaScript test suite. Data checks are Python: see [`docs/VALIDATION.md`](docs/VALIDATION.md) and `.github/workflows/validate.yml`.

## Database

Schema changes are SQL files in [`supabase/migrations/`](supabase/migrations/), applied in order. Never edit or delete an applied migration; add a new one. The first steps are in [`docs/SUPABASE_MIGRATION.md`](docs/SUPABASE_MIGRATION.md).

## Routes

| Route | Purpose |
|-------|---------|
| `/` | National home |
| `/states` | All covered states |
| `/[state]` | State hub (shared template, per-state config) |
| `/[state]/facilities` | Browse every publishable facility in the state |
| `/[state]/[city]` | City or county hub; only `publishable = true` facilities |
| `/[state]/[city]/[facility]` | Facility profile: peer rank, inspection and citation record, source links |
| `/methodology` | How ranks are computed |
| `/data` | Dataset overview and per-state counts |
| `/library`, `/research` | Editorial guides and data analyses |
| `/shortlist`, `/watch` | Facility shortlist; Area and Facility Watch signup |
| `/api/facilities/[state]` | Public JSON for AI assistants and researchers |
| `/llms.txt` | AI crawler hints and governance statement |
| `/admin` | Review queues (signed-in admins only) |

State and region slugs are validated in [`src/lib/states.ts`](src/lib/states.ts) and [`src/lib/regions.ts`](src/lib/regions.ts).

## Architecture docs

- [`docs/STATE_HUB_ARCHITECTURE.md`](docs/STATE_HUB_ARCHITECTURE.md) — state hub template
- [`docs/FACILITY_PROFILE_ARCHITECTURE.md`](docs/FACILITY_PROFILE_ARCHITECTURE.md) — facility profile loader and sections
- [`docs/NEW_STATE_PLAYBOOK.md`](docs/NEW_STATE_PLAYBOOK.md) — checklist for adding a state, including the parity audit
- [`docs/SCRAPER_MODEL.md`](docs/SCRAPER_MODEL.md) — ingest doctrine
- [`docs/next16-routing-notes.md`](docs/next16-routing-notes.md) — Next.js 16 notes
- [`MEMORY.md`](MEMORY.md) and [`ERRORS.md`](ERRORS.md) — decision log and failure log

## SEO / GEO

- **Conventions (required for new pages):** [`docs/SEO_GEO_CONVENTIONS.md`](docs/SEO_GEO_CONVENTIONS.md) — canonical URLs, `JsonLd` + `schema.ts` builders, no fabricated ratings or geo.
- **Manual QA log:** [`docs/SEO_VALIDATION_LOG.md`](docs/SEO_VALIDATION_LOG.md).

## Data ingest

Python scrapers run per state. Set **`DATABASE_URL`** (Supabase → Database → Connection string) in `.env.local`, then:

```bash
cd scrapers && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Scheduled scans are GitHub Actions workflows in [`.github/workflows/`](.github/workflows/) (the Sunday state scan is `weekly-inspection-ingest.yml`). The California crawl runs from a Mac launchd job instead; see [`MEMORY.md`](MEMORY.md). Per-script notes are in [`scrapers/README.md`](scrapers/README.md).
