-- Verified Partner: flat monthly or annual fees for a labeled block on a
-- community's own page. Payment never changes a grade, rank, or citation.
-- No per-request price is stored or sold here.
--
-- partner_gate is service-role only. It reuses facility_snapshot() for the
-- public grade and the same effective-severity rule that snapshot uses:
-- coalesce(severity, immediate jeopardy = 4, Type A = 3, Type B = 2, else 1).
--
-- Thresholds, kept in lockstep with scrapers/partner_gate_rules.py:
--   enter at composite percentile >= 50 (grade C or better)
--   stay at >= 40 (grade C−) only while status is active, paused, or past_due
--   a public grade needs peer_set.n >= 10
--   zero severity-4 citations in 24 months
--   at most one severity-3 citation in 12 months
--   license_status must be exactly LICENSED
--   a past license_expiration fails; a missing expiration does not, because
--     most state files do not store one
--   a Washington tier-1 compliance flag fails (open enforcement)
--   any other license label fails closed
--   at least one inspection dated in the last 36 months
--
-- facilities FK is intentionally omitted. Migration 0063 skipped it because
-- ingest holds a long lock on facilities and a new foreign key timed out.

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null unique,
  contact_email text not null,
  plan text not null check (plan in ('founding', 'standard')),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  status text not null default 'pending' check (status in (
    'pending', 'active', 'paused', 'past_due', 'canceled'
  )),
  is_founding boolean not null default false,
  pause_reason text check (pause_reason is null or pause_reason in (
    'gate', 'manual'
  )),
  collection_paused boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  checkout_session_id text,
  checkout_reserved_until timestamptz,
  billing_token text not null default encode(gen_random_bytes(32), 'hex'),
  admitted_at timestamptz,
  gate_last_checked_at timestamptz,
  gate_last_pass boolean,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partners_billing_token_uidx
  on public.partners (billing_token);

