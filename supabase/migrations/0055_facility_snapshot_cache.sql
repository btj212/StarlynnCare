-- Migration 0055: facility_snapshot_cache
--
-- Materialize the subset of facility_snapshot() needed by discovery rails
-- and facility cards so they can be served without a live per-facility RPC call.
-- The full live RPC stays on the focused facility profile page only.
--
-- Columns mirror the relevant fields from the facility_snapshot() return type
-- (defined in 0030_fix_freq_null_routine.sql) so callers can read them
-- from the facilities table directly after a refresh run.

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS grade_letter          text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS composite_percentile  integer  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grade_refreshed_at    timestamptz DEFAULT NULL;

-- Partial index: fast lookup of facilities with cached grades (most card queries).
CREATE INDEX IF NOT EXISTS idx_facilities_grade_letter
  ON facilities (state_code, grade_letter)
  WHERE publishable = true AND grade_letter IS NOT NULL;

COMMENT ON COLUMN facilities.grade_letter IS
  'Cached letter grade from facility_snapshot() — A/B/C/D/F. Refreshed nightly by scrapers/refresh_snapshot_cache.py. Null when no snapshot available.';
COMMENT ON COLUMN facilities.composite_percentile IS
  'Cached composite peer percentile (0-100) from facility_snapshot(). 100 = best (fewest deficiencies). Refreshed nightly.';
