-- 0065 — Customer promise ledger.
--
-- Supabase is the source of truth for what we promised and whether we
-- delivered it. Loops stays the delivery channel. One person can hold
-- several commitments; a later signup must not erase an earlier one.
-- Domain tables (facility_watchers, area_watchers,
-- facility_watch_subscriptions) stay authoritative for watching and billing.
--
-- Backfill records history and stages catch-up work. It does not send email.

create table if not exists public.customer_preferences (
  email                  text        primary key,
  token                  text        not null unique,
  unsubscribed_all       boolean     not null default false,
  unsubscribed_products  text[]      not null default '{}',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.customer_commitments (
  id                uuid        primary key default gen_random_uuid(),
  email             text        not null,
  product           text        not null
                      check (product in (
                        'records_email',
                        'tour_pack',
                        'area_watch',
                        'facility_watch',
                        'paid_facility_watch',
                        'library_magnet',
                        'contract_review',
                        'shortlist_report',
                        'waitlist'
                      )),
  subject_key       text        not null default '',
  source            text,
  consent_at        timestamptz not null default now(),
  status            text        not null default 'open'
                      check (status in (
                        'open',
                        'active',
                        'fulfilled',
                        'overdue',
                        'canceled',
                        'unsubscribed',
                        'needs_review'
                      )),
  stage             text,
  due_at            timestamptz,
  follow_up_due_at  timestamptz,
  last_fulfilled_at timestamptz,
  facility_id       uuid        references public.facilities(id) on delete set null,
  metadata          jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint customer_commitments_email_product_subject_unique
    unique (email, product, subject_key)
);

create index if not exists customer_commitments_status_due_idx
  on public.customer_commitments (status, due_at);
create index if not exists customer_commitments_email_idx
  on public.customer_commitments (email);

create table if not exists public.customer_deliveries (
  id                  uuid        primary key default gen_random_uuid(),
  commitment_id       uuid        references public.customer_commitments(id) on delete cascade,
  idempotency_key     text        not null unique,
  kind                text        not null
                        check (kind in (
                          'asset',
                          'alert',
                          'follow_up',
                          'catchup',
                          'manual_followup',
                          'confirmation',
                          'admin'
                        )),
  channel             text        not null default 'loops',
  template_key        text,
  status              text        not null default 'pending'
                        check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error               text,
  payload             jsonb       not null default '{}'::jsonb,
  attempted_at        timestamptz,
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists customer_deliveries_commitment_idx
  on public.customer_deliveries (commitment_id, created_at desc);
create index if not exists customer_deliveries_pending_idx
  on public.customer_deliveries (status, created_at)
  where status in ('pending', 'failed');

alter table public.customer_preferences enable row level security;
alter table public.customer_commitments enable row level security;
alter table public.customer_deliveries enable row level security;

-- ---------------------------------------------------------------------------
-- Backfill. Historical follow-ups are not scheduled: those dates are in the
-- past and a sweep would look like a new blast. New signups set follow_up_due_at.
-- ---------------------------------------------------------------------------

insert into public.customer_commitments (
  email, product, subject_key, source, consent_at, status, stage,
  due_at, last_fulfilled_at, facility_id, metadata
)
select
  lower(trim(w.email)),
  'records_email',
  w.facility_id::text,
  w.source,
  coalesce(w.created_at, w.confirmed_at, now()),
  'fulfilled',
  'asset_sent',
  coalesce(w.created_at, w.confirmed_at, now()),
  coalesce(w.created_at, w.confirmed_at, now()),
  w.facility_id,
  jsonb_build_object(
    'backfill', true,
    'note', 'Loops records template shows the current requesters as delivered. Do not resend unless a delivery row is failed.'
  )
from public.facility_watchers w
where w.source in ('offer_records', 'records_pull_interest')
on conflict (email, product, subject_key) do nothing;

insert into public.customer_commitments (
  email, product, subject_key, source, consent_at, status, stage,
  due_at, last_fulfilled_at, facility_id, metadata
)
select
  lower(trim(w.email)),
  'tour_pack',
  w.facility_id::text,
  w.source,
  coalesce(w.created_at, w.confirmed_at, now()),
  'fulfilled',
  'asset_sent',
  coalesce(w.created_at, w.confirmed_at, now()),
  coalesce(w.created_at, w.confirmed_at, now()),
  w.facility_id,
  jsonb_build_object(
    'backfill', true,
    'note', 'Loops tour template: 2 sends, both delivered.'
  )
from public.facility_watchers w
where w.source = 'offer_tour'
on conflict (email, product, subject_key) do nothing;

insert into public.customer_commitments (
  email, product, subject_key, source, consent_at, status, stage, facility_id, metadata
)
select
  lower(trim(w.email)),
  'facility_watch',
  w.facility_id::text,
  w.source,
  coalesce(w.created_at, w.confirmed_at, now()),
  'active',
  'watching',
  w.facility_id,
  jsonb_build_object('backfill', true, 'alertsEligible', coalesce(w.alerts_eligible, true))
from public.facility_watchers w
where w.confirmed_at is not null
  and coalesce(w.alerts_eligible, true)
  and coalesce(w.source, '') not in (
    'offer_records', 'records_pull_interest', 'offer_tour', 'paid_facility_watch'
  )
on conflict (email, product, subject_key) do nothing;

-- Records leads that were also marked alert-eligible stay on the alert list
-- as their own commitment. The one-time record email is the row above.
insert into public.customer_commitments (
  email, product, subject_key, source, consent_at, status, stage, facility_id, metadata
)
select
  lower(trim(w.email)),
  'facility_watch',
  w.facility_id::text,
  w.source,
  coalesce(w.created_at, w.confirmed_at, now()),
  'active',
  'watching',
  w.facility_id,
  jsonb_build_object(
    'backfill', true,
    'note', 'This records lead is also alert-eligible. Keep the record email and the watch separate.'
  )
from public.facility_watchers w
where w.confirmed_at is not null
  and w.alerts_eligible is true
  and w.source in ('offer_records', 'records_pull_interest')
on conflict (email, product, subject_key) do nothing;

insert into public.customer_commitments (
  email, product, subject_key, source, consent_at, status, stage, metadata
)
select
  lower(trim(aw.email)),
  'area_watch',
  aw.state_code || ':' || aw.area_slug,
  aw.source,
  aw.created_at,
  case when aw.active then 'active' else 'canceled' end,
  'watching',
  jsonb_build_object(
    'backfill', true,
    'areaName', aw.area_name,
    'areaSlug', aw.area_slug,
    'stateCode', aw.state_code
  )
from public.area_watchers aw
on conflict (email, product, subject_key) do nothing;

insert into public.customer_commitments (
  email, product, subject_key, source, consent_at, status, stage,
  due_at, facility_id, metadata
)
select
  lower(trim(s.email)),
  'paid_facility_watch',
  s.id::text,
  'stripe_checkout',
  s.created_at,
  case
    when s.status = 'active' and s.fulfillment_status = 'pending' then 'open'
    when s.status = 'active' then 'active'
    else 'canceled'
  end,
  s.fulfillment_status,
  case
    when s.status = 'active' and s.fulfillment_status = 'pending'
      then s.created_at + interval '1 day'
    else null
  end,
  case
    when exists (select 1 from public.facilities f where f.id = s.facility_id) then s.facility_id
    else null
  end,
  jsonb_build_object(
    'backfill', true,
    'subscriptionStatus', s.status,
    'fulfillmentStatus', s.fulfillment_status,
    'note', case
      when s.status = 'pending' then 'Abandoned checkout. Not a customer.'
      when s.status = 'canceled' then 'Controlled or ended subscription. Do not email as a missed customer promise.'
      else null
    end
  )
from public.facility_watch_subscriptions s
on conflict (email, product, subject_key) do nothing;

insert into public.customer_commitments (
  email, product, subject_key, source, consent_at, status, stage, due_at, metadata
)
select
  lower(trim(e.email)),
  'library_magnet',
  coalesce(e.payload->>'magnet', 'unknown'),
  e.source,
  e.created_at,
  case
    when e.payload->>'magnet' = 'alw_checklist' then 'overdue'
    when e.payload->>'magnet' = 'tour_scoresheet' then 'needs_review'
    else 'open'
  end,
  case
    when e.payload->>'magnet' = 'alw_checklist' then 'asset_pending'
    when e.payload->>'magnet' = 'tour_scoresheet' then 'asset_sent'
    else 'asset_pending'
  end,
  e.created_at,
  jsonb_build_object(
    'backfill', true,
    'magnet', e.payload->>'magnet',
    'note', case
      when e.payload->>'magnet' = 'alw_checklist'
        then 'Published ALW template has 0 sends. Stage the checklist. Do not send until the catch-up list is approved.'
      when e.payload->>'magnet' = 'tour_scoresheet'
        then 'Loops shows 2 scoresheet sends and 3 people requested it. Confirm who missed it before any resend.'
      else 'No matching Loops audience yet.'
    end
  )
from public.submission_events e
where e.event_type = 'digest_subscriber'
  and coalesce(e.payload->>'magnet', '') <> ''
on conflict (email, product, subject_key) do nothing;

insert into public.customer_commitments (
  email, product, subject_key, source, consent_at, status, stage,
  last_fulfilled_at, metadata
)
select
  lower(trim(e.email)),
  'contract_review',
  'admission-agreement',
  e.source,
  e.created_at,
  'fulfilled',
  'delivered',
  e.created_at,
  jsonb_build_object(
    'backfill', true,
    'note', 'Acknowledgment was delivered. The written review was sent by hand on 2026-10-22. A personal follow-up is staged and not sent.'
  )
from public.submission_events e
where e.event_type = 'contract_review'
on conflict (email, product, subject_key) do nothing;

-- May 2026 Orange County signup reached Loops and submission_events, but no
-- area_watchers row was saved (state code was missing). Do not invent a
-- watcher or replay history. Leave it for a human to confirm the state.
insert into public.customer_commitments (
  email, product, subject_key, source, consent_at, status, stage, metadata
)
select
  lower(trim(e.email)),
  'area_watch',
  'UNSET:orange-county',
  e.source,
  e.created_at,
  'needs_review',
  'watching',
  jsonb_build_object(
    'backfill', true,
    'areaName', 'Orange County',
    'areaSlug', 'orange-county',
    'note', 'Signup never created an area watcher. Confirm the state, then start the watch from that day forward. Do not email old scan rows.'
  )
from public.submission_events e
where e.event_type = 'area_watch'
  and e.payload->>'areaSlug' = 'orange-county'
on conflict (email, product, subject_key) do nothing;

insert into public.customer_preferences (email, token)
select email, encode(gen_random_bytes(32), 'hex')
from (
  select distinct email from public.customer_commitments
) people
on conflict (email) do nothing;

insert into public.customer_deliveries (
  commitment_id, idempotency_key, kind, status, template_key, payload
)
select
  c.id,
  'catchup:magnet:' || c.id::text,
  'catchup',
  'pending',
  c.subject_key,
  jsonb_build_object(
    'instruction', 'Send the promised checklist only after the recipient list is approved. This row does not send itself.'
  )
from public.customer_commitments c
where c.product = 'library_magnet'
  and c.status = 'overdue'
on conflict (idempotency_key) do nothing;

insert into public.customer_deliveries (
  commitment_id, idempotency_key, kind, status, payload
)
select
  c.id,
  'review:magnet:' || c.id::text,
  'catchup',
  'pending',
  jsonb_build_object(
    'instruction', 'Do not bulk-resend. Two scoresheet emails were delivered and three people requested the guide. Match Loops recipients before sending the missing one.'
  )
from public.customer_commitments c
where c.product = 'library_magnet'
  and c.status = 'needs_review'
on conflict (idempotency_key) do nothing;

insert into public.customer_deliveries (
  commitment_id, idempotency_key, kind, channel, status, payload
)
select
  c.id,
  'manual-followup:' || c.id::text,
  'manual_followup',
  'human',
  'pending',
  jsonb_build_object(
    'instruction', 'Send by hand from the StarlynnCare inbox. Do not automate.',
    'draft', 'Personal follow-up is staged in the operator queue. Send it by hand. Do not automate.'
  )
from public.customer_commitments c
where c.product = 'contract_review'
on conflict (idempotency_key) do nothing;

insert into public.customer_deliveries (
  commitment_id, idempotency_key, kind, status, payload
)
select
  c.id,
  'catchup:area:' || aw.id::text,
  'catchup',
  'pending',
  jsonb_build_object(
    'changeCount', gaps.change_count,
    'areaName', aw.area_name,
    'stateCode', aw.state_code,
    'instruction', 'Review before sending. Fold this into one note. Do not replay every scan row. Skip inspection-count bumps that added no citations, and do not send until the note is approved.'
  )
from public.area_watchers aw
join lateral (
  select count(*)::int as change_count
  from public.state_scan_runs r
  join public.state_scan_facility_deltas d on d.scan_run_id = r.id
  where r.state_code = aw.state_code
    and r.status = 'completed'
    and aw.baseline_at <= r.started_at
    and (
      aw.source = 'state_modal'
      or (d.after_payload->>'city_slug') = aw.area_slug
    )
) gaps on gaps.change_count > 0
join public.customer_commitments c
  on c.email = lower(trim(aw.email))
 and c.product = 'area_watch'
 and c.subject_key = aw.state_code || ':' || aw.area_slug
where aw.active
  and not exists (
    select 1
    from public.watch_alert_deliveries wd
    where wd.watcher_type = 'area'
      and wd.watcher_id = aw.id
      and wd.status = 'sent'
  )
on conflict (idempotency_key) do nothing;

insert into public.customer_deliveries (
  commitment_id, idempotency_key, kind, status, payload
)
select
  c.id,
  'review:area:' || c.id::text,
  'catchup',
  'pending',
  jsonb_build_object(
    'instruction', 'No area watcher was saved. Confirm the state and start the watch going forward. Do not send a backlog.'
  )
from public.customer_commitments c
where c.product = 'area_watch'
  and c.subject_key = 'UNSET:orange-county'
on conflict (idempotency_key) do nothing;

insert into public.customer_deliveries (
  commitment_id, idempotency_key, kind, status, payload
)
select
  c.id,
  'catchup:facility:' || w.id::text,
  'catchup',
  'pending',
  jsonb_build_object(
    'changeCount', gaps.change_count,
    'instruction', 'One consolidated official-record note. Do not send the controlled paid-test facility. Do not send until approved.'
  )
from public.facility_watchers w
join lateral (
  select count(*)::int as change_count
  from public.state_scan_runs r
  join public.state_scan_facility_deltas d on d.scan_run_id = r.id
  where r.status = 'completed'
    and w.baseline_at <= r.started_at
    and d.facility_id = w.facility_id
) gaps on gaps.change_count > 0
join public.customer_commitments c
  on c.email = lower(trim(w.email))
 and c.product = 'facility_watch'
 and c.subject_key = w.facility_id::text
where w.confirmed_at is not null
  and coalesce(w.alerts_eligible, true)
  and coalesce(w.source, '') <> 'paid_facility_watch'
  and not exists (
    select 1
    from public.watch_alert_deliveries wd
    where wd.watcher_type = 'facility'
      and wd.watcher_id = w.id
      and wd.status = 'sent'
  )
on conflict (idempotency_key) do nothing;
