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

## Database (Sprint 1)

1. Create a Supabase project (region **US East**).
2. Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in the SQL Editor.
3. Copy keys into `.env.local`.
4. Verify: `npm run verify-schema`

Full steps: [`docs/SUPABASE_MIGRATION.md`](docs/SUPABASE_MIGRATION.md).

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Marketing home (editorial, primary-source positioning) |
| `/florida` | Florida facility index (from `facilities` where `state_code = 'FL'`) |
| `/facility/[slug]` | Facility profile (Florida slug; expands to city in URL later if needed) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run verify-schema` | Check Supabase tables after migration |

## Next.js 16 notes

See [`docs/next16-routing-notes.md`](docs/next16-routing-notes.md).

## Legacy components

Earlier landing sections remain under [`src/components/`](src/components/) as reference; the live home page is implemented in [`src/app/page.tsx`](src/app/page.tsx) with new [`src/components/site/`](src/components/site/) chrome.
