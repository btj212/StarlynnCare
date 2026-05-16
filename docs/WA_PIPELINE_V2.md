# WA Pipeline V2 — Source of Truth

> **Replaces:** `docs/WA_DATA_SOURCES.md` (pre-May 2026 single-source approach)  
> **Status:** Active — all four waves implemented as of May 2026

---

## Architecture overview

```
geo["WA Geo Open Data (ArcGIS REST)"]
cms["CMS Provider Data (data.cms.gov)"]
afhAdv["AFHAdvLookup (dementia filter)"]
sdcpList["DSHS SDCP-ALF list"]
bhForms["BHForms.aspx (per-facility ALF PDFs)"]
afhForms["AFHForms.aspx (per-facility AFH PDFs)"]
prr["PRR pipeline (historical PDFs)"]

geo → universe[(facilities)]
cms → universe
afhAdv → signals[(memory-care signals)]
sdcpList → signals
signals → universe

bhForms → pdfs[(wa_pdf_inventory)]
afhForms → pdfs
cms → deficiencies[(deficiencies, inspections)]
prr → pdfs
pdfs → parser["wa_pdf_parse.py (pdfplumber + OCRmyPDF + Claude Haiku)"]
parser → deficiencies
```

---

## Sources & canonical roles

| Source | Script | Role | Facility types |
|--------|--------|------|----------------|
| WA Geo Open Data (ArcGIS REST) | `wa_geo_directory_ingest.py` | Universe (inventory) | AFH, ALF, ESF |
| CMS Provider Information API | `cms_nh_directory_ingest.py` | Universe (inventory) | NH (SNF) |
| DSHS SDCP-ALF list | `wa_signal_sdcp.py` | MC signal only | ALF |
| Memory Care cert list | `wa_signal_memory_care_cert.py` | MC signal only | ALF |
| AFHAdvLookup / BHAdvLookup | `wa_signal_dementia_specialty.py` | MC signal only | AFH, ALF |
| BHForms.aspx | `wa_pdf_download.py` (seeds inventory) | Inspection PDFs | ALF, ESF |
| AFHForms.aspx | `wa_afh_inspections_scrape.py` | Inspection PDFs | AFH |
| CMS Health Deficiencies API | `cms_nh_deficiencies_ingest.py` | Structured deficiencies | NH |
| PRR inbox | `prr_inbox_ingest.py` | Historical PDFs | All |

---

## Facility type matrix

| wa_facility_type | Beds | Inspector | Profile config | MC signal source |
|-----------------|------|-----------|----------------|-----------------|
| `ALF` | 7–200+ | DSHS RCS | `waProfileConfig` | SDCP, MC cert, dementia specialty |
| `AFH` | 2–6 | DSHS RCS | `waProfileConfig` | Dementia specialty (AFHAdvLookup) |
| `ESF` | varies | DSHS RCS | `waProfileConfig` | Manual review only |
| `NH` | 50–500 | CMS/Medicare | `waNhProfileConfig` | CMS star rating |
| `ARC`/`EARC` | varies | DSHS RCS | `waProfileConfig` | EARC-SDC contract |

AFHs set `wa_afh_residential_flag = true` → no street view, no exterior photo.

---

## Wave summary

### Wave 1 — Correctness (shipped May 2026)

**W1a — PDF parsing pipeline for existing ALFs:**
1. `wa_pdf_download.py` — walks `deficiencies.inspector_narrative` URLs, caches PDFs, seeds `wa_pdf_inventory`
2. `wa_pdf_parse.py` — triages digital vs scanned, OCRmyPDF for scans, Claude Haiku to normalize → deficiency JSON
3. `wa_pdf_backfill.py` — replaces placeholder deficiencies, rebuilds `raw_data.narrative`, optionally re-runs `summarize_inspections.py`

**W1b — CMS Nursing Home ingest:**
1. `cms_nh_directory_ingest.py` — ~225 WA NHs from CMS Provider Information API
2. `cms_nh_deficiencies_ingest.py` — F-tag deficiencies with scope/severity matrix

**W1c — Display:**
- `waNhProfileConfig` in `src/lib/states/WA/profileConfig.ts` — F-tag citation prefix, CMS severity labels
- `WaMcSignalBadges` component — cert / SDCP / specialty / CMS star rating badges
- `FacilityHero` wired to show WA MC signal badges

### Wave 2 — Universe expansion (shipped May 2026)

