-- ============================================================
-- StarlynnCare Migration 0008 — Capacity Tier + MC Disclosure
--
-- Adds two axes for California RCFE facility organization:
--
-- Axis 1 — Capacity tier (derived from beds column)
--   'small'   : beds IS NULL OR beds <= 6
--               Board-and-care homes (single-family conversions).
--               Less inspector attention by design (Title 22 §87100 et seq.).
--   'medium'  : 7 <= beds <= 49  — small/medium freestanding RCFE
--   'large'   : beds >= 50       — community-style (purpose-built buildings)
--   'unknown' : beds IS NULL
--
-- Axis 2 — Memory-care disclosure (HSC §1569.627)
--   Any RCFE that advertises dementia care must file a disclosure with CDSS
--   (plan of operation special features). This is the canonical "actually a
--   memory-care facility" signal — better than name-regex alone.
--
--   memory_care_disclosure_filed: true once we confirm the facility filed a
--   §1569.627 disclosure. Populated by mc_disclosure_ingest.py via:
--     1. Future CDSS public list (no structured download exists as of Apr 2026)
--     2. §87705/§87706 citation scan (Phase D)
--   Falls back to serves_memory_care (name-regex) in the UI until populated.
--
-- Run in Supabase SQL Editor.
-- ============================================================

-- --------------------------------------------------------------
-- 1. Capacity tier — generated column derived from beds
-- --------------------------------------------------------------

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS capacity_tier text GENERATED ALWAYS AS (
    CASE
      WHEN beds IS NULL THEN 'unknown'
      WHEN beds <= 6    THEN 'small'
      WHEN beds <= 49   THEN 'medium'
      ELSE                   'large'
    END
  ) STORED;

-- --------------------------------------------------------------
-- 2. Memory-care disclosure columns (HSC §1569.627)
-- --------------------------------------------------------------

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS memory_care_disclosure_filed  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS memory_care_disclosure_source text;

-- Human-readable source values used by mc_disclosure_ingest.py:
--   '§1569.627 disclosure list (CDSS)' — once CDSS publishes a structured list
--   '§87705/§87706 citation'            — Phase D: facility cited under dementia regs
--   'name-regex fallback'               — interim until citation scan runs

COMMENT ON COLUMN facilities.memory_care_disclosure_filed IS
  'True if this facility has filed a §1569.627 dementia-care disclosure with CDSS, '
  'or been confirmed via §87705/§87706 citation. mcSignal = memory_care_disclosure_filed OR serves_memory_care.';

COMMENT ON COLUMN facilities.memory_care_disclosure_source IS
  'Provenance string explaining how memory_care_disclosure_filed was set.';

-- --------------------------------------------------------------
-- 3. Indexes — browse filter is (state_code, capacity_tier, publishable)
-- --------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_facilities_browse
  ON facilities (state_code, capacity_tier, publishable)
  WHERE publishable = true;

-- Drop the old memory_care index and replace with combined one
-- (old: idx_facilities_memory_care on (state_code) WHERE serves_memory_care = true)
-- Retain old index for backward compat with any direct SQL queries.
-- New index covers the default listing view.
