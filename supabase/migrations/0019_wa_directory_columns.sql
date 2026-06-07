-- Washington DSHS Advanced Lookup — dementia care contract + roster metadata.

INSERT INTO states (code, name, scraper_name, confidence)
VALUES ('WA', 'Washington', 'wa_dshs_directory', 'medium')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS wa_dementia_care_contract boolean,
  ADD COLUMN IF NOT EXISTS wa_contract_types text[],
  ADD COLUMN IF NOT EXISTS wa_county text,
  ADD COLUMN IF NOT EXISTS wa_facility_type text;

COMMENT ON COLUMN facilities.wa_dementia_care_contract IS
  'True when DSHS lookup lists Dementia Care contract for this license.';
COMMENT ON COLUMN facilities.wa_contract_types IS
  'Contract types from WA roster export (may stack: AL + Dementia Care + ECS).';
COMMENT ON COLUMN facilities.wa_county IS
  'County name from WA ADSA roster.';
COMMENT ON COLUMN facilities.wa_facility_type IS
  'ALF / ARC / EARC etc. from WA roster when present.';

CREATE INDEX IF NOT EXISTS idx_facilities_wa_dementia_contract
  ON facilities (wa_dementia_care_contract)
  WHERE state_code = 'WA' AND wa_dementia_care_contract = true;
