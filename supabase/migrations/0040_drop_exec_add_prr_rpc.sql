-- Security audit finding C2 — remove the public.exec(text) RPC that takes
-- arbitrary SQL, and replace its only caller (PRR coverage-gap query) with a
-- locked-down SECURITY INVOKER function that takes no arguments.
--
-- Background: admin/prr-queue called `supabase.rpc("exec", { sql: "..." })`,
-- which is a generic raw-SQL execution gadget. Service-role can already do
-- anything, but the existence of `exec` means a single misconfigured GRANT
-- turns a routine bug into total DB compromise.

CREATE OR REPLACE FUNCTION public.wa_prr_coverage_gaps()
RETURNS TABLE (
  license_number    text,
  name              text,
  city              text,
  oldest_inspection text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT f.license_number,
         f.name,
         f.city,
         MIN(i.inspection_date)::text AS oldest_inspection
  FROM facilities f
  LEFT JOIN inspections i ON i.facility_id = f.id
  WHERE f.state_code = 'WA'
    AND f.publishable = true
    AND f.license_number IS NOT NULL
  GROUP BY f.license_number, f.name, f.city
  HAVING MAX(i.inspection_date) IS NULL
      OR MAX(i.inspection_date) < NOW() - INTERVAL '3 years'
  ORDER BY f.name
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.wa_prr_coverage_gaps() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_prr_coverage_gaps() TO service_role;

DROP FUNCTION IF EXISTS public.exec(text);
