# Post-deploy verification — California KD-4 hubs (May 2026)

After merge/deploy, run these checks (plan §2.4).

## HTTP 200 (examples — 3 counties + 3 cities)

```bash
for path in \
  fresno-county monterey-county san-bernardino-county \
  bakersfield salinas stockton; do
  curl -sI "https://www.starlynncare.com/california/${path}" | head -1
done
```

Expect `HTTP/2 200` (or `HTTP/1.1 200`) for each.

## Rich Results / structured data

Use [Google Rich Results Test](https://search.google.com/test/rich-results) on the same URLs (or View Source and confirm `canonical`, `og:image`, `BreadcrumbList` / FAQ JSON-LD as emitted by the hub template).

Optional: repeat with any three additional slugs from `src/lib/regions.ts` for the new counties/cities.
