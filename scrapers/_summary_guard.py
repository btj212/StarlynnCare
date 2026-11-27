"""Deterministic gates on generated inspection summaries.

A row is a real citation only when `is_real_citation` says so. Oregon
tags ending in 0000 are initial comments. Washington "WA DSHS report:"
text and `__wa_` tags are not citations. The summarizer, the post-check,
and the mismatch script all use this helper.
"""

from __future__ import annotations

import json
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

# SQL net for the read-only audit. Wider than the Python gate. The script
# re-filters with citation_mismatch so Oregon 0000 tags and Washington
# placeholders are not counted as citations.
AUDIT_SQL = """
SELECT
  f.state_code,
  f.license_number,
  f.name,
  i.id AS inspection_id,
  i.inspection_date,
  COALESCE(i.total_deficiency_count, 0) AS total_deficiency_count,
  COALESCE(
    (
      SELECT json_agg(json_build_object(
        'code', d.code,
        'description', d.description,
        'inspector_narrative', d.inspector_narrative
      ))
      FROM deficiencies d
      WHERE d.inspection_id = i.id
    ),
    '[]'::json
  ) AS deficiency_rows,
  left(i.narrative_summary, 240) AS summary_head
FROM inspections i
JOIN facilities f ON f.id = i.facility_id
WHERE i.narrative_summary IS NOT NULL
  AND length(btrim(i.narrative_summary)) > 0
  AND (
    i.narrative_summary ~* %(claim)s
    OR i.narrative_summary ~* 'deficienc|citation'
  )
  AND i.narrative_summary !~* 'no citation text'
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


def row_tag(row: dict) -> str:
    raw = row.get("code")
    if raw is None:
        raw = row.get("tag")
    return str(raw or "").strip()


def row_text(row: dict) -> str:
    """Citation text: description, then the inspector's narrative."""
    for key in ("description", "inspector_narrative", "text"):
        value = row.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _row_text_fields(row: dict) -> list[str]:
    found: list[str] = []
    for key in ("description", "inspector_narrative", "text"):
        value = row.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            found.append(text)
    return found


def is_real_citation(row: dict, state: str) -> bool:
    """True when this deficiency row is a cited deficiency for `state`.

    Not a citation when any of these holds:
    1. Oregon, and the tag ends in 0000 (C0000, Z0000, any prefix).
    2. Washington, and the text starts with "WA DSHS report:".
    3. Washington, and the tag starts with "__wa_".
    4. The tag and the text are both blank.
    Every other row is a citation. Other states only use rule 4.
    """
    state_code = (state or "").strip().upper()
    tag = row_tag(row)
    texts = _row_text_fields(row)
    if not tag and not texts:
        return False
    if state_code == "OR" and tag.upper().endswith("0000"):
        return False
    if state_code == "WA":
        for text in texts:
            if text.upper().startswith("WA DSHS REPORT:"):
                return False
        # TODO: __wa_<hash> tags are written when a Washington row has no
        # regulator code (PDF-link stubs and parsed rows that arrived
        # without a WAC). We do not yet know whether any of them are real
        # citations, so they are excluded from counts and are not given a
        # number in the summary.
        if tag.lower().startswith("__wa_"):
            return False
    return True


def real_citations(rows: list[dict] | None, state: str) -> list[dict]:
    """Real citations, with duplicate tag+text rows removed."""
    seen: set[tuple[str, str]] = set()
    kept: list[dict] = []
    for row in rows or []:
        if not is_real_citation(row, state):
            continue
        key = (row_tag(row).casefold(), row_text(row).casefold())
        if key in seen:
            continue
        seen.add(key)
        kept.append(row)
    return kept


def real_citation_count(rows: list[dict] | None, state: str) -> int:
    return len(real_citations(rows, state))


def or_general_comments(rows: list[dict] | None) -> list[dict]:
    """Oregon 0000 tags. Background only; they are not citations."""
    comments: list[dict] = []
    for row in rows or []:
        tag = row_tag(row)
        if tag.upper().endswith("0000") and row_text(row):
            comments.append(row)
    return comments


AUTHORITATIVE_COUNT = (
    "State exactly {n} deficiencies, or say no deficiencies were cited if {n} is 0; "
    "do not count rows yourself."
)


def citation_prompt_parts(rows: list[dict] | None, state: str) -> tuple[int, str, str]:
    """real_count, citation block for the prompt, and the count instruction."""
    counted = real_citations(rows, state)
    lines = ["Citations:"]
    if not counted:
        lines.append("(none)")
    else:
        for row in counted:
            tag = row_tag(row) or "—"
            text = row_text(row)
            lines.append(f"- {tag}: {text}" if text else f"- {tag}")
    if (state or "").strip().upper() == "OR":
        comments = or_general_comments(rows)
        if comments:
            lines.append("")
            lines.append("Inspector's general comments, not a citation:")
            for row in comments:
                lines.append(f"- {row_tag(row)}: {row_text(row)}")
    n = len(counted)
    return n, "\n".join(lines), AUTHORITATIVE_COUNT.format(n=n)


_COUNT_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
}

_STATED_COUNT_RE = re.compile(
    r"\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|"
    r"eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|"
    r"eighteen|nineteen|twenty)\s+(?:deficienc|citation)",
    re.I,
)

# A count of zero still has to reject "a deficiency was cited" and
# "deficiencies were cited" when those phrases are not a "no deficiencies"
# claim. Numbered phrases are handled by _STATED_COUNT_RE.
_UNNUMBERED_POSITIVE_RE = re.compile(
    r"\b(?:a|an)\s+(?:deficienc|citation)"
    r"|\b(?:deficienc(?:y|ies)|citations?)\s+(?:was|were)\s+cited\b",
    re.I,
)


def stated_deficiency_counts(summary: str | None) -> list[int]:
    """Numbers the summary states as a deficiency or citation count."""
    if not summary:
        return []
    found: list[int] = []
    for match in _STATED_COUNT_RE.finditer(summary):
        token = match.group(1).lower()
        found.append(int(token) if token.isdigit() else _COUNT_WORDS[token])
    return found


def summary_rejected_for_count(summary: str | None, real_count: int) -> bool:
    """True when this summary must not replace the stored text.

    real_count > 0 rejects a "no deficiencies" claim.
    real_count == 0 rejects a claim of one or more deficiencies or citations.
    Any stated deficiency/citation count that is not real_count is rejected.
    """
    if not summary or not summary.strip():
        return False
    if real_count > 0 and claims_clean_visit(summary):
        return True
    stated = stated_deficiency_counts(summary)
    if any(number != real_count for number in stated):
        return True
    if (
        real_count == 0
        and not claims_clean_visit(summary)
        and _UNNUMBERED_POSITIVE_RE.search(summary)
    ):
        return True
    return False


def citation_mismatch(summary: str | None, rows: list[dict] | None, state: str) -> bool:
    """True when the summary disagrees with the real citation count."""
    return summary_rejected_for_count(summary, real_citation_count(rows, state))


def coerce_deficiency_rows(value: object) -> list[dict]:
    if value is None:
        return []
    if isinstance(value, str):
        parsed = json.loads(value)
        return list(parsed or [])
    if isinstance(value, list):
        return value
    return []


def reject_false_clean_visit(
    summary: str | None,
    *,
    deficiency_count: int,
    source_text: str | None = None,
) -> bool:
    """True when the summary's deficiency claim disagrees with real_count.

    `deficiency_count` is the real citation count. `source_text` is ignored:
    a clean visit (count 0) is allowed to say no deficiencies were cited.
    """
    del source_text
    return summary_rejected_for_count(summary, deficiency_count)
