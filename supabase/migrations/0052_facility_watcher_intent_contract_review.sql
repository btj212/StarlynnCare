-- 0052 — Add intent column to facility_watchers + contract_review event type
--
-- intent: nullable text capturing the family's declared journey stage at
-- Watch signup — one of 'research', 'touring', 'resident'. NULL = skipped.
-- The 'resident' rate is the Stage 4-5 validation metric.
--
-- contract_review: new submission_events event_type for the Contract Decoder
-- validation landing page (manual-fulfillment upload gate).

-- 1. Add intent column
ALTER TABLE public.facility_watchers
  ADD COLUMN IF NOT EXISTS intent text;

-- 2. Widen submission_events.event_type CHECK to include contract_review
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.submission_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%event_type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.submission_events DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.submission_events
  ADD CONSTRAINT submission_events_event_type_check
  CHECK (event_type IN (
    'facility_watch',
    'area_watch',
    'digest_subscriber',
    'listing_report',
    'review',
    'waitlist',
    'shortlist_watch',
    'contract_review'
  ));

-- 3. Create contract-reviews storage bucket (private — admin access only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-reviews',
  'contract-reviews',
  false,
  10485760,  -- 10 MB limit per upload
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;
