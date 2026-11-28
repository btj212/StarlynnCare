"""Ground a finding description in that deficiency's own evidence, and the v6 checks that still apply.

The model writes one description per deficiency. A content word has to appear in that
finding's evidence (stem or a documented synonym), not merely somewhere else in the report.
Rule text before "not met as evidenced by" is the statute, not the finding.

Fallback when a span has no "not met as evidenced by" marker: drop sentences that read as
the rule (must/shall, Subd., OAR, section sign, Title 22). If that leaves nothing, the
whole span is the evidence and the reason says so.

Synonyms (description word -> a form that may appear in the span):
  became/turned, timeframe/time frame. "direct-care" matches "direct" and "care".
  A possessive ("employee's") matches the same noun. "staff member" adds no fact
  beyond "staff". "specified timeframe" matches "required time frame".
  determined/determination/determine are one lemma. review/reviewed/reviewing are one lemma.
  seeing/saw/seen are one lemma. throughout matches "all over". near matches "along".
  present matches "observed". A short plural ("beds") matches the singular.
  Number words match the same digit in the span (one = 1, eighteen = 18).

A Title-Case pair is a person name only when neither word is a documented medical,
program, or regulatory term: Cardio Pulmonary, Cardiopulmonary Resuscitation,
Adult Protective, Long Term, Residential Care, Assisted Living, Elderly California.

Actors that must not be swapped: licensee, facility, staff, administrator, LLA /
licensing authority, Department, surveyor.
"""

from __future__ import annotations

import re
from datetime import date

# qa_gate.py check sites (59). status is ported, covered, or dropped.
# Dropped rows are only the old whole-summary length and sentence-count rules.
V6_CHECK_SITES: tuple[tuple[int, str, str], ...] = (
    (140, "ported", "header_date_allowed"),
    (141, "ported", "header_date_allowed"),
    (143, "ported", "header_date_allowed"),
    (152, "ported", "survey_date_as_written"),
    (154, "ported", "visit_type_as_written"),
    (155, "ported", "check_families"),
    (156, "ported", "check_assault"),
    (159, "ported", "latest_assessed_penalty"),
    (164, "ported", "latest_assessed_penalty"),
    (169, "ported", "check_one_to_one"),
    (172, "ported", "check_pronoun"),
    (175, "ported", "check_actor"),
    (181, "ported", "check_cause_of_death"),
    (184, "ported", "check_actor"),
    (189, "ported", "check_cause_of_death"),
    (193, "ported", "check_care_words"),
    (199, "covered", "description_problems digit/$ plus header penalty"),
    (208, "ported", "check_number_words"),
    (211, "ported", "check_type_class"),
    (213, "ported", "check_immediate_jeopardy"),
    (215, "ported", "check_corrected"),
    (223, "covered", "reject_false_clean_visit and _CLEAN"),
    (227, "ported", "check_outcome"),
    (228, "ported", "check_outcome"),
    (229, "ported", "check_outcome"),
    (234, "ported", "check_plural"),
    (236, "ported", "check_plural"),
    (239, "ported", "check_plural"),
    (245, "ported", "check_actor"),
    (250, "ported", "check_arrival"),
    (254, "ported", "check_number_words"),
    (256, "ported", "check_corrected"),
    (260, "ported", "untraced_words"),
    (262, "ported", "check_compliance"),
    (266, "covered", "_IDENT"),
    (276, "ported", "check_person_name"),
    (281, "ported", "check_person_name"),
    (286, "ported", "check_no_further"),
    (291, "ported", "untraced_words"),
    (297, "ported", "check_arrival"),
    (301, "ported", "check_plural_agents"),
    (303, "ported", "check_the_state"),
    (308, "ported", "check_number_words"),
    (309, "dropped", "whole-summary sentence cap; one description per finding instead"),
    (314, "dropped", "750-character cap; per-description end punctuation instead"),
    (315, "dropped", "250-character floor; per-description end punctuation instead"),
    (316, "dropped", "under-300 flag; per-description end punctuation instead"),
    (317, "dropped", "2-3 sentence rule; one description per finding instead"),
    (318, "ported", "check_markdown"),
    (320, "covered", "_EVAL"),
    (321, "covered", "_REPORT_SAYS"),
    (324, "covered", "_BANNED"),
    (325, "covered", "_stored_summary Title 22/CDSS"),
    (332, "ported", "check_inspector_name"),
    (333, "covered", "_complete_summary refusal"),
    (336, "ported", "untraced_words"),
    (345, "ported", "check_attributed_count"),
    (350, "ported", "check_deadline"),
    (355, "ported", "check_outcome"),
)

