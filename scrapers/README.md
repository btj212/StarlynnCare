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

## CDSS CCLD — California RCFE roster + live license status ← active

Sources (see `scrapers/_cdss_live.py` for the evidence and measurements):

1. **CDSS statewide RCFE file (primary)** — `ccld.dss.ca.gov/transparencyapi/api/DownloadStateData/ResidentialElderCareFacility`.
   One CSV, every RCFE CDSS lists, including CLOSED rows with `Closed Date`. On 2026-11-26: 13,354 rows,
   newest Last Visit 11/21/2026, newest Closed Date 11/20/2026.
2. **CDSS FacilityDetail (second view)** — `transparencyapi/api/FacilityDetail/{license}`. Confirms every change to or
   from CLOSED / ON PROBATION / REVOKED before it is written. Gives finer wording ("Closed, Change of Ownership").
3. **CHHS GIS layer (cloud-reachable fallback, presence only)** — `services.arcgis.com/.../CDSS_CCL_Facilities/FeatureServer/0`.
   Open facilities only; never writes a status.

**Retired:** the CHHS/CKAN roster (`744d1583`, frozen at file_date 05/25/2025) and data.ca.gov `6b2f5818`
(datastore inactive, 404). Every re-ingest from them reverted newer statuses.

**Rules:** existing rows are matched by license number; the ingest and the status refresh never change
`publishable` on an existing row; new licenses are inserted unpublished. Once a row has
`license_status_checked_at`, a status change needs a newer check (trigger from migration 0082).

**Where it runs:** CDSS refuses or times out from GitHub runners, so the daily Mac launchd job
(`com.starlynncare.ca-watch`, 6:15 local) runs `ca_status_refresh.py --apply` before the report scan
(`CA_STATUS_APPLY=0` to make it a dry run).

```bash
python scrapers/ca_status_refresh.py                     # dry run → data/ca_status_refresh/*.csv
python scrapers/ca_status_refresh.py --apply             # write status columns only
python scrapers/ccld_rcfe_ingest.py --county SACRAMENTO --dry-run
python scrapers/ccld_rcfe_ingest.py --statewide          # add new licenses (unpublished), refresh fields
```

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

## Oregon / Minnesota / Washington (memory-care roster + inspections)

Shared HTTP helpers: [`_http_helpers.py`](./_http_helpers.py) (User-Agent, CSRF, ASP.NET ViewState).

| State | Roster | Inspections bundle | Ingest | Publish gate |
|-------|--------|---------------------|--------|--------------|
| **OR** | `or_dhs_ltc_directory_scrape.py` → `or_dhs_ltc_directory_ingest.py` | `or_dhs_ltc_inspections_scrape.py` → `or_ltc_to_bundle.py` | `or_inspections_ingest.py` | `recompute_publishable.py --state OR` |
| **MN** | `mn_mdh_directory_scrape.py` → `mn_mdh_directory_ingest.py` | After MDH survey export exists: `mn_mdh_to_bundle.py` (wraps `tx_pia_to_bundle.py`) | `mn_inspections_ingest.py` | `recompute_publishable.py --state MN` |
| **WA** | `wa_dshs_directory_scrape.py` → `wa_dshs_directory_ingest.py` | `wa_dshs_inspections_scrape.py` → `wa_dshs_to_bundle.py` | `wa_inspections_ingest.py` | `recompute_publishable.py --state WA` |

Docs: [`docs/OR_DATA_SOURCES.md`](../docs/OR_DATA_SOURCES.md), [`docs/MN_DATA_SOURCES.md`](../docs/MN_DATA_SOURCES.md), [`docs/WA_DATA_SOURCES.md`](../docs/WA_DATA_SOURCES.md).

Migrations: `0017_or_directory_columns.sql`, `0018_mn_directory_columns.sql`, `0019_wa_directory_columns.sql`.

Routing: [`src/lib/states.ts`](../src/lib/states.ts) lists OR/MN/WA in `STATES` (not `COVERED_STATES` until publishable ≥ 1); [`src/lib/regions.ts`](../src/lib/regions.ts) seeds metro county regions for ingest city slugs.
