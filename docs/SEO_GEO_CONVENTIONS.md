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
