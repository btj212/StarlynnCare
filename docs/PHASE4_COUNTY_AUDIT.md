# Phase 4 county coverage audit (California)

**Date:** 2026-05-04  
**Method:** Read-only SQL against `facilities` where `state_code = 'CA'` and `publishable = true`, counting rows whose `city_slug` appears in the Phase 4 county seed lists in [`src/lib/regions.ts`](../src/lib/regions.ts) (`RIVERSIDE_COUNTY_CITIES` … `MENDOCINO_COUNTY_CITIES`).

**Hub behavior:** County/city listing hubs call `notFound()` when `countPublishableFacilitiesInRegion` is `0` (see [`src/app/[state]/[city]/page.tsx`](../src/app/[state]/[city]/page.tsx)). Counties with **0** publishable facilities in their seed cities therefore **404** until ingest maps facilities into those `city_slug` values.

## Aggregate counts (publishable facilities in county seed cities)

| County slug              | Publishable count | Expected hub |
| ------------------------ | ----------------: | ------------ |
| `riverside-county`       |                38 | 200 (listings) |
| `placer-county`          |                 1 | 200 (thin) |
| `el-dorado-county`       |                 0 | **404** |
| `yolo-county`            |                 0 | **404** |
| `marin-county`           |                 0 | **404** |
| `santa-cruz-county`      |                 0 | **404** |
| `santa-barbara-county`   |                 0 | **404** |
| `san-luis-obispo-county` |                 0 | **404** |
| `napa-county`            |                 0 | **404** |
| `mendocino-county`       |                 0 | **404** |

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
