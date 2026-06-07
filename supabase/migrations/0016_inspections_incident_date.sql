-- ============================================================
-- 0016_inspections_incident_date.sql
--
-- Phase 2 hardening: capture *incident_date* on complaint /
-- investigation inspections, distinct from inspection_date
-- (which is the surveyor's exit date).
--
-- Rationale: HHSC LTCR (Texas) and other state regulators record
-- the underlying incident or complaint receipt date separately
-- from the surveyor visit. Storing it lets us later gate, filter,
-- or surface "incident timeline" UI without re-ingesting.
--
-- Posture: capture-everything-now, gate-publish-later. Column is
-- nullable; CA backfill is unaffected (existing rows stay NULL).
-- ============================================================

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS incident_date date;

COMMENT ON COLUMN inspections.incident_date IS
  'For complaint or incident-based investigations: date the underlying incident occurred or the complaint was received. Nullable. Distinct from inspection_date (surveyor exit date).';

CREATE INDEX IF NOT EXISTS idx_inspections_incident_date
  ON inspections(facility_id, incident_date DESC)
  WHERE incident_date IS NOT NULL;
