#!/usr/bin/env python3
"""
summarize_inspections.py — Generate plain-English summaries for CDSS inspection
narratives using Anthropic Claude.

Each inspection report narrative is dense bureaucratic prose ("LPA arrived
unannounced … Title 22 §87705(c)(2) …"). This script turns them into 2-3
sentence plain-English summaries that families can read at a glance, stored in
inspections.narrative_summary.

Usage:
    python summarize_inspections.py                 # dry run: print only, write nothing
    python summarize_inspections.py --dry-run       # same as the default
    python summarize_inspections.py --write         # save narrative_summary
    python summarize_inspections.py --smoke         # first 3 records only
    python summarize_inspections.py --refetch       # re-generate existing summaries
    python summarize_inspections.py --facility-id X # one facility only

Requires:
    ANTHROPIC_API_KEY in .env.local
    DATABASE_URL in .env.local
"""

from __future__ import annotations

import argparse
import json
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
from _extractive_merge import EXTRACT_SYSTEM_PROMPT, merge_items, parse_items, render_items
from _summary_assemble import (
    assemble_summary,
    build_header,
    description_problems,
    latest_assessed_penalty,
    parse_descriptions,
    regulator_sentence,
)
from _summary_ground import (
    directive_problem,
    evidence_text,
    fallback_problem,
    invented_requirement,
    is_factual_hold,
    is_regulation_text,
    mn_evidence,
    or_real_tag_count,
    rank_by_severity,
    tag_dump_problem,
    tag_span,
    visit_type_conflict,
)
from mn_defs import tag_codes

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# The model id comes from MODEL_PROFILE. There is no default.
TODAY = date.today().strftime("%B %d, %Y")


def model_name() -> str | None:
    """Profile named by MODEL_PROFILE in scrapers/model_config.json. Unset or unknown -> None."""
    profile = os.environ.get("MODEL_PROFILE", "").strip()
    if not profile:
        return None
    path = os.path.join(_SCRAPERS_DIR, "model_config.json")
    with open(path, encoding="utf-8") as fh:
        profiles = json.load(fh).get("profiles", {})
    entry = profiles.get(profile)
    if not isinstance(entry, dict):
        return None
    chosen = entry.get("model")
    if not isinstance(chosen, str) or not chosen.strip():
        return None
    return chosen


_FOLLOWUP_PLAN: dict[str, tuple[str, str]] | None = None


def followup_for(inspection_id: str | None) -> tuple[str, str] | None:
    """Printed amount and letter date for a follow-up fine, or None."""
    global _FOLLOWUP_PLAN
    if not inspection_id:
        return None
    if _FOLLOWUP_PLAN is None:
        path = os.path.join(_SCRAPERS_DIR, "followup_fine_label_plan.json")
        with open(path, encoding="utf-8") as fh:
            rows = json.load(fh)["rows"]
        _FOLLOWUP_PLAN = {
            row["inspection_id"]: (row["printed_amount"], row["followup_letter_date_display"])
            for row in rows
        }
    return _FOLLOWUP_PLAN.get(str(inspection_id))

# claude-haiku-4-5 accepts 200_000 tokens. A report that fits is one call.
# A longer report is split below; these numbers never discard text.
_MODEL_CONTEXT_TOKENS = 200_000
_OUTPUT_TOKENS = 300  # kept for the context-budget math
_EXTRACT_TOKENS = 1_500  # per-chunk item extraction (long reports only)
_DESCRIBE_TOKENS = 4_096  # one plain-language sentence per finding; 300 cuts a long list off
_MAX_SUMMARY_CHARS = 750  # hard limit (v6/v7 rule 1)
_NO_FINDINGS = "NO FINDINGS IN TEXT"
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

# v7 core rules (27 Nov 2026): extractive, the report's own actor nouns, allowed elements only.
# Every state prompt = state header + state-specific rules + these rules.
_V7_CORE_RULES = """Rules (v7, every state). The summary is extractive: it repeats what the report says, close to the
report's own wording, and nothing else.
1. Write 2-3 sentences, at most 750 characters in total. No bullet points, headers, or markdown.
2. Include only these items, and only when the report states them:
   a. the visit type, named as the report names it;
   b. what was found, close to the report's own wording;
   c. the number of deficiencies, citations, violations, or correction orders, exactly as the report states
      it or as "Cited deficiencies on file" gives it; never a number you counted or added up yourself;
   d. a fine, exactly as stated, keeping each component amount the report lists;
   e. that something was corrected, only if the report says it was corrected;
   f. for a complaint, the outcome (substantiated, not substantiated, unfounded, inconclusive) only as the
      report states it; if the report says no deficiency or violation was cited, say so in its words.
   Nothing else: no background, no causes, no consequences, no advice.
3. Actors: name every person or body with the report's own noun, exactly as written, such as "the licensee",
   "the facility", "the administrator", "staff", "the analyst", "the Department", "the surveyor", "the
   inspector". Never swap one for another: a licensee is not "staff" or "management"; one analyst is not
   "inspectors"; "the Department" is not "the state". Use the noun that each finding's own sentence uses.
   If the report does not say who did something, do not name an actor.
4. Anything a resident, family member, or staff member said, reported, or told the inspector must be
   attributed to that person (e.g. "the resident said", "staff told the analyst"). This includes times,
   durations, counts and events that appear only in someone's statement. Never state it as fact.
5. Numbers and scope exactly as written: "one resident" stays one resident; "two of five records" stays two
   of five; do not turn "some" into "all" or a single event into a pattern.
6. Name specific items as the report names them (the device, the record, the training). Do not replace
   them with a category label such as "care-plan problems", "staffing issues", or "safety concerns".
7. No characterizing or outcome words that the report does not use: adequate, inadequate, proper,
   properly, appropriate, sufficient, deliberately, intentionally, overstated, neglected, ignored,
   "in compliance", "resulting in", "as a result", "because", "implemented measures". No evaluative
   adjectives: serious, severe, significant, alarming, concerning, critical, grave, egregious, troubling,
   notable, or similar.
8. If the report gives two different values for the same fact, or a fact is unclear, leave that fact out.
9. Dates on or before the record date given with each report are real; do not call them future events.
   A plan-of-correction or "correct by" date is a deadline, not an event. Copy no relative time words
   ("today", "this visit" as a date); use the date or leave it out.
10. Do NOT name residents, staff, or inspectors, and do NOT write their identifiers (R1, Resident 114, S1,
    Staff 4, LALD-D, CNS-A, ULP-E, AP); write the role the report gives. Do NOT write "the report states"
    or "according to the document". Avoid acronyms and rule numbers unless they are the key fact.
11. Lists: if you give a count and then a list, the list must include every counted item; otherwise give
    the count alone, or name one or two items with "including".
12. If the report lists several visit types (e.g. "Complaint, Re-Licensure"), name them all or none.
13. If the text has no findings, outcomes, or observations (only form instructions or boilerplate),
    reply exactly: NO FINDINGS IN TEXT"""


