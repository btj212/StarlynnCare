-- Migration: 0070_il_mo_source_events.sql
--
-- Illinois and Missouri can have more than one inspection event on the same
-- day with the same visit type. The old uniqueness key kept only one of those
-- events. This migration gives an event its own identity when the source file
-- has one, and keeps the old key only for rows that do not.
--
-- It also stores every Illinois FOIA row and every Missouri workbook row in a
-- service-only ledger. A row is normalized or quarantined. It is not public.
--
-- All changes are additive. No existing column is dropped or renamed.

alter table public.inspections
  add column if not exists source_event_id text;

comment on column public.inspections.source_event_id is
  'Source event identity when the regulator file has one. Missouri uses DHSS EVENT_ID. Illinois uses the FOIA visit id. That Illinois value is not a facility license. Null on older rows that are unique by facility, date, and type.';

-- Backfill Missouri before the date/type key stops covering these rows.
update public.inspections i
set source_event_id = btrim(i.raw_data->>'event_id')
from public.facilities f
where f.id = i.facility_id
  and f.state_code = 'MO'
  and i.source_agency = 'MO-DHSS'
  and nullif(btrim(i.raw_data->>'event_id'), '') is not null
  and i.source_event_id is null;

do $$
declare
  dupes int;
begin
  select count(*) into dupes
  from (
    select source_agency, source_event_id
    from public.inspections
    where source_event_id is not null
    group by 1, 2
    having count(*) > 1
  ) d;
  if dupes > 0 then
    raise exception 'source_event_id is not unique for % agency pairs', dupes;
  end if;
end $$;

create unique index if not exists inspections_source_event_key
  on public.inspections (source_agency, source_event_id)
  where source_event_id is not null;

create unique index if not exists inspections_facility_date_type_agency_unkeyed
  on public.inspections (
    facility_id,
    inspection_date,
    inspection_type,
    coalesce(source_agency, '')
  )
  where source_event_id is null;

drop index if exists public.inspections_facility_date_type_agency_key;

-- ─────────────────────────────────────────────────────────────────────────────
-- Service-only source ledgers
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.il_source_rows (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_key text not null,
  disposition text not null,
  reason text,
  facility_external_id text,
  raw jsonb not null,
  ingested_at timestamptz not null default now(),
  constraint il_source_rows_source_key unique (source, source_key),
  constraint il_source_rows_source_check check (
    source in ('foia_visits', 'llcs_directory')
  ),
  constraint il_source_rows_disposition_check check (
    disposition in ('normalized', 'quarantined')
  )
);

comment on table public.il_source_rows is
  'Service-only Illinois source ledger. Every FOIA visit row is normalized onto a matched facility or quarantined. Not for the public API.';

create index if not exists il_source_rows_disposition_idx
  on public.il_source_rows (source, disposition, reason);

alter table public.il_source_rows enable row level security;

revoke all on table public.il_source_rows from public, anon, authenticated;

drop policy if exists il_source_rows_deny_api on public.il_source_rows;
create policy il_source_rows_deny_api
  on public.il_source_rows
  for all
  to anon, authenticated
  using (false)
  with check (false);

create table if not exists public.mo_source_rows (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_key text not null,
  disposition text not null,
  reason text,
  facility_external_id text,
  raw jsonb not null,
  ingested_at timestamptz not null default now(),
  constraint mo_source_rows_source_key unique (source, source_key),
  constraint mo_source_rows_source_check check (
    source in ('foia_records', 'dhss_directory')
  ),
  constraint mo_source_rows_disposition_check check (
    disposition in ('normalized', 'quarantined')
  )
);

comment on table public.mo_source_rows is
  'Service-only Missouri source ledger. Every workbook tag row is normalized onto its EVENT_ID or quarantined. Not for the public API.';

create index if not exists mo_source_rows_disposition_idx
  on public.mo_source_rows (source, disposition, reason);

alter table public.mo_source_rows enable row level security;

revoke all on table public.mo_source_rows from public, anon, authenticated;

drop policy if exists mo_source_rows_deny_api on public.mo_source_rows;
create policy mo_source_rows_deny_api
  on public.mo_source_rows
  for all
  to anon, authenticated
  using (false)
  with check (false);
