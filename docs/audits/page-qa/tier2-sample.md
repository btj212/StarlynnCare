# Tier 2 — Sampled dynamic pages (per state)

Generated: 2026-06-01

**Live HTTP validation was not completed in the agent environment** (DNS to `starlynn.care` unavailable). Run locally:

```bash
python3 scripts/validate/jsonld_check.py --env production
python3 scripts/validate/internal_links_check.py --env production
python3 scripts/validate/meta_check.py --env production
```

## Sample matrix (2 facilities + 2 city hubs per state)

| State | Facility URLs (from DB random sample) | City hub URLs |
|-------|--------------------------------------|---------------|
| CA | Run scripts — samples rotate | e.g. `/california/san-francisco`, `/california/oakland` |
| OR | Run scripts | e.g. `/oregon/portland`, `/oregon/eugene` |
| WA | Run scripts | e.g. `/washington/seattle`, `/washington/spokane` |
| MN | Run scripts | e.g. `/minnesota/minneapolis`, `/minnesota/rochester` |
| TX | Run scripts | e.g. `/texas/houston`, `/texas/austin` |

## Expected gates (when live scripts run green)

| Check | Facility page | Hub page |
|-------|---------------|----------|
| JSON-LD LocalBusiness + MedicalOrganization + BreadcrumbList | yes | CollectionPage + ItemList + BreadcrumbList |
| aggregateRating only with published reviews | yes | n/a |
| Parent city link (exactly one) | yes | n/a |
| Facility links in hub grid | n/a | yes |
| Title ≤ 60, meta ≤ 160 | yes | yes |

## DB thin-hub note

20+ CA city hubs have only **1** publishable facility (see `soft404-report.md`). These may render weak ItemList content — **NEEDS-HUMAN** for populate vs noindex strategy.
