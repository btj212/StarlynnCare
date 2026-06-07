# SEO / GEO conventions (StarlynnCare)

Every new public route must satisfy this contract so canonical URLs, JSON-LD, and AI-facing copy stay consistent as we add states and cities.

## 1. Canonical URL

- Use [`canonicalFor`](../src/lib/seo/canonical.ts) with a path starting with `/` (e.g. `canonicalFor("/california/oakland")`).
- Set `alternates: { canonical }` in that route’s `generateMetadata` (or `metadata` export for static pages).
- Production origin defaults to `https://www.starlynncare.com`; override with `NEXT_PUBLIC_SITE_URL` for staging.

## 2. JSON-LD

- **Do not** hand-write `<script type="application/ld+json">` in page files.
- Compose objects with pure builders in [`src/lib/seo/schema.ts`](../src/lib/seo/schema.ts) and render via [`<JsonLd />`](../src/components/seo/JsonLd.tsx) (one script block per top-level object).
- **Minimum** on any indexable page: `BreadcrumbList` + `WebPage` (with `reviewedBy` where editorial context applies).

## 3. Honesty rules (no fabrication)

- **`aggregateRating`** on `LocalBusiness`: only when there is at least one **published** review in the DB. Never invent counts or stars.
- **`geo`**: only when `facilities.latitude` / `facilities.longitude` are present and parse as finite numbers. Omit otherwise.
- **`sameAs` (CDSS)**: use [`cdssLicensePageFor`](../src/lib/seo/schema.ts) with the real `license_number`; omit if missing.
- **`priceRange`**: placeholder `$$` is acceptable until fee data is sourced; do not claim dollar amounts without a cited source.

## 4. Governance copy

- The 24-word independence statement lives in [`src/lib/seo/governance.ts`](../src/lib/seo/governance.ts). Edit in one place only; keep [`/llms.txt`](../src/app/llms.txt/route.ts) aligned.

## 5. Dataset schema

- The primary `Dataset` JSON-LD for the inspection corpus is emitted from [`/data`](../src/app/data/page.tsx) via `buildDatasetSchema`. Do not duplicate competing Dataset blocks elsewhere unless intentionally documenting a second corpus.

## 6. Adding a new state

1. Add the state to [`src/lib/states.ts`](../src/lib/states.ts) and regions as needed.
2. Ensure `generateMetadata` + `<JsonLd />` on `/[state]` and child listing pages use the same builders as California.
3. Update [`/llms.txt`](../src/app/llms.txt/route.ts) if you add state-specific “key URLs” or coverage notes.

## 7. Ingest ↔ schema fields

- Scrapers should populate **`latitude` / `longitude`**, **beds**, **license_type**, and **care_category** where the source provides them — they feed facility `LocalBusiness` / `MedicalOrganization` schema. See [`scrapers/README.md`](../scrapers/README.md).

## 8. Editorial design system v1 (added 2026-04-26)

Every public hub page (state, county/city listing, homepage) must use the editorial primitives from `src/components/editorial/` instead of bespoke section markup:

### Primitives

| Component | Location | When to use |
|---|---|---|
| `<SectionHead label="§ N · Title" title={<>…</>}>` | `src/components/editorial/SectionHead.tsx` | Every named section on a hub page. `label` is small-caps JetBrains Mono; `title` is Instrument Serif display. Pass `invert` for dark-background sections. |
| `<StatBlock stats={StatItem[]} footnotes={string[]}>` | `src/components/editorial/StatBlock.tsx` | Any grid of citable numeric stats. Sources automatically appear as `[N] SRC` in the top-right of each cell. |
| `<DataFootnote source="…" refreshed="…" />` | `src/components/editorial/DataFootnote.tsx` | Inline citation attached to any sentence or block that makes a dated numeric claim. |

### Design tokens (Tailwind `@theme` keys)

Core palette: `paper`, `paper-2`, `paper-rule`, `ink`, `ink-2`, `ink-3`, `ink-4`, `teal`, `teal-deep`, `teal-soft`, `rust`, `rust-soft`, `gold`, `gold-soft`.
Grade tier: `grade-a`, `grade-b`, `grade-c`, `grade-d`, `grade-f`.
Legacy aliases (`navy`, `warm-white`, `slate`, `muted`, `sc-border`, `footer-bg`, etc.) are still valid — they map to the nearest editorial token.

### Typography classes

| Intent | Class pattern |
|---|---|
| Display / editorial headlines | `font-[family-name:var(--font-display)]` |
| UI text, body | `font-[family-name:var(--font-sans)]` (default body) |
| Data, citations, mono | `font-[family-name:var(--font-mono)]` |
| Small-caps labels | `.smallcaps` utility class |

### Required per page

