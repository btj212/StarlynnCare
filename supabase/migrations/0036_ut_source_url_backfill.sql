-- Fix broken source_url on Utah UT-CCL inspections.
--
-- The original scraper set source_url to:
--   https://provider.dlbc.utah.gov/ccl/facilities/{ccl_id}
-- That host does not resolve publicly. The working CCL portal URL is:
--   https://ccl.utah.gov/facility/{ccl_id}
--
-- The numeric CCL id is the final path segment in the old URL, so we can
-- extract it with a regex replace and rebuild the correct URL.

UPDATE inspections
SET source_url = regexp_replace(
    source_url,
    '^https://provider\.dlbc\.utah\.gov/ccl/facilities/(\d+)$',
    'https://ccl.utah.gov/facility/\1'
)
WHERE source_agency = 'UT-CCL'
  AND source_url LIKE 'https://provider.dlbc.utah.gov/%';
