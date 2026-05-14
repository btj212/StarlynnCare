-- Migration: 0025_fix_null_beds.sql
--
-- Validation layer (Layer 5) found 3 publishable facilities with beds IS NULL or beds = 0.
-- State licensing sources confirm beds = 0 / unknown for all three:
--
--   MN: River Oaks Columbia Heights (ALRC:155)
--       Source: MN ALRC Report Card spreadsheet (mn-alrc-2026-05-08.xlsx) — Capacity = 0
--       Action: set publishable = false
--
--   OR: Azalea Gardens Senior Living (70M055)
--       Source: Oregon DHS LTC Licensing portal, Licensed beds = 0
--       Action: set publishable = false
--
--   OR: South Beach Manor (50R476)
--       Source: Oregon DHS LTC Licensing portal, Licensed beds = 0
--       Action: set publishable = false
--
-- Oregon DHS ALF/RCF licensing records do not carry a bed count for these facilities.
-- MN ALRC Report Card shows Capacity = 0 for River Oaks Columbia Heights.
-- Without a reliable bed count the WCS denominator is undefined; these facilities
-- cannot be fairly ranked. Setting publishable = false until a verified count
-- is available from a primary source.
--
-- Investigated: 2026-05-13. Run by: validation-layer post-ingest check.

BEGIN;

UPDATE facilities
SET
    publishable = false,
    updated_at  = NOW()
WHERE id = 'b997a385-ccec-4cf0-8411-09b921a8b2af'  -- River Oaks Columbia Heights, MN
  AND publishable = true;

UPDATE facilities
SET
    publishable = false,
    updated_at  = NOW()
WHERE id = 'd04cb924-bbd4-4157-9f1e-99d1466c10a8'  -- Azalea Gardens Senior Living, OR
  AND publishable = true;

UPDATE facilities
SET
    publishable = false,
    updated_at  = NOW()
WHERE id = '0b5ebccd-bbe0-42ef-9500-9bc8fa4c0bf6'  -- South Beach Manor, OR
  AND publishable = true;

COMMIT;
