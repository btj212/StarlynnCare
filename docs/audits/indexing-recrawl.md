# Indexing recrawl check

The comparison point is the October 27, 2026 Search Console export, written into `scripts/validate/search_console_coverage.py` as `OCTOBER_27_BASELINE`:

- Chart date: 2026-10-22
- Indexed: 1,637
- Not indexed: 4,773
- Crawled, currently not indexed: 3,684

Do not start a new Search Console validation, and do not resubmit the sitemap for that purpose, until both of these are true:

1. Production `https://www.starlynncare.com/sitemap.xml` dates each child sitemap with the newest real page date in that file, or omits the date. It must not use the day the file was generated.
2. A representative excluded Arizona city hub returns `noindex, follow` and is absent from `sitemap-hubs.xml`. A cited facility page stays indexable and stays in `sitemap-facilities.xml`.

## After the change is on production

Wait until Google has recrawled the affected URLs, then export a new coverage chart and a new crawled-but-not-indexed validation table. Run:

```bash
python3 scripts/validate/search_console_coverage.py \
  --coverage-zip /path/to/Coverage.zip \
  --validation-zip /path/to/Coverage-Validation.zip \
  --check-live \
  --url https://www.starlynncare.com
```

Read the delta in `docs/audits/search-console-coverage.md`. The result we want is fewer crawled-but-not-indexed URLs among the small Arizona homes with no citations, without a drop in cited facility pages.

## Not-found URLs

The October 27 chart says 760 pages are not found. That export does not list them. Export the "Not found (404)" URL table before proposing a redirect or a removal. Pass it as `--not-found-zip` when the zip contains `Table.csv`. The audit counts those URLs and still does not invent a destination.

## What this pass does not do

Cited homes that Google declined stay in the sitemap. Missing inspection prose is an enrich gap, not a noindex. County pages that currently list a single city stay up.
