"""Pure parsing for the Missouri DHSS inspection workbook.

The workbook has one row per cited tag. Several EVENT_ID values can share a
facility, a date, and a survey type. Those are different visits. Collapsing
them hides a visit and the citations that belong to it.
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime
from typing import Any

ZERO_DEF_TAGS = frozenset({"000L", "00FM", "00IC", "00LC", "000I"})

REASON_MISSING_EVENT = "missing_event_id"
REASON_MISSING_FACILITY = "missing_facility_id"
REASON_UNDATED = "undated"
REASON_CONFLICTING_DATES = "conflicting_dates"
REASON_CONFLICTING_TYPES = "conflicting_types"
REASON_CONFLICTING_FACILITIES = "conflicting_facilities"
REASON_UNMATCHED = "unmatched_facility"
REASON_ZERO_DEF = "zero_deficiency_marker"

_SEV4_RE = re.compile(
    r"\b(abuse|neglect|exploit|elopement|medication\s+error|evacuation"
    r"|immediate\s+jeopardy|ij\b|assault|mistreat)\b",
    re.IGNORECASE,
)

_INSP_TYPE_MAP = {
    "STATE LICENSURE": "routine",
    "INITIAL LICENSURE": "licensure",
    "COMPLAINT INVESTIGATION": "complaint",
    "FOLLOWUP/REVISIT": "revisit",
    "FOLLOWUP/REVISIT, STATE LICENSURE": "revisit",
    "INITIAL LICENSURE, STATE LICENSURE": "licensure",
}


def strip_facility_suffix(facility_id: str | None) -> str | None:
    """'27367N' is the workbook id. '27367' is the directory facility number."""
    if not facility_id:
        return None
    return re.sub(r"[A-Za-z]+$", "", str(facility_id).strip()) or None


def parse_date(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if text.endswith("Z"):
        text = text[:-1]
    try:
        return datetime.fromisoformat(text).date()
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def map_inspection_type(survey_category: str | None) -> tuple[str, bool]:
    raw = (survey_category or "").strip().upper()
    is_complaint = "COMPLAINT INVESTIGATION" in raw
    for key, inspection_type in _INSP_TYPE_MAP.items():
        if key in raw:
            return inspection_type, is_complaint
    return "routine", is_complaint


def map_severity(description: str | None) -> tuple[int, bool]:
    """Severity 4 is immediate jeopardy or a high-harm phrase in the text.

    The survey type does not raise severity by itself. A paperwork tag found
    during a complaint visit is not immediate jeopardy.
    """
    text = description or ""
    immediate = bool(re.search(r"\bimmediate\s+jeopardy\b|\bIJ\b", text, re.IGNORECASE))
    if immediate:
        return 4, True
    if _SEV4_RE.search(text):
        return 4, False
    return 2, False


def jsonable(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def source_row(row_number: int, row: dict[str, Any]) -> dict[str, Any]:
    event_id = str(row.get("EVENT_ID") or "").strip()
    facility_raw = str(row.get("FACILITY_ID") or "").strip()
    tag = str(row.get("TAG") or "").strip().upper()
    event_date = parse_date(row.get("EVENT_DATE"))
    reason = None
    if not event_id:
        reason = REASON_MISSING_EVENT
    elif not facility_raw or not strip_facility_suffix(facility_raw):
        reason = REASON_MISSING_FACILITY
    elif event_date is None:
        reason = REASON_UNDATED
    elif tag in ZERO_DEF_TAGS:
        reason = REASON_ZERO_DEF
    return {
        "source_key": f"row-{row_number}",
        "row_number": row_number,
        "event_id": event_id or None,
        "event_date": event_date,
        "survey_category": str(row.get("SURVEY_CATEGORY") or "").strip(),
        "facility_id_raw": facility_raw,
        "facility_name": str(row.get("NAME") or "").strip(),
        "facility_type": str(row.get("FACILITY_TYPE") or "").strip(),
        "tag": tag,
        "description": str(row.get("DESCRIPTION") or "").strip() or None,
        "facility_external_id": strip_facility_suffix(facility_raw),
        "disposition": "quarantined" if reason and reason != REASON_ZERO_DEF else "normalized",
        "reason": reason,
        "raw": {str(key): jsonable(val) for key, val in row.items()},
    }


def assemble(rows: list[tuple[int, dict[str, Any]]]) -> dict[str, Any]:
    """Group tag rows into one event per EVENT_ID.

    Returns events that are safe to insert and ledger rows for every source
    row. A malformed event quarantines all of its rows and is not inserted.
    """
    ledger = [source_row(number, row) for number, row in rows]
    by_event: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in ledger:
        if item["event_id"] and item["reason"] not in {
            REASON_MISSING_EVENT,
            REASON_MISSING_FACILITY,
            REASON_UNDATED,
        }:
            by_event[item["event_id"]].append(item)

    events: list[dict[str, Any]] = []
    for event_id, items in by_event.items():
        dates = {entry["event_date"] for entry in items}
        categories = {entry["survey_category"] for entry in items}
        facilities = {entry["facility_external_id"] for entry in items}
        reason = None
        if None in dates or len(dates) != 1:
            reason = REASON_UNDATED if dates == {None} else REASON_CONFLICTING_DATES
        elif len(categories) != 1:
            reason = REASON_CONFLICTING_TYPES
        elif len(facilities) != 1:
            reason = REASON_CONFLICTING_FACILITIES
        if reason:
            for item in items:
                item["disposition"] = "quarantined"
                item["reason"] = reason
            continue

        survey_category = next(iter(categories))
        inspection_type, is_complaint = map_inspection_type(survey_category)
        deficiencies = []
        for entry in items:
            tag = entry["tag"]
            if not tag or tag in ZERO_DEF_TAGS:
                continue
            deficiencies.append({
                "tag": tag,
                "description": entry["description"],
            })
        first = items[0]
        events.append({
            "event_id": event_id,
            "facility_id_raw": first["facility_id_raw"],
            "facility_number": next(iter(facilities)),
            "facility_name": first["facility_name"],
            "event_date": next(iter(dates)),
            "survey_category": survey_category,
            "facility_type": first["facility_type"],
            "inspection_type": inspection_type,
            "is_complaint": is_complaint,
            "deficiencies": deficiencies,
        })

    return {"events": events, "ledger": ledger}
