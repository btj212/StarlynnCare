-- ============================================================
-- StarlynnCare Migration 0085 — latest WA DSHS posted report
--
-- wa_pdf_inventory is admin-only under RLS. Public facility pages still
-- need the posted month when inspections rows were never backfilled
-- (352 publishable WA homes as of 2026-11). This RPC returns only the
-- latest inspection/investigation month for a single facility.
-- ============================================================

CREATE OR REPLACE FUNCTION public.wa_latest_posted_report(p_facility_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'posted_month', inv.posted_month,
    'doc_type', inv.doc_type
  )
  FROM wa_pdf_inventory inv
  JOIN facilities f ON f.id = inv.facility_id
  WHERE inv.facility_id = p_facility_id
    AND f.publishable = TRUE
    AND f.state_code = 'WA'
    AND inv.posted_month IS NOT NULL
    AND inv.posted_month <= to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, 'YYYY-MM')
    AND inv.doc_type IN ('inspection', 'investigation')
  ORDER BY inv.posted_month DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.wa_latest_posted_report(uuid) TO anon, authenticated;
