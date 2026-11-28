"""Code-built summary header plus a gate on model-written finding descriptions.

The model never supplies a count, a date, a visit type, or a penalty. Those come from
the report text and the deficiency rows. A dollar sign, a date, or a count is not stored.
A digit inside a token such as LGBTQIA2S+ is kept only when that exact token is in the
finding's span. Tags are compared with spaces and leading zeros removed. A California
regulation cite counts only when it matches a stored row for this visit.
"""

from __future__ import annotations

import json
import re

from _extractive_merge import norm_tag, tag_key, tag_pattern
from _summary_ground import (
    _RULE_SENT,
    check_outcome,
    deficiency_rows,
    ground_problems,
    header_date_allowed,
    is_factual_hold,
    mn_evidence,
    tag_span,
)

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
    r"\b(best|top-rated|top rated|best-in-class|number one|highest-rated)\b|"
    r"does not offer memory care",
    re.I,
)
_REPORT_SAYS = re.compile(
    r"\bthe report (says|states|lists)\b|\baccording to the (report|document)\b",
    re.I,
)
_IDENT = re.compile(
    r"#\s*\d|\b[RS]\d+\b|\bResident\s+\d+|\bStaff\s+\d+|"
    r"\bClient\s+\d+|\bEmployee\s+\d+|"
    r"\bLALD-[A-Z]\b|\bCNS-[A-Z]\b|\bULP-[A-Z]\b",
    re.I,
)
_CLEAN = re.compile(
    r"\b(0 citations|no deficiencies|clean record|perfect record|no issues|"
    r"substantial compliance|no correction orders|met all requirements|in compliance)\b",
    re.I,
)
_CIVIL = re.compile(r"immediate\s+(\$\s?[\d,]+(?:\.\d{2})?)\s+civil penalty", re.I)
_PURSUANT = re.compile(
    r"fines are assessed pursuant to this survey:.{0,500}?(\$\s?[\d,]+(?:\.\d{2})?)",
    re.I,
)
_NEAR_ASSESS = re.compile(
    r"assess\w*(?:\s+\S+){0,5}\s*(\$\s?[\d,]+(?:\.\d{2})?)",
    re.I,
)


def _flat(text: str) -> str:
    return re.sub(r"\s+", " ", text or "")


def _cap(text: str) -> str:
    if not text:
        return text
    return text[0].upper() + text[1:]


_FORM_HEADER = re.compile(
    r"DATE\s+SURVEY\s+AND\s+PLAN\s+OF\s+CORRECTION|"
    r"STATEMENT\s+OF\s+DEFICIENCIES|"
    r"STATE\s+FORM|"
    r"FORM\s+APPROVED",
    re.I,
)


def _visit_body(text: str) -> str:
    """Report wording, without form headers or rule and statute sentences.

    A rule can say 'full survey' ('does not have a full survey, the Department
    shall conduct'). That is not the visit. A sentence that says the agency
    completed, conducted, or initiated the visit is kept.
    """
    body = _FORM_HEADER.sub(" ", text or "")
    kept = []
    for sentence in re.split(r"(?<=[.;])\s+", body):
        if not sentence:
            continue
        announced = re.search(
            r"\b(completed|conducted|initiated)\b.{0,60}\b(survey|investigation|re-?licens)",
            sentence,
            re.I,
        )
        if _RULE_SENT.search(sentence) and not announced:
            continue
        kept.append(sentence)
    return " ".join(kept)


def _phrase_hit(phrase: str, body: str) -> str | None:
    for match in re.finditer(r"\b" + phrase + r"\b", body, re.I):
        if phrase.lower() == "survey":
            tail = body[match.end(): match.end() + 12]
            if re.match(r"\s+plan\b", tail, re.I):
                continue
        return match.group(0)
    return None


def visit_type_as_written(text: str, inspection_type: str | None = None) -> str | None:
    """The report body's own visit wording. A form header or a rule is not the visit.

    "DATE SURVEY AND PLAN OF CORRECTION" is a form label. "Initiated an investigation
    of complaint" is a complaint investigation. "kitchen survey plan of correction"
    is not a visit type. When the body has no visit phrase, the result is None and
    the issued line says "at this visit".
    """
    # The complaint phrase is the visit even when the form's "must" sits in the
    # same undivided block. Rule text is dropped only for the other phrases.
    opened = _FORM_HEADER.sub(" ", text or "")
    if re.search(r"\b(?:investigation of complaint|complaint investigation)\b", opened, re.I):
        return "complaint investigation"
    body = _visit_body(text)
    kind = (inspection_type or "").lower()
    preferred = []
    if "re-licen" in kind or "relicen" in kind:
        preferred.append(r"re-?licens(?:ure|ing)(?:\s+survey)?")
    if "change of owner" in kind:
        preferred.append(r"change of owner(?:ship)?(?:\s+survey)?")
    if "complaint" in kind:
        preferred.append(r"complaint investigation")
    for hint in preferred:
        hit = _phrase_hit(hint, body)
        if hit:
            return hit
    for phrase in _VISIT_PHRASES:
        hit = _phrase_hit(re.escape(phrase), body)
        if hit:
            return hit
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