- `wa_geo_directory_ingest.py` — ArcGIS REST → AFH/ALF/ESF universe (replaces BHAdvLookup as universe source)
- `wa_signal_memory_care_cert.py` — writes `wa_memory_care_certified`
- `wa_signal_sdcp.py` — writes `wa_earc_sdc_contracted`
- `wa_signal_dementia_specialty.py` — writes `wa_dementia_specialty`
- `recompute_publishable.py` — `serves_memory_care` now ORs all three new WA signals

### Wave 3 — AFH + ESF (shipped May 2026)

- `wa_afh_directory_ingest.py` — Geo pull + `wa_afh_residential_flag = true`
- `wa_afh_inspections_scrape.py` — AFHForms.aspx PDF links → `wa_pdf_inventory`
- `wa_esf_ingest.py` — Geo pull + BHForms.aspx PDF links
- `FacilitySnapshot` — AFH residential privacy: no photo, no street view

### Wave 4 — PRR pipeline (background, ongoing)

- `prr_request_builder.py` — generates DSHS PRR letter + `prr_requests` row
- `prr_inbox_ingest.py` — watches `prr-imports/{prr_id}/` and routes through parse pipeline
- `/admin/prr-queue` — admin page showing pending/in-flight/fulfilled + coverage gaps

---

## Database additions (migration 0029_wa_universe.sql)

### facilities — new columns
| Column | Type | Description |
|--------|------|-------------|
| `wa_memory_care_certified` | boolean | Memory Care unit certification |
| `wa_earc_sdc_contracted` | boolean | EARC-SDC / SDCP contract |
| `wa_dementia_specialty` | boolean | Training-based dementia specialty |
| `cms_ccn` | text | CMS Certification Number (SNFs) |
| `cms_overall_rating` | smallint | Medicare 1–5 star rating |
| `geo_archived_at` | date | WA Geo GDLArchiveDate (null = active) |
| `wa_afh_residential_flag` | boolean | 2–6 bed residential home → privacy treatment |

### New tables
- `wa_pdf_inventory` — one row per PDF link; tracks download, parse, backfill state
- `prr_requests` — manual PRR tracking queue

---

## Run order (fresh WA ingest)

```bash
# 1. Universe
python3 scrapers/wa_geo_directory_ingest.py
python3 scrapers/cms_nh_directory_ingest.py --state WA

# 2. MC signals
python3 scrapers/wa_signal_sdcp.py
python3 scrapers/wa_signal_dementia_specialty.py
# wa_signal_memory_care_cert.py requires a CSV from DSHS or PRR

# 3. Publishable recompute
python3 scrapers/recompute_publishable.py --state WA

# 4. Inspection data
python3 scrapers/cms_nh_deficiencies_ingest.py --state WA  # NHs: structured, done
python3 scrapers/wa_pdf_download.py                         # ALFs/AFHs: download PDFs
python3 scrapers/wa_pdf_parse.py                            # Parse with Claude Haiku
python3 scrapers/wa_pdf_backfill.py --rescore               # Backfill + re-summarize

# 5. AFH + ESF
python3 scrapers/wa_afh_directory_ingest.py
python3 scrapers/wa_afh_inspections_scrape.py
python3 scrapers/wa_esf_ingest.py
# Then run wa_pdf_download/parse/backfill again to pick up AFH/ESF PDFs

# 6. has_inspection_text recompute
python3 scrapers/recompute_publishable.py --state WA  # step5 sets has_inspection_text
```

---

## Hard constraints

- **Rate limit** `fortress.wa.gov`: 1 req/sec + jitter. ASP.NET app — easy to overwhelm.
- **HCLA reorg through summer 2026.** Anchor scrapers on `fortress.wa.gov` (stable); `dshs.wa.gov` URLs are migrating. Make redirect-tolerant.
- **License-number formats vary** by facility type. Always use `pad_wa_license()` for ALF/AFH/ESF; use bare `cms_ccn` (no padding) for NHs.
- **3-year cutoff is silent.** Public lookups omit older records. PRR pipeline fills historical depth.
- **Join on (state_code, license_number) only.** Never on name.
- **CMS data updated monthly** — refresh NHs weekly is cheap.

---

## Out of scope

- DOH-regulated hospitals/hospices/home-health
- CCRC-level inspections (ingest their ALF/NH sub-units instead)
- Local fire marshal records
- Adult Family Home Council industry data

---

## Related files

- `docs/NEW_STATE_PLAYBOOK.md` — updated to reflect multi-source pattern (CMS works for all states)
- `supabase/migrations/0029_wa_universe.sql` — schema additions
- `.cursor/plans/wa_data_capture_reset_3daffdd2.plan.md` — original plan (do not edit)
