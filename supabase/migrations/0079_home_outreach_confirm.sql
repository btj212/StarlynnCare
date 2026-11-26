-- Operator confirm / outreach form.
--
-- Additive only. Safe if #244's 0077_home_response_form / 0078_home_response_consent
-- already ran on main (those columns use IF NOT EXISTS). Next number after
-- 0078_facility_mc_program.sql on this stack.
--
-- Form answers stay status = 'pending'. They do not change publishable / listed /
-- sitemap, and they never write facilities.mc_program_confirmed. A person copies
-- a secured-program answer onto Level 2 after checking the operator's own page
-- for that exact address, or a recorded phone confirmation.
--
-- Do not apply until reviewed.

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
    CHECK (char_length(move_out_note) <= 400),
  ADD COLUMN IF NOT EXISTS authorized_to_answer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_permission boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_link text
    CHECK (photo_link IS NULL OR (photo_link ~ '^https?://' AND char_length(photo_link) <= 500)),
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS listing_checks jsonb,
  ADD COLUMN IF NOT EXISTS mc_secured text
    CHECK (mc_secured IS NULL OR mc_secured IN ('yes', 'no')),
  ADD COLUMN IF NOT EXISTS mc_program_name text
    CHECK (mc_program_name IS NULL OR char_length(mc_program_name) <= 120),
  ADD COLUMN IF NOT EXISTS mc_program_url text
    CHECK (mc_program_url IS NULL OR (mc_program_url ~ '^https?://' AND char_length(mc_program_url) <= 500)),
  ADD COLUMN IF NOT EXISTS outreach_token_valid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_domain_matches boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.facility_direct_responses.listing_checks IS
  'What we showed vs what the home marked correct or needing a fix. Pending until reviewed. Never auto-applied to facilities.';
COMMENT ON COLUMN public.facility_direct_responses.mc_secured IS
  'Home said there is a secured or locked memory-care area at this exact address. Pending. Never auto-publishes Level 2.';
COMMENT ON COLUMN public.facility_direct_responses.mc_program_name IS
  'Named memory-care program at this address, if any. Pending. Never auto-publishes Level 2.';
COMMENT ON COLUMN public.facility_direct_responses.mc_program_url IS
  'Operator page for that program at this address. Pending. Never auto-publishes Level 2.';
COMMENT ON COLUMN public.facility_direct_responses.outreach_token_valid IS
  'True when the submitter used a signed per-facility outreach token. Reviewer trust only; row stays pending.';
COMMENT ON COLUMN public.facility_direct_responses.email_domain_matches IS
  'True when the work email domain matches the facility website host. Reviewer trust only; row stays pending.';

CREATE INDEX IF NOT EXISTS facility_direct_responses_pending_idx
  ON public.facility_direct_responses (created_at DESC) WHERE status = 'pending';

-- Public reader: published rows only. Does not return listing_checks or the
-- pending memory-care program fields — those wait for a person.
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

DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.submission_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%event_type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.submission_events DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.submission_events
  ADD CONSTRAINT submission_events_event_type_check
  CHECK (event_type IN (
    'facility_watch', 'area_watch', 'digest_subscriber', 'listing_report', 'review',
    'waitlist', 'shortlist_watch', 'contract_review', 'partner_tour', 'home_response'
  ));