def _potential_fine(flat: str, start: int) -> bool:
    window = flat[max(0, start - 48): start]
    return re.search(r"may be|potential|up to|not to exceed", window, re.I) is not None


def latest_assessed_penalty(text: str, cmp: object = None) -> str | None:
    """Latest assessed letter wins. A later no-fine letter clears it.

    Also reads an immediate civil penalty, a 'fines are assessed pursuant to this
    survey' total, and a garbled 'assesse … $500.00'. A possible or 'up to' amount
    is not a penalty. cmp is used only to confirm an amount already printed.
    """
    flat = _flat(text)
    events: list[tuple[int, str | None]] = []
    for pattern in (_ASSESSED, _CIVIL, _PURSUANT, _NEAR_ASSESS):
        for match in pattern.finditer(flat):
            if _potential_fine(flat, match.start()):
                continue
            events.append((match.start(), _amount_as_written(match.group(1))))
    for match in _NO_FINE.finditer(flat):
        events.append((match.start(), None))
    if not events and cmp not in (None, "", 0, 0.0):
        printed = re.search(r"\$\s?[\d,]+(?:\.\d{2})?", flat)
        if printed and re.search(r"assess|civil penalty|fine", flat, re.I):
            amount = _amount_as_written(printed.group(0))
            digits = re.sub(r"[^\d]", "", amount)
            if digits and str(int(float(cmp))) in digits:
                return amount
        return None
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
    inspection_date: str | None = None,
    inspection_type: str | None = None,
    outcome: str | None = None,
) -> str:
    """Sentences whose numbers, dates, and visit words are copied from the source.

    A missing date, visit type, or penalty is left out. A report date that is not
    the inspection row's date is left out. Zero findings never become '0 citations',
    'no deficiencies', or 'clean record' here.
    """
    state = (state_code or "").upper()
    agency = _AGENCY.get(state)
    noun = _NOUN.get(state, "deficiency")
    visit = visit_type_as_written(source, inspection_type)
    when = survey_date_as_written(source)
    if when and not header_date_allowed(when, inspection_date):
        when = None
    sentences: list[str] = []
    if agency and visit and when:
        sentences.append(f"On {when}, {agency} completed a {visit}.")
    elif agency and visit:
        sentences.append(f"{_cap(agency)} completed a {visit}.")
    if finding_count > 0 and agency:
        issued = f"issued {finding_count} {_plural(noun, finding_count)}"
        # No visit phrase in the report body. Do not borrow one from a rule.
        if not visit:
            issued += " at this visit"
        issued += "."
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
    if (outcome or "").lower() == "substantiated" and re.search(
        r"\bmaltreatment occurred\b", source or "", re.I
    ):
        sentences.append("Maltreatment occurred.")
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


_COUNT_AFTER = re.compile(
    r"\s+(?:residents?|items?|hours?|days?|staff|people|persons?|times?)\b",
    re.I,
)
_CITE_PHRASE = re.compile(
    r"\b(?:Title|Division|Div\.|Chapter|Chapt\.|Article|Section|Sec\.|§)\s*\d+\b",
    re.I,
)
_DATE_IN_TEXT = re.compile(
    r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}/\d{1,2}/\d{2,4}\b",
    re.I,
)
_MIXED_TOKEN = re.compile(
    r"[A-Za-z][A-Za-z0-9+\-]*\d[A-Za-z0-9+\-]*|\d+[A-Za-z][A-Za-z0-9+\-]*"
)


