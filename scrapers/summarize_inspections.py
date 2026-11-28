#!/usr/bin/env python3
"""
summarize_inspections.py — Generate plain-English summaries for CDSS inspection
narratives using Anthropic Claude.

Each inspection report narrative is dense bureaucratic prose ("LPA arrived
unannounced … Title 22 §87705(c)(2) …"). This script turns them into 2-3
sentence plain-English summaries that families can read at a glance, stored in
inspections.narrative_summary.

Usage:
    python summarize_inspections.py                 # process all unsummarized
    python summarize_inspections.py --smoke         # first 3 records only
    python summarize_inspections.py --dry-run       # print output, no DB writes
    python summarize_inspections.py --refetch       # re-generate existing summaries
    python summarize_inspections.py --facility-id X # one facility only

Requires:
    ANTHROPIC_API_KEY in .env.local
    DATABASE_URL in .env.local
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date

import anthropic
import psycopg
from dotenv import load_dotenv

_SCRAPERS_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRAPERS_DIR not in sys.path:
    sys.path.insert(0, _SCRAPERS_DIR)

from _summary_guard import reject_false_clean_visit
from _wa_summary_guard import strip_unfounded_dementia_contract

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

MODEL = "claude-haiku-4-5-20251001"  # fast + cheap for summarization
TODAY = date.today().strftime("%B %d, %Y")

# claude-haiku-4-5 accepts 200_000 tokens. A report that fits is one call.
# A longer report is split below; these numbers never discard text.
_MODEL_CONTEXT_TOKENS = 200_000
_OUTPUT_TOKENS = 300  # same as max_tokens on the request
_CONTEXT_SLACK_TOKENS = 2_000
_CHARS_PER_TOKEN = 3

# Line-start markers for a new finding. The marker stays with the text after
# it, so a split does not cut a finding that itself fits in one call.
_FINDING_BOUNDARY = re.compile(
    r"(?im)^[ \t]*(?="
    r"deficienc(?:y|ies)\b"
    r"|violations?\b"
    r"|citations?\b"
    r"|findings?\b"
    r"|(?:tag\s+)?f-?\d{3,4}\b"
    r"|section\s+cited\b"
    r")"
)

# Used only inside one finding (or a report with no finding markers) that is
# still larger than the context window. Paragraphs first, then lines,
# sentences, and words. A hard cut is only for a single token with no break.
_OVERFLOW_SPLITS = (
    r"(\n[ \t]*\n)",
    r"(\n)",
    r"((?<=[.!?])[ \t]+)",
    r"([ \t]+)",
)

# ---------------------------------------------------------------------------
# Page-number strip (mirrors the UI-side fix)
# ---------------------------------------------------------------------------
PAGE_NUM_RE = re.compile(r"^(\d+\s+)+")
CONTINUES_RE = re.compile(r"^\*\*\*report continues from LIC9099\*\*\*\s*", re.IGNORECASE)
BOILERPLATE_RE = re.compile(
    r"^(Facility Type:.*?(?=\n\n|\Z)|"
    r"COMP II by CAB.*?(?=\n\n|\Z))",
    re.DOTALL | re.IGNORECASE,
)


def clean_narrative(raw: str) -> str:
    text = PAGE_NUM_RE.sub("", raw)
    text = CONTINUES_RE.sub("", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = f"""You summarize California CDSS inspection and complaint reports for a senior care
transparency website.

Your summaries are read by families — write for them, not for
regulators. Use plain English. Avoid jargon, acronyms (LPA, RCFE, ADL, etc.), and regulatory
citation numbers unless they are the key fact.

Rules:
1. Write exactly 2-3 sentences. No bullet points. No headers.
2. State what kind of visit it was (routine inspection, complaint investigation, follow-up, etc.)
   if clear from the text.
3. State what was found — or, for unsubstantiated complaints, clearly say no violation was found.
4. If a death, injury, or harm is described, state what happened factually. Do not soften it and
   do not amplify it. Let the facts carry the weight — the Type A/B classification already signals
   severity to the reader.
