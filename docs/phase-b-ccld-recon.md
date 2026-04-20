# Phase B — CDSS CCLD Reconnaissance

**Status:** Awaiting Blake's approval before Phase C (scraper code) starts.

This document answers the five questions the Alameda plan requires before a
single line of scraper runs:

1. Where does the Alameda County RCFE roster live?
2. Where do per-facility inspection and citation records live?
3. What does one real record actually look like, end-to-end?
4. How do we map CDSS fields onto our schema?
5. What's the scrape risk?

---

## 1. Sources — two endpoints, both public, both no-auth

### A. Primary roster — CA Open Data (CKAN)

- **Dataset:** "Community Care Licensing Facilities — Residential Care Facilities for the Elderly"
- **CKAN resource ID:** `6b2f5818-f60d-40b5-bc2a-94f995f9f8b0`
- **Datastore API:** `https://data.ca.gov/api/3/action/datastore_search`
- **SQL API:** `https://data.ca.gov/api/3/action/datastore_search_sql`
- **Filter:** `county_name = "ALAMEDA"` (must be uppercase — lowercase returns 0 rows)
- **Freshness:** metadata_modified reports today's date (2026-04-19); CKAN keeps the mirror current even though the UI says "updated 5/28/25"
- **Mirror:** CHHS Open Data Portal carries the same dataset (resource `744d1583-f9eb-45b6-b0f8-b9a9dab936a6`) as a failover

Verified live pull (run today):

```bash
curl "https://data.ca.gov/api/3/action/datastore_search?resource_id=6b2f5818-f60d-40b5-bc2a-94f995f9f8b0&limit=1&filters=%7B%22county_name%22%3A%22ALAMEDA%22%7D"
```

### B. Inspections + enriched facility metrics — CDSS Transparency API

CDSS runs a separate Lotus Domino-backed portal at `ccld.dss.ca.gov/carefacilitysearch/` that exposes three endpoints I verified during recon. All three are public, no auth, no referrer check, no session tokens:

| Endpoint | Returns | Size / shape |
|---|---|---|
| `transparencyapi/api/FacilityReports/{facNum}` | JSON index of all inspection & complaint reports for one facility | ~3–10 KB, `{COUNT, REPORTARRAY: [{CONTROLNUMBER, REPORTDATE, REPORTTITLE, REPORTTYPE, REPORTPAGE}]}` |
| `transparencyapi/api/FacilityReports?facNum={facNum}&inx={1..N}` | HTML of one inspection or complaint report (Lotus-rendered) | 5–50 KB per report, parseable with BeautifulSoup |
| `transparencyapi/api/Facility/{anything}` | JSON statewide dump of all CCLD facilities with enriched metrics (LastVisitDate, InspectionVisits, ComplaintVisits, CitationNumbers, TypeA/B counts) | **30 MB** — the path param is ignored, it always returns every facility. We call this once per run and filter in-memory by FacilityNumber |

Note on facility number format: the CKAN dataset stores `facility_number` as an int (e.g. `15601302`). The transparencyapi requires the **zero-padded 9-digit string** (e.g. `015601302`). Pad at ingest.

---

## 2. Alameda County numbers, verified today

Pulled live from the CKAN SQL API:

```
Total Alameda RCFE records: 364
├── LICENSED:     231   ← only these are candidates for publishable
├── CLOSED:       111   ← ingest but never publish
├── PENDING:       21   ← pre-licensing; ingest but never publish
└── ON PROBATION:   1   ← publish with a prominent warning badge (later phase)

Facility type breakdown:
├── RESIDENTIAL CARE ELDERLY                   ← vanilla RCFE
└── RCFE-CONTINUING CARE RETIREMENT COMMUNITY  ← CCRC with ALF wing; some also have SNF
```

**Implication for Phase C:** the scrape target is ~231 active facilities, not 3000+. An entire cold-ingest run completes in under 15 minutes even with a 0.5s polite delay between requests.

