-- Migration: 0033_or_universe.sql
--
-- Oregon Data Rebuild — Full Universe
-- Adds OR-specific signal columns to facilities and creates the or_pdf_inventory
-- table (mirrors wa_pdf_inventory shape for the PDF pipeline).
--
-- All changes are additive. No existing columns are dropped or renamed.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. facilities — OR-specific columns
-- ─────────────────────────────────────────────────────────────────────────────

alter table facilities
  -- The Provider ID from the OR portal list exports (verbatim, not zero-padded).
  -- Used as the durable join key across Providers / Inspections / Violations /
  -- RegulatoryActions CSVs.  Format varies: numeric ("525953"), zero-padded
  -- ("0000000183"), or alphanumeric ("50M300", "5MA238").
  add column if not exists external_id              text,

  -- Facility ID used in detail page URLs (/Facilities/Details/{id}).
  -- Sometimes equals external_id (alphanumeric formats) but not reliably.
  -- Populated by or_afh_detail.py when detail pages are fetched.
  add column if not exists detail_url_id            text,

  -- Adult Foster Home class (1/2/3) — only surfaces on the detail page,
  -- not in list-export CSVs.  Null for non-AFH facilities.
  add column if not exists afh_class                smallint
                                                       check (afh_class between 1 and 3),

  -- ORS 443.886 Memory Care Endorsement.  True = facility legally endorsed to
  -- advertise and operate as a memory care community.
  add column if not exists mce_endorsed             boolean,

  -- Provenance for mce_endorsed: "CSS portal", "PRA list", "name match".
  -- Records the strongest source so it can be upgraded when PRA data arrives.
  add column if not exists mce_evidence             text,

  -- APD Enhanced Oversight & Supervision program flag.
  -- Populated by or_signal_enhanced_oversight.py.
  add column if not exists enhanced_oversight       boolean not null default false,

  -- ORS 443.886(6) marketing-without-endorsement flag.
  -- True when facility name contains "Memory Care" / "Alzheimer" but mce_endorsed=false.
  add column if not exists unendorsed_mc_violation  boolean not null default false;

comment on column facilities.external_id is
  'OR portal Provider ID (verbatim, not zero-padded). Join key across all OR CSV exports.';
comment on column facilities.mce_endorsed is
  'ORS 443.886 Memory Care Endorsement. Level 1-4 severity scale per OAR 411-054-0120.';
comment on column facilities.unendorsed_mc_violation is
  'ORS 443.886(6) violation: facility name implies memory care but mce_endorsed=false.';

-- Unique index on (state_code='OR', external_id) — primary join target for
-- OR ingest scripts.  Does not conflict with the (state_code, city_slug, slug)
-- unique constraint used by all states.
create unique index if not exists facilities_or_external_id_idx
  on facilities (state_code, external_id)
  where state_code = 'OR' and external_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. or_pdf_inventory — one row per PDF inspection report to download/parse
--    Mirrors wa_pdf_inventory; kept separate so per-state pipelines are
--    independent and can be run/cleared without affecting each other.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists or_pdf_inventory (
  id                uuid         primary key default gen_random_uuid(),
  facility_id       uuid         not null references facilities (id) on delete cascade,
  inspection_id     uuid         references inspections (id) on delete set null,
  -- The PDF URL from the OR portal inspection detail page
  pdf_url           text         not null,
  event_id          text,        -- portal Event ID e.g. "230AD2", used to deduplicate
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
  -- Backfill state (replace placeholder deficiencies with parsed ones)
  backfill_status   text         not null default 'pending'
                                   check (backfill_status in ('pending','done','error','skip')),
  backfill_error    text,
  backfilled_at     timestamptz,
  -- Metadata
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now(),

  constraint or_pdf_inventory_url_uq unique (pdf_url)
);

create index if not exists or_pdf_inventory_facility_idx
  on or_pdf_inventory (facility_id);
create index if not exists or_pdf_inventory_download_status_idx
  on or_pdf_inventory (download_status)
  where download_status != 'done';
create index if not exists or_pdf_inventory_parse_status_idx
  on or_pdf_inventory (parse_status)
  where parse_status != 'done';
create index if not exists or_pdf_inventory_backfill_status_idx
  on or_pdf_inventory (backfill_status)
  where backfill_status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS
-- ─────────────────────────────────────────────────────────────────────────────

alter table or_pdf_inventory enable row level security;
create policy "or_pdf_inventory admin only" on or_pdf_inventory using (false);
