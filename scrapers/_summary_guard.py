"""Deterministic gates on generated inspection summaries.

A summary that says the visit was clean is refused when the inspection
already has cited deficiencies or the source text cites a rule. This is
not WA-only: the same lie shows up in every state file.

Row counts are not citation counts. Oregon C0000 / *0000 tags are initial
comments. Washington "WA DSHS report:" rows are PDF-link placeholders.
"""

from __future__ import annotations

import re

# Oregon accordion tags C0000 / V0000 / *0000 are survey cover comments,
# not cited deficiencies. A clean kitchen visit often has only C0000.
OR_INITIAL_COMMENT_RE = re.compile(r"^[A-Z*]0000$", re.I)

# Bundle ingest writes these instead of WAC citations until the PDF is parsed.
WA_PLACEHOLDER_TEXT_RE = re.compile(
    r"^(?:—:\s*)?WA DSHS report:",
    re.I,
)
URL_ONLY_RE = re.compile(r"^https?://", re.I)

# SQL fragment, alias `d`. Keep in lockstep with is_citation_row().
CITATION_ROW_SQL = """
COALESCE(d.code, '') !~* '^[A-Z*]0000$'
AND COALESCE(d.description, '') !~* '^(—:\\s*)?WA DSHS report:'
AND COALESCE(d.inspector_narrative, '') !~* '^(—:\\s*)?WA DSHS report:'
AND COALESCE(d.description, '') !~* '^https?://'
"""

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
# Counts cited deficiencies only (not C0000 / WA placeholders).
AUDIT_SQL = f"""
SELECT
  f.state_code,
  f.license_number,
  f.name,
  i.id AS inspection_id,
  i.inspection_date,
  COALESCE(i.total_deficiency_count, 0) AS total_deficiency_count,
  (SELECT count(*)::int FROM deficiencies d
    WHERE d.inspection_id = i.id
      AND {CITATION_ROW_SQL.strip()}) AS citation_rows,
  left(i.narrative_summary, 240) AS summary_head
FROM inspections i
JOIN facilities f ON f.id = i.facility_id
WHERE i.narrative_summary IS NOT NULL
  AND length(btrim(i.narrative_summary)) > 0
  AND i.narrative_summary ~* %(claim)s
  AND i.narrative_summary !~* 'no citation text'
  AND EXISTS (
    SELECT 1 FROM deficiencies d
    WHERE d.inspection_id = i.id
      AND {CITATION_ROW_SQL.strip()}
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


def is_or_initial_comment(code: str | None) -> bool:
    """True for C0000 / *0000 cover tags. Those are not citations."""
    if not code or not str(code).strip():
        return False
    return OR_INITIAL_COMMENT_RE.match(str(code).strip()) is not None


def is_wa_placeholder_text(text: str | None) -> bool:
    if not text or not str(text).strip():
        return False
    return WA_PLACEHOLDER_TEXT_RE.match(str(text).strip()) is not None


def is_citation_row(
    *,
    code: str | None = None,
    description: str | None = None,
    inspector_narrative: str | None = None,
) -> bool:
    """False for Oregon initial comments and Washington PDF-link stubs."""
    if is_or_initial_comment(code):
        return False
    if is_wa_placeholder_text(description) or is_wa_placeholder_text(inspector_narrative):
        return False
    desc = (description or "").strip()
    if desc and URL_ONLY_RE.match(desc):
        return False
    return True


def count_citation_rows(rows: list[dict[str, str | None]]) -> int:
    return sum(
        1
        for row in rows
        if is_citation_row(
            code=row.get("code"),
            description=row.get("description"),
            inspector_narrative=row.get("inspector_narrative"),
        )
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


def new_run_counters() -> dict[str, int]:
    return {
        "processed": 0,
        "succeeded": 0,
        "failed": 0,
        "skipped_empty": 0,
        "not_written": 0,
    }


def tally_summary_result(
    stats: dict[str, int],
    status: str,
    *,
    wrote: bool = False,
) -> None:
    """Increment run counters. A dict so empty/not-written cannot UnboundLocal."""
    stats["processed"] += 1
    if status == "empty":
        stats["skipped_empty"] += 1
        return
    if status == "dry":
        return
    if status != "ok":
        stats["failed"] += 1
        return
    if not wrote:
        stats["not_written"] += 1
        return
    stats["succeeded"] += 1


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
