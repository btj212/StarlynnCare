-- ============================================================
-- StarlynnCare Migration 0047 — Hub content pipeline
--
-- Backs the city-first hub content pipeline: LLM-drafted editorial
-- prose for /[state]/[city] hubs, edited in the /admin/hub-content
-- review tool (TipTap) and published only after human approval.
--
-- Accuracy model (no human checks the numbers):
--   * stats_snapshot stores every numeric claim the prose was grounded on.
--   * drift_detected is flipped true by scripts/validate/hub_content_drift_check.py
--     when a later ingest moves any snapshot metric beyond threshold.
--   * The public SELECT policy hides any row that is drifted, so a stale
--     number can never render — the page falls back to live dynamic stats
--     until a human re-approves (which clears drift_detected).
--
-- Writes are service-role only (admin server actions via getServiceClient).
-- Reads are anon, restricted to published + non-drifted rows.
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_content (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Region this content belongs to. Keyed the same way the app keys
  -- intros today: state_code + region_slug (e.g. 'CA' + 'oakland').
  state_code      text NOT NULL CHECK (char_length(state_code) = 2),
  region_slug     text NOT NULL CHECK (char_length(region_slug) BETWEEN 1 AND 255),
  region_kind     text NOT NULL DEFAULT 'city'
                    CHECK (region_kind IN ('city', 'county')),

  -- Editorial body. TipTap emits a constrained HTML subset
  -- (paragraphs, bold/italic, headings, lists, links).
  title           text CHECK (title IS NULL OR char_length(title) <= 200),
  body_html       text,

  -- Optional supplemental FAQ ({q, a} pairs). Phase 1 leaves this null —
  -- live FAQs are still built by buildCityFaqs(). Reserved for later.
  faq_items       jsonb,

  -- Every numeric claim the prose was grounded on, e.g.
  -- { "facility_count": 93, "pct_with_serious": 41, "last_inspection_date": "2026-02-01" }.
  -- The generation gate guarantees prose numbers ⊆ this snapshot; the
  -- approval gate and the post-ingest audit both re-verify it against the DB.
  stats_snapshot  jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Review workflow.
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'in_review', 'published')),

  -- Auto-suppress: set true by the drift audit when a snapshot metric no
  -- longer matches the DB. Cleared on re-approval. Drifted rows are hidden
  -- by the public read policy below.
  drift_detected  boolean NOT NULL DEFAULT false,
  drift_details   jsonb,
  last_audit_at   timestamptz,

  -- Provenance.
  model           text,
  generated_at    timestamptz,
  approved_by     text,
  approved_at     timestamptz,
  published_at    timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- One content row per region.
  UNIQUE (state_code, region_slug)
);

COMMENT ON TABLE hub_content IS
  'LLM-drafted, human-approved editorial prose for city/county hub pages. Numbers are grounded in stats_snapshot and auto-audited for drift.';
COMMENT ON COLUMN hub_content.stats_snapshot IS
  'Numeric claims the prose was grounded on; re-verified against the DB by the approval gate and the post-ingest drift audit.';
COMMENT ON COLUMN hub_content.drift_detected IS
  'Set true when a later ingest moves a snapshot metric beyond threshold. Drifted rows are hidden from the public read policy until re-approved.';

-- Admin queue: list by status quickly.
CREATE INDEX IF NOT EXISTS idx_hub_content_status
  ON hub_content (status, updated_at DESC);

-- Row Level Security
ALTER TABLE hub_content ENABLE ROW LEVEL SECURITY;

-- Public (anon): read only published, non-drifted rows. Service-role writes
-- bypass RLS, so no insert/update policy is needed (matches `reviews`).
CREATE POLICY "hub_content_select_live"
  ON hub_content FOR SELECT
  USING (status = 'published' AND drift_detected = false);