---

## 3. One real sample record (Alameda County)

Pulled today from the live CKAN datastore — **ACACIA CREEK - UNION CITY**:

```json
{
  "_id": 1,
  "facility_type": "RCFE-CONTINUING CARE RETIREMENT COMMUNITY",
  "facility_number": 15601302,
  "facility_name": "ACACIA CREEK - UNION CITY",
  "licensee": "MASONIC HOMES CAL & ACACIA CREEK, MASONIC SEN LIV",
  "facility_administrator": "CHUCK MAJOR",
  "facility_telephone_number": "(510) 441-3700",
  "facility_address": "34400 MISSION BLVD.",
  "facility_city": "UNION CITY",
  "facility_state": "CA",
  "facility_zip": 94587,
  "county_name": "ALAMEDA",
  "regional_office": 15,
  "facility_capacity": 376,
  "facility_status": "LICENSED",
  "license_first_date": "5/20/2010",
  "closed_date": null,
  "file_date": 5252025
}
```

Pulled today from the transparency API for the same facility (`facNum=015601302`):

```json
{
  "COUNT": 13,
  "REPORTARRAY": [
    {
      "CONTROLNUMBER": "15-AS-20230621153006",
      "FACILITYNUMBER": "015601302",
      "REPORTDATE": "06/28/2023",
      "REPORTTITLE": "COMPLAINT INVESTIGATION REPORT",
      "REPORTTYPE": "Complaint",
      "REPORTPAGE": "http://www.fakeout.gov/WebReports/..."
    },
    {
      "CONTROLNUMBER": "",
      "FACILITYNUMBER": "015601302",
      "REPORTDATE": "04/14/2023",
      "REPORTTITLE": "FACILITY EVALUATION REPORT",
      "REPORTTYPE": "Inspection",
      "REPORTPAGE": "http://www.fakeout.gov/WebReports/..."
    }
    // ... 11 more
  ]
}
```

And the HTML report body (fetched via `inx=2`) opens with real structured data:

> **COMPLAINT INVESTIGATION REPORT**
> Facility Number: 015601302
> Report Date: 08/29/2023
> Date Signed: 08/29/2023 12:05:58 PM
> **Unsubstantiated**
> CCLD Regional Office, 1515 CLAY STREET, STE. 310, OAKLAND, CA 94612
> This is an official report of an unannounced visit/investigation of a complaint received in our office on 05/30/2023...

Parseable with BeautifulSoup using a handful of stable selectors (font color + bold label pattern repeats through the entire document).

The `REPORTPAGE` URLs use the placeholder host `fakeout.gov` — **ignore these**. The real HTML is served from the `transparencyapi/api/FacilityReports?facNum=X&inx=i` pattern, where `i` is 1..COUNT (in practice COUNT-1, as one report in the example index was not accessible via `inx`).

---

## 4. Field mapping (CDSS source → our schema)

### `facilities` table