_STOP = set("""
a an the of to and or in on for with by at from as is are was were be been being
this that these those it its their his her they them he she we you your
not no nor but if then than so do did does done have has had
out up into over under about after before between during
its also only per via evidenced
""".split())

_NUM = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6",
    "seven": "7", "eight": "8", "nine": "9", "ten": "10", "eleven": "11",
    "twelve": "12", "thirteen": "13", "fourteen": "14", "fifteen": "15",
    "sixteen": "16", "seventeen": "17", "eighteen": "18", "nineteen": "19",
    "twenty": "20", "twice": "2",
}
_COUNT_WORDS = frozenset(_NUM) | {"all", "every", "none", "twice"}
_SYNONYM = {
    "became": "turned",
    "turned": "became",
    "timeframe": "time frame",
    "throughout": "all over",
    "near": "along",
    "present": "observed",
}
_IRREG = {"found": "find", "failed": "fail", "left": "leave", "kept": "keep", "met": "meet"}
_LEMMA = {
    "determine": "determine",
    "determined": "determine",
    "determining": "determine",
    "determination": "determine",
    "review": "review",
    "reviewed": "review",
    "reviewing": "review",
    "see": "see",
    "saw": "see",
    "seen": "see",
    "seeing": "see",
}
_EVIDENCE = re.compile(
    r"this (?:mn |minnesota |licensure )?requirement is not met as evidenced by:?|"
    r"this rule is not met as evidenced by:?",
    re.I,
)
_RULE_SENT = re.compile(
    r"\b(must|shall)\b|\bSubd\.|\bOAR\b|§|\bTitle 22\b|The facility must|The licensee must",
    re.I,
)
_PARTIAL = re.compile(
    r"\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:out\s+of|of)\s+"
    r"(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b",
    re.I,
)
_GENERIC = frozenset(
    """staff file files proof contain contained required have has had did not do the a of in
    failed fail licensee facility ensure ensured based observation interview record review
    practice resulted violation level scope issued isolated""".split()
)
_ACTORS = (
    ("licensee", ("licensee",)),
    ("facility", ("facility", "home")),
    ("staff", ("staff", "caregiver", "employee", "ulp")),
    ("administrator", ("administrator",)),
    ("lla", ("lla", "licensing authority")),
    ("department", ("department", "mdh")),
    ("surveyor", ("surveyor", "lpa", "licensor", "analyst")),
)


def v6_site_counts() -> dict[str, int]:
    counts = {"ported": 0, "covered": 0, "dropped": 0}
    for _line, status, _name in V6_CHECK_SITES:
        counts[status] += 1
    return counts


def stem(word: str) -> str:
    w = word.lower().replace("'", "")
    if w in _LEMMA:
        return _LEMMA[w]
    if w in _IRREG:
        return _IRREG[w]
    for suf in ("ly", "ing", "ed", "es", "s"):
        if len(w) >= len(suf) + 3 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def _flat(text: str) -> str:
    return re.sub(r"\s+", " ", text or "")


def evidence_text(span: str) -> tuple[str, str]:
    """Return (evidence, how). Statute text before the evidence marker is dropped."""
    span = span or ""
    match = _EVIDENCE.search(span)
    if match:
        return span[match.end():], "after the not-met marker"
    kept = []
    for sentence in re.split(r"(?<=[.;])\s+", span):
        if sentence and not _RULE_SENT.search(sentence):
            kept.append(sentence)
    if kept and len(" ".join(kept)) < len(span):
        return " ".join(kept), "rule sentences removed; no not-met marker"
    return span, "whole span; no statute boundary"


