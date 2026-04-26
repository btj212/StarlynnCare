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

   **Caveat (verified 2026-04-26):** `GET …/transparencyapi/api/Facility/any` returns a
   **child-care–only** facility list (~24k rows) with **no RCFE / elderly** types.
   RCFE license numbers (e.g. `415600900`) do not appear there, so `LastVisitDate`
   from this endpoint is often **NULL** for RCFEs. See
   [`scratch/MEMORY_CARE_SMOKE_415600900_REPORT.md`](scratch/MEMORY_CARE_SMOKE_415600900_REPORT.md).

**Site SEO:** when the source provides coordinates, capacity, or license type, map them into `facilities.latitude`, `facilities.longitude`, `facilities.beds`, and `facilities.license_type` — facility pages emit JSON-LD `geo` / `additionalProperty` only from real columns (no invented values).

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

### Memory-care disclosure smoke test (read-only)

```bash
python scrapers/scratch/mc_disclosure_smoke.py --fac-num 415600900
```

Writes `scrapers/scratch/MEMORY_CARE_SMOKE_REPORT.json` and is documented in
[`scratch/MEMORY_CARE_SMOKE_415600900_REPORT.md`](scratch/MEMORY_CARE_SMOKE_415600900_REPORT.md).

### Re-running

Re-runs are safe — the upsert key is `(state_code, city_slug, slug)`. CDSS
facility numbers are stable. The Transparency API JSON is cached for 24 hours
at `/tmp/ccld_facility_all_cache.json`.

## CMS Provider Information ingest (retired for beachhead)

`cms_ingest.py` ingested FL SNF data in Sprint 1. FL rows were deleted by
migration `0002_alameda_beachhead.sql`. Keep the script for CA SNF re-ingest
if we later need to enrich CCRC records with CMS star ratings.
