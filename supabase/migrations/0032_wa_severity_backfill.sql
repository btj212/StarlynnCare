-- Backfill deficiencies.severity for WA facilities based on state_severity_raw.
--
-- WA DSHS ALF severity taxonomy (WAC 388-78A / 388-107):
--   IJ / Immediate Jeopardy → 4  (life-threatening)
--   Type A / Class 1        → 3  (immediate threat to health/safety)
--   Type B / Class 2        → 2  (potential for harm, not immediate)
--   Type C / Class 3        → 1  (compliance issue, minimal harm)
--   unknown / null          → null (do not guess)
--
-- The state hub "severe deficiencies" stat uses severity >= 3, so this maps
-- IJ and Type A citations correctly into that threshold.

update public.deficiencies d
set severity = case
  when lower(trim(d.state_severity_raw)) in (
    'ij', 'immediate jeopardy'
  ) then 4

  when lower(trim(d.state_severity_raw)) in (
    'type a', 'typea', 'type-a', 'class 1', 'class1', 'class i'
  ) then 3

  when lower(trim(d.state_severity_raw)) in (
    'type b', 'typeb', 'type-b', 'class 2', 'class2', 'class ii'
  ) then 2

  when lower(trim(d.state_severity_raw)) in (
    'type c', 'typec', 'type-c', 'class 3', 'class3', 'class iii'
  ) then 1

  else null
end
from public.inspections i
join public.facilities f on f.id = i.facility_id
where d.inspection_id = i.id
  and f.state_code = 'WA'
  and d.state_severity_raw is not null
  and d.severity is null;   -- only touch rows not already scored

-- Confirm: show distribution after backfill
select d.state_severity_raw, d.severity, count(*) as n
from public.deficiencies d
join public.inspections i on i.id = d.inspection_id
join public.facilities f on f.id = i.facility_id
where f.state_code = 'WA'
group by d.state_severity_raw, d.severity
order by d.severity desc nulls last, n desc;
