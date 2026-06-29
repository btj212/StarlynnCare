-- Migration: 0058_mo_severity_remap.sql
--
-- Fixes a severity-inflation bug in the Missouri inspection ingest.
--
-- Bug: scrapers/mo_inspections_ingest.py::_map_severity() stamped EVERY
--      citation found during a "Complaint Investigation" survey as
--      severity 4 — the same tier reserved for immediate jeopardy. In the
--      facility_snapshot scoring scale (sev 1→1, 2→3, 3→10, 4→25) that gives
--      each such citation a weight of 25, so a facility with 3 ordinary
--      complaint-driven citations scored 75 weighted points and rendered an
--      absurd "50+× peer median" severity callout on its profile. MO rows
--      therefore only ever held severity 2 or 4, with 4 wildly over-assigned.
--
-- Fix: re-derive severity from data already stored on each row. Severity 4 is
--      reserved for genuine high-harm findings — true immediate jeopardy, or a
--      description matching the abuse/neglect-class keyword set the scraper
--      already uses. Everything else (including routine complaint findings with
--      no high-harm language) drops to severity 2. The survey type alone no
--      longer drives severity.
--
-- The keyword list mirrors _SEV4_RE in scrapers/mo_inspections_ingest.py.
-- The source script is patched in the same change to prevent regression on
-- future ingest runs.
--
-- Scoped to MO only. All changes are additive corrections; no rows deleted.
-- facility_snapshot reads severity live, so profile scores update on next render;
-- the nightly scrapers/refresh_snapshot_cache.py refreshes the cached grade.

UPDATE deficiencies d
   SET severity = CASE
                    WHEN d.immediate_jeopardy THEN 4
                    WHEN d.description ~* '\y(abuse|neglect|exploit|elopement|medication\s+error|evacuation|immediate\s+jeopardy|ij|assault|mistreat)\y' THEN 4
                    ELSE 2
                  END
  FROM inspections i
  JOIN facilities f ON f.id = i.facility_id
 WHERE d.inspection_id = i.id
   AND f.state_code = 'MO';
