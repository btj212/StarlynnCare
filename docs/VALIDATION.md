# StarlynnCare Validation System

Automated multi-layer validation to catch data accuracy bugs before they reach production — and surface contradictions (e.g. a "highly rated" facility with a terrible inspection record) without manual spot-checking.

---

## When to Run Each Layer

| Layer | Script | When |
|-------|--------|------|
| 1 — DB invariants | `scripts/validate/db_invariants.py` | After every DB migration, after every scraper ingest |
| 2 — Content checks | `scripts/validate/content_checks.py` | Before every production deploy |
| 3 — Smoke tests | `scripts/validate/smoke_test.py` | After every production or preview deploy (manual) |
| 4 — CI integration | `.github/workflows/validate.yml` | Automatic — runs L1+L2 on every PR and push to `main` |
| 5 — Post-ingest hook | `scripts/validate/post_ingest_check.py` | Chained after any scraper run |
| 6 — Live E2E parity | `scripts/validate/e2e_live_pipeline.py` | After any ingest/parser/page-template change; weekly spot audit |

---

## How to Run Manually

**Prerequisites:** `DATABASE_URL` must be set — either in `.env.local` (for local runs) or as an environment variable.

### Layer 1 — DB Invariant Checks

```bash
python3 scripts/validate/db_invariants.py
```

Checks (per state with publishable facilities):
- Peer-rank percentile spread (`stddev > 5`) — catches formula bugs like the "all facilities = 100" bug
- Min < 20th percentile and max > 80th percentile exist — ranking is not degenerate
- Cross-metric contradiction: no facility in top 10% of repeat citations has a high composite rank
- Positive headline vs rank contradiction: no "highly rated" facility has composite_pct < 40
- Coverage nulls: `last_inspection_date`, `beds`, `state_code` completeness
- CA-specific: ≥80% of facilities have ≥1 inspection, ≥60% of deficiencies have narrative
- Severity distribution: ≥10% of deficiencies have `severity ≥ 2` (catches parsing regressions)
- Freshness: most recently-updated facility per state is within 90 days

### Layer 2 — Content Validation

```bash
python3 scripts/validate/content_checks.py
```

Checks:
- `docs/analyses/repeat_offender_report/data_sample.csv` facilities exist in DB as publishable
- Repeat citation counts in CSV match DB (using distinct-visit methodology)
- Repeat offenders don't have good composite rank (> 50th percentile)
- Chain scorecard in `src/lib/content/reports/california-rcfe-repeat-citations-2026.ts` is within 5% of current DB values for facility count, total beds, and WCS
- Positive headline audit: any `content.headline` containing "highly rated", "top rated", "award", "best in", or "outstanding" that belongs to a facility with `composite_pct < 50` is flagged

### Layer 3 — Smoke Tests

```bash
# After production deploy:
python3 scripts/validate/smoke_test.py --env production

# After a Vercel preview deploy:
python3 scripts/validate/smoke_test.py --env preview --url https://your-preview.vercel.app
```

Checks:
- 10 randomly-sampled facility profiles (2 per state): HTTP 200, name visible, no "highly rated" fallback, no NaN/undefined
- CA repeat citations report page: HTTP 200, contains "repeat citation", known facility name visible, no rendering errors, body > 5,000 chars
- Opal Care regression: `highly rated` label removed, repeat rank displays a low percentile

### Layer 5 — Post-Ingest Hook

```bash
# Run immediately after a scraper:
python3 scrapers/mn_alrc_ingest.py && python3 scripts/validate/post_ingest_check.py --state MN

# With a pre-ingest count for shrink detection:
PREV=$(psql $DATABASE_URL -tAc "SELECT COUNT(*) FROM facilities WHERE state_code='CA' AND publishable=true")
python3 scrapers/ccld_citations_ingest.py --publishable
python3 scripts/validate/post_ingest_check.py --state CA --prev-count $PREV

# When intentionally depublishing (suppresses shrink check):
python3 scripts/validate/post_ingest_check.py --state TX --allow-shrink
```

Checks:
1. Row count did not decrease (without `--allow-shrink`)
2. `peer_rank_pct` distribution is non-degenerate (stddev > 5)
3. ≥80% of publishable facilities have `updated_at` within 7 days
4. No newly-publishable facilities have `beds IS NULL` or `last_inspection_date IS NULL`

---

## CI Integration

Layers 1 and 2 run automatically via `.github/workflows/validate.yml` on every PR and push to `main`. The `DATABASE_URL` GitHub Actions secret must be configured.

