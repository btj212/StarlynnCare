# Memory care coverage — acceptance notes

This document records how to compare **publishable** facility counts to expectations and what the pipeline components contribute.

## Definitions

- **Publishable** — as computed by `scrapers/recompute_publishable.py` (licensed CA RCFEs meeting site editorial + data-quality rules for memory care).
- **Industry / directory signals** — APFM and Caring listings (`mc_signal_apfm_listed`, `mc_signal_caring_listed`) are *signals*, not ground truth; chain-curated rows are similarly directional.

## Per-county publishable (run in SQL)

Replace or parameterize county as needed:

```sql
SELECT county, COUNT(*) AS publishable
FROM facilities
WHERE state_code = 'CA'
  AND license_status = 'LICENSED'
  AND publishable = true
GROUP BY county
ORDER BY publishable DESC;
```

## MC review queue

```sql
SELECT mc_review_status, COUNT(*)
FROM facilities
WHERE state_code = 'CA' AND license_status = 'LICENSED'
GROUP BY mc_review_status
ORDER BY 2 DESC;
```

## Auto-verification evidence (queue)

```sql
SELECT f.name, f.city, e.verdict, e.confidence, e.scraped_at
FROM mc_queue_evidence e
JOIN facilities f ON f.id = e.facility_id
ORDER BY e.scraped_at DESC
LIMIT 50;
```

## Precision / recall (manual)

True **precision/recall** for “offers memory care” vs CDSS requires a labeled audit sample (not derivable from CDSS alone). Recommended approach:

1. Stratified random sample of `publishable = true` by county (e.g. *n* = 25–50).
2. Human confirms MC services from primary sources (facility site, disclosure PDF, or phone).
3. Record false positive rate; optionally sample negatives from `needs_review` for false negatives.

Document run date, sample size, and adjudication rules here after the audit.

## Pipeline artifacts

| Phase | Artifact / script |
|-------|-------------------|
| CKAN ingest | `scrapers/ccld_rcfe_ingest.py` |
| Citations | `scrapers/ccld_citations_ingest.py` |
| MC disclosure | `scrapers/mc_disclosure_ingest.py` |
| Chain signals | `scrapers/chain_curated_mc.py` |
| Directories | `scrapers/directory_mc_scrape.py` → JSON under `.firecrawl/directory-match/` |
| Directory match | `scrapers/directory_mc_upsert.py` |
| Publishable | `scrapers/recompute_publishable.py` |
| Inspection blurbs | `scrapers/summarize_inspections.py` |
| Editorial content | `scrapers/generate_content.py` |
| Queue suggestions | `scrapers/queue_verifier.py` → `mc_queue_evidence` |

_Last updated: automated during “Maximize MC Coverage” ship prep._
