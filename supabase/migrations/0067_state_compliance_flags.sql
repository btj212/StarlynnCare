-- 0067 — Washington compliance flags.
--
-- A Washington adult family home stays unpublished until this pipeline has
-- read the state's document list. Approvals are kept. A Tier 1 flag stays
-- off the public page until a person approves the banner.

alter table public.facilities
  add column if not exists state_records_checked_at timestamptz;

alter table public.wa_pdf_inventory
  add column if not exists posted_month text;

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.wa_pdf_inventory'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%doc_type%';
  if cname is not null then
    execute format('alter table public.wa_pdf_inventory drop constraint %I', cname);
  end if;
end $$;

alter table public.wa_pdf_inventory
  add constraint wa_pdf_inventory_doc_type_check
  check (doc_type in (
    'inspection',
    'complaint',
    'other',
    'enforcement_letter',
    'investigation',
    'fire_inspection'
  ));

create table if not exists public.facility_compliance_flags (
  facility_id     uuid        primary key references public.facilities (id) on delete cascade,
  state_code      text        not null,
  license_number  text,
  tier            smallint    not null check (tier in (0, 1, 2, 3)),
  banner_text     text,
  docs            jsonb       not null default '[]'::jsonb,
  unread_docs     jsonb       not null default '[]'::jsonb,
  checked_at      timestamptz not null default now(),
  review_status   text        check (review_status is null or review_status in ('pending', 'approved', 'held')),
  reviewed_by     text,
  reviewed_at     timestamptz
);

create table if not exists public.compliance_flag_runs (
  id           uuid        primary key default gen_random_uuid(),
  state_code   text        not null,
  started_at   timestamptz not null,
  finished_at  timestamptz,
  counts       jsonb,
  diff         jsonb
);

create index if not exists facility_compliance_flags_tier_idx
  on public.facility_compliance_flags (state_code, tier);

alter table public.facility_compliance_flags enable row level security;
alter table public.compliance_flag_runs enable row level security;

-- Released banners are public records. Pending Tier 1 and run logs stay internal.
drop policy if exists "public read released compliance flags" on public.facility_compliance_flags;
create policy "public read released compliance flags"
  on public.facility_compliance_flags
  for select
  using (
    tier in (2, 3)
    or (tier = 1 and review_status = 'approved')
  );

drop policy if exists "compliance runs admin only" on public.compliance_flag_runs;
create policy "compliance runs admin only"
  on public.compliance_flag_runs
  using (false);
