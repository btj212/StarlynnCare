-- California CDSS "client served" codes, stored as the state file lists them.
--
-- Why: CDSS FacilityDetail (transparencyapi/api/FacilityDetail/{license})
-- lists up to six client types per RCFE license (CLIENTSERVED1..6), e.g.
-- "935 - ELDERLY", "983 - RCFE / DEMENTIA", "985 - RCFE / HOSPICE". Code 983
-- is CDSS recording that the license serves residents with dementia. It is a
-- state record of a dementia-care basis, so the facility page can say why the
-- home is listed instead of "Memory-care basis not yet recorded".
--
-- Only 983 counts as a memory-care basis. 935 (ELDERLY) does not. The column
-- keeps every code CDSS lists so nothing is reinterpreted at ingest time.
--
-- The CHHS GIS layer has only the first client type, so it is not a source
-- for this column. The value comes from FacilityDetail.

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS ca_cdss_client_served            text[],
  ADD COLUMN IF NOT EXISTS ca_cdss_client_served_checked_at timestamptz;

COMMENT ON COLUMN facilities.ca_cdss_client_served IS
  'CA only: CDSS FacilityDetail CLIENTSERVED1..6 values, verbatim (e.g. {"935 - ELDERLY","983 - RCFE / DEMENTIA"}). Only a code starting 983 is a dementia-care basis.';
COMMENT ON COLUMN facilities.ca_cdss_client_served_checked_at IS
  'When ca_cdss_client_served was read from CDSS FacilityDetail.';
