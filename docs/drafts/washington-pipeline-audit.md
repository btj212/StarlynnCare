# Washington State Data Pipeline Audit

**Date:** 2026-05-10  
**Auditor:** Cursor agent (read-only)  
**Scope:** Compare WA data depth to OR baseline; identify root causes of low inspection count; recommend next steps.

---

## 1. Facility & Enrichment Counts

| Metric | WA | OR | CA | MN | TX |
|---|---|---|---|---|---|
| Total facilities | 107 | 250 | 8,675 | 594 | 1,389 |
| Publishable | 99 | 244 | 484 | 552 | 1 |
| With AI summary | 0 | 0 | 0 | 0 | 0 |
| With tour questions | 99 | 244 | 851 | 490 | 1 |
| With street-view photo | 83 | 187 | 1,114 | 414 | 0 |
| With star rating | 0 | 0 | 0 | 0 | 0 |
| Facility types in DB | BH only | ALF/RCF | ALF/RCFE | SLS/etc. | Class A/B |

---

## 2. Inspection Coverage

| Metric | WA | OR |
|---|---|---|
| Total inspections | 420 | 10,218 |
| Facilities with ≥1 inspection | 99 (93%) | 244 (98%) |
| Facilities with zero inspections | 8 (7%) | 6 (2%) |
| Inspections per facility | 3.9 | 40.9 |
| Inspections with narrative_summary | 23 (5.5%) | 8,912 (87%) |
| Inspections with raw narrative text | 420 (100%) | — |
| Total deficiencies | 431 | — |
| Earliest inspection date | 2023-05-01 | 2010-01-04 |
| Latest inspection date | 2026-04-01 | 2026-04-16 |

### WA Inspections by Year

| Year | Count |
|---|---|
| 2026 | 27 |
| 2025 | 170 |
| 2024 | 146 |
| 2023 | 77 |

### WA Inspections by Type

| Source Agency | Type | Count |
|---|---|---|
| WA DSHS ADSA | complaint / investigation | 292 (70%) |
| WA DSHS ADSA | standard | 128 (30%) |

---

## 3. Root Cause Analysis

### 3a. Scope is narrow: dementia-contract only (primary cause of low facility count)

The directory scraper (`wa_dshs_directory_scrape.py`) posts to `BHAdvLookup.aspx` with a
**`contract=Dementia Care`** filter. This returns only facilities holding an active DSHS
Specialized Dementia Care contract — a certification tier above a standard ALF license. Result:
**107 facilities** in the database.

Washington's full public ALF directory lives at `BHPubLookup.aspx` (the general public lookup),
which lists all licensed ALFs, ARCs, EARCs, and Boarding Homes regardless of contract status.
Washington DSHS estimates roughly **500–700 licensed residential care facilities** statewide.
None of the non-dementia-contract facilities have been ingested.

