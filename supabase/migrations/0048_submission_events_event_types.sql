-- ============================================================
-- 0048 — Align submission_events.event_type CHECK with the app's
-- SubmissionEventType union.
--
-- Bug: src/lib/submissions/recordSubmission.ts emits SEVEN event types
-- (facility_watch, area_watch, digest_subscriber, listing_report, review,
-- waitlist, shortlist_watch), but the 0031 CHECK only permitted five.
-- Inserts for `digest_subscriber` and `shortlist_watch` were rejected
-- (SQLSTATE 23514) and silently swallowed by recordSubmission's
-- fire-and-forget `.catch()`, so those captures reached Loops but never
-- appeared in /admin/submissions. This widens the allow-list to match.
--
-- Additive only — it permits more values, so it cannot reject any row the
-- old constraint accepted.
-- ============================================================

-- Drop the existing event_type check by its real name (inline column checks
-- are conventionally named <table>_<column>_check, but resolve it dynamically
-- to be safe across environments).
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
    'shortlist_watch'
  ));
