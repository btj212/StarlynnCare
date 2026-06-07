-- Texas / multi-state scaffold — nullable until HHSC ingest lands.
-- Severity verbatim preserves regulator wording across CA vs TX deficiency taxonomies.

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS tx_license_class text,
  ADD COLUMN IF NOT EXISTS tx_alzheimer_certified boolean;

ALTER TABLE deficiencies
  ADD COLUMN IF NOT EXISTS state_severity_raw text;

COMMENT ON COLUMN facilities.tx_license_class IS 'TX ALF class when applicable (Type A/B/C); HHSC licensing.';
COMMENT ON COLUMN facilities.tx_alzheimer_certified IS 'True when Alzheimer Certification is on file per HHSC roster.';
COMMENT ON COLUMN deficiencies.state_severity_raw IS 'Verbatim severity label from the source regulator (e.g. CA Type A, TX category).';
