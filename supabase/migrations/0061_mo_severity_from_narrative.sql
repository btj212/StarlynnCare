-- Migration: 0061_mo_severity_from_narrative.sql
--
-- Re-derives Missouri deficiency severity now that real inspector narratives
-- have landed (scrapers/mo_sod_ingest.py OCR pipeline, 3,833 of 11,820 MO
-- deficiencies as of 2026-07-09).
--
-- Context: migration 0058 fixed a severity-inflation bug by re-deriving
-- severity from an abuse/neglect-class keyword match against
-- deficiencies.description. At the time, `description` (the cited
-- regulation's boilerplate rule text) was the only text we had — the FOIA
-- Excel ingest never carried the inspector's actual finding, so a citation's
-- real facts (e.g. "resident was assaulted by staff") were invisible to the
-- keyword match. Severity 4 could only fire when the *rule text itself*
-- happened to name a high-harm concept (rare), so most genuine high-harm
-- findings under a lower-harm-sounding rule were under-classified.
--
-- Fix: re-run the identical keyword set against
-- COALESCE(inspector_narrative, description) — the narrative, when present,
-- carries the actual finding and takes priority; rows with no narrative yet
-- fall back to description exactly as 0058 left them (no regression).
--
-- The keyword list mirrors _SEV4_RE / _map_severity in
-- scrapers/mo_inspections_ingest.py; that script is not changed here since
-- it only ever sees `description` at ingest time (narratives are added
-- later by the SOD pipeline) — narrative-aware severity is a load-time
-- concern owned by scrapers/mo_sod_ingest.py's `load` step going forward.
--
-- Scoped to MO only. Additive correction; no rows deleted.
-- facility_snapshot reads severity live; run
-- scrapers/refresh_snapshot_cache.py --state MO after this to update the
-- cached grade/percentile shown on facility cards.

UPDATE deficiencies d
   SET severity = CASE
                    WHEN d.immediate_jeopardy THEN 4
                    WHEN COALESCE(d.inspector_narrative, d.description) ~* '\y(abuse|neglect|exploit|elopement|medication\s+error|evacuation|immediate\s+jeopardy|ij|assault|mistreat)\y' THEN 4
                    ELSE 2
                  END
  FROM inspections i
  JOIN facilities f ON f.id = i.facility_id
 WHERE d.inspection_id = i.id
   AND f.state_code = 'MO';
