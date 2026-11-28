"""Code-built summary header plus a gate on model-written finding descriptions.

The model never supplies a count, a date, a visit type, or a penalty. Those come from
the report text and the deficiency rows. A description that contains a digit, a dollar
sign, or a tag that is not on the deficiency rows is not stored.
"""

from __future__ import annotations

import json
import re

from _extractive_merge import norm_tag

_MONTHS = (
    "January|February|March|April|May|June|July|August|"
    "September|October|November|December"
)
# Longest phrase first, so "survey" does not win over "full survey".
_VISIT_PHRASES = (
    "change of ownership survey",
    "complaint investigation",
    "follow-up survey",
    "follow up survey",
    "licensing survey",
    "full survey",
    "standard survey",
    "revisit",
    "survey",
)
_AGENCY = {
    "MN": "the Minnesota Department of Health",
    "CA": "the California Department of Social Services",
    "OR": "the Oregon Department of Human Services",
    "TX": "the Texas Health and Human Services Commission",
    "WA": "the Washington Department of Social and Health Services",
    "UT": "the Utah Department of Health and Human Services",
    "IL": "the Illinois Department of Public Health",
    "CO": "the Colorado Department of Public Health and Environment",
    "PA": "the Pennsylvania Department of Human Services",
    "AZ": "the Arizona Department of Health Services",
    "MO": "the Missouri Department of Health and Senior Services",
}
_NOUN = {
    "MN": "correction order",
    "CA": "citation",
    "OR": "violation",
    "TX": "violation",
    "WA": "deficiency",
    "IL": "violation",
    "PA": "violation",
}
_ASSESSED = re.compile(
    r"total amount (?:you are|you were|that you are) assessed (?:is|was|will be)\s*"
    r"(\$\s?[\d,]+(?:\.\d{2})?)",
    re.I,
)
_NO_FINE = re.compile(
    r"\bno (?:immediate )?fines? (?:are |is |were |was )?assessed\b"
    r"|\bno fines? (?:are |is |were |was )?imposed\b"
    r"|\bno fine\b",
    re.I,
)
_EVAL = re.compile(
    r"\b(serious|severe|significant|alarming|concerning|critical|grave|egregious|"
    r"troubling|notable|shocking|horrific|dangerous|appalling)\b",
    re.I,
)
_BANNED = re.compile(
    r"\b(best|top-rated|top rated)\b|does not offer memory care",
    re.I,
)
_REPORT_SAYS = re.compile(
    r"\bthe report (says|states|lists)\b|\baccording to the (report|document)\b",
    re.I,
)
_IDENT = re.compile(
    r"#\s*\d|\b[RS]\d+\b|\bResident\s+\d+|\bStaff\s+\d+|"
    r"\bLALD-[A-Z]\b|\bCNS-[A-Z]\b|\bULP-[A-Z]\b",
    re.I,
)
_CLEAN = re.compile(r"\b(0 citations|no deficiencies|clean record)\b", re.I)


def _flat(text: str) -> str:
    return re.sub(r"\s+", " ", text or "")


def _cap(text: str) -> str:
    if not text:
        return text
    return text[0].upper() + text[1:]


def visit_type_as_written(text: str) -> str | None:
    """The report's own visit wording. Never our label unless that phrase is in the text."""
    for phrase in _VISIT_PHRASES:
        match = re.search(r"\b" + re.escape(phrase) + r"\b", text or "", re.I)
        if match:
            return match.group(0)
    return None


def survey_date_as_written(text: str) -> str | None:
    """A date the report states as the survey date. A surveyor's clock time is not one.

    Form-column boilerplate ("THE FOURTH COLUMN", "survey at the above provider") is not
    a survey date, even when a month and year sit next to it.
    """
    flat = _flat(text)
    pattern = (
        rf"\bOn ({_MONTHS}) (\d{{1,2}}), (\d{{4}})"
        rf"(?:,? through ({_MONTHS}) (\d{{1,2}}), (\d{{4}}))?"
    )
    for match in re.finditer(pattern, flat):
        window = flat[match.end(): match.end() + 240]
        cut = re.search(r"\. ", window)
        sentence = window[: cut.start()] if cut else window
        if re.search(r"COLUMN|THIS APPLIES|FEDERAL DEFICIENCIES|STATE FORM|PRINTED:", sentence, re.I):
            continue
        agency = re.search(
            r"\b(Minnesota Department of Health|MDH|Department of Social Services|"
            r"Department of Human Services)\b",
            sentence,
            re.I,
        )
        action = re.search(r"\b(conducted|initiated|completed|began)\b", sentence, re.I)
        kind = re.search(r"\b(survey|investigation|revisit|inspection)\b", sentence, re.I)
        if not (agency and action and kind):
            continue
        if match.group(4):
            return (
                f"{match.group(1)} {match.group(2)}, {match.group(3)} through "
                f"{match.group(4)} {match.group(5)}, {match.group(6)}"
            )
        return f"{match.group(1)} {match.group(2)}, {match.group(3)}"
    return None


def _amount_as_written(raw: str) -> str:
    return re.sub(r"\$\s+", "$", raw)


def latest_assessed_penalty(text: str) -> str | None:
    """Latest 'total amount you are assessed' letter wins. A later no-fine letter clears it."""
    flat = _flat(text)
    events: list[tuple[int, str | None]] = []
    for match in _ASSESSED.finditer(flat):
        events.append((match.start(), _amount_as_written(match.group(1))))
    for match in _NO_FINE.finditer(flat):
        events.append((match.start(), None))
    if not events:
        return None
    events.sort(key=lambda item: item[0])
    return events[-1][1]


