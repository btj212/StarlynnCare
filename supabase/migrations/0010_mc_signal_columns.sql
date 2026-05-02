-- ============================================================
-- StarlynnCare Migration 0010 — MC Signal Columns + Review System
--
-- Replaces the broad name regex with a tiered signal model:
-- - Strict MC terminology auto-publishes
-- - Chain-name matches and deficiency keywords queue for human review
-- - Public correction form provides feedback loop
--
-- Run in Supabase SQL Editor after implementing code changes.
-- ============================================================

-- --------------------------------------------------------------
-- 1. New signal columns on facilities table
-- --------------------------------------------------------------

ALTER TABLE facilities
  ADD COLUMN mc_signal_explicit_name        boolean NOT NULL DEFAULT false,
  ADD COLUMN mc_signal_chain_name           boolean NOT NULL DEFAULT false,
  ADD COLUMN mc_signal_deficiency_keyword   boolean NOT NULL DEFAULT false,
  ADD COLUMN mc_signal_deficiency_keyword_source text,
  ADD COLUMN mc_signal_chain_curated        boolean NOT NULL DEFAULT false,
  ADD COLUMN mc_review_status               text    NOT NULL DEFAULT 'auto_published'
    CHECK (mc_review_status IN ('auto_published','needs_review','reviewed_publish','reviewed_reject')),
  ADD COLUMN mc_review_notes                text,
  ADD COLUMN mc_reviewed_by                 text,
  ADD COLUMN mc_reviewed_at                 timestamptz;

-- --------------------------------------------------------------
-- 2. Index for admin review surface
-- --------------------------------------------------------------

CREATE INDEX idx_facilities_mc_review
  ON facilities (state_code, mc_review_status)
  WHERE mc_review_status = 'needs_review';

-- --------------------------------------------------------------
-- 3. Public correction reports table
-- --------------------------------------------------------------

CREATE TABLE mc_listing_reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id  uuid        NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  reason       text        NOT NULL,
  contact_email text,
  user_agent   text,
  status       text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved','dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  text
);

-- --------------------------------------------------------------
-- 4. Review audit trail table
-- --------------------------------------------------------------

-- Append-only audit trail of every mc_review_status transition.
-- Lets the red bucket show full rejection history and supports later analytics.
CREATE TABLE mc_review_audit (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id  uuid        NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  from_status  text        NOT NULL,
  to_status    text        NOT NULL,
  reviewer     text        NOT NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mc_review_audit_facility ON mc_review_audit (facility_id, created_at DESC);

-- --------------------------------------------------------------
-- 5. Backfill existing data to new signal columns
-- --------------------------------------------------------------

-- Mark facilities that matched the explicit terminology patterns
UPDATE facilities
SET mc_signal_explicit_name = true
WHERE memory_care_designation ILIKE '%name indicates%'
  AND (
    name ILIKE '%memory%' OR name ILIKE '%dementia%' OR name ILIKE '%alzheim%'
  );

-- Mark facilities that matched chain patterns only (not explicit)
-- and set their review status appropriately
UPDATE facilities
SET mc_signal_chain_name = true,
    mc_review_status = CASE
      WHEN mc_signal_explicit_name OR memory_care_disclosure_filed
        THEN 'auto_published'
      ELSE 'needs_review'
    END
WHERE memory_care_designation ILIKE '%name indicates%'
  AND NOT mc_signal_explicit_name;