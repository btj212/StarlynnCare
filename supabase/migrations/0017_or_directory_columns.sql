-- Oregon DHS LTC Licensing — memory-care endorsed providers + provider ID join key.
-- Populated by scrapers/or_dhs_ltc_directory_ingest.py from CSV export.

INSERT INTO states (code, name, scraper_name, confidence)
VALUES ('OR', 'Oregon', 'or_dhs_ltc_directory', 'high')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS or_memory_care_endorsed boolean,
  ADD COLUMN IF NOT EXISTS or_provider_id text,
  ADD COLUMN IF NOT EXISTS or_facility_type text,
  ADD COLUMN IF NOT EXISTS or_accepts_medicaid boolean,
  ADD COLUMN IF NOT EXISTS or_status text;

COMMENT ON COLUMN facilities.or_memory_care_endorsed IS
  'True when Oregon DHS lists Memory Care endorsement on the provider.';
COMMENT ON COLUMN facilities.or_provider_id IS
  'Oregon LTC Licensing Provider ID — join key for inspections/violations CSV exports.';
COMMENT ON COLUMN facilities.or_facility_type IS
  'ALF or RCF from Oregon roster export.';
COMMENT ON COLUMN facilities.or_accepts_medicaid IS
  'Medicaid acceptance flag from Oregon roster when present.';
COMMENT ON COLUMN facilities.or_status IS
  'Open / Closed verbatim from Oregon roster.';

CREATE INDEX IF NOT EXISTS idx_facilities_or_provider_id
  ON facilities (or_provider_id)
  WHERE state_code = 'OR';
