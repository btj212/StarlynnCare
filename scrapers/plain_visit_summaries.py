#!/usr/bin/env python3
"""Plain-English visit summaries that do not ask a model to invent a finding.

Illinois FOIA lines are rule numbers, violation classes, and fines. They name
the rule that was cited. They do not say what the inspector saw. Those
summaries are translated here from the official section titles in 77 Ill.
Adm. Code Part 295 (https://www.ilga.gov/agencies/JCAR/EntirePart?titlepart=07700295).

Other states whose stored text is already a sentence get that sentence, framed
as either an inspector's account or a requirement that was cited. Visits with
a real narrative are left for summarize_inspections.py.

A citation of section 295.4060 is a citation of the dementia-program rule.
It is not proof the home has an Alzheimer's Special Care designation.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import Counter

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Official section titles, said the way a family can read them.
# The number is the regulation. The words are the section's subject.
RULES: dict[str, str] = {
    "295.200": "definitions",
    "295.400": "the license requirement",
    "295.500": "the license application",
    "295.600": "issuance of an initial license",
    "295.700": "renewal of a license",
    "295.800": "a probationary license",
    "295.900": "denial of a license",
    "295.1000": "revocation, suspension, or refusal to renew a license",
    "295.1010": "a transfer of ownership",
    "295.1020": "information the licensee must give the resident",
    "295.1030": "information the department makes public",
    "295.1040": "technical infractions",
    "295.1050": "violations",
    "295.1060": "remedies and sanctions",
    "295.1070": "the annual review and complaint investigation procedures",
    "295.1080": "waivers",
    "295.1090": "complaints",
    "295.1100": "the Alzheimer's special-care disclosure",
    "295.1110": "floating licenses",
    "295.2000": "who may live in the home",
    "295.2010": "ending a residency",
    "295.2020": "notice of closure",
    "295.2030": "the resident contract",
    "295.2040": "disaster preparedness",
    "295.2050": "incident and accident reporting",
    "295.2060": "the quality improvement program",
    "295.2070": "negotiated risk agreements",
    "295.2080": "essential support persons",
    "295.3000": "staffing, qualifications, and training",
    "295.3010": "the manager's qualifications",
    "295.3020": "employee orientation and training",
    "295.3030": "the initial health evaluation for direct-care and food-service staff",
    "295.3040": "the health care worker background check",
    "295.3045": "certified nursing assistant interns",
    "295.3050": "employee assistance programs",
    "295.4000": "the physician's assessment",
    "295.4010": "the service plan",
    "295.4020": "mandatory services",
    "295.4030": "safety and service needs for residents with paralysis or a neuromuscular disease",
    "295.4040": "communicable disease policies",
    "295.4050": "tuberculin skin test procedures",
    "295.4060": "the Alzheimer's and dementia program rule",
    "295.5000": "medication reminders, self-medication, administration, and storage",
    "295.6000": "resident rights",
    "295.6010": "preventing and reporting abuse, neglect, and financial exploitation",
    "295.6030": "the resident's representative",
    "295.7000": "resident records",
    "295.7010": "establishment records",
    "295.8000": "food service",
    "295.9000": "the physical plant",
    "295.9005": "living units",
    "295.9010": "physical plant requirements for assisted living",
    "295.9020": "physical plant requirements for shared housing",
    "295.9030": "furnishings",
    "295.9040": "environmental requirements",
}

AGENCY = {
    "AZ": "Arizona Department of Health Services",
    "CA": "California Department of Social Services",
    "CO": "Colorado Department of Public Health and Environment",
    "IL": "Illinois Department of Public Health",
    "MN": "Minnesota Department of Health",
    "MO": "Missouri Department of Health and Senior Services",
    "OR": "Oregon Department of Human Services",
    "PA": "Pennsylvania Department of Human Services",
    "TX": "Texas Health and Human Services",
    "UT": "Utah Department of Health and Human Services",
    "WA": "Washington Department of Social and Health Services",
}

DISCLAIMER = (
    "The public file names the rule when a rule number is on the line. "
    "It does not describe what the inspector saw."
)

WA_PLACEHOLDER = re.compile(r"^—:\s*WA DSHS report:|^WA DSHS report:", re.I)
# A model refusal is not a summary. Match the sentence the model actually stored.
REFUSAL_RE = re.compile(
    r"I don't have enough|I don't have sufficient|I do not have|"
    r"\bI cannot\b|\bI can't\b|\bI can not\b|please provide|"
    r"to write an accurate|not from California",
    re.I,
)
REFUSAL_SQL = (
    r"I don't have enough|I don't have sufficient|I do not have|"
    r"I cannot|I can't|I can not|please provide|"
    r"to write an accurate|not from California"
)
# Sentences that introduce a report but do not say what was found.
COVER_PIECE = re.compile(
    r"abbreviations possibly used in this document|"
    r"findings of the (?:on-site investigation|desk review)|"
    r"investigation was conducted to determine compliance|"
    r"please disregard the heading|"
    r"provider'?s plan of correction|"
    r"time period for correction|"
    r"laboratory director|"
    r"used for tracking purposes|"
    r"this applies to federal deficiencies|"
    r"there is no requirement to submit|"
    r"this will appear on each page|"
    r"following the evaluators' findings|"
    r"findings which are in violation of the state|"
    r"this (?:minnesota )?requirement is not met as evidenced by|"
    r"this rule is not met as evidenced by|"
    r"exit interview|"
    r"the following deficiency is cited|"
    r"appeal rights were issued|"
    r"a copy of this report|"
    r"are being cited on the attached|"
    r"attached lic\s*9099|"
    r"see initial amended complaint|"
    r"this report reflects the findings|"
    r"must operate and provide services in compliance with all applicable|"
    r"evaluated for compliance with Oregon Administrative Rule|"
    r"conclusion\s*/\s*action|"
    r"failed provider practice|"
    r"continued from lic|"
    r"\(cid:\d+\)|"
    r"signature is on file|"
    r"state form\b|"
    r"continuation sheet|"
    r"each deficiency must be preceded|"
    r"\badl:\s*activities of daily living",
    re.I,
)
FINDING_VERB = re.compile(r"\b(failed to|did not|shall|must)\b", re.I)
GLOSSARY_RE = re.compile(r"\b[A-Z]{2,5}:")
OBS_RE = re.compile(
    r"\b(based on|failed to|did not|the surveyor|it was observed|during the (?:survey|inspection)|"
    r"the investigation found|grabbed|struck|Resident\s*#|Employee\s+[A-Z]|"
    r"staff (?:member|person)|on \d{1,2}/\d{1,2}/\d{2,4})\b",
    re.I,
)
PLAIN_FRAME_RE = (
    r"public file|file cites this requirement|file includes this account|"
    r"file says:|does not describe what the inspector saw"
)
NO_VIOLATION_RE = re.compile(
    r"\bno\s+v[io]+lations?\b|\bno\s+violations?\b|\bno\s+findings?\b|\bno\s+citations?\b|\bno\s+defs?\.?\b|\bno\s+tags\b|\bNV\b|^none$",
    re.I,
)
SEE_ELSEWHERE_RE = re.compile(r"see\s+(email|initial\s+comments|#)", re.I)
CHOW_RE = re.compile(r"\bchow\b|change of ownership", re.I)
REMOVED_RE = re.compile(r"removed\s+per\s+sod", re.I)
MARKER_RE = re.compile(
    r"^(?:FRI|COI|FIC|L/SP|L/IN|L/P1|L/desk|C/F1|M/F1|24HR|30D|7D|COMPLAINT|FRIs?)\s*:?\s*\d*$",
    re.I,
)
WRONG_PLACE_RE = re.compile(r"\bwrong\s+(facility|establishment)\b", re.I)
HARM_RE = re.compile(r"\b(fell|died|death|eloped|injured)\b", re.I)


def visit_phrase(inspection_type: str | None, is_complaint: bool) -> str:
    if is_complaint or (inspection_type or "").strip().lower() == "complaint":
        return "complaint investigation"
    key = (inspection_type or "").strip().lower()
    return {
        "facility_reported_incident": "facility-reported incident",
        "desk_audit": "desk audit",
        "initial": "initial licensing visit",
        "special": "special survey",
        "focused": "focused visit",
        "follow-up": "follow-up visit",
        "follow_up": "follow-up visit",
        "monitoring": "monitoring visit",
        "routine": "routine visit",
        "standard": "standard survey",
        "survey": "survey",
        "licensure": "licensure visit",
        "annual": "annual visit",
        "other": "other visit",
        "kitchen": "kitchen inspection",
        "validation": "validation visit",
        "comprehensive": "comprehensive visit",
    }.get(key, "compliance visit")


def word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z]{2,}", text))


def join_and(parts: list[str]) -> str:
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    if len(parts) == 2:
        return f"{parts[0]} and {parts[1]}"
    return ", ".join(parts[:-1]) + f", and {parts[-1]}"


def ensure_length(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) >= 100:
        return text
    text = f"{text} Nothing beyond that text is in the public file we hold."
    return re.sub(r"\s+", " ", text).strip()


def _strip_money(text: str) -> str:
    text = re.sub(r"changed\s+to\s*\$?\s*[\d,.]+\s*[kK]?", " ", text, flags=re.I)
    text = re.sub(r"\$\s*[\d,]+(?:\.\d+)?", " ", text)
    text = re.sub(r"\b[\d,]+(?:\.\d+)?\s*[kK]\b", " ", text)
    return text


def _format_amount(num: str, kilo: str | None) -> str:
    # The Illinois workbook sometimes writes one thousand as $1.000.
    if kilo is None and re.fullmatch(r"\d{1,3}\.\d{3}", num):
        num = num.replace(".", "")
    value = float(num.replace(",", ""))
    if kilo:
        value *= 1000
    if value == int(value):
        return f"${int(value):,}"
    return f"${value:,.2f}"


def parse_fine(text: str) -> str | None:
    dollar = re.search(r"\$\s*([\d,]+(?:\.\d+)?)\s*([kK])?", text)
    revised = re.search(
        r"(?:changed\s+to|\*\*\s*CA)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([kK])?",
        text,
        re.I,
    )
    first = _format_amount(dollar.group(1), dollar.group(2)) if dollar else None
    second = _format_amount(revised.group(1), revised.group(2)) if revised else None
    if first and second and first != second:
        return f"{first}, later listed as {second}"
    if second:
        return second
    if first:
        return first
    match = re.search(r"\b([\d,]+(?:\.\d+)?)\s*[kK]\b", text)
    if match:
        return _format_amount(match.group(1), "k")
    return None


def parse_type(text: str) -> str | None:
    match = re.search(r"\btype\s*(one|two|three|1|2|3)\b", text, re.I)
    if match:
        token = match.group(1).lower()
        return {
            "one": "Type 1",
            "two": "Type 2",
            "three": "Type 3",
            "1": "Type 1",
            "2": "Type 2",
            "3": "Type 3",
        }[token]
    match = re.search(r"\bT\s*([123])\b", text, re.I)
    if match:
        return f"Type {match.group(1)}"
    if re.search(r"\bGV\b|\bgeneral\s+violation\b", text, re.I):
        return "general violation"
    match = re.search(r"\d{4}\s*-\s*([123])\b", text)
    if match:
        return f"Type {match.group(1)}"
    return None


def parse_sections(text: str) -> list[str]:
    stripped = _strip_money(text)
    found: list[str] = []

    def add(number: str) -> None:
        code = f"295.{number}"
        if code not in found:
            found.append(code)

    for match in re.finditer(r"(?:295\s*\.\s*|\.)(\d{3,4})(?!\d)", stripped, re.I):
        if f"295.{match.group(1)}" in RULES:
            add(match.group(1))
    if found:
        return found

    marker_line = bool(re.match(r"\s*(?:FRI|COI|FIC)\b", stripped, re.I))
    for match in re.finditer(r"(?<!\d)(\d{4})(?!\d)", stripped):
        code = f"295.{match.group(1)}"
        if code not in RULES:
            continue
        suffix = stripped[match.end(): match.end() + 16]
        if marker_line and not re.search(r"(T[123]|GV|Type|\bV\b)", suffix, re.I):
            continue
        add(match.group(1))
    return found


def classify_line(text: str) -> dict:
    raw = text.strip()
    sections = parse_sections(raw)
    kind = "unparsed"
    if SEE_ELSEWHERE_RE.search(raw):
        kind = "see_elsewhere"
    elif sections or parse_type(raw) or (parse_fine(raw) and re.search(r"295\.|\.\d{4}|\bGV\b|\bT[123]\b", raw, re.I)):
        kind = "citation"
    elif re.search(r"\bunsubstantiated\b", raw, re.I):
        kind = "unsubstantiated"
    elif re.search(r"\bsubstantiated\b", raw, re.I) and re.search(r"no\s+tags", raw, re.I):
        kind = "substantiated_no_tags"
    elif re.search(r"\bsubstantiated\b", raw, re.I):
        kind = "substantiated"
    elif NO_VIOLATION_RE.search(raw) and not sections:
        kind = "no_violation"
    elif CHOW_RE.search(raw) and not sections:
        kind = "chow"
    elif WRONG_PLACE_RE.search(raw):
        kind = "wrong_place"
    elif REMOVED_RE.search(raw):
        kind = "removed"
    elif MARKER_RE.match(raw):
        kind = "marker"
    elif word_count(raw) >= 8:
        kind = "account"
    return {
        "kind": kind,
        "sections": sections,
        "type": parse_type(raw),
        "fine": parse_fine(raw),
        "repeat": bool(re.search(r"\brepeat\b", raw, re.I)),
        "removed": bool(REMOVED_RE.search(raw)),
        "text": raw,
    }


def _citation_clause(item: dict) -> str:
    named = []
    for code in item["sections"]:
        title = RULES.get(code)
        if not title:
            named.append(f"section {code}")
        elif title.startswith("the "):
            named.append(f"{title} ({code})")
        else:
            named.append(f"the rule on {title} ({code})")
    if not named:
        listed = []
        if item["type"] == "general violation":
            listed.append("a general violation")
        elif item["type"]:
            listed.append(f"a {item['type']} violation")
        if item["fine"]:
            if "later listed as" in item["fine"]:
                listed.append(f"a fine of {item['fine']}")
            else:
                listed.append(f"a {item['fine']} fine")
        detail = join_and(listed) if listed else "a citation"
        return f"{detail}, and the line does not include a rule number"
    bits = join_and(named)
    if item["type"] == "general violation":
        bits += " as a general violation"
    elif item["type"]:
        bits += f" as a {item['type']} violation"
    if item["fine"]:
        if "later listed as" in item["fine"]:
            bits += f" with a fine of {item['fine']}"
        else:
            bits += f" with a {item['fine']} fine"
    if item["repeat"]:
        bits += ", marked as a repeat"
    if item["removed"]:
        bits += ", and the file says this citation was removed"
    return bits


def _prune_headers(items: list[dict]) -> list[dict]:
    has_numbered = any(item["kind"] == "citation" and item["sections"] for item in items)
    if not has_numbered:
        return items
    kept = []
    for item in items:
        if item["kind"] == "citation" and not item["sections"] and word_count(item["text"]) <= 6:
            continue
        kept.append(item)
    return kept


def illinois_summary(inspection_type: str | None, is_complaint: bool, lines: list[str]) -> str:
    phrase = visit_phrase(inspection_type, is_complaint)
    agency = AGENCY["IL"]
    items = _prune_headers([classify_line(line) for line in lines if line and line.strip()])
    citations = [item for item in items if item["kind"] == "citation"]
    accounts = [item for item in items if item["kind"] == "account"]

    if accounts and not citations:
        sentence = re.sub(r"\s+", " ", accounts[0]["text"]).strip()
        sentence = re.sub(r"^#?\d{5,}\s*[-:/]\s*", "", sentence)
        if len(sentence) > 320:
            sentence = sentence[:317].rsplit(" ", 1)[0].rstrip(",;") + "."
        if not sentence.endswith("."):
            sentence += "."
        return ensure_length(
            f"On this {phrase}, the {agency} file includes this account: {sentence}"
        )

    if citations:
        shown = citations[:4]
        clauses = [_citation_clause(item) for item in shown]
        sentences = []
        for clause in clauses:
            sentences.append(
                f"This {phrase} cited {clause}." if not sentences else f"It also cited {clause}."
            )
        if len(citations) > 4:
            sentences.append(
                f"{len(citations) - 4} more cited rules are listed in the citation lines."
            )
        if any(item["kind"] == "see_elsewhere" for item in items):
            sentences.append(
                "One line points to another page for the rest of the detail, and that page is not in this file."
            )
        return ensure_length(f"{' '.join(sentences)} {DISCLAIMER}")

    if any(item["kind"] == "see_elsewhere" for item in items):
        return ensure_length(
            f"This {phrase} is in the {agency} visit file. "
            "The spreadsheet points to an email or another page for the citation detail, and that detail is not in the record held here."
        )
    if any(item["kind"] == "unsubstantiated" for item in items):
        return ensure_length(
            f"This {phrase} was marked unsubstantiated. "
            "The file records no cited violation, and it does not describe what was reported."
        )
    if any(item["kind"] == "substantiated" for item in items):
        return ensure_length(
            f"This {phrase} was marked substantiated. "
            "The file does not describe what was reported."
        )
    if any(item["kind"] == "substantiated_no_tags" for item in items):
        return ensure_length(
            f"This {phrase} was marked substantiated. "
            "The file says no violation tag was written, and it does not describe what was reported."
        )
    if any(item["kind"] == "wrong_place" for item in items):
        return ensure_length(
            f"This {phrase} is in the {agency} visit file. "
            "The line says the visit was for a different establishment, so it is not a citation of this home."
        )
    if any(item["kind"] == "chow" for item in items):
        return ensure_length(
            f"This {phrase} records a change of ownership. "
            "No care citation was listed in the public visit file."
        )
    if any(item["kind"] == "no_violation" for item in items):
        return ensure_length(
            f"This {phrase} is in the {agency} visit file. "
            "The file records no cited violation for this visit."
        )
    if any(item["kind"] == "removed" for item in items):
        return ensure_length(
            f"This {phrase} is in the {agency} visit file. "
            "The citation line says it was removed, and no current violation is listed."
        )
    if any(item["kind"] == "unparsed" for item in items):
        return ensure_length(
            f"This {phrase} is in the {agency} visit file. "
            "A citation line is on the record, but it is not written as a readable rule. "
            "The original wording is kept in the citation."
        )
    return ensure_length(
        f"This {phrase} is in the {agency} visit file. "
        "No citation was recorded for this visit."
    )


def _is_cover_piece(piece: str) -> bool:
    """True when a sentence is a form heading, a glossary, or a report cover."""
    if not piece or not piece.strip():
        return True
    if re.search(
        r"must operate and provide services in compliance with all applicable|"
        r"licensee understands that they shall|"
        r"each deficiency must be preceded|full prefix \(each",
        piece,
        re.I,
    ):
        return True
    if len(re.findall(r"\b[A-Za-z]{2,6}:\s", piece)) >= 2 and not FINDING_VERB.search(piece):
        return True
    if len(GLOSSARY_RE.findall(piece)) >= 3:
        return True
    if COVER_PIECE.search(piece) and not FINDING_VERB.search(piece):
        return True
    return False


def _scrub_cover(text: str) -> str:
    """Drop report covers, form instructions, and abbreviation keys."""
    cleaned = re.sub(r"\(cid:\d+\)", " ", text or "")
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"(?:\d{1,3}\s+){6,}", " ", cleaned)
    previous = None
    while previous != cleaned:
        previous = cleaned
        cleaned = re.sub(
            r"Abbreviations possibly used in this document:.*?(?:Registered Nurse\b|$)",
            " ",
            cleaned,
            count=1,
            flags=re.I,
        )
    kept: list[str] = []
    for chunk in re.split(r"[\n.]+", cleaned):
        piece = chunk.strip()
        if not piece:
            continue
        if _is_cover_piece(piece):
            continue
        kept.append(piece)
    return re.sub(r"\s+", " ", " ".join(kept)).strip()


def looks_unreadable(text: str | None) -> bool:
    raw = text or ""
    if "(cid:" in raw:
        return True
    tokens = re.findall(r"[A-Za-z]+", raw)
    if len(tokens) < 40:
        return False
    short = sum(1 for token in tokens if len(token) <= 2)
    return short / len(tokens) > 0.4


def narrative_has_finding(text: str | None) -> bool:
    """True when the stored text says what happened, not only that a report exists."""
    if not text or not text.strip():
        return False
    if WA_PLACEHOLDER.search(text.strip()) or looks_unreadable(text):
        return False
    remaining = _scrub_cover(text)
    if FINDING_VERB.search(remaining):
        return True
    return _long_words(remaining) >= 12


def narrative_is_real(text: str | None) -> bool:
    if not text:
        return False
    raw = text.strip()
    if len(raw) < 100 or WA_PLACEHOLDER.search(raw):
        return False
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    if lines and all(
        line.startswith("—:") or WA_PLACEHOLDER.search(line) or line.startswith("WA DSHS report:")
        for line in lines
    ):
        return False
    return narrative_has_finding(raw)


def _long_words(text: str) -> int:
    return len(re.findall(r"[A-Za-z]{4,}", text))


def _sentence_rank(sentence: str) -> int:
    score = min(_long_words(sentence), 24)
    if re.search(r"\b(shall|must|failed to|did not)\b", sentence, re.I):
        score += 12
    if OBS_RE.search(sentence):
        score += 6
    return score


def _usable_sentences(text: str) -> list[str]:
    if not text or text.strip().lower().startswith("http") or WA_PLACEHOLDER.search(text.strip()):
        return []
    if looks_unreadable(text):
        return []
    chunks = [re.sub(r"\s+", " ", chunk).strip() for chunk in re.split(r"\n+", text) if chunk.strip()]
    sentences: list[str] = []
    for chunk in chunks:
        if _long_words(chunk) < 6:
            continue
        for piece in re.split(r"(?<=[.])\s+", chunk):
            part = _clean_fragment(piece)
            if _is_cover_piece(part) or REFUSAL_RE.search(part):
                continue
            if _long_words(part) < 6:
                continue
            if part[0].islower():
                part = part[0].upper() + part[1:]
            if re.search(r"\b(and|or|that|the|a|an)\s*$", part, re.I):
                continue
            if len(part) > 320:
                part = part[:317].rsplit(" ", 1)[0].rstrip(",;:")
                part = re.sub(r"[:;]\s*$", "", part).strip()
            if part and not part.endswith("."):
                part += "."
            key = _sentence_key(part)
            if part and key not in {_sentence_key(existing) for existing in sentences}:
                sentences.append(part)
    sentences.sort(key=_sentence_rank, reverse=True)
    return sentences[:4]


BOILERPLATE_RE = re.compile(
    r"citation coded|no regulation text available|please contact the health facilities",
    re.I,
)


def _clean_fragment(piece: str) -> str:
    part = re.sub(r"[:;]\s*$", "", piece).strip()
    part = re.sub(r"^(?:—:\s*)+", "", part).strip()
    part = re.sub(r"^WAC\s+[\dA-Za-z().-]+\s*:\s*", "", part, flags=re.I).strip()
    previous = None
    while part != previous:
        previous = part
        part = re.sub(r"^POC Due Date:\s*\d{1,2}/\d{1,2}/\d{2,4}\s*", "", part, flags=re.I).strip()
        part = re.sub(r"^Plan of Correction\s*", "", part, flags=re.I).strip()
        part = re.sub(r"^(?:\d+\s+){3,}", "", part).strip()
    return part


def _sentence_key(sentence: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", sentence.lower()).strip()


def _clip(sentence: str) -> str:
    if len(sentence) <= 240:
        return sentence
    cut = sentence[:237].rsplit(" ", 1)[0].rstrip(",;:")
    return cut if cut.endswith(".") else cut + "."


def plain_mark(outcome: str | None) -> str | None:
    key = re.sub(r"[^a-z]", "", (outcome or "").lower())
    return {
        "substantiated": "substantiated",
        "unsubstantiated": "unsubstantiated",
        "unfounded": "unfounded",
        "inconclusive": "inconclusive",
    }.get(key)


def maltreatment_label(findings: list[dict]) -> str | None:
    for item in findings:
        blob = f"{item.get('description') or ''} {item.get('inspector_narrative') or ''}"
        if re.search(r"substantiated maltreatment or licensing", blob, re.I):
            return (
                "The record says the department substantiated a maltreatment "
                "or licensing-violation finding. The report text stored here is not "
                "readable, so it does not describe what happened."
            )
    return None


def no_finding_summary(state: str, phrase: str, outcome: str | None, findings: list[dict]) -> str:
    agency = AGENCY.get(state, "the state agency")
    label = maltreatment_label(findings)
    marked = ""
    if label is None:
        mark = plain_mark(outcome)
        if mark:
            marked = f" It is marked {mark}."
    detail = label or "The stored text does not include what the inspector found."
    return ensure_length(f"This {phrase} is in the {agency} public file.{marked} {detail}")


def prose_summary(state: str, phrase: str, texts: list[str]) -> str:
    agency = AGENCY.get(state, "the state agency")
    usable = [text for text in texts if text and not BOILERPLATE_RE.search(text)]
    if texts and not usable:
        return ensure_length(
            f"This {phrase} is in the {agency} public file. "
            "The citation code is on the record, and the file does not include the regulation text."
        )
    sentences: list[str] = []
    for text in usable:
        for sentence in _usable_sentences(text):
            if sentence not in sentences:
                sentences.append(sentence)
    sentences.sort(key=_sentence_rank, reverse=True)
    if not sentences:
        if any(text.strip() for text in texts):
            return ensure_length(
                f"This {phrase} is in the {agency} public file. "
                "The citation is not written out as a sentence, so the original line is kept in the record."
            )
        return ensure_length(
            f"This {phrase} is in the {agency} public file. "
            "No citation text was included for this visit."
        )
    picked = [_clip(sentences[0])]
    if (
        len(sentences) > 1
        and len(picked[0]) < 160
        and len(sentences[1]) < 160
        and _sentence_key(sentences[1]) not in _sentence_key(picked[0])
    ):
        picked.append(_clip(sentences[1]))
    body = " ".join(picked)
    if OBS_RE.search(body):
        lead = "includes this account"
    elif re.search(r"\b(shall|must)\b", body, re.I):
        lead = "cites this requirement"
    else:
        lead = "says"
    summary = f"On this {phrase}, the {agency} file {lead}: {body}"
    return ensure_length(summary)


def leave_for_claude(state: str, narrative: str | None, comments: str | None, findings: list[dict]) -> bool:
    if narrative_is_real(narrative):
        return True
    if state != "CO":
        return False
    if comments and len(comments.strip()) >= 120 and not comments.strip().lower().startswith("citation coded"):
        return True
    for item in findings:
        text = (item.get("inspector_narrative") or "").strip()
        if len(text) >= 80 and not text.lower().startswith("citation coded"):
            return True
    return False


def _usable_source(text: str) -> str:
    if not text or text.lower().startswith("http") or WA_PLACEHOLDER.search(text):
        return ""
    if looks_unreadable(text):
        return ""
    if narrative_has_finding(text):
        return text
    if (FINDING_VERB.search(text) or OBS_RE.search(text)) and _long_words(text) >= 6:
        return text
    return ""


def finding_text(item: dict) -> str:
    narrative = _usable_source((item.get("inspector_narrative") or "").strip())
    description = _usable_source((item.get("description") or "").strip())
    # The inspector's account is the finding. The description is often the rule.
    if narrative and (FINDING_VERB.search(narrative) or OBS_RE.search(narrative)):
        return narrative
    if description and (FINDING_VERB.search(description) or OBS_RE.search(description)):
        return description
    return narrative or description


def summary_problem(state: str, summary: str) -> str | None:
    if len(summary) < 100:
        return "short"
    if state != "CA" and re.search(r"\b(Title 22|CDSS)\b", summary):
        return "california-wording"
    if state == "IL" and "295." in summary and DISCLAIMER not in summary:
        return "missing-disclaimer"
    if state == "IL" and re.search(r"\bType A\b|designation", summary):
        return "invented-designation-or-type-a"
    if state == "IL" and DISCLAIMER in summary and HARM_RE.search(summary):
        return "invented-harm"
    # Illinois sentences are written here, so a charged word would be ours.
    # Other states quote the public file, which may already use those words.
    if state == "IL" and re.search(r"\b(alarming|egregious|concerning)\b", summary, re.I):
        return "evaluative"
    if REFUSAL_RE.search(summary):
        return "refusal"
    return None


def check_examples() -> None:
    cases = [
        (
            "complaint",
            True,
            ["Type One: 295.2000 $1,000.00 CA Changed to 2K"],
            ["295.2000", "Type 1", "$1,000", "later listed as $2,000", DISCLAIMER],
            ["California", " Title 22", "designation", "$1 fine"],
        ),
        (
            "facility_reported_incident",
            False,
            ["6000 T2"],
            ["resident rights", "295.6000", "Type 2", DISCLAIMER],
            ["California"],
        ),
        (
            "facility_reported_incident",
            False,
            ["200235-no voilations."],
            ["no cited violation"],
            ["295.", "California"],
        ),
        (
            "complaint",
            True,
            ["SUBSTANTIATED; NO TAGS WRITTEN"],
            ["substantiated", "no violation tag"],
            ["295."],
        ),
        (
            "complaint",
            True,
            ["SEE EMAIL FOR TAG ELEMENTS"],
            ["email"],
            ["295."],
        ),
        (
            "inspection",
            False,
            ["CHOW"],
            ["change of ownership"],
            ["295.", "designation"],
        ),
        (
            "complaint",
            True,
            ["295.4060a)g)h)3,6, T1, $1K **CA 2K"],
            ["295.4060", "$1,000", "later listed as $2,000", DISCLAIMER],
            ["$1 fine", "California"],
        ),
        (
            "complaint",
            True,
            ["295.4060, T2, $500"],
            ["Alzheimer's and dementia program rule", "295.4060", "Type 2", "$500", DISCLAIMER],
            ["designation", "Special Care Program is listed"],
        ),
        (
            "complaint",
            True,
            ["295.6010a)1)c)d) - $1.000"],
            ["295.6010", "$1,000", DISCLAIMER],
            ["$1 fine"],
        ),
        (
            "facility_reported_incident",
            False,
            ["FRI"],
            ["No citation was recorded", "facility-reported incident"],
            ["295."],
        ),
        (
            "facility_reported_incident",
            False,
            [],
            ["No citation was recorded"],
            ["295."],
        ),
        (
            "complaint",
            True,
            [".9040a)-$1000-GV"],
            ["295.9040", "environmental requirements", "$1,000", "general violation", DISCLAIMER],
            ["California"],
        ),
        (
            "complaint",
            True,
            ["COI 198432 - No findings. No fine."],
            ["no cited violation"],
            ["295.", "$"],
        ),
        (
            "complaint",
            True,
            ["295.400 a)b)c), General Violation and fine"],
            ["license requirement", "295.400", "general violation", DISCLAIMER],
            ["$", "California"],
        ),
        (
            "complaint",
            True,
            ["no citations"],
            ["no cited violation"],
            ["not written as a readable rule"],
        ),
        (
            "inspection",
            False,
            ["NA/Wrong Facility"],
            ["different establishment"],
            ["295."],
        ),
        (
            "facility_reported_incident",
            False,
            ["199290-.3020c)1-6)d)1-5)-T3"],
            ["295.3020", "employee orientation", "Type 3", DISCLAIMER],
            ["199290"],
        ),
    ]
    for inspection_type, is_complaint, lines, required, banned in cases:
        summary = illinois_summary(inspection_type, is_complaint, lines)
        problem = summary_problem("IL", summary)
        if problem:
            raise SystemExit(f"example failed ({problem}): {lines!r} -> {summary}")
        for needle in required:
            if needle not in summary:
                raise SystemExit(f"example missing {needle!r}: {lines!r} -> {summary}")
        for needle in banned:
            if needle in summary:
                raise SystemExit(f"example contains {needle!r}: {lines!r} -> {summary}")
        if len(summary) < 100:
            raise SystemExit(f"example short: {summary}")

    cover = (
        "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 "
        "The following deficiency is cited per California Code of Regulations, TITLE 22. "
        "Exit interview was conducted with facility staff. Appeal Rights were issued."
    )
    if narrative_has_finding(cover):
        raise SystemExit("cover sheet was treated as a finding")
    finding = (
        "The facility failed to give prescribed medications to three residents on March 3. "
        "Staff did not record the missed doses. Interviews and the medication record confirmed the misses."
    )
    if not narrative_has_finding(finding):
        raise SystemExit("a real finding was treated as a cover sheet")
    if narrative_has_finding("(cid:0)(cid:1)" * 40):
        raise SystemExit("unreadable text was treated as a finding")
    empty = no_finding_summary("CA", "complaint investigation", "Substantiated", [])
    if "marked substantiated" not in empty or "does not include what the inspector found" not in empty:
        raise SystemExit(f"empty summary missing the mark: {empty}")
    if summary_problem("CA", empty):
        raise SystemExit(f"empty summary rejected: {empty}")


def load_visits(conn, state: str, refresh: bool = False) -> list[dict]:
    included = [
        "i.narrative_summary IS NULL",
        "i.narrative_summary ~* %s",
    ]
    params: list = [REFUSAL_SQL]
    if refresh:
        included.append("i.narrative_summary ~* %s")
        params.append(PLAIN_FRAME_RE)
    where = [f"({' OR '.join(included)})"]
    if state != "ALL":
        where.append("f.state_code = %s")
        params.append(state)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT i.id::text AS id,
                   i.inspection_type,
                   i.is_complaint,
                   i.narrative_summary,
                   coalesce(i.raw_data->>'narrative', '') AS narrative,
                   coalesce(i.raw_data->>'inspection_comments', '') AS comments,
                   coalesce(i.raw_data->>'outcome', i.raw_data->>'status', '') AS outcome,
                   f.name,
                   f.state_code,
                   f.publishable,
                   d.description,
                   d.inspector_narrative
            FROM inspections i
            JOIN facilities f ON f.id = i.facility_id
            LEFT JOIN deficiencies d ON d.inspection_id = i.id
            WHERE {" AND ".join(where)}
            ORDER BY f.state_code, i.id
            """,
            params,
        )
        rows = cur.fetchall()

    visits: dict[str, dict] = {}
    for row in rows:
        visit = visits.get(row["id"])
        if visit is None:
            visit = {
                "id": row["id"],
                "state": row["state_code"],
                "inspection_type": row["inspection_type"],
                "is_complaint": bool(row["is_complaint"]),
                "narrative": row["narrative"],
                "comments": row["comments"],
                "outcome": row["outcome"],
                "name": row["name"],
                "current": row["narrative_summary"],
                "publishable": bool(row["publishable"]),
                "findings": [],
            }
            visits[row["id"]] = visit
        if row["description"] or row["inspector_narrative"]:
            visit["findings"].append(
                {
                    "description": row["description"],
                    "inspector_narrative": row["inspector_narrative"],
                }
            )
    return list(visits.values())