def tag_span(narrative: str, tag: str, tags: list[str] | None = None) -> str | None:
    """Text from this tag to the next tag. Spaces and leading zeros still count.

    "Refer to: C 513" sits at the end of the finding, so that finding's lead-in
    is part of the span.
    """
    from _extractive_merge import tag_key, tag_pattern

    if not tag or not narrative:
        return None
    pat = tag_pattern(tag)
    if not pat:
        return None
    match = re.search(pat, narrative, re.I)
    if not match:
        return None
    wanted = tag_key(tag)
    end = len(narrative)
    for other in tags or []:
        if not other or tag_key(other) == wanted:
            continue
        opat = tag_pattern(other)
        if not opat:
            continue
        nxt = re.search(opat, narrative[match.end():], re.I)
        if nxt:
            end = min(end, match.end() + nxt.start())
    start = match.start()
    before = narrative[:start]
    if re.search(r"refer to:\s*$", before[-40:], re.I):
        lead = re.search(r"Based on [\s\S]{0,1500}$", before)
        if lead:
            start = lead.start()
    return narrative[start:end]


def _tokens(text: str) -> list[str]:
    return re.findall(r"[A-Za-z][A-Za-z'-]*", text or "")


def _span_index(span: str) -> tuple[set[str], str]:
    flat = re.sub(r"[^A-Za-z0-9\s]", " ", span or "").lower()
    flat = re.sub(r"\s+", " ", flat)
    stems: set[str] = set()
    for word in flat.split():
        if not word:
            continue
        stems.add(stem(word))
        # "LGBTQIA2S+" is one token in the span and two letter-runs in the description.
        for part in re.findall(r"[a-z]{3,}", word):
            stems.add(stem(part))
    for word, alt in _SYNONYM.items():
        if alt.replace(" ", "") in flat.replace(" ", "") or word in flat:
            stems.add(stem(word))
            stems.add(stem(alt.split()[-1]))
    return stems, flat.replace(" ", "")


def untraced_words(description: str, evidence: str) -> list[str]:
    """Content words in the description that are not in this evidence."""
    stems, joined = _span_index(evidence)
    missing = []
    for raw in _tokens(description):
        word = raw.lower().replace("'", "")
        if word in _STOP or len(word) < 3:
            continue
        if word in _NUM and re.search(rf"\b{_NUM[word]}\b", evidence or ""):
            continue
        alt = _SYNONYM.get(word)
        if stem(word) in stems:
            continue
        parts = [part for part in word.split("-") if part]
        if len(parts) > 1 and all(stem(part) in stems for part in parts):
            continue
        if alt and (alt.replace(" ", "") in joined or stem(alt.split()[-1]) in stems):
            continue
        if word == "member" and "staff" in stems and re.search(r"\bstaff members?\b", description or "", re.I):
            continue
        if (
            word == "specified"
            and re.search(r"time ?frame", description or "", re.I)
            and re.search(r"required time ?frame", evidence or "", re.I)
        ):
            continue
        if word not in missing:
            missing.append(word)
    return missing


def _same_scope(description: str, quant: str) -> bool:
    """True when the description repeats this partial count (words or digits)."""
    parts = _PARTIAL.search(quant)
    if not parts:
        return False
    left, right = parts.group(1).lower(), parts.group(2).lower()
    if re.search(re.escape(parts.group(0)), description, re.I):
        return True
    # "one" written where the span has "1", and the other number too.
    def forms(n: str) -> str:
        if n.isdigit():
            word = next((k for k, v in _NUM.items() if v == n), n)
            return rf"(?:{n}|{word})"
        digit = _NUM.get(n, n)
        return rf"(?:{n}|{digit})"
    return re.search(
        rf"\b{forms(left)}\s+(?:out\s+of|of)\s+{forms(right)}\b",
        description,
        re.I,
    ) is not None


def quantifier_problem(description: str, evidence: str) -> str | None:
    """A partial '1 of 6' cannot become an unscoped plural. all/none/every must be in the span."""
    low = (description or "").lower()
    ev = evidence or ""
    for word in ("all", "every", "none", "twice"):
        if re.search(rf"\b{word}\b", low) and not re.search(rf"\b{word}\b", ev, re.I):
            # "none of them" is fine when the span says "none of them".
            return f"quantifier '{word}' is not in this finding"
    for match in _PARTIAL.finditer(ev):
        left, right = match.group(1).lower(), match.group(2).lower()
        left_n = int(_NUM.get(left, left)) if (_NUM.get(left, left)).isdigit() else None
        right_n = int(_NUM.get(right, right)) if (_NUM.get(right, right)).isdigit() else None
        if left_n is not None and right_n is not None and left_n == right_n:
            continue  # six out of six is the whole set
        topic = ev[match.end(): match.end() + 90]
        nouns = [
            w.lower() for w in _tokens(topic)
            if w.lower() not in _GENERIC and w.lower() not in _STOP and len(w) >= 3
        ]
        if not nouns:
            continue
        # The counted group is the first noun ("residents", "proof"). A clause
        # quoted after "stating that" can mention that group without widening it.
        main = re.split(r"\bstating that\b", low, maxsplit=1)[0]
        if not re.search(rf"\b{re.escape(nouns[0])}\b", main):
            continue
        topic_words = set(nouns)
        desc_words = {w.lower() for w in _tokens(main)}
        if not topic_words & desc_words:
            continue
        if _same_scope(description, match.group(0)):
            continue
        # A singular "one file" restates a numerator of one.
        if left_n == 1 and re.search(r"\b(one|a single)\b", low):
            continue
        return f"quantifier scope '{match.group(0)}' is wider in the description"