5. Do NOT use evaluative adjectives: "serious", "severe", "significant", "alarming", "concerning",
   "critical", "grave", "egregious", "troubling", "notable", or similar. Describe what happened,
   not how bad it is.
6. Do NOT invent facts not in the source text.
7. Do NOT name specific residents (R1, R2), staff (S1, S2), or inspector names.
8. Do NOT use phrases like "the report states" or "according to the document". Just state the facts.
9. Dates on or before the record date given with each report are real; do not call them future events.
10. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). Never state it as fact."""

SYSTEM_PROMPT_TX = f"""You summarize Texas HHSC LTCR assisted living inspection findings for families.

Describe what the inspection narrative says factually. Same audience rules as CA summaries:
plain English, no evaluative hype words, no invented facts, 2-3 sentences.

Rules:
1. Dates on or before the record date given with each report are real; do not call them future events.
2. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). Never state it as fact."""

SYSTEM_PROMPT_OR = f"""You summarize Oregon DHS Long-Term Care Licensing inspection and complaint
findings for families.

Oregon does NOT use California-style "Type A/Type B" deficiency labels — describe findings using
the regulator's own terminology when present (e.g. "licensing violation", "complaint substantiated").

Rules:
1. Write exactly 2-3 sentences. No bullet points. No headers. No markdown.
2. State what kind of visit it was (routine inspection, complaint investigation, follow-up) when clear.
3. State what was found — or, for unsubstantiated complaints, clearly say no violation was found.
4. If a death, injury, or harm is described, state what happened factually. Do not soften it and
   do not amplify it.
5. Do NOT use evaluative adjectives: "serious", "severe", "significant", "alarming", "concerning",
   "critical", "grave", "egregious", "troubling", "notable", or similar.
6. Do NOT invent facts not in the source text.
7. Do NOT name specific residents (R1, R2), staff (S1, S2), or inspector names.
8. Do NOT use phrases like "the report states" or "according to the document". Just state the facts.
9. Dates on or before the record date given with each report are real; do not call them future events.
10. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). Never state it as fact."""

SYSTEM_PROMPT_WA = f"""You summarize Washington DSHS Residential Care Services inspection and
investigation findings for families.

A Specialized
Dementia Care (SDC) contract is a separate DSHS Medicaid overlay. Most homes do not hold it.
A clean inspection does not mean the home has an SDC contract.

The "DSHS dementia contract" field in the user message is the authority. If it is "no", do
NOT mention Specialized Dementia Care, an SDC contract, SDCP, or dementia-care contract
requirements. If it is "yes", mention that contract only when the narrative itself does.

Washington does NOT use California-style "Type A/Type B" deficiency labels — use the regulator's
own terminology (e.g. "deficiency cited", "investigation substantiated", "enforcement action").

Rules:
1. Write exactly 2-3 sentences. No bullet points. No headers. No markdown.
2. State what kind of visit it was (routine inspection, complaint investigation, follow-up) when clear.
3. State what was found — or, for unsubstantiated complaints, clearly say no violation was found.
4. If a death, injury, or harm is described, state what happened factually.
5. Do NOT use evaluative adjectives ("serious", "alarming", "concerning", etc.).
6. Do NOT invent facts not in the source text.
7. Do NOT name specific residents, staff, or inspectors.
8. Do NOT use "the report states" / "according to the document". Just state the facts.
9. Dates on or before the record date given with each report are real; do not call them future events.
10. Do NOT claim the visit verified a dementia contract the home does not hold.
11. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). Never state it as fact."""

SYSTEM_PROMPT_MN = f"""You summarize Minnesota MDH (Department of Health) inspection and complaint
findings for families.

Findings come from MDH licensing surveys and complaint investigations.
Minnesota does NOT use California-style "Type A/Type B" deficiency labels — use MDH's own
terminology when present (e.g. "correction order", "fine assessed", "complaint findings").

