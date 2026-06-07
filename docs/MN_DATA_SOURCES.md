# Minnesota — data sources and ingest guide

## Regulator

- **Minnesota Department of Health (MDH)** — Health Facility / Assisted Living regulation under Minn. Stat. ch. 144G.
- **Minnesota DHS** — operates the Assisted Living Report Card (ALRC) at `alreportcard.dhs.mn.gov`.

## Facility taxonomy

- **Assisted Living with Dementia Care (ALDC)** — distinct 144G licensure pathway; ALRC License column shows "Approved for dementia care" or "New for dementia care".

---

## Phase A — Roster (COMPLETED via ALRC)

### Primary approach: DHS Assisted Living Report Card

The MDH bulk-download server (`mdhprovidercontent.web.health.state.mn.us`) periodically returns 503 errors. The DHS Assisted Living Report Card (`alreportcard.dhs.mn.gov`) provides a superset of facility data (name, city, county, capacity, license status, quality scores, and full addresses via embedded Google Maps markers).

**Run from any machine (no special DNS required):**

```bash
cd /path/to/StarlynnCare

# Step 1: Download ALDC roster from ALRC (scrapes ALRC search results + Excel + HTML)
python3 scrapers/mn_alrc_scrape.py
# Writes:
#   .firecrawl/mn-scrape/mn-alrc-YYYY-MM-DD.xlsx         (ALRC Excel with 2400+ ALFs)
#   .firecrawl/mn-scrape/mn-alrc-addresses-YYYY-MM-DD.json  (street addresses from map markers)
#   .firecrawl/mn-scrape/mn-alrc-facilities-YYYY-MM-DD.json (ALRC IDs + is_aldc flag)
#   .firecrawl/mn-scrape/mn-alrc-geo-YYYY-MM-DD.html     (raw HTML for debugging)

# Step 2: Ingest ALDC facilities into DB
python3 scrapers/mn_alrc_ingest.py \
  --xlsx .firecrawl/mn-scrape/mn-alrc-YYYY-MM-DD.xlsx \
  --addresses .firecrawl/mn-scrape/mn-alrc-addresses-YYYY-MM-DD.json \
  --facilities-json .firecrawl/mn-scrape/mn-alrc-facilities-YYYY-MM-DD.json
# Upserts ALDC facilities; sets mn_dementia_care_licensed=true, license_status=LICENSED/PENDING.
```

| Step | Script |
|------|--------|
| Download ALRC data | [`scrapers/mn_alrc_scrape.py`](../scrapers/mn_alrc_scrape.py) |
| Ingest ALDC facilities | [`scrapers/mn_alrc_ingest.py`](../scrapers/mn_alrc_ingest.py) |

**Current status (2026-05-08):**
- 594 ALDC facilities in DB (587 LICENSED, 7 PENDING)
- Addresses sourced from ALRC map markers (97% coverage)
- `mn_hfid` set to `ALRC:{id}` until MDH bulk download is available
- 0 publishable (awaiting MN inspections — Phase B)

### Alternative approach: MDH bulk extract (when server is up)

When `mdhprovidercontent.web.health.state.mn.us` is available, the MDH Excel extract provides HFID numbers for cross-referencing:

```bash
python3 scrapers/mn_mdh_directory_scrape.py
# Writes: .firecrawl/mn-scrape/facility-directory-YYYY-MM-DD.xlsx

python3 scrapers/mn_mdh_directory_ingest.py \
  --input .firecrawl/mn-scrape/facility-directory-YYYY-MM-DD.xlsx
# Updates mn_hfid from MDH HFID numbers; also sets mn_dementia_care_licensed.
```

**Schema:** [`supabase/migrations/0018_mn_directory_columns.sql`](../supabase/migrations/0018_mn_directory_columns.sql)

**Join key:** `HFID` → `facilities.license_number` (10-digit normalized) + `facilities.mn_hfid`

---

## Phase B — Inspections (pending implementation)

MN is **not yet in `COVERED_STATES`** — will be added after inspections produce ≥ 1 publishable ALDC facility.

**Publish gate** (`recompute_publishable.py --state MN`):
- `license_status = 'LICENSED'` ✓ (587 facilities ready)
- `mn_dementia_care_licensed = true` ✓ (all 594)
- Fresh inspection within 48 months ✗ **(blocking)**

### Finding the MDH inspection HTTP contract

MDH survey/complaint results are at:
- Survey results landing: `https://www.health.state.mn.us/facilities/regulation/homecare/consumers/surveyresults.html`
- Facility search: `https://www.health.state.mn.us/facilities/regulation/directory/providerselect.html`

To discover the API contract:
1. Open DevTools → Network while loading survey results for a known facility.
2. Document base URL, query keys, pagination, and rate limits.
3. Implement `scrapers/mn_mdh_inspections_scrape.py` with real fetch logic.
4. Build bundle: `scrapers/mn_mdh_to_bundle.py`
5. Ingest: `scrapers/mn_inspections_ingest.py --import-json .firecrawl/mn-scrape/bundle.json`
6. Recompute: `python3 scrapers/recompute_publishable.py --state MN`
7. Add `{ slug: "minnesota", code: "MN", name: "Minnesota" }` to `COVERED_STATES` in `src/lib/states.ts`

### ALRC quality scores as inspection proxy

The ALRC Excel includes star ratings (1–5 stars) for:
- Resident Quality of Life, Family Satisfaction, Resident Health, Safety, Staffing

These are not raw inspection records, but could be surfaced on facility pages as supplemental quality indicators. Consider adding `mn_alrc_rqol_stars`, `mn_alrc_safety_stars`, etc. columns if needed.

---

## Operational hygiene

- User-Agent + ≥1 s delay — [`scrapers/_http_helpers.py`](../scrapers/_http_helpers.py).
- Archive raw extracts under `.firecrawl/mn-scrape/`.
- ALRC Excel is updated regularly; re-run `mn_alrc_scrape.py` + `mn_alrc_ingest.py` monthly.
