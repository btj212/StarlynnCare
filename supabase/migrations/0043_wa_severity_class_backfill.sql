-- Migration: 0043_wa_severity_class_backfill.sql
--
-- Fixes two ingest bugs surfaced by the May 2026 WA dataset analysis:
--
-- Bug 1: immediate_jeopardy boolean was stored as false even when
--        state_severity_raw = 'IJ'. The WA DSHS inspection parser was passing
--        immediate_jeopardy=False from wa_dshs_to_bundle.py. The ingest script
--        wa_inspections_ingest.py would set severity=4 from the 'IJ' text via
--        infer_severity(), but never promoted the boolean. This means any
--        SQL filter on immediate_jeopardy=true silently misses all WA IJ rows.
--
-- Bug 2: deficiencies.class was populated with visit-type labels
--        ('Inspections', 'Investigations') on ~10 WA placeholder rows.
--        wa_dshs_to_bundle.py stored the link label (e.g. "09/2024 Inspections")
--        in state_severity_raw, and wa_inspections_ingest.py fell back to
--        state_severity_raw when class was null. Both fields now get cleared.
--
-- Both source scripts are also patched (wa_dshs_to_bundle.py and
-- wa_inspections_ingest.py) to prevent regression on future ingest runs.
--
-- All changes are additive corrections. No rows are deleted.

-- ─────────────────────────────────────────────────────────────────────────────
-- Bug 1: Set immediate_jeopardy = true where state_severity_raw indicates IJ
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE deficiencies
   SET immediate_jeopardy = true
 WHERE state_severity_raw IN ('IJ', 'Immediate Jeopardy')
   AND immediate_jeopardy = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- Bug 2: Null out the mislabeled class column on WA placeholder rows
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE deficiencies d
   SET class = NULL
  FROM inspections i
  JOIN facilities f ON f.id = i.facility_id
 WHERE d.inspection_id = i.id
   AND f.state_code = 'WA'
   AND d.class IN ('Inspections', 'Investigations');

-- ─────────────────────────────────────────────────────────────────────────────
-- Bug 2b: Null out the same mislabeled visit-type strings from state_severity_raw
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE deficiencies d
   SET state_severity_raw = NULL
  FROM inspections i
  JOIN facilities f ON f.id = i.facility_id
 WHERE d.inspection_id = i.id
   AND f.state_code = 'WA'
   AND d.state_severity_raw IN ('Inspections', 'Investigations');
