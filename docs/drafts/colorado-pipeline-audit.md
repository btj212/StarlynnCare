# Colorado Pipeline Audit

**Date:** 2026-10-31  
**Scope:** What has to be true before a Colorado home can appear on a public page. Assisted living and nursing homes are counted separately.

This is a Your Money or Your Life directory. A row is either stored as a normalized record or kept in a service-only quarantine with its original values. Nothing in this audit is a public memory-care claim.

---

## 1. Two care settings

| Setting | Regulator | Who is in the universe | How a finding is labeled |
|---|---|---|---|
| Assisted living residence | Colorado Department of Public Health and Environment (CDPHE), 6 CCR 1011-1 Chapter 7 | ArcGIS types SA1, SA2, and SA5 | Level A–E. E is immediate jeopardy. |
| Nursing home | Federal CMS Care Compare | CMS Provider Information, Colorado only | Federal F-tags and A–L scope/severity |

A nursing home is not ranked against an assisted living residence. A CDPHE letter is not a CMS scope/severity code, and an F-tag is not a CDPHE citation.

CMS row counts are filled in during the nursing-home phase of this same launch, after the assisted-living load is reconciled. They are not estimated here.

## 2. Assisted-living directory

Source: CDPHE ArcGIS FeatureServer `CDPHE_Health_Facilities`, item `3cecd02e39f34ad0a4ee50de13cd87f8`. Queried 2026-10-31. The feature attribute `Date_Data_Updated` on the sampled row is 2026-09-29. The public explanation of this list is [Find and Compare Facilities](https://cdphe.colorado.gov/health-facilities/find-and-compare-facilities).

| Facility_Type_Code | Meaning | Rows |
|---|---|---|
| SA1 | Assisted living residence, licensed only | 358 |
| SA2 | Assisted living residence / alternative care facility | 285 |
| SA5 | Assisted living residence, brain-injury or supported living | 42 |
| **Total** | **Full assisted-living universe, before any memory-care filter** | **685** |

| Operating status | HFEMS field | Rows | Stored license status |
|---|---|---|---|
| Active | Licensed | 646 | `LICENSED` |
| Active | HCPF Certified | 24 | `CERTIFIED` |
| Pending | Licensed | 13 | `PENDING` |
| Pending | HCPF Certified | 2 | `PENDING` |

HCPF certification is a Medicaid label from the Department of Health Care Policy and Financing. It is stored in `co_hfems_status` and is not treated as a CDPHE license, so those homes stay in the database but cannot pass the publication gate.

Every one of the 685 rows has an address and coordinates. Twenty-seven rows, almost all SA5, report `Licensed_Beds_Total` of 0. Those are stored as unknown rather than as a claim that the home has zero beds. `Designation_Level` is empty. CDPHE does not publish a facility-level Secure Environment roster in this layer, so no page may say the state verified a memory-care unit unless a real state source is stored later.

The address city is only the starting city. The Census physical-city step owns `city` and `city_slug` after coordinates are present. A later directory refresh must not move a home to a new city or change its public slug.

## 3. Inspection snapshot

The complaint and citation files are a records request provided on 2026-05-18. They are not a feed CDPHE refreshes for us. Headers are on row 8, not row 1. The directory is the facility universe. A workbook facility that is not in the current 685 is quarantined, not turned into a home with no address.

| File | Rows | What a row is |
|---|---|---|
| Complaints | 3,547 | One complaint event |
| Surveys and citations | 12,802 | One citation line, or a sentinel comment, inside an event |

Complaint findings in the file: substantiated 1,942, unsubstantiated 1,444, blank 161. Complaint dates run from 2018-01-03 through 2036-05-15. **87 complaint rows are dated after 2026-05-18.** None of those event ids appear in the survey file. They stay in quarantine with the original date. The ingest does not repair them and does not copy their text onto a survey that happens to have a usable date.

Survey grouping is facility + event + regulation set. Grouping by inspection id is wrong, because one inspection id can contain more than one event. Inside a facility-and-event group there were no date conflicts and no type conflicts in the pre-ingest measurement.

About 2,831 survey groups have no inspection date. An exact facility-and-event match to a complaint start date on or before 2026-05-18 can date 535 of those groups. The complaint date is used only in that case. The remaining undated groups stay quarantined. A narrative is not mined for a date.

Citation codes `0000` and `9999` are comments, not deficiencies. Numeric codes are stored at four digits so `610` matches `0610`. Overflow columns are one sentence split by a character limit, so they are concatenated with nothing inserted between them. A real citation with no A–E letter keeps a blank severity. It is not given a default level.

| CDPHE letter | Stored severity | Meaning under Chapter 7 |
|---|---|---|
| A | 1 | Isolated, potential harm |
| B | 2 | Pattern, potential harm |
| C | 3 | Isolated, actual harm |
| D | 3 | Pattern, actual harm |
| E | 4, immediate jeopardy | Immediate jeopardy |
| Blank | null | The workbook did not rate it |

The workbook also has a numeric Scope column. In this file it is not a separate fact: every A is 1, every B is 2, every C is 3, every D is 1, and every E is 2. That number is not the federal isolated/pattern/widespread scale, so it is not stored as scope. Scope on a citation comes only from the Chapter 7 letter: A and C are isolated, B and D are a pattern, and E is immediate jeopardy without a separate scope word. A citation with no letter keeps a blank scope.

The letter is stored in `class` and `state_severity_raw`. It is not stored in `scope_severity_code`, because that column is the CMS A–L code on nursing-home rows and the letters do not mean the same thing.

## 4. Memory care

CDPHE's rules make dementia training mandatory for every assisted living residence. That is not a facility-level memory-care designation. Secure Environment under Chapter 7 Part 25 is optional and is not a separate license in this directory.

A home can be labeled as serving memory care only through the existing corroborated signals:

- The name says memory care, dementia, or Alzheimer.
- A verified curated chain list says so.
- Both the A Place for Mom listing and the Caring listing match.

Two independent directory matches can qualify a home. One directory, or a chain name by itself, stays `needs_review`. An ordinary assisted living residence with none of these signals is not memory care. It is not an "uncertain" home.

CMS nursing homes without a defensible dementia signal are the rows that stay `needs_review`, `serves_memory_care = false`, and `publishable = false`. "Uncertain" is an internal review state. It is not a public sentence saying the home offers memory care.

## 5. What must be true before public launch

- Every source row is normalized or quarantined, and a second run of the same files does not duplicate it.
- Assisted-living and nursing-home peer groups are separate.
- Physical city comes from the Census geocoder, and no city holds more than 30 percent of the publishable homes.
- Unpublished and uncertain homes can have private summaries and photos, but they are not routable, indexable, or listed.
- Colorado is registered in the state list early and added to covered-state discovery only after the data gates and the preview pass.
- Family State Watch and paid Facility Watch stay off. A directory-only refresh does not mean inspection coverage.

## 6. Database

Migration `0069_co_universe.sql` adds the Colorado facility columns, a partial unique key on `(state_code, external_id)` for Colorado, an inspection lookup on the Colorado event key, and `co_source_rows`. That ledger is service-only: row-level security is on, and the anon and authenticated roles are denied.

## 7. Assisted-living load, reconciled 2026-10-31

| Check | Result |
|---|---|
| ArcGIS rows written | 685 normalized, 0 quarantined |
| License status | 646 licensed, 24 HCPF-certified, 15 pending |
| Publishable assisted living homes | 0 so far. The publication gate has not run. |
| Homes whose name is an explicit memory-care signal | 23. None are marked as serving memory care yet. |
| Chain-name reviews | 28 homes are `needs_review`. A chain name is not a memory-care claim. |
| Unknown bed counts | 27, stored as unknown rather than zero |
| Complaint rows | 3,547 = 3,069 normalized + 87 future-dated + 391 not in the current directory |
| Survey rows | 12,802 = 8,008 normalized + 4,173 undated + 621 not in the current directory |
| Inspections | 4,548. A second run updated those 4,548 and inserted none. |
| Deficiencies | 4,579. None are the comment codes 0000 or 9999. None use a CMS scope/severity code. |
| Future inspection dates | 0 |
| Homes with a record in the May 18 snapshot | 575 of 685 |
| Level A | 280, severity 1, isolated |
| Level B | 1,675, severity 2, pattern |
| Level C | 92, severity 3, isolated |
| Level D | 22, severity 3, pattern |
| Level E | 54, severity 4, immediate jeopardy, no separate scope word |
| Letter missing | 2,456, severity and scope left blank |

## 8. Nursing-home load, reconciled 2026-10-31

Source files: CMS Provider Information `NH_ProviderInfo_Oct2026.csv` and Health Deficiencies `NH_HealthCitations_Oct2026.csv`. The provider file has no Alzheimer's, dementia, or memory-care column, so none of these homes is labeled as serving memory care.

| Check | Result |
|---|---|
| Colorado nursing homes | 210, each with its own CMS certification number |
| Merged into an assisted living residence | 0. Five homes share a name and street with an assisted living residence and were kept as separate nursing homes: Good Samaritan - Loveland Village, Casey's Pond Senior Living, Bear Creek Senior Living, Continuing Care at Wind Crest, and Coal Creek Post Acute & Assisted Living. |
| Publishable nursing homes at ingest | 0. Every nursing home started as `needs_review` with memory care off. |
| Assisted living rows given a CMS certification number | 0 |
| Deficiency rows | 5,249, on 1,040 surveys. A second run updates those surveys instead of inserting them again. |
| Facility-specific inspector narrative | None in this file. The text is the standard tag statement and is stored as the cited rule, not as an inspector finding. |
| Federal scope/severity | Kept on the A–L scale. E is potential harm, not Colorado immediate jeopardy. J, K, and L are immediate jeopardy (66, 13, and 9). |
| Tags | Stored as F584, not the file's zero-padded F0584. |

Assisted-living totals in section 7 do not include these homes.

## 9. Memory-care classification, reconciled 2026-10-31

Signals are the existing model. A home serves memory care only with an explicit memory or dementia name, a verified curated chain, or both A Place for Mom and Caring.com. One directory, or a chain name alone, stays in review and is not published. CDPHE does not have a facility-level Secure Environment roster, so no page says the state verified memory care.

| Check | Result |
|---|---|
| A Place for Mom listings matched | 175 of 220 |
| Caring.com listings matched | 98 of 119 |
| Publishable assisted living | 70, category `alf_memory_care` |
| Publishable nursing homes | 1, Garden Terrace Alzheimer's Center of Excellence in Aurora, category `snf_dementia_scu`. Its name is the signal. It is not ranked: a rank needs 10 homes in that care setting. |
| Licensed homes that serve memory care but have no inspection in 36 months | 14 assisted living residences. They stay unpublished. |
| HCPF-certified or pending homes published | 0 |
| Publishable homes missing a bed count | 0 |
| Largest publishable city | Denver, 6 of 71 (under the 30% city-collapse line) |
| Chain-only nursing homes | Brookdale Greenwood Village, Brookdale Skyline, and Good Samaritan Society Fort Collins Village stay unpublished |
| Census place rewrite | 115 cities changed, 738 unchanged, 42 rural points had no Census place and kept the directory city |
| Assisted-living summaries | 1,575 dated narratives. CMS tag text was not summarized. |
| Street View photos | 373 uploaded. 42 homes had no imagery. |
| Tour questions | 379 written. All 71 publishable homes have questions. 36 homes still in review failed the quality gate and were not given a question that the source could not support. |

Peer groups stay split. An assisted living rank uses other Colorado assisted living residences. The one nursing home is not compared with them.
