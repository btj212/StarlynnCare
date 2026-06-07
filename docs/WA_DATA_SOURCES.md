# Washington (DSHS ADSA) — data discovery notes

Private research doc. **The Advanced Lookup search form (`BHAdvLookup.aspx`) posts to **`BHAdvResults.aspx`** without classic `__VIEWSTATE`; [`scrapers/wa_dshs_directory_scrape.py`](../scrapers/wa_dshs_directory_scrape.py) targets that results URL directly.

## Regulator

- **Washington State DSHS** — Aging and Disability Services Administration (ADSA), assisted living contract enforcement.

## Facility roster — dementia care contract (implemented)

| Step | Script |
|------|--------|
| POST Advanced Lookup → CSV | [`scrapers/wa_dshs_directory_scrape.py`](../scrapers/wa_dshs_directory_scrape.py) |
| CSV → `facilities` | [`scrapers/wa_dshs_directory_ingest.py`](../scrapers/wa_dshs_directory_ingest.py) |

Filter: **Dementia Care** contract (`contract=Dementia Care` in form POST).

Detail lookup URL pattern (verify per facility — ASP.NET routes move):

`https://fortress.wa.gov/dshs/adsaapps/lookup/BHPubFacDetail.aspx?licnum=<LICENSE_NUMBER>`

Schema: [`supabase/migrations/0019_wa_directory_columns.sql`](../supabase/migrations/0019_wa_directory_columns.sql).

## Inspection reports (implemented pipeline — heuristic parse)

There is **no** confirmed bulk inspection export comparable to Oregon CSV. Pipeline:

1. [`scrapers/wa_dshs_inspections_scrape.py`](../scrapers/wa_dshs_inspections_scrape.py) — GET facility detail HTML → `.firecrawl/wa-scrape/details/<license>.html` (cached).
2. Optionally follow same-origin links under `/dshs/adsaapps/` into `.firecrawl/wa-scrape/reports/`.
3. [`scrapers/wa_dshs_to_bundle.py`](../scrapers/wa_dshs_to_bundle.py) — build `format_version: 1` bundle from cached HTML (minimal deficiency extraction until PDF/HTML templates are mapped field-by-field).
4. [`scrapers/wa_inspections_ingest.py`](../scrapers/wa_inspections_ingest.py).

**Spike checklist**

- [ ] Confirm `BHPubFacDetail.aspx?licnum=` resolves for licenses from roster CSV.
- [ ] Inventory inspection link `<a href>` patterns on detail page.
- [ ] Decide PDF vs HTML parse path for deficiencies.

## Operational hygiene

- ≥1 s between Fortress requests; exponential backoff on 5xx.
- Cache HTML under `.firecrawl/wa-scrape/` — never re-fetch on parser iteration.

## Publish gate

`python3 scrapers/recompute_publishable.py --state WA` — `WA_PUBLISH_GATE_MONTHS` (48) + `wa_dementia_care_contract = true`.
