-- Migration 0039: Enable RLS on pilot_pricing_sources
--
-- This table was applied directly to production outside of migrations.
-- Enabling RLS with no public policy → service role only.

ALTER TABLE pilot_pricing_sources ENABLE ROW LEVEL SECURITY;
