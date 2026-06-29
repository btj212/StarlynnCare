-- Migration 0056: add city_slug columns to region_hub_stats RPC
--
-- The top_improved_slug / top_deteriorated_slug fields returned by this RPC
-- are facility slugs, but HubDifferentiators.tsx was building 2-segment hrefs
-- (/{state}/{slug}) instead of the correct 3-segment
-- (/{state}/{city_slug}/{slug}).  This migration adds the two city_slug columns
-- so the component can build correct links.
--
-- Postgres cannot change a function's return type via CREATE OR REPLACE.
-- DROP first so the new OUT columns are accepted.
DROP FUNCTION IF EXISTS public.region_hub_stats(text, text[]);

CREATE OR REPLACE FUNCTION public.region_hub_stats(
  p_state_code  text,
  p_city_slugs  text[]
)
RETURNS TABLE (
  median_beds                  numeric,
  last_inspection_date         date,
  most_cited_category          text,
  most_cited_count             integer,
  trend_recent                 integer,
  trend_mid                    integer,
  trend_prior                  integer,
  city_cit_per_fac             numeric,
  state_cit_per_fac            numeric,
  top_improved_name            text,
  top_improved_slug            text,
  top_improved_city_slug       text,
  top_improved_delta           integer,
  top_deteriorated_name        text,
  top_deteriorated_slug        text,
  top_deteriorated_city_slug   text,
  top_deteriorated_delta       integer
)
LANGUAGE sql STABLE
AS $$
WITH
  region_facs AS (
    SELECT id, name, slug, city_slug, beds
    FROM   facilities
    WHERE  state_code = p_state_code
      AND  publishable = true
      AND  city_slug   = ANY(p_city_slugs)
  ),

  state_fac_count AS (
    SELECT COUNT(*)::numeric AS n
    FROM   facilities
    WHERE  state_code = p_state_code
      AND  publishable = true
  ),

  region_insp AS (
    SELECT i.id AS insp_id, i.facility_id, i.inspection_date
    FROM   inspections i
    JOIN   region_facs rf ON rf.id = i.facility_id
  ),

  region_defs AS (
    SELECT d.inspection_id, d.category, ri.inspection_date, ri.facility_id
    FROM   deficiencies d
    JOIN   region_insp  ri ON ri.insp_id = d.inspection_id
    WHERE  ri.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
  ),

  top_cat AS (
    SELECT category, COUNT(*)::integer AS cnt
    FROM   region_defs
    WHERE  category IS NOT NULL AND category <> ''
    GROUP  BY category
    ORDER  BY COUNT(*) DESC
    LIMIT  1
  ),

  trend AS (
    SELECT
      COUNT(*) FILTER (
        WHERE inspection_date >= CURRENT_DATE - INTERVAL '12 months'
      )::integer AS recent,
      COUNT(*) FILTER (
        WHERE inspection_date >= CURRENT_DATE - INTERVAL '24 months'
          AND inspection_date <  CURRENT_DATE - INTERVAL '12 months'
      )::integer AS mid,
      COUNT(*) FILTER (
        WHERE inspection_date >= CURRENT_DATE - INTERVAL '36 months'
          AND inspection_date <  CURRENT_DATE - INTERVAL '24 months'
      )::integer AS prior
    FROM region_defs
  ),

  fac_periods AS (
    SELECT
      rf.id        AS facility_id,
      rf.name,
      rf.slug,
      rf.city_slug,
      COUNT(d.inspection_id) FILTER (
        WHERE ri.inspection_date >= CURRENT_DATE - INTERVAL '12 months'
      )::integer  AS cnt_recent,
      COUNT(d.inspection_id) FILTER (
        WHERE ri.inspection_date >= CURRENT_DATE - INTERVAL '24 months'
          AND ri.inspection_date <  CURRENT_DATE - INTERVAL '12 months'
      )::integer  AS cnt_prior,
      COUNT(DISTINCT ri.insp_id) FILTER (
        WHERE ri.inspection_date >= CURRENT_DATE - INTERVAL '12 months'
      )::integer  AS insp_recent,
      COUNT(DISTINCT ri.insp_id) FILTER (
        WHERE ri.inspection_date >= CURRENT_DATE - INTERVAL '24 months'
          AND ri.inspection_date <  CURRENT_DATE - INTERVAL '12 months'
      )::integer  AS insp_prior
    FROM   region_facs rf
    LEFT JOIN region_insp  ri ON ri.facility_id = rf.id
           AND ri.inspection_date >= CURRENT_DATE - INTERVAL '24 months'
    LEFT JOIN deficiencies d ON d.inspection_id = ri.insp_id
    GROUP  BY rf.id, rf.name, rf.slug, rf.city_slug
  ),

  fac_deltas AS (
    SELECT name, slug, city_slug,
           (cnt_recent - cnt_prior) AS delta
    FROM   fac_periods
    WHERE  insp_recent >= 1 AND insp_prior >= 1
  ),

  top_improved AS (
    SELECT name, slug, city_slug, delta::integer
    FROM   fac_deltas
    WHERE  delta < 0
    ORDER  BY delta ASC, name ASC
    LIMIT  1
  ),

  top_deteriorated AS (
    SELECT name, slug, city_slug, delta::integer
    FROM   fac_deltas
    WHERE  delta > 0
    ORDER  BY delta DESC, name ASC
    LIMIT  1
  ),

  state_defs_36m AS (
    SELECT COUNT(*)::numeric AS n
    FROM   deficiencies d
    JOIN   inspections  i ON i.id = d.inspection_id
    JOIN   facilities   f ON f.id = i.facility_id
    WHERE  f.state_code  = p_state_code
      AND  f.publishable = true
      AND  i.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
  )

SELECT
  (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY beds)
   FROM region_facs WHERE beds IS NOT NULL),

  (SELECT MAX(inspection_date)::date FROM region_insp),

  (SELECT CASE WHEN cnt >= 3 THEN category ELSE NULL END FROM top_cat),

  (SELECT cnt FROM top_cat),

  (SELECT recent FROM trend),
  (SELECT mid    FROM trend),
  (SELECT prior  FROM trend),

  CASE
    WHEN (SELECT COUNT(*) FROM region_facs) > 0
    THEN ROUND(
      (SELECT COUNT(*) FROM region_defs)::numeric
      / (SELECT COUNT(*) FROM region_facs),
      2
    )
    ELSE NULL
  END,

  CASE
    WHEN (SELECT n FROM state_fac_count) > 0
    THEN ROUND(
      (SELECT n FROM state_defs_36m)
      / (SELECT n FROM state_fac_count),
      2
    )
    ELSE NULL
  END,

  (SELECT name      FROM top_improved),
  (SELECT slug      FROM top_improved),
  (SELECT city_slug FROM top_improved),
  (SELECT delta     FROM top_improved),

  (SELECT name      FROM top_deteriorated),
  (SELECT slug      FROM top_deteriorated),
  (SELECT city_slug FROM top_deteriorated),
  (SELECT delta     FROM top_deteriorated)
$$;

COMMENT ON FUNCTION public.region_hub_stats(text, text[]) IS
  'Per-region hub differentiation stats for city/county hub pages. '
  'Returns a single row; all columns nullable when insufficient data. '
  'top_improved_city_slug / top_deteriorated_city_slug added in 0056 to '
  'enable correct 3-segment facility profile links.';
