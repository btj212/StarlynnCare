-- ============================================================
-- StarlynnCare Migration 0028 — Fix inspection_has_real_narrative()
--
-- The original version (migration 0026) only checked raw_data->>'narrative'.
-- Oregon stores allegation text in deficiencies.description, not in
-- raw_data->>'narrative', so all OR facilities were false-negatives.
-- Washington inspections with 2+ PDF links concatenate into a >100-char
-- string that still consists entirely of placeholders — false-positive.
--
-- Updated logic (mirrors inspectionHasRealNarrative in loadFacilityProfile.ts):
--   Path 1: raw_data->>'narrative' is ≥100 chars, not a WA placeholder, and
--            does not consist entirely of "—: WA DSHS report:" lines.
--   Path 2: any deficiency for this inspection has real text in description
--            or inspector_narrative (≥50 chars, not a URL, not a WA placeholder).
-- ============================================================

create or replace function inspection_has_real_narrative(p_inspection_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_narrative text;
  v_all_placeholder boolean;
begin
  -- ── Path 1: real text in raw_data->>'narrative' ──────────────────────
  select trim(raw_data->>'narrative')
  into   v_narrative
  from   inspections
  where  id = p_inspection_id;

  if v_narrative is not null
     and length(v_narrative) >= 100
     and v_narrative !~ '^—:\s*WA DSHS report:'
  then
    -- Guard: check that not every non-empty line is a WA placeholder
    -- (multi-PDF concatenation can exceed 100 chars but still be fake).
    select bool_and(
        line ~ '^—:' or line ~ '^WA DSHS report:'
    )
    into v_all_placeholder
    from (
        select trim(unnest(string_to_array(v_narrative, E'\n'))) as line
    ) lines
    where trim(line) <> '';

    if not coalesce(v_all_placeholder, false) then
        return true;
    end if;
  end if;

  -- ── Path 2: real text in deficiency rows (OR, TX structured exports) ─
  return exists (
    select 1
    from deficiencies d
    where d.inspection_id = p_inspection_id
      and (
        -- description field: real text
        (
          d.description is not null
          and length(trim(d.description)) >= 50
          and trim(d.description) !~ '^https?://'
          and trim(d.description) !~ '^—:\s*WA DSHS report:'
          and trim(d.description) not like 'WA DSHS report:%'
        )
        or
        -- inspector_narrative field: real text
        (
          d.inspector_narrative is not null
          and length(trim(d.inspector_narrative)) >= 50
          and trim(d.inspector_narrative) !~ '^https?://'
          and trim(d.inspector_narrative) !~ '^—:\s*WA DSHS report:'
          and trim(d.inspector_narrative) not like 'WA DSHS report:%'
        )
      )
  );
end;
$$;

comment on function inspection_has_real_narrative(uuid) is
  'Returns true when the inspection has real parsed data — either in '
  'raw_data->narrative (CA/MN) or in deficiency rows (OR allegation text). '
  'Mirrors inspectionHasRealNarrative() in src/lib/facility/loadFacilityProfile.ts.';