def quoted_summary(visit: dict, phrase: str) -> str:
    """A sentence from the file, or an honest note when the file has no finding."""
    state = visit["state"]
    texts = [finding_text(item) for item in visit["findings"]]
    if narrative_has_finding(visit["narrative"]):
        texts.insert(0, visit["narrative"])
    summary = prose_summary(state, phrase, texts)
    if (
        "No citation text was included" in summary
        or "not written out as a sentence" in summary
        or "does not include the regulation text" in summary
    ):
        return no_finding_summary(state, phrase, visit.get("outcome"), visit["findings"])
    return summary


def plan_visit(visit: dict) -> tuple[str, str | None]:
    """Return (write|clear|skip, summary)."""
    state = visit["state"]
    phrase = visit_phrase(visit["inspection_type"], visit["is_complaint"])
    current = visit["current"] or ""
    refused = bool(current and REFUSAL_RE.search(current))
    # Unpublished visits with a real narrative stay for the model. A stored
    # refusal is replaced here, published or not, because it is not a summary.
    if not visit["publishable"] and not refused:
        return "skip", None
    # A real inspector narrative still goes to the model. A stored refusal does
    # not: quote the finding that is already on the row.
    if not refused and leave_for_claude(state, visit["narrative"], visit["comments"], visit["findings"]):
        if current and re.search(PLAIN_FRAME_RE, current, re.I):
            return "clear", None
        return "skip", None
    if state == "IL" and not narrative_has_finding(visit["narrative"]):
        lines = [finding_text(item) for item in visit["findings"]]
        summary = illinois_summary(visit["inspection_type"], visit["is_complaint"], lines)
    else:
        summary = quoted_summary(visit, phrase)
    problem = summary_problem(state, summary)
    if problem:
        return "bad", problem
    return "write", summary


