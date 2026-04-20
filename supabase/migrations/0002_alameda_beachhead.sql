-- ============================================================
-- StarlynnCare Migration 0002 — Alameda County RCFE Beachhead
--
-- Retires the Florida-wide CMS/SNF footprint and adds the
-- memory-care categorization + publish-gate columns needed for
-- the Alameda County (CA) RCFE beachhead.
--
-- See .cursor/plans/alameda-rcfe-beachhead_*.plan.md for context.
-- Run in Supabase SQL Editor.
-- ============================================================

-- --------------------------------------------------------------
-- 1. Retire Florida footprint
-- --------------------------------------------------------------
-- The 694 FL SNF rows from cms_ingest.py (0001 era) are out of
-- beachhead scope. inspections + deficiencies cascade on delete
-- via the ON DELETE CASCADE FKs declared in 0001_init.sql.
-- Historical scrape_runs are retained as audit trail.

DELETE FROM facilities WHERE state_code = 'FL';

-- --------------------------------------------------------------
-- 2. Memory-care categorization columns
-- --------------------------------------------------------------

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS care_category text
    CHECK (care_category IN (
      'rcfe_memory_care',   -- CA: RCFE with dementia capability (the beachhead)
      'rcfe_general',       -- CA: RCFE without documented memory-care capability
      'alf_memory_care',    -- Other states: ALF-equivalent that serves memory care
      'alf_general',        -- Other states: ALF-equivalent that does not
      'snf_general',        -- CMS SNF, no dementia SCU
      'snf_dementia_scu',   -- CMS SNF with a dementia Special Care Unit
      'ccrc',               -- Continuing Care Retirement Community (dual-wing)
      'unknown'
    ))
    DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS serves_memory_care boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS memory_care_designation text,
  ADD COLUMN IF NOT EXISTS license_status text,
  ADD COLUMN IF NOT EXISTS license_expiration date,
  ADD COLUMN IF NOT EXISTS publishable boolean NOT NULL DEFAULT false;

-- --------------------------------------------------------------
-- 3. Indexes — the public site filters on (state_code, publishable)
-- --------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_facilities_publishable
  ON facilities (state_code, city_slug)
  WHERE publishable = true;

CREATE INDEX IF NOT EXISTS idx_facilities_memory_care
  ON facilities (state_code)
  WHERE serves_memory_care = true;
