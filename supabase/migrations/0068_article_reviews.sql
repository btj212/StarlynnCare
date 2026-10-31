-- ============================================================
-- StarlynnCare Migration 0068 — Article review gate
--
-- Editorial articles stay in code. This table only records whether
-- a path has been approved or held. A path with no row is a draft.
-- Anonymous reads see approved rows only. Writes are service-role
-- only, from the /admin/articles server actions.
-- ============================================================

CREATE TABLE IF NOT EXISTS article_reviews (
  path         text PRIMARY KEY CHECK (char_length(path) BETWEEN 1 AND 300),
  status       text NOT NULL CHECK (status IN ('approved', 'held')),
  note         text CHECK (note IS NULL OR char_length(note) <= 2000),
  approved_by  text,
  approved_at  timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE article_reviews IS
  'Human approval for code-authored articles. No row means the path stays off the public site.';

ALTER TABLE article_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "article_reviews_select_approved"
  ON article_reviews FOR SELECT
  USING (status = 'approved');
