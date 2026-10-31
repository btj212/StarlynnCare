-- Migration: 0069_co_universe.sql
--
-- Colorado CDPHE assisted-living universe and CMS nursing-home separation.
--
-- The public facility pages read `facilities`, `inspections`, and
-- `deficiencies`. This migration only adds Colorado source fields and a
-- service-only copy of every source row. It does not publish a facility.
--
-- Measured inputs (2026-10-31):
--   CDPHE ArcGIS assisted-living universe: 685 rows (SA1 358, SA2 285, SA5 42)
--   HFQ complaints workbook, provided 2026-05-18: 3,547 event rows
--   HFQ surveys and citations workbook, provided 2026-05-18: 12,802 rows
--   CMS nursing-home counts are loaded in the second phase and kept separate.
--
-- All changes are additive. No existing column is dropped or renamed.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. states row
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.states (code, name, scraper_name, sla_days, confidence, notes)
values (
  'CO',
  'Colorado',
  'co_cdphe_directory_ingest',
  36,
  'medium',
  'CDPHE Health Facilities and Emergency Medical Services Division. '
  'Assisted living residences are regulated under 6 CCR 1011-1 Chapter 7. '
  'Directory: CDPHE ArcGIS Health Facilities (SA1, SA2, SA5). '
  'Inspection records: one-time HFQ workbook dated 2026-05-18, not a live feed. '
  'CDPHE does not publish a facility-level Secure Environment roster. '
  'CMS nursing homes are a separate care setting and are not ranked against assisted living residences. '
  'Family State Watch and paid Facility Watch stay off until a recurring inspection refresh exists.'
)
on conflict (code) do update
  set name = excluded.name,
      scraper_name = excluded.scraper_name,
      sla_days = excluded.sla_days,
      confidence = excluded.confidence,
      notes = excluded.notes;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Colorado facility columns
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.facilities
  add column if not exists co_facility_type_code text,
  add column if not exists co_facility_type_detail text,
  add column if not exists co_facility_type_abbreviation text,
  add column if not exists co_operating_status text,
  add column if not exists co_hfems_status text,
  add column if not exists co_care_setting text,
  add column if not exists co_directory_updated_on date,
  add column if not exists co_records_as_of date;

comment on column public.facilities.co_facility_type_code is
  'Colorado source type code. CDPHE ArcGIS values for assisted living are SA1, SA2, and SA5. CMS rows leave this blank.';

comment on column public.facilities.co_facility_type_detail is
  'Colorado ArcGIS Facility_Type_Detail, such as ALR ONLY. Not a memory-care designation.';

comment on column public.facilities.co_facility_type_abbreviation is
  'Colorado ArcGIS Facility_Type_Abbreviation, such as ALRONLY, ACF, or BISL.';

comment on column public.facilities.co_operating_status is
  'Colorado ArcGIS Operating_Status as published, such as Active or Pending.';

comment on column public.facilities.co_hfems_status is
  'Colorado ArcGIS CDPHE_HFEMS_Licensed value, such as Licensed or HCPF Certified. HCPF Certified is not stored as a CDPHE license.';

comment on column public.facilities.co_care_setting is
  'ALR for a CDPHE assisted living residence. NH for a CMS nursing home. The two are never ranked together.';

comment on column public.facilities.co_directory_updated_on is
  'Date on the CDPHE ArcGIS feature, from Date_Data_Updated. Not the inspection-record date.';

comment on column public.facilities.co_records_as_of is
  'Date the HFQ complaint and citation workbook was provided. Null when this home had no normalized record in that snapshot.';

do $$
begin
  alter table public.facilities
    add constraint facilities_co_care_setting_check
    check (co_care_setting is null or co_care_setting in ('ALR', 'NH'));
exception
  when duplicate_object then null;
end $$;

create unique index if not exists facilities_co_external_id_idx
  on public.facilities (state_code, external_id)
  where state_code = 'CO' and external_id is not null;

create index if not exists inspections_co_event_key_idx
  on public.inspections ((raw_data->>'co_event_key'))
  where source_agency = 'CO-CDPHE';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Service-only source rows
--
-- Every ArcGIS, workbook, and CMS source row ends here as normalized or
-- quarantined. The raw payload is not public. The anon and authenticated
-- roles have no privileges, and the row-level policy below denies API reads
-- even if a grant is added later. The ingest connection bypasses row-level
-- security.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.co_source_rows (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_key text not null,
  disposition text not null,
  reason text,
  facility_external_id text,
  raw jsonb not null,
  ingested_at timestamptz not null default now(),
  constraint co_source_rows_source_key unique (source, source_key),
  constraint co_source_rows_source_check check (
    source in (
      'cdphe_arcgis',
      'hfq_complaints',
      'hfq_surveys',
      'cms_directory',
      'cms_deficiencies'
    )
  ),
  constraint co_source_rows_disposition_check check (
    disposition in ('normalized', 'quarantined')
  )
);

comment on table public.co_source_rows is
  'Service-only Colorado source ledger. Holds the raw ArcGIS, HFQ, and CMS row behind every normalized or quarantined outcome. Not for the public API.';

create index if not exists co_source_rows_disposition_idx
  on public.co_source_rows (source, disposition, reason);

alter table public.co_source_rows enable row level security;

revoke all on table public.co_source_rows from public, anon, authenticated;

drop policy if exists co_source_rows_deny_api on public.co_source_rows;
create policy co_source_rows_deny_api
  on public.co_source_rows
  for all
  to anon, authenticated
  using (false)
  with check (false);
