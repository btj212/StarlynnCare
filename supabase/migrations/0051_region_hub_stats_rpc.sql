-- region_hub_stats(p_state_code, p_city_slugs[])
-- Returns a single row of computed differentiation stats for a city/county hub.
-- Covers: median beds, last inspection date, most-cited deficiency category,
-- 36-month citation trend (3 × 12m buckets), city-vs-state citation rate,
-- and the facility with the most-improved / most-deteriorated year-over-year record.
--
-- Data guards
--   • most_cited_category: only returned when count >= 3 (noise floor)
--   • top_improved / top_deteriorated: only when facility has ≥1 inspection in EACH
--     of the two 12-month comparison windows (prevents single-inspection artefacts)
--
-- Expected indexes (already present from prior migrations):
--   facilities(state_code, publishable, city_slug)
--   inspections(facility_id, inspection_date)
--   deficiencies(inspection_id)

CREATE OR REPLACE FUNCTION public.region_hub_stats(
  p_state_code  text,
  p_city_slugs  text[]
)
RETURNS TABLE (
  median_beds              numeric,
  last_inspection_date     date,
  most_cited_category      text,
  most_cited_count         integer,
  trend_recent             integer,   -- deficiency count, inspections 0–12 months ago
  trend_mid                integer,   -- 12–24 months ago
  trend_prior              integer,   -- 24–36 months ago
  city_cit_per_fac         numeric,
  state_cit_per_fac        numeric,
  top_improved_name        text,
  top_improved_slug        text,
  top_improved_delta       integer,
  top_deteriorated_name    text,
  top_deteriorated_slug    text,
  top_deteriorated_delta   integer
)
LANGUAGE sql STABLE
AS $$
WITH
  -- Region facilities
  region_facs AS (
    SELECT id, name, slug, beds
    FROM   facilities
    WHERE  state_code = p_state_code
      AND  publishable = true
      AND  city_slug   = ANY(p_city_slugs)
  ),

  -- State-wide facility count for comparison denominator
  state_fac_count AS (
    SELECT COUNT(*)::numeric AS n
    FROM   facilities
    WHERE  state_code = p_state_code
      AND  publishable = true
  ),

  -- All region inspections (unfiltered — used for last_inspection_date)
  region_insp AS (
    SELECT i.id AS insp_id, i.facility_id, i.inspection_date
    FROM   inspections i
    JOIN   region_facs rf ON rf.id = i.facility_id
  ),

  -- Region deficiencies in last 36 months (basis for category, trend, and rates)
  region_defs AS (
    SELECT d.inspection_id, d.category, ri.inspection_date, ri.facility_id
    FROM   deficiencies d
    JOIN   region_insp  ri ON ri.insp_id = d.inspection_id
    WHERE  ri.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
  ),

  -- Most-cited deficiency category
  top_cat AS (
    SELECT category, COUNT(*)::integer AS cnt
    FROM   region_defs
    WHERE  category IS NOT NULL AND category <> ''
    GROUP  BY category
    ORDER  BY COUNT(*) DESC
    LIMIT  1
  ),

  -- 36-month citation trend split into three 12-month windows
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

  -- Per-facility deficiency counts in two 12-month windows (for improved/deteriorated)
  fac_periods AS (
    SELECT
      rf.id   AS facility_id,
      rf.name,
      rf.slug,
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
    GROUP  BY rf.id, rf.name, rf.slug
  ),

  fac_deltas AS (
    SELECT name, slug,
           (cnt_recent - cnt_prior) AS delta
    FROM   fac_periods
    WHERE  insp_recent >= 1 AND insp_prior >= 1
  ),

  top_improved AS (
    SELECT name, slug, delta::integer
    FROM   fac_deltas
    WHERE  delta < 0
    ORDER  BY delta ASC, name ASC
    LIMIT  1
  ),

  top_deteriorated AS (
    SELECT name, slug, delta::integer
    FROM   fac_deltas
    WHERE  delta > 0
    ORDER  BY delta DESC, name ASC
    LIMIT  1
  ),

  -- State-wide deficiency count (36 months) for comparison rate
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
  -- Median beds across region facilities
  (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY beds)
   FROM region_facs WHERE beds IS NOT NULL),

  -- Most recent inspection in the region
  (SELECT MAX(inspection_date)::date FROM region_insp),

  -- Most-cited deficiency category (NULL when count < 3)
  (SELECT CASE WHEN cnt >= 3 THEN category ELSE NULL END FROM top_cat),

  -- Raw count for the most-cited category
  (SELECT cnt FROM top_cat),

  -- Trend: 0–12 months
  (SELECT recent FROM trend),
  -- Trend: 12–24 months
  (SELECT mid    FROM trend),
  -- Trend: 24–36 months
  (SELECT prior  FROM trend),

  -- City citations-per-facility (36 months)
  CASE
    WHEN (SELECT COUNT(*) FROM region_facs) > 0
    THEN ROUND(
      (SELECT COUNT(*) FROM region_defs)::numeric
      / (SELECT COUNT(*) FROM region_facs),
      2
    )
    ELSE NULL
  END,

  -- State citations-per-facility (36 months)
  CASE
    WHEN (SELECT n FROM state_fac_count) > 0
    THEN ROUND(
      (SELECT n FROM state_defs_36m)
      / (SELECT n FROM state_fac_count),
      2
    )
    ELSE NULL
  END,

  -- Most-improved facility (biggest negative delta)
  (SELECT name  FROM top_improved),
  (SELECT slug  FROM top_improved),
  (SELECT delta FROM top_improved),

  -- Most-deteriorated facility (biggest positive delta)
  (SELECT name  FROM top_deteriorated),
  (SELECT slug  FROM top_deteriorated),
  (SELECT delta FROM top_deteriorated)
$$;

COMMENT ON FUNCTION public.region_hub_stats(text, text[]) IS
  'Per-region hub differentiation stats for city/county hub pages. '
  'Returns a single row; all columns nullable when insufficient data.';
