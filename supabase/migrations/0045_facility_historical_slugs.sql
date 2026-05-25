-- Migration 0045: physical-city slug rewrite support
--
-- Adds a historical_city_slugs text[] column to facilities so that when
-- scrapers/recompute_physical_city.py rewrites city + city_slug to the
-- Census Geocoder's physical Place, every prior slug is preserved here.
-- The application layer uses this array to 301 old URLs (e.g.
-- /utah/salt-lake-city/monument-…) to the canonical new URL
-- (/utah/taylorsville/monument-…) via permanentRedirect in loadFacilityProfile.
--
-- GIN index is required because the query uses the @> or ANY() operator
-- against the array, which would be a full-scan without it.

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS historical_city_slugs text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS facilities_historical_city_slugs_gin
  ON facilities USING gin (historical_city_slugs);
