-- ============================================================
-- StarlynnCare Migration 0046 — PA Insights Analytics RPCs
--
-- Three read-only SECURITY DEFINER functions that back the
-- /pennsylvania/insights/* editorial story pages:
--
--   pa_top_ij_facilities(p_limit int) → per-facility IJ/severe/total
--   pa_county_deficiency_stats()      → per-county aggregates (5+ fac)
--   pa_bed_tier_severity()            → avg severe by bed-size tier
--
-- All are STABLE, take no writes, and grant READ to anon.
-- ============================================================

-- ── 1. Top facilities by immediate-jeopardy count ────────────────────────

CREATE OR REPLACE FUNCTION public.pa_top_ij_facilities(p_limit integer DEFAULT 10)
RETURNS TABLE (
  name              text,
  beds              integer,
  county            text,
  city_slug         text,
  slug              text,
  ij_count          bigint,
  severe_count      bigint,
  total_deficiencies bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.name,
    f.beds,
    f.county,
    f.city_slug,
    f.slug,
    COUNT(CASE WHEN d.state_severity_raw = 'Immediate Jeopardy' THEN 1 END) AS ij_count,
    COUNT(CASE WHEN d.severity >= 3 THEN 1 END)                             AS severe_count,
    COUNT(d.id)                                                              AS total_deficiencies
  FROM facilities f
  JOIN inspections i  ON i.facility_id = f.id
  JOIN deficiencies d ON d.inspection_id = i.id
  WHERE f.state_code = 'PA'
    AND f.publishable = true
  GROUP BY f.id, f.name, f.beds, f.county, f.city_slug, f.slug
  HAVING COUNT(CASE WHEN d.state_severity_raw = 'Immediate Jeopardy' THEN 1 END) > 0
  ORDER BY ij_count DESC, severe_count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.pa_top_ij_facilities(integer) TO anon, authenticated;

-- ── 2. County-level deficiency stats (5+ publishable facilities) ─────────

CREATE OR REPLACE FUNCTION public.pa_county_deficiency_stats()
RETURNS TABLE (
  county              text,
  facilities          bigint,
  ij_total            bigint,
  severe_total        bigint,
  deficiencies_total  bigint,
  def_per_facility    numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.county,
    COUNT(DISTINCT f.id)                                                        AS facilities,
    COUNT(CASE WHEN d.state_severity_raw = 'Immediate Jeopardy' THEN 1 END)    AS ij_total,
    COUNT(CASE WHEN d.severity >= 3 THEN 1 END)                                 AS severe_total,
    COUNT(d.id)                                                                  AS deficiencies_total,
    ROUND(COUNT(d.id)::numeric / NULLIF(COUNT(DISTINCT f.id), 0), 1)           AS def_per_facility
  FROM facilities f
  JOIN inspections i  ON i.facility_id = f.id
  JOIN deficiencies d ON d.inspection_id = i.id
  WHERE f.state_code = 'PA'
    AND f.publishable = true
    AND f.county IS NOT NULL
  GROUP BY f.county
  HAVING COUNT(DISTINCT f.id) >= 5
  ORDER BY def_per_facility DESC;
$$;

GRANT EXECUTE ON FUNCTION public.pa_county_deficiency_stats() TO anon, authenticated;

-- ── 3. Average severe findings per facility by bed-size tier ─────────────

CREATE OR REPLACE FUNCTION public.pa_bed_tier_severity()
RETURNS TABLE (
  tier        text,
  n           bigint,
  avg_severe  numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN f.beds < 20  THEN 'small'
      WHEN f.beds < 50  THEN 'medium'
      WHEN f.beds < 100 THEN 'large'
      ELSE                   'xl'
    END AS tier,
    COUNT(DISTINCT f.id)                                                         AS n,
    ROUND(
      AVG(per_fac.severe_count)::numeric,
      1
    )                                                                            AS avg_severe
  FROM facilities f
  JOIN (
    SELECT
      i.facility_id,
      COUNT(CASE WHEN d.severity >= 3 THEN 1 END) AS severe_count
    FROM inspections i
    JOIN deficiencies d ON d.inspection_id = i.id
    GROUP BY i.facility_id
  ) per_fac ON per_fac.facility_id = f.id
  WHERE f.state_code = 'PA'
    AND f.publishable = true
    AND f.beds IS NOT NULL
  GROUP BY tier
  ORDER BY avg_severe DESC;
$$;

GRANT EXECUTE ON FUNCTION public.pa_bed_tier_severity() TO anon, authenticated;
