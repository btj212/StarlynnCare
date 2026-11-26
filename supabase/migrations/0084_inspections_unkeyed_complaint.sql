-- Migration: 0084_inspections_unkeyed_complaint.sql
--
-- Two California CDSS complaints on the same day share facility, date, type,
-- and agency. The unkeyed unique index kept only one of them, so the second
-- PDF never stored. Widen that index with complaint_id. New CA inserts also
-- set source_event_id to the Lotus document id when the scraper has one.
--
-- Do not apply this from an agent session. Ship the file in the PR; Blake
-- applies it.

-- Backfill CA Lotus ids onto source_event_id when the key is unique.
with candidates as (
  select
    i.id,
    i.source_agency,
    btrim(
      coalesce(
        i.raw_data->'report_index_metadata'->>'report_key',
        i.raw_data->>'report_key'
      )
    ) as report_key
  from public.inspections i
  join public.facilities f on f.id = i.facility_id
  where f.state_code = 'CA'
    and i.source_event_id is null
    and nullif(
      btrim(
        coalesce(
          i.raw_data->'report_index_metadata'->>'report_key',
          i.raw_data->>'report_key'
        )
      ),
      ''
    ) is not null
),
unique_keys as (
  select report_key
  from candidates
  group by report_key
  having count(*) = 1
)
update public.inspections i
set source_event_id = c.report_key
from candidates c
join unique_keys u on u.report_key = c.report_key
where i.id = c.id
  and not exists (
    select 1
    from public.inspections existing
    where existing.source_agency is not distinct from c.source_agency
      and existing.source_event_id = c.report_key
  );

drop index if exists public.inspections_facility_date_type_agency_unkeyed;

create unique index inspections_facility_date_type_agency_unkeyed
  on public.inspections (
    facility_id,
    inspection_date,
    inspection_type,
    coalesce(source_agency, ''),
    coalesce(complaint_id, '')
  )
  where source_event_id is null;

comment on index public.inspections_facility_date_type_agency_unkeyed is
  'One unkeyed inspection per facility, date, type, agency, and complaint_id. Same-day CDSS complaints with different CONTROLNUMBERs are allowed. Rows with source_event_id use inspections_source_event_key instead.';
