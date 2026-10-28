"""Turn DSHS letter text into a tier. No database and no network.

A letter is classified from its heading and its file name. The body of a
lift letter repeats the original order, so the body is not used to decide
the action. A later lift closes the matching action type only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

DISCLAIMER = (
    "This is a state record, not a rating of care quality; "
    "families may want to ask the home about it."
)

_MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

_DATE_RE = re.compile(
    r"\b(January|February|March|April|May|June|July|August|September|"
    r"October|November|December)\s+(\d{1,2}),\s+(\d{4})",
    re.IGNORECASE,
)

_SERIOUS = (
    "revocation",
    "stop_placement",
    "conditions",
    "denial",
    "suspension",
    "non_renewal",
)


@dataclass(frozen=True)
class SourceDoc:
    filename: str
    text: str
    url: str
    doc_type: str
    posted_month: str | None = None


@dataclass
class _Event:
    action: str
    kind: str
    letter_date: date | None
    url: str
    filename: str
    notice: bool = False
    fine_count: int = 0


@dataclass
class FlagResult:
    tier: int
    banner_text: str | None
    docs: list[dict]
    unread_docs: list[dict] = field(default_factory=list)
    open_actions: list[str] = field(default_factory=list)


def _letter_date(text: str) -> date | None:
    match = _DATE_RE.search(text[:2000])
    if not match:
        return None
    return date(int(match.group(3)), _MONTHS[match.group(1).lower()], int(match.group(2)))


def _heading(text: str) -> str:
    lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("dear"):
            break
        if stripped:
            lines.append(stripped)
    return " ".join(lines)


def _posted_date(posted_month: str | None) -> date | None:
    if not posted_month:
        return None
    year, month = posted_month.split("-")
    return date(int(year), int(month), 1)


def _action_types(heading: str, filename: str) -> list[str]:
    blob = f"{heading}\n{filename}"
    found: list[str] = []

    def add(name: str, pattern: str) -> None:
        if name not in found and re.search(pattern, blob, re.IGNORECASE):
            found.append(name)

    add("revocation", r"revoc|\bRev\b")
    add("stop_placement", r"stop placement|\bSP\b")
    add("conditions", r"condition|\bCond\b")
    add("denial", r"\bdenial\b|\bdenied\b")
    add("suspension", r"\bsuspension\b|\bsuspended\b")
    add("non_renewal", r"non-?renewal")
    add("civil_fine", r"civil fine|\bCF\b")
    return found


def _fine_count(text: str, heading: str, filename: str) -> int:
    if not re.search(r"civil fine|\bCF\b", f"{heading}\n{filename}", re.IGNORECASE):
        return 0
    amounts = re.findall(r"\$\s?\d[\d,]*\.\d{2}", text)
    return max(1, len(set(amounts)))


def _is_notice(heading: str) -> bool:
    upper = heading.upper()
    return "NOTICE OF" in upper and "REVOCATION" not in upper and "IMPOSITION" not in upper


def _cited_report(doc: SourceDoc) -> bool:
    if doc.doc_type not in ("inspection", "investigation"):
        return False
    opening = f"{doc.filename}\n{doc.text[:600]}".lower()
    body = doc.text.lower()
    if "disclosure of services" in opening and "statement of deficiencies" not in body:
        return False
    cited = any(
        phrase in body
        for phrase in ("statement of deficiencies", "plan of correction", "deficient practice")
    )
    if not cited:
        return False
    if "not cited" in body and "deficient" not in body and "statement of deficiencies" not in body:
        return False
    return True


def _events_for(doc: SourceDoc) -> list[_Event]:
    heading = _heading(doc.text)
    blob = f"{heading} {doc.filename}"
    when = _letter_date(doc.text) or _posted_date(doc.posted_month)
    if re.search(r"returned mail", blob, re.IGNORECASE):
        return [
            _Event("returned_mail", "returned_mail", when, doc.url, doc.filename),
        ]
    if doc.doc_type != "enforcement_letter" and not doc.text:
        return []
    if doc.doc_type != "enforcement_letter":
        return []
    types = _action_types(heading, doc.filename)
    if not types:
        return []
    kind = "lift" if re.search(r"\blift\b", blob, re.IGNORECASE) else "impose"
    notice = _is_notice(heading)
    events: list[_Event] = []
    for action in types:
        events.append(
            _Event(
                action=action,
                kind=kind,
                letter_date=when,
                url=doc.url,
                filename=doc.filename,
                notice=notice,
                fine_count=_fine_count(doc.text, heading, doc.filename) if action == "civil_fine" else 0,
            )
        )
    return events


def _within_three_years(when: date | None, as_of: date) -> bool:
    if when is None:
        return False
    try:
        cutoff = as_of.replace(year=as_of.year - 3)
    except ValueError:
        cutoff = as_of.replace(year=as_of.year - 3, day=28)
    return when >= cutoff


def _iso(when: date | None) -> str | None:
    return when.isoformat() if when else None


def _sentence_for_open(action: str, when: date | None) -> str:
    shown = _iso(when) or "an unknown date"
    if action == "revocation":
        return f"revoked the license on {shown}"
    if action == "stop_placement":
        return f"issued a Stop Placement order on {shown}"
    if action == "conditions":
        return f"placed conditions on the license on {shown}"
    if action == "denial":
        return f"denied the license on {shown}"
    if action == "suspension":
        return f"suspended the license on {shown}"
    if action == "non_renewal":
        return f"did not renew the license on {shown}"
    return f"took an enforcement action on {shown}"


def _sentence_for_lift(action: str, imposed: date | None, lifted: date | None) -> str:
    start = _iso(imposed) or "an unknown date"
    end = _iso(lifted) or "an unknown date"
    if action == "stop_placement":
        return f"issued a Stop Placement order on {start} and lifted it on {end}"
    if action == "conditions":
        return f"placed conditions on the license on {start} and lifted them on {end}"
    if action == "revocation":
        return f"revoked the license on {start} and lifted it on {end}"
    return f"imposed {action.replace('_', ' ')} on {start} and lifted it on {end}"


def _join_clauses(clauses: list[str]) -> str:
    if not clauses:
        return ""
    if len(clauses) == 1:
        return f"Washington DSHS {clauses[0]}"
    return "Washington DSHS " + ", ".join(clauses[:-1]) + f", and {clauses[-1]}"


def _sources(pairs: list[tuple[str, str]]) -> str:
    parts = []
    seen: set[tuple[str, str]] = set()
    for kind, url in pairs:
        if (kind, url) in seen:
            continue
        seen.add((kind, url))
        label = "lift" if kind == "lift" else "Source"
        parts.append(f"{label}: DSHS ({url})")
    return "; ".join(parts)


def classify_documents(
    documents: list[SourceDoc],
    *,
    as_of: date,
    unread_docs: list[dict] | None = None,
) -> FlagResult:
    events: list[_Event] = []
    for doc in documents:
        events.extend(_events_for(doc))

    events.sort(key=lambda event: (event.letter_date or date.min, event.notice, event.kind != "impose"))

    open_events: dict[str, _Event] = {}
    closed: list[tuple[str, _Event, _Event]] = []
    fines: list[_Event] = []
    returned: list[_Event] = []

    for event in events:
        if event.kind == "returned_mail":
            returned.append(event)
            continue
        if event.action == "civil_fine" and event.kind == "impose":
            fines.append(event)
            continue
        if event.kind == "lift":
            current = open_events.get(event.action)
            if current and (current.letter_date or date.min) <= (event.letter_date or date.min):
                closed.append((event.action, current, event))
                del open_events[event.action]
            continue
        if event.action not in open_events:
            open_events[event.action] = event

    serious_open = [open_events[name] for name in _SERIOUS if name in open_events]
    recent_fines = [fine for fine in fines if _within_three_years(fine.letter_date, as_of)]
    fine_total = sum(max(1, fine.fine_count) for fine in recent_fines)

    cited: list[tuple[SourceDoc, date | None]] = []
    for doc in documents:
        if not _cited_report(doc):
            continue
        when = _letter_date(doc.text) or _posted_date(doc.posted_month)
        if _within_three_years(when, as_of):
            cited.append((doc, when))

    if serious_open:
        tier = 1
    elif closed or fine_total >= 2:
        tier = 2
    elif fine_total == 1 or cited:
        tier = 3
    else:
        tier = 0

    docs: list[dict] = []
    source_pairs: list[tuple[str, str]] = []
    clauses: list[str] = []

    if tier == 1:
        for event in serious_open:
            clauses.append(_sentence_for_open(event.action, event.letter_date))
            source_pairs.append(("impose", event.url))
            docs.append(
                {
                    "type": event.action,
                    "date": _iso(event.letter_date),
                    "url": event.url,
                    "lifted_by": None,
                }
            )
        if returned:
            latest = max(returned, key=lambda event: event.letter_date or date.min)
            if latest.letter_date:
                clauses.append(f"mailed that notice again on {latest.letter_date.isoformat()}")
            docs.append(
                {
                    "type": "returned_mail",
                    "date": _iso(latest.letter_date),
                    "url": latest.url,
                    "lifted_by": None,
                }
            )
    elif tier == 2:
        for action, imposed, lift in closed:
            clauses.append(_sentence_for_lift(action, imposed.letter_date, lift.letter_date))
            source_pairs.append(("impose", imposed.url))
            source_pairs.append(("lift", lift.url))
            docs.append(
                {
                    "type": action,
                    "date": _iso(imposed.letter_date),
                    "url": imposed.url,
                    "lifted_by": lift.url,
                }
            )
        if fine_total:
            fine_dates = ", ".join(
                _iso(fine.letter_date) or "an unknown date" for fine in recent_fines
            )
            noun = "civil fine" if fine_total == 1 else "civil fines"
            clauses.append(f"imposed {fine_total} {noun} on {fine_dates}")
            for fine in recent_fines:
                source_pairs.append(("impose", fine.url))
                docs.append(
                    {
                        "type": "civil_fine",
                        "date": _iso(fine.letter_date),
                        "url": fine.url,
                        "lifted_by": None,
                    }
                )
    elif tier == 3:
        if fine_total == 1:
            fine = recent_fines[0]
            clauses.append(f"imposed a civil fine on {_iso(fine.letter_date) or 'an unknown date'}")
            source_pairs.append(("impose", fine.url))
            docs.append(
                {
                    "type": "civil_fine",
                    "date": _iso(fine.letter_date),
                    "url": fine.url,
                    "lifted_by": None,
                }
            )
        elif cited:
            doc, when = cited[0]
            clauses.append(
                f"posted an inspection report with a Statement of Deficiencies on {_iso(when) or 'an unknown date'}"
            )
            source_pairs.append(("impose", doc.url))
            docs.append(
                {
                    "type": "statement_of_deficiencies",
                    "date": _iso(when),
                    "url": doc.url,
                    "lifted_by": None,
                }
            )

    banner = None
    if clauses:
        body = f"{_join_clauses(clauses)}. {_sources(source_pairs)}. As of {as_of.isoformat()}."
        banner = body if tier == 3 else f"{body} {DISCLAIMER}"

    return FlagResult(
        tier=tier,
        banner_text=banner,
        docs=docs,
        unread_docs=list(unread_docs or []),
        open_actions=[event.action for event in serious_open],
    )


def flag_signature(tier: int, docs: list[dict]) -> tuple:
    packed = tuple(
        sorted(
            (
                doc.get("type"),
                doc.get("date"),
                doc.get("url"),
                doc.get("lifted_by"),
            )
            for doc in docs
        )
    )
    return (tier, packed)


def build_diff(previous: dict[str, dict], current: dict[str, dict]) -> dict:
    """Compare two runs. A repeated run with the same letters has no changes."""
    new_flags: list[dict] = []
    lifted_flags: list[dict] = []
    tier_changes: list[dict] = []
    for facility_id in sorted(set(previous) | set(current)):
        before = previous.get(facility_id) or {"tier": 0, "docs": [], "name": ""}
        after = current.get(facility_id) or {"tier": 0, "docs": [], "name": ""}
        if flag_signature(before["tier"], before.get("docs") or []) == flag_signature(
            after["tier"], after.get("docs") or []
        ):
            continue
        name = after.get("name") or before.get("name") or ""
        if after["tier"] != before["tier"]:
            tier_changes.append(
                {
                    "facility_id": facility_id,
                    "name": name,
                    "from": before["tier"],
                    "to": after["tier"],
                }
            )
        if after["tier"] == 1 and before["tier"] != 1:
            new_flags.append(
                {
                    "facility_id": facility_id,
                    "name": name,
                    "license_number": after.get("license_number"),
                }
            )
        severity = {0: 0, 3: 1, 2: 2, 1: 3}
        if severity.get(before["tier"], 0) > severity.get(after["tier"], 0):
            lifted_flags.append(
                {
                    "facility_id": facility_id,
                    "name": name,
                    "from": before["tier"],
                    "to": after["tier"],
                }
            )
    return {
        "new_flags": new_flags,
        "lifted_flags": lifted_flags,
        "tier_changes": tier_changes,
    }
