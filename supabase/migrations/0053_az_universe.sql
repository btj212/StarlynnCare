-- Migration: 0053_az_universe.sql
--
-- Arizona ADHS — memory care universe scaffold
-- Adds:
--   1. states row for AZ
--   2. AZ-specific facility columns (from probe: LICENSE_SUBTYPE, SUBTYPE, FACID)
--   3. Unique partial index on (state_code='AZ', external_id)
--   4. az_pdf_inventory table — for Phase 3 inspection PDF pipeline via
--      AZ Care Check Salesforce document download endpoint
--
-- Probe findings (2026-06-15):
--   Directory: ArcGIS FeatureServer/12, 2,047 active ALFs/ALHs
--   MC signal: LICENSE_SUBTYPE ending "-DIRECTED" (Directed Care = 1,995 facilities)
--              Supervisory/Personal Care are lower-acuity (1 each, negligible)
--   Inspections: AZ Care Check (Salesforce) — REST API auth-walled;
--                sfc/servlet.shepherd/document/download/ returns 200 (PDF route viable)
--
-- All changes are additive. No existing columns dropped or renamed.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. states row
-- ─────────────────────────────────────────────────────────────────────────────

insert into states (code, name, scraper_name, sla_days, confidence, notes)
values (
  'AZ',
  'Arizona',
  'az_adhs_directory_ingest',
  36,
  'medium',
  'ADHS Bureau of Residential Facilities Licensing. '
  'Regulated under A.R.S. § 36-401 et seq. and 9 A.A.C. § 10. '
  'Universe: Assisted Living Homes (ALH, ≤10 beds) and Assisted Living Centers (ALC, ≥11 beds). '
  'MC signal: LICENSE_SUBTYPE = *-DIRECTED (Directed Care license level, A.A.C. § 10, Art. 8). '
  'New HB2764 Memory Care subclass effective 2025-07-01 — not yet in directory dataset. '
  'Inspections: AZ Care Check portal (azcarecheck.azdhs.gov, Salesforce) — PDF route required. '
  'ArcGIS source: AZLicensedFacilities FeatureServer/12 (item a14f94e433dc40d4a7c77bd79da10b24).'
)
on conflict (code) do update
  set name         = excluded.name,
      scraper_name = excluded.scraper_name,
      sla_days     = excluded.sla_days,
      notes        = excluded.notes;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. AZ-specific facility columns
-- ─────────────────────────────────────────────────────────────────────────────

alter table facilities

  -- ADHS license level: Directed Care / Personal Care / Supervisory Care.
  -- Derived from ArcGIS SUBTYPE / LICENSE_SUBTYPE field (e.g. "ASSISTED LIVING HOME-DIRECTED").
  -- Directed Care is the highest level — residents may have cognitive impairment / dementia.
  -- This is the primary MC gate: az_license_level = 'Directed Care' → serves_memory_care = true.
  add column if not exists az_license_level  text,

  -- AZ memory care subclass introduced by HB2764, effective 2025-07-01.
  -- Will be populated from ArcGIS once ADHS updates the dataset.
  -- Currently NULL for all facilities (field not yet in source data).
  add column if not exists az_mc_subclass    boolean,

  -- Belt-and-suspenders disclosure column mirroring OR/PA pattern.
  -- Set true when az_license_level = 'Directed Care' at ingest time.
  -- Drives memory_care_disclosure_filed = true (via backfill_disclosure_from_state_flags).
  add column if not exists az_memory_care_endorsed  boolean;

comment on column facilities.az_license_level is
  'AZ: ADHS Assisted Living license level as reported in ArcGIS SUBTYPE/LICENSE_SUBTYPE. '
  'Values: ''Directed Care'' | ''Personal Care'' | ''Supervisory Care'' | NULL (non-ALF). '
  'Directed Care (highest level) means the facility may serve residents with dementia/cognitive impairment. '
  'Source: AZLicensedFacilities FeatureServer/12 — parsed from LICENSE_SUBTYPE suffix.';

comment on column facilities.az_mc_subclass is
  'AZ: Memory Care subclass introduced by HB2764 (effective 2025-07-01). '
  'NULL until ADHS populates this field in the ArcGIS dataset. '
  'When true, overrides az_license_level as the Tier-1 MC signal.';

comment on column facilities.az_memory_care_endorsed is
  'AZ: true when az_license_level = ''Directed Care'' (or az_mc_subclass = true when available). '
  'Mirrors the OR or_memory_care_endorsement / PA pa_personal_care_endorsement pattern. '
  'Drives memory_care_disclosure_filed via backfill_disclosure_from_state_flags.py.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Unique partial index — join target for upserts by ADHS FACID (external_id)
-- ─────────────────────────────────────────────────────────────────────────────

create unique index if not exists facilities_az_external_id_idx
  on facilities (state_code, external_id)
  where state_code = 'AZ' and external_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. az_pdf_inventory — Phase 3 inspection PDF pipeline
--    AZ Care Check stores inspection reports as Salesforce ContentDocuments.
--    The sfc/servlet.shepherd/document/download/{sfid} endpoint is accessible.
--    This table tracks discovered document IDs and their parse/backfill state.
--    Mirrors il_inspection_inventory structure (0039_il_universe.sql).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists az_pdf_inventory (
  id                uuid         primary key default gen_random_uuid(),
  facility_id       uuid         not null references facilities (id) on delete cascade,
  -- The inspection row this PDF belongs to (set after parse + backfill).
  inspection_id     uuid         references inspections (id) on delete set null,
  -- ADHS FACID (e.g. "AL12963") for cross-referencing without a facility_id lookup.
  facid             text         not null,
  -- Salesforce ContentDocument ID (18-char SFId) discovered from AZ Care Check pages.
  sf_document_id    text,
  -- Full download URL: https://azcarecheck.azdhs.gov/sfc/servlet.shepherd/document/download/{sf_document_id}
  source_url        text         not null,
  doc_type          text         not null default 'inspection'
                                   check (doc_type in ('inspection', 'complaint', 'plan_of_correction', 'other')),
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

  constraint az_pdf_inventory_url_uq unique (source_url)
);

create index if not exists az_pdf_inventory_facility_idx
  on az_pdf_inventory (facility_id);

create index if not exists az_pdf_inventory_inspection_idx
  on az_pdf_inventory (inspection_id)
  where inspection_id is not null;

create index if not exists az_pdf_inventory_download_status_idx
  on az_pdf_inventory (download_status)
  where download_status != 'done';

create index if not exists az_pdf_inventory_parse_status_idx
  on az_pdf_inventory (parse_status)
  where parse_status != 'done';

create index if not exists az_pdf_inventory_facid_idx
  on az_pdf_inventory (facid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — admin-only (service-role key bypasses; anon key gets nothing)
-- ─────────────────────────────────────────────────────────────────────────────

alter table az_pdf_inventory enable row level security;

create policy "az_pdf_inventory admin only" on az_pdf_inventory
  using (false);
