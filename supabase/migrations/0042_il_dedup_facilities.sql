-- 0042_il_dedup_facilities.sql
--
-- The Illinois FOIA workbook stores a per-visit "record ID" in what we
-- ingested as license_number. This caused il_foia_visits_ingest.py to
-- create one facility row per inspection event instead of one row per
-- physical facility.
--
-- This migration:
--   1. Picks the canonical facility row for each unique IL name (earliest created_at).
--   2. Deletes inspection rows that would conflict on the unique constraint
--      (facility_id, inspection_date, inspection_type, source_agency) when
--      reassigned to the canonical facility.
--   3. Re-points every FK table's facility_id from duplicates → canonical.
--   4. Deletes the now-orphaned duplicate facility rows.

BEGIN;

-- Step 1 — canonical mapping
CREATE TEMP TABLE il_canonical AS
SELECT
    id,
    name,
    FIRST_VALUE(id) OVER (
        PARTITION BY name
        ORDER BY created_at ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS canonical_id
FROM facilities
WHERE state_code = 'IL';

-- Step 2 — remove inspections that would conflict when reassigned
-- (same canonical_id + inspection_date + inspection_type + source_agency already exists)
DELETE FROM inspections
WHERE id IN (
    SELECT i.id
    FROM inspections i
    JOIN il_canonical c ON c.id = i.facility_id AND c.id <> c.canonical_id
    WHERE EXISTS (
        SELECT 1 FROM inspections existing
        WHERE existing.facility_id  = c.canonical_id
          AND existing.inspection_date = i.inspection_date
          AND existing.inspection_type = i.inspection_type
          AND COALESCE(existing.source_agency, '') = COALESCE(i.source_agency, '')
    )
);

-- Step 3 — reassign non-conflicting inspections to canonical facility
UPDATE inspections
SET facility_id = c.canonical_id
FROM il_canonical c
WHERE inspections.facility_id = c.id
  AND c.id <> c.canonical_id;

-- Step 4 — reassign other FK tables (all empty for IL, but future-proof)
UPDATE il_inspection_inventory
SET facility_id = c.canonical_id
FROM il_canonical c
WHERE il_inspection_inventory.facility_id = c.id
  AND c.id <> c.canonical_id;

UPDATE content_runs
SET facility_id = c.canonical_id
FROM il_canonical c
WHERE content_runs.facility_id = c.id
  AND c.id <> c.canonical_id;

UPDATE facility_data_quality_issues
SET facility_id = c.canonical_id
FROM il_canonical c
WHERE facility_data_quality_issues.facility_id = c.id
  AND c.id <> c.canonical_id;

UPDATE facility_watchers
SET facility_id = c.canonical_id
FROM il_canonical c
WHERE facility_watchers.facility_id = c.id
  AND c.id <> c.canonical_id;

UPDATE mc_listing_reports
SET facility_id = c.canonical_id
FROM il_canonical c
WHERE mc_listing_reports.facility_id = c.id
  AND c.id <> c.canonical_id;

UPDATE mc_queue_evidence
SET facility_id = c.canonical_id
FROM il_canonical c
WHERE mc_queue_evidence.facility_id = c.id
  AND c.id <> c.canonical_id;

UPDATE mc_review_audit
SET facility_id = c.canonical_id
FROM il_canonical c
WHERE mc_review_audit.facility_id = c.id
  AND c.id <> c.canonical_id;

UPDATE reviews
SET facility_id = c.canonical_id
FROM il_canonical c
WHERE reviews.facility_id = c.id
  AND c.id <> c.canonical_id;

UPDATE submission_events
SET facility_id = c.canonical_id
FROM il_canonical c
WHERE submission_events.facility_id = c.id
  AND c.id <> c.canonical_id;

-- Step 5 — delete duplicate facility rows
DELETE FROM facilities
WHERE id IN (
    SELECT id FROM il_canonical WHERE id <> canonical_id
);

-- Step 6 — verify
DO $$
DECLARE
    remaining  int;
    inspcount  int;
BEGIN
    SELECT COUNT(*) INTO remaining FROM facilities WHERE state_code = 'IL';
    SELECT COUNT(*) INTO inspcount
    FROM inspections i
    JOIN facilities f ON f.id = i.facility_id
    WHERE f.state_code = 'IL';
    RAISE NOTICE 'IL facilities after dedup: % (expected 33)', remaining;
    RAISE NOTICE 'IL inspections after reassignment: %', inspcount;
END $$;

COMMIT;