| Our column | Source | Transform |
|---|---|---|
| `state_code` | (hardcoded) | `"CA"` |
| `name` | CKAN `facility_name` | Title-case from uppercase |
| `license_number` | CKAN `facility_number` | `str(n).zfill(9)` → 9-char string |
| `license_type` | CKAN `facility_type` | As-is: `"RESIDENTIAL CARE ELDERLY"` or `"RCFE-CONTINUING CARE RETIREMENT COMMUNITY"` |
| `street` | CKAN `facility_address` | Title-case |
| `city` | CKAN `facility_city` | Title-case |
| `zip` | CKAN `facility_zip` | Cast int → 5-char string |
| `city_slug` | derived | `slugify(city)`; **validate against the Alameda cities list in `src/lib/regions.ts`** — drop records whose city isn't in our beachhead scope |
| `slug` | derived | `slugify(name) + "-" + license_number[-6:]` |
| `beds` | CKAN `facility_capacity` | int |
| `facility_type` | (hardcoded) | `"rcfe"` |
| `certification_type` | (hardcoded) | `"state"` |
| `operator_name` | CKAN `licensee` | Title-case |
| `management_company` | CKAN `facility_administrator` | Title-case (often same as licensee) |
| `ownership_type` | — | Not in CDSS data → leave null |
| `phone` | CKAN `facility_telephone_number` | As-is |
| `website` | — | Not in CDSS data → leave null |
| `cms_star_rating` | — | Only for CCRCs with SNF wing, populated later by `cms_ingest.py` rerun scoped to CA |
| `last_inspection_date` | TRANSPARENCY `LastVisitDate` | Parse `M/D/YYYY` |
| `source_url` | derived | `https://www.ccld.dss.ca.gov/carefacilitysearch/?rewrite=FacDetail&facNum={facNum}` |
| `care_category` | derived | See "Memory-care identification" below |
| `serves_memory_care` | derived | `true` iff `care_category == "rcfe_memory_care"` |
| `memory_care_designation` | derived | Human-readable tag explaining the source of the memory-care flag |
| `license_status` | CKAN `facility_status` | As-is: `LICENSED` / `CLOSED` / `PENDING` / `ON PROBATION` |
| `license_expiration` | — | RCFE licenses do not have an expiration in CA's sense (annual renewal). Leave null. |
| `publishable` | derived | `license_status == "LICENSED" AND serves_memory_care AND manually_reviewed` |

### `inspections` + `deficiencies` tables (Phase D)

| Inspection row | Source |
|---|---|
| `inspection_date` | TRANSPARENCY `REPORTDATE` (parse `MM/DD/YYYY`) |
| `inspection_type` | `"complaint"` if `REPORTTYPE=="Complaint"`, else `"standard"` |
| `is_complaint` | `REPORTTYPE == "Complaint"` |
| `complaint_id` | `CONTROLNUMBER` (non-empty for complaints; empty for evaluations) |
| `source_url` | `https://www.ccld.dss.ca.gov/transparencyapi/api/FacilityReports?facNum={facNum}&inx={i}` |
| `source_agency` | `"California CDSS / Community Care Licensing Division"` |
| `raw_data` | `{"index_json": REPORTARRAY_entry, "html": report_html}` |

Deficiencies are parsed out of the HTML body and mapped as:

- `class` ← "Type A" / "Type B" (CDSS primary classification — A = serious, B = non-serious)
- `severity` ← Type A → 3, Type B → 1 (our 1–4 scale, keeps compatibility with future CMS data)
- `immediate_jeopardy` ← true if Type A **and** the narrative contains "immediate danger" / "health and safety" phrasing
- `description` ← the regulation text (usually `§87xxx`)
- `inspector_narrative` ← the full narrative block
- `plan_of_correction` ← the facility's written response block
- `cited_date` ← report date

### Memory-care identification (the hard part)

CDSS does **not** publish a structured "dementia care" flag. Title 22 §87706 requires any RCFE that advertises dementia care to file a specialized plan of operation, but that document lives in paper files at the regional office — not in either API.

Phase C uses a two-pass identification:

**Pass 1 (automated) — name pattern:**
```regex
\b(memory|dementia|alzheimer|cognitive|reminiscence|legacy|silverado)\b
```
...applied to both `facility_name` and `licensee`. Matches flip `care_category = "rcfe_memory_care"` and `memory_care_designation = "Name indicates dementia/memory-care program"`.

**Pass 2 (automated, Phase D) — citation scan:**
Once inspection HTML is ingested, scan for `§87705` (dementia care requirements) or `§87706` (dementia advertising) citations. Any facility with such a citation gets `memory_care_designation = "Cited under §87705/§87706 — confirmed dementia program"`.

**Pass 3 (manual, pre-launch) — Blake review:**
The ~50–80 facilities that make it through passes 1+2 get hand-reviewed. Because you live in Alameda County, you can visit or call the top 20 to ground-truth. Only manually-reviewed facilities flip `publishable = true`.