create unique index if not exists partners_stripe_subscription_uidx
  on public.partners (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists partners_status_idx
  on public.partners (status);

create table if not exists public.partner_profiles (
  facility_id uuid primary key references public.partners (facility_id) on delete cascade,
  photo_urls text[] not null default '{}'::text[],
  price_min integer,
  price_max integer,
  openings_text text,
  staffing_day text,
  staffing_night text,
  description text,
  tour_contact_email text,
  content_updated_at timestamptz,
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint partner_profiles_photo_count check (cardinality(photo_urls) <= 12),
  constraint partner_profiles_price_pair check (
    (price_min is null and price_max is null)
    or (price_min is not null and price_max is not null and price_min >= 0 and price_max >= price_min)
  )
);

create table if not exists public.tour_requests (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.partners (facility_id) on delete cascade,
  family_name text not null,
  family_email text not null,
  family_phone text,
  relationship text not null,
  move_in_timing text not null,
  consent_text text not null,
  consent_version text not null,
  delivered_at timestamptz,
  delivery_error text,
  created_at timestamptz not null default now()
);

create index if not exists tour_requests_facility_idx
  on public.tour_requests (facility_id, created_at desc);

alter table public.partners enable row level security;
alter table public.partner_profiles enable row level security;
alter table public.tour_requests enable row level security;

revoke all on public.partners from public, anon, authenticated;
revoke all on public.partner_profiles from public, anon, authenticated;
revoke all on public.tour_requests from public, anon, authenticated;
grant select, insert, update, delete on public.partners to service_role;
grant select, insert, update, delete on public.partner_profiles to service_role;
grant select, insert, update, delete on public.tour_requests to service_role;

-- Widen the submission ledger so a tour request can be audited beside other captures.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.submission_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%event_type%';
  if cname is not null then
    execute format('alter table public.submission_events drop constraint %I', cname);
  end if;
end $$;

alter table public.submission_events
  add constraint submission_events_event_type_check
  check (event_type in (
    'facility_watch',
    'area_watch',
    'digest_subscriber',
    'listing_report',
    'review',
    'waitlist',
    'shortlist_watch',
    'contract_review',
    'partner_tour'
  ));

create or replace function public.partner_gate(p_facility_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_fac facilities%rowtype;
  v_snapshot jsonb;
  v_letter text;
  v_composite int;
  v_peers int;
  v_fallback int;
  v_retained boolean := false;
  v_required int;
  v_sev4 int := 0;
  v_sev3 int := 0;
  v_recent boolean := false;
  v_license_ok boolean := false;
  v_license_detail text;
  v_tier1 boolean := false;
  v_grade_ok boolean := false;
  v_sev4_ok boolean;
  v_sev3_ok boolean;
  v_rules jsonb;
begin
  select * into v_fac from facilities where id = p_facility_id;
  if not found then
    return jsonb_build_object(
      'pass', false,
      'retained', false,
      'facility_id', p_facility_id,
      'rules', jsonb_build_array(
        jsonb_build_object('code', 'grade', 'pass', false, 'detail', 'This community is not on file.'),
        jsonb_build_object('code', 'severity_4', 'pass', false, 'detail', 'This community is not on file.'),
        jsonb_build_object('code', 'severity_3', 'pass', false, 'detail', 'This community is not on file.'),
        jsonb_build_object('code', 'license', 'pass', false, 'detail', 'This community is not on file.'),
        jsonb_build_object('code', 'current_record', 'pass', false, 'detail', 'This community is not on file.')
      )
    );
  end if;

  select exists (
    select 1 from partners
    where facility_id = p_facility_id
      and status in ('active', 'paused', 'past_due')
  ) into v_retained;

  v_snapshot := facility_snapshot(p_facility_id);
  v_letter := v_snapshot #>> '{grade,letter}';
  v_composite := nullif(v_snapshot #>> '{grade,composite_percentile}', '')::int;
  v_peers := coalesce(nullif(v_snapshot #>> '{peer_set,n}', '')::int, 0);
  v_fallback := coalesce(nullif(v_snapshot #>> '{peer_set,fallback_level}', '')::int, 0);
  v_required := case when v_retained then 40 else 50 end;
  v_grade_ok := v_letter is not null and v_composite is not null and v_peers >= 10 and v_composite >= v_required;

  select
    count(*) filter (
      where i.inspection_date >= (current_date - interval '24 months')::date
        and coalesce(
          d.severity,
          case
            when d.immediate_jeopardy then 4
            when d.class = 'Type A' then 3
            when d.class = 'Type B' then 2
            else 1
          end
        ) = 4
    ),
    count(*) filter (
      where i.inspection_date >= (current_date - interval '12 months')::date
        and coalesce(
          d.severity,
          case
            when d.immediate_jeopardy then 4
            when d.class = 'Type A' then 3
            when d.class = 'Type B' then 2
            else 1
          end
        ) = 3
    )
  into v_sev4, v_sev3
  from deficiencies d
  join inspections i on i.id = d.inspection_id
  where i.facility_id = p_facility_id
    and i.inspection_date is not null;

  v_sev4_ok := v_sev4 = 0;
  v_sev3_ok := v_sev3 <= 1;

  select exists (
    select 1
    from facility_compliance_flags f
    where f.facility_id = p_facility_id
      and f.tier = 1
  ) into v_tier1;

  if v_fac.license_status is distinct from 'LICENSED' then
    v_license_ok := false;
    v_license_detail := coalesce(
      'License status on file is ' || v_fac.license_status || ', not an active license.',
      'No active license is on file.'
    );
  elsif v_fac.license_expiration is not null and v_fac.license_expiration < current_date then
    v_license_ok := false;
    v_license_detail := 'The license expiration on file is in the past.';
  elsif v_tier1 then
    v_license_ok := false;
    v_license_detail := 'An open enforcement action is on file.';
  else
    v_license_ok := true;
    v_license_detail := 'License status is LICENSED, with no open enforcement flag on file.';
  end if;

  select exists (
    select 1 from inspections i
    where i.facility_id = p_facility_id
      and i.inspection_date >= (current_date - interval '36 months')::date
  ) into v_recent;

  v_rules := jsonb_build_array(
    jsonb_build_object(
      'code', 'grade',
      'pass', v_grade_ok,
      'detail', case
        when v_letter is null or v_composite is null then 'No public grade is on this page.'
        when v_peers < 10 then 'Fewer than 10 peers, so the grade is not a public rank.'
        when v_grade_ok and v_retained then 'Grade ' || v_letter || ' stays above the C− line for a current partner.'
        when v_grade_ok then 'Grade ' || v_letter || ' is in the top half of its peers.'
        when v_retained then 'Grade ' || v_letter || ' is below C−.'
        else 'Grade ' || v_letter || ' is not in the top half of its peers.'
      end,
      'evidence', jsonb_build_object(
        'letter', v_letter,
        'composite_percentile', v_composite,
        'peer_n', v_peers,
        'fallback_level', v_fallback,
        'required_percentile', v_required
      )
    ),
    jsonb_build_object(
      'code', 'severity_4',
      'pass', v_sev4_ok,
      'detail', case
        when v_sev4_ok then 'No severity-4 citation in the last 24 months.'
        else v_sev4::text || ' severity-4 citation' || case when v_sev4 = 1 then '' else 's' end || ' in the last 24 months.'
      end,
      'evidence', jsonb_build_object('count', v_sev4, 'months', 24)
    ),
    jsonb_build_object(
      'code', 'severity_3',
      'pass', v_sev3_ok,
      'detail', case
        when v_sev3_ok then 'No more than one severity-3 citation in the last 12 months.'
        else v_sev3::text || ' severity-3 citations in the last 12 months.'
      end,
      'evidence', jsonb_build_object('count', v_sev3, 'months', 12)
    ),
    jsonb_build_object(
      'code', 'license',
      'pass', v_license_ok,
      'detail', v_license_detail,
      'evidence', jsonb_build_object(
        'license_status', v_fac.license_status,
        'license_expiration', v_fac.license_expiration,
        'tier1', v_tier1
      )
    ),
    jsonb_build_object(
      'code', 'current_record',
      'pass', v_recent and v_letter is not null and v_peers >= 10,
      'detail', case
        when not v_recent then 'No inspection in the last 36 months.'
        when v_letter is null or v_peers < 10 then 'The record does not have a public grade.'
        else 'An inspection in the last 36 months, and a public grade, are on file.'
      end,
      'evidence', jsonb_build_object(
        'inspection_within_36_months', v_recent,
        'has_public_grade', v_letter is not null and v_peers >= 10
      )
    )
  );

  return jsonb_build_object(
    'pass', v_grade_ok and v_sev4_ok and v_sev3_ok and v_license_ok and v_recent and v_letter is not null and v_peers >= 10,
    'retained', v_retained,
    'facility_id', p_facility_id,
    'state_code', v_fac.state_code,
    'publishable', v_fac.publishable,
    'rules', v_rules
  );
end;
$$;

revoke all on function public.partner_gate(uuid) from public, anon, authenticated;
grant execute on function public.partner_gate(uuid) to service_role;

comment on function public.partner_gate(uuid) is
  'Service-only Verified Partner eligibility. Does not change grades. Fails closed unless license_status is LICENSED and no tier-1 enforcement flag is on file.';

create or replace function public.reserve_partner_checkout(
  p_facility_id uuid,
  p_email text,
  p_plan text,
  p_interval text
) returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_gate jsonb;
  v_email text := lower(trim(p_email));
  v_count int;
  v_existing partners%rowtype;
  v_has_existing boolean := false;
  v_id uuid;
  v_token text;
begin
  if p_plan not in ('founding', 'standard') or p_interval not in ('month', 'year') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_plan');
  end if;
  if v_email is null or position('@' in v_email) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_email');
  end if;

  perform pg_advisory_xact_lock(hashtext('verified_partner_founding'));

  update partners
  set status = 'canceled',
      canceled_at = now(),
      checkout_reserved_until = null,
      updated_at = now()
  where status = 'pending'
    and stripe_subscription_id is null
    and checkout_session_id is null
    and checkout_reserved_until is not null
    and checkout_reserved_until < now();

  v_gate := partner_gate(p_facility_id);
  if coalesce((v_gate->>'pass')::boolean, false) is not true
     or coalesce((v_gate->>'publishable')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'reason', 'gate', 'gate', v_gate);
  end if;

  select * into v_existing from partners where facility_id = p_facility_id;
  v_has_existing := found;
  if v_has_existing and v_existing.status in ('active', 'paused', 'past_due') then
    return jsonb_build_object(
      'ok', false,
      'reason', 'already_active',
      'billing_token', v_existing.billing_token,
      'gate', v_gate
    );
  end if;

  select count(*) into v_count
  from partners
  where is_founding
    and facility_id is distinct from p_facility_id
    and (
      status in ('active', 'paused', 'past_due')
      or (
        status = 'pending'
        and checkout_reserved_until > now()
      )
    );

  if p_plan = 'founding' and v_count >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'founding_full', 'founding_taken', v_count, 'gate', v_gate);
  end if;

  if v_has_existing then
    update partners
    set contact_email = v_email,
        plan = p_plan,
        billing_interval = p_interval,
        status = 'pending',
        is_founding = p_plan = 'founding',
        pause_reason = null,
        collection_paused = false,
        checkout_reserved_until = now() + interval '30 minutes',
        canceled_at = null,
        updated_at = now()
    where id = v_existing.id
    returning id, billing_token into v_id, v_token;
  else
    insert into partners (
      facility_id, contact_email, plan, billing_interval, status, is_founding,
      checkout_reserved_until, updated_at
    ) values (
      p_facility_id, v_email, p_plan, p_interval, 'pending', p_plan = 'founding',
      now() + interval '30 minutes', now()
    )
    returning id, billing_token into v_id, v_token;
  end if;

  return jsonb_build_object(
    'ok', true,
    'partner_id', v_id,
    'billing_token', v_token,
    'plan', p_plan,
    'founding_taken', v_count + case when p_plan = 'founding' then 1 else 0 end,
    'gate', v_gate
  );
end;
$$;

revoke all on function public.reserve_partner_checkout(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_partner_checkout(uuid, text, text, text) to service_role;

comment on function public.reserve_partner_checkout(uuid, text, text, text) is
  'Atomically reserves one founding or standard partner checkout. Refuses a failed gate and the 21st founding slot.';
