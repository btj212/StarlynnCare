-- Migration: 0044_pa_universe.sql
--
-- Pennsylvania Memory Care Universe
-- Adds PA-specific columns to the facilities table for the DHS Human Services
-- Provider Directory ingest (Personal Care Homes + Assisted Living Residences
-- with Special Care designation), plus creates pa_pdf_inventory to mirror the
-- WA/OR PDF pipeline.
--
-- Reuses existing columns where possible:
--   external_id, license_expiration, license_status, license_number — 0001/0002
--   secure_beds, secure_bed_ratio, administrator_name, initial_license_date,
--   state_internal_id — added by 0034_ut_universe (same semantics for PA)
--   memory_care_disclosure_filed, memory_care_disclosure_source — 0008
--
-- All changes are additive; no existing columns are dropped or renamed.
-- See scrapers/pa-memory-care-data-methodology.md Section 12 for the
-- HSD XLSX field → column mapping.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. facilities — PA-specific columns
-- ─────────────────────────────────────────────────────────────────────────────

alter table facilities
  -- PA HSD `Special Care/Secure Dementia Care Unit` column. Three-value string
  -- (never boolean): null / 'Secure Dementia Care Unit' / 'Special Care'.
  -- 'Secure Dementia Care Unit' = PCH-side designation (55 Pa Code Ch 2600).
  -- 'Special Care'              = ALR-side designation (55 Pa Code § 2800.4).
  -- Use WHERE mc_designation_type IS NOT NULL — never `= true`.
  add column if not exists mc_designation_type      text
                                                      check (
                                                        mc_designation_type is null
                                                        or mc_designation_type in (
                                                          'Secure Dementia Care Unit',
                                                          'Special Care'
                                                        )
                                                      ),

  -- PA HSD `Legal Entity Name`. Used for operator/owner grouping at the
  -- presentation layer. Often differs from the facility's `name` (DBA).
  add column if not exists legal_entity_name        text,

  -- PA HSD `Region` (e.g. SOUTHEAST, WESTERN, NORTHEAST, CENTRAL).
  -- Useful for analytics; not currently surfaced in UI.
  add column if not exists dhs_region               text,

  -- PA HSD `Inspection Summary Link` — pre-baked Azure portal URL per facility.
  -- Critical: URL id strips the last (check) digit from License Number
  -- (e.g. 223010 → id=22301). See scrapers/pa_hsd_directory_ingest.py
  -- `inspection_url()` helper.
  add column if not exists inspection_index_url     text,

  -- PA HSD `Certificate Link` — pre-baked URL to the facility's certificate of
  -- compliance PDF.
  add column if not exists certificate_url          text,

  -- PA HSD `Quality Service Review Link` — pre-baked URL. Often null for
  -- non-OLTL providers.
  add column if not exists qsr_url                  text,

  -- Editorial flag for PA `PDR-APPEAL PEND` license status. The facility is
  -- contesting a refusal; still operating but under regulatory dispute.
  -- Excluded from v1 publishable; surface prominently on profile pages later.
  add column if not exists license_under_appeal     boolean not null default false;

comment on column facilities.mc_designation_type is
  'PA: Special Care/Secure Dementia Care Unit string. Three values: '
  'null, ''Secure Dementia Care Unit'' (PCH-side, Ch 2600), or ''Special Care'' '
  '(ALR-side, § 2800.4). Use IS NOT NULL — never `= true`.';
comment on column facilities.legal_entity_name is
  'Legal/operator name (PA HSD). Differs from `name` (DBA) when a multi-site '
  'operator runs multiple licensed locations.';
comment on column facilities.dhs_region is
  'PA: DHS administrative region (SOUTHEAST / WESTERN / NORTHEAST / CENTRAL / etc.). '
  'Sourced from HSD bulk export Region column.';
comment on column facilities.inspection_index_url is
  'PA: pre-baked DHS Azure inspection portal URL per facility. URL id is '
  'License Number with last (check) digit stripped (e.g. 223010 → id=22301).';
comment on column facilities.certificate_url is
  'PA: pre-baked DHS certificate-of-compliance PDF URL per facility.';
comment on column facilities.qsr_url is
  'PA: pre-baked Quality Service Review URL. Null for non-OLTL providers.';
comment on column facilities.license_under_appeal is
  'PA: true when license_status = ''PDR-APPEAL PEND'' (Provisional Decision '
  'Review — Appeal Pending). Facility is contesting a refusal but still '
  'operating. Excluded from v1 publishable; surface on profile pages.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Unique index on (state_code='PA', external_id) — upsert join target
-- ─────────────────────────────────────────────────────────────────────────────
-- Mirrors facilities_or_external_id_idx (0033) and facilities_ut_external_id_idx
-- (0034). external_id stores the PA 6-digit License Number verbatim.

create unique index if not exists facilities_pa_external_id_idx
  on facilities (state_code, external_id)
  where state_code = 'PA' and external_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. pa_pdf_inventory — one row per inspection PDF to download/parse
--    Clone of or_pdf_inventory (0033) and wa_pdf_inventory shape; kept
--    separate so per-state pipelines are independent.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pa_pdf_inventory (
  id                uuid         primary key default gen_random_uuid(),
  facility_id       uuid         not null references facilities (id) on delete cascade,
  inspection_id     uuid         references inspections (id) on delete set null,
  -- The PDF URL from the DHS Azure inspection summary page
  pdf_url           text         not null,
  -- DHS inspection date as it appears on the portal listing; used to match
  -- back to the inspections row at download/parse time.
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
  -- Backfill state (replace placeholder deficiencies with parsed ones)
  backfill_status   text         not null default 'pending'
                                   check (backfill_status in ('pending','done','error','skip')),
  backfill_error    text,
  backfilled_at     timestamptz,
  -- Metadata
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now(),

  constraint pa_pdf_inventory_url_uq unique (pdf_url)
);

create index if not exists pa_pdf_inventory_facility_idx
  on pa_pdf_inventory (facility_id);
create index if not exists pa_pdf_inventory_download_status_idx
  on pa_pdf_inventory (download_status)
  where download_status != 'done';
create index if not exists pa_pdf_inventory_parse_status_idx
  on pa_pdf_inventory (parse_status)
  where parse_status != 'done';
create index if not exists pa_pdf_inventory_backfill_status_idx
  on pa_pdf_inventory (backfill_status)
  where backfill_status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS — admin-only, mirrors or_pdf_inventory policy
-- ─────────────────────────────────────────────────────────────────────────────

alter table pa_pdf_inventory enable row level security;
create policy "pa_pdf_inventory admin only" on pa_pdf_inventory using (false);
