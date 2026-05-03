-- ca_memory_care_designation_basis: structured editorial-policy field
-- recording the CA regulatory or signal basis for the memory-care classification.
--
-- Values
-- -------
--   self_identified           — facility name or operator explicitly markets as MC
--   dementia_training_compliance — cited/confirmed under §87705 or §87706 (CDSS
--                                  dementia-training or dementia-advertising regs)
--   secured_perimeter         — secured/locked unit confirmed via deficiency keyword scan
--   hospice_waiver            — facility operates under CA hospice-waiver pathway
--   multiple                  — two or more of the above bases apply
--
-- NULL means the signal exists (serves_memory_care / memory_care_disclosure_filed)
-- but the basis has not yet been resolved (e.g. chain-name match only, or needs review).
--
-- Backfill logic at the bottom of this file derives the value from existing signal
-- columns for facilities already in the table.

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS ca_memory_care_designation_basis text
    CHECK (ca_memory_care_designation_basis IN (
      'self_identified',
      'dementia_training_compliance',
      'secured_perimeter',
      'hospice_waiver',
      'multiple'
    ));

COMMENT ON COLUMN facilities.ca_memory_care_designation_basis IS
  'CA-specific: the regulatory or signal basis for the memory-care classification. '
  'Values: self_identified | dementia_training_compliance | secured_perimeter | '
  'hospice_waiver | multiple. NULL = basis not yet resolved.';

-- ── Backfill: derive from existing signal columns ────────────────────────────
-- Priority: if 2+ signals → "multiple"; else pick the strongest single basis.
-- mc_signal_explicit_name  → self_identified
-- memory_care_disclosure_filed (via §87705/§87706 citation) → dementia_training_compliance
-- mc_signal_deficiency_keyword where source contains 'secured' → secured_perimeter

UPDATE facilities
SET ca_memory_care_designation_basis = (
  CASE
    -- 2+ signals → multiple
    WHEN (
      (mc_signal_explicit_name::int)
      + (memory_care_disclosure_filed::int)
      + (CASE WHEN mc_signal_deficiency_keyword
                   AND mc_signal_deficiency_keyword_source ILIKE '%secured%'
              THEN 1 ELSE 0 END)
    ) >= 2 THEN 'multiple'

    -- §87705/§87706 citation confirmed
    WHEN memory_care_disclosure_filed THEN 'dementia_training_compliance'

    -- Explicit name match (not just chain)
    WHEN mc_signal_explicit_name THEN 'self_identified'

    -- Secured perimeter keyword in deficiency scan
    WHEN mc_signal_deficiency_keyword
         AND mc_signal_deficiency_keyword_source ILIKE '%secured%'
    THEN 'secured_perimeter'

    -- Remaining: chain-name only or chain-curated → leave NULL (basis unresolved)
    ELSE NULL
  END
)
WHERE serves_memory_care = true
  AND ca_memory_care_designation_basis IS NULL;
