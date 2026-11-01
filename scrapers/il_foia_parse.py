"""Pure parsing for the Illinois IDPH FOIA visit workbook.

Column "Name" is the visit id for that row. It is not the facility's license
number. Two rows can name the same building and the same day. They stay two
visits. A facility is matched later by its physical name, and only to a
building already in the directory.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

REASON_MISSING_VISIT = "missing_visit_id"
REASON_MISSING_NAME = "missing_facility_name"
REASON_UNDATED = "undated"
REASON_UNMATCHED = "unmatched_facility"
REASON_AMBIGUOUS = "ambiguous_facility_name"

_TYPE_PRIORITY: dict[str, int] = {
    "FRI": 1,
    "desk_audit": 2,
    "initial": 3,
    "follow-up": 4,
    "focused": 5,
    "special": 6,
    "COI": 7,
}

_TYPE_MAP: dict[str, tuple[str, bool]] = {
    "COI": ("complaint", True),
    "FRI": ("facility_reported_incident", False),
    "L/IN": ("initial", False),
    "L/P1": ("initial", False),
    "L/SP": ("special", False),
    "L/desk": ("desk_audit", False),
    "FIC": ("focused", False),
    "C/F1": ("follow-up", False),
    "M/F1": ("follow-up", False),
    "24HR": ("complaint", True),
    "30D": ("complaint", True),
    "7D": ("complaint", True),
}

_SUBTYPE_KEY_RE = re.compile(
    r"(?:24HR|30D|7D)?\s*(COI|FRI|L/IN|L/P1|L/SP|L/desk|FIC|C/F1|M/F1)",
    re.IGNORECASE,
)

_CITATION_RE = re.compile(
    r"(?P<repeat>(?:repeat)\s+)?"
    r"(?P<code>295\.\d{4}(?:\s*[a-zA-Z0-9() -]*)?)?"
    r"(?:,\s*(?P<sev>T[123]|GV))?"
    r"(?:[,\s]*\$?(?P<fine>[\d,]+[kK]?))?"
    r"(?:\s*\*{0,2}(?P<note>[A-Z][A-Z ]+)\*{0,2})?",
    re.IGNORECASE,
)
_FINE_RE = re.compile(r"^[\$,\s]*(?P<num>\d[\d,]*)(?P<k>[kK])?$")
_SEVERITY_MAP: dict[str, tuple[int, str]] = {
    "T1": (3, "Type 1"),
    "T2": (2, "Type 2"),
    "T3": (1, "Type 3"),
    "GV": (1, "General Violation"),
}
_NO_VIOLATION_PATTERNS = re.compile(
    r"\bno\s+violations?\b|\bnone\b|^none$|^no violation|no\s+violation\s+found",
    re.IGNORECASE,
)
_REMOVED_SOD_RE = re.compile(r"removed\s+per\s+sod", re.IGNORECASE)


def normalize_facility_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()


def visit_id_from_cell(value: Any) -> str | None:
    """The workbook's Name cell. Eight digits, zero padded. Not a license."""
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value).strip())
    if not digits:
        return None
    return digits.zfill(8)


def parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _parse_fine(raw: str) -> float | None:
    if not raw:
        return None
    match = _FINE_RE.match(raw.strip())
    if not match:
        return None
    amount = float(match.group("num").replace(",", ""))
    if match.group("k"):
        amount *= 1000
    return amount


def _split_citation_lines(raw: str) -> list[str]:
    if not raw:
        return []
    text = str(raw).replace("_x000D_", "\n").replace("\r", "\n")
    return [line.strip() for line in text.splitlines() if line.strip()]


def _parse_citation_line(line: str, visit_id: str, line_index: int) -> dict[str, Any] | None:
    if _NO_VIOLATION_PATTERNS.search(line):
        return None
    removed = bool(_REMOVED_SOD_RE.search(line))
    if removed and not re.search(r"295\.", line):
        return {
            "code": f"IL-{visit_id}-{line_index}",
            "state_severity_raw": None,
            "severity": None,
            "is_repeat": False,
            "civil_money_penalty": None,
            "status": "removed_per_sod",
            "raw_line": line,
        }

    match = _CITATION_RE.match(line)
    if not match or not match.group("code"):
        return {
            "code": f"IL-{visit_id}-{line_index}",
            "state_severity_raw": None,
            "severity": None,
            "is_repeat": False,
            "civil_money_penalty": None,
            "status": "open",
            "raw_line": line,
        }

    raw_code = re.sub(r"\s+", " ", (match.group("code") or "").strip().rstrip(","))
    raw_code = re.sub(r"\s+(?:T[123]|GV)\s*$", "", raw_code, flags=re.IGNORECASE).strip()
    had_inline_repeat = bool(re.search(r"\brepeat\b\s*$", raw_code, re.IGNORECASE))
    raw_code = re.sub(r"\s+repeat\s*$", "", raw_code, flags=re.IGNORECASE).strip()

    severity_token = (match.group("sev") or "").upper().strip()
    if not severity_token:
        anywhere = re.search(r"\b(T[123]|GV)\b", line, re.IGNORECASE)
        if anywhere:
            severity_token = anywhere.group(1).upper()
    severity, severity_raw = _SEVERITY_MAP.get(severity_token, (None, None))
    is_repeat = bool(match.group("repeat")) or had_inline_repeat
    if not is_repeat and re.search(r"\brepeat\b", line, re.IGNORECASE):
        is_repeat = True
    fine = _parse_fine(match.group("fine") or "")
    if fine is None:
        anywhere_fine = re.search(r"\$\s*(\d[\d,]*[kK]?)", line, re.IGNORECASE)
        if anywhere_fine:
            fine = _parse_fine(anywhere_fine.group(1))
    note = (match.group("note") or "").strip()
    status = "removed_per_sod" if removed or "REMOVED PER SOD" in note.upper() else "open"
    if status == "removed_per_sod":
        severity = None
        severity_raw = None
    return {
        "code": raw_code[:200] if raw_code else f"IL-{visit_id}-{line_index}",
        "state_severity_raw": severity_raw,
        "severity": severity,
        "is_repeat": is_repeat,
        "civil_money_penalty": fine,
        "status": status,
        "raw_line": line,
    }