SYSTEM_PROMPT = (
    """You summarize California CDSS inspection and complaint reports for a senior care
transparency website.

Your summaries are read by families — write for them, not for
regulators. Use plain English. Avoid jargon, acronyms (LPA, RCFE, ADL, etc.), and regulatory
citation numbers unless they are the key fact.

"""
    + _V7_CORE_RULES
)

SYSTEM_PROMPT_TX = (
    """You summarize Texas HHSC LTCR assisted living inspection findings for families.

Describe what the inspection narrative says factually. Same audience rules as CA summaries:
plain English, no evaluative hype words, no invented facts, 2-3 sentences.

"""
    + _V7_CORE_RULES
)

SYSTEM_PROMPT_OR = (
    """You summarize Oregon DHS Long-Term Care Licensing inspection and complaint
findings for families.

Oregon does NOT use California-style "Type A/Type B" deficiency labels — describe findings using
the regulator's own terminology when present (e.g. "licensing violation", "complaint substantiated").

"""
    + _V7_CORE_RULES
)

SYSTEM_PROMPT_WA = (
    """You summarize Washington DSHS Residential Care Services inspection and
investigation findings for families.

A Specialized
Dementia Care (SDC) contract is a separate DSHS Medicaid overlay. Most homes do not hold it.
A clean inspection does not mean the home has an SDC contract.

The "DSHS dementia contract" field in the user message is the authority. If it is "no", do
NOT mention Specialized Dementia Care, an SDC contract, SDCP, or dementia-care contract
requirements. If it is "yes", mention that contract only when the narrative itself does.

Washington does NOT use California-style "Type A/Type B" deficiency labels — use the regulator's
own terminology (e.g. "deficiency cited", "investigation substantiated", "enforcement action").

State-specific rules:
- Do NOT claim the visit verified a dementia contract the home does not hold.

"""
    + _V7_CORE_RULES
)

SYSTEM_PROMPT_MN = (
    """You summarize Minnesota MDH (Department of Health) inspection and complaint
findings for families.

Findings come from MDH licensing surveys and complaint investigations.
Minnesota does NOT use California-style "Type A/Type B" deficiency labels — use MDH's own
terminology when present (e.g. "correction order", "fine assessed", "complaint findings").

"""
    + _V7_CORE_RULES
)

SYSTEM_PROMPT_UT = (
    """You summarize Utah DLBC (Division of Licensing and Background Checks)
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

State-specific rules:
- Use the provided inspection type to describe the visit (e.g. "a follow-up inspection", "a complaint
   investigation", "a monitoring visit", "a routine annual inspection").

"""
    + _V7_CORE_RULES
)

SYSTEM_PROMPT_IL = (
    """You summarize Illinois IDPH (Department of Public Health) Division of Assisted
Living inspection and complaint findings for families.

Violations are classified as
Type 1 (most severe), Type 2, or Type 3 — not California-style "Type A/Type B". There are no
federal F-tags in Illinois ALE/SHE inspections.

Survey types include:
  COI = Complaint Original Investigation
  FRI = Facility Reported Incident
  L/SP = Special Survey
  FIC = Focused Infection Control

State-specific rules:
- State what kind of visit it was (complaint investigation, facility-reported incident, special
   survey, follow-up) when clear from the inspection type.
- If the source names a rule, a fine, or a violation class, say that. If it does not describe
   what the inspector saw, say the file does not describe the incident. Do not invent an
   incident from a rule number. A citation of section 295.4060 is a citation of the
   dementia-program rule, not proof the home has a memory-care designation.

"""
    + _V7_CORE_RULES
)

# Map state code to system prompt — explicit branching keeps prompt selection auditable.
SYSTEM_PROMPT_CO = (
    """You summarize Colorado CDPHE assisted-living inspection and complaint
findings for families.

Findings use Colorado Level A through E. Level E is immediate jeopardy. Do not call these California
Type A or Type B citations, and do not call them CMS F-tags.

The text is the inspector's citation or survey comment. A short outcome such as
"Unsubstantiated" means no violation was confirmed. Do not invent a finding from a tag
number alone.

State-specific rules:
- A short outcome such as "Unsubstantiated" means no violation was confirmed; say that, in those words.

"""
    + _V7_CORE_RULES
)

SYSTEM_PROMPT_PA = (
    """You summarize Pennsylvania Department of Human Services inspection and complaint
findings for families.

The text may be
the inspector's narrative, or it may only be the requirement the survey cited. If the
text is a requirement, say that requirement was cited. Do not describe an incident that
is not written in the text. Do not mention California, Title 22, or CDSS.

State-specific rules:
- Use the inspection type that was provided.

"""
    + _V7_CORE_RULES
)

SYSTEM_PROMPT_AZ = (
    """You summarize Arizona Department of Health Services assisted-living inspection
and complaint findings for families.

The text may be an inspector's account ("based on observation") or a quotation of an
Arizona administrative rule. If it is a rule, say the survey cited that requirement.
Do not turn a rule quotation into a story about what happened. Do not mention California,
Title 22, or CDSS.

State-specific rules:
- Use the inspection type that was provided.

"""
    + _V7_CORE_RULES
)

SYSTEM_PROMPT_MO = (
    """You summarize Missouri Department of Health and Senior Services inspection and
complaint findings for families.

Use only the text provided. Do not say the home has a memory-care designation unless the
text says that. Do not cite 19 CSR 30-86.047 or section 198.510 unless those citations
appear in the text. Do not mention California, Title 22, or CDSS.

State-specific rules:
- Use the inspection type that was provided.

"""
    + _V7_CORE_RULES
)

SYSTEM_PROMPT_GENERIC = (
    """You summarize a state inspection or complaint record for families.

Use only the text provided. If the text is a regulation the survey cited, say that
requirement was cited. Do not describe an incident that is not written in the text.
Do not mention California, Title 22, or CDSS unless those words appear in the text.
Do not apply another state's violation labels.

State-specific rules:
- Use the inspection type that was provided.

"""
    + _V7_CORE_RULES
)

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

