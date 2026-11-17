-- Published homes in a state that have at least one cited finding in the last
-- three years. The full-report page of a home (/{state}/{city}/{home}/inspections)
-- lists exactly those findings, so the sitemap includes the page only for these
-- homes. Three years matches INSPECTION_DISPLAY_YEARS in loadFacilityProfile.ts.

CREATE OR REPLACE FUNCTION public.facilities_with_recent_findings(p_state_code text)
 RETURNS TABLE(id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT f.id
  FROM facilities f
  WHERE f.state_code = p_state_code
    AND f.publishable
    AND EXISTS (
      SELECT 1
      FROM inspections i
      JOIN deficiencies d ON d.inspection_id = i.id
      WHERE i.facility_id = f.id
        AND i.inspection_date >= (current_date - interval '3 years')::date
    )
  ORDER BY f.id
$function$;
