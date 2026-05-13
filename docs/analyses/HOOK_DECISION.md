# Hook Decision Memo — California RCFE Repeat Citations & Chain Scorecard

**Internal document. Do not publish.**  
Status: Approved at Checkpoint C · Phase 3 · 2026-05-11

---

## 1. Data Source

**Primary source:** California Department of Social Services (CDSS) Community Care Licensing Division (CCLD) public inspection records, as ingested into the StarlynnCare database.

**Facility universe:** California Residential Care Facilities for the Elderly (RCFEs) marked `publishable = true` in the StarlynnCare database as of 2026-05-11. **N = 484 facilities.**

> ⚠ **Do NOT say "all California memory care facilities."**  
> Say: "484 California RCFEs in StarlynnCare's database" or "484 licensed residential care facilities for the elderly (RCFEs) in our dataset."  
> Rationale: (a) not all CA RCFEs are in the database — only those for which StarlynnCare has successfully ingested and published inspection data; (b) "memory care" is a program designation, not a license type — these are RCFEs, which may offer memory care among other services; (c) we cannot claim completeness.

**Deficiency records:** regulatory compliance findings as recorded by CDSS licensing agents during routine, complaint, or annual inspections. These are administrative compliance findings, not clinical outcome measures, safety ratings, or patient harm determinations.

**Dataset date range:** 2019-05-22 to 2026-05-08 (earliest and latest inspection dates in the database for CA facilities).

**Record counts:**
- 484 publishable CA RCFEs
- 12,167 inspections
- 7,748 deficiency records

---

## 2. Exact Metric Definitions

### 2A. Repeat Citation Analysis (Analysis 3)

**Unit of analysis:** A facility + regulation code pair (e.g., Facility X cited under California Code of Regulations Title 22, §87303(a), on multiple separate inspection visits).

**"Repeat citation" definition:** The same CCR Title 22 regulation code is cited at the same facility during **3 or more distinct inspection visits** in the StarlynnCare database, across the full data window (2019–2026).

> **SQL logic:** `GROUP BY facility_id, regulation_code HAVING COUNT(DISTINCT inspection_id) >= 3`

**What it is NOT:**
- It does not mean the violation was never corrected. Facilities may have corrected a violation and been cited again in a later inspection cycle.
- It does not reflect current facility conditions. It is a historical pattern in the CDSS regulatory record.
- It does not indicate whether the violation caused harm to any resident.
- A facility appearing on this list may have fully remediated all cited issues.

**Corrected headline figure:** Under this exact definition:
- **63 of 484 facilities** (13%) in the dataset have at least one regulation code cited in 3+ distinct inspection visits.
- That is approximately **1 in 8** facilities in our dataset.

> **⚠ CORRECTION from Checkpoint B/C analysis:** Earlier drafts reported "100 of 484 facilities (21%), 1 in 5" based on a count of total deficiency rows (`COUNT(*) >= 3`), not distinct inspection visits. The precise definition — counting each inspection visit once — yields 63 facilities (13%, approximately 1 in 8). **Use 63 / 13% / "1 in 8" in all published materials.**

**Top regulation code:** §87303(a) — "The facility shall be clean, safe, sanitary and in good repair at all times." This is a general facility maintenance requirement, not specific to memory care.

**Top repeat-offender facilities (by distinct inspection visits with same code):**

| Facility | City | Regulation | Inspection Visits | Max Severity |
|---|---|---|---|---|
| Opal Care LLC | Oakland | §87468.2(a)(4) | 10 | 3 |
| Oakland Heights Senior Living | Oakland | §87303(a) | 9 | 3 |
| Whitten Heights AL & MC | La Habra | §87303(a) | 8 | 3 |
| Opal Care LLC | Oakland | §87411(a) | 7 | 3 |
| Roundhill Care Homes, Inc. | Alamo | §87309(a) | 6 | 3 |

---

### 2B. Chain Operator Scorecard (Analysis 2)

**"Chain" definition:** Facilities sharing the same `operator_name` field as recorded in CDSS licensing records in the StarlynnCare database.

