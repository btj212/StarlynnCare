-- ============================================================
-- 0063 — Paid Facility Watch (concierge MVP)
--
-- Separate entitlement ledger from free facility_watchers.
-- Stripe is source of truth for billing status; we sync via webhooks.
-- Firecrawl monitor ID / fulfillment columns support manual concierge
-- setup until Phase 2 automation lands.
-- ============================================================

create table if not exists public.facility_watch_subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- The API validates facilities before insert. Add the FK in a later,
  -- low-traffic migration: production's ingest holds a long lock on
  -- facilities, which makes the launch migration time out.
  facility_id uuid not null,
  email text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  billing_interval text not null
    check (billing_interval in ('month', 'year')),
  status text not null default 'pending'
    check (status in (
      'pending',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'unpaid'
    )),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  billing_token text not null default encode(gen_random_bytes(32), 'hex'),
  firecrawl_monitor_id text,
  fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending', 'active', 'paused')),
  fulfilled_at timestamptz,
  checkout_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facility_watch_subscriptions_email_facility_unique
    unique (email, facility_id)
);

create unique index if not exists facility_watch_subscriptions_billing_token_uidx
  on public.facility_watch_subscriptions (billing_token);

create unique index if not exists facility_watch_subscriptions_stripe_sub_uidx
  on public.facility_watch_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists facility_watch_subscriptions_facility_idx
  on public.facility_watch_subscriptions (facility_id);

create index if not exists facility_watch_subscriptions_status_idx
  on public.facility_watch_subscriptions (status);

create index if not exists facility_watch_subscriptions_fulfillment_idx
  on public.facility_watch_subscriptions (fulfillment_status)
  where status = 'active';

alter table public.facility_watch_subscriptions enable row level security;

-- Stripe webhook idempotency ledger (service role only)
create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  processed_at timestamptz not null default now(),
  payload jsonb
);

alter table public.billing_webhook_events enable row level security;