# The live call asks for finding descriptions only. Counts, dates, and penalties are added in code.
DESCRIBE_SYSTEM_PROMPT = """You describe inspection findings in plain words for families.

Reply with ONLY a JSON array, no prose. One object per finding:
{"tag": "<the tag or rule number printed on that finding, or null>", "description": "<plain words>"}

Each description is plain words only:
- no digits, no dollar signs, no dates, no times
- no resident, staff, or inspector identifiers
- do not write "the report says", "the report states", or "the report lists"
- no evaluative adjectives such as serious, severe, significant, alarming, or similar
- do not write "best", "top-rated", or "does not offer memory care"
- use "licensee" or "facility" exactly as that finding writes it
- end with a period, and do not run two findings together
- use only words from that finding, after any "not met as evidenced by" line
- keep a partial count (one out of six) partial; do not turn the rule text into the finding
- do not add a count, a penalty, or a visit type

If the text has no findings, reply exactly: NO FINDINGS IN TEXT"""

USER_TEMPLATE = """Inspection type: {inspection_type}
Is complaint: {is_complaint}
Outcome (if complaint): {outcome}
DSHS dementia contract: {dementia_contract}
Cited deficiencies on file: {deficiency_count}
Record date (state database): {record_date}

Narrative:
{narrative}

Reply with ONLY a JSON array, one object per finding:
{{"tag": "<tag as printed, or null>", "description": "<plain words>"}}
Each description is plain words: no digits, no dollar signs, no dates, no identifiers.
Do not write a count, a penalty, or a visit type.
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
    chosen = model_name()
    if not chosen:
        print("ERROR: MODEL_PROFILE is not set to a profile in model_config.json")
        return None
    for attempt in range(5):
        try:
            resp = client.messages.create(
                model=chosen,
                max_tokens=_DESCRIBE_TOKENS,
                system=system,
                messages=[{"role": "user", "content": user_msg}],
            )
            text = resp.content[0].text.strip()
            if text.upper().startswith(_NO_FINDINGS):
                print("    no findings in text; no summary written")
                return None
            # A description list can be longer than 750 characters. Prose still cannot.
            if parse_descriptions(text) is None and len(text) > _MAX_SUMMARY_CHARS:
                print(f"    rejected summary over {_MAX_SUMMARY_CHARS} characters ({len(text)})")
                return None
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
            return text
        except Exception as e:
            message = str(e).lower()
            if attempt < 4 and any(token in message for token in ("429", "rate", "overloaded", "529")):
                time.sleep(min(30, 2 ** attempt))
                continue
            print(f"    Claude error: {e}")
            return None
    return None


def _extract_message(chunk: str, k: int, n: int, state_code: str, inspection_type: str) -> str:
    return (
        f"Report part {k} of {n}. State: {state_code.upper()}. Inspection type: {inspection_type or 'visit'}.\n\n"
        f"Text:\n{chunk}\n\nEnd of part {k}."
    )


def _extract_items(client: anthropic.Anthropic, user_msg: str) -> list[dict] | None:
    """One per-chunk call. Returns parsed items ([] is a valid answer), or None on an API error."""
    chosen = model_name()
    if not chosen:
        print("ERROR: MODEL_PROFILE is not set to a profile in model_config.json")
        return None
    for attempt in range(5):
        try:
            resp = client.messages.create(
                model=chosen,
                max_tokens=_EXTRACT_TOKENS,
                system=EXTRACT_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
            )
            return parse_items(resp.content[0].text)
        except Exception as e:
            message = str(e).lower()
            if attempt < 4 and any(token in message for token in ("429", "rate", "overloaded", "529")):
                time.sleep(min(30, 2 ** attempt))
                continue
            print(f"    Claude error (extract): {e}")
            return None
    return None


_MERGED_PREFIX = (
    "Items copied verbatim from every part of this long report, deduplicated on tag plus finding. "
    "The list has no counts of its own: take any count from \"Cited deficiencies on file\" above or a "
    "total the items themselves state.\n\n"
)


def _stored_summary(
    raw: str,
    narrative: str,
    *,
    state_code: str,
    holds_sdc: bool,
    deficiency_count: int,
    d_tags: list[str] | None,
    followup_amount: str | None,
    followup_letter_date: str | None,
    inspection_type: str | None = None,
    inspection_date: str | None = None,
    outcome: str | None = None,
    is_complaint: bool = False,
    defs: list[dict] | None = None,
    facility: str | None = None,
    notes: list[str] | None = None,
) -> tuple[str | None, str | None]:
    """Turn the model's JSON into a header plus gated descriptions.

    Returns (summary, error). A set error is a gate failure and may be retried.
    MN complaint rows count MN-SUBST apart from deficiency tags: when the report's
    own tags are fewer than the stored count, the extra row is the substantiation.
    """
    descriptions = parse_descriptions(raw)
    if descriptions is None:
        print("    rejected summary: model did not return finding descriptions")
        return None, "model did not return finding descriptions"
    tags = d_tags
    count = deficiency_count
    if tags is None and state_code.upper() == "MN":
        parsed = tag_codes(narrative)
        if parsed:
            tags = parsed
            if is_complaint and count > len(parsed):
                count = len(parsed)
    if followup_amount and followup_letter_date:
        penalty = None
    else:
        penalty = latest_assessed_penalty(narrative)
    text, err = assemble_summary(
        state_code=state_code,
        source=narrative,
        descriptions=descriptions,
        d_tags=tags,
        finding_count=count,
        penalty=penalty,
        followup_amount=followup_amount,
        followup_letter_date=followup_letter_date,
        inspection_date=inspection_date,
        inspection_type=inspection_type,
        outcome=outcome,
        facility=facility,
        defs=defs,
        notes=notes,
    )
    if err or not text:
        print(f"    rejected summary: {err or 'nothing to store'}")
        return None, err or "nothing to store"
    if state_code.upper() != "CA" and re.search(r"\b(Title 22|CDSS)\b", text):
        print("    rejected California wording on a non-CA record")
        return None, "California wording on a non-CA record"
    if state_code.upper() == "WA":
        text = strip_unfounded_dementia_contract(text, holds_sdc)
        if not text:
            print("    rejected unfounded Specialized Dementia Care claim")
            return None, "unfounded Specialized Dementia Care claim"
    if reject_false_clean_visit(
        text,
        deficiency_count=count,
        source_text=narrative,
    ):
        print("    rejected clean-visit claim on a cited inspection")
        return None, "clean-visit claim on a cited inspection"
    return text, None


_GATE_RETRIES = 1
_NO_RETRY = {"nothing to store", "model did not return finding descriptions"}
_ZERO_LINE = "No deficiencies were cited at this visit."
_MISSING = object()
# Header plus finding sentences plus the zero-citation line. One closing
# sentence replaces the findings that do not fit. The report text is not cut.
_SUMMARY_SENTENCES = 6
# Above this many findings, one description call kept only a handful of tags
# (45 findings came back as 9). 16 still uses the chunk merge, which the
# Traditions report covers, so the cutoff stays above 16.
PER_FINDING_LIMIT = 20
# One finding call sends that finding's narrative. On the 45-finding report the
# mean narrative is 3,310 characters: about 1,100 tokens at 3 characters per
# token, plus about 400 tokens of prompt. Haiku is $1.00 per million input
# tokens and $5.00 per million output tokens (scrapers/model_config.json).
# One sentence back is about 80 tokens. About $0.0019 per finding call.


def _jobs_over_limit(narrative: str, defs: list[dict] | None) -> list[tuple[str, str]] | None:
    """One (tag, span) per finding when there are more than PER_FINDING_LIMIT rows."""
    from _summary_ground import deficiency_rows, mn_evidence

    rows, _subst = deficiency_rows(defs)
    if len(rows) <= PER_FINDING_LIMIT:
        return None
    jobs: list[tuple[str, str]] = []
    for row in rows:
        code = "" if row.get("code") is None else str(row.get("code")).strip()
        span = (row.get("inspector_narrative") or "").strip()
        if len(span) < 40:
            span = (mn_evidence(narrative, code) or "").strip()
        if len(span) < 40 or not code:
            return None
        jobs.append((code, span))
    return jobs


def append_warning_record(path: str | None, record: dict) -> None:
    """One JSON object per stored row, so a dry-run log can show the warnings."""
    line = json.dumps(record, ensure_ascii=False)
    print(f"    warnings: {line}")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def _sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", (text or "").strip()) if part.strip()]


_HEADER_COUNT = re.compile(
    r"\bissued\s+(\d+)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,3})(?:\s+at this visit)?\.",
    re.I,
)
_HEADER_COUNT_BARE = re.compile(
    r"\b(\d+)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,3})\s+were issued\.",
    re.I,
)
_NOUN_SINGULAR = {
    "correction order": "correction order",
    "correction orders": "correction order",
    "citation": "citation",
    "citations": "citation",
    "violation": "violation",
    "violations": "violation",
    "deficiency": "deficiency",
    "deficiencies": "deficiency",
    "finding": "finding",
    "findings": "finding",
}


def _header_tally(header: str) -> tuple[int, str] | None:
    """The finding count and noun written in the code header."""
    match = _HEADER_COUNT.search(header or "") or _HEADER_COUNT_BARE.search(header or "")
    if not match:
        return None
    return int(match.group(1)), match.group(2).strip().lower()


def _noun_for_count(header_noun: str, count: int) -> str | None:
    singular = _NOUN_SINGULAR.get((header_noun or "").lower())
    if not singular:
        return None
    if count == 1:
        return singular
    if singular.endswith("y") and not singular.endswith(("ay", "ey", "oy")):
        return singular[:-1] + "ies"
    return singular + "s"


def _sentence_count(text: str) -> int:
    return len(_sentences(text))


def align_findings(body: str, candidates: list[str]) -> list[str] | None:
    """Walk the summary body by whole description strings. None if they do not line up."""
    remaining = (body or "").strip()
    pool = [item.strip() for item in candidates if item and item.strip()]
    found: list[str] = []
    while remaining:
        matches = [item for item in pool if remaining.startswith(item)]
        if not matches:
            return None
        match = max(matches, key=len)
        pool.remove(match)
        found.append(match)
        remaining = remaining[len(match):].strip()
    return found


def findings_in_text(text: str, header: str | None, candidates: list[str]) -> list[str] | None:
    """The descriptions that make up the body, in the order they were stored."""
    if not header or not (text or "").startswith(header):
        return None
    body = text[len(header):].strip()
    ordered = [item.strip() for item in candidates if item and item.strip()]
    if not body:
        return []
    if body == " ".join(ordered):
        return ordered
    return align_findings(body, ordered)


def cap_summary(
    text: str,
    *,
    header: str | None,
    findings: list[str] | None,
) -> tuple[str | None, str | None]:
    """Keep whole findings inside about six sentences.

    The closing number is the header's finding count minus the findings whose
    full text was kept. A finding that runs to several sentences is kept or
    dropped together. One finding that is longer than the cap keeps its first
    whole sentences and a fixed detail line. Returns (summary, hold reason).
    """
    if findings is None:
        return None, "header count unknown does not match the finding list unknown"
    if not findings:
        tally = _header_tally(header or "")
        if tally and tally[0] > 0:
            return None, f"header count {tally[0]} does not match the finding list 0"
        if _sentence_count(text) <= _SUMMARY_SENTENCES:
            return text, None
        return None, "header count unknown does not match the finding list 0"
    if not header:
        return None, f"header count unknown does not match the finding list {len(findings)}"
    tally = _header_tally(header)
    if tally is None:
        return None, f"header count unknown does not match the finding list {len(findings)}"
    total, noun = tally
    if len(findings) != total:
        return None, f"header count {total} does not match the finding list {len(findings)}"
    header_n = _sentence_count(header)
    all_n = header_n + sum(_sentence_count(item) for item in findings)
    detail = False
    if all_n <= _SUMMARY_SENTENCES:
        selected = list(findings)
    else:
        selected = []
        used = header_n
        for item in findings:
            needed = _sentence_count(item) or 1
            if used + needed + 1 <= _SUMMARY_SENTENCES:
                selected.append(item)
                used += needed
        # One long finding stays one finding. Extra sentences stop at a boundary.
        if not selected and len(findings) == 1:
            parts = _sentences(findings[0])
            room = _SUMMARY_SENTENCES - header_n
            if room < 1:
                room = 1
            if len(parts) > room:
                selected = [" ".join(parts[:room])]
                detail = True
            else:
                selected = list(findings)
    described = len(selected)
    if described > total:
        return None, f"header count {total} does not match described {described}"
    omitted = total - described
    if omitted < 0:
        return None, f"header count {total} does not match described {described}"
    if omitted == 0:
        tail = "The report describes this finding in more detail." if detail else ""
        rebuilt = " ".join(
            part for part in (header.strip(), *(item.strip() for item in selected), tail) if part
        )
        if not detail and rebuilt == (text or "").strip():
            return text, None
        return rebuilt, None
    word = _noun_for_count(noun, omitted)
    if not word:
        return None, f"header count {total} does not match described {described}"
    closing = f"The report lists {omitted} further {word}."
    rebuilt = " ".join(
        part for part in (header.strip(), *(item.strip() for item in selected), closing) if part
    )
    return rebuilt, None


def _finding_block(text: str, state_code: str) -> str | None:
    """A fallback that is the rule, or a tag dump, holds the row. Minnesota rule text does not."""
    if tag_dump_problem(text):
        return "tag or metadata dump"
    if (state_code or "").upper() in {"CA", "OR"} and is_regulation_text(text):
        return "rule text presented as a finding"
    return None


def _hold(warning_log: str | None, inspection_id: str | None, reason: str) -> None:
    print(f"    held: {reason}")
    append_warning_record(warning_log, {"id": inspection_id, "warnings": [f"held: {reason}"]})


def _db_has_penalty(value: object) -> bool:
    if value is None or value is _MISSING or isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return value > 0
    try:
        return float(str(value).replace(",", "").replace("$", "")) > 0
    except (TypeError, ValueError):
        return False


def _guess_header(
    text: str,
    *,
    state_code: str,
    source: str,
    finding_count: int,
    inspection_date: str | None,
    inspection_type: str | None,
    outcome: str | None,
    followup_amount: str | None,
    followup_letter_date: str | None,
    defs: list[dict] | None,
) -> str | None:
    """The code header when it is a prefix of text, so finding sentences can be reordered."""
    if not text:
        return None
    from _summary_ground import deficiency_rows

    counts = [finding_count]
    if defs:
        rows, _subst = deficiency_rows(defs)
        counts.append(len(rows))
        real = _real_rows(defs)
        if real is not None:
            counts.append(len(real))
    penalties: list[str | None] = [None]
    if not (followup_amount and followup_letter_date):
        penalties.append(latest_assessed_penalty(source))
    seen: set[tuple[int, str | None]] = set()
    best: str | None = None
    for count in counts:
        for penalty in penalties:
            key = (count, penalty)
            if key in seen:
                continue
            seen.add(key)
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
            if header and text.startswith(header) and (best is None or len(header) > len(best)):
                best = header
    return best


def _real_rows(defs: list[dict] | None) -> list[dict] | None:
    if not defs:
        return None
    from _summary_ground import deficiency_rows

    rows, _subst = deficiency_rows(defs)
    return [
        row for row in rows
        if not re.fullmatch(r"[A-Z]0000", str(row.get("code") or "").strip())
    ]


def _parsed_has_directive(narrative: str, state_code: str, parsed: list[dict] | None) -> bool:
    """True when a model description adds 'must correct' and that finding's span does not."""
    for item in parsed or []:
        description = str(item.get("description") or "")
        tag = "" if item.get("tag") is None else str(item.get("tag"))
        if directive_problem(description, _item_span(narrative, state_code, tag)):
            return True
    return False


