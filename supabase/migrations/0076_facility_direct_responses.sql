-- What a home itself told us when we asked directly (email or phone), one row per
-- response. These are the home's own words, not regulator data and not checked by
-- StarlynnCare, so they live apart from the state-sourced columns on facilities.
--
-- The table is closed to the public API. The profile reads one row through
-- facility_home_response(), which returns only the columns it prints.
-- openings_note is kept for our records and never printed: a vacancy goes stale in days.

CREATE TABLE IF NOT EXISTS public.facility_direct_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  responded_on     date NOT NULL,
  channel          text NOT NULL CHECK (channel IN ('email', 'phone')),
  memory_care      text CHECK (memory_care IN ('yes', 'no')),
  wandering        text CHECK (wandering IN ('yes', 'yes_after_assessment', 'no')),
  openings_note    text,
  private_pay_low  integer CHECK (private_pay_low > 0),
  private_pay_high integer CHECK (private_pay_high >= private_pay_low),
  medicaid         text CHECK (medicaid IN ('yes', 'no')),
  medicaid_program text,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facility_direct_responses_facility_idx
  ON public.facility_direct_responses (facility_id, responded_on DESC);

ALTER TABLE public.facility_direct_responses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.facility_home_response(p_facility_id uuid)
 RETURNS TABLE(
   responded_on date,
   channel text,
   memory_care text,
   wandering text,
   private_pay_low integer,
   private_pay_high integer,
   medicaid text,
   medicaid_program text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT r.responded_on, r.channel, r.memory_care, r.wandering,
         r.private_pay_low, r.private_pay_high, r.medicaid, r.medicaid_program
  FROM facility_direct_responses r
  JOIN facilities f ON f.id = r.facility_id AND f.publishable
  WHERE r.facility_id = p_facility_id
  ORDER BY r.responded_on DESC, r.created_at DESC
  LIMIT 1
$function$;
