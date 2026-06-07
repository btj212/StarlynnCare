-- Migration: 0039_il_universe.sql
--
-- Illinois IDPH Division of Assisted Living — universe scaffold
-- Adds:
--   1. states row for IL
--   2. IL-specific facility columns
--   3. Unique partial index on (state_code='IL', license_number)
--   4. il_inspection_inventory table (mirrors wa_pdf_inventory structure)
--
-- All changes are additive. No existing columns dropped or renamed.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. states row
-- ─────────────────────────────────────────────────────────────────────────────

insert into states (code, name, scraper_name, sla_days, confidence, notes)
values (
  'IL',
  'Illinois',
  'il_llcs_directory_scrape',
  14,
  'low',
  'IDPH Division of Assisted Living. Regulated under 77 Ill. Adm. Code pt. 295. '
  'Universe: ALE (Assisted Living Establishment) and SHE (Shared Housing Establishment). '
  'No federal F-tags; violations classified as Type 1/2/3. '
  'FOIA workbook received 2026-05-19 covers Jan 2024 – May 2026.'
)
on conflict (code) do update
  set name         = excluded.name,
      scraper_name = excluded.scraper_name,
      notes        = excluded.notes;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. IL-specific facility columns
-- ─────────────────────────────────────────────────────────────────────────────

alter table facilities
  -- Portal-scraped dementia/special-care program indicator.
  -- Set by il_llcs_directory_scrape.py when the LLCS detail page lists a
  -- dementia care or special-care unit program.
  add column if not exists il_dementia_program_flag  boolean,

  -- Name-match gate: facility name contains memory care / dementia / alzheimer /
  -- reminiscence / cognitive. Set by il_llcs_directory_scrape.py (Tier 1 signal).
  add column if not exists il_mc_name_match          boolean,

  -- License subtype: 'ALE' (Assisted Living Establishment) or
  -- 'SHE' (Shared Housing Establishment). Both regulated under 295; SHEs are
  -- smaller / lower-acuity but can serve dementia residents.
  add column if not exists il_license_subtype        text;

comment on column facilities.il_dementia_program_flag is
  'IL: portal-scraped indicator that this ALE/SHE lists a dementia care or '
  'special-care unit program. Source: llcs.dph.illinois.gov facility detail page.';

comment on column facilities.il_mc_name_match is
  'IL: true when the facility name contains memory care / dementia / alzheimer / '
  'reminiscence / cognitive (case-insensitive). Set by il_llcs_directory_scrape.py.';

comment on column facilities.il_license_subtype is
  'IL: license subtype as issued by IDPH. ALE = Assisted Living Establishment, '
  'SHE = Shared Housing Establishment. Both fall under 77 Ill. Adm. Code pt. 295.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Unique partial index — join target for upserts by license number
-- ─────────────────────────────────────────────────────────────────────────────

create unique index if not exists facilities_il_license_idx
  on facilities (state_code, license_number)
  where state_code = 'IL' and license_number is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. il_inspection_inventory — one row per PDF/document discovered on LLCS
--    Mirrors wa_pdf_inventory (0029_wa_universe.sql) exactly.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists il_inspection_inventory (
  id                uuid         primary key default gen_random_uuid(),
  facility_id       uuid         not null references facilities (id) on delete cascade,
  -- The inspection row this document belongs to (nullable: set after FOIA ingest).
  inspection_id     uuid         references inspections (id) on delete set null,
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
  parse_method      text,        -- 'pdfplumber' | 'ocrmypdf+pdfplumber'
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

  constraint il_inspection_inventory_url_uq unique (source_url)
);

create index if not exists il_inspection_inventory_facility_idx
  on il_inspection_inventory (facility_id);

create index if not exists il_inspection_inventory_inspection_idx
  on il_inspection_inventory (inspection_id)
  where inspection_id is not null;

create index if not exists il_inspection_inventory_download_status_idx
  on il_inspection_inventory (download_status)
  where download_status != 'done';

create index if not exists il_inspection_inventory_parse_status_idx
  on il_inspection_inventory (parse_status)
  where parse_status != 'done';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — admin-only (service-role key bypasses; anon key gets nothing)
-- ─────────────────────────────────────────────────────────────────────────────

alter table il_inspection_inventory enable row level security;

create policy "il_inspection_inventory admin only" on il_inspection_inventory
  using (false);
