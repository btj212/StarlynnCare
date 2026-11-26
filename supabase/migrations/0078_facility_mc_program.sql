-- Two-level Arizona memory-care badge.
--
-- Level 1 is the Directed Care license (A.A.C. R9-10-816) and is shown in
-- the app from existing license columns. Level 2 is an operator-sourced
-- confirmation that this exact address has a named / secured memory-care
-- program. It is not a regulator subclass and it does not change
-- publishable / listed / sitemap state.
--
-- Do not write these columns from ingest. Fill them only after a human
-- checks the operator's own page for that address, or records a phone
-- confirmation. Never invent a program from a chain name or a neighbour.

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS mc_program_confirmed boolean,
  ADD COLUMN IF NOT EXISTS mc_program_source_url text,
  ADD COLUMN IF NOT EXISTS mc_program_quote text,
  ADD COLUMN IF NOT EXISTS mc_program_checked_at timestamptz;

COMMENT ON COLUMN public.facilities.mc_program_confirmed IS
  'True when a named or secured memory-care program is confirmed for this exact address. Null until checked. Never written by ingest.';
COMMENT ON COLUMN public.facilities.mc_program_source_url IS
  'Operator page for this address, or a note URL for a recorded phone confirmation.';
COMMENT ON COLUMN public.facilities.mc_program_quote IS
  'Short quote from that source. Null if none.';
COMMENT ON COLUMN public.facilities.mc_program_checked_at IS
  'When the program confirmation was checked.';
