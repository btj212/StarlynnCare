#!/usr/bin/env python3
"""Prompt-string checks for scrapers/summarize_inspections.py (no DB, no API calls).

Every state prompt must: carry no run date ("Today is"), carry no license-type sentence,
state the record-date rule, and state the attribution rule (what a resident or staff
member said is attributed, never stated as fact).

The report text sent to the model is not truncated. A 20,000-character report is
passed in full. A report that cannot fit in one context window is split on
finding boundaries, or on paragraphs when it has none, and no character is dropped.

v7: each chunk of a long report gives verbatim items; code merges them (dedupe on tag plus
finding, non-verbatim items dropped) and ONE summary call writes the summary. Counts come from
"Cited deficiencies on file" (parsed D rows), never from adding up model output. The long-report
test uses a real 117,791-character MN report (scripts/testdata/mn_long_report_01fa1748.json).
"""

from __future__ import annotations

import json
import os
import re
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scrapers"))

# The module imports anthropic, psycopg and dotenv at top level. Stub them if this
# environment does not have them, so the test needs no extra installs.
for _name in ("anthropic", "psycopg"):
    if _name not in sys.modules:
        try:
            __import__(_name)
        except ImportError:
            sys.modules[_name] = types.ModuleType(_name)
try:
    import dotenv  # noqa: F401
except ImportError:
    _d = types.ModuleType("dotenv")
    _d.load_dotenv = lambda *a, **k: None
    sys.modules["dotenv"] = _d
if not hasattr(sys.modules["anthropic"], "Anthropic"):
    sys.modules["anthropic"].Anthropic = object

import summarize_inspections as si  # noqa: E402
import _summary_assemble as asm  # noqa: E402

os.environ["MODEL_PROFILE"] = "haiku"

STATES = ("CA", "TX", "OR", "WA", "MN", "UT", "IL", "CO", "PA", "AZ", "MO")

LICENSE_TYPE = re.compile(
    r"licensed (?:as|under)|is licensed|are licensed|Assisted Living Facility\s+with\s+Dementia\s+Care"
    r"|Memory Care Endorsement|license Types|R432-270\.|ORS ch\. 443|77 Ill\. Adm\. Code"
    r"|6 CCR 1011-1|These homes are assisted living|These records cover personal care homes"
    r"|researching memory care",
    re.I,
)


def _all_prompts() -> dict[str, str]:
    prompts = {st: si.SYSTEM_PROMPTS_BY_STATE[st] for st in STATES}
    prompts["GENERIC"] = si.SYSTEM_PROMPT_GENERIC
    return prompts


def test_twelve_prompts() -> None:
    prompts = _all_prompts()
    assert set(si.SYSTEM_PROMPTS_BY_STATE) == set(STATES)
    assert len(prompts) == 12


def test_no_today_is() -> None:
    for st, p in _all_prompts().items():
        assert "Today is" not in p, st
        assert si.TODAY not in p, st


def test_no_license_type_sentence() -> None:
    for st, p in _all_prompts().items():
        m = LICENSE_TYPE.search(p)
        assert m is None, f"{st}: license-type text {m.group(0)!r}"


def test_record_date_rule() -> None:
    for st, p in _all_prompts().items():
        assert "on or before the record date given with each report are real" in p, st
        assert "2025 or 2026" not in p, st


def test_attribution_rule() -> None:
    for st, p in _all_prompts().items():
        flat = " ".join(p.split())
        assert "said, reported, or told the inspector must be attributed to that person" in flat, st
        assert "Never state it as fact." in flat, st


def test_user_message_carries_record_date() -> None:
    sent = {}

    class _Resp:
        def __init__(self) -> None:
            self.content = [
                types.SimpleNamespace(
                    text='[{"tag": null, "description": "The analyst visited."}]'
                )
            ]

    class _Messages:
        def create(self, **kw):
            sent.update(kw)
            return _Resp()

    client = types.SimpleNamespace(messages=_Messages())
    out = si.summarize(
        client, "complaint", True, None, "The analyst visited on 3/10/2025. R1 said staff were late.",
        state_code="MN", deficiency_count=1, record_date="2025-03-10",
    )
    assert out
    assert "1 correction order" in out
    assert "2025" not in out
    user = sent["messages"][0]["content"]
    assert "Record date (state database): 2025-03-10" in user
    assert "Today is" not in sent["system"]
    assert sent["system"] == si.DESCRIBE_SYSTEM_PROMPT
    sent.clear()
    si.summarize(client, "visit", False, None, "Visit made.", state_code="ZZ")
    assert "Record date (state database): unknown" in sent["messages"][0]["content"]
    assert sent["system"] == si.DESCRIBE_SYSTEM_PROMPT


def _stub_client(sent: list[dict]) -> types.SimpleNamespace:
    class _Resp:
        def __init__(self) -> None:
            self.content = [
                types.SimpleNamespace(
                    text='[{"tag": null, "description": "The resident said staff were late to the dining room."}]'
                )
            ]

    class _Messages:
        def create(self, **kw):
            sent.append(kw)
            return _Resp()

    return types.SimpleNamespace(messages=_Messages())


