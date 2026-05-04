# Phase 4 county coverage audit (California)

**Date:** 2026-05-03 (post–Phase 4 CKAN ingest + MC signal refresh + `recompute_publishable`)  
**Method:** Read-only SQL against `facilities` where `state_code = 'CA'` and `publishable = true`, counting rows whose `city_slug` appears in the Phase 4 county seed lists in [`src/lib/regions.ts`](../src/lib/regions.ts) (`RIVERSIDE_COUNTY_CITIES` … `MENDOCINO_COUNTY_CITIES`).

**Hub behavior:** County/city listing hubs call `notFound()` when `countPublishableFacilitiesInRegion` is `0` (see [`src/app/[state]/[city]/page.tsx`](../src/app/[state]/[city]/page.tsx)). Counties with **0** publishable facilities in their seed cities therefore **404** until ingest maps facilities into those `city_slug` values.

## Aggregate counts (publishable facilities in county seed cities)

| County slug              | Publishable count | Prod hub (`GET /california/{slug}`) |
| ------------------------ | ----------------: | ------------ |
| `riverside-county`       |                38 | 200 (listings) |
| `placer-county`          |                 1 | 200 (thin) |
| `el-dorado-county`       |                 1 | 200 |
| `yolo-county`            |                 0 | **404** (empty guardrail) |
| `marin-county`           |                 1 | 200 |
| `santa-cruz-county`      |                 3 | 200 |
| `santa-barbara-county`   |                 6 | 200 |
| `san-luis-obispo-county` |                 2 | 200 |
| `napa-county`            |                 1 | 200 |
| `mendocino-county`       |                 0 | **404** (empty guardrail) |

Note — **Yolo / Mendocino:** roster rows exist from CKAN ingest, but **no facility is currently `publishable`** under Option C rules (Tier-1 MC signals + review gates), so county hubs correctly **404** until promotion signals appear.

## Riverside — publishable rows by `city_slug` (for ingest prioritization)

| city_slug       | Count |
| --------------- | ----: |
| riverside       |     9 |
| corona          |     6 |
| hemet           |     6 |
| rancho-mirage   |     4 |
| murrieta        |     3 |
| la-quinta       |     2 |
| temecula        |     2 |
| palm-desert     |     1 |
| palm-springs    |     1 |
| moreno-valley   |     1 |
| eastvale        |     1 |
| perris          |     1 |
| menifee         |     1 |

## Placer — publishable rows by `city_slug`

| city_slug | Count |
| --------- | ----: |
| roseville |     1 |

---

## CDSS weekly ingest — manual dispatch (secret check)

- **Workflow:** [`.github/workflows/cdss-weekly-ingest.yml`](../.github/workflows/cdss-weekly-ingest.yml) (`workflow_dispatch` enabled).
- **Run:** `gh workflow run "CDSS weekly ingest"` → run ID **25295118495** (2026-05-04).
- **Result:** **Failed** — `DATABASE_URL` is present in Actions (masked), but `psycopg` could not connect: **IPv6** target `connection to server … port 5432 failed: Network is unreachable`.
- **Follow-up:** Use a Supabase **connection pooler** URL or host that resolves/connects over **IPv4** from GitHub-hosted runners, or adjust network access so the runner can reach the DB.

---

## Production smoke checks (`https://www.starlynncare.com`)

Performed 2026-05-04:

| Check | Result |
| ----- | ------ |
| `GET /sitemap.xml` | 200 — index lists `sitemap-static.xml`, `sitemap-hubs.xml`, `sitemap-facilities.xml` |
| Child sitemaps | 200 each |
| `GET /llms.txt` | 200 — editorial list + hub lines present |
| `/library/memory-care-vs-nursing-home`, `/library/medi-cal-and-memory-care`, `/library/dementia-vs-alzheimers-vs-lewy-body`, `/library/when-is-it-time-for-memory-care`, `/california/cost-by-city` | 200 |
| `/library` (no slash) | 200 |
| Empty hub example `/california/mendocino-county` | **404** (guardrail) |

**Note:** After the next deploy that includes the `/library` hub index and updated `llms` pillar list, re-check that `sitemap-static.xml` contains `https://www.starlynncare.com/library` and that `/llms.txt` lists the library index URL if desired for parity with [`src/lib/llms/buildLlmsTxt.ts`](../src/lib/llms/buildLlmsTxt.ts).

---

## System health verification (2026-05-04)

### IPv4 + CDSS ingest