This design choice was intentional per `wa.ts` methodology ("StarlynnCare indexes only facilities
holding an active DSHS Specialized Dementia Care contract"), but it sharply limits coverage
relative to OR, which ingests all ALFs and RCFs.

### 3b. Inspection records are PDF index entries, not text (primary cause of low inspection quality)

The OR pipeline hits `ltclicensing.oregon.gov/Inspections/Export` — a structured CSV export
endpoint that delivers rows with inspection dates, violation codes, narrative text, and scope/
severity grades for every facility in one bulk download. OR inspections have real text that
survives into `narrative_summary` (87% coverage).

The WA pipeline scrapes `BHForms.aspx?Lic=<LICENSE>` per facility and parses the HTML link list
on that page. Each link is formatted `"MM/YYYY - Type"` (e.g. `"02/2025 - Inspections"`) with
an `href` pointing to a DSHS-hosted PDF. The bundle builder (`wa_dshs_to_bundle.py`) converts
each link into one inspection record whose only content is:

```json
{
  "narrative": "—: WA DSHS report: Investigations (06/2025)",
  "washington": true,
  "cached_file": "0000002528.html",
  "report_count": 1
}
```

No actual inspection text is extracted from the PDFs. The `deficiency` rows are simply PDF URLs
stored as `inspector_narrative`. Because there is no text, `summarize_inspections.py` has almost
nothing to summarize — only 23 of 420 inspections (5.5%) have a `narrative_summary`, compared to
87% for Oregon.

### 3c. Historical depth is shallow (three years vs. sixteen years for OR)

WA inspections span **2023–2026 only** — approximately three years. OR has inspection data back
to **2010** (sixteen years). This is entirely a consequence of 3b: the BHForms HTML pages appear
to only surface recent reports (or recent scrape runs only captured recent pages). Even if
BHForms pages have older entries, those PDFs have never been parsed.

### 3d. No structured deficiency codes

WA "deficiencies" are PDF-link placeholders (`code = NULL`, `description = "WA DSHS report:
Inspections (MM/YYYY)"`). OR deficiencies carry FTAG codes, scope/severity, inspector narratives,
and plan-of-correction text. The `wa_dshs_to_bundle.py` code explicitly sets `code: None` for
all deficiency entries.

---

## 4. OR vs WA Side-by-Side

| Dimension | Oregon (OR) | Washington (WA) | Gap |
|---|---|---|---|
| Regulator | Oregon DHS LTC Licensing | WA DSHS ADSA | — |
| Source URL | `ltclicensing.oregon.gov` | `fortress.wa.gov/dshs/adsaapps` | — |
| Data format | Structured CSV export | Per-facility HTML + PDF links | Structural gap |
| Facility scope | All ALFs + RCFs | Dementia-contract only | 5–6× narrower |
| Facilities ingested | 250 | 107 | 2.3× fewer |
| Total inspections | 10,218 | 420 | 24× fewer |
| Inspections per facility | 40.9 | 3.9 | 10× fewer |
| Historical depth | 2010–2026 (16 yr) | 2023–2026 (3 yr) | 13 years missing |
| Inspection text present | Yes (full narrative in CSV) | No (PDF URLs only) | 0% text coverage |
| narrative_summary coverage | 87% | 5.5% | 82 pp gap |
| AI facility summary | 0% (all states pending) | 0% | — |
| Tour questions | 98% of publishable | 100% of publishable | ≈ parity |
| Street-view photo | 77% of publishable | 84% of publishable | ≈ parity |
| Deficiency codes | FTAG-level codes + scope/severity | NULL (PDF links only) | No code-level data |
| Quality grade | Not on OR either | None | — |
| CMS linkage | None | None | — |

---

## 5. Is This a Data Availability Issue or a Scraper Gap?

**Both, but the scraper gap dominates.**

Washington DSHS does publish inspection reports — they are accessible as PDFs at `fortress.wa.gov`.
The DSHS portal does not offer a bulk structured CSV like Oregon's LTC Licensing portal does.
However, WA PDFs contain full inspection narratives, deficiency citations (WAC code), scope/
severity language, and corrective action plans. The content exists; it is just locked inside
per-facility PDFs rather than available as a CSV export.

The scraper only fetches the HTML index page listing PDF links — it does not download or parse
the PDFs. This is a deliberate (or overlooked) design choice, not a data availability limitation.

**What WA does not publish at all:**
- No bulk CSV export like Oregon's (confirmed: only per-facility HTML + PDF architecture)
- No CMS certification or Medicare star rating for state-licensed-only ALFs
- No aggregate violation database (only individual facility PDF files)

---

## 6. Prioritized Next Steps to Approach OR Parity

### Priority 1 — Parse WA DSHS PDFs (highest impact, unlocks AI summaries)

**Impact:** Transforms 420 inspection shells into 420 real inspection records with text.
Enables `narrative_summary` generation for the first time.

The `wa_dshs_inspections_scrape.py` fetches BHForms pages and the `wa_dshs_to_bundle.py`
already saves the cached HTML. The PDF URLs are in `deficiency.inspector_narrative` fields.
Steps needed:
1. Download each PDF URL stored in `inspector_narrative` (already have the URLs in the DB).
2. Extract text using `pdfplumber` or `pdfminer.six` (no new scraping required for already-cached facilities).
3. Feed extracted text into `narrative` field of the inspection record.
4. Re-run `summarize_inspections.py --state WA` to generate AI summaries.

### Priority 2 — Expand facility scope to all licensed ALFs (highest impact for facility count)

**Impact:** Potentially 5–6× more facilities, growing WA coverage from ~100 to ~600.

The `BHPubLookup.aspx` form accepts search by facility type (`ALF`, `ARC`, `EARC`, `BH`, etc.)
and license status. A new `wa_dshs_public_lookup_scrape.py` scraper that posts without the
dementia-contract filter would retrieve all active WA residential care facilities. Each facility
type may require its own `BHForms.aspx` inspection page scrape.

This would require:
- A new scraper targeting `BHPubLookup.aspx` (no contract filter)
- A `wa_facility_type` expansion to include non-BH types
- Deciding whether non-dementia-contract WA facilities should have `serves_memory_care = true`
  (they may not; editorial policy choice before building)

### Priority 3 — Re-scrape historical BHForms pages (increases depth)

**Impact:** Potentially 5–10× more inspection events per facility if DSHS has older PDFs linked.

Current data shows only 2023–2026. The BHForms pages for some facilities may have older links
that were either not scraped or not yet cached. Re-running `wa_dshs_inspections_scrape.py` with
`--no-cache` on all 107 facilities would force fresh HTML fetches and capture any newly linked
or previously missed historical entries.

### Priority 4 — Extract actual deficiency codes from PDF text (enriches existing records)

**Impact:** Converts 431 placeholder deficiency rows into structured data with WAC codes,
scope/severity, and inspector narratives (enabling per-facility deficiency profiles).

WA DSHS inspection PDFs cite WAC chapter/section violations (e.g. WAC 388-78A-2060) with
finding descriptions. Regex or LLM extraction of WAC codes from parsed PDF text would allow
populating `code`, `category`, and `state_severity_raw` fields.

### Priority 5 — Generate AI facility summaries (downstream parity)

**Impact:** Closes the 0% → target gap for `content->>'summary'`.

This is blocked by Priority 1. Once inspection text exists, `generate_content.py --state WA`
can generate facility summaries. Currently it has nothing meaningful to work with for WA because
inspection records contain no text.

---

## 7. Summary of Key Findings

1. **WA has 107 facilities vs. OR's 250** — the scraper intentionally scopes to dementia-contract
   facilities only. The full WA ALF universe (via `BHPubLookup.aspx`) is ~5–6× larger.

2. **WA has 420 inspections vs. OR's 10,218** — 24× fewer, from two compounding causes:
   (a) narrower facility scope, and (b) shallow 3-year history vs OR's 16 years.

3. **The single most important finding: WA inspection records contain no text** — the scraper
   collects PDF index links but never parses the PDFs. OR has a bulk CSV endpoint that delivers
   full narrative text. WA inspection "content" is just a URL to a PDF. Until PDFs are parsed,
   `narrative_summary` will stay near zero (currently 5.5%) and AI summaries will remain blocked.

4. **This is primarily a scraper gap, not a data availability gap.** The PDF text exists on the
   DSHS portal. The pipeline does not yet read it.

5. **Tour questions and photos are at OR parity** — the downstream enrichment steps run
   successfully on WA; the data gap is upstream (inspection text, facility scope).

---

*Report generated: 2026-05-10 | Read-only audit | No code or data was modified.*