Rules:
1. Write exactly 2-3 sentences. No bullet points. No headers. No markdown.
2. State what kind of visit it was (routine inspection, complaint investigation, follow-up) when clear.
3. State what was found — or, for unsubstantiated complaints, clearly say no violation was found.
4. If a death, injury, or harm is described, state what happened factually.
5. Do NOT use evaluative adjectives ("serious", "alarming", "concerning", etc.).
6. Do NOT invent facts not in the source text.
7. Do NOT name specific residents, staff, or inspectors.
8. Do NOT use "the report states" / "according to the document". Just state the facts.
9. Dates on or before the record date given with each report are real; do not call them future events.
10. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). Never state it as fact."""

SYSTEM_PROMPT_UT = f"""You summarize Utah DLBC (Division of Licensing and Background Checks)
inspection findings for families.

Findings come from DLBC licensing inspections and complaint investigations.
Utah does NOT use California-style "Type A/Type B" deficiency labels — use DLBC's own terminology
(e.g. "noncompliance cited", "correction verified", "civil penalty assessed", "Low/Moderate/High/
Critical noncompliance level").

The input may contain multiple findings from the same inspection visit, each labeled with the
relevant rule number (e.g. R432-270-18). Summarize the inspection visit as a whole in 2-3 sentences.

IMPORTANT — inspection type: The "Inspection type" field provided is the authoritative visit type.
Use it — do not override it based on language in the narrative text. Follow-up inspections check
whether violations from a prior annual inspection were corrected; the narrative may reference that
original annual inspection, but this visit is still a follow-up, not an annual inspection.

Rules:
1. Write exactly 2-3 sentences covering the visit as a whole. No bullet points. No headers. No markdown.
2. Use the provided inspection type to describe the visit (e.g. "a follow-up inspection", "a complaint
   investigation", "a monitoring visit", "a routine annual inspection").
3. State what was found — describe the nature of the violations, not just their count.
4. If a death, injury, or harm is described, state what happened factually. Do not soften it.
5. Do NOT use evaluative adjectives ("serious", "alarming", "concerning", "egregious", etc.).
6. Do NOT invent facts not in the source text.
7. Do NOT name specific residents, staff, or inspectors.
8. Do NOT use "the report states" / "according to the document". Just state the facts.
9. Dates on or before the record date given with each report are real; do not call them future events.
10. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). Never state it as fact."""

SYSTEM_PROMPT_IL = f"""You summarize Illinois IDPH (Department of Public Health) Division of Assisted
Living inspection and complaint findings for families.

Violations are classified as
Type 1 (most severe), Type 2, or Type 3 — not California-style "Type A/Type B". There are no
federal F-tags in Illinois ALE/SHE inspections.

Survey types include:
  COI = Complaint Original Investigation
  FRI = Facility Reported Incident
  L/SP = Special Survey
  FIC = Focused Infection Control

Rules:
1. Write exactly 2-3 sentences. No bullet points. No headers. No markdown.
2. State what kind of visit it was (complaint investigation, facility-reported incident, special
   survey, follow-up) when clear from the inspection type.
3. If the source names a rule, a fine, or a violation class, say that. If it does not describe
   what the inspector saw, say the file does not describe the incident. Do not invent an
   incident from a rule number. A citation of section 295.4060 is a citation of the
   dementia-program rule, not proof the home has a memory-care designation.
4. If a death, injury, or harm is described, state what happened factually. Do not soften it and
   do not amplify it.
5. Do NOT use evaluative adjectives: "serious", "severe", "significant", "alarming", "concerning",
   "critical", "grave", "egregious", "troubling", "notable", or similar.
6. Do NOT invent facts not in the source text.
7. Do NOT name specific residents, staff, or inspectors.
8. Do NOT use "the report states" / "according to the document". Just state the facts.
9. Dates on or before the record date given with each report are real; do not call them future events.
10. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). Never state it as fact."""

# Map state code to system prompt — explicit branching keeps prompt selection auditable.
SYSTEM_PROMPT_CO = f"""You summarize Colorado CDPHE assisted-living inspection and complaint
findings for families.

Findings use Colorado Level A through E. Level E is immediate jeopardy. Do not call these California
Type A or Type B citations, and do not call them CMS F-tags.

The text is the inspector's citation or survey comment. A short outcome such as
"Unsubstantiated" means no violation was confirmed. Do not invent a finding from a tag
number alone.