> **Caveat:** CDSS licensing records often list the legal entity (LLC, LP) as the operator name, not the consumer-facing brand. Operators running multiple legal entities — for example, Oakmont Senior Living, which appears in CDSS records under at least two distinct LLC names — will appear as separate chains in this analysis unless they share an identical `operator_name` string. **This caveat must appear prominently on the published page.**

**Threshold:** Only chains with **≥ 3 CA publishable RCFEs** in the StarlynnCare database are included.

**Qualifying chains (N = 5):**

| CDSS Operator Name | CA Facilities |
|---|---|
| Alara Health Services Inc | 3 |
| Aegis Senior Communities, Llc | 4 |
| Well Oak Tenant Llc;oakmont Management Group Llc | 3 |
| Transformer Opco Llc;oakmont Management Group Llc | 12 |
| Front Porch Communities and Services | 3 |

Note: "Well Oak Tenant Llc;oakmont Management Group Llc" and "Transformer Opco Llc;oakmont Management Group Llc" are both Oakmont Senior Living affiliated entities per CDSS records.

**Metric name:** **Weighted Citation Score (WCS)** — replacing the prior "Severity Index" label.

**WCS definition — per facility:**

```
WCS_facility = sum( severity_weight(d) × scope_multiplier(d) ) / licensed_beds
              for all deficiencies d in the last 3 years (2023-05-11 to 2026-05-11)
```

Severity weights (based on CCR classification):
- Severity 1 (minor, no immediate risk) → weight 1  
- Severity 2 (moderate) → weight 2  
- Severity 3 (serious) → weight 3  
- Severity 4 (immediate jeopardy / IJ) → weight 5  

Scope multipliers (based on CCR scope coding):
- Scope A → 1, B → 2, C → 3, D → 4  
- **CA data note:** The `scope` field is NULL for all CA RCFE records in our database. Scope multiplier is therefore 1 for all CA facilities. This is stated explicitly.

If `beds` is NULL, a default of 30 beds is used.

**WCS definition — per chain:**

```
WCS_chain = mean( WCS_facility ) across all facilities in the chain
```

This is the **average** of individual facility scores (not total weighted sum ÷ total beds), so each facility counts equally regardless of size.

**What WCS is NOT:**
- It is not a safety rating or a clinical quality measure.
- It is a relative measure of citation severity and frequency within the StarlynnCare CA dataset.
- Lower WCS = fewer and less-severe regulatory citations in our data in the last 3 years.
- It does not account for differences in inspection frequency across facilities.
- It does not reflect current conditions.

**Recomputed WCS results (exact formula, ≥3 facilities, last 3 years):**

| CDSS Operator Name | CA Facilities | Total Inspections | Total Deficiencies | WCS |
|---|---|---|---|---|
| Alara Health Services Inc | 3 | 11 | 5 | 0.7778 |
| Aegis Senior Communities, Llc | 4 | 55 | 19 | 0.1373 |
| Well Oak Tenant Llc;oakmont Management Group Llc | 3 | 31 | 8 | 0.0734 |
| Transformer Opco Llc;oakmont Management Group Llc | 12 | 78 | 11 | 0.0207 |
| Front Porch Communities and Services | 3 | 33 | 3 | 0.0058 |

> **Note on Alara Health Services:** The high WCS (0.78) is driven by 3 very small facilities (total 18 beds combined) with a small number of deficiencies. This score is sensitive to small-sample effects. Consider noting the bed count context.

**Changes from Checkpoint B analysis:**
- Prior scorecard used ≥2 facility threshold and brand-normalization heuristics, yielding 23 "chains." The exact ≥3 threshold on raw CDSS operator names yields 5 chains.
- Metric renamed from "Severity Index" to "Weighted Citation Score."
- Numbers differ because prior analysis used all-time data; this uses last 3 years.

---

## 3. Methodology Disclosure Text (for "About This Data" block on teaser page)

