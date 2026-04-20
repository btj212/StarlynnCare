# Scrapers (Sprint 2+)

Python **3.11** recommended.

## Setup

```bash
cd scrapers
python3.11 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Environment

Add **`DATABASE_URL`** to the repo-root **`.env.local`** (same file Next.js uses):

- Supabase Dashboard → **Project Settings → Database** → copy the **URI** connection string.
- Prefer **direct connection** (port `5432`) with `?sslmode=require`.

## CDSS CCLD — Alameda County RCFE ingest ← active beachhead

Loads California Residential Care Facilities for the Elderly (RCFEs) in Alameda
County from two sources:

1. **CA Open Data CKAN** (roster, status, capacity) — resource `6b2f5818-f60d-40b5-bc2a-94f995f9f8b0`
2. **CDSS Transparency API** (last visit date) — `ccld.dss.ca.gov/transparencyapi`

```bash
python ccld_rcfe_ingest.py --dry-run         # CKAN fetch + classification, no DB
python ccld_rcfe_ingest.py --smoke           # 10-record DB smoke-test
python ccld_rcfe_ingest.py                   # Full Alameda ingest (~358 rows)
python ccld_rcfe_ingest.py --force-publish   # Mark all LICENSED publishable (testing)
python ccld_rcfe_ingest.py --refresh-cache   # Force re-download 30 MB Transparency dump
```

Expected outcome (live as of 2026-04-19):

| Status | Category | MC | Publishable | Count |
|---|---|---|---|---|
| LICENSED | rcfe_memory_care | ✓ | ✓ | 3 |
| LICENSED | rcfe_general | — | — | 216 |
| LICENSED | ccrc | — | — | 8 |
| CLOSED | various | — | — | 108 |
| PENDING | rcfe_general | — | — | 21 |

Memory-care identification uses Pass 1 (name regex). After Phase D runs the
CDSS citation scraper, §87705/§87706 citations will promote more facilities.
Only `publishable = true` facilities appear on the public site.

### Re-running

Re-runs are safe — the upsert key is `(state_code, city_slug, slug)`. CDSS
facility numbers are stable. The Transparency API JSON is cached for 24 hours
at `/tmp/ccld_facility_all_cache.json`.

## CMS Provider Information ingest (retired for beachhead)

`cms_ingest.py` ingested FL SNF data in Sprint 1. FL rows were deleted by
migration `0002_alameda_beachhead.sql`. Keep the script for CA SNF re-ingest
if we later need to enrich CCRC records with CMS star ratings.
