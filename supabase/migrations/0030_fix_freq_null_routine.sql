-- ============================================================
-- StarlynnCare Migration 0030 — Fix frequency rank for
-- complaint-only facilities
--
-- ROOT CAUSE:
--   freq_raw = deficiencies / routine_inspection_count.
--   When a facility has ONLY complaint investigations (no routine
--   visits in 36 months), `insp_counts` returns no row for it,
--   so ic.n is NULL → coalesced to 0 → the CASE fell through to
--   `else 0`.  A freq_raw of 0 was then ranked as "best" (100th
--   percentile) because lower = better.  Bay Vista Commons, which
--   has 2 complaint-driven deficiencies and zero routine visits,
--   showed a 100th-percentile Frequency rank — the opposite of
--   what it deserved.
--
-- FIX:
--   Return NULL instead of 0 for freq_raw when ic.n = 0.
--   Propagate NULL correctly through:
--     • peer_medians — filter (where freq_raw is not null)
--     • ranked       — CASE WHEN freq_raw IS NOT NULL THEN … ELSE NULL END
--     • grade composite — fall back to 2-metric average when freq_pct is NULL
--
--   On the frontend, a NULL freq_pct renders a "No routine
--   inspections on file" card instead of a misleading 100th-pct bar.
--
-- CHANGES vs 0024_fix_repeat_rank.sql:
--   1. raw_metrics.freq_raw  — ELSE null (was ELSE 0)
--   2. peer_medians.freq_med — add FILTER (WHERE freq_raw IS NOT NULL)
--   3. ranked.freq_pct       — wrap in CASE WHEN freq_raw IS NOT NULL
--   4. grade composite       — 2-metric average when v_freq_pct IS NULL
-- ============================================================

