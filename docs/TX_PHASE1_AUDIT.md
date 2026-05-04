# Texas Phase 1 — HHSC ALF directory ingest audit

**Date:** 2026-05-04  
**Scope:** Metro-filtered ingest from HHSC “Directory of Assisted Living Facility Providers with an Active License” Excel export (`al.xlsx`), script [`scrapers/tx_alf_ingest.py`](../scrapers/tx_alf_ingest.py), migration [`0015_tx_alf_directory_columns.sql`](../supabase/migrations/0015_tx_alf_directory_columns.sql).

**Phase 1 rule:** All TX rows are inserted with **`publishable = false`** until Phase 2 inspection ingest + publish gate (per plan). `serves_memory_care` / `tx_alzheimer_certified` reflect **non-expired** Alzheimer Certification on the roster.

---

## Ingest run (metros-only default)

| Metric | Value |
| ------ | ----- |
| Rows in export (data rows) | 2,007 |
| Rows after metro county filter | 1,389 |
| Rows upserted to `facilities` (`state_code = TX`) | 1,389 |
| Distinct `license_number` (TX) | 1,389 |
| `tx_alzheimer_certified = true` | 515 |
| `publishable = true` | 0 |

## Per-county row counts (metro footprint)

| `tx_county` | Count |
| ----------- | ----: |
| HARRIS | 277 |
| DALLAS | 199 |
| BEXAR | 145 |
| TARRANT | 144 |
| COLLIN | 126 |
| DENTON | 110 |
| FORT BEND | 89 |
| MONTGOMERY | 87 |
| TRAVIS | 74 |
| WILLIAMSON | 58 |
| BRAZORIA | 31 |
| GALVESTON | 30 |
| HAYS | 19 |

## License class (`tx_license_class`)

| Class | Count |
| ----- | ----: |
| B | 1,169 |
| A | 218 |
| C | 2 |

## Geo coverage

- **`latitude` / `longitude` populated:** ~98.1% of TX ingested rows (HHSC `Geo Location` field).

## Regions / city_slug coverage

- Expanded Texas county hubs and `citySlugs` in [`src/lib/regions.ts`](../src/lib/regions.ts) (Harris, Fort Bend, Montgomery, Brazoria, Galveston, Dallas, Collin, Tarrant, Denton, Bexar, Travis — Travis list includes Williamson + Hays cities for Austin MSA routing).
- **`python3 scrapers/tx_alf_ingest.py --input … --dry-run`:** zero orphan `city_slug` values vs merged metro seeds after expansion.

## Production hub HTTP snapshot

Texas is listed in `STATES` but **not** in `COVERED_STATES` in [`src/lib/states.ts`](../src/lib/states.ts). Sample county hub checks (2026-05-04):

| URL | Status |
| --- | ------ |
| `GET /texas/harris-county` | 404 |
| `GET /texas/dallas-county` | 404 |
| `GET /texas/tarrant-county` | 404 |
| `GET /texas/travis-county` | 404 |

Empty **and/or** non-covered-state guardrails are expected until Phase 2 enables publishing.

---

## Phase 2 — inspection ingest, publish gate, hubs (2026)

| Item | Status |
| ---- | ------ |
| TULIP / LTCR discovery + **YELLOW** verdict | Documented in [`docs/TX_DATA_SOURCES.md`](./TX_DATA_SOURCES.md) |
| [`scrapers/tx_inspections_ingest.py`](../scrapers/tx_inspections_ingest.py) | **Import-json** + `--smoke` fixture; `source_agency = TX HHSC LTCR` |
| TX publish rule | [`scrapers/recompute_publishable.py`](../scrapers/recompute_publishable.py) `--state TX` (Alz cert + **36 months** inspection, not `reviewed_reject`) |
| `COVERED_STATES` | `texas` added in [`src/lib/states.ts`](../src/lib/states.ts) — hubs + sitemaps include TX when publishable > 0 |
| Editorial scripts | `summarize_inspections.py --state TX`, `fetch_photos.py --state TX`, `generate_content.py --state TX` |

### Metrics to backfill after production ingest

Run the following in Supabase (or document query output here on the next deploy):

- **Inspections per facility** (Alz-certified TX, publishable): min / median / p95 / max.
- **Deficiency rows** total; `state_severity_raw` top values.
- **Publishable count** vs 515 `tx_alzheimer_certified` (gap = cert but no inspection in 36 months).
- **Coverage** on publishable subset: `narrative_summary` non-null %, `photo_url` %, `content` JSON %.

### Production hub HTTP sweep (re-run after deploy + data)

Texas county hub slugs (metro seeds):  
`harris-county`, `fort-bend-county`, `montgomery-county`, `brazoria-county`, `galveston-county`, `dallas-county`, `collin-county`, `tarrant-county`, `denton-county`, `bexar-county`, `travis-county`.

```bash
for s in harris-county fort-bend-county montgomery-county brazoria-county galveston-county \
         dallas-county collin-county tarrant-county denton-county bexar-county travis-county; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://www.starlynncare.com/texas/$s")
  echo "$s $code"
done
```

Expect **200** when each region has ≥1 publishable facility; **404** if empty/thin guard.

---

## Phase 2 readiness checklist (historical)

- [x] Discovery + feasibility recorded ([`docs/TX_DATA_SOURCES.md`](./TX_DATA_SOURCES.md)).
- [x] Implement [`scrapers/tx_inspections_ingest.py`](../scrapers/tx_inspections_ingest.py) (import-json path).
- [x] Map LTCR labels → `state_severity_raw` + inferred `severity` where confident.
- [x] TX publish gate via `recompute_publishable.py --state TX`.
- [x] Texas in `COVERED_STATES` for hub/sitemap parity.
- [ ] Optional: PIA bulk pull — [`docs/TX_PIA_REQUEST_DRAFT.md`](./TX_PIA_REQUEST_DRAFT.md) (fallback if Aura capture stalls).
