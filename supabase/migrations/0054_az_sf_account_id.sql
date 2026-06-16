-- Migration 0054: AZ Care Check Salesforce Account ID for inspection ingest
--
-- Stores the AZ Care Check Salesforce Account ID (facilityId) for each AZ facility.
-- Used by az_adhs_inspections_ingest.py to call AZCCInspectionHistoryController
-- without per-facility Playwright scraping.
--
-- Discovery outcome 2026-06-15:
--   AZ Care Check (azcarecheck.azdhs.gov) DOES cover Assisted Living (ALH/ALC)
--   under the "Health Care Facilities" program. The SF Account IDs are obtained
--   via the Aura getAccountsMapData API (no auth required).
--   Inspection data: AZCCInspectionHistoryController.getFacilityOrLicenseInspections
--   also requires no auth. Full inspection narratives returned as structured JSON.

ALTER TABLE facilities
    ADD COLUMN IF NOT EXISTS az_sf_account_id text;

CREATE INDEX IF NOT EXISTS facilities_az_sf_account_id_idx
    ON facilities (az_sf_account_id)
    WHERE az_sf_account_id IS NOT NULL;

COMMENT ON COLUMN facilities.az_sf_account_id IS
    'AZ Care Check Salesforce Account ID (18-char, e.g. 001cs00000Wo4kuAAB). '
    'Used to fetch inspection history via AZCCInspectionHistoryController Aura API. '
    'Populated by scrapers/az_adhs_inspections_ingest.py --mode discover.';
