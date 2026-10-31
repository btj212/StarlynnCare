#!/usr/bin/env python3
"""Assemble Colorado HFQ complaint and survey rows without touching the database.

CDPHE delivered two workbooks on 2026-05-18. The survey sheet's date column is
blank on a large share of rows. A complaint start date may fill that blank only
when the facility id and event id are the same and the date is not after the
workbook date. Future-dated complaint rows stay quarantined on their own.

Every input row becomes exactly one disposition: normalized or quarantined.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

HFQ_AS_OF = date(2026, 5, 18)
SOURCE_COMPLAINTS = "hfq_complaints"
SOURCE_SURVEYS = "hfq_surveys"
SENTINEL_CODES = frozenset({"0000", "9999"})

REASON_FUTURE = "future_dated"
REASON_UNMATCHED = "unmatched_facility"
REASON_MISSING_EVENT = "missing_event_id"
REASON_MISSING_FACILITY = "missing_facility_id"
REASON_UNDATED = "undated"
REASON_CONFLICTING_DATES = "conflicting_dates"
REASON_CONFLICTING_TYPES = "conflicting_types"
REASON_MISSING_CODE = "missing_citation_code"

_SEVERITY = {"A": 1, "B": 2, "C": 3, "D": 3, "E": 4}
# 6 CCR 1011-1 Chapter 7, Part 3.9. The workbook's numeric Scope column is a
# copy of the letter, not the federal isolated/pattern/widespread scale.
# Level E is immediate jeopardy and does not get a separate scope word.
_LETTER_SCOPE = {"A": "isolated", "B": "pattern", "C": "isolated", "D": "pattern"}
_EMPTY_TEXT = frozenset({"", "NULL", "NONE", "NAN", "NAT"})


def canonical_id(value: Any) -> str:
    """Make a facility or event id comparable across text and Excel numbers.

    Alphanumeric ids keep their leading zeros (`003G11`). Numeric ids do not
    (`007511` and `7511.0` are the same id). A blank or NULL cell is no id.
    """
    if value is None or isinstance(value, bool):
        return ""
    if isinstance(value, float):
        if value != value or not value.is_integer():
            return ""
        return str(int(value))
    if isinstance(value, int):
        return str(value)
    text = str(value).strip()
    if text.upper() in _EMPTY_TEXT:
        return ""
    if text.endswith(".0") and text[:-2].isdigit():
        text = text[:-2]
    if text.isdigit():
        return text.lstrip("0") or "0"
    return text


def normalize_citation_code(value: Any) -> str:
    """Store numeric CDPHE tags at four digits so 610 matches 0610."""
    if value is None or isinstance(value, bool):
        return ""
    if isinstance(value, float):
        if value != value or not value.is_integer():
            return ""
        value = int(value)
    if isinstance(value, int):
        return f"{value:04d}" if value >= 0 else ""
    text = str(value).strip()
    if text.upper() in _EMPTY_TEXT:
        return ""
    if text.endswith(".0") and text[:-2].isdigit():
        text = text[:-2]
    if text.isdigit():
        return text.zfill(4)
    return text


def text_piece(value: Any) -> str:
    """Return narrative text. Numbers and NULL placeholders contribute nothing."""
    if value is None or isinstance(value, (int, float, bool)):
        return ""
    text = str(value).replace("\xa0", " ").replace("&nbsp;", " ")
    if text.strip().upper() in _EMPTY_TEXT:
        return ""
    return text


def join_parts(*values: Any) -> str:
    """Join CDPHE overflow columns with nothing added between the pieces."""
    return "".join(text_piece(value) for value in values).strip()


def parse_date(value: Any) -> date | None:
    """Parse a workbook date. An Excel serial number is not guessed into a date."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float, bool)):
        return None
    text = str(value).strip()
    if text.upper() in _EMPTY_TEXT:
        return None
    if len(text) >= 10:
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            pass
    for fmt in ("%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def scope_from_letter(letter: str | None) -> str | None:
    """Scope for a CDPHE letter. Level E stays blank because the rule does not call it pattern or widespread."""
    if not letter:
        return None
    return _LETTER_SCOPE.get(letter)


def map_severity(value: Any) -> tuple[str | None, int | None, bool]:
    """Map a CDPHE A–E letter. A missing letter is not a default severity."""
    text = text_piece(value).strip().upper()
    if not text:
        return None, None, False
    letter = text[0]
    severity = _SEVERITY.get(letter)
    if severity is None:
        return None, None, False
    return letter, severity, letter == "E"


def format_tag_list(value: Any) -> str:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return normalize_citation_code(value)
    text = text_piece(value)
    if not text:
        return ""
    codes = []
    for piece in text.split(","):
        code = normalize_citation_code(piece.strip())
        if code:
            codes.append(code)
    return ", ".join(codes)


def json_safe(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            return None
        if value.is_integer():
            return int(value)
        return value
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, (str, int, bool)) or value is None:
        return value
    return str(value)


def complaint_from_cells(source_key: str, cells: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_key": source_key,
        "facility_id": cells.get("Facility ID"),
        "event_id": cells.get("Event ID"),
        "facility_name": text_piece(cells.get("Facility Name")).strip(),
        "type_code": text_piece(cells.get("Factype Code")).strip(),
        "start_date": cells.get("Start Date"),
        "exit_date": cells.get("Exit Date"),
        "findings": text_piece(cells.get("Findings")).strip(),
        "allegation": text_piece(cells.get("Allegation Category List")).strip(),
        "tags": format_tag_list(cells.get("Tag List")),
        "complaint_ids": text_piece(cells.get("Complaint ID List")).strip(),
        "raw": json_safe(cells),
    }


def survey_from_cells(source_key: str, cells: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_key": source_key,
        "facility_id": cells.get("Facility ID"),
        "event_id": cells.get("EVENTID"),
        "regset_id": cells.get("REGSETID"),
        "facility_name": text_piece(cells.get("Facility Name")).strip(),
        "type_code": text_piece(cells.get("Facility Type Code")).strip(),
        "citation_code": cells.get("Citation Code"),
        "citation_title": text_piece(cells.get("Citation Title")).strip(),
        "regulation_text": join_parts(
            cells.get("Regulation Text"),
            cells.get("Regulation Text_Overflow1"),
        ),
        "citation_text": join_parts(
            cells.get("Citation Text"),
            cells.get("Citation Text_Overflow1"),
            cells.get("Citation Text_Overflow2"),
            cells.get("Citation Text_Overflow3"),
        ),
        "scope": cells.get("Scope"),
        "severity_letter": cells.get("Ss"),
        "plan_of_correction": join_parts(
            cells.get("Facility Plan of Correction"),
            cells.get("Facility Plan of Correction_Overflow1"),
            cells.get("Facility Plan of Correction_Overflow2"),
        ),
        "inspection_date": cells.get("Inspection Date"),
        "inspection_type": text_piece(cells.get("Inspection Type")).strip(),
        "raw": json_safe(cells),
    }


@dataclass
class Disposition:
    source: str
    source_key: str
    disposition: str
    reason: str | None
    facility_external_id: str
    raw: dict[str, Any]


@dataclass
class DeficiencyRecord:
    citation_code: str
    citation_title: str
    regulation_text: str | None
    inspector_narrative: str | None
    plan_of_correction: str | None
    scope: str | None
    severity: int | None
    severity_letter: str | None
    immediate_jeopardy: bool
    source_key: str


@dataclass
class InspectionRecord:
    facility_id: str
    event_id: str
    regset_id: str
    event_key: str
    inspection_date: date
    date_source: str
    inspection_type_label: str
    is_complaint: bool
    findings: str | None = None
    allegation: str | None = None
    tag_list: str | None = None
    complaint_ids: str | None = None
    inspection_comments: str = ""
    deficiencies: list[DeficiencyRecord] = field(default_factory=list)
    facility_name: str = ""
    type_code: str = ""
    complaint_count: int = 0


@dataclass
class Assembly:
    inspections: list[InspectionRecord]
    dispositions: list[Disposition]

    def quarantines(self) -> list[Disposition]:
        return [row for row in self.dispositions if row.disposition == "quarantined"]


@dataclass
class _Complaint:
    source_key: str
    facility_id: str
    event_id: str
    facility_name: str
    type_code: str
    start: date | None
    findings: str
    allegation: str
    tags: str
    complaint_ids: str
    raw: dict[str, Any]


@dataclass
class _Survey:
    source_key: str
    facility_id: str
    event_id: str
    regset_id: str
    facility_name: str
    type_code: str
    citation_code: str
    citation_title: str
    regulation_text: str
    citation_text: str
    scope: Any
    severity_letter: Any
    plan_of_correction: str
    inspection_date: Any
    inspection_type: str
    raw: dict[str, Any]


class _Ledger:
    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], Disposition] = {}

    def add(
        self,
        source: str,
        source_key: str,
        disposition: str,
        reason: str | None,
        facility_id: str,
        raw: dict[str, Any],
    ) -> None:
        token = (source, source_key)
        if token in self.rows:
            raise ValueError(f"Duplicate disposition for {source} {source_key}")
        self.rows[token] = Disposition(
            source=source,
            source_key=source_key,
            disposition=disposition,
            reason=reason,
            facility_external_id=facility_id,
            raw=raw if isinstance(raw, dict) else {},
        )

    def finish(self, expected: set[tuple[str, str]]) -> list[Disposition]:
        missing = sorted(expected - set(self.rows))
        extra = sorted(set(self.rows) - expected)
        if missing or extra:
            raise ValueError(f"Disposition partition failed. missing={missing[:5]} extra={extra[:5]}")
        return list(self.rows.values())


