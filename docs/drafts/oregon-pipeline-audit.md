# Oregon Pipeline Audit

**Date:** 2026-05-10  
**Auditor:** Cursor agent (read-only — no data or code was modified)  
**Scope:** What is live in the product vs. what is missing for Oregon facilities.

---

## 1. Pipeline Architecture Summary

Oregon data flows through four stages:

| Stage | Script | Input | Output |
|---|---|---|---|
| **Roster scrape** | `or_dhs_ltc_directory_scrape.py` | ltclicensing.oregon.gov Providers page | `.firecrawl/or-scrape/providers-*.csv` |
| **Directory ingest** | `or_dhs_ltc_directory_ingest.py --input providers.csv` | Providers CSV | `facilities` rows (publishable=false) |
| **Inspection scrape** | `or_dhs_ltc_inspections_scrape.py` | ltclicensing.oregon.gov Inspections + Violations exports | `inspections-*.csv`, `violations-*.csv` |
| **Bundle + ingest** | `or_ltc_to_bundle.py` → `or_inspections_ingest.py` | Inspections + violations CSVs | `inspections` + `deficiencies` rows |
| **Downstream parity** | `scripts/ingest_or.sh` | DB rows | Geocodes, `publishable=true`, AI content, photos |

The downstream parity script runs five substeps in order:
1. `geocode_facilities.py --state OR`
2. `recompute_publishable.py`
3. `summarize_inspections.py --state OR` → writes `inspections.narrative_summary`
4. `generate_content.py --state OR` → writes `facilities.content` (tour questions)
5. `fetch_streetview.py --state OR` → writes `facilities.photo_url`

OR-specific schema additions (migration `0017_or_directory_columns.sql`): `or_memory_care_endorsed`, `or_provider_id`, `or_facility_type`, `or_accepts_medicaid`, `or_status`.

---

## 2. Query Results

### 2a. Facility counts

| Query | Result |
|---|---|
| Total OR facilities | **250** |
| Publishable OR facilities | **244** |
| Non-publishable OR facilities | **6** |
| OR facilities with `content->>'summary'` | **0** — see note below |
| OR facilities with `content->>'tour_questions'` | **244 (100%)** |
| OR facilities with street view photo (`photo_url`) | **182 (74.6%)** |
| OR facilities geocoded (lat/lng not null) | **244 (100%)** |
| OR facilities with CMS star rating | **0** — not applicable (state-licensed, not CMS) |
| OR facilities with quality grade | **0** — no grading system for OR yet |

> **Note on `content->>'summary'` = 0:** The query in the audit spec tested for a key named `"summary"` that does not exist in the schema. `generate_content.py` writes `tour_questions`, `model`, and `generated_at` into `facilities.content` — not a `"summary"` key. This is consistent with CA (also 0 "summary" keys). The correct facility-level AI content is `tour_questions`, which has **100% coverage** for OR.

### 2b. Inspection counts

| Query | Result |
|---|---|
| OR inspections total | **10,218** |
| OR inspections with `narrative_summary` | **8,912 (87.2%)** |
| OR inspections with `raw_data->>'narrative'` populated | **8,912 (87.2%)** |

### 2c. Deficiencies

| Query | Result |
|---|---|
| OR deficiencies total | **8,919** |
| OR deficiencies with numeric severity score | **0 (0%)** |
| OR severe citations shown on hub (severity ≥ 3) | **0** |

> `state_severity_raw` for all OR deficiencies contains the **provider type** (`'RCF'` or `'ALF'`), not a severity classification. The violation CSV does not carry Class A/B/C codes — it has allegation type (e.g., "Neglect", "Physical Abuse"). The `infer_severity()` function in `or_inspections_ingest.py` would map "type a"/"type b" vocabulary, which does not appear in the OR data.

### 2d. OR inspections by year

| Year | Count |
|---|---|
| 2026 | 75 |
| 2025 | 1,050 |
| 2024 | 1,576 |
| 2023 | 1,502 |
| 2022 | 1,259 |
| 2021 | 570 |
| 2020 | 505 |
| 2019 | 523 |
| 2018 | 591 |
| 2017 | 616 |
| 2016 | 502 |
| 2015 | 353 |
| 2014 | 274 |
| 2013 | 233 |
| 2012 | 212 |
| 2011 | 188 |
| 2010 | 189 |

