-- HHSC Assisted Living Facility directory — supplemental columns (Texas Phase 1).
-- Populated by scrapers/tx_alf_ingest.py from state-published Excel exports.

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS tx_facility_id text,
  ADD COLUMN IF NOT EXISTS tx_alzheimer_capacity int,
  ADD COLUMN IF NOT EXISTS tx_alzheimer_cert_no text,
  ADD COLUMN IF NOT EXISTS tx_alzheimer_cert_effective date,
  ADD COLUMN IF NOT EXISTS tx_alzheimer_cert_expiration date,
  ADD COLUMN IF NOT EXISTS tx_license_effective date,
  ADD COLUMN IF NOT EXISTS tx_license_expiration date,
  ADD COLUMN IF NOT EXISTS tx_license_initial date,
  ADD COLUMN IF NOT EXISTS tx_state_region text,
  ADD COLUMN IF NOT EXISTS tx_hhsc_suboffice text,
  ADD COLUMN IF NOT EXISTS tx_county text;

COMMENT ON COLUMN facilities.tx_facility_id IS
  'HHSC Facility ID from ALF directory export (not Salesforce account id).';
COMMENT ON COLUMN facilities.tx_alzheimer_capacity IS
  'Licensed Alzheimer-specific capacity from HHSC roster (0 = none).';
COMMENT ON COLUMN facilities.tx_alzheimer_cert_no IS
  'Texas Alzheimer Certification number when issued.';
COMMENT ON COLUMN facilities.tx_alzheimer_cert_effective IS
  'Alzheimer Certification effective date from HHSC roster.';
COMMENT ON COLUMN facilities.tx_alzheimer_cert_expiration IS
  'Alzheimer Certification expiration date from HHSC roster.';
COMMENT ON COLUMN facilities.tx_license_effective IS
  'HHSC license effective date from directory export.';
COMMENT ON COLUMN facilities.tx_license_expiration IS
  'HHSC license expiration date from directory export (mirror of license_expiration when sourced from HHSC).';
COMMENT ON COLUMN facilities.tx_license_initial IS
  'Initial license date from HHSC directory export.';
COMMENT ON COLUMN facilities.tx_state_region IS
  'HHSC State Region code from directory export.';
COMMENT ON COLUMN facilities.tx_hhsc_suboffice IS
  'HHSC SubOffice label from directory export.';
COMMENT ON COLUMN facilities.tx_county IS
  'County name as printed by HHSC (uppercase).';

CREATE INDEX IF NOT EXISTS idx_facilities_tx_county
  ON facilities (tx_county)
  WHERE state_code = 'TX';

CREATE INDEX IF NOT EXISTS idx_facilities_tx_facility_id
  ON facilities (tx_facility_id)
  WHERE state_code = 'TX';
