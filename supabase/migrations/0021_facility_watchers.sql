create table if not exists facility_watchers (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmation_token text not null default encode(gen_random_bytes(32), 'hex'),
  unsubscribe_token text not null default encode(gen_random_bytes(32), 'hex'),
  source text, -- e.g. 'facility_hero', 'sidebar'
  constraint facility_watchers_email_facility_unique unique (email, facility_id)
);

-- Index for token lookups
create index if not exists facility_watchers_confirmation_token_idx on facility_watchers(confirmation_token);
create index if not exists facility_watchers_unsubscribe_token_idx on facility_watchers(unsubscribe_token);

-- RLS: service role only (no public reads/writes)
alter table facility_watchers enable row level security;