- **GitHub Actions run [25298282183](https://github.com/btj212/StarlynnCare/actions/runs/25298282183):** **success** (~18m38s). `ccld_citations_ingest.py --publishable` completed with exit code 0 after updating `DATABASE_URL` to the **IPv4 session pooler** (shared pooler, `aws-1-us-east-1.pooler.supabase.com:5432`).
- **Local `psql`:** Sanity query against [`.env.local`](../.env.local) `DATABASE_URL` succeeds.

### Production URL sweep (post-deploy snapshot)

Re-run after each deploy. Checks:

| Check | Result (2026-05-04) |
| ----- | ------------------- |
| `/sitemap.xml` → 3 children | 200; children 200 each |
| `/sitemap-static.xml` contains `/library` | Yes |
| `/llms.txt` lists `https://www.starlynncare.com/library` | Yes |
| Pillar URLs + `/california/cost-by-city` | 200 |
| `/california/mendocino-county` | **404** (empty hub guardrail) |

**`/library` hub:** Production previously **308 redirected** `/library` → `/library/type-a-vs-type-b-deficiencies-explained` because of a stale redirect in [`next.config.ts`](../next.config.ts). That redirect was **removed** so the editorial hub index at [`src/app/library/page.tsx`](../src/app/library/page.tsx) can serve. **Deploy required** for this fix to appear on `www`.

### Rewritten copy (spot checks)

Unique phrases present in production HTML:

- Medi-Cal: `Assisted Living Waiver, in plain language`
- Memory care vs. SNF: `Two regulators, two very different public records`

### Google Rich Results Test (manual)

Tool: [Rich Results Test](https://search.google.com/test/rich-results). Paste each URL and confirm no **critical** errors (warnings are often acceptable):

1. `https://www.starlynncare.com/library` (after hub redirect fix is deployed)
2. `https://www.starlynncare.com/library/memory-care-vs-nursing-home`
3. `https://www.starlynncare.com/library/medi-cal-and-memory-care`
4. `https://www.starlynncare.com/library/dementia-vs-alzheimers-vs-lewy-body`
5. `https://www.starlynncare.com/library/when-is-it-time-for-memory-care`
6. `https://www.starlynncare.com/california/cost-by-city`

**Automated proxy:** Fetched pages include `application/ld+json` for the five article URLs above; hub page must be re-tested after deploy.

### Data integrity (read-only)

| Metric | Value |
| ------ | ----- |
| CA licensed rows (`LICENSED`) | 5,455 |
| CA `publishable` facilities | 483 |
| CA `serves_memory_care` (licensed) | 483 |
| CA `mc_review_status = needs_review` (licensed) | 384 |
| Publishable missing `photo_url` | 19 |
| Distinct `city_slug` (publishable) | _(see SQL)_ |

**Orphan `city_slug` check (publishable vs seed lists):** Compared publishable rows to every `*_COUNTY_CITIES` array in [`src/lib/regions.ts`](../src/lib/regions.ts). After expanding LA / Sacramento / San Diego / SLO seeds (neighborhood + CDP slugs), adding `slugify_city()` typo alias `cirtus-heights` → `citrus-heights` in [`scrapers/ccld_rcfe_ingest.py`](../scrapers/ccld_rcfe_ingest.py), and a one-time DB fix for the legacy `cirtus-heights` row, **no publishable facility remains outside the county city-slug seeds** except the **`san-francisco`** standalone region (intentional — not part of a `*_COUNTY_CITIES` constant).

**Phase 4 production curl (snapshot):** `el-dorado-county`, `marin-county`, `santa-cruz-county`, `santa-barbara-county`, `san-luis-obispo-county`, `napa-county` → **200**. `yolo-county`, `mendocino-county` → **404** (0 publishable in county seeds).

**Backfill batch (local scrapers):** `fetch_photos.py` (118 candidates → 99 fetched / 19 no Street View), `summarize_inspections.py` (266 inspection summaries written), `generate_content.py` (48 new content blocks; remainder already filled).

### Monday scheduled ingest

Cron: Mondays **10:00 UTC** — [`.github/workflows/cdss-weekly-ingest.yml`](../.github/workflows/cdss-weekly-ingest.yml).

**After the first Monday post–IPv4 fix:** Open Actions → latest **CDSS weekly ingest** scheduled run → confirm **success**. Optionally compare `SELECT COUNT(*) FROM facilities WHERE state_code='CA' AND publishable` before/after that run.