Rules:
1. Write exactly 2-3 sentences. No bullet points. No headers. No markdown.
2. State what kind of visit it was when the inspection type makes that clear.
3. State what was found, or say no violation was confirmed when the outcome is unsubstantiated.
4. If a death, injury, or harm is described, state what happened factually.
5. Do NOT use evaluative adjectives ("serious", "alarming", "concerning", "egregious", and similar).
6. Do NOT invent facts not in the source text.
7. Do NOT name specific residents, staff, or inspectors.
8. Do NOT use "the report states" or "according to the document".
9. Dates on or before the record date given with each report are real; do not call them future events.
10. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). Never state it as fact."""

SYSTEM_PROMPT_PA = f"""You summarize Pennsylvania Department of Human Services inspection and complaint
findings for families.

The text may be
the inspector's narrative, or it may only be the requirement the survey cited. If the
text is a requirement, say that requirement was cited. Do not describe an incident that
is not written in the text. Do not mention California, Title 22, or CDSS.

Rules:
1. Write exactly 2-3 sentences. No bullet points. No headers. No markdown.
2. Use the inspection type that was provided.
3. Do NOT invent facts not in the source text.
4. Do NOT use evaluative adjectives ("serious", "alarming", "concerning", "egregious", and similar).
5. Do NOT name specific residents, staff, or inspectors.
6. Dates on or before the record date given with each report are real; do not call them future events.
7. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). Never state it as fact."""

SYSTEM_PROMPT_AZ = f"""You summarize Arizona Department of Health Services assisted-living inspection
and complaint findings for families.

The text may be an inspector's account ("based on observation") or a quotation of an
Arizona administrative rule. If it is a rule, say the survey cited that requirement.
Do not turn a rule quotation into a story about what happened. Do not mention California,
Title 22, or CDSS.

Rules:
1. Write exactly 2-3 sentences. No bullet points. No headers. No markdown.
2. Use the inspection type that was provided.
3. Do NOT invent facts not in the source text.
4. Do NOT use evaluative adjectives ("serious", "alarming", "concerning", "egregious", and similar).
5. Do NOT name specific residents, staff, or inspectors.
6. Dates on or before the record date given with each report are real; do not call them future events.
7. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). Never state it as fact."""

SYSTEM_PROMPT_MO = f"""You summarize Missouri Department of Health and Senior Services inspection and
complaint findings for families.

Use only the text provided. Do not say the home has a memory-care designation unless the
text says that. Do not cite 19 CSR 30-86.047 or section 198.510 unless those citations
appear in the text. Do not mention California, Title 22, or CDSS.

Rules:
1. Write exactly 2-3 sentences. No bullet points. No headers. No markdown.
2. Use the inspection type that was provided.
3. Do NOT invent facts not in the source text.
4. Do NOT use evaluative adjectives ("serious", "alarming", "concerning", "egregious", and similar).
5. Do NOT name specific residents, staff, or inspectors.
6. Dates on or before the record date given with each report are real; do not call them future events.
7. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). Never state it as fact."""

SYSTEM_PROMPT_GENERIC = f"""You summarize a state inspection or complaint record for families.

Use only the text provided. If the text is a regulation the survey cited, say that
requirement was cited. Do not describe an incident that is not written in the text.
Do not mention California, Title 22, or CDSS unless those words appear in the text.
Do not apply another state's violation labels.

Rules:
1. Write exactly 2-3 sentences. No bullet points. No headers. No markdown.
2. Use the inspection type that was provided.
3. Do NOT invent facts not in the source text.
4. Do NOT use evaluative adjectives ("serious", "alarming", "concerning", "egregious", and similar).
5. Do NOT name specific residents, staff, or inspectors.
6. Dates on or before the record date given with each report are real; do not call them future events.
7. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). Never state it as fact."""

SYSTEM_PROMPTS_BY_STATE = {
    "CA": SYSTEM_PROMPT,
    "TX": SYSTEM_PROMPT_TX,
    "OR": SYSTEM_PROMPT_OR,
    "WA": SYSTEM_PROMPT_WA,
    "MN": SYSTEM_PROMPT_MN,
    "UT": SYSTEM_PROMPT_UT,
    "IL": SYSTEM_PROMPT_IL,
    "CO": SYSTEM_PROMPT_CO,
    "PA": SYSTEM_PROMPT_PA,
    "AZ": SYSTEM_PROMPT_AZ,
    "MO": SYSTEM_PROMPT_MO,
}

USER_TEMPLATE = """Inspection type: {inspection_type}
Is complaint: {is_complaint}
Outcome (if complaint): {outcome}
DSHS dementia contract: {dementia_contract}
Cited deficiencies on file: {deficiency_count}
Record date (state database): {record_date}