def _item_span(narrative: str, state_code: str, tag: str) -> str:
    if (state_code or "").upper() == "MN":
        return mn_evidence(narrative, tag) or tag_span(narrative, tag) or narrative
    return tag_span(narrative, tag) or narrative


def _parsed_has_invented(narrative: str, state_code: str, parsed: list[dict] | None) -> bool:
    """True when a description adds a requirement the finding does not state."""
    for item in parsed or []:
        description = str(item.get("description") or "")
        tag = "" if item.get("tag") is None else str(item.get("tag"))
        if invented_requirement(description, _item_span(narrative, state_code, tag)):
            return True
    return False


def _release(
    text: str | None,
    *,
    is_complaint: bool,
    inspection_type: str | None,
    db_penalty: object,
    followup_amount: str | None,
    defs: list[dict] | None,
    warning_log: str | None,
    inspection_id: str | None,
    header: str | None = None,
    findings: list[str] | None = None,
) -> str | None:
    """Visit and penalty checks, then the finding cap. A hold stores nothing."""
    if not text:
        return None
    opened = " ".join(
        sentence for sentence in _sentences(text)[:4] if "completed a" in sentence.lower()
    )
    conflict = visit_type_conflict(
        opened, is_complaint=is_complaint, inspection_type=inspection_type,
    ) if opened else None
    if conflict:
        _hold(warning_log, inspection_id, conflict)
        return None
    if (
        db_penalty is not _MISSING
        and not followup_amount
        and not _db_has_penalty(db_penalty)
        and "$" in text
    ):
        _hold(warning_log, inspection_id, "dollar penalty absent from the record")
        return None
    ordered = findings
    rows = _real_rows(defs) if defs else None
    if findings is not None and rows and len(rows) == len(findings):
        ordered = rank_by_severity(list(findings), rows)
    capped, reason = cap_summary(text, header=header, findings=ordered)
    if reason:
        _hold(warning_log, inspection_id, reason)
        return None
    return capped


