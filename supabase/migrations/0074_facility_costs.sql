-- Listed prices read by scrapers/cost_fetch.py, one latest row per home and source.
-- Only rows written by that script are returned (they carry raw_extract.care_basis);
-- older Firecrawl pilot rows could hold a neighbouring home's price and stay out.
-- A Place for Mom rows are left out for now (Blake, 2026-11-16).
--
-- entry_price is the lowest private-room price (studio, one bedroom, two bedrooms).
-- Semi-private and shared rooms are left out, because they price one bed of a shared
-- room and would look like the home's starting price.

CREATE OR REPLACE FUNCTION public.facility_costs(p_facility_ids uuid[])
 RETURNS TABLE(
   facility_id uuid,
   source text,
   source_url text,
   fetched_at timestamptz,
   entry_price integer,
   memory_care_price integer,
   care_basis text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (s.facility_id, s.source)
    s.facility_id,
    s.source,
    s.source_url,
    s.fetched_at,
    (
      SELECT min(r.value::integer)
      FROM jsonb_each_text(coalesce(s.raw_extract->'rooms', '{}'::jsonb)) AS r(key, value)
      WHERE r.key !~* '(semi|shared|companion)'
    ),
    s.memory_care_price_monthly_usd,
    s.raw_extract->>'care_basis'
  FROM pilot_pricing_sources s
  WHERE s.facility_id = ANY (p_facility_ids)
    AND s.is_correct_facility
    AND s.source <> 'apfm'
    AND s.raw_extract ? 'care_basis'
  ORDER BY s.facility_id, s.source, s.fetched_at DESC
$function$;
