# StarlynnCare

Memory care quality transparency: primary-source CMS and state agency data, cited facility profiles, no paid placement.

## Stack

- **Next.js 16** (App Router) · **React 19** · **Tailwind CSS v4**
- **Supabase** (Postgres + RLS) — `@supabase/supabase-js` + `@supabase/ssr` (cookie-backed server client + middleware)
- **Vercel** · optional **Upstash Redis** for the waitlist API

Design tokens live in [`src/app/globals.css`](src/app/globals.css) (navy, teal, warm white, Playfair Display + Inter).

## Local development

```bash
npm install
cp .env.local.example .env.local
# Fill Supabase keys (and optional Upstash) — see docs/SUPABASE_MIGRATION.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

1. Create a Supabase project (region **US West** — same coast as the CA beachhead data).
2. Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), then [`supabase/migrations/0002_alameda_beachhead.sql`](supabase/migrations/0002_alameda_beachhead.sql), in the SQL Editor.
3. Copy keys into `.env.local`.
4. Verify: `npm run verify-schema`

Full steps: [`docs/SUPABASE_MIGRATION.md`](docs/SUPABASE_MIGRATION.md).

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Marketing home |
| `/[state]` | State hub — lists covered counties + cities |
| `/[state]/[city]` | Region (county or city) memory-care comparison; only `publishable = true` facilities |
| `/[state]/[city]/[facility]` | Facility profile — Federal (CMS) + State (CDSS) cards, explicit "not yet indexed" when data is pending |

State and region slugs are validated in [`src/lib/states.ts`](src/lib/states.ts) and [`src/lib/regions.ts`](src/lib/regions.ts). Current beachhead: **Alameda County, California** → `/california/alameda-county`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run verify-schema` | Check Supabase tables after migration |

## Data ingest (Sprint 2 — in flight)

Python scrapers live in [`scrapers/`](scrapers/). Add **`DATABASE_URL`** (Postgres URI from Supabase → Database → Connection string) to `.env.local`, then:

```bash
cd scrapers && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Pending scripts (waiting on Phase B approval — see [`docs/phase-b-ccld-recon.md`](docs/phase-b-ccld-recon.md)):

- `ccld_rcfe_ingest.py` — Alameda County RCFE roster from CDSS / CA Open Data
- Per-facility inspection scraper for CDSS transparency API reports

See [`scrapers/README.md`](scrapers/README.md).

## Next.js 16 notes

See [`docs/next16-routing-notes.md`](docs/next16-routing-notes.md).

## Legacy components

Earlier landing sections remain under [`src/components/`](src/components/) as reference; the live home page is implemented in [`src/app/page.tsx`](src/app/page.tsx) with new [`src/components/site/`](src/components/site/) chrome.
