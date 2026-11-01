begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create type public.lang_code as enum ('en', 'pa', 'hi', 'es');
create type public.staff_role as enum ('dispatcher', 'admin');
create type public.service_category as enum (
  'towing',
  'mechanic',
  'tires',
  'roadside_assistance',
  'diagnostics',
  'mobile_repair'
);
create type public.provider_status as enum ('active', 'paused', 'removed');
create type public.call_direction as enum ('inbound', 'outbound');
create type public.call_status as enum (
  'queued',
  'ringing',
  'in_progress',
  'handoff_requested',
  'handoff_in_progress',
  'completed',
  'failed'
);
create type public.utterance_speaker as enum (
  'caller',
  'agent',
  'dispatcher',
  'provider'
);
create type public.consent_subject_type as enum ('caller', 'provider', 'staff');
create type public.consent_kind as enum (
  'sms',
  'whatsapp',
  'callback',
  'ai_outbound_calls',
  'recording',
  'terms',
  'data_for_quality'
);
create type public.handoff_trigger as enum (
  'dtmf_zero',
  'spoken_request',
  'agent_escalation',
  'session_end',
  'system_error'
);
create type public.handoff_status as enum (
  'requested',
  'attempted',
  'connected',
  'failed',
  'callback_queued',
  'cancelled'
);
create type public.escalation_priority as enum ('p1', 'p2', 'p3');
create type public.escalation_status as enum (
  'open',
  'acknowledged',
  'resolved'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null,
  display_name text not null check (length(trim(display_name)) > 0),
  languages public.lang_code[] not null default array['en']::public.lang_code[]
    check (cardinality(languages) > 0),
  phone_e164 text check (
    phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
  ),
  on_call boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.callers (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  display_name text,
  preferred_language public.lang_code not null default 'en',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (length(trim(business_name)) > 0),
  contact_name text,
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  languages public.lang_code[] not null default array['en']::public.lang_code[]
    check (cardinality(languages) > 0),
  categories public.service_category[] not null
    check (cardinality(categories) > 0),
  status public.provider_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid references public.callers (id) on delete set null,
  provider_id uuid references public.providers (id) on delete set null,
  twilio_call_sid text not null unique
    check (twilio_call_sid ~ '^CA[0-9A-Fa-f]{32}$'),
  direction public.call_direction not null,
  status public.call_status not null default 'queued',
  from_e164 text not null check (from_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  to_e164 text not null check (to_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  language public.lang_code not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  recording_notice_played boolean not null default false,
  recording_path text,
  ai_seconds integer not null default 0 check (ai_seconds >= 0),
  human_seconds integer not null default 0 check (human_seconds >= 0),
  handoff_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (recording_path is null or recording_notice_played)
);

create table public.utterances (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  external_event_id text,
  sequence_number bigint not null check (sequence_number >= 0),
  speaker public.utterance_speaker not null,
  lang public.lang_code not null,
  text_original text not null check (length(trim(text_original)) > 0),
  text_en text,
  confidence numeric check (confidence between 0 and 1),
  is_final boolean not null default true,
  interrupted boolean not null default false,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (call_id, sequence_number),
  check (ended_at is null or ended_at >= started_at)
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls (id) on delete set null,
  subject_type public.consent_subject_type not null,
  subject_id uuid not null,
  kind public.consent_kind not null,
  granted boolean not null,
  source text not null check (length(trim(source)) > 0),
  evidence jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= created_at)
);

create table public.handoff_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  idempotency_key text not null unique
    check (length(trim(idempotency_key)) between 1 and 255),
  trigger public.handoff_trigger not null,
  status public.handoff_status not null,
  reason text not null check (length(trim(reason)) > 0),
  target_e164 text check (
    target_e164 is null or target_e164 ~ '^\+[1-9][0-9]{7,14}$'
  ),
  requested_at timestamptz not null default now(),
  attempted_at timestamptz,
  connected_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  check (attempted_at is null or attempted_at >= requested_at),
  check (connected_at is null or connected_at >= requested_at),
  check (completed_at is null or completed_at >= requested_at)
);

create table public.escalations (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls (id) on delete cascade,
  reason text not null check (length(trim(reason)) > 0),
  priority public.escalation_priority not null,
  status public.escalation_status not null default 'open',
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text,
  check (resolved_at is null or resolved_at >= created_at),
  check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

create index calls_status_started_at_idx
  on public.calls (status, started_at desc);
create index utterances_call_started_at_idx
  on public.utterances (call_id, started_at);
create unique index utterances_call_external_event_id_idx
  on public.utterances (call_id, external_event_id)
  where external_event_id is not null;
create index consents_subject_kind_created_at_idx
  on public.consents (subject_type, subject_id, kind, created_at desc);
create index handoff_events_call_requested_at_idx
  on public.handoff_events (call_id, requested_at desc);
create index escalations_status_priority_created_at_idx
  on public.escalations (status, priority, created_at);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger providers_set_updated_at
before update on public.providers
for each row execute function public.set_updated_at();

create trigger calls_set_updated_at
before update on public.calls
for each row execute function public.set_updated_at();

create function private.is_ops_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('dispatcher', 'admin')
  );
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function private.is_ops_user() from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_ops_user() to authenticated;

alter table public.profiles enable row level security;
alter table public.callers enable row level security;
alter table public.providers enable row level security;
alter table public.calls enable row level security;
alter table public.utterances enable row level security;
alter table public.consents enable row level security;
alter table public.handoff_events enable row level security;
alter table public.escalations enable row level security;

create policy profiles_ops_read
on public.profiles for select to authenticated
using ((select private.is_ops_user()));

create policy callers_ops_read
on public.callers for select to authenticated
using ((select private.is_ops_user()));

create policy providers_ops_read
on public.providers for select to authenticated
using ((select private.is_ops_user()));

create policy calls_ops_read
on public.calls for select to authenticated
using ((select private.is_ops_user()));

create policy utterances_ops_read
on public.utterances for select to authenticated
using ((select private.is_ops_user()));

create policy consents_ops_read
on public.consents for select to authenticated
using ((select private.is_ops_user()));

create policy handoff_events_ops_read
on public.handoff_events for select to authenticated
using ((select private.is_ops_user()));

create policy escalations_ops_read
on public.escalations for select to authenticated
using ((select private.is_ops_user()));

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.callers from anon, authenticated;
revoke all on table public.providers from anon, authenticated;
revoke all on table public.calls from anon, authenticated;
revoke all on table public.utterances from anon, authenticated;
revoke all on table public.consents from anon, authenticated;
revoke all on table public.handoff_events from anon, authenticated;
revoke all on table public.escalations from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.callers to authenticated;
grant select on table public.providers to authenticated;
grant select on table public.calls to authenticated;
grant select on table public.utterances to authenticated;
grant select on table public.consents to authenticated;
grant select on table public.handoff_events to authenticated;
grant select on table public.escalations to authenticated;

alter table public.calls replica identity full;
alter table public.utterances replica identity full;
alter table public.consents replica identity full;
alter table public.handoff_events replica identity full;
alter table public.escalations replica identity full;

do $$
declare
  relation_name text;
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    foreach relation_name in array array[
      'calls',
      'utterances',
      'consents',
      'handoff_events',
      'escalations'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = relation_name
      ) then
        execute format(
          'alter publication supabase_realtime add table public.%I',
          relation_name
        );
      end if;
    end loop;
  end if;
end;
$$;

commit;