def check_actor(description: str, evidence: str) -> str | None:
    """The named actor has to be the one in this finding. Licensee is not the licensing authority."""
    low = (description or "").lower()
    ev = (evidence or "").lower()
    for name, forms in _ACTORS:
        if not re.search(rf"\b{name}\b", low):
            continue
        if any(re.search(rf"\b{re.escape(form)}\b", ev) for form in forms):
            continue
        # Licensee in the description while the evidence only names LLA / the Department.
        if name == "licensee" and re.search(r"\blla\b|licensing authority", ev):
            return "actor is the licensee in the description and the licensing authority in the finding"
        if name == "lla" and re.search(r"\blicensee\b", ev) and not re.search(r"\blla\b", ev):
            return "actor is the licensing authority in the description and the licensee in the finding"
        return f"actor '{name}' is not in this finding"
    # "reviewed by the licensee" when the finding says "reviewed by LLA".
    if re.search(r"reviewed by the licensee", low) and re.search(r"reviewed by (the )?lla\b", ev):
        if not re.search(r"reviewed by the licensee", ev):
            return "actor is the licensee in the description and the licensing authority in the finding"
    return None


def check_deadline(description: str, evidence: str, inspection_date: str | None) -> str | None:
    """'failed to submit by the deadline' when the due date is still after the visit."""
    if not re.search(r"failed to submit|by the (specified )?deadline|above the regulatory limit|when questioned", description or "", re.I):
        return None
    if re.search(r"above the regulatory limit", description or "", re.I) and not re.search(
        r"regulatory limit|above the", evidence or "", re.I
    ):
        return "invented qualifier 'above the regulatory limit'"
    if re.search(r"when questioned", description or "", re.I) and not re.search(
        r"when questioned", evidence or "", re.I
    ):
        return "invented qualifier 'when questioned'"
    if not re.search(r"failed to submit|by the (specified )?deadline", description or "", re.I):
        return None
    if re.search(r"failed to submit", evidence or "", re.I):
        return None
    visit = _parse_iso(inspection_date)
    dues = _dates_in(evidence or "")
    if visit and any(due > visit for due in dues):
        return "failed to submit, but the due date in the finding is after the visit"
    if not re.search(r"failed to submit|deadline", evidence or "", re.I):
        return "failed to submit is not in this finding"
    return None


def check_number_words(description: str, evidence: str) -> str | None:
    ev = evidence or ""
    for word in _tokens(description):
        low = word.lower()
        if low not in _COUNT_WORDS:
            continue
        if re.search(rf"\b{low}\b", ev, re.I):
            continue
        digit = _NUM.get(low)
        if digit and re.search(rf"\b{digit}\b", ev):
            continue
        return f"count word '{low}' is not in this finding"
    return None


def check_families(description: str, source: str) -> str | None:
    if re.search(r"\bfamil", description or "", re.I) and not re.search(r"\bfamil", source or "", re.I):
        return "families is not in the source"
    return None


def check_assault(description: str, source: str) -> str | None:
    if re.search(r"\b(attempted|alleged) (sexual )?assault", description or "", re.I) and not re.search(
        r"attempted (sexual )?assault", source or "", re.I
    ):
        return "attempted assault is not in the source"
    return None


def check_one_to_one(description: str, evidence: str) -> str | None:
    if not re.search(r"one-to-one|one to one|one-on-one", description or "", re.I):
        return None
    if re.search(r"1:1|one-to-one", evidence or "", re.I) and re.search(r"smok", evidence or "", re.I):
        if not re.search(r"smok", description or "", re.I):
            return "one-to-one supervision in the finding is only while smoking"
    return None


