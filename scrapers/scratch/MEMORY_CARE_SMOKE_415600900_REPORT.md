# Memory care / §1569.627 smoke test — facility **415600900** (Abigail Complete Care, Inc)

**Date:** 2026-04-26  
**Facility:** Redwood City, San Mateo County — CKAN + CDSS public surfaces only.

## Executive summary

Across **CKAN roster**, **Transparency `Facility/any`**, **live `FacilityReports` HTML** (all fetchable indices), **Care Facility Search FacDetail shell HTML**, **our Postgres `inspections` / `deficiencies` text**, and **data.ca.gov package search**, there is **no machine-readable or scrape-stable CDSS signal** that this RCFE operates a distinct **memory care / dementia program** for product purposes.

The gap is **not** “we failed to find a published §1569.627 form row in CKAN” alone — the RCFE roster resource simply has **no** dementia/memory-care columns. **§87705 / §87706** do not appear in deficiency text or in fetched report HTML. **LIC9158** (dementia disclosure form) does not appear in stored inspection payloads; only **LIC9020** appears in regex extraction from `raw_data`.

**Recommendation (decision matrix):** `no_machine_readable_cdss_memory_signal_for_this_facility` — keep current CDSS-only classification; if marketing sites disagree, treat as a **separate, labeled** enrichment source (out of scope for this smoke test).

---

## P1 — CKAN full record (`resource_id` = RCFE roster)

- **URL:** `https://data.ca.gov/api/3/action/datastore_search` with `filters={"facility_number":415600900}`.
- **Result:** 1 record; **19 fields** (full schema returned by API).
- **Fields:** `_id`, `facility_type`, `facility_number`, `facility_name`, `licensee`, `facility_administrator`, `facility_telephone_number`, `facility_address`, `facility_city`, `facility_state`, `facility_zip`, `county_name`, `regional_office`, `facility_capacity`, `facility_status`, `license_first_date`, `closed_date`, `file_date`.
- **Verdict:** No program-type, dementia, memory-care, waiver, or §1569.627 disclosure columns. **Not a parsing miss** — the open dataset does not encode that dimension.

---

## P2 — Transparency API `Facility/any` (statewide JSON)

- **URL:** `https://www.ccld.dss.ca.gov/transparencyapi/api/Facility/any`
- **Result:** `array_len` ≈ 24,258. **Zero** rows with `FacilityType` containing `RESIDENTIAL`, `ELDERLY`, or `RCFE` (100% childcare center types in the sample: day care, infant center, school-age, etc.).
- **Lookup `415600900`:** **not present** — expected because this dump does not include RCFEs.
- **Verdict:** `Facility/any` is **unsuitable as an RCFE “last visit” or program-type source** until CDSS publishes a dump that includes elder care facilities. Ingest currently reads `LastVisitDate` from this object when a key exists ([`ccld_rcfe_ingest.py`](../ccld_rcfe_ingest.py)); for typical RCFEs the lookup will **miss**.

**Note:** `/transparencyapi/api/Facility/415600900` returns the **same full array** (facility id in path is not a filter in practice).

---

## P2b — Transparency `FacilityReports` HTML (per-report)

- **Index URL:** `https://www.ccld.dss.ca.gov/transparencyapi/api/FacilityReports/415600900` → `COUNT`: 6.
- **Fetched:** `FacilityReports?facNum=415600900&inx=1` … `inx=5` — HTTP 200. **`inx=6`** returned **HTTP 400** at time of test (index lists a 6th “Other” report; HTML endpoint rejected).
- **Token scan (memory-care–relevant only):** no hits for `dementia`, `memory care`, `87705`, `87706`, `1569.627`, `1569.696`, `alzheimer`, `cognitive`, `lic9158`, `special care` on any successful HTML pull.
- **Incidental:** `hospice waiver` appears in **inx=3** (2023-02-24 inspection) HTML only — not evidence of a dementia care **unit** / §87705 program.
- **Cross-check:** Live HTML for **2024-05-03** (`inx=4`) did **not** contain the substring `hospice` at test time, while our DB `raw_data->narrative` for that date **does** contain “Hospice waiver for 12 residents…”. Treat as **versioning / extraction / source drift** worth a separate ticket; it does not change the memory-care conclusion.

---

## P3 — CDSS Care Facility Search FacDetail (initial HTML)

- **URL:** `https://www.ccld.dss.ca.gov/carefacilitysearch/?rewrite=FacDetail&facNum=415600900`
- **Result:** ~9.6 KB — generic SPA shell (`<title>Social Services - Community Care Facility search</title>`). No facility-specific tokens in static HTML.
- **Verdict:** **No scrape-stable signal** without executing client-side JS or discovering the XHR/API the SPA uses.

---

## P4 — Our database: deficiencies + inspection text

- **Facility row:** `serves_memory_care = false`, `memory_care_disclosure_filed = false`.
- **Deficiencies:** combined `description` + `inspector_narrative` — **no** keyword hits for the memory-care token list (including `87705` / `87706`).
- **Inspections:** combined `raw_data::text` + `narrative_summary` — **only** `hospice waiver` hits; no dementia / memory / §1569.627 / §1569.696.

---

## P5 — LIC form references in stored `raw_data`

- Regex `LIC\s*(\d{4,5}[A-Z]?)` across all inspection `raw_data` for this facility: **`9020`** only.
- **Verdict:** No **LIC9158** (or similar) string in stored payloads for this probe.

---

## P6 — data.ca.gov sibling packages

- Ran CKAN `package_search` for queries including `community care licensing facilities` and dementia-related phrases.
- **Finding:** Primary hit remains **`community-care-licensing-facilities`** (RCFE roster + other resource types). No package in the result set is a dedicated **§1569.627 disclosure registry** or machine-readable **dementia-program** flag file keyed by `facility_number`.

---

## Re-run

```bash
cd /path/to/StarlynnCare
python3 scrapers/scratch/mc_disclosure_smoke.py
# optional:
python3 scrapers/scratch/mc_disclosure_smoke.py --fac-num 415600900 --skip-reports-html
```

Machine-readable output: [`MEMORY_CARE_SMOKE_REPORT.json`](./MEMORY_CARE_SMOKE_REPORT.json) (regenerated by the script).