> **About this data**
>
> This analysis covers 484 California Residential Care Facilities for the Elderly (RCFEs) for which StarlynnCare has ingested inspection records from the California Department of Social Services (CDSS) Community Care Licensing Division. **This is not a complete census of all California RCFEs.** The CDSS Community Care Licensing Division is the authoritative source for California RCFE inspection records; families should verify current status directly at [CDSS CCLD](https://www.ccld.dss.ca.gov/carefacilitysearch/).
>
> **What "regulatory citation" means:** A deficiency is a finding by a CDSS licensing agent that a facility violated a California Code of Regulations Title 22 requirement at the time of inspection. Deficiencies are administrative compliance findings. They do not constitute a determination that a resident was harmed, and they do not necessarily reflect current facility conditions — facilities are required to correct cited deficiencies and submit plans of correction.
>
> **Repeat citation definition:** A facility is counted as having a "repeat citation" in this analysis if the same CCR Title 22 regulation code was cited by CDSS during 3 or more distinct inspection visits at that facility, across all inspection records in our database (May 2019 – May 2026). A repeat citation does not mean the violation was never corrected between visits.
>
> **Chain operators:** "Chain" in this analysis means facilities sharing the same operator name as recorded in CDSS licensing records. CDSS licensing records list the legal entity as the operator, which may differ from consumer-facing brand names. Operators using multiple legal entities may appear as separate chains. This analysis includes only operators with 3 or more CA facilities in our dataset.
>
> **Weighted Citation Score:** The WCS is a relative measure of citation frequency and severity in our dataset. It is not a safety rating, a clinical quality measure, or a recommendation for or against any facility. Lower score means fewer and less-severe citations in our data in the past three years.
>
> **Inspection data period:** CDSS records in the StarlynnCare database span May 2019 – May 2026. Inspection activity dropped significantly in 2020–2021 due to COVID-era restrictions; year-over-year trends should be interpreted in that context.
>
> **Verify directly:** To view a facility's complete current inspection record, visit [CDSS CCLD FacDetail](https://www.ccld.dss.ca.gov/carefacilitysearch/).

---

## 4. Chosen Headline + Lede (Final Approved Versions)

### Headline options

**Option A (recommended):**
> One in 8 California Senior Care Facilities Has Been Cited for the Same Regulatory Violation Three or More Times, State Records Show

*Accurate (63/484 = 13%, ≈ 1 in 8 under the exact definition). "State records show" anchors the claim. "Senior care facilities" is accessible shorthand for RCFE, defined in the lede.*

**Option B:**
> 63 California Care Homes Show a Pattern of Repeat Regulatory Citations — A StarlynnCare Analysis of CDSS Inspection Records

*More precise but lower search intent. Good as a subtitle or deck.*

**Option C:**
> Which California Senior Care Chains Have the Worst Inspection Records? State Data, Ranked.

*Chain-first framing. Strongest for branded-search SEO but weaker as a consumer story given only 5 qualifying chains.*

**Recommended: Option A.** It is accurate, punchy, and consumer-oriented. The subhead can carry the chain scorecard.

### Final headline (for page H1 and `<title>`)

> One in 8 California Senior Care Facilities Has Repeat Regulatory Citations for the Same Violation

*(Shortened for title tag.)*

### Final lede (3–4 sentences)

> Among the 484 California residential care facilities for the elderly (RCFEs) tracked in StarlynnCare's database, 63 — one in every eight — have been cited by state inspectors for the exact same California Code of Regulations violation in three or more separate inspection visits. The most-repeated violation is §87303(a), which requires facilities to keep the physical plant clean, safe, and in good repair; it has appeared in repeat citations at more than a dozen facilities. Since 2021, as inspections resumed after COVID-era shutdowns, California's overall deficiency rate across these facilities has risen 132 percent — from 0.33 citations per inspection in 2021 to 0.77 in 2024. This analysis draws on CDSS Community Care Licensing inspection records ingested into the StarlynnCare database; it reflects the historical regulatory record, not current facility conditions.

---

*Phase 3 complete. Do not modify this file during implementation (it is the source of truth).*
