-- Minnesota MDH facility directory — Assisted Living with Dementia Care (144G) filtering at ingest.

INSERT INTO states (code, name, scraper_name, confidence)
VALUES ('MN', 'Minnesota', 'mn_mdh_directory', 'medium')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS mn_dementia_care_licensed boolean,
  ADD COLUMN IF NOT EXISTS mn_hfid text,
  ADD COLUMN IF NOT EXISTS mn_lic_type text,
  ADD COLUMN IF NOT EXISTS mn_hcp_type text,
  ADD COLUMN IF NOT EXISTS mn_all_capacity int,
  ADD COLUMN IF NOT EXISTS mn_county_code text;

COMMENT ON COLUMN facilities.mn_dementia_care_licensed IS
  'True when verified dementia-care license type per MDH directory field codes.';
COMMENT ON COLUMN facilities.mn_hfid IS
  'Minnesota Health Facility ID — join key for survey tools when available.';
COMMENT ON COLUMN facilities.mn_lic_type IS
  'MDH directory LIC_TYPE verbatim.';
COMMENT ON COLUMN facilities.mn_hcp_type IS
  'MDH directory HCP_TYPE verbatim.';
COMMENT ON COLUMN facilities.mn_all_capacity IS
  'Assisted Living licensed bed count from MDH ALL_CAPACITY when applicable.';
COMMENT ON COLUMN facilities.mn_county_code IS
  'MDH COUNTY_CODE from facility directory extract.';

CREATE INDEX IF NOT EXISTS idx_facilities_mn_hfid
  ON facilities (mn_hfid)
  WHERE state_code = 'MN';