create or replace function facility_snapshot(p_facility_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fac       record;
  v_bucket    text;
  v_since36   date := (current_date - interval '36 months')::date;
  v_since12   date := (current_date - interval '12 months')::date;

  v_peers     uuid[];
  v_peer_n    int  := 0;
  v_fallback  int  := 0;
  v_peer_def  text;

  v_sev_val   numeric := 0;
  v_rep_val   numeric := 0;
  v_freq_val  numeric;        -- NULL when no routine inspections
  v_traj_val  numeric := 0;
  v_sev_med   numeric := 0;
  v_rep_med   numeric := 0;
  v_freq_med  numeric;        -- NULL when no peers have routine inspections
  v_traj_med  numeric := 0;
  v_sev_pct   int;
  v_rep_pct   int;
  v_freq_pct  int;            -- NULL when no routine inspections
  v_traj_pct  int;

  v_composite      int;
  v_letter         text;
  v_has_insp       boolean := false;

  v_traj_json  jsonb;
  v_heat_json  jsonb;
  v_quote_json jsonb;
begin
  -- ── Load facility ──────────────────────────────────────
  select * into v_fac from facilities where id = p_facility_id;
  if not found then return null; end if;

  v_bucket := case
    when v_fac.beds is null or v_fac.beds <= 24 then 'small'
    when v_fac.beds <= 60  then 'medium'
    when v_fac.beds <= 100 then 'large'
    else 'xl'
  end;

  -- ── 1. Peer set with fallback ──────────────────────────
  select array_agg(id)
  into   v_peers
  from   facilities
  where  state_code    = v_fac.state_code
    and  care_category = v_fac.care_category
    and  (case when beds is null or beds <= 24 then 'small'
               when beds <= 60  then 'medium'
               when beds <= 100 then 'large'
               else 'xl' end) = v_bucket
    and  publishable = true;
  v_peer_n := coalesce(array_length(v_peers, 1), 0);

  if v_peer_n < 10 then
    v_fallback := 1;
    select array_agg(id)
    into   v_peers
    from   facilities
    where  state_code    = v_fac.state_code
      and  care_category = v_fac.care_category
      and  publishable   = true;
    v_peer_n := coalesce(array_length(v_peers, 1), 0);
  end if;

  if v_peer_n < 10 then
    v_fallback := 2;
    select array_agg(id)
    into   v_peers
    from   facilities
    where  state_code  = v_fac.state_code
      and  split_part(care_category, '_', 1) = split_part(v_fac.care_category, '_', 1)
      and  publishable = true;
    v_peer_n := coalesce(array_length(v_peers, 1), 0);
  end if;

  if v_peer_n = 0 or v_peers is null then
    v_peers  := array[p_facility_id];
    v_peer_n := 1;
  end if;

  v_peer_def := coalesce(v_fac.state_code, '?');
  if v_fac.care_category is not null and v_fac.care_category <> 'unknown' then
    v_peer_def := v_peer_def || ' / ' || v_fac.care_category;
  end if;
  if v_fallback = 0 then
    v_peer_def := v_peer_def || ' / ' || v_bucket || ' beds';
  end if;

  -- ── 2. Metrics + percentiles ───────────────────────────
  select exists(
    select 1 from inspections
    where  facility_id      = p_facility_id
      and  inspection_date >= v_since36
  ) into v_has_insp;

  with
  eff_beds as (
    select id,
           greatest(coalesce(beds, 1), 1)::numeric as b
    from   facilities
    where  id = any(v_peers)
  ),
  window_defs as (
    select i.facility_id,
           i.id           as inspection_id,
           i.inspection_date,
           d.code,
           coalesce(
             d.severity,
             case
               when d.immediate_jeopardy  then 4
               when d.class = 'Type A'    then 3
               when d.class = 'Type B'    then 2
               else 1
             end
           )              as eff_sev
    from   deficiencies d
    join   inspections  i on i.id = d.inspection_id
    where  i.facility_id     = any(v_peers)
      and  i.inspection_date >= v_since36
  ),
  repeat_reg_counts as (
    select facility_id, code
    from   window_defs
    where  code is not null
    group  by facility_id, code
    having count(distinct inspection_id) >= 3
  ),
  insp_counts as (
    -- Routine visits only — complaint investigations are already captured
    -- in severity; excluding them prevents double-penalising.
    -- A facility with ic.n = NULL/0 gets freq_raw = NULL (not 0) so it
    -- is not falsely ranked as "best" on frequency.
    select facility_id,
           count(*)::numeric as n
    from   inspections
    where  facility_id     = any(v_peers)
      and  inspection_date >= v_since36
      and  not is_complaint
    group  by facility_id
  ),
  sev_aggs as (
    select wd.facility_id,
           sum(case wd.eff_sev when 1 then 1 when 2 then 3 when 3 then 10 else 25 end)::numeric  as total_wt,
           count(*)::numeric                                                                       as def_n,
           sum(case when exists(
                 select 1 from repeat_reg_counts rrc
                 where  rrc.facility_id = wd.facility_id
                   and  rrc.code        = wd.code
               ) then 1 else 0 end)::numeric                                                      as repeat_n,
           sum(case when wd.inspection_date >= v_since12
                    then case wd.eff_sev when 1 then 1 when 2 then 3 when 3 then 10 else 25 end
                    else 0 end)::numeric                                                           as wt_12,
           sum(case when wd.inspection_date <  v_since12
                    then case wd.eff_sev when 1 then 1 when 2 then 3 when 3 then 10 else 25 end
                    else 0 end)::numeric                                                           as wt_prior
    from   window_defs wd
    group  by wd.facility_id
  ),
  raw_metrics as (
    select eb.id,
           coalesce(sa.total_wt, 0) / eb.b                                    as sev_raw,
           case when coalesce(sa.def_n, 0) > 0
                then sa.repeat_n / sa.def_n else 0 end                         as rep_raw,
           -- FIX: NULL instead of 0 when no routine inspections exist.
           -- 0 was previously interpreted as "best performer", masking the
           -- fact that we simply have no routine-visit denominator.
           case when coalesce(ic.n, 0) > 0
                then coalesce(sa.def_n, 0) / ic.n else null end                as freq_raw,
           (coalesce(sa.wt_12, 0) - coalesce(sa.wt_prior, 0)) / eb.b          as traj_raw
    from   eff_beds eb
    left join sev_aggs    sa on sa.facility_id = eb.id
    left join insp_counts ic on ic.facility_id = eb.id
  ),
  peer_medians as (
    select percentile_cont(0.5) within group (order by sev_raw)                              as sev_med,
           percentile_cont(0.5) within group (order by rep_raw)                              as rep_med,
           -- Exclude NULL freq_raw so the peer median is computed only over
           -- facilities that actually have routine inspection data.
           percentile_cont(0.5) within group (order by freq_raw) filter (where freq_raw is not null) as freq_med,
           percentile_cont(0.5) within group (order by traj_raw)                             as traj_med
    from   raw_metrics
  ),
  ranked as (
    select id, sev_raw, rep_raw, freq_raw, traj_raw,
           round((1 - percent_rank() over (order by sev_raw))  * 100)::int as sev_pct,
           round((1 - percent_rank() over (order by rep_raw))  * 100)::int as rep_pct,
           -- FIX: return NULL for facilities with no routine inspections rather
           -- than letting NULL sort last (= worst rank) or coerce to 0 (= best).
           -- The frontend renders a "no data" card when percentile is null.
           case when freq_raw is not null
                then round((1 - percent_rank() over (order by freq_raw nulls last)) * 100)::int
                else null end                                                as freq_pct,
           round((1 - percent_rank() over (order by traj_raw)) * 100)::int as traj_pct
    from   raw_metrics
  )
  select r.sev_raw, r.rep_raw, r.freq_raw, r.traj_raw,
         r.sev_pct, r.rep_pct, r.freq_pct, r.traj_pct,
         pm.sev_med, pm.rep_med, pm.freq_med, pm.traj_med
  into   v_sev_val, v_rep_val, v_freq_val, v_traj_val,
         v_sev_pct, v_rep_pct, v_freq_pct, v_traj_pct,
         v_sev_med, v_rep_med, v_freq_med, v_traj_med
  from   ranked       r
  cross join peer_medians pm
  where  r.id = p_facility_id;

  -- ── 3. Grade ──────────────────────────────────────────
  if v_sev_pct is not null and v_has_insp then
    -- When freq_pct is NULL (no routine inspections), compute composite
    -- from severity + repeat only so the grade is not artificially inflated
    -- by a missing metric being treated as "best".
    v_composite := case
      when v_freq_pct is not null
      then round((v_sev_pct + v_rep_pct + v_freq_pct)::numeric / 3)::int
      else round((v_sev_pct + v_rep_pct)::numeric / 2)::int
    end;
    v_letter := case
      when v_composite >= 90 then 'A'
      when v_composite >= 80 then 'A−'
      when v_composite >= 70 then 'B'
      when v_composite >= 60 then 'B−'
      when v_composite >= 50 then 'C'
      when v_composite >= 40 then 'C−'
      when v_composite >= 30 then 'D'
      else 'F'
    end;
  end if;

  -- ── 4. Trajectory series (24 months) ─────────────────
  select jsonb_agg(
    jsonb_build_object(
      'month',             to_char(m.ms, 'YYYY-MM'),
      'facility_score',    coalesce(fac_m.score, 0),
      'peer_median_score', coalesce(peer_m.med,  0)
    ) order by m.ms
  )
  into   v_traj_json
  from (
    select generate_series(
      date_trunc('month', current_date - interval '23 months'),
      date_trunc('month', current_date),
      interval '1 month'
    )::date as ms
  ) m
  left join lateral (
    select coalesce(sum(
      case coalesce(d.severity,
                    case when d.immediate_jeopardy then 4
                         when d.class = 'Type A'   then 3
                         when d.class = 'Type B'   then 2
                         else 1 end)
        when 1 then 1 when 2 then 3 when 3 then 10 else 25 end
    ), 0) as score
    from   deficiencies d
    join   inspections  i on i.id = d.inspection_id
    where  i.facility_id = p_facility_id
      and  date_trunc('month', i.inspection_date)::date = m.ms
  ) fac_m on true
  left join lateral (
    select percentile_cont(0.5) within group (order by ps.s) as med
    from (
      select i2.facility_id,
             coalesce(sum(
               case coalesce(d2.severity,
                             case when d2.immediate_jeopardy then 4
                                  when d2.class = 'Type A'   then 3
                                  when d2.class = 'Type B'   then 2
                                  else 1 end)
                 when 1 then 1 when 2 then 3 when 3 then 10 else 25 end
             ), 0) as s
      from   inspections  i2
      left join deficiencies d2 on d2.inspection_id = i2.id
      where  i2.facility_id     = any(v_peers)
        and  date_trunc('month', i2.inspection_date)::date = m.ms
      group  by i2.facility_id
    ) ps
  ) peer_m on true;

  -- ── 5. Heatmap (4×3 grid) ─────────────────────────────
  select jsonb_agg(
    jsonb_build_object(
      'severity', h.eff_sev,
      'scope',    h.eff_scope,
      'count',    h.cnt,
      'tags',     h.tags
    )
  )
  into   v_heat_json
  from (
    select
      coalesce(d.severity,
               case when d.immediate_jeopardy then 4
                    when d.class = 'Type A'   then 3
                    when d.class = 'Type B'   then 2
                    else 1 end)                         as eff_sev,
      coalesce(d.scope, 'isolated')                     as eff_scope,
      count(*)                                          as cnt,
      jsonb_agg(
        distinct coalesce(nullif(d.ftag, ''), nullif(d.code, ''))
        order by coalesce(nullif(d.ftag, ''), nullif(d.code, ''))
      ) filter (
        where coalesce(nullif(d.ftag, ''), nullif(d.code, '')) is not null
      )                                                 as tags
    from   deficiencies d
    join   inspections  i on i.id = d.inspection_id
    where  i.facility_id     = p_facility_id
      and  i.inspection_date >= v_since36
    group  by eff_sev, eff_scope
  ) h
  where h.eff_sev   between 1 and 4
    and h.eff_scope in ('isolated', 'pattern', 'widespread');

  -- ── 6. Pull quote (most severe, most recent) ──────────
  select jsonb_build_object(
    'date', i.inspection_date::text,
    'tag',  coalesce(nullif(d.ftag, ''), nullif(d.code, '')),
    'text', d.inspector_narrative
  )
  into   v_quote_json
  from   deficiencies d
  join   inspections  i on i.id = d.inspection_id
  where  i.facility_id     = p_facility_id
    and  i.inspection_date >= v_since36
    and  d.inspector_narrative is not null
    and  d.inspector_narrative <> ''
  order  by
    coalesce(d.severity,
             case when d.immediate_jeopardy then 4
                  when d.class = 'Type A'   then 3
                  when d.class = 'Type B'   then 2
                  else 1 end) desc,
    i.inspection_date desc
  limit  1;

  -- ── 7. Assemble + return ───────────────────────────────
  return jsonb_build_object(
    'facility', jsonb_build_object(
      'id',           v_fac.id,
      'name',         v_fac.name,
      'beds',         v_fac.beds,
      'state_code',   v_fac.state_code,
      'license_type', v_fac.license_type
    ),
    'peer_set', jsonb_build_object(
      'definition',    v_peer_def,
      'n',             v_peer_n,
      'fallback_level', v_fallback
    ),
    'metrics', jsonb_build_object(
      'severity',   jsonb_build_object(
                      'value',       round(v_sev_val::numeric, 4),
                      'percentile',  v_sev_pct,
                      'peer_median', round(v_sev_med::numeric, 4)),
      'repeats',    jsonb_build_object(
                      'value',       round(v_rep_val::numeric, 4),
                      'percentile',  v_rep_pct,
                      'peer_median', round(v_rep_med::numeric, 4)),
      'frequency',  jsonb_build_object(
                      'value',       v_freq_val,
                      'percentile',  v_freq_pct,
                      'peer_median', v_freq_med),
      'trajectory', jsonb_build_object(
                      'value',       round(v_traj_val::numeric, 4),
                      'percentile',  v_traj_pct,
                      'peer_median', round(v_traj_med::numeric, 4))
    ),
    'grade', case
               when v_letter is not null
               then jsonb_build_object(
                      'letter',              v_letter,
                      'composite_percentile', v_composite)
               else null
             end,
    'has_inspections',  v_has_insp,
    'trajectory_series', coalesce(v_traj_json, '[]'::jsonb),
    'heatmap',           coalesce(v_heat_json, '[]'::jsonb),
    'pull_quote',        v_quote_json
  );
end;
$$;

grant execute on function facility_snapshot(uuid) to anon;
grant execute on function facility_snapshot(uuid) to authenticated;

comment on function facility_snapshot(uuid) is
  'Returns a quality-snapshot JSON blob for a facility page. '
  'Computes 4 peer-benchmarked metrics (severity, repeats, frequency, trajectory) '
  'with percentile ranks, a composite letter grade, a 24-month sparkline, '
  'a 4×3 scope×severity heatmap, and a best pull-quote. '
  'Peer set: same state+care_category+bed-bucket, with bed-bucket then MC fallback. '
  'Repeat rank: counts deficiency rows whose regulation code was cited in 3+ distinct '
  'inspection visits within the 36-month window. '
  'Frequency rank: NULL (not 0) when facility has no routine inspections — prevents '
  'complaint-only facilities from appearing as top frequency performers. '
  'Grade composite: 2-metric average (severity + repeat) when frequency is unavailable. '
  'Compute live; swap to nightly facility_snapshot_cache when p95 > 400ms.';
