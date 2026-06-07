-- Unified audit ledger for all email-capture surfaces.
-- Domain tables (facility_watchers, mc_listing_reports, reviews) remain the
-- canonical records; this table is a cross-surface log read by /admin/submissions
-- and used to track admin alert delivery status.

create table public.submission_events (
  id            uuid        primary key default gen_random_uuid(),
  event_type    text        not null check (event_type in (
                  'facility_watch', 'area_watch', 'listing_report', 'review', 'waitlist'
                )),
  email         text        not null,
  source        text,
  facility_id   uuid        references public.facilities(id) on delete set null,
  summary       text        not null,
  payload       jsonb       not null default '{}'::jsonb,
  alert_status  text        not null default 'pending'
                  check (alert_status in ('pending', 'sent', 'failed', 'skipped')),
  alert_error   text,
  created_at    timestamptz not null default now()
);

create index submission_events_created_at_idx  on public.submission_events (created_at desc);
create index submission_events_event_type_idx  on public.submission_events (event_type, created_at desc);
create index submission_events_email_idx       on public.submission_events (lower(email));

-- Deny-all RLS; admin routes read via service-role key which bypasses RLS.
alter table public.submission_events enable row level security;
