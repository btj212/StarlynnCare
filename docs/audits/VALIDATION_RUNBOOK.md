# Validation runbook (hardening pass)

Run these after deploy or against preview. All exit 0 = green.

## Prerequisites

- `DATABASE_URL` in `.env.local` (for DB sampling)
- Network access to target URL

## Live page gates

```bash
# JSON-LD + YMYL aggregateRating rule
python3 scripts/validate/jsonld_check.py --env production

# Internal links facility ↔ hub
python3 scripts/validate/internal_links_check.py --env production

# Title/meta length + claim safety
python3 scripts/validate/meta_check.py --env production

# Soft-404 (full sitemap crawl — slow)
python3 scripts/validate/soft404_report.py --env production

# Sitemap vs DB diff
python3 scripts/validate/sitemap_diff.py --env production
```

Preview:

```bash
python3 scripts/validate/jsonld_check.py --env preview --url https://YOUR-PREVIEW.vercel.app
```

## Offline / DB-only (no HTTP)

```bash
python3 scripts/validate/page_qa_source_scan.py
python3 scripts/validate/soft404_db_report.py
```

## Build gates (before commit)

```bash
npx tsc --noEmit
npm run build
npm run lint
```

## Workstream B

Skipped this pass — no unit test runner installed.
