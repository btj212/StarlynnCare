# Schema Audit Checklist — Rich Results Test (Checkpoint 2)
> **STATUS: Audit draft — for internal review only. Not published.**
> Audited: May 10, 2026
> Source: `src/lib/seo/schema.ts`, `src/lib/facility/loadFacilityProfile.ts`, page components
> P0 = blocks or significantly weakens rich results | P1 = improves them | P2 = nice to have

---

## 1. Facility profile page

**Current JSON-LD emitted** (`loadFacilityProfile.ts` → `profile.jsonLd`):
- `LocalBusiness + MedicalOrganization` (via `buildLocalBusinessForFacility`)
  - `name`, `url`, `description` (mirrors meta snippet)
  - `telephone`, `image`, `priceRange: "$$"`, `medicalSpecialty: "Geriatric"`
  - `address` (PostalAddress with street/city/zip/state)
  - `geo` (GeoCoordinates — only emitted when lat/lng are present and finite ✅)
  - `sameAs` (regulator portal URL + operator website when present)
  - `additionalProperty` (license number, bed count, license type, care category)
  - `parentOrganization` (operator name when present)
  - `aggregateRating` (only emitted when published reviews exist ✅)
- `BreadcrumbList` (Home → State → City/County → Facility)
- `Review` objects (one per published review, each with `reviewRating`)
- `FAQPage` (tour questions — emitted only when tour questions exist)

**Gaps:**

| Gap | Priority | Detail |
|-----|----------|--------|
| **No `WebPage` node with `reviewedBy`** | **P0** | Every other indexed page (articles, city hubs, state hubs, about, editorial policy) emits `buildWebPageWithReviewer`. Facility profiles — the highest-traffic YMYL pages — do not. The SEO conventions doc (`docs/SEO_GEO_CONVENTIONS.md`) requires: "Minimum on any indexable page: BreadcrumbList + WebPage (with reviewedBy where editorial context applies)." Facility profiles carry editorial commentary (`what_families_should_know`), grades, and inspection context — editorial context clearly applies. Fix: add `buildWebPageWithReviewer` to the `jsonLd` array in `loadFacilityProfile.ts`. |
| **`FAQPage` uses template answer text** | **P0** | `buildFaqPageSchema` in `schema.ts` hardcodes a single template answer for all questions: `"When touring this facility, ask staff this question directly..."` Google's FAQ rich results require substantive answers. Template answers that are identical across all facilities may suppress FAQ rich results or trigger a manual action under the "Unhelpful content" policy. Fix: either (a) populate real answers per question, or (b) stop emitting `FAQPage` on facility profiles until real per-question answers are sourced. |
| **`logo` missing from `LocalBusiness`** | **P1** | `LocalBusiness` does not include a `logo` property. Google uses this for knowledge panel display. Facility profile pages that get a knowledge panel will not show a logo. Fix: pass the facility's `photo_url` as `image` (already done) and additionally add `logo` pointing to a StarlynnCare watermarked or generic facility thumbnail. |
| **`openingHours` / `openingHoursSpecification` absent** | **P1** | `LocalBusiness` rich results are strengthened by hours. Memory care facilities are 24/7 operations. Even a placeholder `Mo-Su 00:00-24:00` improves rich result eligibility. However, only add this if the value is confirmed for each facility — per the no-fabrication rule. If unknown, omit. |
| **`priceRange: "$$"` is a placeholder** | **P1** | `"$$"` is hardcoded in `buildLocalBusinessForFacility` regardless of actual cost data. This is acknowledged in the code as acceptable until fee data is sourced. Once cost data is available per facility, replace with a real range or use the `offers` property with a stated `priceCurrency` and range. |
| **`serviceType` / `availableService` absent** | **P2** | `MedicalOrganization` supports `availableService` (type: `MedicalProcedure` or `Service`). A `serviceType: "Memory care"` node would make the facility's specialty machine-readable beyond just `medicalSpecialty: "Geriatric"`. |
| **`isAcceptingNewPatients` absent** | **P2** | `MedicalOrganization` supports `isAcceptingNewPatients` (boolean). Not currently tracked in the data model. Mark as future enhancement once intake data is available. |

---

## 2. City hub page

**Current JSON-LD emitted** (`src/app/[state]/[city]/page.tsx`):
- `BreadcrumbList` (Home → State → City)
- `WebPage` with `reviewedBy: buildStarlynnPerson()` ✅ (via `buildWebPageWithReviewer`)
- `FAQPage` with real Q+A pairs (via `buildFaqSchemaFromPairs`) ✅
- `CollectionPage` with `about: City` (via `buildCollectionPageSchema`)

**Gaps:**

| Gap | Priority | Detail |
|-----|----------|--------|
| **`CollectionPage` lacks `ItemList` link to facilities** | **P1** | `buildCollectionPageSchema` emits `CollectionPage` with geographic `about` context but no `ItemList` of the facilities in that city. An `ItemList` with `LocalBusiness` items would signal to Google that the page is a structured directory of specific places, not just editorial content about a city. This improves sitelinks and "list of X" rich results. The city page already fetches facility data for display — the slug/name data needed to emit an `ItemList` is available at render time. |
| **`CollectionPage` missing `dateModified`** | **P2** | Freshness signals matter for directory pages. Adding a `dateModified` tied to the most recent data ingest (already available via the footer refresh date) would improve crawl prioritization. |
| **`CollectionPage` not linked into `WebSite` graph** | **P2** | `CollectionPage` has no `isPartOf` pointing to the `WebSite` node. Articles include this via `buildWebPageWithReviewer`. Adding `isPartOf: { "@type": "WebSite", name: "StarlynnCare", url: SITE_ORIGIN }` would link the page into the site's schema graph. |