1. **Governance bar**: use `<GovernanceBar />` at the top of every hub page. Not on Clerk/auth routes.
2. **Site chrome**: `<SiteNav />` (async server component, fetches live facility count) + `<SiteFooter />` (async, fetches last-refreshed date).
3. **No fictional numbers**: any stat visible to users must come from the DB or a confirmed policy constant (`GOVERNANCE_24_WORDS`, `0` commissions). Never paste prototype placeholder numbers into production.

## 8b. Physical city — authoritative source and 301 redirect policy

### Source of truth

`facilities.city` and `facilities.city_slug` must reflect the **physical city** (US Census Incorporated Place or Census Designated Place), never the USPS mailing city from a state directory feed.

**Why it matters:** State directory feeds publish USPS mailing addresses. USPS assigns many suburb addresses to nearby larger cities for mail routing (e.g. Taylorsville, UT → "Salt Lake City"). A YMYL directory where the URL says one city and the page body says another creates a canonical inconsistency that fails Google Quality Rater guidelines for health/medical content.

### How physical city is derived

After `scrapers/geocode_facilities.py` fills `latitude`/`longitude`, run:

```bash
python -u scrapers/recompute_physical_city.py --state XX --apply
```

This calls the [US Census Geocoder](https://geocoding.geo.census.gov/geocoder/geographies/coordinates) (free, public, government-run) for each facility's coordinates and resolves the containing Incorporated Place (preferred) or Census Designated Place. Results are cached in `data/.cache/census_geo.json` so re-runs are idempotent.

### Slug rewrite and 301 redirects

When `recompute_physical_city.py` changes a facility's `city_slug`, the prior slug is appended to `facilities.historical_city_slugs text[]`. `loadFacilityProfile` in `src/lib/facility/loadFacilityProfile.ts` checks this array on a cache miss and calls `permanentRedirect` (true HTTP 301) to the canonical city/facility path.

Three things must always agree for any given facility:
1. `/{state}/{city_slug}/{facility_slug}` URL
2. Visible city in the breadcrumb and page body
3. `LocalBusiness.address.addressLocality` in JSON-LD

**Never use a render-time display override** (e.g. `displayCity` that differs from `city_slug`) to paper over a slug that hasn't been updated — this is the "Option C trap" documented in MEMORY.md 2026-05.

### Required by the new-state playbook

Step 2 of every new-state pipeline is `recompute_physical_city.py`. Skipping it ships USPS mailing cities and requires a post-launch URL migration. See `docs/NEW_STATE_PLAYBOOK.md` for the complete pipeline sequence.

---

## 9. GEO conventions for hub pages

Hub pages (state, county, city) and editorial articles must follow this pattern to maximize AI Mode / AI Overviews / agent-search citation eligibility:

1. **Visible date stamp.** Render `<UpdatedStamp isoDate={findingsDate} />` (`src/components/editorial/UpdatedStamp.tsx`) directly under the H1+lede block. Source the date from the latest `facilities.updated_at` for that scope. Omit when `findingsDate` is null (Supabase unreachable).

2. **Speakable JSON-LD.** Append `buildSpeakableSchema({ url, cssSelectors: ["#hub-lede", "#hub-stats"] })` to the page's JSON-LD array. Selectors must target `id` attributes on real DOM elements. The lede paragraph carries `id="hub-lede"`; the StatBlock wrapper carries `id="hub-stats"`.

3. **Methodology callout above the facility list.** A one-to-two sentence `<aside>` in monospace text linking to `/methodology`. This is the signal AI systems extract as evidence that the site documents its scoring rules.

4. **Enforcement / regulatory-context paragraph** when relevant. For CA county hubs with Type-A citations in the last 12 months, render a prose paragraph above the citation grid naming the count and linking to CDSS. Pattern: paragraph → structured list/table. The paragraph is what AI surfaces as a citation; the table provides supporting detail.

5. **FAQ answers as factual sentences.** Each answer in `buildCityFaqs` should be 2-4 factual sentences, not question-bait. At least one Q/A pair must reference StarlynnCare's methodology or data sourcing. Generic questions ("What is memory care?") do not belong in hub FAQs — keep the scope to *this county/city's licensed memory care landscape*.

### Machine-readable facility data

The per-state JSON API at `/api/facilities/[state]` (e.g. `/api/facilities/california`) exposes the same data the `LocalBusiness` JSON-LD encodes. It is referenced from `/llms.txt` so AI crawlers prefer the JSON path over HTML extraction. Fields: canonical URL, license number, state regulator URL, capacity, care category, last inspection date, total deficiency count, `updated_at`.

- Route: `src/app/api/facilities/[state]/route.ts`
- Revalidate: 3600 (matches hub cadence)
- CORS: `Access-Control-Allow-Origin: *` (intentional — researchers and AI crawlers are welcome)


