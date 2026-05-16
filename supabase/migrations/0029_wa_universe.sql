-- Migration: 0029_wa_universe.sql
--
-- WA Data Capture Rebuild — Wave 1
-- Adds columns for multi-source WA memory-care signals, CMS nursing-home identifiers,
-- geo archival date, and new operational tables: wa_pdf_inventory + prr_requests.
--
-- All changes are additive. No existing columns are dropped or renamed.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. facilities — new columns
-- ─────────────────────────────────────────────────────────────────────────────

alter table facilities
  add column if not exists wa_memory_care_certified  boolean,
  add column if not exists wa_earc_sdc_contracted    boolean,
  add column if not exists wa_dementia_specialty     boolean,
  add column if not exists cms_ccn                   text,
  add column if not exists cms_overall_rating        smallint
                                                       check (cms_overall_rating between 1 and 5),
  add column if not exists geo_archived_at           date;

-- Unique constraint on cms_ccn so we can upsert by it
create unique index if not exists facilities_cms_ccn_idx
  on facilities (cms_ccn)
  where cms_ccn is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. wa_pdf_inventory — one row per PDF link discovered on BHForms / AFHForms
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists wa_pdf_inventory (
  id                uuid         primary key default gen_random_uuid(),
  facility_id       uuid         not null references facilities (id) on delete cascade,
  license_number    text         not null,
  source_url        text         not null,
  doc_type          text         not null default 'inspection'
                                   check (doc_type in ('inspection', 'complaint', 'other')),
  inspection_date   date,
  -- Download state
  download_status   text         not null default 'pending'
                                   check (download_status in ('pending','downloading','done','error','skip')),
  local_path        text,
  sha256            text,
  size_bytes        bigint,
  download_error    text,
  downloaded_at     timestamptz,
  -- Parse state
  parse_status      text         not null default 'pending'
                                   check (parse_status in ('pending','ocr_needed','parsing','done','error','skip')),
  parse_method      text,        -- 'pdfplumber' | 'ocrmypdf+pdfplumber' | 'docling'
  parse_error       text,
  parsed_at         timestamptz,
  -- Backfill state
  backfill_status   text         not null default 'pending'
                                   check (backfill_status in ('pending','done','error','skip')),
  backfill_error    text,
  backfilled_at     timestamptz,
  -- Metadata
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now(),

  constraint wa_pdf_inventory_url_uq unique (source_url)
);

create index if not exists wa_pdf_inventory_facility_idx
  on wa_pdf_inventory (facility_id);
create index if not exists wa_pdf_inventory_download_status_idx
  on wa_pdf_inventory (download_status)
  where download_status != 'done';
create index if not exists wa_pdf_inventory_parse_status_idx
  on wa_pdf_inventory (parse_status)
  where parse_status != 'done';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. prr_requests — manual PRR tracking queue
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists prr_requests (
  id                    uuid        primary key default gen_random_uuid(),
  state_code            text        not null default 'WA',
  scope_description     text        not null,
  -- batched_license_numbers: JSON array of license number strings
  batched_license_numbers jsonb     not null default '[]'::jsonb,
  status                text        not null default 'draft'
                                      check (status in ('draft','submitted','acknowledged','partial','fulfilled','closed')),
  submitted_at          date,
  dshs_ack_date         date,
  fulfilled_at          date,
  received_pdf_count    integer     not null default 0,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists prr_requests_status_idx
  on prr_requests (status)
  where status not in ('fulfilled', 'closed');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS — internal tables (admin-only; public cannot read/write)
-- ─────────────────────────────────────────────────────────────────────────────

alter table wa_pdf_inventory  enable row level security;
alter table prr_requests      enable row level security;

-- Service-role key bypasses RLS. Anon key gets nothing.
create policy "wa_pdf_inventory admin only" on wa_pdf_inventory
  using (false);

create policy "prr_requests admin only" on prr_requests
  using (false);
