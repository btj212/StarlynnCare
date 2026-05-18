-- 0037_ut_dedup_deficiencies.sql
--
-- Two problems this fixes:
--
-- 1. DUPLICATE DEFICIENCY ROWS for UT facilities.
--    The CCL scraper was run multiple times with no unique constraint on
--    (inspection_id, code), so each run INSERT'd new rows with fresh UUIDs.
--    Fix: keep the row with the most data (prefer inspector_narrative not null),
--    delete the rest.
--
-- 2. NULL / BROKEN source_url for UT-CCL inspections.
--    ccl.utah.gov/facility/{id} is a staff-only portal requiring login.
--    No publicly accessible per-facility inspection page exists for UT-CCL.
--    Fix: set source_url = null so the "View DLBC public records" link hides.
--
-- 3. Add a partial unique index on deficiencies(inspection_id, code) scoped to
--    UT-CCL inspections so future scraper runs cannot create duplicates.
--    Using a partial index on source_agency avoids breaking other states
--    where the same code can legitimately appear twice per inspection.

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Deduplicate UT deficiencies
-- ─────────────────────────────────────────────────────────────────────────────

-- For each (inspection_id, code) pair that has duplicates, keep the row with
-- the best data (inspector_narrative not null preferred, else earliest created_at).
DELETE FROM deficiencies
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      d.id,
      ROW_NUMBER() OVER (
        PARTITION BY d.inspection_id, d.code
        ORDER BY
          (CASE WHEN d.inspector_narrative IS NOT NULL THEN 0 ELSE 1 END),
          d.created_at
      ) AS rn
    FROM deficiencies d
    JOIN inspections i ON i.id = d.inspection_id
    JOIN facilities f ON f.id = i.facility_id
    WHERE f.state_code = 'UT'
  ) ranked
  WHERE rn > 1
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Null out broken UT-CCL source_url (staff portal, not public)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE inspections
SET source_url = NULL
WHERE source_agency = 'UT-CCL';

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Partial unique index to prevent future duplicates for UT-CCL
-- ─────────────────────────────────────────────────────────────────────────────

-- Scoped to UT facilities only so CMS / other state multi-finding behaviour
-- is unaffected. Matches on inspection_id + code.
CREATE UNIQUE INDEX IF NOT EXISTS deficiencies_ut_insp_code_unique
  ON deficiencies (inspection_id, code)
  WHERE code IS NOT NULL
    AND inspection_id IN (
      SELECT i.id FROM inspections i
      JOIN facilities f ON f.id = i.facility_id
      WHERE f.state_code = 'UT'
        AND i.source_agency = 'UT-CCL'
    );
