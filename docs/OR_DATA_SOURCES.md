# Oregon (DHS LTC Licensing) — data discovery notes

Private research doc for ingest. **Verify URLs and CSV column headers before relying on automation.**

## Regulator

- **Oregon DHS** — Long-Term Care Licensing (`ltclicensing.oregon.gov`)

## Facility taxonomy (memory care)

- **Memory Care endorsement** — facilities licensed as ALF or RCF may carry a memory-care endorsement; roster export supports `MemoryCare=Yes` filter.

## Roster / directory (implemented)

| Artifact | Script |
|----------|--------|
| Provider CSV (memory care + open + ALF/RCF) | [`scrapers/or_dhs_ltc_directory_scrape.py`](../scrapers/or_dhs_ltc_directory_scrape.py) → [`scrapers/or_dhs_ltc_directory_ingest.py`](../scrapers/or_dhs_ltc_directory_ingest.py) |

**Join keys:** `Provider ID` from exports → `facilities.or_provider_id` and normalized `facilities.license_number` (10-digit zero-padded numeric ID).

**Export filter:** POST uses `Filters=MemoryCare=Yes` only. The portal returns an empty CSV if `Status=Open` is combined with `MemoryCare` in the same request; [`scrapers/or_dhs_ltc_directory_ingest.py`](../scrapers/or_dhs_ltc_directory_ingest.py) keeps **Open** rows only.

**Source URL:** `https://ltclicensing.oregon.gov/Providers`

Schema: [`supabase/migrations/0017_or_directory_columns.sql`](../supabase/migrations/0017_or_directory_columns.sql).

## Inspections & violations (implemented)

Bulk CSV exports (CSRF + session):

- **Inspections:** [`scrapers/or_dhs_ltc_inspections_scrape.py`](../scrapers/or_dhs_ltc_inspections_scrape.py) exports the full portal CSV (`Filters` empty — the UI filter `ProviderType=ALF&ProviderType=RCF` returns no rows). [`scrapers/or_ltc_to_bundle.py`](../scrapers/or_ltc_to_bundle.py) keeps **ALF** and **RCF** rows only (by provider `Type` / violations `Provider type`) and can narrow to roster Provider IDs via `--roster-csv`.
- **Violations:** same scrape script writes `violations-<date>.csv`.

**Join logic:** `Inspections.Event ID` ↔ `Violations.Report number` for the same Provider ID.

Bundle → DB: [`scrapers/or_ltc_to_bundle.py`](../scrapers/or_ltc_to_bundle.py) → [`scrapers/or_inspections_ingest.py`](../scrapers/or_inspections_ingest.py) `--import-json`.

## Operational hygiene

- **User-Agent:** `StarlynnCare-Research/1.0 (btj212@gmail.com)` (see [`scrapers/_http_helpers.py`](../scrapers/_http_helpers.py)).
- **Rate limit:** ≥1 s between requests on state infrastructure.
- **Robots.txt:** verify before scaling (`https://ltclicensing.oregon.gov/robots.txt`).
- **Raw cache:** `.firecrawl/or-scrape/` (gitignored at scale).

## Publish gate

After inspection ingest, run:

```bash
python3 scrapers/recompute_publishable.py --state OR
```

Uses `OR_PUBLISH_GATE_MONTHS` (36) in [`scrapers/recompute_publishable.py`](../scrapers/recompute_publishable.py): LICENSED + `or_memory_care_endorsed` + recent inspection + not `reviewed_reject`.

## QA checklist

1. `python3 scrapers/audit_mc_signals.py --state OR` — no publishable rows without tier-1 MC rationale where applicable.
2. Spot-check `inspections.source_url` fragments resolve conceptually to DHS inspection identity (`#or-<license>-<event>-<date>`).