def _append_text(current: str | None, addition: str) -> str | None:
    text = addition.strip()
    if not text:
        return current
    if not current:
        return text
    if text in current:
        return current
    return f"{current}\n\n{text}"


def _regulation_text(title: str, regulation: str) -> str | None:
    if regulation and title and title.strip() != regulation.strip():
        return f"{title}\n\n{regulation}"
    return regulation or title or None


def choose_survey_date(
    survey_dates: list[date | None],
    valid_complaint_dates: list[date],
    as_of: date,
) -> tuple[date | None, str | None, str | None]:
    """Pick one inspection date, or a quarantine reason.

    A future complaint date is not a candidate. The caller passes only complaint
    dates on or before `as_of`.
    """
    parsed = [item for item in survey_dates if item is not None]
    future = [item for item in parsed if item > as_of]
    valid = [item for item in parsed if item <= as_of]
    if future and not valid:
        return None, None, REASON_FUTURE
    if len(set(valid)) > 1 or (future and valid):
        return None, None, REASON_CONFLICTING_DATES
    if len(set(valid)) == 1:
        return valid[0], "survey", None
    complaint_dates = set(valid_complaint_dates)
    if len(complaint_dates) > 1:
        return None, None, REASON_CONFLICTING_DATES
    if len(complaint_dates) == 1:
        return next(iter(complaint_dates)), "complaint", None
    return None, None, REASON_UNDATED


