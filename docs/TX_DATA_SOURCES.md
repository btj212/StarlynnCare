# Texas (HHSC) — data discovery notes

Private research doc for Phase 5 ingest. **Do not treat URLs below as API contracts** — verify before production scrapers.

## Regulator

- **HHSC** — Texas Health & Human Services Commission  
- **LTCR** — Long-Term Care Regulation (licensing / inspections for assisted living and related settings)

## Facility taxonomy (memory-care relevant)

- Texas Assisted Living Facility (ALF) license types **Type A / Type B / Type C** describe **facility capability**, not deficiency severity (do not confuse with California Type-A / Type-B *deficiency* labels).
- **Alzheimer Certification** — endorsement relevant for dementia-capable programming; use roster flags when published.

## Discovery checklist

1. Provider search / roster export — enumerate licensed ALFs by county with certification flags.
2. Inspection / survey reports — HTML vs PDF; determine stable URL patterns and whether bulk PIA export is cheaper than scrape.
3. Deficiency taxonomy — map HHSC categories into StarlynnCare `severity` ordinal + `state_severity_raw` verbatim string ([`0014_tx_scaffold_columns.sql`](../supabase/migrations/0014_tx_scaffold_columns.sql)).
4. Rate limits & robots.txt — record crawl delay before automation.
5. Public Information Act — optional bulk historical pull if portal lacks machine-readable history.

## Repo scaffolding

- Nullable TX columns on `facilities` / `state_severity_raw` on `deficiencies`.
- Seed counties in [`src/lib/regions.ts`](../src/lib/regions.ts) — hubs **404 until publishable rows exist** (thin-page guard).

## Companion script

See [`scrapers/tx_research_snapshot.py`](../scrapers/tx_research_snapshot.py) for a placeholder CLI that documents intended workflow until HHSC endpoints are wired.