def followup_fine_sentence(amount: str, letter_date: str) -> str:
    return (
        f"Fine of {amount} assessed on {letter_date} "
        "after a follow-up visit found these orders uncorrected."
    )


def _plural(noun: str, count: int) -> str:
    if count == 1:
        return noun
    if noun.endswith("y") and not noun.endswith(("ay", "ey", "oy")):
        return noun[:-1] + "ies"
    return noun + "s"


def build_header(
    *,
    state_code: str,
    source: str,
    finding_count: int,
    penalty: str | None,
    followup_amount: str | None = None,
    followup_letter_date: str | None = None,
) -> str:
    """Sentences whose numbers, dates, and visit words are copied from the source.

    A missing date, visit type, or penalty is left out. Zero findings never become
    '0 citations', 'no deficiencies', or 'clean record'.
    """
    state = (state_code or "").upper()
    agency = _AGENCY.get(state)
    noun = _NOUN.get(state, "deficiency")
    visit = visit_type_as_written(source)
    when = survey_date_as_written(source)
    sentences: list[str] = []
    if agency and visit and when:
        sentences.append(f"On {when}, {agency} completed a {visit}.")
    elif agency and visit:
        sentences.append(f"{_cap(agency)} completed a {visit}.")
    if finding_count > 0 and agency:
        issued = f"issued {finding_count} {_plural(noun, finding_count)}."
        if sentences:
            sentences.append(f"It {issued}")
        else:
            sentences.append(f"{_cap(agency)} {issued}")
    elif finding_count > 0:
        sentences.append(f"{finding_count} {_plural(noun, finding_count)} were issued.")
    if followup_amount and followup_letter_date:
        sentences.append(followup_fine_sentence(followup_amount, followup_letter_date))
    elif penalty:
        sentences.append(f"Fines totaling {penalty} were assessed.")
    return " ".join(sentences)


def parse_descriptions(raw: str) -> list[dict] | None:
    """A JSON list of {tag, description}. Anything else is not a description list."""
    if not raw:
        return None
    match = re.search(r"\[.*\]", raw, re.S)
    if not match:
        return None
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, list):
        return None
    out: list[dict] = []
    for item in payload:
        if not isinstance(item, dict):
            return None
        description = item.get("description")
        if not isinstance(description, str) or not description.strip():
            return None
        out.append({"tag": norm_tag(item.get("tag")), "description": description.strip()})
    return out


def description_problems(description: str, source: str, state_code: str) -> list[str]:
    """Hard failures in the model-written sentence. The code-built header is not passed here."""
    problems: list[str] = []
    if re.search(r"[0-9]", description) or "$" in description:
        problems.append("digit or dollar sign")
    if _REPORT_SAYS.search(description):
        problems.append("the report says")
    if _IDENT.search(description):
        problems.append("resident or staff identifier")
    if _EVAL.search(description):
        problems.append("evaluative adjective")
    if _BANNED.search(description):
        problems.append("banned wording")
    if re.search(r"licensing survey", description, re.I) and not re.search(
        r"licensing survey", source or "", re.I
    ):
        problems.append("licensing survey absent from source")
    if _CLEAN.search(description):
        if (state_code or "").upper() == "TX" or not _CLEAN.search(source or ""):
            problems.append("clean-record wording")
    return problems


def assemble_summary(
    *,
    state_code: str,
    source: str,
    descriptions: list[dict],
    d_tags: list[str] | None,
    finding_count: int,
    penalty: str | None,
    followup_amount: str | None = None,
    followup_letter_date: str | None = None,
) -> tuple[str | None, str | None]:
    """Header plus one description per deficiency row, in row order.

    Returns (summary, error). error is set when nothing may be stored.
    """
    if d_tags is not None:
        wanted = [norm_tag(tag) for tag in d_tags]
        if any(tag is None for tag in wanted):
            return None, "D-row tag missing"
        if len(wanted) != finding_count:
            return None, "D-row count does not match the record count"
        got = [item["tag"] for item in descriptions]
        if len(got) != len(set(got)):
            return None, "duplicate tag"
        if set(got) != set(wanted) or len(got) != len(wanted):
            return None, "description count does not match D rows"
        by_tag = {item["tag"]: item["description"] for item in descriptions}
        ordered = [by_tag[tag] for tag in wanted]
        count = len(wanted)
    else:
        if len(descriptions) != finding_count:
            return None, "description count does not match D rows"
        if any(item["tag"] for item in descriptions):
            return None, "tag not in D rows"
        ordered = [item["description"] for item in descriptions]
        count = finding_count
    for description in ordered:
        problems = description_problems(description, source, state_code)
        if problems:
            return None, problems[0]
    header = build_header(
        state_code=state_code,
        source=source,
        finding_count=count,
        penalty=penalty,
        followup_amount=followup_amount,
        followup_letter_date=followup_letter_date,
    )
    parts = [header, *ordered]
    text = " ".join(part.strip() for part in parts if part and part.strip())
    if not text:
        return None, "nothing to store"
    if re.search(r"licensing survey", text, re.I) and not re.search(
        r"licensing survey", source or "", re.I
    ):
        return None, "licensing survey absent from source"
    if (state_code or "").upper() == "TX" and _CLEAN.search(text):
        return None, "clean-record wording"
    return text, None
