-- ============================================================
-- 0064 — Facility Watch alert eligibility
--
-- New public free facility-watch enrollment is closed. Existing
-- facility_watchers keep official-record alerts. One-time email
-- leads (records/tour) may still write a row but must not receive
-- ongoing change alerts. Paid Facility Watch sets alerts_eligible=true.
-- ============================================================

alter table public.facility_watchers
  add column if not exists alerts_eligible boolean not null default true;

comment on column public.facility_watchers.alerts_eligible is
  'When true, weekly official-record dispatch may email this watcher. Legacy free and paid Facility Watch rows are true; one-time lead captures are false.';

create index if not exists facility_watchers_alerts_eligible_idx
  on public.facility_watchers (facility_id)
  where alerts_eligible and confirmed_at is not null;