def digit_problem(description: str, evidence: str | None) -> str | None:
    """A count, a date, or a dollar sign is rejected.

    A token that mixes letters and digits is kept only when that exact token is in
    this finding's span. A regulation phrase such as "Title 22" is kept when the
    same phrase is in the span.
    """
    if not description:
        return None
    if "$" in description or _DATE_IN_TEXT.search(description):
        return "digit or dollar sign"
    mixed: list[tuple[int, int]] = []
    for match in _MIXED_TOKEN.finditer(description):
        mixed.append(match.span())
        token = match.group(0)
        if not evidence or not re.search(
            rf"(?<![A-Za-z0-9]){re.escape(token)}(?![A-Za-z0-9])",
            evidence,
            re.I,
        ):
            return "digit or dollar sign"
    for match in re.finditer(r"\d+", description):
        if any(start <= match.start() < end for start, end in mixed):
            continue
        if _COUNT_AFTER.match(description[match.end(): match.end() + 24]):
            return "digit or dollar sign"
        window = description[max(0, match.start() - 24): match.end() + 8]
        cite = _CITE_PHRASE.search(window)
        if cite and evidence and re.search(re.escape(cite.group(0)), evidence, re.I):
            continue
        return "digit or dollar sign"
    return None


def description_problems(
    description: str,
    source: str,
    state_code: str,
    *,
    evidence: str | None = None,
    how: str = "",
    inspection_date: str | None = None,
    inspection_type: str | None = None,
    defs: list[dict] | None = None,
    facility: str | None = None,
) -> list[str]:
    """Hard failures in the model-written sentence. The code-built header is not passed here."""
    problems: list[str] = []
    digit = digit_problem(description, evidence if evidence is not None else source)
    if digit:
        problems.append(digit)
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
    if evidence is not None:
        problems.extend(
            ground_problems(
                description,
                evidence,
                source=source,
                state_code=state_code,
                inspection_date=inspection_date,
                inspection_type=inspection_type,
                defs=defs,
                facility=facility,
                how=how,
            )
        )
    return problems


def _evidence_for(
    source: str,
    tag: str | None,
    tags: list[str],
    rows: list[dict] | None = None,
) -> tuple[str, str]:
    narr = mn_evidence(source, tag) if tag else None
    if narr:
        return narr, "MN finding narrative after the not-met marker"
    span = tag_span(source, tag, tags) if tag else None
    if rows and tag and (span is None or len(span) < 40):
        from _extractive_merge import tag_key as _key
        for row in rows:
            if _key(row.get("code")) != _key(tag):
                continue
            stored = (row.get("inspector_narrative") or "").strip()
            if len(stored) >= 40:
                return stored, "deficiency narrative"
    if span is None:
        return source or "", "whole report; this description has no tag boundary"
    # The tag block is the finding. Oregon prints the rule and the observation in
    # that same block, and the v9 cut dropped the rule the description quoted.
    # Minnesota still uses the parser text after the not-met marker, above.
    return span, "tag span"


def _plain_tag(code: str) -> bool:
    if not code or "(" in code or ")" in code:
        return False
    key = tag_key(code)
    return bool(key and re.fullmatch(r"[A-Z]*\d+", key))


def _is_reg_cite(tag: str | None) -> bool:
    if not tag:
        return False
    if re.search(r"\d{4,5}\s*\(", tag):
        return True
    return bool(re.search(r"\d{4,5}", tag) and re.search(r"\b(?:SEC\.|SECTION|TITLE)\b", tag, re.I))


def _cite_matches(tag: str, rows: list[dict]) -> bool:
    """The section number, and any subsection the model states, is on one stored row."""
    sections = re.findall(r"\d{4,5}", tag or "")
    if not sections:
        return False
    subs = [part.upper() for part in re.findall(r"\([A-Za-z0-9]+\)", tag or "")]
    hits = 0
    for row in rows:
        code = str(row.get("code") or "")
        if sections[0] not in re.findall(r"\d{4,5}", code):
            continue
        if subs and not all(part in code.upper() for part in subs):
            continue
        hits += 1
    return hits == 1


def _tag_in_source(tag: str, source: str) -> bool:
    pattern = tag_pattern(tag)
    if not pattern:
        return False
    return re.search(pattern, source or "", re.I) is not None


def _oar_code(tag: str | None, rows: list[dict]) -> str | None:
    """An OAR cite in the tag is that row's code when exactly one row states it.

    norm_tag drops the hyphens, so 'OAR 411-054-0090' becomes the digits
    4110540090. The row description still contains that rule number.
    """
    compact = norm_tag(tag) or ""
    match = re.search(r"OAR(\d{10})", compact)
    if not match:
        return None
    digits = match.group(1)
    hits: list[str] = []
    for row in rows:
        blob = re.sub(
            r"[\s\-]",
            "",
            " ".join(str(row.get(key) or "") for key in ("code", "description", "inspector_narrative")),
        ).upper()
        if digits in blob:
            code = "" if row.get("code") is None else str(row.get("code")).strip()
            if code and code not in hits:
                hits.append(code)
    if len(hits) == 1:
        return hits[0]
    return None


