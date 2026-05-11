# Thin Pages Audit

Generated: 2026-05-11

A "thin page" is a publishable facility with **fewer than 4 inspections in the rolling 3-year window** (`INSPECTION_DISPLAY_YEARS = 3`). These pages have limited content above the fold and now display an amber **"Limited Inspection History"** badge on the facility profile and a `· limited history` label in the city list.

---

## State-by-State Summary

| State | Publishable Facilities | Thin (<4 in 3yr) | Thin % |
|-------|------------------------|-------------------|--------|
| California | 484 | 88 | 18% |
| Minnesota | 552 | 412 | 75% |
| Oregon | 244 | 41 | 17% |
| Washington | 180 | 100 | 56% |
| **Total** | **1,460** | **641** | **44%** |

---

## Root Causes

### Minnesota (75% thin — 412 / 552)

MDH operates on a **≥24-month inspection cycle** for Assisted Living Facilities with Dementia Care. Most facilities were licensed after the 2021 ALF reform (MN Stat. § 144G) and have received only 1–2 formal inspections since licensure. The inspection cadence is structurally lower than CA's annual CDSS cycle.

**Mitigation:** MN inspections are still ingested as they occur. Thinness reflects regulatory reality, not a scraper gap. The `--publishable-only` flag on `fetch_mn_pdf_narratives.py` ensures narrative text is populated for the facilities we show.

### Washington (56% thin — 100 / 180)

The WA DSHS ALF portal only published inspection reports beginning in 2023 for many facilities. Older reports exist as image PDFs (scanned documents) and are not yet parsed. The `ocr_wa_image_pdfs.py` scraper targets the 21 image PDFs in `wa-skipped-pdfs/image_pdf/` to recover this history. Background WA photo backfill (`fetch_streetview.py --state WA`) and AI summary recovery (`summarize_inspections.py --state WA`) are also running to improve these pages.

**Mitigation:** Run `ocr_wa_image_pdfs.py` to add ~21 inspections from scanned PDFs. Placeholder PDFs (86 files) are blank cover pages — no content to recover.

### California (18% thin — 88 / 484)

CA CDSS operates on an annual inspection cycle. The 88 thin CA facilities are mostly:
- Recently licensed (opened 2024–2025)
- Small residential homes (≤6 beds) with less frequent state visits
- Facilities with complaints-only records (no routine surveys)

CA is in a healthy state. No bulk action needed.

### Oregon (17% thin — 41 / 244)

OR DHS publishes Memory Care Endorsed ALF and RCF inspections on a 12–24 month cycle. The 41 thin OR facilities are newer licensees or facilities that transitioned endorsement categories. OR is in a healthy state.

---

## Badge Implementation

As of the commit `feat: add limitedHistory badge`, facilities with `limitedHistory = true` now show:

- **Facility profile page (`FacilityHero`):** amber outlined badge below the address line:
  `Limited Inspection History · fewer than 4 records in 3 years`

- **City list card (`FacilityListClient`):** ochre inline label below the facility name:
  `· limited history`

The `limitedHistory` flag is computed in:
- `src/lib/facility/loadFacilityProfile.ts` (profile page — from the 3-year filtered `inspections` array)
- `src/app/[state]/[city]/page.tsx` (city hub — from `recentInspCountByFac` computed alongside the existing inspections query)

---

## Per-State CSV Files

- [`docs/thin-pages/ca.csv`](thin-pages/ca.csv) — 88 thin CA facilities
- [`docs/thin-pages/mn.csv`](thin-pages/mn.csv) — 412 thin MN facilities
- [`docs/thin-pages/or.csv`](thin-pages/or.csv) — 41 thin OR facilities
- [`docs/thin-pages/wa.csv`](thin-pages/wa.csv) — 100 thin WA facilities

Each CSV has columns: `slug, name, city, recent_3y, total_inspections`