Coverage spans 2010–2026. Volume drops pre-2020 (pandemic dip in 2020-2021 is expected).

### 2e. Sample OR facility quality (5 random publishable)

All five sampled facilities showed the same profile:
- `summary`: MISSING (expected — key doesn't exist in schema)
- `tour_questions`: YES
- `photo_url`: YES (3/5) or MISSING (2/5) — consistent with 74.6% coverage
- Geocoded: YES (100%)
- Quality grade: NONE (expected — no OR grading system)
- Inspection count per facility: ranged 10–162

---

## 3. The 10,218 Figure

**Confirmed: this is the correct total OR inspection count.**

The stat shown on the OR hub page comes from `loadStateHubData()` in `src/lib/data/stateHub.ts`, which queries:

```sql
SELECT COUNT(*) FROM inspections
WHERE facility_id IN (all publishable OR facility IDs)
```

Our direct SQL JOIN produces the same number: **10,218**.

These break down as:
- **9,237 complaint inspections** (violations/abuse investigations)
- **981 standard inspections** (routine annual surveys)

The high complaint-to-standard ratio (9.4:1) reflects OR's data structure: the violations CSV generates a separate inspection record per report number, while standard surveys are lower frequency.

---

## 4. Gap Analysis

| Enrichment | Publishable Facilities | Count With | % Coverage | Status |
|---|---|---|---|---|
| Tour questions (AI) | 244 | 244 | **100%** | ✅ Complete |
| Geocoding | 244 | 244 | **100%** | ✅ Complete |
| Street view photo | 244 | 182 | **74.6%** | ⚠️ 62 missing |
| Facility summary (content->>'summary') | 244 | 0 | **0%** — schema gap, not pipeline gap | ⚠️ See note |
| Quality grade | 244 | 0 | **0%** | ❌ No grading system for OR |
| Inspection narrative_summary | 10,218 | 8,912 | **87.2%** | ⚠️ 1,306 missing |
| Deficiency severity score | 8,919 | 0 | **0%** | ❌ Data not in source |

### Non-publishable facilities (6)

All 6 non-publishable facilities have `or_facility_type = 'NF'` (Nursing Facility) or are RCF with 0 inspections. They have `or_memory_care_endorsed = true` in the DB but `publishable = false`. The OR bundle scrape filters to `ALF` and `RCF` provider types; NF records from the roster were imported but have no inspection data and did not pass the publishability check. These are correctly suppressed.

| Name | City | Type | Inspections |
|---|---|---|---|
| Lebanon Veterans Home | Lebanon | NF | 0 |
| Marquis Centennial Post Acute Rehab | Portland | NF | 0 |
| Marquis Autumn Hills Memory Care | Portland | NF | 0 |
| Marquis Oregon City Post Acute Rehab | Oregon City | NF | 0 |
| Oregon Veterans Home | The Dalles | NF | 0 |
| Crystal Terrace Memory Care | Klamath Falls | RCF | 0 |

---

## 5. Top 3 Pipeline Gaps

### Gap 1 — 62 publishable facilities missing street view photos (Priority: High)

**26% of publishable OR facilities have no photo.** All 62 missing facilities are geocoded (lat/lng present), so `fetch_streetview.py` can run immediately. This is the most impactful quick fix — photos appear on facility profile hero sections and in facility cards.

**Fix:** Re-run step 5 of the parity script:
```bash
PYTHONUNBUFFERED=1 python3 scrapers/fetch_streetview.py --state OR
```

The script is idempotent — it skips facilities that already have `photo_url`. Requires `GOOGLE_MAPS_API_KEY` in `.env.local`.

---

### Gap 2 — All OR deficiency severity scores are NULL (Priority: Medium)

**8,919 deficiencies, 0 with numeric severity.** This means:
- The OR hub shows **0 "severe citations"** (hub counts `severity >= 3`), making OR look cleaner than reality
- The `facility_snapshot` RPC grade is either meaningless or falls back to a degenerate case for all OR facilities
- Deficiency filtering by severity (e.g., "only high-severity findings") does not work for OR

**Root cause:** The OR violations CSV stores provider type (`RCF`/`ALF`) in the field the ingest maps to `state_severity_raw`, not a severity classification. The `infer_severity()` function in `or_inspections_ingest.py` would recognize "type a" / "type b" / "class a" vocabulary, but OR's allegation types are free-text descriptions ("Physical Abuse", "Neglect", "Financial Exploitation") that do not match any pattern.

**Fix options (in order of effort):**
1. **Manual mapping table** — add an OR-specific allegation→severity mapping in `or_inspections_ingest.py` (e.g., "Physical Abuse" → severity 4, "Neglect" → severity 3, etc.)
2. **Re-run ingest with updated mapping** — after updating `infer_severity()` or adding an OR-specific override, re-ingest the bundle (idempotent via `ON CONFLICT DO NOTHING`, but would need to UPDATE existing rows)
3. **Accept as-is with disclosure** — add a note to the OR hub methodology that severity grading is not available for Oregon state data

---

### Gap 3 — 1,306 inspections without `narrative_summary` (Priority: Low)

**12.8% of OR inspections have no AI narrative summary.** Breaking down:

| Category | Count | Reason |
|---|---|---|
| Standard inspections (routine surveys) | 981 | No deficiencies found — raw narrative is null/empty, nothing to summarize |
| Complaint inspections with empty content | 325 | OR violations records with null narrative (zero deficiency count) |

The 981 standard inspections are genuinely un-summarizable — they are routine visit records with no deficiency text. These will always show as "no findings" inspections.

The 325 empty complaint records are violations that were imported with 0 deficiencies — likely records where the allegation text was absent in the violations CSV at scrape time. They may populate if the CSV is re-scraped and re-bundled.

**Fix for the 325:** Re-scrape → re-bundle → re-ingest, then re-run `summarize_inspections.py --state OR`. The script is idempotent (only processes records where `narrative_summary IS NULL`).

```bash
# 1. Re-scrape latest
python3 scrapers/or_dhs_ltc_inspections_scrape.py

# 2. Rebuild bundle
python3 scrapers/or_ltc_to_bundle.py \
  --inspections .firecrawl/or-scrape/inspections-$(date +%Y-%m-%d).csv \
  --violations .firecrawl/or-scrape/violations-$(date +%Y-%m-%d).csv \
  --output .firecrawl/or-scrape/bundle.json

# 3. Re-ingest (ON CONFLICT DO NOTHING — safe to re-run)
python3 scrapers/or_inspections_ingest.py --import-json .firecrawl/or-scrape/bundle.json

# 4. Re-summarize (only processes null narrative_summary rows)
python3 scrapers/summarize_inspections.py --state OR
```

---

## 6. Recommended Action Order

| Priority | Action | Script / Command | Expected Impact |
|---|---|---|---|
| 1 | Fetch missing 62 photos | `fetch_streetview.py --state OR` | +62 photos; fills 26% gap |
| 2 | Design OR severity mapping | Edit `or_inspections_ingest.py` infer_severity() | Enables grade display for all 244 OR facilities |
| 3 | Re-scrape + re-ingest inspections | Full 4-step re-ingest above | May recover some of 325 empty complaint records |
| 4 | (Deferred) OR quality grading | Requires severity data first (Gap 2) | Enables A–F grade cards on OR profiles |

---

## 7. Data Accuracy Notes (YMYL)

- The **10,218** inspection count is accurate and matches the live hub stat.
- **No fabricated data** was identified. All OR facility profiles that are publishable have real inspection records joined through `or_provider_id`.
- The **0 severe citations** display on the OR hub is technically correct given the current schema but is misleading — Oregon does record substantiated abuse and neglect, which are de facto "severe" but not captured as such in the DB.
- The 6 non-publishable NF facilities are correctly suppressed (nursing homes are out of scope for the memory care product).
- The `or_memory_care_endorsed = true` flag is correctly set on all 244 publishable OR facilities, consistent with the hub's methodology (Memory Care Endorsement only).
