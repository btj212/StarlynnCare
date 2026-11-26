-- A phone number the home itself gave us, checked against the home's own website.
-- State directory refreshes (for example az_adhs_directory_ingest.py) rewrite
-- facilities.phone from the regulator on every run, so a correction typed into
-- that column is lost. The override lives in its own column, which no ingest writes.
-- The profile shows phone_override when set and falls back to phone.

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS phone_override text,
  ADD COLUMN IF NOT EXISTS phone_override_note text;

COMMENT ON COLUMN public.facilities.phone_override IS
  'Operator-supplied phone, shown instead of phone. Never written by ingest.';
COMMENT ON COLUMN public.facilities.phone_override_note IS
  'Who asked, when, and how it was checked.';
