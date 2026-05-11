# StarlynnCare Scraper & Signal Model

> Codifies the "pull broad, then filter" doctrine used in California and applied
> across all states as of May 2026.

---

## Core Principle: Pull Broad, Filter via Signals + Manual Review

**Never constrain scraping to what you think is memory care.** Pull the full licensed
universe for a state's Assisted Living tier, then apply tiered signal detection to
determine which facilities serve memory care residents and which should be published.

Benefits:
- Catches facilities that name themselves generically but specialise in dementia care
- Ensures new chain relationships or directory listings surface automatically
- Leaves a complete, auditable data layer for future premium or research features
- Avoids the Catch-22 of missing facilities because they weren't "obvious" at ingest time

---

## Pipeline Stages

```
1. Directory Scrape     — pull full licensed ALF universe for the state
2. Directory Ingest     — upsert into facilities table; set state-specific columns
3. Inspection Scrape    — pull all inspection/complaint events for all facilities
4. Inspection Ingest    — upsert into inspections + deficiencies tables
5. Signal Enrichment    — chain_curated, APFM, Caring, name keywords, disclosures
6. recompute_publishable — Option C tier model → serves_memory_care + publishable
7. Content Generation   — AI summaries, tour questions (publishable facilities only)
8. Streetview Fetch     — photo_url for publishable facilities
```

---

## Memory Care Signal Tiers (Option C)

### Tier 0 — Hard Manual Override
| Column | Description |
|---|---|
| `mc_review_status = 'reviewed_publish'` | Admin manually approved |
| `mc_review_status = 'reviewed_reject'` | Admin manually rejected; always unpublishable |

### Tier 1 — Government / High-Confidence Signals
| Column | State | Description |
|---|---|---|
| `memory_care_disclosure_filed` | All | Government-filed memory care disclosure or contract |
| `mc_signal_explicit_name` | All | Name contains "memory care", "dementia", "Alzheimer" |
| `mc_signal_chain_curated` | All | Verified chain match (SH, Brookdale, Sunrise, etc.) |
| `or_memory_care_endorsed` | OR | OHA Memory Care Endorsement |
| `mn_dementia_care_licensed` | MN | MDH ALDC (Assisted Living with Dementia Care) license |
| `tx_alzheimer_certified` | TX | HHSC Alzheimer Certification |
| `wa_dementia_care_contract` | WA | DSHS Dementia Care Contract (maps to `memory_care_disclosure_filed=true`) |

Tier 1 → `serves_memory_care = true` and `mc_review_status = 'auto_published'`.

### Tier 2 — Directory Intersection (Auto-Promote)
`mc_signal_apfm_listed AND mc_signal_caring_listed` — both major placement directories
list the facility. Neither alone is sufficient.

Tier 2 → `serves_memory_care = true` / `mc_review_status = 'auto_published'`.

### Tier 3 — Weak Single Signals (Queue for Review)
- `mc_signal_chain_name` only (not curated)
- APFM XOR Caring (only one directory)
- `mc_signal_deficiency_keyword` — dementia-care deficiency codes in inspection record

Tier 3 → `mc_review_status = 'needs_review'`.

---

## State Freshness Gates

Non-CA states require at least one inspection within a freshness window to be
publishable. CA has full CDSS coverage so no gate is applied.

| State | Freshness Gate | Rationale |
|---|---|---|
| CA | None | CDSS coverage is comprehensive |
| OR | 36 months | OHA inspection cadence ≥ annual |
| TX | 48 months | HHSC history surface is shallow; tighten to 36 when PIA backfill arrives |
| MN | 48 months | MDH survey cadence; 48 until broader ALF universe ingested |
| WA | 48 months | DSHS history limited; tighten as BHForms backfill progresses |

See `_FRESHNESS_MONTHS` constant in `scrapers/recompute_publishable.py`.

---

## Per-State Scrape Status

### California (CA) — Reference Model
| Layer | Source | Status |
|---|---|---|
| Directory | CDSS Community Care Licensing | Full — all RCFEs |
| Inspections | CDSS CCLD PDFs | Full — annual + complaints |
| Deficiencies | CDSS CCLD structured data | Full |
| History | 5+ years | Deep |
| Memory care signals | `memory_care_disclosure_filed` (§1569.627) + explicit name + chain | Strong |