---

## 3. Article pages

**Current JSON-LD emitted** (library/state article pages):
- `Article` (via `buildArticleSchema`) with `author: buildStarlynnPerson()`, `reviewedBy: buildStarlynnPerson()`, `datePublished`, `dateModified`, `headline`, `image`, `publisher`
- `BreadcrumbList`
- `WebPage` with `reviewedBy` (via `buildWebPageWithReviewer`, emitted separately from `Article`)
- `FAQPage` with real Q+A pairs (where applicable)

**Gaps:**

| Gap | Priority | Detail |
|-----|----------|--------|
| **`Article` type instead of `MedicalWebPage`** | **P0** | Google's health content quality guidelines treat `MedicalWebPage` as the appropriate type for YMYL healthcare content. `MedicalWebPage` unlocks semantically meaningful properties: `lastReviewed`, `reviewedBy` (natively on the page type, not just the embedded `WebPage`), `medicalAudience` (e.g., `Patient`, `Caregiver`), and `aspect` (the health aspect covered). For eldercare regulatory guides, `MedicalWebPage` is more accurate than generic `Article`. Fix: change `"@type": "Article"` to `["Article", "MedicalWebPage"]` in `buildArticleSchema`, and add `lastReviewed` and `medicalAudience` properties. |
| **`lastReviewed` absent from `Article` schema** | **P1** | `buildArticleSchema` emits `datePublished` and `dateModified` but not `lastReviewed`. For `MedicalWebPage`, `lastReviewed` is a first-class property that tells quality raters and algorithms when clinical content was last assessed for accuracy. Currently `dateModified` defaults to `datePublished` when not overridden, meaning all articles appear never-updated. Fix: add `lastReviewed` support to `buildArticleSchema` once a review-tracking mechanism is in place. |
| **`medicalAudience` absent** | **P1** | `MedicalWebPage` supports `medicalAudience` (e.g., `{ "@type": "MedicalAudience", "audienceType": "Caregiver" }`). All StarlynnCare articles target caregivers and families, not clinicians. Adding this makes the intended audience machine-readable and aligns with Google's health content policies. |
| **Duplicate `reviewedBy` on `Article` and `WebPage`** | **P2** | Both the `Article` node and the separately emitted `WebPage` node include `reviewedBy: buildStarlynnPerson()`. This is redundant but not harmful. Once `Article` is upgraded to `MedicalWebPage`, the `reviewedBy` on the `Article` itself is the canonical signal and the separate `WebPage` node may become unnecessary. |

---

## 4. Homepage

**Current JSON-LD emitted** (`src/app/page.tsx` or equivalent):
- `@graph` containing:
  - `Organization` (via `buildOrganizationSchema`) — with `name`, `url`, `logo`, `description`, `foundingDate`, `founder`, `employee`, `knowsAbout`, `funding`, `sameAs`
  - `WebSite` (via `buildWebSiteSchema`) — with `name`, `url`, `publisher`
  - `Person` (Starlynn — via `buildStarlynnPerson()`)
  - `Person` (Blake — via `buildPersonSchema`)
- `FAQPage` with real Q+A pairs

**Gaps:**

| Gap | Priority | Detail |
|-----|----------|--------|
| **No `WebPage` node for the homepage** | **P1** | The `@graph` establishes Organization and WebSite nodes but emits no `WebPage` node for the homepage URL itself. A homepage `WebPage` with `reviewedBy: buildStarlynnPerson()` would extend the editorial trust chain to the site's entry point — the same pattern applied on every other indexed page. Fix: add `buildWebPageWithReviewer({ name: "StarlynnCare", url: SITE_ORIGIN })` to the homepage JSON-LD. |
| **`WebSite` missing `SearchAction`** | **P1** | Google can surface a sitelinks search box in the SERP for sites that emit a `SearchAction` on their `WebSite` node. StarlynnCare has facility search functionality. Emitting `potentialAction: { "@type": "SearchAction", target: "..." }` on `buildWebSiteSchema` would make the search box eligible. |
| **`Organization` missing `contactPoint`** | **P2** | `buildOrganizationSchema` does not include a `contactPoint`. A `ContactPoint` with `contactType: "customer support"` and `email: "hello@starlynncare.com"` would improve the Organization's rich result eligibility and give Google a structured place to surface the contact email. |
| **`Organization` missing `areaServed`** | **P2** | The Organization serves five states. Adding `areaServed: [{ "@type": "State", name: "California" }, ...]` makes the geographic scope of the directory machine-readable. Relevant for AI Overviews and local-pack disambiguation. |

---

## Priority summary

| Priority | Count | Top items |
|----------|-------|-----------|
| P0 | 3 | Facility profiles missing `WebPage/reviewedBy`; `FAQPage` template answers on facility profiles; Articles should use `MedicalWebPage` |
| P1 | 7 | City hub `ItemList`; homepage `WebPage` node; homepage `SearchAction`; `logo` on `LocalBusiness`; `lastReviewed` on articles; `medicalAudience` on articles; `openingHours` (once data available) |
| P2 | 7 | Various `CollectionPage`, `Organization`, and structural polish items |

**Recommended fix order:**
1. Add `WebPage` + `reviewedBy` to facility profiles in `loadFacilityProfile.ts` (one-line addition, high E-E-A-T impact)
2. Upgrade `Article` to `["Article", "MedicalWebPage"]` in `buildArticleSchema` and add `lastReviewed` + `medicalAudience`
3. Either fix `FAQPage` facility answers with real content or remove `buildFaqPageSchema` from facility profiles until real answers are available
4. Add `ItemList` to city hub pages
5. Add `WebPage` to homepage `@graph` + `SearchAction` to `WebSite`