def check_pronoun(description: str, source: str) -> str | None:
    if re.search(r"\b(he|she|his|him|her|hers)\b", description or "", re.I) and not re.search(
        r"\b(he|she|his|him|her|hers)\b", source or "", re.I
    ):
        return "gendered pronoun is not in the source"
    return None


def check_cause_of_death(description: str, evidence: str) -> str | None:
    said = re.search(r"cause of death[^.]{0,160}", evidence or "", re.I)
    claim = re.search(r"\b(died|passed away|cause of death)\b[^.]{0,80}", description or "", re.I)
    if not claim or not said:
        return None
    for word in _tokens(claim.group(0)):
        if word.lower() in _STOP or len(word) < 4:
            continue
        if word.lower() not in said.group(0).lower():
            return f"cause of death term '{word}' is not in the finding"
    return None


def check_care_words(description: str, source: str, inspection_type: str | None) -> str | None:
    for phrase in ("dementia care", "memory care", "routine"):
        if re.search(rf"\b{phrase}\b", description or "", re.I) and phrase not in (source or "").lower():
            if phrase == "routine" and (inspection_type or "") == "routine":
                continue
            return f"'{phrase}' is not in the source"
    return None


def check_type_class(description: str, defs: list[dict] | None) -> str | None:
    if not defs:
        return None
    classes = {(d.get("class") or "").lower() for d in defs}
    for match in re.finditer(r"\btype ([ab])\b", description or "", re.I):
        if f"type {match.group(1).lower()}" not in classes:
            return f"Type {match.group(1).upper()} is not in the deficiency rows"
    return None


def check_immediate_jeopardy(description: str, source: str, defs: list[dict] | None) -> str | None:
    if not re.search(r"immediate jeopardy", description or "", re.I):
        return None
    if re.search(r"immediate jeopardy", source or "", re.I):
        return None
    if defs and any(d.get("ij") for d in defs):
        return None
    return "immediate jeopardy is not in the source"


def check_corrected(description: str, source: str) -> str | None:
    if re.search(r"\ball\b[^.]{0,40}\bcorrected\b", description or "", re.I) and not re.search(
        r"\ball\b[^.]{0,40}\bcorrected\b", source or "", re.I
    ):
        return "all corrected is not in the source"
    if re.search(r"\b(was|were|has been|have been) corrected\b", description or "", re.I) and not re.search(
        r"correct", source or "", re.I
    ):
        return "corrected is not in the source"
    return None


def check_outcome(description: str, header: str, outcome: str | None, source: str) -> str | None:
    """Complaint outcome words have to match the row, and only if the source says them."""
    text = f"{header} {description}".lower()
    oc = (outcome or "").lower()
    src = (source or "").lower()
    if oc == "substantiated" and re.search(r"\b(unsubstantiated|not substantiated)\b", text) and "unsubstantiated" not in src:
        return "summary says unsubstantiated but the outcome is substantiated"
    if oc == "unsubstantiated" and re.search(r"(?<!un)substantiated", text) and "not substantiated" not in text:
        return "summary says substantiated but the outcome is unsubstantiated"
    if oc == "unsubstantiated" and re.search(r"\bcited\b", text):
        return "cited on an unsubstantiated complaint"
    return None


def check_plural(description: str, evidence: str) -> str | None:
    if re.search(r"\b(one|a single)\s+\w+s\b", description or "", re.I):
        # "one staff" is fine; "one files" is not.
        if re.search(r"\b(one|a single)\s+[a-z]+s\b", description or "", re.I) and re.search(
            r"\b(one|a single)\s+(files|records|residents|citations)\b", description or "", re.I
        ):
            return "singular count with a plural noun"
    return None


def check_compliance(description: str, source: str) -> str | None:
    if re.search(r"not in substantial compliance", description or "", re.I) and not re.search(
        r"not in substantial compliance", source or "", re.I
    ):
        return "not in substantial compliance is not in the source"
    return None


def check_markdown(description: str) -> str | None:
    if re.search(r"(?m)^\s*(#|[-*•]\s)", description or ""):
        return "markdown in the description"
    return None


