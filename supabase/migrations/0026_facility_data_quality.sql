-- ============================================================
-- StarlynnCare Migration 0026 — Facility Data Quality Gate
--
-- Adds:
--   1. facilities.has_inspection_text (boolean) — true when at least
--      one inspection has parsed narrative text (not a PDF-URL placeholder).
--      The frontend gates grade/AI summary display on this flag.
--
--   2. facility_data_quality_issues table — admin queue populated by
--      scripts/audit/facility_data_validity.py. Tracks which facilities
--      fail the narrative-text gate and why.
--
--   3. inspection_has_real_narrative(uuid) function — SQL mirror of the
--      TypeScript inspectionHasRealNarrative helper in loadFacilityProfile.ts.
--      Same rule: narrative must be non-null, length ≥ 100, and must not
--      start with the WA placeholder pattern "—: WA DSHS report:".
--
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1. Column on facilities
alter table facilities
  add column if not exists has_inspection_text boolean not null default false;

comment on column facilities.has_inspection_text is
  'True when at least one inspection in the freshness window has real parsed '
  'narrative text (not a WA PDF-URL placeholder). Set by recompute_publishable.py.';

-- 2. Admin queue table
create table if not exists facility_data_quality_issues (
  facility_id              uuid    primary key references facilities (id) on delete cascade,
  state_code               text    not null,
  reason                   text    not null
                             check (reason in (
                               'url_as_narrative',
                               'placeholder_narrative',
                               'no_narrative_text',
                               'no_inspections'
                             )),
  inspection_count         integer not null default 0,
  inspections_with_real_text integer not null default 0,
  last_inspection_date     date,
  scanned_at               timestamptz not null default now(),
  notes                    text
);

comment on table facility_data_quality_issues is
  'Admin queue of publishable facilities whose inspection records lack parsed '
  'narrative text. Populated by scripts/audit/facility_data_validity.py.';

-- 3. SQL helper — mirrors TS inspectionHasRealNarrative exactly
create or replace function inspection_has_real_narrative(p_inspection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from inspections
    where id = p_inspection_id
      and raw_data->>'narrative' is not null
      and length(trim(raw_data->>'narrative')) >= 100
      and trim(raw_data->>'narrative') !~ '^—:\s*WA DSHS report:'
  );
$$;

comment on function inspection_has_real_narrative(uuid) is
  'Returns true when the inspection has real parsed narrative text. '
  'Mirrors inspectionHasRealNarrative() in src/lib/facility/loadFacilityProfile.ts.';