def parse_citations(raw: str, visit_id: str) -> list[dict[str, Any]] | None:
    """None means the cell says there was no violation. A list is the citations."""
    lines = _split_citation_lines(raw)
    if not lines:
        return []
    parsed: list[dict[str, Any]] = []
    for index, line in enumerate(lines, start=1):
        item = _parse_citation_line(line, visit_id, index)
        if item is None:
            return None
        parsed.append(item)
    return parsed


def _subtype_token(token: str) -> str | None:
    for key in _TYPE_MAP:
        if key.lower() in token.lower():
            return key
    match = _SUBTYPE_KEY_RE.search(token)
    return match.group(1).upper() if match else None


def parse_survey_subtype(raw: str) -> tuple[str, bool, str]:
    tokens = [token.strip() for token in raw.split(";") if token.strip()]
    if not tokens:
        return "inspection", False, "UNK"
    best_key: str | None = None
    best_priority = -1
    is_complaint = False
    for token in tokens:
        key = _subtype_token(token)
        if key is None:
            continue
        _inspection_type, complaint = _TYPE_MAP.get(key, ("inspection", False))
        is_complaint = is_complaint or complaint
        priority = _TYPE_PRIORITY.get(key, 0)
        if priority > best_priority:
            best_priority = priority
            best_key = key
    if best_key is None:
        return "inspection", is_complaint, "UNK"
    inspection_type, complaint = _TYPE_MAP.get(best_key, ("inspection", False))
    return inspection_type, is_complaint or complaint, best_key


def parse_visit_row(row: tuple[Any, ...], row_number: int) -> dict[str, Any]:
    facility_name = str(row[0]).strip() if row[0] is not None else ""
    visit_id = visit_id_from_cell(row[1] if len(row) > 1 else None)
    subtype = str(row[2]).strip() if len(row) > 2 and row[2] is not None else ""
    inspection_date = parse_date(row[3] if len(row) > 3 else None)
    tags = str(row[4]).strip() if len(row) > 4 and row[4] is not None else ""
    fine_cell = row[5] if len(row) > 5 else None
    reason = None
    if not visit_id:
        reason = REASON_MISSING_VISIT
    elif not facility_name:
        reason = REASON_MISSING_NAME
    elif inspection_date is None:
        reason = REASON_UNDATED
    inspection_type, is_complaint, _key = parse_survey_subtype(subtype)
    citations = parse_citations(tags, visit_id or f"row-{row_number}")
    fine_total = None
    if fine_cell is not None:
        try:
            fine_total = float(fine_cell)
        except (TypeError, ValueError):
            fine_total = None
    return {
        "source_key": f"row-{row_number}",
        "row_number": row_number,
        "facility_name": facility_name,
        "normalized_name": normalize_facility_name(facility_name) if facility_name else "",
        "source_event_id": visit_id,
        "license_number": None,
        "survey_subtype": subtype,
        "inspection_date": inspection_date,
        "inspection_type": inspection_type,
        "is_complaint": is_complaint,
        "citations": citations,
        "civil_penalty_total": fine_total,
        "disposition": "quarantined" if reason else "normalized",
        "reason": reason,
        "raw": {
            "facility_name": facility_name,
            "visit_id": visit_id,
            "survey_subtype": subtype,
            "survey_exit_date": inspection_date.isoformat() if inspection_date else None,
            "tags": tags,
            "fine_amount": fine_cell if isinstance(fine_cell, (int, float, str, type(None))) else str(fine_cell),
        },
    }


def pair_visits(
    visits: list[dict[str, Any]],
    stored: list[dict[str, Any]],
) -> tuple[list[tuple[str, str]], list[dict[str, Any]]]:
    """Attach at most one workbook visit to a stored row that has no event id.

    The stored row is one of the same-day visits, not a merged record. The
    lowest visit id keeps it so a second run makes the same choice. Every
    other visit is inserted on its own event id.
    """
    stored_ids = {row["source_event_id"] for row in stored if row.get("source_event_id")}
    pending = [visit for visit in visits if visit["source_event_id"] not in stored_ids]
    open_rows = [row for row in stored if not row.get("source_event_id")]
    claims: list[tuple[str, str]] = []
    claimed_visits: set[str] = set()
    used_rows: set[str] = set()

    for row in open_rows:
        matches = [
            visit for visit in pending
            if visit["inspection_date"] == row["inspection_date"]
            and visit["inspection_type"] == row["inspection_type"]
            and (
                not row.get("survey_subtype")
                or row["survey_subtype"] == visit["survey_subtype"]
            )
        ]
        if not matches:
            continue
        winner = min(matches, key=lambda visit: visit["source_event_id"])
        claims.append((row["id"], winner["source_event_id"]))
        claimed_visits.add(winner["source_event_id"])
        used_rows.add(row["id"])

    inserts = [
        visit for visit in pending
        if visit["source_event_id"] not in claimed_visits
    ]
    return claims, inserts