_NOT_A_NAME = frozenset(
    "operator licensee director administrator surveyor department resident staff caregiver "
    "licensor analyst facility january february march april may june july august september "
    "october november december recordkeeping emergency certification plan the".split()
)
# Both words must be on this list. A real first-and-last name is not.
_NAME_OK = frozenset(
    "cardio pulmonary cardiopulmonary resuscitation adult protective long term "
    "residential care elderly california assisted living".split()
)


def check_person_name(description: str, source: str, facility: str | None) -> str | None:
    """Two consecutive capitalized words that are not a role, a term, or the facility name."""
    fac = set(re.findall(r"[a-z']+", (facility or "").lower()))
    for match in re.finditer(r"\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b", description or ""):
        first, second = match.group(1), match.group(2)
        if first.lower() in _NOT_A_NAME or second.lower() in _NOT_A_NAME:
            continue
        if first.lower() in _NAME_OK and second.lower() in _NAME_OK:
            continue
        if first.lower() in fac or second.lower() in fac:
            continue
        if re.search(rf"\b{first.lower()}\b", source or "") or re.search(rf"\b{second.lower()}\b", source or ""):
            continue
        return f"possible person name '{first} {second}'"
    return None


def check_inspector_name(description: str, source: str, facility: str | None) -> str | None:
    fac = (facility or "").lower()
    for match in re.finditer(
        r"(?:Licensing Program Analyst \(LPA\)|LPA|Evaluator|Investigator|Surveyor)\s+([A-Z][a-z]+)",
        source or "",
    ):
        name = match.group(1)
        if len(name) > 3 and re.search(rf"\b{name}\b", description or "") and name.lower() not in fac:
            return f"inspector name '{name}'"
    return None


def check_no_further(description: str, source: str) -> str | None:
    if re.search(r"no further (?:action|actions|enforcement)", description or "", re.I) and not re.search(
        r"no further (?:action|actions|enforcement)", source or "", re.I
    ):
        return "no further action is not in the source"
    return None


def check_plural_agents(description: str, source: str) -> str | None:
    for plural, single in (("inspectors", "inspector"), ("surveyors", "surveyor"), ("analysts", "analyst")):
        if re.search(rf"\b{plural}\b", description or "", re.I) and not re.search(rf"\b{plural}\b", source or "", re.I):
            return f"'{plural}' is not in the source; the report uses one {single}"
    return None


def check_the_state(description: str, source: str) -> str | None:
    if re.search(r"\bthe state\b", description or "", re.I) and not re.search(r"\bthe state\b", source or "", re.I):
        if re.search(r"\bthe department\b", source or "", re.I):
            return "the state is not the Department's wording"
    return None


def check_arrival(description: str, evidence: str) -> str | None:
    match = re.search(r"\b(on|upon) (arrival|admission)\b", description or "", re.I)
    if not match:
        return None
    if not re.search(r"\b(on|upon) (arrival|admission)\b", evidence or "", re.I):
        return "arrival wording is not in this finding"
    return None


def check_attributed_count(description: str, evidence: str) -> str | None:
    """A count that the finding gives only inside someone's statement must stay attributed."""
    if re.search(r"\b(said|stated|told|reported)\b", description or "", re.I):
        return None
    for sent in re.split(r"(?<=[.;])\s+", evidence or ""):
        if not re.search(r"\b(said|stated|told|reported)\b", sent, re.I):
            continue
        for word in _COUNT_WORDS:
            if re.search(rf"\b{word}\b", sent, re.I) and re.search(rf"\b{word}\b", description or "", re.I):
                if not re.search(rf"\b{word}\b", evidence or "", re.I) or re.search(
                    rf"\b{word}\b", sent, re.I
                ):
                    # Only flag when the word does not also appear outside statements.
                    outside = evidence or ""
                    for spoken in re.findall(r"[^.]*\b(said|stated|told|reported)\b[^.]*\.", evidence or "", re.I):
                        outside = outside.replace(spoken, " ")
                    if not re.search(rf"\b{word}\b", outside, re.I):
                        return f"count word '{word}' is only in someone's statement"
    return None


def end_punctuation_problem(description: str) -> str | None:
    """Each description ends with a stop, so the next finding cannot run on from it."""
    text = (description or "").strip()
    if not text.endswith((".", "!", "?")):
        return "description does not end with punctuation and would run into the next finding"
    return None


