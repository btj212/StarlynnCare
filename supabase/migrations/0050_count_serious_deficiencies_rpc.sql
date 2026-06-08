-- ============================================================
-- StarlynnCare Migration 0050 — serious deficiency count RPC
--
-- Backs the national homepage stat grid. Counts deficiencies
-- classified as serious (Type A class OR severity >= 3) on
-- publishable facilities within a date window.
-- ============================================================

CREATE OR REPLACE FUNCTION public.count_serious_deficiencies(
  p_since      date,
  p_state_code text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM deficiencies d
  JOIN inspections i ON i.id = d.inspection_id
  JOIN facilities f ON f.id = i.facility_id
  WHERE f.publishable = TRUE
    AND i.inspection_date >= p_since
    AND (d.class = 'Type A' OR COALESCE(d.severity, 0) >= 3)
    AND (p_state_code IS NULL OR f.state_code = p_state_code);
$$;

GRANT EXECUTE ON FUNCTION public.count_serious_deficiencies(date, text) TO anon, authenticated;