def _split_problems(problems: list[str]) -> tuple[list[str], list[str]]:
    holds: list[str] = []
    warns: list[str] = []
    for problem in problems:
        if is_factual_hold(problem):
            holds.append(problem)
        else:
            warns.append(problem)
    return holds, warns


def _regulator_for_span(span: str, row: dict | None, state_code: str) -> str:
    """Copy the regulator's sentence for one finding. California uses the deficiency text."""
    state = (state_code or "").upper()
    if state == "CA" and row and str(row.get("description") or "").strip():
        return regulator_sentence(str(row["description"]), row=row)
    if state == "MN":
        evidence, _how = evidence_text(span)
        return regulator_sentence(evidence or span, row=row)
    return regulator_sentence(span, row=row)


def _regulator_summary(
    narrative: str,
    *,
    state_code: str,
    defs: list[dict] | None,
    d_tags: list[str] | None,
    descriptions: list[dict] | None,
    inspection_type: str | None,
    inspection_date: str | None,
    outcome: str | None,
    followup_amount: str | None,
    followup_letter_date: str | None,
    blocked: list[str] | None = None,
) -> tuple[str | None, list[str]]:
    """Header plus the regulator's own wording, one sentence per finding."""
    from _summary_ground import deficiency_rows, mn_evidence, tag_span

    rows, _subst = deficiency_rows(defs)
    pairs: list[tuple[str, str]] = []
    if rows:
        for row in rows:
            code = "" if row.get("code") is None else str(row.get("code")).strip()
            span = (row.get("inspector_narrative") or "").strip()
            if len(span) < 40:
                span = (mn_evidence(narrative, code) or tag_span(narrative, code) or span)
            pairs.append((_regulator_for_span(span, row, state_code), span))
    else:
        tags = [item.get("tag") for item in (descriptions or []) if item.get("tag")]
        if not tags and d_tags:
            tags = list(d_tags)
        if not tags:
            pairs.append((_regulator_for_span(narrative, None, state_code), narrative))
        else:
            for tag in tags:
                span = mn_evidence(narrative, tag) or tag_span(narrative, tag) or narrative
                pairs.append((_regulator_for_span(span, None, state_code), span))
    sentences = [sentence for sentence, _span in pairs if sentence]
    if not sentences:
        return None, []
    for sentence, span in pairs:
        if not sentence:
            continue
        why = fallback_problem(sentence, span) or _finding_block(sentence, state_code)
        if why:
            if blocked is not None:
                blocked.append(why)
            return None, []
    if followup_amount and followup_letter_date:
        penalty = None
    else:
        penalty = latest_assessed_penalty(narrative)
    header = build_header(
        state_code=state_code,
        source=narrative,
        finding_count=len(sentences),
        penalty=penalty,
        followup_amount=followup_amount,
        followup_letter_date=followup_letter_date,
        inspection_date=inspection_date,
        inspection_type=inspection_type,
        outcome=outcome,
    )
    text = " ".join(part for part in (header, *sentences) if part and part.strip()).strip()
    return (text or None), sentences


