# Sitemap diff report

Generated: 2026-06-01

**Status:** Live sitemap fetch was **not completed** in the agent environment (no DNS to `starlynn.care`).

## Run locally

```bash
python3 scripts/validate/sitemap_diff.py --env production
```

This compares:

- `/sitemap.xml` → child sitemaps (`sitemap-static`, `sitemap-hubs`, `sitemap-facilities`)
- Publishable facility + hub paths from Postgres

## Expected structure (from code)

| Sitemap | Source |
|---------|--------|
| `sitemap-static.xml` | `collectStaticSitemapEntries()` in `src/lib/sitemap/buildSitemapEntries.ts` |
| `sitemap-hubs.xml` | Regions from `regionsForState()` per covered state |
| `sitemap-facilities.xml` | Publishable facilities from Supabase |

## DB publishable facility count (reference)

Run `python3 scripts/validate/sitemap_diff.py --env production` for current orphan/missing lists.
