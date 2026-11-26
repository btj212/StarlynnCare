-- License-status provenance, and a guard so an older source cannot revert a
-- newer live check.
--
-- Why: California license_status came from the CHHS/CKAN roster, which has
-- been frozen at file_date 05/25/2025 while CDSS kept closing, licensing and
-- probating homes. Each roster re-ingest silently put the 2025 value back over
-- any later live check. On 2026-11-26 the live CDSS file disagreed with 1,087
-- CA rows, 60 of them published.
--
-- Rule after this migration: once a row has license_status_checked_at, any
-- UPDATE that changes license_status must carry a strictly newer
-- license_status_checked_at. Otherwise the old status, source, and check time
-- are kept and the rest of the UPDATE goes through. Rows never checked behave
-- exactly as before, so other states are unaffected until their own live
-- refresh starts stamping these columns.
--
-- This migration does not touch `publishable`.

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS license_status_source     text,
  ADD COLUMN IF NOT EXISTS license_status_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS license_status_detail     text,
  ADD COLUMN IF NOT EXISTS license_closed_date       date;

COMMENT ON COLUMN facilities.license_status_source IS
  'Where license_status came from, e.g. cdss_bulk_rcfe (CDSS DownloadStateData/ResidentialElderCareFacility), cdss_facility_detail, manual_regulator_check.';
COMMENT ON COLUMN facilities.license_status_checked_at IS
  'When license_status was last read from license_status_source. A status change needs a newer value (see trg_facilities_license_status_guard).';
COMMENT ON COLUMN facilities.license_status_detail IS
  'Regulator wording when finer than license_status, e.g. CDSS FacilityDetail "Closed, Change of Ownership".';
COMMENT ON COLUMN facilities.license_closed_date IS
  'Regulator closed date (CDSS "Closed Date").';

CREATE OR REPLACE FUNCTION facilities_license_status_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.license_status IS DISTINCT FROM OLD.license_status
     AND OLD.license_status_checked_at IS NOT NULL
     AND (NEW.license_status_checked_at IS NULL
          OR NEW.license_status_checked_at <= OLD.license_status_checked_at)
  THEN
    NEW.license_status            := OLD.license_status;
    NEW.license_status_source     := OLD.license_status_source;
    NEW.license_status_checked_at := OLD.license_status_checked_at;
    NEW.license_status_detail     := OLD.license_status_detail;
    NEW.license_closed_date       := OLD.license_closed_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facilities_license_status_guard ON facilities;
CREATE TRIGGER trg_facilities_license_status_guard
  BEFORE UPDATE OF license_status ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION facilities_license_status_guard();

CREATE INDEX IF NOT EXISTS facilities_state_license_number_idx
  ON facilities (state_code, license_number);
