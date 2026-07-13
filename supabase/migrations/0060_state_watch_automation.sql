-- 0060 — State/area watch subscriptions, scan ledger, and deduplicated delivery.
--
-- Service-role only. Public signup routes write through the server client.

create table if not exists public.area_watchers (
  id                    uuid        primary key default gen_random_uuid(),
  email                 text        not null,
  area_name             text        not null,
  area_slug             text        not null,
  state_code             text        not null,
  source                 text,
  created_at             timestamptz not null default now(),
  baseline_at            timestamptz not null default now(),
  last_successful_scan_at timestamptz,
  active                 boolean     not null default true,
  unsubscribe_token      text        not null default encode(gen_random_bytes(32), 'hex'),
  constraint area_watchers_email_area_unique unique (email, state_code, area_slug)
);

create unique index if not exists area_watchers_unsubscribe_token_idx
  on public.area_watchers (unsubscribe_token);
create index if not exists area_watchers_state_active_idx
  on public.area_watchers (state_code, active)
  where active;

alter table public.facility_watchers
  add column if not exists baseline_at timestamptz not null default now(),
  add column if not exists last_successful_scan_at timestamptz;

update public.facility_watchers
set baseline_at = created_at
where baseline_at > created_at;

create table if not exists public.state_scan_runs (
  id                 uuid        primary key default gen_random_uuid(),
  state_code         text        not null,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  status             text        not null default 'running'
                       check (status in ('running', 'completed', 'partial', 'failed')),
  facilities_before  int         not null default 0,
  facilities_after   int         not null default 0,
  inspections_before int         not null default 0,
  inspections_after  int         not null default 0,
  deficiencies_before int        not null default 0,
  deficiencies_after int         not null default 0,
  changes_detected   int         not null default 0,
  error              text,
  metadata           jsonb       not null default '{}'::jsonb
);

create index if not exists state_scan_runs_state_started_idx
  on public.state_scan_runs (state_code, started_at desc);

create table if not exists public.state_scan_sources (
  id              uuid        primary key default gen_random_uuid(),
  scan_run_id     uuid        not null references public.state_scan_runs(id) on delete cascade,
  source          text        not null,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  status          text        not null default 'running'
                    check (status in ('running', 'completed', 'failed', 'skipped')),
  records_before  int,
  records_after   int,
  watermark       text,
  error           text,
  metadata        jsonb       not null default '{}'::jsonb,
  constraint state_scan_sources_run_source_unique unique (scan_run_id, source)
);

create table if not exists public.state_scan_facility_deltas (
  id              uuid        primary key default gen_random_uuid(),
  scan_run_id     uuid        not null references public.state_scan_runs(id) on delete cascade,
  facility_id     uuid        references public.facilities(id) on delete set null,
  change_type     text        not null
                    check (change_type in ('facility_added', 'facility_updated', 'inspection_record_changed')),
  summary         text        not null,
  before_payload  jsonb,
  after_payload   jsonb,
  fingerprint     text        not null,
  created_at      timestamptz not null default now(),
  constraint state_scan_facility_delta_unique unique (scan_run_id, fingerprint)
);

create index if not exists state_scan_facility_deltas_run_idx
  on public.state_scan_facility_deltas (scan_run_id);
create index if not exists state_scan_facility_deltas_facility_idx
  on public.state_scan_facility_deltas (facility_id, created_at desc);

create table if not exists public.watch_alert_deliveries (
  id                uuid        primary key default gen_random_uuid(),
  watcher_type      text        not null check (watcher_type in ('area', 'facility')),
  watcher_id        uuid        not null,
  scan_run_id       uuid        not null references public.state_scan_runs(id) on delete cascade,
  recipient         text        not null,
  change_fingerprint text       not null,
  status            text        not null default 'pending'
                      check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempted_at      timestamptz,
  sent_at           timestamptz,
  error             text,
  payload           jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  constraint watch_alert_deliveries_dedupe
    unique (watcher_type, watcher_id, change_fingerprint)
);

create index if not exists watch_alert_deliveries_pending_idx
  on public.watch_alert_deliveries (status, created_at)
  where status in ('pending', 'failed');

alter table public.area_watchers enable row level security;
alter table public.state_scan_runs enable row level security;
alter table public.state_scan_sources enable row level security;
alter table public.state_scan_facility_deltas enable row level security;
alter table public.watch_alert_deliveries enable row level security;
