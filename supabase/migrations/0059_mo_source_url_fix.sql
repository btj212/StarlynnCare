-- Migration: 0059_mo_source_url_fix.sql
--
-- Fixes broken "View official DHSS report" links on Missouri facility profiles.
--
-- Bug: mo_inspections_ingest.py::_source_url() fabricated a per-inspection URL
--      (https://health.mo.gov/seniors/ltcregulation/inspection/<fac>/<event>)
--      that does not exist — every such link returns HTTP 404. The FOIA Excel
--      the ingest reads has no public deep-link key, so the URL was invented.
--
-- Fix: null out the fabricated URLs now so the profile stops rendering 404
--      links. The real, working deep link (ShowMeLTC
--      inspection_detail.aspx?insid=<insid>) is discovered per inspection by
--      scrapers/mo_sod_ingest.py during its crawl and written to
--      inspections.source_url in its `load` step — but only for inspections
--      that actually have a Statement of Deficiencies on file. The source
--      script is patched in the same change so future ingests emit NULL.
--
-- Scoped to MO only. Additive correction; no rows deleted.
-- The profile UI hides the per-inspection link when source_url IS NULL, and the
-- section-level "View DHSS inspection portal" link now points at the working
-- ShowMeLTC portal (moProfileConfig.regulatorPortalUrl, fixed in the same change).

UPDATE inspections i
   SET source_url = NULL
  FROM facilities f
 WHERE f.id = i.facility_id
   AND f.state_code = 'MO'
   AND i.source_url LIKE 'https://health.mo.gov/seniors/ltcregulation/inspection/%';