def apply_plans(conn, writes: list[tuple[str, str]], clears: list[str]) -> None:
    refusal = REFUSAL_SQL
    with conn.cursor() as cur:
        if clears:
            cur.execute(
                "UPDATE inspections SET narrative_summary = NULL WHERE id = ANY(%s::uuid[])",
                (clears,),
            )
        if writes:
            # One indexed update. Matching id::text made every row a sequential scan.
            cur.execute("CREATE TEMP TABLE summary_load (id uuid, summary text) ON COMMIT DROP")
            with cur.copy("COPY summary_load (id, summary) FROM STDIN") as copy:
                for summary, insp_id in writes:
                    copy.write_row((insp_id, summary))
            cur.execute(
                """
                UPDATE inspections i
                SET narrative_summary = s.summary
                FROM summary_load s
                WHERE i.id = s.id
                  AND (
                    i.narrative_summary IS NULL
                    OR i.narrative_summary ~* %s
                    OR i.narrative_summary ~* %s
                  )
                """,
                (refusal, PLAIN_FRAME_RE),
            )
    conn.commit()


def run_qc(conn) -> int:
    failures: list[str] = []
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT f.state_code,
                   count(*) FILTER (
                     WHERE i.narrative_summary IS NULL
                       AND length(btrim(coalesce(i.raw_data->>'narrative', ''))) < 100
                   ) AS missing_without_narrative,
                   count(*) FILTER (
                     WHERE i.narrative_summary IS NULL
                       AND length(btrim(coalesce(i.raw_data->>'narrative', ''))) >= 100
                   ) AS pending_narrative,
                   count(*) FILTER (
                     WHERE f.state_code = 'IL'
                       AND i.narrative_summary IS NOT NULL
                       AND i.narrative_summary LIKE '%%295.%%'
                       AND i.narrative_summary NOT LIKE %s
                   ) AS missing_disclaimer,
                   count(*) FILTER (
                     WHERE f.state_code <> 'CA'
                       AND i.narrative_summary ~* 'Title 22|\\mCDSS\\M'
                   ) AS california_wording,
                   count(*) FILTER (
                     WHERE i.narrative_summary ~* %s
                   ) AS refusals,
                   count(*) FILTER (
                     WHERE f.state_code = 'IL'
                       AND i.narrative_summary ~* 'fell|died|death|eloped'
                       AND i.narrative_summary LIKE %s
                   ) AS invented_harm
            FROM inspections i
            JOIN facilities f ON f.id = i.facility_id
            WHERE f.publishable
            GROUP BY f.state_code
            ORDER BY f.state_code
            """,
            (
                f"%{DISCLAIMER}%",
                REFUSAL_SQL,
                f"%{DISCLAIMER}%",
            ),
        )
        rows = cur.fetchall()
    print("\nQC — published homes")
    print(f"{'state':<6} {'no text':>8} {'narrative left':>16} {'bad IL':>8} {'CA words':>10} {'refusals':>9}")
    for row in rows:
        print(
            f"{row['state_code']:<6} {row['missing_without_narrative']:>8} "
            f"{row['pending_narrative']:>16} {row['missing_disclaimer'] or 0:>8} "
            f"{row['california_wording'] or 0:>10} {row['refusals'] or 0:>9}"
        )
        if row["missing_without_narrative"]:
            failures.append(f"{row['state_code']}: {row['missing_without_narrative']} published visits still have no summary and no narrative")
        if row["pending_narrative"]:
            failures.append(f"{row['state_code']}: {row['pending_narrative']} published visits still need a narrative summary")
        if row["missing_disclaimer"]:
            failures.append(f"{row['state_code']}: {row['missing_disclaimer']} rule summaries missing the disclaimer")
        if row["california_wording"]:
            failures.append(f"{row['state_code']}: {row['california_wording']} summaries use California wording")
        if row["refusals"]:
            failures.append(f"{row['state_code']}: {row['refusals']} summaries are model refusals")
        if row["invented_harm"]:
            failures.append(f"{row['state_code']}: {row['invented_harm']} rule-only summaries mention an injury")
    if failures:
        print("\nQC failed:")
        for item in failures:
            print(f"  - {item}")
        return 1
    print("\nQC passed.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", default="ALL", help="State code, or ALL")
    parser.add_argument("--apply", action="store_true", help="Write summaries. Without this, print a sample.")
    parser.add_argument(
        "--refresh-plain",
        action="store_true",
        help="Rewrite summaries this script already wrote, after a wording fix.",
    )
    parser.add_argument("--qc", action="store_true", help="Check published homes and exit 1 on a failure.")
    args = parser.parse_args()

    check_examples()
    print("Example translations passed.")

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    state = args.state.upper()
    with psycopg.connect(DATABASE_URL) as conn:
        if args.qc and not args.apply:
            sys.exit(run_qc(conn))

        visits = load_visits(conn, state, refresh=args.refresh_plain)
        writes: list[tuple[str, str]] = []
        clears: list[str] = []
        kinds: Counter[str] = Counter()
        bad: list[str] = []
        samples: list[str] = []

        for visit in visits:
            action, payload = plan_visit(visit)
            if action == "write" and payload:
                writes.append((payload, visit["id"]))
                kinds[visit["state"]] += 1
                if len(samples) < 16 and visit["publishable"]:
                    samples.append(f"[{visit['state']}] {visit.get('name', '')}: {payload}")
            elif action == "clear":
                clears.append(visit["id"])
            elif action == "bad":
                bad.append(f"{visit['state']} {visit['id']}: {payload}")

        print(f"Visits considered: {len(visits)}")
        print(f"Summaries to write: {len(writes)} {dict(kinds)}")
        unnamed = [summary for summary, _ in writes if "no rule number" in summary]
        opaque = [summary for summary, _ in writes if "not written as a readable rule" in summary]
        print(f"Unnumbered rules: {len(unnamed)}  Opaque lines: {len(opaque)}")
        for sample in unnamed[:4] + opaque[:4]:
            print(f"\nEDGE {sample}")
        print(f"Refusals to clear so a narrative can be summarized: {len(clears)}")
        print(f"Rejected before write: {len(bad)}")
        for sample in samples:
            print(f"\n{sample}")
        for item in bad[:10]:
            print(f"BAD {item}")

        if not args.apply:
            print("\nDry run. Pass --apply to write.")
            return

        apply_plans(conn, writes, clears)
        print(f"\nWrote {len(writes)} summaries and cleared {len(clears)} refusals.")
        if args.qc:
            sys.exit(run_qc(conn))


if __name__ == "__main__":
    main()
