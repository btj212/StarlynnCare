# Tier 1 — Static & template page QA

Generated: 2026-06-01 (hardening pass)

**Method:** Source-level review of all `page.tsx` files + DB/template inventory. Live HTTP checks (title, JSON-LD, canonical) require running validation scripts against preview/production — see `docs/audits/VALIDATION_RUNBOOK.md`.

## Summary

| Category | Count | Source scan | Live gate pending |
|----------|-------|-------------|-------------------|
| Static/editorial pages | 49 | pass | run `meta_check.py`, `jsonld_check.py` |
| Dynamic templates | 5 | pass | sample via tier 2 |

## Source scan (automated)

```
python3 scripts/validate/page_qa_source_scan.py
→ 3/3 passed (no bad copy markers; 54 page.tsx inventoried)
```

## Static pages — source review (checks 3, 6, 10)

All 49 non-dynamic pages reviewed at source level:

| Area | Pages | Chk 3 | Chk 6 | Chk 10 | Notes |
|------|-------|-------|-------|--------|-------|
| Homepage | `/` | pass | pass | pass | |
| States index | `/states` | pass | pass | pass | |
| State hubs (rich) | `/california` | pass | pass | pass | |
| Library (6) | `/library/*` | pass | pass | pass | Editorial illustrations have alt |
| Research (5) | `/research/*` | pass | pass | pass | |
| CA guides | `/california/*` | pass | pass | pass | |
| WA/OR/TX/MN guides | `/{state}/*` | pass | pass | pass | |
| Trust pages | methodology, about, data, editorial-policy, terms, privacy | pass | pass | pass | |
| Report | `/reports/california-rcfe-repeat-citations-2026` | pass | pass | pass | |
| Admin (7) | `/admin/*` | pass | pass | pass | noindex expected |
| Auth | sign-in, unlock, shortlist, watch/* | pass | pass | pass | unlock is password gate |
| Bibliofangirl | `/bibliofangirl` | pass | pass | pass | |

## Dynamic templates (one representative each — live review in tier 2)

| Template | Source file | Source checks |
|----------|-------------|---------------|
| Facility profile | `src/app/[state]/[city]/[facility]/page.tsx` | JsonLd wired; `buildFacilityTitle`; `FacilityBrowseLinks` parent links |
| City/county hub | `src/app/[state]/[city]/page.tsx` | CollectionPage schema builders in page |
| State hub | `src/app/[state]/page.tsx` | State hub config driven |
| State facilities browse | `src/app/[state]/facilities/page.tsx` | List grid only |
| State guides index | `src/app/[state]/guides/page.tsx` | **NEEDS-HUMAN** if state has no articles yet (shows "coming soon") |

## Workstream cross-refs

| WS | Tier 1 status |
|----|----------------|
| A JSON-LD | Scripts ready; live run blocked in agent sandbox (no DNS to starlynn.care) |
| C Internal links | `FacilityBrowseLinks` present in facility page source |
| D Meta | Templates in `meta.ts`; live length gate pending |
| E A11y | All `next/image` usages in repo have `alt` or `alt=""` at source |
| F Soft-404 | `docs/audits/soft404-report.md` (DB-backed) |

## Mechanical fixes applied this pass

None required from tier 1 source review.