def _describe_each_finding(
    client: anthropic.Anthropic,
    jobs: list[tuple[str, str]],
    *,
    system: str,
    inspection_type: str,
    is_complaint: bool,
    outcome: str | None,
    dementia_contract: str,
    record_date: str | None,
    deficiency_instruction: str,
    state_code: str,
    holds_sdc: bool,
    narrative: str,
    deficiency_count: int,
    d_tags: list[str] | None,
    followup_amount: str | None,
    followup_letter_date: str | None,
    defs: list[dict] | None,
    facility: str | None,
    warning_log: str | None = None,
    inspection_id: str | None = None,
) -> tuple[str | None, list[str]]:
    """One call per finding. A bad finding is retried once, then copied from the report.

    A California or Oregon fallback that is rule text, or any tag dump, holds the row.
    Any other single failure does not.
    """
    rows_by_code: dict[str, dict] = {}
    for row in defs or []:
        code = "" if row.get("code") is None else str(row.get("code")).strip()
        if code:
            rows_by_code[code] = row
    pieces: list[str] = []
    warnings: list[str] = []
    blocked: str | None = None

    def _grade(description: str, span: str) -> tuple[list[str], list[str]]:
        if (state_code or "").upper() == "MN":
            evidence, how = evidence_text(span)
        else:
            evidence, how = span, "tag span"
        problems = description_problems(
            description,
            narrative,
            state_code,
            evidence=evidence or span,
            how=how,
            inspection_date=record_date,
            inspection_type=inspection_type,
            defs=defs,
            facility=facility,
        )
        return _split_problems(problems)

    def _one_call(user_msg: str, span: str) -> tuple[str, list[str], list[str]]:
        raw = _complete_summary(
            client,
            system=system,
            user_msg=user_msg,
            state_code=state_code,
            holds_sdc=holds_sdc,
            deficiency_count=1,
            narrative=span,
        )
        parsed = parse_descriptions(raw or "")
        if not parsed:
            return "", ["model did not return finding descriptions"], []
        description = parsed[0]["description"]
        holds, warns = _grade(description, span)
        return description, holds, warns

    for code, span in jobs:
        user = _user_message(
            inspection_type,
            is_complaint,
            outcome,
            dementia_contract,
            1,
            record_date,
            span,
            deficiency_instruction,
        )
        user = user + "\n\nThis call covers one finding only. Tag: " + code + ". Reply with a JSON list of one object."
        description, holds, warns = _one_call(user, span)
        if holds:
            reason = holds[0]
            again, holds2, warns2 = _one_call(
                user + "\n\nThe previous description was rejected:\n- " + reason
                + "\nFix only that problem. Do not add a count, a date, or a dollar amount.",
                span,
            )
            if (
                again
                and not holds2
                and len(warns2) <= len(warns)
                and not directive_problem(again, span)
                and not invented_requirement(again, span)
            ):
                description, warns = again, warns2
            elif directive_problem(description, span) or directive_problem(again, span):
                blocked = "unsourced directive"
                description = ""
            elif invented_requirement(description, span) or invented_requirement(again, span):
                blocked = "invented requirement"
                description = ""
            else:
                description = _regulator_for_span(span, rows_by_code.get(code), state_code)
                why = fallback_problem(description, span) or _finding_block(description, state_code)
                if why:
                    blocked = why
                warns = [f"fallback to regulator wording: {code}"]
                print(f"    fallback: {code}: {holds2[0] if holds2 else reason}")
        elif directive_problem(description, span):
            blocked = "unsourced directive"
            description = ""
        elif invented_requirement(description, span):
            blocked = "invented requirement"
            description = ""
        if description:
            pieces.append(description)
        warnings.extend(warns)
    if blocked:
        _hold(warning_log, inspection_id, blocked)
        return None, []
    if not pieces:
        print("    held: nothing to store")
        return None, []
    if followup_amount and followup_letter_date:
        penalty = None
    else:
        penalty = latest_assessed_penalty(narrative)
    header = build_header(
        state_code=state_code,
        source=narrative,
        finding_count=len(pieces),
        penalty=penalty,
        followup_amount=followup_amount,
        followup_letter_date=followup_letter_date,
        inspection_date=record_date,
        inspection_type=inspection_type,
        outcome=outcome,
    )
    text = " ".join(part for part in (header, *pieces) if part and part.strip()).strip()
    if warnings:
        append_warning_record(warning_log, {"id": inspection_id, "warnings": warnings})
    return (text or None), pieces


def _is_stub_or_error(narrative: str) -> bool:
    text = (narrative or "").strip()
    if len(text) < 80:
        return True
    return re.search(r"page not found|404 not found|access denied|error page", text, re.I) is not None


