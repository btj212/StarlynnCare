-- Migration: 0062_dedupe_repeat_ingest_deficiencies.sql
--
-- Removes duplicate deficiency rows caused by non-idempotent re-ingests in the
-- OR, AZ, PA, and CA scrapers. Surfaced by the "No repeat offenders (>=3 codes)
-- with composite_pct > 55" Data Validation check flagging Marquis Oregon City
-- Post Acute Rehab; investigation found the underlying cause was duplicate
-- rows, not a ranking bug.
--
-- Root causes found (one per state, all fixed in this same change):
--   OR  scrapers/or_violations_ingest.py had no dedup guard at all, and every
--       CSV-sourced row it writes has code = NULL (OR's violations export has
--       no OAR citation column). It runs monthly via or_overnight_run.sh
--       against the full CSV export every time, so every already-loaded
--       violation is re-inserted on every run. This is the majority of the
--       duplicate volume.
--   AZ  scrapers/az_adhs_inspections_ingest.py already does DELETE-then-INSERT
--       per inspection going forward; its duplicate rows predate that guard.
--   PA  scrapers/pa_pdf_backfill.py only guarded re-inserts when a citation's
--       `code` was parsed; sidecar rows with no parsed code had no guard.
--   CA  scrapers/ccld_citations_ingest.py already guards by source_url in its
--       default (non --refetch) mode; its duplicates come from earlier
--       --refetch runs.
--
-- Identity key: `code` is frequently NULL (OR has no citation column at all;
-- AZ/PA don't always parse one). Two NULL-code rows in the *same inspection*
-- are NOT necessarily duplicates of each other — a single AZ inspection
-- routinely cites 5-10 distinct sub-clauses that all have code = NULL. So a
-- NULL code cannot be treated as a shared identity value the way a real code
-- can. Identity here is (inspection_id, code) when code is present, else
-- (inspection_id, description) — description is the regulation text, which is
-- what actually distinguishes one NULL-code citation from another. This
-- mirrors the guard logic added to or_violations_ingest.py / pa_pdf_backfill.py
-- in this same change.
--
-- Within an identity group, only delete when every other content column
-- (inspector_narrative, plan_of_correction, severity) also matches — i.e.
-- this is a byte-identical re-insert of the same source row, not two distinct
-- findings that happen to share a code (verified: AZ/PA/CA have real cases of
-- one code cited twice in an inspection with different narratives — those are
-- left alone).
--
-- Keeps exactly one row per group (earliest created_at) and deletes the rest.
-- scrapers/refresh_snapshot_cache.py is re-run for OR/AZ/PA/CA after this so
-- cached grades reflect the corrected deficiency counts.
--
-- Scoped to OR/AZ/PA/CA only (the states where duplicates were found).

WITH scoped AS (
    SELECT d.id, d.inspection_id, d.code, d.description, d.inspector_narrative,
           d.plan_of_correction, d.severity, d.created_at
    FROM deficiencies d
    JOIN inspections i ON i.id = d.inspection_id
    JOIN facilities f ON f.id = i.facility_id
    WHERE f.state_code IN ('OR', 'AZ', 'PA', 'CA')
),
dupe_groups AS (
    SELECT inspection_id, COALESCE(code, description, '') AS identity_key
    FROM scoped
    GROUP BY inspection_id, COALESCE(code, description, '')
    HAVING COUNT(*) > 1
),
identical_groups AS (
    SELECT s.inspection_id, s.identity_key
    FROM (SELECT *, COALESCE(code, description, '') AS identity_key FROM scoped) s
    JOIN dupe_groups dg
      ON dg.inspection_id = s.inspection_id AND dg.identity_key = s.identity_key
    GROUP BY s.inspection_id, s.identity_key
    HAVING COUNT(DISTINCT COALESCE(s.inspector_narrative, '')) = 1
       AND COUNT(DISTINCT COALESCE(s.plan_of_correction, '')) = 1
       AND COUNT(DISTINCT COALESCE(s.severity, -1)) = 1
),
-- id is a UUID (no natural ordering), so rank by created_at + id::text as a
-- deterministic tiebreaker and keep exactly one (rn = 1) row per group.
ranked AS (
    SELECT
        s.id,
        ROW_NUMBER() OVER (
            PARTITION BY s.inspection_id, s.identity_key
            ORDER BY s.created_at, s.id::text
        ) AS rn
    FROM (SELECT *, COALESCE(code, description, '') AS identity_key FROM scoped) s
    JOIN identical_groups ig
      ON ig.inspection_id = s.inspection_id AND ig.identity_key = s.identity_key
)
DELETE FROM deficiencies d
USING ranked r
WHERE d.id = r.id
  AND r.rn > 1;
