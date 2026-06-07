---
name: Audit Report Implementation
overview: "Execute the external audit’s critical fixes against the StarlynnCare codebase: restore `/california/san-francisco`, eliminate orphan hub URLs by linking every DB-backed city from the state page, close OG/image gaps, fix stale “grades” copy, and optionally correct the Citrus Heights slug typo. Longer content/E-E-A-T work is sequenced as a second wave."
todos:
  - id: sf-region-ingest
    content: Add San Francisco to regions.ts; ingest SAN FRANCISCO county via ccld_rcfe_ingest; verify resolveListingRegion + hub 200
    status: pending
  - id: state-hub-all-cities
    content: Extend /california to query distinct publishable city_slug values and link every hub (dedupe with REGIONS)
    status: pending
  - id: og-default-image
    content: Add public OG default asset; wire facility + city metadata fallbacks when photo_url missing
    status: pending
  - id: copy-grades-removal
    content: Replace quality grades strings on [state]/[city]/page.tsx metadata and body
    status: pending
  - id: citrus-redirect
    content: Fix cirtus-heights city_slug in DB + optional next.config redirect
    status: pending
  - id: verify-h1
    content: Confirm single h1 on homepage across breakpoints; fix MobileHomeView if both h1 mount
    status: pending
  - id: wave2-backlog
    content: Track editorial-policy, about expansion, pillars, email capture as follow-up epics
    status: pending
isProject: false
---

# StarlynnCare — Audit Report Implementation Plan

This plan translates [StarlynnCare_Audit_Report.md](/Users/blakejones/Downloads/StarlynnCare_Audit_Report.md) into concrete work items grounded in the repo. Scope is split into **Wave 1 (this codebase — technical SEO)** and **Wave 2 (content / E-E-A-T / expansion)**.

---

## Root causes (verified in code)

### 1. `/california/san-francisco` 404

- [`src/lib/regions.ts`](src/lib/regions.ts) only defines **four** Bay Area counties (Alameda, Contra Costa, San Mateo, Santa Clara). **San Francisco is not a region.**
- [`src/lib/resolveListingRegion.ts`](src/lib/resolveListingRegion.ts) falls back to DB: one row with `city_slug = san-francisco` and `publishable = true`. If SF has **no** publishable facilities (ingest scope / MC gate), resolution returns `null` → [`notFound()`](src/app/[state]/[city]/page.tsx).
- **Fix is two-sided:** add SF to static regions so the hub exists even with zero rows *or* ensure SF county ingest + publishable facilities; practically **both** for SEO.

### 2. ~192 orphan pages

- [`src/app/[state]/page.tsx`](src/app/[state]/page.tsx) builds the “Cities with live profiles” grid **only** from static [`regionsForState`](src/lib/regions.ts) — i.e. Bay Area cities under `REGIONS`. It **does not** list Los Angeles, San Diego, Orange County cities, Sacramento, Riverside, San Francisco, etc., even when [`sitemap.xml`](src/app/sitemap.xml/route.ts) emits `/california/{city_slug}` from distinct DB `city_slug` values.
- Facility profiles still breadcrumb-link to [`/${state}/${facility.city_slug}`](src/app/[state]/[city]/[facility]/page.tsx) (`backHref`), but **the state hub never links down** to those city hubs — a classic recipe for Ahrefs “orphans” on city hubs and weak equity flow.
- **Fix:** Add a **query-driven section** on `/california`: distinct `city_slug` (with counts) for `publishable` CA facilities, merge/dedupe with static region links, sort (e.g. by count then name). Optionally group “Bay Area (curated)” vs “More California cities” for readability.

### 3. Incomplete Open Graph (78 pages)

- [`src/app/[state]/[city]/[facility]/page.tsx`](src/app/[state]/[city]/[facility]/page.tsx) `generateMetadata` sets `openGraph.images` only when [`facility.photo_url`](src/app/[state]/[city]/[facility]/page.tsx) exists (lines ~195–197). Facilities **without** photos lack `og:image` — matches audit.
- City hub [`generateMetadata`](src/app/[state]/[city]/page.tsx) has title/description/url but **no** `openGraph.images` / `twitter.images`.
- **Fix:** Introduce a **default OG image** (e.g. `/og-default.png` or existing brand asset under `public/`) and spread it into metadata when `photo_url` is absent; add the same default on city (and optionally state) templates per [`docs/SEO_GEO_CONVENTIONS.md`](docs/SEO_GEO_CONVENTIONS.md).

### 4. Stale copy (“quality grades”)

