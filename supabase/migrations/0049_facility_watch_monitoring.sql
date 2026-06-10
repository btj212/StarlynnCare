-- 0049 — Facility Watch monitoring (deferred until probe validates signal).
-- Do NOT apply until 0047_hub_content.sql and 0048_submission_events_event_types.sql
-- from main are applied first.
--
-- Watched facilities = any row in facility_watchers.
-- Alerts fire to ADMIN_ALERT_EMAIL + all watchers (confirmed_at set at signup).

create table if not exists public.facility_watch_scan_runs (
  id                uuid        primary key default gen_random_uuid(),
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  status            text        not null default 'running'
                      check (status in ('running', 'completed', 'failed')),
  facilities_scanned int         not null default 0,
  changes_detected  int         not null default 0,
  error             text
);

create table if not exists public.facility_watch_snapshots (
  id           uuid        primary key default gen_random_uuid(),
  facility_id  uuid        not null references public.facilities(id) on delete cascade,
  source       text        not null,
  fingerprint  text        not null,
  payload      jsonb       not null default '{}'::jsonb,
  scanned_at   timestamptz not null default now(),
  constraint facility_watch_snapshots_facility_source_unique unique (facility_id, source)
);

create index if not exists facility_watch_snapshots_facility_idx
  on public.facility_watch_snapshots (facility_id);

create table if not exists public.facility_watch_events (
  id            uuid        primary key default gen_random_uuid(),
  facility_id   uuid        not null references public.facilities(id) on delete cascade,
  scan_run_id   uuid        references public.facility_watch_scan_runs(id) on delete set null,
  source        text        not null,
  event_type    text        not null,
  summary       text        not null,
  payload       jsonb       not null default '{}'::jsonb,
  detected_at   timestamptz not null default now(),
  alert_status  text        not null default 'pending'
                  check (alert_status in ('pending', 'sent', 'failed', 'skipped')),
  alert_error   text
);

create index if not exists facility_watch_events_facility_idx
  on public.facility_watch_events (facility_id, detected_at desc);

create index if not exists facility_watch_events_alert_pending_idx
  on public.facility_watch_events (alert_status, detected_at desc)
  where alert_status = 'pending';

alter table public.facility_watch_scan_runs enable row level security;
alter table public.facility_watch_snapshots enable row level security;
alter table public.facility_watch_events enable row level security;
