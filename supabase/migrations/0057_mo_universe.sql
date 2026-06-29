-- Migration: 0057_mo_universe.sql
--
-- Missouri DHSS / Section for Long-Term Care Regulation — memory care universe scaffold
-- Adds:
--   1. states row for MO
--   2. MO-specific facility columns (from probe: mo_level_of_care, mo_alzheimer_scu, mo_scu_capacity)
--   3. Unique partial index on (state_code='MO', external_id) keyed on MO license number
--
-- Probe findings (2026-06-28):
--   Directory: data.mo.gov Socrata fenu-sipv, 1,101 licensed LTC rows
--   Memory care signal: alzheimer_s_scu=true (316 rows) OR level_of_care='ALF**' (332 rows)
--   Union of both signals: 459 unique facility_numbers
--   Join rate: Excel FACILITY_ID → facility_number = 587/587 (100%)
--   License status: license_expiration field (ISO datetime)
--   Name column: facility_name
--
-- Conservative YMYL-safe publishable set:
--   alzheimer_s_scu = true  OR  level_of_care = 'ALF**'
--   mapped to memory_care_disclosure_filed = true
--
-- All changes are additive. No existing columns dropped or renamed.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. states row
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO states (code, name, scraper_name, sla_days, confidence, notes)
VALUES (
  'MO',
  'Missouri',
  'mo_dhss_directory_ingest',
  90,
  'medium',
  'DHSS Section for Long-Term Care Regulation. '
  'Regulated under RSMo Chapter 198 and 19 CSR 30 (ALF/RCF) and 19 CSR 15 (SNF/ICF). '
  'Universe: ALF (Assisted Living Facility) and RCF (Residential Care Facility). '
  'MC signal: alzheimer_s_scu=true (Alzheimer''s Special Care Disclosure, §198.510 RSMo) '
  '  OR level_of_care=''ALF**'' (licensed to retain non-self-evacuating residents, §198.073.6). '
  'Inspections: DHSS FOIA records (FACILITY_TYPE, TAG columns in Excel export). '
  'Directory source: data.mo.gov Socrata fenu-sipv (MO LTC Facilities Directory).'
)
ON CONFLICT (code) DO UPDATE
  SET name         = excluded.name,
      scraper_name = excluded.scraper_name,
      sla_days     = excluded.sla_days,
      notes        = excluded.notes;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MO-specific facility columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE facilities

  -- MO license type code from Socrata level_of_care column.
  -- Values: 'ALF**' (self-evac restricted), 'ALF', 'RCF*', 'RCF', 'SNF', 'ICF', etc.
  -- 'ALF**' = licensed to retain residents who cannot self-evacuate (§198.073.6).
  ADD COLUMN IF NOT EXISTS mo_level_of_care  text,

  -- Alzheimer's Special Care Services Disclosure flag from Socrata alzheimer_s_scu column.
  -- True when the facility has filed Form MO 580-2637 (§198.510 RSMo).
  -- This is the primary Tier-1 MC signal for MO (analogous to AZ Directed Care).
  ADD COLUMN IF NOT EXISTS mo_alzheimer_scu  boolean,

  -- Licensed SCU bed capacity from Socrata scucapacity column.
  -- Null when the facility has no dedicated SCU unit.
  ADD COLUMN IF NOT EXISTS mo_scu_capacity   integer;

COMMENT ON COLUMN facilities.mo_level_of_care IS
  'MO: DHSS license type as reported in data.mo.gov fenu-sipv level_of_care. '
  'ALF** = may retain residents who cannot self-evacuate (§198.073.6 RSMo). '
  'ALF = standard Assisted Living. RCF* / RCF = Residential Care Facility. '
  'SNF/ICF are nursing home types and are excluded from the ALF/RCF memory-care universe.';

COMMENT ON COLUMN facilities.mo_alzheimer_scu IS
  'MO: true when the facility has filed the Alzheimer''s Special Care Services Disclosure '
  '(Form MO 580-2637, §198.510 RSMo). This is the authoritative dementia-care signal '
  '(analogous to AZ Directed Care, OR MCE, WA Dementia-Care Contract). '
  'Source: data.mo.gov fenu-sipv alzheimer_s_scu column.';

COMMENT ON COLUMN facilities.mo_scu_capacity IS
  'MO: licensed Alzheimer''s/dementia SCU bed capacity (Socrata scucapacity). '
  'Null when no dedicated SCU is licensed.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Unique partial index — join target for upserts by MO license number
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Run this as a separate statement in the Supabase dashboard after the above.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS facilities_mo_external_id_idx
  ON facilities (state_code, external_id)
  WHERE state_code = 'MO' AND external_id IS NOT NULL;
