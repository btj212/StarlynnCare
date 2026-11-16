-- Nearest-first related homes for a facility profile.
--
-- The profile used to take the 8 homes with the latest inspection date in the
-- same city. That column is empty for most homes, so every profile in a city
-- linked to the same 8 homes and the rest got no link. This returns the homes
-- nearest to the one being viewed, from the cities passed in.
--
-- A home is returned only when its page is in the sitemap: it has an inspection,
-- and it is not an Arizona home of 10 or fewer beds with no citations. That rule
-- mirrors src/lib/seo/indexability.ts (AZ_SMALL_BED_LIMIT = 10). Change both
-- together.
--
-- distance_km is null when either home has no coordinates. Those rows sort last,
-- by name, so a home with no coordinates still gets a list.

CREATE OR REPLACE FUNCTION public.related_facilities(
  p_facility_id uuid,
  p_city_slugs text[],
  p_limit integer DEFAULT 12
)
 RETURNS TABLE(
   id uuid,
   name text,
   city text,
   slug text,
   city_slug text,
   distance_km double precision
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT fa.id, fa.state_code,
           fa.latitude::float8 AS lat, fa.longitude::float8 AS lon
    FROM facilities fa
    WHERE fa.id = p_facility_id
  )
  SELECT f.id, f.name, f.city, f.slug, f.city_slug,
         CASE
           WHEN me.lat IS NULL OR me.lon IS NULL
             OR f.latitude IS NULL OR f.longitude IS NULL THEN NULL
           ELSE 2 * 6371 * asin(least(1, sqrt(
                  power(sin(radians(f.latitude::float8 - me.lat) / 2), 2)
                  + cos(radians(me.lat)) * cos(radians(f.latitude::float8))
                    * power(sin(radians(f.longitude::float8 - me.lon) / 2), 2)
                )))
         END AS distance_km
  FROM me
  JOIN facilities f
    ON f.state_code = me.state_code
   AND f.publishable
   AND f.city_slug = ANY (p_city_slugs)
   AND f.id <> me.id
  WHERE EXISTS (SELECT 1 FROM inspections i WHERE i.facility_id = f.id)
    AND NOT (
      f.state_code = 'AZ'
      AND f.beds IS NOT NULL
      AND f.beds <= 10
      AND NOT EXISTS (
        SELECT 1
        FROM inspections i
        JOIN deficiencies d ON d.inspection_id = i.id
        WHERE i.facility_id = f.id
      )
    )
  ORDER BY distance_km ASC NULLS LAST, f.name ASC
  LIMIT greatest(1, least(coalesce(p_limit, 12), 24))
$function$;