def _fit_descriptions(
    descriptions: list[dict],
    wanted: list[str] | None,
    rows: list[dict],
) -> tuple[list[dict] | None, str | None, str | None]:
    """Keep one description per D row. Drop extras that do not map.

    A tag, or an OAR cite that matches one row, claims that row. A second
    description for the same row is dropped. Null tags fill leftover rows
    only when their count equals the holes. Three untagged descriptions for
    two rows cannot be mapped, so the row holds.
    Returns (items, drop warning, error).
    """
    if wanted is None:
        return descriptions, None, None
    wanted_keys = [tag_key(tag) for tag in wanted]
    buckets: dict[str, list[dict]] = {key: [] for key in wanted_keys if key}
    unmatched: list[dict] = []
    nulls: list[dict] = []
    for item in descriptions:
        tag = item.get("tag")
        if not tag:
            nulls.append(item)
            continue
        key = tag_key(tag)
        if key not in buckets:
            code = _oar_code(tag, rows)
            mapped = tag_key(code) if code else None
            if mapped in buckets:
                key = mapped
                item = {**item, "tag": norm_tag(code)}
            else:
                unmatched.append(item)
                continue
        buckets[key].append(item)
    chosen: list[dict | None] = []
    holes: list[int] = []
    dropped = 0
    for key in wanted_keys:
        group = buckets.get(key) or []
        if group:
            chosen.append(group[0])
            dropped += len(group) - 1
        else:
            holes.append(len(chosen))
            chosen.append(None)
    if len(nulls) != len(holes):
        if not holes and (nulls or unmatched or dropped):
            dropped += len(nulls) + len(unmatched)
        else:
            return None, None, "description count does not match D rows"
    else:
        for slot, item in zip(holes, nulls):
            chosen[slot] = item
        dropped += len(unmatched)
    if any(item is None for item in chosen):
        return None, None, "description count does not match D rows"
    warning = "dropped extra description" if dropped else None
    return [item for item in chosen if item is not None], warning, None


def _collapse_extra_tags(
    descriptions: list[dict],
    finding_count: int,
) -> tuple[list[dict] | None, str | None, str | None]:
    """No D-row table: keep the first description of each report tag.

    Untagged extras are dropped only when the tagged ones already cover every
    row. All-null extras do not map onto rows, so they hold.
    """
    if len(descriptions) == finding_count:
        return descriptions, None, None
    if len(descriptions) < finding_count:
        return None, None, "description count does not match D rows"
    order: list[str] = []
    by_tag: dict[str, dict] = {}
    nulls: list[dict] = []
    dropped = 0
    for item in descriptions:
        tag = item.get("tag")
        if not tag:
            nulls.append(item)
            continue
        key = tag_key(tag) or tag
        if key in by_tag:
            dropped += 1
            continue
        by_tag[key] = item
        order.append(key)
    kept = [by_tag[key] for key in order]
    if len(kept) == finding_count:
        return kept, "dropped extra description", None
    if len(kept) < finding_count and len(nulls) == finding_count - len(kept):
        warning = "dropped extra description" if dropped else None
        return kept + nulls, warning, None
    return None, None, "description count does not match D rows"