This is the "moat" the validation doc called out: commission-driven competitors use whatever marketing a facility self-reports. StarlynnCare publishes only verified memory-care facilities — the verification itself is the product.

---

## 5. Scrape-risk estimate

| Concern | Status | Notes |
|---|---|---|
| Auth required | **No** | Both endpoints are fully public |
| Rate limiting observed | **No** | Hit CKAN and transparencyapi ~20 times during recon with no throttling. Will still add a 0.5s delay between transparencyapi calls out of courtesy |
| JavaScript rendering | **Not needed** | CKAN is JSON; transparencyapi/FacilityReports/{facNum} is JSON; per-report HTML is static Lotus Domino output |
| Captcha / bot detection | **None observed** | Clean `Mozilla/5.0` UA works |
| Session tokens / cookies | **None** | Stateless HTTPS |
| HTML stability | **High** | Lotus Domino generates the same template every time; selectors will be stable across reports |
| Data freshness | **Good** | CKAN is updated roughly weekly (I saw today's `metadata_modified`); transparencyapi reflects inspections within days of the visit |
| Legal / robots | **Low risk** | CDSS explicitly markets this as a "transparency" portal; the data is compelled by the Department to be public under H&S Code §1569 |
| Licensing on the open data | **CC-BY equivalent** | California Open Data is under the state's "Public Domain / Open Data" terms — no restriction on commercial use with attribution |
| Volume | **Trivial** | 231 live Alameda RCFEs × avg 5 reports each = ~1,150 HTML fetches. Full cold ingest in under 15 minutes with polite pacing |

**Overall:** the CDSS CCLD surface is one of the more cooperative state regulator data sources in the US. No Playwright needed, no proxy pool needed, no OCR pipeline (reports are already HTML).

---

## 6. Decisions requested from Blake

Before I write `scrapers/ccld_rcfe_ingest.py`, please confirm:

1. **Ingest scope — all 364 Alameda rows, or only the 231 LICENSED ones?**
   Recommendation: ingest **all 364** (so we can detect status changes over time), but only mark `publishable = true` for LICENSED facilities that pass memory-care verification.

2. **Memory-care name regex — the list above look right?**
   Candidate words: `memory, dementia, alzheimer, cognitive, reminiscence, legacy, silverado`. Add any you know of, or subtract ones you think will false-positive.

3. **Zero-padding facility_number — store 9-char string in `license_number`?**
   Yes / no. I'm recommending yes because it's what the transparency API requires. The CKAN int form is lossy (`015601302` → `15601302` loses the leading zero).

4. **CCRC handling — `care_category = "ccrc"` vs `"rcfe_memory_care"`?**
   Some CCRCs (like Acacia Creek) advertise memory care as one wing of their program. Recommendation: tag them `"ccrc"` in `care_category` and set `serves_memory_care = true` only if they pass the name/citation test; show a CCRC-specific badge on the facility page.

5. **City_slug normalization — drop facilities whose city isn't in the Alameda cities list?**
   The CKAN roster occasionally has `facility_city` values that don't exactly match our known Alameda cities (e.g. CDSS zip-coding errors putting a Fremont facility in "Newark"). Recommendation: accept anything where `county_name = "ALAMEDA"` and normalize to the closest known city, defaulting to a `city_slug = "unincorporated-alameda"` catch-all.

Once these five are green, I write the scraper.

---

## Appendix: what's explicitly out of scope for Phase B

- No scraper code has been written.
- No migrations have been run against the DB (Blake runs `0002_alameda_beachhead.sql` manually in Supabase SQL Editor before the ingest).
- No CMS data re-ingest for CA — that waits for Phase C to confirm CCRC facilities actually need it.
- No inspection/deficiency HTML parsing — that is Phase D, after we've validated the roster ingest works.