def _parse_iso(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _dates_in(text: str) -> list[date]:
    found = []
    for match in re.finditer(r"\b(\d{1,2})/(\d{1,2})/(\d{2,4})\b", text or ""):
        month, day, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
        if year < 100:
            year += 2000
        try:
            found.append(date(year, month, day))
        except ValueError:
            continue
    return found


def header_date_allowed(written: str | None, inspection_date: str | None) -> bool:
    """A header date must be the inspection row's date. A different report date is omitted.

    A copied range is kept when the row's date is one of the dates in that range.
    """
    if not written or not inspection_date:
        return True
    row = _parse_iso(inspection_date)
    if row is None:
        return True
    months = {
        "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
        "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    }
    stated: list[date] = []
    for match in re.finditer(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})",
        written,
    ):
        try:
            stated.append(date(int(match.group(3)), months[match.group(1).lower()], int(match.group(2))))
        except ValueError:
            return False
    if not stated:
        return True
    return row in stated


def mn_evidence(source: str, tag: str | None) -> str | None:
    """The MN parser's finding narrative: text after 'not met as evidenced by', statute excluded."""
    from _extractive_merge import tag_key
    import mn_defs

    code = tag_key(tag)
    if not code or not re.fullmatch(r"\d{3,5}", code):
        return None
    for rec in mn_defs.parse(source or ""):
        if tag_key(rec.get("code")) == code and rec.get("inspector_narrative"):
            return rec["inspector_narrative"]
    return None


def deficiency_rows(defs: list[dict] | None) -> tuple[list[dict], list[dict]]:
    """Deficiency rows, including a row whose code is blank. MN-SUBST is separate."""
    rows: list[dict] = []
    subst: list[dict] = []
    for item in defs or []:
        code = item.get("code")
        text = "" if code is None else str(code).strip()
        compact = re.sub(r"[\s\-]", "", text).upper()
        if compact in {"MNSUBST", "MNSUBSTANT"}:
            subst.append(item)
            continue
        rows.append(item)
    return rows, subst


def split_substantiation(defs: list[dict] | None) -> tuple[list[str], list[dict]]:
    """MN-SUBST rows are not deficiency tags. They are returned separately."""
    tags: list[str] = []
    subst: list[dict] = []
    for item in defs or []:
        code = str(item.get("code") or "").strip()
        if not code or code.lower() == "none":
            continue
        if code.upper().replace(" ", "") in {"MN-SUBST", "MNSUBST"}:
            subst.append(item)
            continue
        tags.append(code)
    return tags, subst


def ground_problems(
    description: str,
    evidence: str,
    *,
    source: str,
    state_code: str,
    inspection_date: str | None = None,
    inspection_type: str | None = None,
    defs: list[dict] | None = None,
    outcome: str | None = None,
    facility: str | None = None,
    how: str = "",
) -> list[str]:
    """Hard failures for one description. The reason names the untraced words."""
    problems: list[str] = []
    punct = end_punctuation_problem(description)
    if punct:
        problems.append(punct)
    for fn in (
        lambda: quantifier_problem(description, evidence),
        lambda: check_actor(description, evidence),
        lambda: check_deadline(description, evidence, inspection_date),
        lambda: check_number_words(description, evidence),
        lambda: check_families(description, source),
        lambda: check_assault(description, source),
        lambda: check_one_to_one(description, evidence),
        lambda: check_pronoun(description, source),
        lambda: check_cause_of_death(description, evidence),
        lambda: check_care_words(description, source, inspection_type),
        lambda: check_type_class(description, defs),
        lambda: check_immediate_jeopardy(description, source, defs),
        lambda: check_corrected(description, source),
        lambda: check_plural(description, evidence),
        lambda: check_compliance(description, source),
        lambda: check_markdown(description),
        lambda: check_person_name(description, source, facility),
        lambda: check_inspector_name(description, source, facility),
        lambda: check_no_further(description, source),
        lambda: check_plural_agents(description, source),
        lambda: check_the_state(description, source),
        lambda: check_arrival(description, evidence),
        lambda: check_attributed_count(description, evidence),
    ):
        hit = fn()
        if hit:
            problems.append(hit)
    missing = untraced_words(description, evidence)
    if missing:
        problems.append("untraced: " + ", ".join(missing) + (f" ({how})" if how else ""))
    return problems