Layer 3 (smoke tests) is **not** run in CI because there is no live URL during CI execution. Run it manually post-deploy.

---

## How to Add a New Check

1. Choose the right layer based on what the check targets:
   - **Layer 1** — DB data integrity (schema, distributions, nulls)
   - **Layer 2** — Static content files vs DB
   - **Layer 3** — Live rendered pages
   - **Layer 5** — State-specific post-ingest

2. Use the `check()` helper from `scripts/validate/_lib.py`:

   ```python
   from validate._lib import check

   check(
       "Check name (human-readable)",
       condition_that_should_be_true,
       "detail string shown on failure or pass",
   )
   ```

   `check()` prints `PASS` or `FAIL`, accumulates failures, and returns the bool result.

3. Add your function to the appropriate script's `main()` call sequence.

4. Test locally against the real DB before committing:
   ```bash
   python3 scripts/validate/db_invariants.py
   ```

5. The `run_all_checks()` call at the end of each script exits with code 1 if any checks failed, which causes CI to fail the job.

---

## Peer Rank Proxy Methodology

The live site computes peer rank via the `facility_snapshot()` Postgres RPC (complex, per-facility). The validation scripts use a bulk SQL proxy that mirrors the same logic:

```sql
-- composite_pct ≈ average of three window-function percentiles:
sev_pct  = 100 × (1 - percent_rank() OVER peers ORDER BY sev_score)
rep_pct  = 100 × (1 - percent_rank() OVER peers ORDER BY rep_score)
freq_pct = 100 × (1 - percent_rank() OVER peers ORDER BY freq_score)
composite_pct = ROUND((sev_pct + rep_pct + freq_pct) / 3)
```

Where `peers` = same `state_code + care_category`, `publishable = true`. This proxy may differ from the RPC by ±3 percentile points for edge cases (peer-set fallback levels), which is acceptable for bulk validation purposes.

---

## Known Bugs Found by This System

| Bug | Layer that caught it | Status |
|-----|---------------------|--------|
| Opal Care labeled "highly rated" despite top-10% repeat citations | L1 cross-metric contradiction + L3 regression | Fixed |
| `peer_rank_pct` stddev = 0 (all facilities returned 100) | L1 peer-rank distribution | Fixed |
| Chain scorecard WCS drift after new inspection ingest | L2 chain scorecard reconciliation | Ongoing monitor |

---

## Layer 6 — Live End-to-End Parity (no mocks)

```bash
python3 scripts/validate/e2e_live_pipeline.py                 # all stages
python3 scripts/validate/e2e_live_pipeline.py --stage S3 S4   # CA regulator → DB only
python3 scripts/validate/e2e_live_pipeline.py --per-state 10 --seed 42 --json out.json
```

Needs `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. **Read-only** (PostgREST GETs). No fixtures, no stubs: every run fetches current raw payloads from the real regulator APIs, current rows from the DB, and the current live pages. Sample is random but seeded (default seed = today's date) — re-run with the printed seed to reproduce a failure.

| Stage | Upstream (raw) | Compared against |
|-------|----------------|------------------|
| S1 | CMS provider directory `4pq5-n9py` (every ingested field) | `facilities` |
| S2 | CMS health deficiencies `r5ix-sfxw` (tag, scope/severity, IJ, text, correction date) | `inspections` + `deficiencies` |
| S3 | CCLD `FacilityReports/{facNum}` index **and raw report HTML header** (proves `inx` is 0-based each run) | `inspections` (type, complaint flag, control #) |
| S4 | CCLD report HTML run through the real `parse_report` + parser-independent narrative substring check | `inspections` + `deficiencies` |
| S5 | Census Geocoder lat/lon → place (same incorporated-over-CDP rule as the SEO convention) | `facilities.city_slug` |
| S6 | `facilities`/`inspections`/`deficiencies` rows | live page HTML + JSON-LD (identity, address, phone, license, 3-yr deficiency count, dates, canonical, no fabricated `aggregateRating`/`geo`, no `undefined`/`NaN`) |

**Not covered yet (no live-comparable raw feed wired into this harness):** AZ (Salesforce, needs Playwright), WA/UT ArcGIS directories, OR/MN/MO/TX/IL/PA state sources, Firecrawl watch pipeline, Stripe/Clerk flows, Anthropic-generated hub content. A failure means upstream and downstream disagree; triage it, do not loosen the check. Known open findings are logged in `ERRORS.md` (2026-10 CCLD `inx` entry).