def assemble(
    complaints: list[dict[str, Any]],
    surveys: list[dict[str, Any]],
    *,
    known_facility_ids: set[str] | None = None,
    as_of: date = HFQ_AS_OF,
) -> Assembly:
    """Turn workbook rows into inspections and a complete disposition ledger."""
    ledger = _Ledger()
    parsed_complaints: list[_Complaint] = []
    parsed_surveys: list[_Survey] = []
    expected: set[tuple[str, str]] = set()

    for row in complaints:
        source_key = str(row["source_key"])
        expected.add((SOURCE_COMPLAINTS, source_key))
        raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
        facility_id = canonical_id(row.get("facility_id"))
        event_id = canonical_id(row.get("event_id"))
        if not facility_id:
            ledger.add(SOURCE_COMPLAINTS, source_key, "quarantined", REASON_MISSING_FACILITY, "", raw)
            continue
        if not event_id:
            ledger.add(SOURCE_COMPLAINTS, source_key, "quarantined", REASON_MISSING_EVENT, facility_id, raw)
            continue
        parsed_complaints.append(
            _Complaint(
                source_key=source_key,
                facility_id=facility_id,
                event_id=event_id,
                facility_name=str(row.get("facility_name") or ""),
                type_code=str(row.get("type_code") or ""),
                start=parse_date(row.get("start_date")),
                findings=str(row.get("findings") or ""),
                allegation=str(row.get("allegation") or ""),
                tags=str(row.get("tags") or ""),
                complaint_ids=str(row.get("complaint_ids") or ""),
                raw=raw,
            )
        )

    for row in surveys:
        source_key = str(row["source_key"])
        expected.add((SOURCE_SURVEYS, source_key))
        raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
        facility_id = canonical_id(row.get("facility_id"))
        event_id = canonical_id(row.get("event_id"))
        if not facility_id:
            ledger.add(SOURCE_SURVEYS, source_key, "quarantined", REASON_MISSING_FACILITY, "", raw)
            continue
        if not event_id:
            ledger.add(SOURCE_SURVEYS, source_key, "quarantined", REASON_MISSING_EVENT, facility_id, raw)
            continue
        parsed_surveys.append(
            _Survey(
                source_key=source_key,
                facility_id=facility_id,
                event_id=event_id,
                regset_id=canonical_id(row.get("regset_id")),
                facility_name=str(row.get("facility_name") or ""),
                type_code=str(row.get("type_code") or ""),
                citation_code=normalize_citation_code(row.get("citation_code")),
                citation_title=str(row.get("citation_title") or ""),
                regulation_text=str(row.get("regulation_text") or ""),
                citation_text=str(row.get("citation_text") or ""),
                scope=row.get("scope"),
                severity_letter=row.get("severity_letter"),
                plan_of_correction=str(row.get("plan_of_correction") or ""),
                inspection_date=row.get("inspection_date"),
                inspection_type=str(row.get("inspection_type") or ""),
                raw=raw,
            )
        )

    complaints_by_event: dict[tuple[str, str], list[_Complaint]] = defaultdict(list)
    for complaint in parsed_complaints:
        complaints_by_event[(complaint.facility_id, complaint.event_id)].append(complaint)

    groups: dict[tuple[str, str, str], list[_Survey]] = defaultdict(list)
    for survey in parsed_surveys:
        groups[(survey.facility_id, survey.event_id, survey.regset_id)].append(survey)

    inspections: list[InspectionRecord] = []
    inspections_by_event: dict[tuple[str, str], list[InspectionRecord]] = defaultdict(list)
    blocked: dict[tuple[str, str], set[str]] = defaultdict(set)

    for (facility_id, event_id, regset_id), rows in groups.items():
        def quarantine_group(reason: str) -> None:
            blocked[(facility_id, event_id)].add(reason)
            for survey in rows:
                ledger.add(
                    SOURCE_SURVEYS,
                    survey.source_key,
                    "quarantined",
                    reason,
                    facility_id,
                    survey.raw,
                )

        if known_facility_ids is not None and facility_id not in known_facility_ids:
            quarantine_group(REASON_UNMATCHED)
            continue

        valid_complaint_dates = [
            complaint.start
            for complaint in complaints_by_event.get((facility_id, event_id), [])
            if complaint.start is not None and complaint.start <= as_of
        ]
        chosen, date_source, date_reason = choose_survey_date(
            [parse_date(survey.inspection_date) for survey in rows],
            valid_complaint_dates,
            as_of,
        )
        if date_reason or chosen is None or date_source is None:
            quarantine_group(date_reason or REASON_UNDATED)
            continue

        labels = {survey.inspection_type for survey in rows if survey.inspection_type}
        if len(labels) > 1:
            quarantine_group(REASON_CONFLICTING_TYPES)
            continue

        comments: list[str] = []
        deficiencies: list[DeficiencyRecord] = []
        kept = False
        for survey in rows:
            if not survey.citation_code:
                ledger.add(
                    SOURCE_SURVEYS,
                    survey.source_key,
                    "quarantined",
                    REASON_MISSING_CODE,
                    facility_id,
                    survey.raw,
                )
                continue
            kept = True
            if survey.citation_code in SENTINEL_CODES:
                if survey.citation_text:
                    comments.append(survey.citation_text)
                ledger.add(
                    SOURCE_SURVEYS,
                    survey.source_key,
                    "normalized",
                    None,
                    facility_id,
                    survey.raw,
                )
                continue
            letter, severity, immediate = map_severity(survey.severity_letter)
            deficiencies.append(
                DeficiencyRecord(
                    citation_code=survey.citation_code,
                    citation_title=survey.citation_title,
                    regulation_text=_regulation_text(survey.citation_title, survey.regulation_text),
                    inspector_narrative=survey.citation_text or None,
                    plan_of_correction=survey.plan_of_correction or None,
                    scope=scope_from_letter(letter),
                    severity=severity,
                    severity_letter=letter,
                    immediate_jeopardy=immediate,
                    source_key=survey.source_key,
                )
            )
            ledger.add(
                SOURCE_SURVEYS,
                survey.source_key,
                "normalized",
                None,
                facility_id,
                survey.raw,
            )

        if not kept:
            continue

        inspection = InspectionRecord(
            facility_id=facility_id,
            event_id=event_id,
            regset_id=regset_id,
            event_key=f"{facility_id}|{event_id}|{regset_id}",
            inspection_date=chosen,
            date_source=date_source,
            inspection_type_label=next(iter(labels), "Survey"),
            is_complaint=False,
            inspection_comments="\n\n".join(comments),
            deficiencies=deficiencies,
            facility_name=rows[0].facility_name,
            type_code=rows[0].type_code,
        )
        inspections.append(inspection)
        inspections_by_event[(facility_id, event_id)].append(inspection)

    for complaint in parsed_complaints:
        if (SOURCE_COMPLAINTS, complaint.source_key) in ledger.rows:
            continue
        if complaint.start is not None and complaint.start > as_of:
            ledger.add(
                SOURCE_COMPLAINTS,
                complaint.source_key,
                "quarantined",
                REASON_FUTURE,
                complaint.facility_id,
                complaint.raw,
            )
            continue
        if known_facility_ids is not None and complaint.facility_id not in known_facility_ids:
            ledger.add(
                SOURCE_COMPLAINTS,
                complaint.source_key,
                "quarantined",
                REASON_UNMATCHED,
                complaint.facility_id,
                complaint.raw,
            )
            continue
        matched = inspections_by_event.get((complaint.facility_id, complaint.event_id))
        if matched:
            for inspection in matched:
                inspection.is_complaint = True
                inspection.complaint_count += 1
                inspection.findings = _append_text(inspection.findings, complaint.findings)
                inspection.allegation = _append_text(inspection.allegation, complaint.allegation)
                inspection.tag_list = _append_text(inspection.tag_list, complaint.tags)
                inspection.complaint_ids = _append_text(inspection.complaint_ids, complaint.complaint_ids)
            ledger.add(
                SOURCE_COMPLAINTS,
                complaint.source_key,
                "normalized",
                None,
                complaint.facility_id,
                complaint.raw,
            )
            continue
        blocking = blocked.get((complaint.facility_id, complaint.event_id), set()) - {REASON_FUTURE}
        if blocking:
            reason = next(iter(blocking)) if len(blocking) == 1 else REASON_CONFLICTING_DATES
            ledger.add(
                SOURCE_COMPLAINTS,
                complaint.source_key,
                "quarantined",
                reason,
                complaint.facility_id,
                complaint.raw,
            )
            continue
        if complaint.start is None:
            ledger.add(
                SOURCE_COMPLAINTS,
                complaint.source_key,
                "quarantined",
                REASON_UNDATED,
                complaint.facility_id,
                complaint.raw,
            )
            continue
        inspections.append(
            InspectionRecord(
                facility_id=complaint.facility_id,
                event_id=complaint.event_id,
                regset_id="",
                event_key=f"{complaint.facility_id}|{complaint.event_id}|complaint",
                inspection_date=complaint.start,
                date_source="complaint",
                inspection_type_label="Complaint",
                is_complaint=True,
                findings=complaint.findings or None,
                allegation=complaint.allegation or None,
                tag_list=complaint.tags or None,
                complaint_ids=complaint.complaint_ids or None,
                facility_name=complaint.facility_name,
                type_code=complaint.type_code,
                complaint_count=1,
            )
        )
        ledger.add(
            SOURCE_COMPLAINTS,
            complaint.source_key,
            "normalized",
            None,
            complaint.facility_id,
            complaint.raw,
        )

    return Assembly(inspections=inspections, dispositions=ledger.finish(expected))
