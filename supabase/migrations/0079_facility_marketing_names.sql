-- ============================================================
-- StarlynnCare Migration 0077 — DBA / marketing-name aliases
--
-- Legal license names often differ from the name families type
-- ("Legacy House of Mesa" vs "Legacy Retirement Residence").
-- These columns are the fill hook. Do not invent values. Leave
-- NULL / empty until a sourced DBA, chain name, or operator
-- confirmation exists.
--
-- The app already reads content.marketing_name as a deploy-safe
-- fallback, so this migration can wait for Blake's approval.
-- ============================================================

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS marketing_name text,
  ADD COLUMN IF NOT EXISTS name_aliases text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.facilities.marketing_name IS
  'DBA / consumer-facing name when different from the legal license name. Never invent; fill from a regulator DBA, the operator, or a sourced directory.';

COMMENT ON COLUMN public.facilities.name_aliases IS
  'Additional search aliases (former names, chain names). Empty until sourced.';

CREATE INDEX IF NOT EXISTS facilities_marketing_name_trgm_idx
  ON public.facilities (marketing_name)
  WHERE marketing_name IS NOT NULL;