def test_full_report_reaches_model() -> None:
    """A long report is evidence. Cutting it would hide the end of the record."""
    tail = "END_OF_REPORT_MARKER"
    unit = "The resident said staff were late to the dining room. "
    narrative = (unit * ((20000 // len(unit)) + 2))[: 20000 - len(tail)] + tail
    assert len(narrative) == 20000
    sent: list[dict] = []
    out = si.summarize(
        _stub_client(sent),
        "visit",
        False,
        None,
        narrative,
        state_code="CA",
        deficiency_count=1,
        record_date="2025-03-10",
    )
    assert out
    assert len(sent) == 1
    user = sent[0]["messages"][0]["content"]
    assert narrative in user
    assert tail in user
    assert "Record date (state database): 2025-03-10" in user


def test_no_slice_or_cap_constant() -> None:
    """The model input must not be shortened by a character cap."""
    source = (ROOT / "scrapers" / "summarize_inspections.py").read_text()
    assert "[:6000]" not in source
    assert "6000" not in source
    assert "textwrap" not in source
    assert re.search(r"\b(?:MAX_CHARS|MAX_NARRATIVE|CHAR_LIMIT|CHAR_CAP)\b", source) is None
    # The only remaining slice of the report itself is the dry-run console
    # preview. That preview is printed instead of calling the model.
    assert re.findall(r"narrative\[:\s*\d+\s*\]", source) == ["narrative[:150]"]
    fn = source.split("def summarize(", 1)[1].split("\ndef ", 1)[0]
    assert "narrative[" not in fn
    assert "[:" not in fn


def test_split_keeps_every_character() -> None:
    """Overflow splits on findings, then paragraphs, and still sends every character."""
    finding = "Deficiency: the resident said the meal arrived late.\n"
    marked = "Opening note.\n" + finding * 40
    chunks = si._chunks_for_model(marked, 80)
    assert "".join(chunks) == marked
    assert len(chunks) > 1
    assert all(len(chunk) <= 80 for chunk in chunks)
    assert all(chunk.startswith("Deficiency:") for chunk in chunks[1:])

    paragraph = "The resident said the hallway light was out.\n\n"
    prose = paragraph * 20
    prose_chunks = si._chunks_for_model(prose, 90)
    assert "".join(prose_chunks) == prose
    assert len(prose_chunks) > 1
    assert all(len(chunk) <= 90 for chunk in prose_chunks)

    blob = "X" * 50
    hard = si._chunks_for_model(blob, 10)
    assert "".join(hard) == blob
    assert [len(piece) for piece in hard] == [10, 10, 10, 10, 10]

    sent: list[dict] = []
    original_budget = si._narrative_budget
    si._narrative_budget = lambda system, overhead: 80
    try:
        out = si.summarize(_extracting_client(sent, _copy_first_sentence), "visit", False, None, marked, state_code="CA")
    finally:
        si._narrative_budget = original_budget
    # The stub's prose summary is not a description list, so nothing is stored.
    # Every character of the report still reached the extract calls.
    assert out is None
    extract_calls = [c for c in sent if c["system"] == si.EXTRACT_SYSTEM_PROMPT]
    summary_calls = [c for c in sent if c["system"] != si.EXTRACT_SYSTEM_PROMPT]
    assert len(extract_calls) > 1
    assert len(summary_calls) == 1
    delivered = []
    for k, call in enumerate(extract_calls, 1):
        user = call["messages"][0]["content"]
        start = user.index("Text:\n") + len("Text:\n")
        end = user.index(f"\n\nEnd of part {k}.")
        delivered.append(user[start:end])
    assert "".join(delivered) == marked


# ---------------------------------------------------------------------------
# v7 extractive merge
# ---------------------------------------------------------------------------
FIXTURE = json.loads((ROOT / "scripts" / "testdata" / "mn_long_report_01fa1748.json").read_text())
_SAFE_DESCRIPTION = "The licensee failed to."
_FAIL = re.compile(r"the licensee failed to[^.]{10,400}\.", re.I)


def _describe_reply(user: str) -> str:
    """One digit-free description per tag line. No tags -> an empty list."""
    tags: list[str] = []
    for line in user.splitlines():
        if line.startswith("- tag "):
            tag = line.split(":", 1)[0][len("- tag "):]
            if tag not in tags:
                tags.append(tag)
    return json.dumps([{"tag": tag, "description": _SAFE_DESCRIPTION} for tag in tags])


def _tags_printed(flat: str) -> list[str]:
    return [t for t in FIXTURE["codes"] if re.search(r"\b" + t[0] + r"\s?" + t[1:] + r"\b", flat)]


def _fake_extract(chunk: str) -> str:
    """Stands in for the per-chunk model call. Copies each tag's 'the licensee failed to ...' sentence every
    time the tag block is printed (so tags continued across chunks give duplicates), plus a paraphrase and an
    invented count that must not survive the merge."""
    flat = " ".join(chunk.split())
    items = []
    for tag in _tags_printed(flat):
        for m in re.finditer(r"\b" + tag[0] + r"\s?" + tag[1:] + r"\b", flat):
            nm = flat.find("not met as evidenced", m.start(), m.start() + 4000)
            f = _FAIL.search(flat, nm) if nm >= 0 else None
            if f and f.start() - nm < 400:
                items.append({"tag": tag, "kind": "finding", "quote": f.group(0)})
    items.append({"tag": None, "kind": "finding", "quote": "The home had many problems with care and safety."})
    items.append({"tag": None, "kind": "finding", "quote": "There were 99 violations in total."})
    return json.dumps(items)


def _copy_first_sentence(chunk: str) -> str:
    quote = chunk.strip().splitlines()[0] if chunk.strip() else ""
    return json.dumps([{"tag": None, "kind": "finding", "quote": quote}])


def _extracting_client(sent: list[dict], extract=None) -> types.SimpleNamespace:
    extract = extract or _fake_extract

    class _Messages:
        def create(self, **kw):
            sent.append(kw)
            if kw["system"] == si.EXTRACT_SYSTEM_PROMPT:
                user = kw["messages"][0]["content"]
                chunk = user.split("Text:\n", 1)[1].rsplit("\n\nEnd of part", 1)[0]
                text = extract(chunk)
            else:
                text = _describe_reply(kw["messages"][0]["content"])
            return types.SimpleNamespace(content=[types.SimpleNamespace(text=text)])

    return types.SimpleNamespace(messages=_Messages())


def test_long_report_fixture_is_real() -> None:
    narrative = FIXTURE["narrative"]
    assert len(narrative) > 100_000
    assert len(FIXTURE["codes"]) == FIXTURE["tdc"] == 16


def test_long_report_counts_equal_d_rows() -> None:
    """Real long MN report, forced into several chunks: the final call gets each cited tag once, the
    count comes from the parsed D rows, fabricated items are dropped, and there is ONE summary call."""
    narrative = FIXTURE["narrative"]
    d_rows = len(FIXTURE["codes"])
    sent: list[dict] = []
    original_budget = si._narrative_budget
    si._narrative_budget = lambda system, overhead: 20_000
    try:
        out = si.summarize(
            _extracting_client(sent), FIXTURE["inspection_type"], False, None, narrative,
            state_code="MN", deficiency_count=d_rows, record_date=FIXTURE["inspection_date"],
        )
    finally:
        si._narrative_budget = original_budget
    extract_calls = [c for c in sent if c["system"] == si.EXTRACT_SYSTEM_PROMPT]
    summary_calls = [c for c in sent if c["system"] != si.EXTRACT_SYSTEM_PROMPT]
    assert len(extract_calls) >= 5
    assert len(summary_calls) == 1
    assert out
    assert "16 correction orders" in out
    assert "licensing survey" not in out.lower()
    assert "$" not in out
    assert "June" not in out and "July" not in out  # form boilerplate is not the survey date
    assert out.count(_SAFE_DESCRIPTION) == 16
    final_user = summary_calls[0]["messages"][0]["content"]
    assert f"Cited deficiencies on file: {d_rows}" in final_user
    tag_lines = [line for line in final_user.splitlines() if line.startswith("- tag ")]
    tags = [line.split(":", 1)[0][len("- tag "):] for line in tag_lines]
    assert len(tags) == len(set(tags)), "a tag is listed twice"
    assert sorted(tags) == sorted(FIXTURE["codes"])
    assert len(tags) == d_rows
    assert "many problems" not in final_user
    assert "99 violations" not in final_user
    source = " ".join(narrative.split()).lower()
    for quote in re.findall(r'finding: "([^"]+)"', final_user):
        assert " ".join(quote.split()).lower() in source
    listed = final_user.split("deduplicated on tag plus finding.", 1)[1]
    assert re.search(r"\b(\d+|sixteen) (correction orders|violations|deficiencies)\b", listed, re.I) is None


def test_merge_dedupes_tag_plus_finding() -> None:
    chunk_a = "0510 not met as evidenced by: the licensee failed to keep the log current."
    chunk_b = "0510 continued. the licensee failed to keep the log current. 0480 the licensee failed to post hours."
    items_a = [{"tag": "0510", "kind": "finding", "quote": "the licensee failed to keep the log current."}]
    items_b = [
        {"tag": "0 510", "kind": "finding", "quote": "The licensee  failed to keep the log current."},
        {"tag": "0480", "kind": "finding", "quote": "the licensee failed to post hours."},
        {"tag": "0480", "kind": "finding", "quote": "failed to post hours"},
    ]
    merged, stats = si.merge_items([chunk_a, chunk_b], [si.parse_items(json.dumps(items_a)), si.parse_items(json.dumps(items_b))])
    assert [(m["tag"], m["quote"]) for m in merged] == [
        ("0510", "the licensee failed to keep the log current."),
        ("0480", "the licensee failed to post hours."),
    ]
    assert stats["dropped_duplicate"] == 1 and stats["dropped_contained"] == 1
    assert si.parse_items("I cannot help with that.") == []


def test_boundary_tag_survives_once() -> None:
    """02360 starts at the end of chunk 2 and finishes in chunk 3. It must be kept once, with 02310."""
    c1 = "02310 not met as evidenced by the licensee failed to post the hours of operation for residents."
    c2 = "The complaint continued. 02360 not met as evidenced by the licensee failed to "
    c3 = "keep medications locked in the cabinet at all times."
    q10 = "the licensee failed to post the hours of operation for residents."
    q60 = "the licensee failed to keep medications locked in the cabinet at all times."
    assert q60 not in c2 and q60 not in c3
    assert q60 in (c2 + c3)
    tagged = [
        [{"tag": "02310", "kind": "finding", "quote": q10}],
        [{"tag": "02360", "kind": "finding", "quote": q60}],
        [{"tag": "02360", "kind": "finding", "quote": q60}],
    ]
    merged, _stats = si.merge_items(
        [c1, c2, c3],
        [si.parse_items(json.dumps(chunk)) for chunk in tagged],
    )
    tags = [item["tag"] for item in merged]
    assert tags.count("02310") == 1
    assert tags.count("02360") == 1
    # Same seam, but the continuation comes back without a tag. The open tag on chunk 2 claims it.
    untagged = [
        [{"tag": "02310", "kind": "finding", "quote": q10}],
        [],
        [{"tag": None, "kind": "finding", "quote": q60}],
    ]
    merged_open, _stats_open = si.merge_items(
        [c1, c2, c3],
        [si.parse_items(json.dumps(chunk)) for chunk in untagged],
    )
    open_tags = [item["tag"] for item in merged_open]
    assert open_tags.count("02310") == 1
    assert open_tags.count("02360") == 1


def test_header_copies_facts_and_omits_gaps() -> None:
    """Counts, the date, and the visit wording are copied. Unknown fields and a zero count are left out."""
    source = (
        "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
        "total amount you are assessed is $1,250."
    )
    header = asm.build_header(state_code="MN", source=source, finding_count=2, penalty="$1,250")
    assert header == (
        "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
        "It issued 2 correction orders. Fines totaling $1,250 were assessed."
    )
    assert "licensing survey" not in header.lower()
    empty = asm.build_header(
        state_code="MN",
        source="The licensee failed to post the hours.",
        finding_count=0,
        penalty=None,
    )
    assert empty == ""
    assert "0 citations" not in empty
    assert "no deficiencies" not in empty.lower()
    assert "clean record" not in empty.lower()
    texas = asm.build_header(
        state_code="TX",
        source="The narrative says the home had a clean record and no deficiencies.",
        finding_count=0,
        penalty=None,
    )
    assert "clean record" not in texas.lower()
    assert "no deficiencies" not in texas.lower()
    assert "0 citations" not in texas
    # A surveyor's clock time is not the survey date.
    clock = "On July 17, 2023, at 11:20 a.m. the surveyor observed the dining room."
    assert asm.survey_date_as_written(clock) is None


def test_penalty_latest_letter_and_followup_label() -> None:
    """An amended letter replaces the earlier total. A later no-fine letter clears it."""
    revised = (
        "total amount you are assessed is $9,500. "
        "This amount is stricken. total amount you are assessed is $12,500."
    )
    assert asm.latest_assessed_penalty(revised) == "$12,500"
    cleared = "total amount you are assessed is $9,500. The revised letter says no fine."
    assert asm.latest_assessed_penalty(cleared) is None
    single = "total amount you are assessed is $1,250."
    assert asm.latest_assessed_penalty(single) == "$1,250"
    plan = json.loads((ROOT / "scrapers" / "followup_fine_label_plan.json").read_text())
    for row in plan["rows"][:2]:
        label = asm.followup_fine_sentence(row["printed_amount"], row["followup_letter_date_display"])
        assert label == row["proposed_label"]
        assert row["printed_amount"] in label
        assert row["followup_letter_date_display"] in label
    header = asm.build_header(
        state_code="MN",
        source="On June 1, 2023, the Minnesota Department of Health completed a survey.",
        finding_count=1,
        penalty="$9,500",
        followup_amount=plan["rows"][0]["printed_amount"],
        followup_letter_date=plan["rows"][0]["followup_letter_date_display"],
    )
    assert plan["rows"][0]["proposed_label"] in header
    assert "Fines totaling" not in header


def test_description_gate() -> None:
    """A digit, a dollar sign, report-says, an identifier, or a made-up visit label is not stored."""
    source = (
        "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
        "0510 not met as evidenced by the licensee failed to post the hours."
    )
    base = {
        "state_code": "MN",
        "source": source,
        "d_tags": ["0510"],
        "finding_count": 1,
        "penalty": None,
    }

    def run(description: str, tags: list[dict] | None = None, count: int = 1, d_tags: list[str] | None = None):
        payload = tags if tags is not None else [{"tag": "0510", "description": description}]
        text, err = asm.assemble_summary(
            state_code="MN",
            source=source,
            descriptions=payload,
            d_tags=["0510"] if d_tags is None else d_tags,
            finding_count=count,
            penalty=None,
        )
        return text, err

    good, err = run("The licensee failed to post the hours.")
    assert err is None and good
    assert "March 10, 2024" in good
    assert "full survey" in good
    assert "1 correction order" in good
    assert "licensing survey" not in good.lower()
    assert run("The licensee failed to post 3 items.")[0] is None
    assert run("A fine of $500 was listed.")[0] is None
    assert run("The report says the hallway was dark.")[0] is None
    assert run("Resident #2 missed a meal.")[0] is None
    assert "resident or staff identifier" in asm.description_problems("Resident #2 missed a meal.", source, "MN")
    assert run("This was a licensing survey.")[0] is None
    assert run("The licensee failed to post the hours.", count=2)[0] is None
    extra, extra_err = run(
        "",
        tags=[
            {"tag": "0510", "description": "The licensee failed to post the hours."},
            {"tag": "0999", "description": "The licensee failed to keep a log."},
        ],
        count=1,
    )
    assert extra is None and extra_err
    missing, missing_err = run("", tags=[], count=1)
    assert missing is None and missing_err
    dup, dup_err = run(
        "",
        tags=[
            {"tag": "0510", "description": "The licensee failed to post the hours."},
            {"tag": "0510", "description": "The licensee failed to post the hours again."},
        ],
        count=1,
    )
    assert dup is None and dup_err
    del base


def _json_client(payload: str) -> types.SimpleNamespace:
    class _Messages:
        def create(self, **kw):
            return types.SimpleNamespace(content=[types.SimpleNamespace(text=payload)])

    return types.SimpleNamespace(messages=_Messages())


def test_mocked_model_bad_description_stores_nothing() -> None:
    """A digit, an extra tag, or a missing tag returns nothing. A clean reply is stored."""
    source = (
        "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
        "0510 not met as evidenced by the licensee failed to post the hours."
    )
    kwargs = dict(
        state_code="MN",
        deficiency_count=1,
        d_tags=["0510"],
        record_date="2024-03-10",
    )

    def run(payload: str):
        return si.summarize(_json_client(payload), "survey", False, None, source, **kwargs)

    good = run(json.dumps([{"tag": "0510", "description": "The licensee failed to post the hours."}]))
    assert good
    assert "full survey" in good
    assert "1 correction order" in good
    assert "March 10, 2024" in good
    assert "$" not in good
    assert "licensing survey" not in good.lower()
    assert run(json.dumps([{"tag": "0510", "description": "The licensee failed to post 3 hours."}])) is None
    assert run(json.dumps([
        {"tag": "0510", "description": "The licensee failed to post the hours."},
        {"tag": "0999", "description": "The licensee failed to keep a log."},
    ])) is None
    assert run(json.dumps([])) is None


def test_model_profile_required() -> None:
    """No profile, no call, nothing stored."""
    saved = os.environ.pop("MODEL_PROFILE", None)
    called: list[dict] = []

    class _Messages:
        def create(self, **kw):
            called.append(kw)
            return types.SimpleNamespace(content=[types.SimpleNamespace(text="[]")])

    try:
        out = si.summarize(
            types.SimpleNamespace(messages=_Messages()),
            "visit",
            False,
            None,
            "The licensee failed to post the hours.",
            state_code="CA",
            deficiency_count=0,
        )
        assert out is None
        assert called == []
        assert si.model_name() is None
    finally:
        os.environ["MODEL_PROFILE"] = saved or "haiku"


def test_no_findings_and_length_limit() -> None:
    for reply in (si._NO_FINDINGS, "x" * (si._MAX_SUMMARY_CHARS + 1)):
        class _Messages:
            def create(self, **kw):
                return types.SimpleNamespace(content=[types.SimpleNamespace(text=reply)])
        out = si.summarize(types.SimpleNamespace(messages=_Messages()), "complaint", True, None, "Form text only.", state_code="MN")
        assert out is None


def _pilot(prefix: str) -> dict:
    if not hasattr(_pilot, "rows"):
        _pilot.rows = json.loads((ROOT / "scripts" / "testdata" / "pilot_rows_v8.json").read_text())
    return next(row for row in _pilot.rows if row["id"].startswith(prefix))


def _gate(row: dict, descriptions: list[dict], **kwargs):
    count = kwargs.pop("finding_count", row["tdc"])
    return asm.assemble_summary(
        state_code=row["state"],
        source=row["narrative"],
        descriptions=descriptions,
        d_tags=kwargs.pop("d_tags", None),
        finding_count=count,
        penalty=kwargs.pop("penalty", asm.latest_assessed_penalty(row["narrative"], row.get("cmp"))),
        inspection_date=row["inspection_date"],
        inspection_type=row.get("inspection_type"),
        defs=kwargs.pop("defs", None),
        facility=row.get("facility"),
    )


def test_v6_check_sites_are_mapped() -> None:
    """Every v6 check site is ported, already covered, or a dropped length rule."""
    from _summary_ground import V6_CHECK_SITES, v6_site_counts

    assert len(V6_CHECK_SITES) == 59
    counts = v6_site_counts()
    assert counts == {"ported": 46, "covered": 8, "dropped": 5}
    dropped = [line for line, status, _name in V6_CHECK_SITES if status == "dropped"]
    assert dropped == [309, 314, 315, 316, 317]


def test_grounding_catches_the_pilot_errors() -> None:
    """The five stored errors are rejected, and a description copied from the same finding is kept."""
    fdd = _pilot("fdd54f3c")
    bad_fdd = [
        {"tag": None, "description": "Staff files did not contain proof of required annual training"},
        {"tag": None, "description": "Staff files did not contain proof of TB test"},
        {"tag": None, "description": "Emergency evacuation chair is located in one stairwell only"},
    ]
    text, err = _gate(fdd, bad_fdd)
    assert text is None
    assert err and "punctuation" in err
    evidence, _how = asm._evidence_for(fdd["narrative"], None, [])
    tb_problems = asm.description_problems(
        bad_fdd[1]["description"], fdd["narrative"], "CA",
        evidence=evidence, inspection_date=fdd["inspection_date"],
    )
    assert any("one out of six" in problem for problem in tb_problems)
    good_fdd = [
        {"tag": None, "description": "Six out of six staff files did not contain proof of required annual training."},
        {"tag": None, "description": "One out of six staff files did not have proof of a TB test."},
        {"tag": None, "description": "There is a emergency evacuation chair in one stairwell only."},
    ]
    kept, kept_err = _gate(fdd, good_fdd, penalty=None)
    assert kept_err is None and kept and "3 citations" in kept

    hot = _pilot("bf1bb029")
    limit = "Hot water temperature in a resident apartment unit on the second floor measured above the regulatory limit."
    late = "The licensee failed to submit required updated and current documents by the specified deadline."
    hot_evidence, _how = asm._evidence_for(hot["narrative"], None, [])
    limit_problems = asm.description_problems(
        limit, hot["narrative"], "CA", evidence=hot_evidence, inspection_date=hot["inspection_date"],
    )
    late_problems = asm.description_problems(
        late, hot["narrative"], "CA", evidence=hot_evidence, inspection_date=hot["inspection_date"],
    )
    assert _gate(hot, [{"tag": None, "description": limit}], finding_count=1)[0] is None
    assert any("regulatory" in problem for problem in limit_problems)
    assert _gate(hot, [{"tag": None, "description": late}], finding_count=1)[0] is None
    assert any("failed to submit" in problem for problem in late_problems)
    hot_ok, hot_err = _gate(hot, [{"tag": None, "description": "Hot water temperature in a resident apartment was tested."}], finding_count=1, penalty=None)
    due_ok, due_err = _gate(hot, [{"tag": None, "description": "Updated and current documents are to be submitted."}], finding_count=1, penalty=None)
    assert hot_err is None and hot_ok
    assert due_err is None and due_ok

    mn = _pilot("407d1544")
    questioned = (
        "When questioned, the staff member acknowledged not performing hand hygiene "
        "before or after resident care."
    )
    ombuds = (
        "The posting lacked contact information for the Office of Ombudsman for Long-Term Care "
        "and information for reporting suspected maltreatment."
    )
    assert _gate(mn, [{"tag": "0510", "description": questioned}], finding_count=1, d_tags=["0510"])[0] is None
    q_err = _gate(mn, [{"tag": "0510", "description": questioned}], finding_count=1, d_tags=["0510"])[1]
    assert q_err and "questioned" in q_err
    assert _gate(mn, [{"tag": "0550", "description": ombuds}], finding_count=1, d_tags=["0550"])[0] is None
    o_err = _gate(mn, [{"tag": "0550", "description": ombuds}], finding_count=1, d_tags=["0550"])[1]
    assert o_err and "ombudsman" in o_err
    fixed = [
        {"tag": "0480", "description": "The licensee failed to ensure food was prepared and served according to the Minnesota Food Code."},
        {"tag": "0510", "description": "The staff acknowledged not performing hand hygiene and stated he forgot."},
        {"tag": "0550", "description": "The licensee failed to post the required information related to the grievance procedure."},
    ]
    stored, stored_err = _gate(mn, fixed, finding_count=3, d_tags=["0480", "0510", "0550"])
    assert stored_err is None and stored
    assert "$500.00" in stored
    assert "ombudsman" not in stored.lower()

    oregon = _pilot("3e155a98")
    swapped = (
        "Residents had a financial agreement and rent responsibility form separate from the residency "
        "agreement that was not reviewed by the licensee for compliance with rules."
    )
    assert _gate(oregon, [{"tag": "V6219", "description": swapped}], finding_count=1)[0] is None
    swap_err = _gate(oregon, [{"tag": "V6219", "description": swapped}], finding_count=1)[1]
    assert swap_err and "licensee" in swap_err
    lla, lla_err = _gate(
        oregon,
        [{"tag": "V6219", "description": "This form was not reviewed by LLA."}],
        finding_count=1,
        penalty=None,
    )
    assert lla_err is None and lla and "LLA" in lla


def test_clean_pilot_drafts_still_pass() -> None:
    """Three drafts the hand check marked clean stay stored."""
    drafts = {
        "a9d6185e": "One staff member on the facility guardian roster was not associated with the facility and did not have a criminal record clearance or exemption approval on file. The staff member was hired as a minor, became eighteen years old, and has not obtained criminal record clearance. The administrator removed the staff member from the schedule until criminal record clearance is obtained.",
        "f62c9930": "Medication inventory revealed that dates of administration of medications could not be verified as no start date was documented and an accurate medication count could not be confirmed.",
        "060f49a8": "The licensee failed to ensure required annual dementia care training for a direct-care employee. The employee's training record lacked documentation of the required hours of dementia care training in the specified timeframe.",
    }
    for key, description in drafts.items():
        row = _pilot(key)
        tag = "01540" if key == "060f49a8" else None
        text, err = _gate(
            row,
            [{"tag": tag, "description": description}],
            finding_count=1,
            d_tags=[tag] if tag else None,
            penalty=None,
        )
        assert err is None and text, key


def test_extra_description_is_rejected() -> None:
    """c2add82e returned three descriptions for two deficiency rows."""
    row = _pilot("c2add82e")
    descriptions = [
        {"tag": None, "description": "The facility did not display a PUB475 poster in a visible area."},
        {"tag": None, "description": "One staff member worked at the facility without a background clearance."},
        {"tag": None, "description": "Two staff members were missing a health screening."},
    ]
    text, err = _gate(row, descriptions, finding_count=2, penalty=None)
    assert text is None
    assert err and "count" in err


def test_oregon_tags_and_minnesota_substantiation() -> None:
    """Oregon tags are accepted when no deficiency-table tags were passed. MN-SUBST is not a deficiency."""
    oregon = {
        "2ba83b45": [
            {"tag": "A1415", "description": "Some caregivers were scheduled to work together and none of them had Recordkeeping B."},
            {"tag": "A2525", "description": "The resident info sheet has DNR marked on it."},
            {"tag": "A3355", "description": "The backup operator needs to complete the EPP Certification of Training."},
        ],
        "5dc192c7": [
            {"tag": "C0242", "description": "The facility failed to provide a daily program of social and recreational activities."},
            {"tag": "C0252", "description": "The facility failed to ensure the move-in evaluation contained all required elements."},
        ],
        "fe96a34c": [
            {"tag": "A3110", "description": "Operator did not have an annual furnace inspection report."},
            {"tag": "A3250", "description": "Fire extinguishers on both levels of the home were last serviced in June."},
            {"tag": "A3355", "description": "EPP notification information sheet was missing two residents name's."},
        ],
    }
    for key, descriptions in oregon.items():
        row = _pilot(key)
        text, err = _gate(row, descriptions, penalty=None)
        assert err is None and text, (key, err)
        assert "tag not in D rows" not in (err or "")
        if row.get("inspection_type") == "Re-Licensure":
            assert "re-licensure" in text.lower()
    indexed = _pilot("2ba83b45")
    by_index = [
        {"tag": "1", "description": oregon["2ba83b45"][0]["description"]},
        {"tag": "2", "description": oregon["2ba83b45"][1]["description"]},
        {"tag": "3", "description": oregon["2ba83b45"][2]["description"]},
    ]
    text, err = _gate(indexed, by_index, penalty=None)
    assert err is None and text

    one = _pilot("f9d77b5c")
    text, err = _gate(
        one,
        [{"tag": "02360", "description": "The facility failed to ensure one of one resident was free from maltreatment."}],
        defs=one["defs"],
        penalty=None,
    )
    assert err is None and text
    assert "1 correction order" in text
    assert "2 correction" not in text
    assert "Maltreatment occurred." in text
    two = _pilot("0877ce83")
    text, err = _gate(
        two,
        [
            {"tag": "02310", "description": "The licensee failed to provide care and assisted living services according to an up-to-date service plan."},
            {"tag": "02360", "description": "The facility failed to ensure one of one resident was free from maltreatment."},
        ],
        defs=two["defs"],
        penalty=None,
    )
    assert err is None and text
    assert "2 correction orders" in text
    assert "3 correction" not in text


def test_rejection_retry_then_hold() -> None:
    """A gate failure is sent back once. A row that still fails is held and nothing is stored."""
    import io
    from contextlib import redirect_stdout

    source = (
        "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
        "0510 not met as evidenced by the licensee failed to post the hours."
    )

    class _Once:
        def __init__(self) -> None:
            self.calls: list[dict] = []

        def create(self, **kw):
            self.calls.append(kw)
            if len(self.calls) == 1:
                text = '[{"tag": "0510", "description": "The licensee failed to post 3 hours."}]'
            else:
                text = '[{"tag": "0510", "description": "The licensee failed to post the hours."}]'
            return types.SimpleNamespace(content=[types.SimpleNamespace(text=text)])

    good = _Once()
    out = si.summarize(
        types.SimpleNamespace(messages=good), "survey", False, None, source,
        state_code="MN", deficiency_count=1, d_tags=["0510"], record_date="2024-03-10",
    )
    assert out and "post the hours" in out
    assert len(good.calls) == 2
    assert "digit or dollar sign" in good.calls[1]["messages"][0]["content"]

    class _Always:
        def __init__(self) -> None:
            self.calls: list[dict] = []

        def create(self, **kw):
            self.calls.append(kw)
            text = '[{"tag": "0510", "description": "The licensee failed to post 3 hours."}]'
            return types.SimpleNamespace(content=[types.SimpleNamespace(text=text)])

    bad = _Always()
    buf = io.StringIO()
    with redirect_stdout(buf):
        held = si.summarize(
            types.SimpleNamespace(messages=bad), "survey", False, None, source,
            state_code="MN", deficiency_count=1, d_tags=["0510"], record_date="2024-03-10",
        )
    assert held is None
    assert len(bad.calls) == 3
    assert "held:" in buf.getvalue()
    assert "digit or dollar sign" in bad.calls[2]["messages"][0]["content"]


def test_forced_chunk_merge_on_long_row() -> None:
    """A long real report split into three or more chunks loses no text and keeps each tag once."""
    row = _pilot("6838c917")
    narrative = row["narrative"]
    codes = [item["code"] for item in row["defs"]]
    assert len(narrative) > 50_000
    assert len(codes) == 7
    sent: list[dict] = []

    def extract(chunk: str) -> str:
        flat = " ".join(chunk.split())
        items = []
        for tag in codes:
            if not re.search(r"\b" + tag[0] + r"\s?" + tag[1:] + r"\b", flat):
                continue
            found = _FAIL.search(flat)
            if found:
                items.append({"tag": tag, "kind": "finding", "quote": found.group(0)})
        return json.dumps(items)

    original = si._narrative_budget
    si._narrative_budget = lambda system, overhead: 8_000
    try:
        out = si.summarize(
            _extracting_client(sent, extract), row["inspection_type"], False, None, narrative,
            state_code="MN", deficiency_count=len(codes), record_date=row["inspection_date"],
        )
    finally:
        si._narrative_budget = original
    extract_calls = [call for call in sent if call["system"] == si.EXTRACT_SYSTEM_PROMPT]
    summary_calls = [call for call in sent if call["system"] != si.EXTRACT_SYSTEM_PROMPT]
    assert len(extract_calls) >= 3
    delivered = []
    for number, call in enumerate(extract_calls, 1):
        user = call["messages"][0]["content"]
        start = user.index("Text:\n") + len("Text:\n")
        end = user.index(f"\n\nEnd of part {number}.")
        delivered.append(user[start:end])
    assert "".join(delivered) == narrative
    assert out
    assert out.count(_SAFE_DESCRIPTION) == len(codes)
    assert "7 correction orders" in out
    final_user = summary_calls[0]["messages"][0]["content"]
    tags = [line.split(":", 1)[0][len("- tag "):] for line in final_user.splitlines() if line.startswith("- tag ")]
    assert tags == list(dict.fromkeys(tags))
    assert sorted(tags) == sorted(codes)


def test_zero_citation_line_is_code_only() -> None:
    """A published visit with no deficiencies gets one fixed line. Texas and missing text get nothing."""
    called: list[dict] = []

    class _Messages:
        def create(self, **kw):
            called.append(kw)
            return types.SimpleNamespace(content=[types.SimpleNamespace(text=si._NO_FINDINGS)])

    client = types.SimpleNamespace(messages=_Messages())
    reports = {
        "CA": "On March 10, 2024, the California Department of Social Services completed a full survey. No deficiencies were cited during this visit at the home.",
        "MN": "On March 10, 2024, the Minnesota Department of Health completed a full survey. No deficiencies were cited during this visit at the home.",
        "OR": "On March 10, 2024, the Oregon Department of Human Services completed a full survey. No deficiencies were cited during this visit at the home.",
    }
    for state, narrative in reports.items():
        out = si.summarize(
            client, "survey", False, None, narrative,
            state_code=state, deficiency_count=0, published=True, record_date="2024-03-10",
        )
        assert out and "No deficiencies were cited at this visit." in out
        assert "0 citations" not in out
        assert "clean record" not in out.lower()
    assert called == []
    before = len(called)
    tx = si.summarize(
        client, "survey", False, None, reports["CA"],
        state_code="TX", deficiency_count=0, published=True, record_date="2024-03-10",
    )
    missing = si.summarize(client, "survey", False, None, "", state_code="CA", deficiency_count=0, published=True)
    stub = si.summarize(
        client, "survey", False, None, "page not found " * 12,
        state_code="CA", deficiency_count=0, published=True,
    )
    cited = (
        "On March 10, 2024, the California Department of Social Services completed a full survey. "
        "The licensee failed to post the hours. No deficiencies were cited."
    )
    not_clear = si.summarize(
        client, "survey", False, None, cited,
        state_code="CA", deficiency_count=0, published=True, record_date="2024-03-10",
    )
    assert tx is None and missing is None and stub is None
    assert not_clear is None
    unpublished = si.summarize(
        client, "survey", False, None, reports["CA"],
        state_code="CA", deficiency_count=0, published=False, record_date="2024-03-10",
    )
    assert unpublished is None
    assert len(called) == before + 1  # unpublished, Texas, and stubs never reach the model
    assert all(
        "No deficiencies were cited at this visit." not in (item or "")
        for item in (tx, missing, stub, not_clear, unpublished)
    )


def _v9(prefix: str) -> dict:
    if not hasattr(_v9, "rows"):
        _v9.rows = json.loads((ROOT / "scripts" / "testdata" / "pilot_rows_v9.json").read_text())
    return next(row for row in _v9.rows if row["id"].startswith(prefix))


def _v9_raw(prefix: str, index: int = 0) -> str:
    if not hasattr(_v9_raw, "drafts"):
        _v9_raw.drafts = json.loads((ROOT / "scripts" / "testdata" / "pilot_drafts_v9.json").read_text())
    return _v9_raw.drafts[prefix][index]


def _gate_v9(prefix: str, index: int = 0):
    """The real draft, with the deficiency rows main() now passes in."""
    row = _v9(prefix)
    return asm.assemble_summary(
        state_code=row["state"],
        source=row["narrative"],
        descriptions=asm.parse_descriptions(_v9_raw(prefix, index)),
        d_tags=None,
        finding_count=row["tdc"],
        penalty=None,
        inspection_date=row.get("inspection_date"),
        inspection_type=row.get("inspection_type"),
        defs=row.get("defs"),
        facility=row.get("facility"),
    )


def test_v10_false_rejections_now_pass() -> None:
    """The six drafts the v9 gate rejected for shape, not for a false fact, are stored.

    81ab14f4's passing draft is the second one: "determined" and the source's
    "determination" are the same word. The first draft still says "two", and that
    count is not in the finding.
    """
    for prefix in ("83ab8c41", "68459116", "25c72326", "c3a8bb6e", "08a32406"):
        text, err = _gate_v9(prefix)
        assert err is None and text, (prefix, err)
    text, err = _gate_v9("81ab14f4", 1)
    assert err is None and text, err
    assert "determined" in text.lower()
    early, early_err = _gate_v9("81ab14f4", 0)
    assert early is None and early_err and "two" in early_err


def test_v10_shape_rules_still_reject_a_real_miss() -> None:
    """A different number, a cite from another visit, a name, or a digit still fails."""
    wrong_number, wrong_err = asm.assemble_summary(
        state_code="MN",
        source="0800 not met as evidenced by the licensee failed to post the hours.",
        descriptions=[{"tag": "0810", "description": "The licensee failed to post the hours."}],
        d_tags=["0800"],
        finding_count=1,
        penalty=None,
    )
    assert wrong_number is None and wrong_err

    cited = _v9("68459116")
    foreign, foreign_err = asm.assemble_summary(
        state_code="CA",
        source=cited["narrative"],
        descriptions=[{"tag": "87411(a)", "description": "The licensee failed to offer a refund."}],
        d_tags=None,
        finding_count=1,
        penalty=None,
        defs=cited["defs"],
        facility=cited.get("facility"),
    )
    assert foreign is None and foreign_err and "cite" in foreign_err

    named, named_err = asm.assemble_summary(
        state_code="CA",
        source=cited["narrative"],
        descriptions=[{"tag": None, "description": "Grace Donato reviewed the admission agreement."}],
        d_tags=None,
        finding_count=1,
        penalty=None,
        defs=cited["defs"],
        facility=cited.get("facility"),
    )
    assert named is None and named_err and "Grace" in named_err

    training = _v9("08a32406")
    patio = asm.tag_span(training["narrative"], "V6313", ["V5759", "V6313"])
    course = asm.tag_span(training["narrative"], "V5759", ["V5759", "V6313"])
    assert patio and "LGBTQIA2S+" not in patio
    assert asm.digit_problem("The back patio needs LGBTQIA2S+ training.", patio)
    assert asm.digit_problem("The provider completed LGBTQIA2S+ training.", course) is None
    assert asm.digit_problem(
        "The licensee failed to care for 2 residents.",
        "The licensee failed to care for 2 residents.",
    )
    assert asm.digit_problem("A fine of $500 was listed.", course)


def test_v10_zero_line_uses_the_body_not_the_form_header() -> None:
    """1f13c4d3 is a complaint. The only 'SURVEY' is the form header, so it is not the visit."""
    row = _v9("1f13c4d3")
    old = "The Minnesota Department of Health completed a SURVEY. No deficiencies were cited at this visit."
    assert "survey" in old.lower()
    assert asm.visit_type_as_written("DATE SURVEY AND PLAN OF CORRECTION") is None
    assert asm.visit_type_as_written(row["narrative"], "complaint") == "complaint investigation"
    out = si.summarize(
        None,
        row["inspection_type"],
        True,
        None,
        row["narrative"],
        state_code="MN",
        deficiency_count=0,
        published=True,
        record_date=str(row["inspection_date"]),
    )
    assert out and "survey" not in out.lower()
    assert "complaint investigation" in out.lower()
    assert "No deficiencies were cited at this visit." in out
    assert "0 citations" not in out and "clean record" not in out.lower()
    # The old line names a visit the body does not name.
    assert out != old


def test_v10_dry_run_is_the_default_and_defs_are_passed() -> None:
    """Nothing is written unless --write is set. The gate receives the deficiency rows."""
    writes: list[str] = []
    seen: dict = {}

    class _Cursor:
        def __init__(self):
            self.sql = ""
            self.rowcount = 1

        def execute(self, sql, params=None):
            self.sql = sql
            if "UPDATE inspections" in sql:
                writes.append(sql)

        def fetchall(self):
            if "immediate_jeopardy" in self.sql:
                return [(
                    "id-1", "0800", "Type B", False, "the rule",
                    "the licensee failed to post the hours of operation.", None,
                )]
            return [(
                "id-1", "survey", False, None,
                "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
                "0800 not met as evidenced by the licensee failed to post the hours of operation.",
                "Home", "MN", False, 1, "2024-03-10", True,
            )]

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    class _Conn:
        def cursor(self):
            return _Cursor()

        def commit(self):
            return None

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    def connect(_url):
        return _Conn()

    def summarize_fn(*args, **kwargs):
        seen["defs"] = kwargs.get("defs")
        return "The licensee failed to post the hours."

    saved = si.DATABASE_URL
    si.DATABASE_URL = "postgres://example"
    try:
        for argv in ([], ["--dry-run"], ["--write", "--dry-run"]):
            writes.clear()
            si.main(argv, connect=connect, summarize_fn=summarize_fn)
            assert writes == [], argv
        writes.clear()
        seen.clear()
        si.main(["--write"], connect=connect, summarize_fn=summarize_fn)
        assert len(writes) == 1
        assert seen["defs"][0]["code"] == "0800"
        assert seen["defs"][0]["class"] == "Type B"
        assert seen["defs"][0]["ij"] is False
    finally:
        si.DATABASE_URL = saved


def test_v10_many_findings_are_one_call_each() -> None:
    """da8830a7 has 45 findings. Each call sees that finding's narrative, and no tag is dropped.

    The cutoff is 20 because a 16-finding report already survives the chunk merge.
    """
    assert si.PER_FINDING_LIMIT == 20
    row = _v9("da8830a7")
    assert len(row["defs"]) == 45
    calls: list[dict] = []

    class _Messages:
        def create(self, **kwargs):
            calls.append(kwargs)
            user = kwargs["messages"][0]["content"]
            if "the licensee failed to" in user.lower():
                sentence = "The licensee failed to."
            else:
                sentence = "The facility failed to."
            return types.SimpleNamespace(content=[types.SimpleNamespace(
                text=json.dumps([{"tag": None, "description": sentence}])
            )])

    client = types.SimpleNamespace(messages=_Messages())
    out = si.summarize(
        client,
        row["inspection_type"],
        bool(row["is_complaint"]),
        row.get("outcome"),
        row["narrative"],
        state_code=row["state"],
        deficiency_count=row["tdc"],
        record_date=str(row["inspection_date"]),
        published=bool(row["publishable"]),
        defs=row["defs"],
        facility=row.get("facility"),
    )
    assert out, "45 findings should store"
    assert len(calls) == 45
    assert "45 correction orders" in out
    assert out.count("failed to.") == 45
    users = [call["messages"][0]["content"] for call in calls]
    assert not any("Report part" in user for user in users)
    for item in row["defs"]:
        narrative = item["inspector_narrative"]
        matched = [user for user in users if f"Tag: {item['code']}" in user]
        assert len(matched) == 1, item["code"]
        assert narrative in matched[0]
        assert len(narrative) > 100


def test_header_omits_a_date_that_disagrees() -> None:
    """The report date is used only when it is the inspection row's date."""
    source = "On August 7, 2024, the Minnesota Department of Health completed a standard survey."
    omitted = asm.build_header(
        state_code="MN", source=source, finding_count=1, penalty=None, inspection_date="2024-09-30",
    )
    assert "August" not in omitted
    assert "standard survey" in omitted
    kept = asm.build_header(
        state_code="MN", source=source, finding_count=1, penalty=None, inspection_date="2024-08-07",
    )
    assert "August 7, 2024" in kept


if __name__ == "__main__":
    for _n, _f in sorted(globals().items()):
        if _n.startswith("test_") and callable(_f):
            _f()
            print("ok", _n)