Narrative:
{narrative}

Write a 2-3 sentence plain-English summary for families.
{deficiency_instruction}"""


# ---------------------------------------------------------------------------
# Claude call
# ---------------------------------------------------------------------------


def _break_on(text: str, separator: str) -> list[str]:
    """Split text and keep every character. Each separator stays with the next piece."""
    parts = re.split(separator, text)
    if len(parts) == 1:
        return [text]
    pieces: list[str] = []
    if parts[0]:
        pieces.append(parts[0])
    index = 1
    while index < len(parts):
        sep = parts[index]
        rest = parts[index + 1] if index + 1 < len(parts) else ""
        pieces.append(sep + rest)
        index += 2
    return pieces


def _finding_segments(text: str) -> list[str] | None:
    cuts = [match.start() for match in _FINDING_BOUNDARY.finditer(text) if match.start() > 0]
    if not cuts:
        return None
    pieces: list[str] = []
    previous = 0
    for start in cuts:
        pieces.append(text[previous:start])
        previous = start
    pieces.append(text[previous:])
    return pieces


def _split_oversized(text: str, budget: int, pattern_index: int = 0) -> list[str]:
    """Break one piece that is larger than one call. Does not drop characters."""
    if len(text) <= budget:
        return [text]
    if pattern_index >= len(_OVERFLOW_SPLITS):
        return [text[i : i + budget] for i in range(0, len(text), budget)]
    parts = _break_on(text, _OVERFLOW_SPLITS[pattern_index])
    if len(parts) == 1:
        return _split_oversized(text, budget, pattern_index + 1)
    chunks: list[str] = []
    buf = ""
    for part in parts:
        if len(part) > budget:
            if buf:
                chunks.append(buf)
                buf = ""
            chunks.extend(_split_oversized(part, budget, pattern_index + 1))
            continue
        if buf and len(buf) + len(part) > budget:
            chunks.append(buf)
            buf = part
        else:
            buf += part
    if buf:
        chunks.append(buf)
    return chunks


def _pack(segments: list[str], budget: int) -> list[str]:
    chunks: list[str] = []
    buf = ""
    for segment in segments:
        if len(segment) > budget:
            if buf:
                chunks.append(buf)
                buf = ""
            chunks.extend(_split_oversized(segment, budget))
            continue
        if buf and len(buf) + len(segment) > budget:
            chunks.append(buf)
            buf = segment
        else:
            buf += segment
    if buf:
        chunks.append(buf)
    return chunks


def _chunks_for_model(text: str, budget: int) -> list[str]:
    """Pieces that each fit in one model call. Joining them returns text."""
    if budget < 1:
        raise ValueError("narrative budget must be positive")
    if len(text) <= budget:
        return [text]
    segments = _finding_segments(text)
    if segments is None:
        segments = _break_on(text, _OVERFLOW_SPLITS[0])
    chunks = _pack(segments, budget)
    if "".join(chunks) != text:
        raise RuntimeError("report split dropped text")
    return chunks


def _narrative_budget(system: str, template_overhead: str) -> int:
    reserved = _OUTPUT_TOKENS + _CONTEXT_SLACK_TOKENS
    used = (len(system) + len(template_overhead)) // _CHARS_PER_TOKEN
    room = _MODEL_CONTEXT_TOKENS - reserved - used
    if room < 1:
        room = 1
    return room * _CHARS_PER_TOKEN


def _user_message(
    inspection_type: str,
    is_complaint: bool,
    outcome: str | None,
    dementia_contract: str,
    deficiency_count: int,
    record_date: str | None,
    narrative: str,
    deficiency_instruction: str,
) -> str:
    return USER_TEMPLATE.format(
        inspection_type=inspection_type or "visit",
        is_complaint="Yes" if is_complaint else "No",
        outcome=outcome or "N/A",
        dementia_contract=dementia_contract,
        deficiency_count=deficiency_count,
        record_date=record_date or "unknown",
        narrative=narrative,
        deficiency_instruction=deficiency_instruction,
    )


def _complete_summary(
    client: anthropic.Anthropic,
    *,
    system: str,
    user_msg: str,
    state_code: str,
    holds_sdc: bool,
    deficiency_count: int,
    narrative: str,
) -> str | None:
    for attempt in range(5):
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=_OUTPUT_TOKENS,
                system=system,
                messages=[{"role": "user", "content": user_msg}],
            )
            text = resp.content[0].text.strip()
            if re.search(
                r"\b(I don't|I do not|I cannot|I can't|I can not)\b|please provide|to write an accurate",
                text,
                re.I,
            ):
                print("    Claude refused")
                return None
            if text.startswith("#"):
                print("    Claude refused")
                return None
            if state_code.upper() != "CA" and re.search(r"\b(Title 22|CDSS)\b", text):
                print("    rejected California wording on a non-CA record")
                return None
            if state_code.upper() == "WA":
                text = strip_unfounded_dementia_contract(text, holds_sdc)
                if not text:
                    print("    rejected unfounded Specialized Dementia Care claim")
                    return None
            if reject_false_clean_visit(
                text,
                deficiency_count=deficiency_count,
                source_text=narrative,
            ):
                print("    rejected clean-visit claim on a cited inspection")
                return None
            return text
        except Exception as e:
            message = str(e).lower()
            if attempt < 4 and any(token in message for token in ("429", "rate", "overloaded", "529")):
                time.sleep(min(30, 2 ** attempt))
                continue
            print(f"    Claude error: {e}")
            return None
    return None


def summarize(
    client: anthropic.Anthropic,
    inspection_type: str,
    is_complaint: bool,
    outcome: str | None,
    narrative: str,
    *,
    state_code: str = "CA",
    holds_sdc: bool = False,
    deficiency_count: int = 0,
    record_date: str | None = None,
) -> str | None:
    if not (narrative or "").strip():
        return None
    if state_code.upper() == "WA":
        dementia_contract = "yes" if holds_sdc else "no"
    else:
        dementia_contract = "n/a"
    if deficiency_count > 0:
        deficiency_instruction = (
            "This visit has cited deficiencies on file. Do not say no deficiencies "
            "were cited, that the home was in compliance, that findings were "
            "unspecified, or that the report does not say whether anything was cited."
        )
    else:
        deficiency_instruction = ""
    system = SYSTEM_PROMPTS_BY_STATE.get(state_code.upper(), SYSTEM_PROMPT_GENERIC)
    overhead = _user_message(
        inspection_type,
        is_complaint,
        outcome,
        dementia_contract,
        deficiency_count,
        record_date,
        "",
        deficiency_instruction,
    )
    chunks = _chunks_for_model(narrative, _narrative_budget(system, overhead))
    parts: list[str] = []
    for chunk in chunks:
        text = _complete_summary(
            client,
            system=system,
            user_msg=_user_message(
                inspection_type,
                is_complaint,
                outcome,
                dementia_contract,
                deficiency_count,
                record_date,
                chunk,
                deficiency_instruction,
            ),
            state_code=state_code,
            holds_sdc=holds_sdc,
            deficiency_count=deficiency_count,
            narrative=narrative,
        )
        if not text:
            return None
        parts.append(text)
    if len(parts) == 1:
        return parts[0]
    combined = " ".join(parts)
    if reject_false_clean_visit(
        combined,
        deficiency_count=deficiency_count,
        source_text=narrative,
    ):
        print("    rejected clean-visit claim on a cited inspection")
        return None
    return combined


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="Process first 3 records only")
    parser.add_argument("--dry-run", action="store_true", help="Print summaries, no DB writes")
    parser.add_argument("--refetch", action="store_true", help="Re-generate existing summaries")
    parser.add_argument("--facility-id", help="Only process inspections for this facility UUID")
    parser.add_argument(
        "--state",
        default="CA",
        help="Only summarize inspections for facilities in this state (default: CA)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Parallel Claude calls. Ingest scripts stay at 1.",
    )
    parser.add_argument(
        "--publishable",
        action="store_true",
        help="Only inspections on homes that are currently published.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max inspections to summarize this run.",
    )
    args = parser.parse_args()

    if not ANTHROPIC_API_KEY and not args.dry_run:
        print("ERROR: ANTHROPIC_API_KEY not set in .env.local")
        sys.exit(1)
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if not args.dry_run else None

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            params: list = []
            if args.state.upper() == "CO":
                # Colorado stores the inspector's words on the citation, not in
                # raw_data.narrative. CMS tag statements are the rule text, so
                # they are left out of this summary.
                where_parts = [
                    "i.source_agency = 'CO-CDPHE'",
                    """(
                        EXISTS (
                            SELECT 1 FROM deficiencies d
                            WHERE d.inspection_id = i.id
                              AND length(btrim(coalesce(d.inspector_narrative, ''))) >= 80
                        )
                        OR (
                            length(btrim(coalesce(i.raw_data->>'inspection_comments', ''))) >= 120
                            AND i.raw_data->>'inspection_comments' NOT LIKE 'Citation coded%%'
                        )
                    )""",
                ]
                if not args.refetch:
                    where_parts.append("i.narrative_summary IS NULL")
                if args.facility_id:
                    where_parts.append("i.facility_id = %s")
                    params.append(args.facility_id)
                where_parts.append("f.state_code = %s")
                params.append("CO")
                if args.publishable:
                    where_parts.append("f.publishable = true")
                cur.execute(
                    f"""
                    SELECT i.id, i.inspection_type, i.is_complaint,
                           i.raw_data->>'complaint_findings',
                           concat_ws(
                             E'\\n\\n',
                             CASE
                               WHEN length(btrim(coalesce(i.raw_data->>'inspection_comments', ''))) >= 120
                                AND i.raw_data->>'inspection_comments' NOT LIKE 'Citation coded%%'
                               THEN i.raw_data->>'inspection_comments'
                             END,
                             (
                               SELECT string_agg(d.inspector_narrative, E'\\n\\n' ORDER BY d.code)
                               FROM deficiencies d
                               WHERE d.inspection_id = i.id
                                 AND length(btrim(coalesce(d.inspector_narrative, ''))) >= 80
                             )
                           ),
                           f.name, f.state_code, false,
                           GREATEST(
                             COALESCE(i.total_deficiency_count, 0),
                             (SELECT count(*)::int FROM deficiencies d WHERE d.inspection_id = i.id)
                           ) AS def_count,
                           i.inspection_date
                    FROM inspections i
                    JOIN facilities f ON f.id = i.facility_id
                    WHERE {" AND ".join(where_parts)}
                    ORDER BY f.name, i.inspection_date DESC
                    """,
                    params,
                )
            else:
                where_parts = [
                    "length(btrim(coalesce(raw_data->>'narrative', ''))) > 0",
                ]
                if not args.refetch:
                    where_parts.append("narrative_summary IS NULL")
                if args.facility_id:
                    where_parts.append("facility_id = %s")
                    params.append(args.facility_id)
                where_parts.append("f.state_code = %s")
                params.append(args.state.upper())
                if args.publishable:
                    where_parts.append("f.publishable = true")
                cur.execute(
                    f"""
                    SELECT i.id, i.inspection_type, i.is_complaint,
                           i.raw_data->>'outcome', i.raw_data->>'narrative',
                           f.name, f.state_code,
                           (
                             COALESCE(f.wa_dementia_care_contract, false)
                             OR COALESCE(f.wa_earc_sdc_contracted, false)
                             OR EXISTS (
                               SELECT 1
                               FROM unnest(COALESCE(f.wa_contract_types, ARRAY[]::text[])) AS t(label)
                               WHERE t.label ~* 'dementia|memory care|sdc'
                             )
                           ) AS holds_sdc,
                           GREATEST(
                             COALESCE(i.total_deficiency_count, 0),
                             (SELECT count(*)::int FROM deficiencies d WHERE d.inspection_id = i.id)
                           ) AS def_count,
                           i.inspection_date
                    FROM inspections i
                    JOIN facilities f ON f.id = i.facility_id
                    WHERE {" AND ".join(where_parts)}
                    ORDER BY f.name, i.inspection_date DESC
                    """,
                    params,
                )
            rows = cur.fetchall()

    print(f"Records to summarize: {len(rows)}")
    if not rows:
        print("Nothing to do.")
        return

    if args.smoke:
        rows = rows[:3]
    elif args.limit is not None:
        rows = rows[: args.limit]
        print(f"Capped to {len(rows)} (--limit {args.limit})")

    workers = max(1, args.workers)
    processed = 0
    succeeded = 0
    failed = 0
    skipped_empty = 0
    not_written = 0

    def _summarize_row(row):
        (
            insp_id,
            insp_type,
            is_complaint,
            outcome,
            raw_narrative,
            fac_name,
            st_code,
            holds_sdc,
            def_count,
            insp_date,
        ) = row
        if not (raw_narrative or "").strip():
            return insp_id, fac_name, None, "empty"
        narrative = clean_narrative(raw_narrative)
        if not narrative:
            return insp_id, fac_name, None, "empty"
        if args.dry_run:
            return insp_id, fac_name, narrative[:150], "dry"
        if client is None:
            return insp_id, fac_name, None, "fail"
        summary = summarize(
            client,
            insp_type or "visit",
            bool(is_complaint),
            outcome,
            narrative,
            state_code=st_code or "CA",
            holds_sdc=bool(holds_sdc),
            deficiency_count=int(def_count or 0),
            record_date=str(insp_date) if insp_date else None,
        )
        if not summary:
            return insp_id, fac_name, None, "fail"
        return insp_id, fac_name, summary, "ok"

    with psycopg.connect(DATABASE_URL) as conn:
        def _record(result):
            nonlocal processed, succeeded, failed
            insp_id, fac_name, summary, status = result
            processed += 1
            if status == "empty":
                skipped_empty += 1
                if workers == 1:
                    print(f"\n→ {fac_name[:45]}\n  — Empty source text, skipping")
                return
            if status == "dry":
                print(f"\n→ {fac_name[:45]}\n  [dry-run] {summary}")
                return
            if status != "ok" or not summary:
                failed += 1
                print(f"\n→ {fac_name[:45]}\n  ✗ Summary generation failed")
                return
            with conn.cursor() as cur:
                if args.refetch:
                    cur.execute(
                        """
                        UPDATE inspections
                        SET narrative_summary = %s
                        WHERE id = %s
                        """,
                        (summary, insp_id),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE inspections
                        SET narrative_summary = %s
                        WHERE id = %s AND narrative_summary IS NULL
                        """,
                        (summary, insp_id),
                    )
                wrote = cur.rowcount > 0
                conn.commit()
            if not wrote:
                not_written += 1
                why = (
                    "row missing"
                    if args.refetch
                    else "row already had a summary"
                )
                print(f"\n→ {fac_name[:45]}\n  — Generated but not saved ({why})")
                return
            succeeded += 1
            if workers == 1 or processed % 25 == 0 or processed == len(rows):
                print(f"  ✓ {processed}/{len(rows)} {str(fac_name)[:40]}: {summary[:110]}")

        if workers == 1:
            for row in rows:
                result = _summarize_row(row)
                _record(result)
                if result[3] == "fail":
                    time.sleep(0.5)
                elif result[3] == "ok":
                    time.sleep(0.15)
        else:
            print(f"Running {workers} workers.", flush=True)
            with ThreadPoolExecutor(max_workers=workers) as pool:
                futures = [pool.submit(_summarize_row, row) for row in rows]
                for future in as_completed(futures):
                    _record(future.result())

    print(
        f"\nDone. {succeeded} saved, {failed} failed, "
        f"{skipped_empty} empty source, {not_written} not written, "
        f"{processed} processed."
    )


if __name__ == "__main__":
    main()