### Oregon (OR)
| Layer | Source | Status |
|---|---|---|
| Directory | OHA DHS LTC Directory | Full — all RCFs and AFHs with endorsements |
| Inspections | OHA LTC portal | ~10K records ingested; severity mapping fixed May 2026 |
| Deficiencies | OHA structured data | Fixed; re-ingested May 2026 |
| History | 3–5 years | Standard |
| Notes | AFHs (≤5 beds) dominate; families unlikely to choose them for MC → publishable gate filters most |

### Washington (WA)
| Layer | Source | Status |
|---|---|---|
| Directory | DSHS BHAdvLookup | Broadened May 2026 (107 → 557 facilities) |
| Inspections | DSHS BHForms PDF survey reports | ~418 inspections; 420 facilities |
| Deficiencies | Survey PDFs (image-based) | Needs OCR pipeline |
| History | 1–3 years | Shallow |
| Notes | BHForms history backfill in progress (Phase 2); survey PDFs are scanned images |

### Minnesota (MN)
| Layer | Source | Status |
|---|---|---|
| Directory | ALRC Excel (ALDC only) | 594 ALDC facilities; full universe (2100+ ALFs) pending MDH Excel download |
| Inspections | MDH findings API | 1670 events (943 standard + 727 complaints) |
| Deficiencies | Survey PDFs (text-based) | Narrative extraction via pdfplumber; deficiency parsing pending |
| History | 4 years | Standard |
| Notes | Standard survey PDFs are text-extractable; OHFC complaint PDFs are scanned images |

### Texas (TX)
| Layer | Source | Status |
|---|---|---|
| Directory | HHSC TULIP | Partial; PIA bulk request pending |
| Inspections | HHSC TULIP | Present for Alzheimer-certified facilities |
| Deficiencies | HHSC structured data | Present |
| History | 2–4 years | Shallow–Standard |
| Notes | Only Alzheimer-certified facilities are currently publishable |

---

## Inspection Display Cap (Free vs Premium)

All inspection data is ingested and retained in the DB without date limits.

Display is capped at **3 years** for free-tier visitors (`INSPECTION_DISPLAY_YEARS = 3`
in `src/lib/facility/loadFacilityProfile.ts`). Older inspections are counted and shown
as a "N older inspections from YYYY — full history coming soon" footer. JSON-LD is also
filtered to the 3-year window so stale deficiencies don't surface in schema.

Premium tier will remove the display cap when billing is built.

---

## New State Playbook

See `docs/NEW_STATE_PLAYBOOK.md` for the step-by-step checklist. Key invariants:

1. Always pull the full licensed ALF directory first.
2. Set state-specific columns during directory ingest (e.g., `tx_alzheimer_certified`).
3. Run `recompute_publishable.py --state XX` — never manually set `publishable = true`.
4. Set a freshness gate in `_FRESHNESS_MONTHS` before first publish.
5. Add chain/APFM/Caring signal collection via `_mc_signals.py` (Phase 4b).
6. Add the state to `summarize_inspections.py` and `fetch_streetview.py` after publish.

---

## Running the Pipeline

```bash
# Full CA re-ingest (reference)
python3 scrapers/ccld_rcfe_ingest.py
python3 scrapers/recompute_publishable.py --state CA
python3 scrapers/summarize_inspections.py --state CA

# WA full-universe refresh
python3 scrapers/wa_dshs_directory_scrape.py
python3 scrapers/wa_dshs_directory_ingest.py --input .firecrawl/wa-scrape/adv-lookup-YYYY-MM-DD.csv
python3 scrapers/recompute_publishable.py --state WA

# MN narrative extraction (text-based survey PDFs; ~1.7 hours)
python3 scrapers/fetch_mn_pdf_narratives.py --surveys-only

# MN AI summaries (after narrative extraction)
python3 scrapers/summarize_inspections.py --state MN

# Recompute all states
for state in CA OR WA MN TX; do
  python3 scrapers/recompute_publishable.py --state $state
done
```

---

_Last updated: 2026-05-10 · Maintained by the StarlynnCare data team_
