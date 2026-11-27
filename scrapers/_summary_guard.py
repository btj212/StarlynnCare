"""Deterministic gates on generated inspection summaries.

A summary that says the visit was clean is refused when the inspection
already has deficiency rows or the source text cites a rule. This is not
WA-only: the same lie shows up in every state file.
"""

from __future__ import annotations

import re

# Claims the visit found nothing / was in compliance / findings were unknown.
# Does not match "No citation text was included" (missing source) or a quoted
# requirement that the home "must operate in compliance with" local law.
CLEAN_VISIT_CLAIM_RE = re.compile(
    r"(?:"
    r"\bno deficiencies\b"
    r"|\bno deficiency\b"
    r"|\bno citations?(?!\s+text)\b"
    r"|\bno violations?\b"
    r"|\bno findings\b"
    r"|found no (?:deficienc(?:y|ies)|citations?|violations?)"
    r"|did not (?:cite|find|identify) (?:any )?(?:deficienc|citation|violation)"
    r"|none specified"
    r"|does not specify whether"
    r"|report does not specify"
    r"|the file does not describe"
    r"|met all requirements"
    r"|found to be in compliance"
    r"|(?:facility|home|visit|inspection)\s+(?:was\s+)?(?:found\s+)?(?:to be\s+)?in compliance"
    r")",
    re.I,
)

SOURCE_CITATION_RE = re.compile(
    r"(?:"
    r"\bWAC\s+\d"
    r"|\b(?:\d+\s+)?CCR\s+"
    r"|\bCFR\s+"
    r"|\bF-\d{3,4}\b"
    r"|\bTitle\s+22\b"
    r"|\bfailed to\b"
    r"|\bdeficiency cited\b"
    r"|\bcited (?:for|under|on)\b"
    r")",
    re.I,
)

# SQL net for the read-only audit. Wider than CLEAN_VISIT_CLAIM_RE; Python
# re-filters so Oregon "must operate in compliance with" quotes drop out.
AUDIT_SQL = """
SELECT
  f.state_code,
  f.license_number,
  f.name,
  i.id AS inspection_id,
  i.inspection_date,
  COALESCE(i.total_deficiency_count, 0) AS total_deficiency_count,
  (SELECT count(*)::int FROM deficiencies d WHERE d.inspection_id = i.id) AS deficiency_rows,
  left(i.narrative_summary, 240) AS summary_head
FROM inspections i
JOIN facilities f ON f.id = i.facility_id
WHERE i.narrative_summary IS NOT NULL
  AND length(btrim(i.narrative_summary)) > 0
  AND i.narrative_summary ~* %(claim)s
  AND i.narrative_summary !~* 'no citation text'
  AND (
    COALESCE(i.total_deficiency_count, 0) > 0
    OR EXISTS (SELECT 1 FROM deficiencies d WHERE d.inspection_id = i.id)
  )
ORDER BY f.state_code, i.inspection_date DESC NULLS LAST
"""

# POSIX regex for Postgres (~*). Lookaheads are not available; the Python
# filter drops "No citation text was included" and quoted "in compliance" rules.
AUDIT_CLAIM_PATTERN = (
    r"(no deficiencies|no deficiency|no citations?|no violations?"
    r"|found no (deficienc|citation|violation)"
    r"|none specified|does not specify whether"
    r"|found to be in compliance|met all requirements)"
)


def claims_clean_visit(summary: str | None) -> bool:
    if not summary or not summary.strip():
        return False
    return CLEAN_VISIT_CLAIM_RE.search(summary) is not None


def source_cites_deficiency(source_text: str | None) -> bool:
    if not source_text or not source_text.strip():
        return False
    return SOURCE_CITATION_RE.search(source_text) is not None


def has_recorded_deficiencies(deficiency_count: int) -> bool:
    return deficiency_count > 0


def reject_false_clean_visit(
    summary: str | None,
    *,
    deficiency_count: int,
    source_text: str | None = None,
) -> bool:
    """True when a clean-visit claim contradicts the file or the source text."""
    if not claims_clean_visit(summary):
        return False
    if has_recorded_deficiencies(deficiency_count):
        return True
    return source_cites_deficiency(source_text)
