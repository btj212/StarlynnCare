-- ============================================================
-- StarlynnCare Migration 0009 — Quality Snapshot Function
--
-- Adds facility_snapshot(p_facility_id uuid) → jsonb
--
-- Returns one JSON blob with:
--   • Peer-set definition + fallback level
--   • Four metrics (severity, repeats, frequency, trajectory)
--     each with value, percentile-within-peers, and peer median
--   • Composite letter grade (A…F)
--   • 24-month trajectory sparkline series (facility + peer median)
--   • 4×3 scope×severity heatmap (counts + section tags per cell)
--   • Best pull-quote (most severe + most recent inspector narrative)
--
-- Effective severity derivation for CDSS data:
--   severity col (1–4) → used if set
--   else immediate_jeopardy → 4
--   else class = 'Type A'   → 3
--   else class = 'Type B'   → 2
--   else                    → 1
--
-- Peer-set fallback levels:
--   0 = state + care_category + bed bucket
--   1 = state + care_category  (drop bed bucket)
--   2 = state + license type prefix (drop MC distinction)
--
-- Run in Supabase SQL Editor.
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

  -- Per-metric raw values + percentiles + peer medians
  v_sev_val   numeric := 0;
  v_rep_val   numeric := 0;
  v_freq_val  numeric := 0;
  v_traj_val  numeric := 0;
  v_sev_med   numeric := 0;
  v_rep_med   numeric := 0;
  v_freq_med  numeric := 0;
  v_traj_med  numeric := 0;
  v_sev_pct   int;
  v_rep_pct   int;
  v_freq_pct  int;
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

  -- QS bed bucket (different from the capacity_tier generated column)
  v_bucket := case
    when v_fac.beds is null or v_fac.beds <= 24 then 'small'
    when v_fac.beds <= 60  then 'medium'
    when v_fac.beds <= 100 then 'large'
    else 'xl'
  end;

  -- ── 1. Peer set with fallback ──────────────────────────
  -- Level 0: state + care_category + bed bucket
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
    -- Drop MC distinction: match on base license-type prefix only
    -- e.g. 'rcfe_memory_care' and 'rcfe_general' both → 'rcfe'
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

  -- Human-readable peer set label
  v_peer_def := coalesce(v_fac.state_code, '?');
  if v_fac.care_category is not null and v_fac.care_category <> 'unknown' then
    v_peer_def := v_peer_def || ' / ' || v_fac.care_category;
  end if;
  if v_fallback = 0 then
    v_peer_def := v_peer_def || ' / ' || v_bucket || ' beds';
  end if;

  -- ── 2. Metrics + percentiles ───────────────────────────
  -- "Has inspections" now includes any visit type (routine or complaint)
  -- so that a facility with only complaint investigations still scores.
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
    -- ALL deficiencies in 36-month window — complaints included.
    -- For California RCFEs most serious violations surface through
    -- complaint investigations, so excluding them would inflate grades.
    -- The Frequency denominator (insp_counts) still uses only routine
    -- visits so complaint investigations do not deflate that metric.
    select i.facility_id,
           i.inspection_date,
           coalesce(
             d.severity,
             case
               when d.immediate_jeopardy  then 4
               when d.class = 'Type A'    then 3
               when d.class = 'Type B'    then 2
               else 1
             end
           )                              as eff_sev,
           d.is_repeat
    from   deficiencies d
    join   inspections  i on i.id = d.inspection_id
    where  i.facility_id     = any(v_peers)
      and  i.inspection_date >= v_since36
  ),
  insp_counts as (
    -- Frequency denominator: routine visits only (not complaints) so
    -- a heavily-complained facility is not unfairly penalised twice.
    select facility_id,
           count(*)::numeric as n
    from   inspections
    where  facility_id     = any(v_peers)
      and  inspection_date >= v_since36
      and  not is_complaint
    group  by facility_id
  ),
  sev_aggs as (
    select facility_id,
           sum(case eff_sev when 1 then 1 when 2 then 3 when 3 then 10 else 25 end)::numeric  as total_wt,
           count(*)::numeric                                                                    as def_n,
           sum(case when is_repeat then 1 else 0 end)::numeric                                 as repeat_n,
           sum(case when inspection_date >= v_since12
                    then case eff_sev when 1 then 1 when 2 then 3 when 3 then 10 else 25 end
                    else 0 end)::numeric                                                        as wt_12,
           sum(case when inspection_date <  v_since12
                    then case eff_sev when 1 then 1 when 2 then 3 when 3 then 10 else 25 end
                    else 0 end)::numeric                                                        as wt_prior
    from   window_defs
    group  by facility_id
  ),
  raw_metrics as (
    select eb.id,
           coalesce(sa.total_wt, 0) / eb.b                                    as sev_raw,
           case when coalesce(sa.def_n, 0) > 0
                then sa.repeat_n / sa.def_n else 0 end                         as rep_raw,
           case when coalesce(ic.n, 0) > 0
                then coalesce(sa.def_n, 0) / ic.n else 0 end                   as freq_raw,
           (coalesce(sa.wt_12, 0) - coalesce(sa.wt_prior, 0)) / eb.b          as traj_raw
    from   eff_beds eb
    left join sev_aggs    sa on sa.facility_id = eb.id
    left join insp_counts ic on ic.facility_id = eb.id
  ),
  peer_medians as (
    select percentile_cont(0.5) within group (order by sev_raw)  as sev_med,
           percentile_cont(0.5) within group (order by rep_raw)  as rep_med,
           percentile_cont(0.5) within group (order by freq_raw) as freq_med,
           percentile_cont(0.5) within group (order by traj_raw) as traj_med
    from   raw_metrics
  ),
  ranked as (
    select id, sev_raw, rep_raw, freq_raw, traj_raw,
           -- "lower is better" → invert percent_rank so higher = better facility
           round((1 - percent_rank() over (order by sev_raw))  * 100)::int as sev_pct,
           round((1 - percent_rank() over (order by rep_raw))  * 100)::int as rep_pct,
           round((1 - percent_rank() over (order by freq_raw)) * 100)::int as freq_pct,
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
    v_composite := round(
      (v_sev_pct + v_rep_pct + v_freq_pct + v_traj_pct)::numeric / 4
    )::int;
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
                      'value',       round(v_freq_val::numeric, 4),
                      'percentile',  v_freq_pct,
                      'peer_median', round(v_freq_med::numeric, 4)),
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

-- Grant execute to the public (anon) role so the publishable key can call it
grant execute on function facility_snapshot(uuid) to anon;
grant execute on function facility_snapshot(uuid) to authenticated;

comment on function facility_snapshot(uuid) is
  'Returns a quality-snapshot JSON blob for a facility page. '
  'Computes 4 peer-benchmarked metrics (severity, repeats, frequency, trajectory) '
  'with percentile ranks, a composite letter grade, a 24-month sparkline, '
  'a 4×3 scope×severity heatmap, and a best pull-quote. '
  'Peer set: same state+care_category+bed-bucket, with bed-bucket then MC fallback. '
  'Compute live; swap to nightly facility_snapshot_cache when p95 > 400ms.';
