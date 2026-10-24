-- 0066 — Room for a later monthly update and a saved decision stage.
--
-- This does not enroll anyone and does not send email. The new products
-- exist so an approved campaign can be recorded later. journey_stage is
-- what a person tells us on the preference page.

alter table public.customer_preferences
  add column if not exists journey_stage text,
  add column if not exists journey_stage_at timestamptz;

alter table public.customer_commitments
  drop constraint if exists customer_commitments_product_check;

alter table public.customer_commitments
  add constraint customer_commitments_product_check
  check (product in (
    'records_email',
    'tour_pack',
    'area_watch',
    'facility_watch',
    'paid_facility_watch',
    'library_magnet',
    'contract_review',
    'shortlist_report',
    'waitlist',
    'monthly_update',
    'decision_course'
  ));
