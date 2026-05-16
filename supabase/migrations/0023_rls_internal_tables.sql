-- Migration 0023: Enable RLS on internal operational tables
--
-- All tables below are internal (ingest pipeline, audit, pilot research).
-- RLS is enabled with no public-read policy → service role only.
-- The pilot_pricing_* tables were applied directly to production and may not
-- exist in all environments, so they are guarded with existence checks.

-- ── MC operational tables (created in 0010/0012) ─────────────────────────
ALTER TABLE mc_listing_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_review_audit     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_queue_evidence   ENABLE ROW LEVEL SECURITY;

-- ── Pilot research tables (created in 0022) ───────────────────────────────
ALTER TABLE pilot_news_hits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_extract_rows   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_operator_claims ENABLE ROW LEVEL SECURITY;

-- ── Pilot pricing tables (applied directly; guard with existence check) ───
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pilot_pricing_queries'
  ) THEN
    ALTER TABLE pilot_pricing_queries ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pilot_pricing_triangulated'
  ) THEN
    ALTER TABLE pilot_pricing_triangulated ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
