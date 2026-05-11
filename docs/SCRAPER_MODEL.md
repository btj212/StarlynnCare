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
`memory_care_disclosure_filed` is the unified column every state writes its
Tier-1 credential into. The per-state flag below is the *source of truth*,
and `memory_care_disclosure_filed` is the mirrored column that
`recompute_publishable.py` reads.

| Column | State | Description |
|---|---|---|
| `memory_care_disclosure_filed` | All | Government-filed memory care disclosure or contract (mirrored from each state's credential below) |
| `mc_signal_explicit_name` | All | Name contains "memory care", "dementia", "Alzheimer" |
| `mc_signal_chain_curated` | All | Verified chain match (Silverado, Belmont Village, Aegis Living, etc.) |
| `or_memory_care_endorsed` | OR | OHA Memory Care Endorsement → `'OR DHS Memory Care Endorsement'` |
| `mn_dementia_care_licensed` | MN | MDH ALDC (Assisted Living with Dementia Care) license → `'MN ALRC ALDC'` |
| `tx_alzheimer_certified` | TX | HHSC Alzheimer Certification → `'TX HHSC Alzheimer Certification'` |
| `wa_dementia_care_contract` | WA | DSHS Dementia Care Contract → `'WA DSHS Dementia Care Contract'` |

The state ingest scripts (`or_dhs_ltc_directory_ingest.py`,
`wa_dshs_directory_ingest.py`, `mn_mdh_directory_ingest.py`, `tx_alf_ingest.py`)
write both columns at upsert time. Use
[`scrapers/backfill_disclosure_from_state_flags.py`](../scrapers/backfill_disclosure_from_state_flags.py)
to repair any historical rows that pre-date that wiring.

Tier 1 → `serves_memory_care = true` and `mc_review_status = 'auto_published'`.

### Tier 2 — Directory Intersection (Auto-Promote)
`mc_signal_apfm_listed AND mc_signal_caring_listed` — both major placement directories
list the facility. Neither alone is sufficient.

Tier 2 → `serves_memory_care = true` / `mc_review_status = 'auto_published'`.

Populated by:
- [`scrapers/directory_mc_scrape.py`](../scrapers/directory_mc_scrape.py) — scrapes
  `aplaceformom.com` and `caring.com` per state. Use `--state CA|OR|WA|MN|TX`. Output
  lives at `.firecrawl/directory-match/{apfm,caring}-{state}-mc.json`.
- [`scrapers/directory_mc_upsert.py`](../scrapers/directory_mc_upsert.py) — fuzzy-matches
  scraped listings against `facilities` for that state and sets the two flags.
- Recommended invocation: `--cities-from-db 30` covers the metropolitan cores; falls back
  to all city pages with `--full`.

### Tier 3 — Weak Single Signals (Queue for Review)
- `mc_signal_chain_name` only (not curated)
- APFM XOR Caring (only one directory)
- `mc_signal_deficiency_keyword` — dementia-care deficiency codes in inspection record

Tier 3 → `mc_review_status = 'needs_review'`.

### Chain Curated Collectors
- CA uses [`scrapers/chain_curated_mc.py`](../scrapers/chain_curated_mc.py) — scrapes
  each chain's CA find-a-community page and matches against CDSS rows.
- OR/WA/MN/TX use [`scrapers/chain_curated_multistate.py`](../scrapers/chain_curated_multistate.py)
  — applies only the *MC-everywhere* national/regional chains (Silverado, Belmont
  Village, Aegis Living, ActivCare, plus a few regional MC-only brands) directly
  to each state's licensed roster. False-positive-resistant regexes (e.g.
  `\yaegis\s+(?:living|gardens|of)\y` instead of bare `\yaegis\y`) keep
  small mom-and-pop operators from being auto-confirmed by name overlap.

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
| Inspections | DSHS BHForms PDF survey reports | Full roster ingested May 2026 — 1,792 inspections (+1,374 new), 1,417 deficiencies (+1,417 new), 180 publishable facilities |
| Deficiencies | Survey PDFs (image-based) | Needs OCR pipeline |
| History | 2023–present (~3 years) | Shallow |
| Notes | BHForms live portal only exposes ~3 years of history; no hidden date params found. Wayback CDX coverage is sparse (2–3 snapshots/facility, mostly fire inspections). **Recommended path for deeper history: DSHS Public Records Act request for pre-2023 survey reports.** Use `wa_inspections_ingest.py` with no `--dementia-only` flag to cover the broad roster going forward. |

### Minnesota (MN)
| Layer | Source | Status |
|---|---|---|
| Directory | ALRC Excel (broadened May 2026) | 2,216 ALFs (607 ALDC + 1,609 standard AL); MDH bulk Excel still offline |
| Inspections | MDH findings API | Broadened May 2026 — 4,267 events (+2,597 new), 1,150+ facilities covered |
| Deficiencies | Survey PDFs (text-based) | `fetch_mn_pdf_narratives.py --surveys-only` runs over 2,994 surveys |
| History | 4 years | Standard |
| Notes | Standard survey PDFs are text-extractable; OHFC complaint PDFs are scanned images. The MDH `facilityDirectoryExtract.cfm` bulk-download host is currently offline → `mn_hcp_type` cannot be backfilled until MDH restores the endpoint. The MDH findings API does not embed deficiency rows — those come from the linked PDFs via `fetch_mn_pdf_narratives.py` (text) and an OCR pipeline (image complaints; not yet built). |

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
python3 scrapers/wa_dshs_inspections_scrape.py --from-csv .firecrawl/wa-scrape/adv-lookup-YYYY-MM-DD.csv
python3 scrapers/wa_dshs_to_bundle.py --details-dir .firecrawl/wa-scrape/details --output .firecrawl/wa-scrape/bundle-YYYY-MM-DD.json
python3 scrapers/wa_inspections_ingest.py --import-json .firecrawl/wa-scrape/bundle-YYYY-MM-DD.json
python3 scrapers/recompute_publishable.py --state WA

# MN full-universe refresh
python3 scrapers/mn_mdh_inspections_scrape.py
python3 scrapers/mn_mdh_to_bundle.py \
  --findings .firecrawl/mn-scrape/mn-findings-YYYY-MM-DD.json \
  --alrc-facilities .firecrawl/mn-scrape/mn-alrc-facilities-YYYY-MM-DD.json \
  --output .firecrawl/mn-scrape/bundle-YYYY-MM-DD.json
python3 scrapers/mn_inspections_ingest.py --import-json .firecrawl/mn-scrape/bundle-YYYY-MM-DD.json
python3 scrapers/fetch_mn_pdf_narratives.py --surveys-only --state MN     # ~2.5 hours
python3 scrapers/summarize_inspections.py --state MN
python3 scrapers/recompute_publishable.py --state MN

# Multi-state signal collectors (run once per state after directory + inspections)
python3 scrapers/chain_curated_multistate.py --state all
for state in OR WA MN TX; do
  python3 scrapers/directory_mc_scrape.py --state $state --full --cities-from-db 30
  python3 scrapers/directory_mc_upsert.py --state $state
done

# Tier-1 disclosure column mirror (idempotent — safe to re-run)
python3 scrapers/backfill_disclosure_from_state_flags.py

# Recompute all states
for state in CA OR WA MN TX; do
  python3 scrapers/recompute_publishable.py --state $state
done

# Snapshot current coverage (read-only)
python3 scrapers/_state_signals_audit.py
```

---

_Last updated: 2026-05-11 · Maintained by the StarlynnCare data team_
