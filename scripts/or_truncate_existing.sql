-- or_truncate_existing.sql
--
-- Wipe all existing OR facility data before the Full Universe rebuild.
--
-- WHY: The old scrapers zero-padded Provider IDs (e.g. "0000525953"),
-- which breaks joins for alphanumeric IDs like "50M300" or "38E142".
-- The new ingest stores external_id verbatim; a clean slate prevents
-- duplicate rows from the old and new ID formats colliding.
--
-- SAFE TO RUN BECAUSE:
--   - Migration 0033 was already applied (additive only, no data loss).
--   - All OR data will be fully re-ingested by or_overnight_run.sh.
--   - WA and CA data is untouched (WHERE state_code = 'OR').
--
-- Run in Supabase SQL Editor BEFORE running scripts/or_overnight_run.sh.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Deficiencies cascade-delete via inspections → no need to touch them directly
--    as long as FK is ON DELETE CASCADE. Confirm:
--      \d inspections  → facility_id references facilities(id) ON DELETE CASCADE
--      \d deficiencies → inspection_id references inspections(id) ON DELETE CASCADE

-- 2. or_pdf_inventory has FK to facilities ON DELETE CASCADE
--    (added in migration 0033) → auto-cleaned.

-- 3. Reviews, watch subscriptions, listing reports referencing OR facilities
--    have FK ON DELETE SET NULL or CASCADE depending on migration.
--    Check before running if you have OR reviews in production.

-- 4. Delete OR facilities (cascades to inspections → deficiencies → or_pdf_inventory)
DELETE FROM facilities
WHERE state_code = 'OR';

-- Verify: should return 0
SELECT count(*) AS or_facilities_remaining
FROM facilities
WHERE state_code = 'OR';

COMMIT;
