-- 0038_ut_source_url_null.sql
--
-- UT-CCL inspections previously stored source_url = 'https://ccl.utah.gov/facility/{id}'
-- which is a staff-only portal requiring login. Families get a "page doesn't exist"
-- error when they click it.
--
-- source_url is NOT NULL so we set it to '' (empty string). The frontend already
-- gates on `insp.source_url && (...)` so an empty string hides the link.

UPDATE inspections
SET source_url = ''
WHERE source_agency = 'UT-CCL';
