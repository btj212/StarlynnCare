# Live end-to-end tests (no mocks)

`tests/e2e/` proves the pipeline against the real world: real regulator payloads, the real
ingest/parser code, the real production database (read-only, publishable key, RLS applies),
and the real website. Nothing is stubbed, faked or replayed from hand-written fixtures.

```bash
python3 -m unittest discover -s tests/e2e -t . -v     # ~2 min, needs network
python3 -m unittest tests.e2e.test_ca_roster_source   # one stage
```

Needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (env or `.env.local`).
Responses are cached in `/tmp/starlynncare_e2e_cache` for 6h (`E2E_CACHE_DIR`, `E2E_CACHE_TTL_SECS`).
Stdlib `unittest`; no new dependencies. The suite never writes to any database.

## Stages (California is the first fully covered state)

| Stage | File | Proves |
|---|---|---|
| 1 | `test_ca_roster_source.py` | Source reachable the way ingest reaches it; roster schema contract; **every payload column is consumed or consciously ignored** (mutation test); transform sane and faithful on **all 12,522** live records |
| 1b | `test_ca_roster_vs_database.py` | Every licensed Alameda roster facility is in production, every owned field equal |
| 2 | `test_ca_citations_pipeline.py` | Stored citation URLs still resolve and still show the same report; raw CDSS HTML -> real parser -> stored inspection + deficiency rows agree field by field; severity mapping |
| 3 | `test_ca_rendered_pages.py` | Live pages show stored facts; canonical + JSON-LD contract; citation count equals the loader's documented rule |
| 4 | `test_census_geocoder.py` | Stored city equals the live Census physical place (AGENTS.md rule) |

## Not yet covered (honest gaps)

- Other states (AZ, MN, OR, TX, WA, UT, PA, IL, MO, CMS nursing homes): same pattern, one file per stage.
- The **write path** (`UPSERT_SQL`, `insert_inspection`): the sandbox that built this blocks direct Postgres TCP
  (HTTPS only), and the only database is production. Needs a Supabase branch/staging DB to test without risk.
- CDSS bulk `Facility/any` transparency dump (times out from the build sandbox) -> `last_inspection_date`.
- Claude-generated content (`generate_content.py`) — judgment output, needs an eval rubric rather than equality tests.
- Photos (Google Places / Street View), Stripe, Loops, Clerk flows.

A failing test here is a finding, not flakiness: see the 2026-10 entry in `ERRORS.md`.
