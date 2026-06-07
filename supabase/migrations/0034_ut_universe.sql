-- Migration: 0034_ut_universe.sql
--
-- Utah Memory Care Universe
-- Adds UT-specific columns to the facilities table:
--   secure_beds        — integer count of locked/secured-unit beds (UGRC SECURE_BEDS)
--   secure_bed_ratio   — computed ratio (secure_beds / licensed_beds) for editorial display
--   administrator_name — currently licensed administrator (UGRC native field)
--   initial_license_date — date facility first received its license (UGRC INITIAL_REGULATION_DATE)
--   state_internal_id  — durable state-assigned premise ID (UT_NUMBER), survives license renewals
--
-- Note: cms_ccn, license_expiration, and external_id already exist from prior migrations.
-- All changes are additive; no existing columns are dropped or renamed.

alter table facilities
  -- UGRC SECURE_BEDS: count of beds in the secured/locked memory-care unit.
  -- NULL = column doesn't apply (e.g., Home Health, Hospice, non-residential).
  -- 0    = residential license held but no secured unit.
  -- >0   = facility operates a memory care unit; this is the primary UT MC gate.
  add column if not exists secure_beds          integer
                                                  check (secure_beds >= 0),

  -- Derived ratio: SECURE_BEDS / CAPACITY. Stored for efficient editorial queries.
  -- "22 of 73 beds secured for memory care" — the differentiating metric for UT.
  -- Recomputed by ut_arcgis_facilities_ingest.py on every upsert.
  add column if not exists secure_bed_ratio     double precision
                                                  check (secure_bed_ratio between 0 and 1),

  -- Currently licensed administrator name (UGRC ADMINISTRATOR_NAME).
  -- Changes over time; tracked for administrator-tenure editorial signals.
  add column if not exists administrator_name   text,

  -- Date facility first received its license (UGRC INITIAL_REGULATION_DATE).
  -- Used for freshness / new-facility gates and editorial "in operation since" context.
  add column if not exists initial_license_date date,

  -- Durable state-assigned premise ID (UT_NUMBER, e.g. "UT207299").
  -- Survives license renewals. Different from external_id (per-license ID_NUMBER).
  -- Keep for audit trail and potential future cross-state joins.
  add column if not exists state_internal_id    text;

comment on column facilities.secure_beds is
  'UT: count of licensed beds in the secured/locked memory-care unit (UGRC SECURE_BEDS). '
  'NULL = not applicable (non-residential license). 0 = no secured unit. >0 = has memory care wing.';
comment on column facilities.secure_bed_ratio is
  'UT: secure_beds / licensed_beds. Stored for efficient editorial queries. '
  'NULL when secure_beds or licensed_beds is null.';
comment on column facilities.administrator_name is
  'Currently licensed administrator name. Sourced from UGRC for UT facilities.';
comment on column facilities.initial_license_date is
  'Date facility first received its license. From UGRC INITIAL_REGULATION_DATE (epoch ms converted).';
comment on column facilities.state_internal_id is
  'Durable state-assigned premise ID that survives license renewals. '
  'UT: UT_NUMBER (e.g. UT207299). Format varies by state.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Unique index on (state_code='UT', external_id) — join target for upserts
-- ─────────────────────────────────────────────────────────────────────────────

create unique index if not exists facilities_ut_external_id_idx
  on facilities (state_code, external_id)
  where state_code = 'UT' and external_id is not null;
