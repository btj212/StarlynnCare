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
                    text='[{"tag": null, "description": "The licensee failed to arrive on time."}]'
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
                    text='[{"tag": null, "description": "A routine inspection found a lighting problem in the hallway."}]'
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
_SAFE_DESCRIPTION = "The licensee failed to meet this requirement."
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
    source = "On March 10, 2024, the Minnesota Department of Health completed a full survey."
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


if __name__ == "__main__":
    for _n, _f in sorted(globals().items()):
        if _n.startswith("test_") and callable(_f):
            _f()
            print("ok", _n)