def regulator_sentence(text: str, *, row: dict | None = None) -> str:
    """The regulator's own first sentence. Not a paraphrase, and not cut mid-word.

    Rule sentences are skipped so an Oregon block yields the observation.
    When no sentence boundary is present, the stored deficiency description
    is copied as written.
    """
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    kept: list[str] = []
    for sentence in re.split(r"(?<=[.;])\s+", cleaned):
        if sentence and not _RULE_SENT.search(sentence):
            kept.append(sentence.strip())
    blob = " ".join(kept).strip()
    match = re.match(r"^(.+?[.!?])(?:\s|$)", blob)
    if match:
        sentence = match.group(1).strip()
        if sentence[-1:] not in ".!?":
            sentence += "."
        return sentence
    if row and str(row.get("description") or "").strip():
        return re.sub(r"\s+", " ", str(row["description"])).strip()
    if cleaned and cleaned[-1:] not in ".!?":
        return cleaned + "."
    return cleaned


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
    inspection_date: str | None = None,
    inspection_type: str | None = None,
    outcome: str | None = None,
    facility: str | None = None,
    defs: list[dict] | None = None,
    notes: list[str] | None = None,
) -> tuple[str | None, str | None]:
    """Header plus one description per deficiency row, in row order.

    Returns (summary, error). error is set when a fact is wrong. A style miss
    is appended to notes and the row still stores.

    When d_tags is None the report's own tags are accepted (Oregon rows often have
    no deficiency-table tags). A tag still has to appear in the report, or be null,
    or be the 1-based index of that description. MN-SUBST rows are not deficiency tags.
    """
    real_defs = defs
    cite_rows: list[dict] | None = None
    plain_rows: list[dict] = []
    style: list[str] = []
    if defs:
        rows, _subst = deficiency_rows(defs)
        if rows or _subst:
            finding_count = len(rows)
            codes = ["" if row.get("code") is None else str(row.get("code")).strip() for row in rows]
            if rows and all(_plain_tag(code) for code in codes):
                d_tags = codes
                plain_rows = rows
            else:
                # A blank California code is still a row. A regulation cite is not a tag key.
                d_tags = None
                cite_rows = rows
    if not descriptions:
        return None, "model did not return finding descriptions"
    if d_tags is not None:
        wanted = [norm_tag(tag) for tag in d_tags]
        if any(tag is None for tag in wanted):
            return None, "D-row tag missing"
        if len(wanted) != finding_count:
            return None, "D-row count does not match the record count"
        wanted_keys = [tag_key(tag) for tag in wanted]
        if any(key is None for key in wanted_keys) or len(wanted_keys) != len(set(wanted_keys)):
            return None, "duplicate tag"
        ordered_items, drop, fit_err = _fit_descriptions(descriptions, wanted, plain_rows)
        if fit_err or not ordered_items:
            return None, fit_err or "description count does not match D rows"
        if drop:
            style.append(drop)
        count = len(wanted)
        span_tags = [tag for tag in wanted if tag]
    else:
        ordered_items, drop, fit_err = _collapse_extra_tags(descriptions, finding_count)
        if fit_err or not ordered_items:
            return None, fit_err or "description count does not match D rows"
        if drop:
            style.append(drop)
        seen: set[str] = set()
        for index, item in enumerate(ordered_items, start=1):
            tag = item["tag"]
            if not tag:
                continue
            if re.fullmatch(r"[1-9]\d?", tag) and int(tag) == index:
                continue
            if cite_rows is not None and _is_reg_cite(tag):
                if not _cite_matches(tag, cite_rows):
                    return None, "regulation cite does not match this visit"
            elif not _tag_in_source(tag, source or ""):
                return None, "tag not in the report"
            if tag_key(tag) in seen:
                return None, "duplicate tag"
            seen.add(tag_key(tag) or tag)
        count = finding_count
        span_tags = [
            item["tag"] for item in ordered_items
            if item["tag"] and not re.fullmatch(r"[1-9]\d?", item["tag"])
        ]
    holds: list[str] = []
    for index, item in enumerate(ordered_items, start=1):
        tag = item["tag"]
        if tag and re.fullmatch(r"[1-9]\d?", tag) and int(tag) == index:
            tag = None
        evidence, how = _evidence_for(source, tag, span_tags, plain_rows or cite_rows)
        problems = description_problems(
            item["description"],
            source,
            state_code,
            evidence=evidence,
            how=how,
            inspection_date=inspection_date,
            inspection_type=inspection_type,
            defs=real_defs,
            facility=facility,
        )
        for problem in problems:
            if is_factual_hold(problem):
                holds.append(problem)
            else:
                style.append(problem)
    if notes is not None:
        notes.extend(style)
    if holds:
        return None, holds[0]
    if outcome is None and defs:
        for item in defs:
            code = str(item.get("code") or "").upper().replace(" ", "").replace("-", "")
            if code == "MNSUBST" and str(item.get("status") or "").lower() == "substantiated":
                outcome = "substantiated"
                break
    header = build_header(
        state_code=state_code,
        source=source,
        finding_count=count,
        penalty=penalty,
        followup_amount=followup_amount,
        followup_letter_date=followup_letter_date,
        inspection_date=inspection_date,
        inspection_type=inspection_type,
        outcome=outcome,
    )
    outcome_problem = check_outcome("", header, outcome, source)
    if outcome_problem:
        return None, outcome_problem
    ordered = [item["description"] for item in ordered_items]
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
