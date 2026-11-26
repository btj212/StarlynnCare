-- Lets a home answer our questions itself on /{state}/{city}/{home}/confirm.
--
-- A form answer is stored as 'pending' and is invisible to the public RPC until
-- someone has checked who sent it (sender address against the home's own site) and
-- set status = 'published'. Rows entered by hand before the form existed are
-- published by default.
--
-- Two questions added with the form, both things families cannot get from an
-- inspection record: how many staff are awake overnight, and what would lead the
-- home to ask a resident to move out.

ALTER TABLE public.facility_direct_responses
  DROP CONSTRAINT IF EXISTS facility_direct_responses_channel_check;
ALTER TABLE public.facility_direct_responses
  ADD CONSTRAINT facility_direct_responses_channel_check
  CHECK (channel IN ('email', 'phone', 'form'));

ALTER TABLE public.facility_direct_responses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('pending', 'published', 'rejected')),
  ADD COLUMN IF NOT EXISTS respondent_name text,
  ADD COLUMN IF NOT EXISTS respondent_email text,
  ADD COLUMN IF NOT EXISTS overnight_staff integer
    CHECK (overnight_staff BETWEEN 0 AND 50),
  ADD COLUMN IF NOT EXISTS overnight_residents integer
    CHECK (overnight_residents BETWEEN 1 AND 500),
  ADD COLUMN IF NOT EXISTS move_out_reasons text[]
    CHECK (move_out_reasons <@ ARRAY[
      'two_person_transfer', 'feeding_tube', 'aggressive_behavior',
      'exit_seeking', 'no_hospice', 'daily_nursing'
    ]::text[]),
  ADD COLUMN IF NOT EXISTS move_out_note text
    CHECK (char_length(move_out_note) <= 400);

CREATE INDEX IF NOT EXISTS facility_direct_responses_pending_idx
  ON public.facility_direct_responses (created_at DESC) WHERE status = 'pending';

-- Same public reader as before, now published rows only, with the new columns.
DROP FUNCTION IF EXISTS public.facility_home_response(uuid);
CREATE FUNCTION public.facility_home_response(p_facility_id uuid)
 RETURNS TABLE(
   responded_on date,
   channel text,
   memory_care text,
   wandering text,
   private_pay_low integer,
   private_pay_high integer,
   medicaid text,
   medicaid_program text,
   overnight_staff integer,
   overnight_residents integer,
   move_out_reasons text[],
   move_out_note text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT r.responded_on, r.channel, r.memory_care, r.wandering,
         r.private_pay_low, r.private_pay_high, r.medicaid, r.medicaid_program,
         r.overnight_staff, r.overnight_residents, r.move_out_reasons, r.move_out_note
  FROM facility_direct_responses r
  JOIN facilities f ON f.id = r.facility_id AND f.publishable
  WHERE r.facility_id = p_facility_id AND r.status = 'published'
  ORDER BY r.responded_on DESC, r.created_at DESC
  LIMIT 1
$function$;

ALTER TABLE public.submission_events
  DROP CONSTRAINT IF EXISTS submission_events_event_type_check;
ALTER TABLE public.submission_events
  ADD CONSTRAINT submission_events_event_type_check
  CHECK (event_type IN (
    'facility_watch', 'area_watch', 'digest_subscriber', 'listing_report', 'review',
    'waitlist', 'shortlist_watch', 'contract_review', 'partner_tour', 'home_response'
  ));
