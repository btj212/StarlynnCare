-- ============================================================
-- StarlynnCare Migration 0086 — WA successor-license review list
--
-- DSHS sometimes reissues a license for the same campus (same street,
-- phone, beds). The weekly geo scan used to INSERT a new facilities row
-- and leave inspections on the old license. This table is the review
-- list. The scan flags; it does not delete or merge existing rows.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wa_license_successor_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_facility_id uuid REFERENCES public.facilities(id),
  old_license_number text NOT NULL,
  new_license_number text NOT NULL,
  new_name text,
  street text,
  phone text,
  beds integer,
  detected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (old_license_number, new_license_number)
);

ALTER TABLE public.wa_license_successor_flags ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wa_license_successor_flags IS
  'Review list: DSHS reissued a license at a campus we already store. Do not auto-merge.';