- [`src/app/[state]/[city]/page.tsx`](src/app/[state]/[city]/page.tsx) still says “quality grades” in meta description and body copy (lines ~37, ~158, ~270) after grades were removed from the UI.
- **Fix:** Replace with inspection/comparison language consistent with current product.

### 5. Sitemap typo `/california/cirtus-heights`

- Sitemap is built from DB [`city_slug`](src/app/sitemap.xml/route.ts). The typo lives in **data**, not TS.
- **Fix:** One-time SQL `UPDATE facilities SET city_slug = 'citrus-heights' WHERE city_slug = 'cirtus-heights'` (and reconcile slug uniqueness / conflicts); add **301 redirect** in [`next.config.ts`](next.config.ts) or proxy from old path to new for residual links.

### 6. Duplicate H1 (appendix)

- Current [`src/app/page.tsx`](src/app/page.tsx) shows a single desktop `<h1>`; [`MobileHomeView.tsx`](src/components/mobile/MobileHomeView.tsx) has its own `<h1>` (responsive shell). **Verify** on live HTML that only one `h1` renders per viewport; if both mount, convert one to `h2` for accessibility.

---

## Wave 1 — Implementation sequence (recommended order)

| Priority | Task | Primary files |
|----------|------|----------------|
| P0 | **San Francisco hub + data** | [`regions.ts`](src/lib/regions.ts) — add `san-francisco-county` or city region with `citySlugs: ['san-francisco']`. Run [`scrapers/ccld_rcfe_ingest.py`](scrapers/ccld_rcfe_ingest.py) with `--county "SAN FRANCISCO"` (or correct CKAN county name), then pipeline as today. Re-run until `resolveListingRegion('california','san-francisco', …)` returns non-null and/or facilities appear. |
| P0 | **State hub: link all cities with publishable facilities** | [`src/app/[state]/page.tsx`](src/app/[state]/page.tsx) — `select` distinct `city_slug` + counts from `facilities` where `state_code = CA` and `publishable`; render internal links for every slug not already covered; dedupe with existing grid. |
| P1 | **Default OG image** | [`src/app/layout.tsx`](src/app/layout.tsx) and/or per-route `metadata.openGraph.images` + facility/city fallbacks; add asset under `public/`. |
| P1 | **Remove “quality grades” strings** | [`src/app/[state]/[city]/page.tsx`](src/app/[state]/[city]/page.tsx) |
| P2 | **Citrus Heights data + redirect** | Supabase migration script or one-off SQL + [`next.config.ts`](next.config.ts) redirect |
| P2 | **Performance (13 slow pages)** | Image pipeline: ensure Next/Image for hero photos, compress sources in [`fetch_photos`](scrapers/fetch_photos.py) / storage — confirm targets from Lighthouse URLs |

---

## Wave 2 — Content, E-E-A-T, and expansion (audit §5 — no code detail unless scoped)

Deferred as separate epics (each can be its own PR):

- Expand [`/about`](src/app/about/page.tsx), add `/editorial-policy`, author bylines on guides, homepage outbound links to authoritative sources.
- Pillar content: cost guide, comparison hubs, CA glossary with `DefinedTerm` schema (reuse [`src/lib/seo/schema.ts`](src/lib/seo/schema.ts)).
- Email capture + PDF lead magnet (waitlist API exists at [`/api/waitlist`](src/app/api/waitlist) — wire UI).
- FAQPage JSON-LD on city/county hubs (extend [`buildFaqPageSchema`](src/lib/seo/schema.ts) usage on [`[state]/[city]/page.tsx`](src/app/[state]/[city]/page.tsx)).
- Second state (Texas) — new ingest + `regions` pattern; out of scope for this audit fix batch.

---

## Success criteria

- `/california/san-francisco` returns **200** with valid metadata and (once ingested) facility list or explicit empty state aligned with product rules.
- Ahrefs re-crawl: **orphan count drops materially**; every sitemap city hub with publishable facilities has at least one **navigational** internal link from `/california` or a parent hub.
- Spot-check: random LA/SD facility profile → city hub reachable from `/california` without relying on breadcrumbs only.
- OG: sample facilities **without** `photo_url` still emit `og:image`.
- No remaining user-facing “quality grades” on city templates.

---

## Out of scope / assumptions

- **Brand Radar / Ahrefs API gaps** — operational; cannot implement in repo.
- **192 orphans exact match** — depends on re-crawl; goal is structural fix, not a magic number.
- If SF intentionally has **zero** publishable MC facilities after ingest, product choice: **stub hub** (“coverage expanding”) vs **404** — audit recommends stub; implementation should match business preference.