def _shows_no_deficiencies(narrative: str) -> bool:
    if re.search(r"failed to|not met as evidenced|\btype [ab]\b", narrative or "", re.I):
        return False
    return re.search(
        r"\bno (?:deficienc(?:y|ies)|citations?|violations?|correction orders?)\b",
        narrative or "",
        re.I,
    ) is not None


def _published_zero_visit(
    narrative: str,
    *,
    state_code: str,
    deficiency_count: int,
    published: bool,
    d_tags: list[str] | None,
) -> bool:
    """A published visit with the report in hand and no cited deficiency. Never Texas."""
    if not published or (state_code or "").upper() == "TX" or deficiency_count != 0 or d_tags:
        return False
    if _is_stub_or_error(narrative):
        return False
    return _shows_no_deficiencies(narrative)


def _zero_citation_summary(
    narrative: str,
    *,
    state_code: str,
    inspection_type: str | None,
    inspection_date: str | None,
) -> str:
    header = build_header(
        state_code=state_code,
        source=narrative,
        finding_count=0,
        penalty=None,
        inspection_date=inspection_date,
        inspection_type=inspection_type,
    )
    text = f"{header} {_ZERO_LINE}".strip() if header else _ZERO_LINE
    return text


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
    d_tags: list[str] | None = None,
    inspection_id: str | None = None,
    followup_amount: str | None = None,
    followup_letter_date: str | None = None,
    published: bool = False,
    defs: list[dict] | None = None,
    facility: str | None = None,
    warning_log: str | None = None,
    db_penalty: object = _MISSING,
) -> str | None:
    if not (narrative or "").strip():
        return None

    def _header_for(text: str | None) -> str | None:
        return _guess_header(
            text or "",
            state_code=state_code,
            source=narrative,
            finding_count=deficiency_count,
            inspection_date=record_date,
            inspection_type=inspection_type,
            outcome=outcome,
            followup_amount=followup_amount,
            followup_letter_date=followup_letter_date,
            defs=defs,
        )

    def _finish(text: str | None, findings: list[str] | None = None) -> str | None:
        return _release(
            text,
            is_complaint=is_complaint,
            inspection_type=inspection_type,
            db_penalty=db_penalty,
            followup_amount=followup_amount,
            defs=defs,
            warning_log=warning_log,
            inspection_id=inspection_id,
            header=_header_for(text),
            findings=findings,
        )
    if deficiency_count == 0 and not d_tags:
        # The fixed line is only for a published, non-Texas report that says so.
        # Texas, a stub, and an unpublished report that says nothing was cited
        # get no summary and no model call. Any other report continues.
        if (state_code or "").upper() == "TX" or (published and _is_stub_or_error(narrative)):
            return None
        if not published and _shows_no_deficiencies(narrative):
            return None
    if _published_zero_visit(
        narrative,
        state_code=state_code,
        deficiency_count=deficiency_count,
        published=published,
        d_tags=d_tags,
    ):
        return _finish(_zero_citation_summary(
            narrative,
            state_code=state_code,
            inspection_type=inspection_type,
            inspection_date=record_date,
        ), [])
    if (state_code or "").upper() == "OR" and defs:
        defs = _real_rows(defs) or []
    if (state_code or "").upper() == "OR":
        source_count = or_real_tag_count(narrative)
        if source_count is not None and source_count != int(deficiency_count or 0):
            _hold(
                warning_log,
                inspection_id,
                f"source tag count {source_count} does not match the record count {deficiency_count}",
            )
            return None
    if model_name() is None:
        print("ERROR: MODEL_PROFILE is not set to a profile in model_config.json")
        return None
    if followup_amount is None and followup_letter_date is None and inspection_id:
        labeled = followup_for(inspection_id)
        if labeled:
            followup_amount, followup_letter_date = labeled
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
    system = DESCRIBE_SYSTEM_PROMPT
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
    budget = _narrative_budget(system, overhead)
    jobs = _jobs_over_limit(narrative, defs)
    if jobs:
        described, found = _describe_each_finding(
            client,
            jobs,
            system=system,
            inspection_type=inspection_type,
            is_complaint=is_complaint,
            outcome=outcome,
            dementia_contract=dementia_contract,
            record_date=record_date,
            deficiency_instruction=deficiency_instruction,
            state_code=state_code,
            holds_sdc=holds_sdc,
            narrative=narrative,
            deficiency_count=deficiency_count,
            d_tags=d_tags,
            followup_amount=followup_amount,
            followup_letter_date=followup_letter_date,
            defs=defs,
            facility=facility,
            warning_log=warning_log,
            inspection_id=inspection_id,
        )
        return _finish(described, found)

    def _gate(raw: str | None, notes: list[str]) -> tuple[str | None, str | None]:
        if not raw:
            return None, None
        return _stored_summary(
            raw,
            narrative,
            state_code=state_code,
            holds_sdc=holds_sdc,
            deficiency_count=deficiency_count,
            d_tags=d_tags,
            followup_amount=followup_amount,
            followup_letter_date=followup_letter_date,
            inspection_type=inspection_type,
            inspection_date=record_date,
            outcome=outcome,
            is_complaint=is_complaint,
            defs=defs,
            facility=facility,
            notes=notes,
        )

    def _with_reasons(user_msg: str, reasons: list[str]) -> str:
        if not reasons:
            return user_msg
        lines = "\n".join(f"- {reason}" for reason in reasons)
        return (
            user_msg
            + "\n\nThe previous descriptions were rejected:\n"
            + lines
            + "\nFix only those problems. Do not add a count, a date, or a dollar amount."
        )

    def _describe_until_stored(user_msg: str) -> str | None:
        """One retry after a factual hold. A worse retry is replaced by the report's words."""

        def _attempt(reasons: list[str]) -> tuple[str | None, str | None, list[str], list[dict] | None]:
            raw = _complete_summary(
                client,
                system=system,
                user_msg=_with_reasons(user_msg, reasons),
                state_code=state_code,
                holds_sdc=holds_sdc,
                deficiency_count=deficiency_count,
                narrative=narrative,
            )
            parsed = parse_descriptions(raw or "")
            notes: list[str] = []
            text, err = _gate(raw, notes)
            return text, err, notes, parsed

        text, err, notes, parsed = _attempt([])
        if not parsed or err in _NO_RETRY:
            return None
        if text and not err:
            if notes:
                append_warning_record(warning_log, {"id": inspection_id, "warnings": notes})
            header = _header_for(text)
            return _finish(text, findings_in_text(
                text, header, [str(item.get("description") or "") for item in parsed],
            ))
        text2, err2, notes2, parsed2 = _attempt([err or "rejected"])
        if text2 and not err2 and len(notes2) <= len(notes):
            if notes2:
                append_warning_record(warning_log, {"id": inspection_id, "warnings": notes2})
            header = _header_for(text2)
            return _finish(text2, findings_in_text(
                text2, header, [str(item.get("description") or "") for item in (parsed2 or [])],
            ))
        if _parsed_has_directive(narrative, state_code, parsed) or _parsed_has_directive(
            narrative, state_code, parsed2,
        ):
            _hold(warning_log, inspection_id, "unsourced directive")
            return None
        if _parsed_has_invented(narrative, state_code, parsed) or _parsed_has_invented(
            narrative, state_code, parsed2,
        ):
            _hold(warning_log, inspection_id, "invented requirement")
            return None
        reasons: list[str] = []
        fallback, found = _regulator_summary(
            narrative,
            state_code=state_code,
            defs=defs,
            d_tags=d_tags,
            descriptions=parsed2 or parsed,
            inspection_type=inspection_type,
            inspection_date=record_date,
            outcome=outcome,
            followup_amount=followup_amount,
            followup_letter_date=followup_letter_date,
            blocked=reasons,
        )
        if reasons:
            _hold(warning_log, inspection_id, reasons[0])
            return None
        if not fallback:
            print(f"    held: {err2 or err}")
            return None
        print(f"    fallback: {err2 or err}")
        append_warning_record(
            warning_log,
            {"id": inspection_id, "warnings": ["fallback to regulator wording"]},
        )
        return _finish(fallback, found)

    if len(narrative) <= budget:
        return _describe_until_stored(
            _user_message(
                inspection_type,
                is_complaint,
                outcome,
                dementia_contract,
                deficiency_count,
                record_date,
                narrative,
                deficiency_instruction,
            )
        )
    # Long report: every character goes to some chunk. Code merges verbatim quotes,
    # then one call writes a description per finding. The header is built here.
    extract_budget = _narrative_budget(EXTRACT_SYSTEM_PROMPT, _extract_message("", 99, 99, state_code, inspection_type))
    chunks = _chunks_for_model(narrative, min(budget, extract_budget))
    chunk_items: list[list[dict]] = []
    for k, chunk in enumerate(chunks, 1):
        items = _extract_items(client, _extract_message(chunk, k, len(chunks), state_code, inspection_type))
        if items is None:
            return None
        chunk_items.append(items)
    merged, stats = merge_items(chunks, chunk_items)
    print(
        f"    long report: {len(chunks)} chunks, {stats['items_in']} items in, {stats['items_out']} kept, "
        f"{stats['dropped_not_verbatim']} not verbatim, {stats['dropped_duplicate'] + stats['dropped_contained']} duplicate"
    )
    if not merged:
        print("    long report: no verbatim items survived the merge; no summary written")
        return None
    return _describe_until_stored(
        _user_message(
            inspection_type,
            is_complaint,
            outcome,
            dementia_contract,
            deficiency_count,
            record_date,
            _MERGED_PREFIX + render_items(merged),
            deficiency_instruction,
        )
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def _defs_by_inspection(cur, inspection_ids: list) -> dict:
    """Stored deficiency rows. Columns already on deficiencies. No new names."""
    if not inspection_ids:
        return {}
    cur.execute(
        """
        SELECT inspection_id, code, class, immediate_jeopardy,
               description, inspector_narrative, status
        FROM deficiencies
        WHERE inspection_id = ANY(%s)
        ORDER BY code
        """,
        (list(inspection_ids),),
    )
    grouped: dict = {}
    for insp_id, code, klass, ij, description, narrative, status in cur.fetchall():
        grouped.setdefault(insp_id, []).append({
            "code": code,
            "class": klass,
            "ij": bool(ij),
            "description": description,
            "inspector_narrative": narrative,
            "status": status,
        })
    return grouped


def main(argv=None, *, connect=None, summarize_fn=None) -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="Process first 3 records only")
    parser.add_argument("--dry-run", action="store_true", help="Print summaries, no DB writes")
    parser.add_argument(
        "--write",
        action="store_true",
        help="Save narrative_summary. Without this flag nothing is written.",
    )
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
    args = parser.parse_args(argv)
    do_write = bool(args.write) and not args.dry_run
    summarize_fn = summarize_fn or summarize
    connect = connect or psycopg.connect

    if model_name() is None:
        print("ERROR: set MODEL_PROFILE to a profile in scrapers/model_config.json. There is no default.")
        sys.exit(1)
    if do_write and summarize_fn is summarize and not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY not set in .env.local")
        sys.exit(1)
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if do_write and summarize_fn is summarize else None

    with connect(DATABASE_URL) as conn:
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
                           i.inspection_date,
                           f.publishable,
                           i.civil_money_penalty_total
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
                           i.inspection_date,
                           f.publishable,
                           i.civil_money_penalty_total
                    FROM inspections i
                    JOIN facilities f ON f.id = i.facility_id
                    WHERE {" AND ".join(where_parts)}
                    ORDER BY f.name, i.inspection_date DESC
                    """,
                    params,
                )
            rows = cur.fetchall()
            defs_by_id = _defs_by_inspection(cur, [row[0] for row in rows])

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
            publishable,
            db_penalty,
        ) = row
        if not (raw_narrative or "").strip():
            return insp_id, fac_name, None, "empty"
        narrative = clean_narrative(raw_narrative)
        if not narrative:
            return insp_id, fac_name, None, "empty"
        if not do_write:
            return insp_id, fac_name, narrative[:150], "dry"
        summary = summarize_fn(
            client,
            insp_type or "visit",
            bool(is_complaint),
            outcome,
            narrative,
            state_code=st_code or "CA",
            holds_sdc=bool(holds_sdc),
            deficiency_count=int(def_count or 0),
            record_date=str(insp_date) if insp_date else None,
            inspection_id=str(insp_id),
            published=bool(publishable),
            facility=fac_name,
            defs=defs_by_id.get(insp_id),
            db_penalty=db_penalty,
        )
        if not summary:
            return insp_id, fac_name, None, "fail"
        return insp_id, fac_name, summary, "ok"

    with connect(DATABASE_URL) as conn:
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
