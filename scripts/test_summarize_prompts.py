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
    # The stored summary is capped at about six sentences. The header keeps the true total.
    assert out.count(_SAFE_DESCRIPTION) == 3
    assert "The report lists 13 further correction orders." in out
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

    def run(
        description: str,
        tags: list[dict] | None = None,
        count: int = 1,
        d_tags: list[str] | None = None,
        notes: list[str] | None = None,
    ):
        payload = tags if tags is not None else [{"tag": "0510", "description": description}]
        text, err = asm.assemble_summary(
            state_code="MN",
            source=source,
            descriptions=payload,
            d_tags=["0510"] if d_tags is None else d_tags,
            finding_count=count,
            penalty=None,
            notes=notes,
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
    # An extra tag that matches no row is dropped. The matching sentence stores.
    extra_notes: list[str] = []
    extra, extra_err = run(
        "",
        tags=[
            {"tag": "0510", "description": "The licensee failed to post the hours."},
            {"tag": "0999", "description": "The licensee failed to keep a log."},
        ],
        count=1,
        notes=extra_notes,
    )
    assert extra_err is None and extra and "post the hours" in extra
    assert "keep a log" not in extra
    assert any("dropped extra" in note for note in extra_notes)
    missing, missing_err = run("", tags=[], count=1)
    assert missing is None and missing_err
    # A second sentence for the same row is the extra. The first one stores.
    dup_notes: list[str] = []
    dup, dup_err = run(
        "",
        tags=[
            {"tag": "0510", "description": "The licensee failed to post the hours."},
            {"tag": "0510", "description": "The licensee failed to post the hours again."},
        ],
        count=1,
        notes=dup_notes,
    )
    assert dup_err is None and dup and "post the hours." in dup
    assert "again" not in dup
    assert any("dropped extra" in note for note in dup_notes)
    del base


def _json_client(payload: str) -> types.SimpleNamespace:
    class _Messages:
        def create(self, **kw):
            return types.SimpleNamespace(content=[types.SimpleNamespace(text=payload)])

    return types.SimpleNamespace(messages=_Messages())


def test_mocked_model_bad_description_stores_nothing() -> None:
    """A wrong count falls back to the report. An extra tag is dropped. An empty reply stores nothing."""
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
    digit = run(json.dumps([{"tag": "0510", "description": "The licensee failed to post 3 hours."}]))
    assert digit and "post the hours" in digit and "3 hours" not in digit
    extra = run(json.dumps([
        {"tag": "0510", "description": "The licensee failed to post the hours."},
        {"tag": "0999", "description": "The licensee failed to keep a log."},
    ]))
    assert extra and "post the hours" in extra and "keep a log" not in extra
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
        notes=kwargs.pop("notes", None),
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
    # Missing punctuation only warns. The row still holds because "staff files"
    # widens "one out of six".
    assert err and "one out of six" in err
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
    """A factual hold is sent back once. If the retry still fails, the report's sentence is stored."""
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
    assert held and "post the hours" in held and "3 hours" not in held
    assert len(bad.calls) == 2
    assert "fallback:" in buf.getvalue()
    assert "digit or dollar sign" in bad.calls[1]["messages"][0]["content"]


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
    assert "7 correction orders" in out
    assert out.count(_SAFE_DESCRIPTION) == 3
    assert "The report lists 4 further correction orders." in out
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
                "Home", "MN", False, 1, "2024-03-10", True, None,
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

    The report wording is a complaint investigation and the row is not a complaint, so nothing
    is stored. The cutoff is 20 because a 16-finding report already survives the chunk merge.
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
    # The report's own wording is a complaint investigation, and the row is not a complaint.
    assert out is None
    assert len(calls) == 45
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


def _v10(prefix: str) -> dict:
    if not hasattr(_v10, "rows"):
        _v10.rows = json.loads((ROOT / "scripts" / "testdata" / "pilot_rows_v10.json").read_text())
    return next(row for row in _v10.rows if row["id"].startswith(prefix))


def _v10_descriptions(prefix: str, index: int = 0) -> list[dict]:
    if not hasattr(_v10_descriptions, "drafts"):
        _v10_descriptions.drafts = json.loads(
            (ROOT / "scripts" / "testdata" / "pilot_drafts_v10.json").read_text()
        )
    parsed = asm.parse_descriptions(_v10_descriptions.drafts[prefix][index])
    assert parsed, prefix
    return parsed


def test_v11_false_rejections_store_and_factual_misses_hold() -> None:
    """A spelled number, a possessive, an OAR cite, and an extra tag now store.

    A number that is not in the finding still holds. cf1559fe's second draft
    still holds because it says "One" where finding 0660 says two of two.
    Three untagged descriptions for two rows (c2add82e) still hold.
    """
    from _summary_ground import stem

    assert stem("employee's") == stem("employees") == stem("employee")

    hot = _v10("5513a2cb")
    notes: list[str] = []
    text, err = _gate(hot, _v10_descriptions("5513a2cb", 0), defs=hot["defs"], notes=notes)
    assert err is None and text and "one hundred twenty" in text and "Fahrenheit" in text
    missed, missed_err = asm.assemble_summary(
        state_code="CA",
        source="Multiple taps observed to provide water above 98F.",
        descriptions=[{"tag": None, "description": "Multiple taps observed to provide water above one hundred twenty degrees Fahrenheit."}],
        d_tags=None,
        finding_count=1,
        penalty=None,
    )
    assert missed is None and missed_err and "one hundred twenty" in missed_err

    staff = _v10("cf1559fe")
    draft0, draft0_err = _gate(staff, _v10_descriptions("cf1559fe", 0), defs=staff["defs"])
    assert draft0 is None and draft0_err
    second = _v10_descriptions("cf1559fe", 1)
    one_row = [item for item in staff["defs"] if str(item.get("code")) == "0650"]
    kept, kept_err = _gate(
        staff, [second[0]], defs=one_row, finding_count=1, d_tags=["0650"],
    )
    assert kept_err is None and kept and "employee" in kept
    whole, whole_err = _gate(staff, second, defs=staff["defs"])
    assert whole is None and whole_err and "One" in whole_err

    owner = _v10("a5623f2a")
    fired, fired_err = _gate(owner, _v10_descriptions("a5623f2a", 0), defs=owner["defs"])
    assert fired_err is None and fired and "fire drills" in fired

    home = _v10("c1a62fce")
    first, first_err = _gate(home, _v10_descriptions("c1a62fce", 0), penalty=None)
    assert first_err is None and first and "First Aid" in first
    assert "dinner at evening" not in first and "at morning" not in first
    clock, clock_err = asm.assemble_summary(
        state_code="OR",
        source="Dinner was listed as 5:00 pm and Breakfast at 8:00 am.",
        descriptions=[{"tag": None, "description": "Dinner was listed at five o'clock and breakfast at eight o'clock."}],
        d_tags=None,
        finding_count=1,
        penalty=None,
    )
    assert clock_err is None and clock and "five o'clock" in clock

    plans = _v10("e08fd13f")
    extra_notes: list[str] = []
    kept_plans, plans_err = _gate(
        plans, _v10_descriptions("e08fd13f", 0), penalty=None, notes=extra_notes,
    )
    assert plans_err is None and kept_plans
    assert "has not been rewritten" not in kept_plans
    assert any("dropped extra" in note for note in extra_notes)

    kitchen = _v10("4ffcda2c")
    visit, visit_err = _gate(kitchen, _v10_descriptions("4ffcda2c", 0), defs=kitchen["defs"])
    assert visit_err is None and visit
    assert "full survey" not in visit.lower()
    assert "at this visit" in visit

    memory = _v10("aa7d1391")
    rule, rule_err = _gate(memory, _v10_descriptions("aa7d1391", 0), penalty=None)
    assert rule is None and rule_err and "licensee" in rule_err


def test_v11_retry_falls_back_per_finding_and_warnings_are_logged() -> None:
    """One bad finding is retried once, then copied from the report. Warnings are JSONL."""
    import tempfile

    home = _v10("c1a62fce")
    garbled = _v10_descriptions("c1a62fce", 2)
    garbled[1] = {
        "tag": garbled[1]["tag"],
        "description": "Meal times were ninety hours apart, with dinner at evening and breakfast at morning.",
    }

    class _Worse:
        def __init__(self) -> None:
            self.calls = 0

        def create(self, **kw):
            self.calls += 1
            if self.calls == 1:
                text = json.dumps([{
                    "tag": "V6214",
                    "description": "Meal times were 3 hours apart.",
                }])
            else:
                text = json.dumps(garbled)
            return types.SimpleNamespace(content=[types.SimpleNamespace(text=text)])

    client = _Worse()
    stored = si.summarize(
        types.SimpleNamespace(messages=client),
        home["inspection_type"],
        False,
        None,
        home["narrative"],
        state_code=home["state"],
        deficiency_count=home["tdc"],
        record_date=str(home["inspection_date"]),
        facility=home.get("facility"),
    )
    # The retry still fails, and the regulator sentence for this report is the
    # severity block, so the row is held instead of storing that dump.
    assert client.calls == 2
    assert stored is None

    long_row = _v10("b70b2853")
    calls: list[dict] = []

    class _Each:
        def create(self, **kw):
            calls.append(kw)
            user = kw["messages"][0]["content"]
            if "Tag: 01060" in user:
                sentence = "The reading was one forty-four G point fifty-four."
            else:
                sentence = "The observation was recorded."
            return types.SimpleNamespace(content=[types.SimpleNamespace(
                text=json.dumps([{"tag": None, "description": sentence}])
            )])

    out = si.summarize(
        types.SimpleNamespace(messages=_Each()),
        long_row["inspection_type"],
        bool(long_row["is_complaint"]),
        long_row.get("outcome"),
        long_row["narrative"],
        state_code=long_row["state"],
        deficiency_count=long_row["tdc"],
        record_date=str(long_row["inspection_date"]),
        defs=long_row["defs"],
        facility=long_row.get("facility"),
    )
    assert out and "forty-four" not in out.lower()
    assert "25 correction orders" in out
    assert len(si._sentences(out)) <= 6
    closing = re.search(r"The report lists (\d+) further correction orders\.", out)
    described = out.count("The observation was recorded.")
    assert closing and int(closing.group(1)) == 25 - described
    assert len(calls) == 26

    source = (
        "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
        "0510 not met as evidenced by the licensee failed to post the hours."
    )
    with tempfile.TemporaryDirectory() as tmp:
        path = f"{tmp}/warnings.jsonl"
        summary = si.summarize(
            _json_client(json.dumps([{
                "tag": "0510",
                "description": "The licensee failed to post the hours",
            }])),
            "survey",
            False,
            None,
            source,
            state_code="MN",
            deficiency_count=1,
            d_tags=["0510"],
            record_date="2024-03-10",
            inspection_id="row-1",
            warning_log=path,
        )
        assert summary and "post the hours" in summary
        line = json.loads(open(path).read().strip().splitlines()[-1])
        assert line["id"] == "row-1"
        assert any("punctuation" in warning for warning in line["warnings"])


def _last_warning(path: str) -> dict:
    return json.loads(open(path).read().strip().splitlines()[-1])


def test_v12_rule_text_dumps_and_oregon_counts() -> None:
    """A rule-text fallback, a tag dump, and a mismatched Oregon count hold the row.

    An Oregon report whose only extra tag is the C0000 placeholder keeps the database count.
    """
    import tempfile

    rule = "(a) Disinfectants, cleaning solutions and poisons shall be stored in a locked compartment."
    narrative = "Licensing Program Analyst conducted the annual inspection at the home. " + rule
    with tempfile.TemporaryDirectory() as tmp:
        path = f"{tmp}/warnings.jsonl"
        out = si.summarize(
            _json_client(json.dumps([{"tag": None, "description": rule}])),
            "inspection",
            False,
            None,
            narrative,
            state_code="CA",
            deficiency_count=1,
            defs=[{
                "code": None,
                "description": rule,
                "inspector_narrative": narrative,
            }],
            record_date="2024-03-10",
            warning_log=path,
            inspection_id="ca-rule",
        )
        assert out is None
        assert "rule text" in _last_warning(path)["warnings"][0]

        fire = "87202 FIRE CLEARANCE. All facilities shall maintain a fire clearance approved by the city."
        fire_narrative = "Licensing Program Analyst conducted the annual inspection at the home. " + fire
        out = si.summarize(
            _json_client(json.dumps([{"tag": None, "description": fire}])),
            "inspection",
            False,
            None,
            fire_narrative,
            state_code="CA",
            deficiency_count=1,
            defs=[{
                "code": None,
                "description": fire,
                "inspector_narrative": fire_narrative,
            }],
            record_date="2024-03-10",
            warning_log=path,
            inspection_id="ca-fire",
        )
        assert out is None
        assert "rule text" in _last_warning(path)["warnings"][0]

    oregon_rule = (
        "Residents have the right to refuse treatment. "
        "The facility must provide meals each day at the home."
    )
    held = si.summarize(
        _json_client(json.dumps([{"tag": None, "description": "Residents have the right to refuse treatment."}])),
        "State Licensure",
        False,
        None,
        oregon_rule,
        state_code="OR",
        deficiency_count=1,
        record_date="2024-03-10",
    )
    assert held is None

    source = (
        "Inspection type(s): State Licensure. Deficiencies cited: 3. "
        "C0000: Initial Comments. "
        "C0240: The facility failed to keep the kitchen clean. "
        "C0455: The facility failed to record the meal."
    )
    good = [
        {"tag": "C0240", "description": "The facility failed to keep the kitchen clean."},
        {"tag": "C0455", "description": "The facility failed to record the meal."},
    ]
    stored = si.summarize(
        _json_client(json.dumps(good)),
        "State Licensure",
        False,
        None,
        source,
        state_code="OR",
        deficiency_count=2,
        record_date="2024-03-10",
    )
    assert stored and "2 violations" in stored and "3 violations" not in stored

    called = {"n": 0}

    class _Boom:
        def create(self, **kw):
            called["n"] += 1
            raise AssertionError("model should not be called when the counts disagree")

    with tempfile.TemporaryDirectory() as tmp:
        path = f"{tmp}/warnings.jsonl"
        missed = si.summarize(
            types.SimpleNamespace(messages=_Boom()),
            "State Licensure",
            False,
            None,
            source,
            state_code="OR",
            deficiency_count=1,
            record_date="2024-03-10",
            warning_log=path,
            inspection_id="or-count",
        )
        assert missed is None and called["n"] == 0
        assert _last_warning(path)["warnings"][0] == (
            "held: source tag count 2 does not match the record count 1"
        )

        dump = "Severity Level: 3 Scope: L3 Widespread Visits: 1."
        dump_narrative = "Licensing Program Analyst conducted the annual inspection at the home. " + dump
        dumped = si.summarize(
            _json_client(json.dumps([{"tag": None, "description": dump}])),
            "inspection",
            False,
            None,
            dump_narrative,
            state_code="CA",
            deficiency_count=1,
            defs=[{
                "code": None,
                "description": dump,
                "inspector_narrative": dump_narrative,
            }],
            record_date="2024-03-10",
            warning_log=path,
            inspection_id="dump",
        )
        assert dumped is None
        assert "tag or metadata dump" in _last_warning(path)["warnings"][0]


def test_v12_visit_penalty_length_and_minnesota_fallback() -> None:
    """A contradictory visit or a fine the database does not have holds the row.

    Twelve findings stay inside about six sentences, the header still says 12, and the
    closing sentence states the exact remainder. A Minnesota 'failed to' fallback still stores.
    The zero-citation line is unchanged.
    """
    import tempfile

    complaint = (
        "On March 10, 2024, the Minnesota Department of Health completed a complaint investigation. "
        "0510 not met as evidenced by the licensee failed to post the hours."
    )
    with tempfile.TemporaryDirectory() as tmp:
        path = f"{tmp}/warnings.jsonl"
        held = si.summarize(
            _json_client(json.dumps([{
                "tag": "0510",
                "description": "The licensee failed to post the hours.",
            }])),
            "standard",
            False,
            None,
            complaint,
            state_code="MN",
            deficiency_count=1,
            d_tags=["0510"],
            record_date="2024-03-10",
            warning_log=path,
            inspection_id="visit",
        )
        assert held is None
        assert "complaint investigation" in _last_warning(path)["warnings"][0]

        fine = (
            "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
            "The total amount you are assessed is $6,000. "
            "0510 not met as evidenced by the licensee failed to post the hours."
        )
        fined = si.summarize(
            _json_client(json.dumps([{
                "tag": "0510",
                "description": "The licensee failed to post the hours.",
            }])),
            "survey",
            False,
            None,
            fine,
            state_code="MN",
            deficiency_count=1,
            d_tags=["0510"],
            record_date="2024-03-10",
            db_penalty=None,
            warning_log=path,
            inspection_id="fine",
        )
        assert fined is None
        assert "dollar penalty" in _last_warning(path)["warnings"][0]

    codes = [f"{510 + i:04d}" for i in range(12)]
    narrative = (
        "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
        + " ".join(
            f"{code} not met as evidenced by the licensee failed to post the hours."
            for code in codes
        )
    )
    described = [
        {"tag": code, "description": "The licensee failed to post the hours."}
        for code in codes
    ]
    summary = si.summarize(
        _json_client(json.dumps(described)),
        "survey",
        False,
        None,
        narrative,
        state_code="MN",
        deficiency_count=12,
        d_tags=codes,
        record_date="2024-03-10",
    )
    assert summary and "12 correction orders" in summary
    assert len(si._sentences(summary)) <= 6
    kept = summary.count("The licensee failed to post the hours.")
    match = re.search(r"The report lists (\d+) further correction orders\.", summary)
    assert match and int(match.group(1)) + kept == 12

    fallback = si.summarize(
        _json_client(json.dumps([{
            "tag": "0510",
            "description": "The licensee failed to post 9 hours.",
        }])),
        "survey",
        False,
        None,
        (
            "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
            "0510 not met as evidenced by the licensee failed to post the hours."
        ),
        state_code="MN",
        deficiency_count=1,
        d_tags=["0510"],
        record_date="2024-03-10",
    )
    assert fallback and "failed to" in fallback and "9" not in fallback
    assert "further finding" not in fallback

    zero_narrative = (
        "On March 10, 2024, the California Department of Social Services completed a full survey. "
        "No deficiencies were cited during this visit at the home."
    )
    zero = si.summarize(
        _json_client("[]"),
        "survey",
        False,
        None,
        zero_narrative,
        state_code="CA",
        deficiency_count=0,
        published=True,
        record_date="2024-03-10",
    )
    unchanged = si._zero_citation_summary(
        zero_narrative,
        state_code="CA",
        inspection_type="survey",
        inspection_date="2024-03-10",
    )
    assert zero == unchanged
    assert zero and "No deficiencies were cited at this visit." in zero
    assert "further finding" not in zero


def test_v12_1_remainder_is_findings_not_sentences() -> None:
    """The closing number counts findings left out, using the header's noun.

    One short violation gets no closing line. A three-sentence finding that does
    not fit is one omitted finding. A follow-up phrase on a standard row, and an
    appended 'must correct' that the finding does not say, each hold the row.
    """
    import tempfile

    one = si.summarize(
        _json_client(json.dumps([{
            "tag": None,
            "description": "The licensee failed to post the hours.",
        }])),
        "survey",
        False,
        None,
        (
            "On March 10, 2024, the Oregon Department of Human Services completed a full survey. "
            "The licensee failed to post the hours."
        ),
        state_code="OR",
        deficiency_count=1,
        record_date="2024-03-10",
    )
    assert one and "1 violation" in one
    assert "further" not in one
    assert "5 further" not in one

    codes = [f"{510 + i:04d}" for i in range(23)]
    narrative = " ".join(
        f"{code} not met as evidenced by the licensee failed to post the hours."
        for code in codes
    )
    described = [
        {"tag": code, "description": "The licensee failed to post the hours."}
        for code in codes
    ]
    many = si.summarize(
        _json_client(json.dumps(described)),
        "standard",
        False,
        None,
        narrative,
        state_code="MN",
        deficiency_count=23,
        d_tags=codes,
        record_date="2024-03-10",
    )
    assert many and "23 correction orders" in many
    kept = many.count("The licensee failed to post the hours.")
    match = re.search(r"The report lists (\d+) further correction orders\.", many)
    assert kept == 4 and match and int(match.group(1)) == 19

    long_desc = (
        "The licensee failed to post the hours. "
        "The licensee failed to record the temperature. "
        "The licensee failed to update the log."
    )
    quad_codes = ["0510", "0520", "0530", "0540"]
    quad_narrative = " ".join(
        f"{code} not met as evidenced by the licensee failed to post the hours."
        for code in quad_codes[:3]
    ) + (
        " 0540 not met as evidenced by the licensee failed to post the hours. "
        "The licensee failed to record the temperature. "
        "The licensee failed to update the log."
    )
    quad = [
        {"tag": code, "description": "The licensee failed to post the hours."}
        for code in quad_codes[:3]
    ] + [{"tag": "0540", "description": long_desc}]
    mixed = si.summarize(
        _json_client(json.dumps(quad)),
        "standard",
        False,
        None,
        quad_narrative,
        state_code="MN",
        deficiency_count=4,
        d_tags=quad_codes,
        record_date="2024-03-10",
    )
    assert mixed and "4 correction orders" in mixed
    assert long_desc not in mixed
    assert "record the temperature" not in mixed
    short_kept = mixed.count("The licensee failed to post the hours.")
    dropped = re.search(r"The report lists (\d+) further correction order\.", mixed)
    assert short_kept == 3 and dropped and int(dropped.group(1)) == 1

    follow = (
        "On March 10, 2024, the Minnesota Department of Health completed a follow-up survey. "
        "0510 not met as evidenced by the licensee failed to post the hours."
    )
    with tempfile.TemporaryDirectory() as tmp:
        path = f"{tmp}/warnings.jsonl"
        held = si.summarize(
            _json_client(json.dumps([{
                "tag": "0510",
                "description": "The licensee failed to post the hours.",
            }])),
            "standard",
            False,
            None,
            follow,
            state_code="MN",
            deficiency_count=1,
            d_tags=["0510"],
            record_date="2024-03-10",
            warning_log=path,
            inspection_id="follow",
        )
        assert held is None
        assert "follow-up" in _last_warning(path)["warnings"][0]

        directed = si.summarize(
            _json_client(json.dumps([{
                "tag": "0510",
                "description": "The licensee failed to post the hours. The facility must correct this.",
            }])),
            "survey",
            False,
            None,
            (
                "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
                "0510 not met as evidenced by the licensee failed to post the hours."
            ),
            state_code="MN",
            deficiency_count=1,
            d_tags=["0510"],
            record_date="2024-03-10",
            warning_log=path,
            inspection_id="directive",
        )
        assert directed is None
        assert "unsourced directive" in _last_warning(path)["warnings"][0]


def test_v12_2_garbled_fallback_invented_requirement_and_long_finding() -> None:
    """Column bleed and an invented requirement hold the row. A copied requirement stores.

    One finding that runs past the cap keeps its first whole sentences and a detail line.
    """
    import tempfile

    garbled = (
        "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
        "0510 not met as evidenced by record Minnesota Department of Health is review, "
        "the licensee failed to ensure unlicensed documenting the State Correction Orders "
        "personnel were present."
    )
    with tempfile.TemporaryDirectory() as tmp:
        path = f"{tmp}/warnings.jsonl"
        held = si.summarize(
            _json_client(json.dumps([{
                "tag": "0510",
                "description": "The licensee failed to post 3 hours.",
            }])),
            "survey",
            False,
            None,
            garbled,
            state_code="MN",
            deficiency_count=1,
            d_tags=["0510"],
            record_date="2024-03-10",
            warning_log=path,
            inspection_id="garbled",
        )
        assert held is None
        assert "garbled column text" in _last_warning(path)["warnings"][0]

        invented = si.summarize(
            _json_client(json.dumps([{
                "tag": "0510",
                "description": (
                    "The licensee failed to post the hours. "
                    "The facility is required to maintain proper water temperature."
                ),
            }])),
            "survey",
            False,
            None,
            (
                "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
                "0510 not met as evidenced by the licensee failed to post the hours."
            ),
            state_code="MN",
            deficiency_count=1,
            d_tags=["0510"],
            record_date="2024-03-10",
            warning_log=path,
            inspection_id="water",
        )
        assert invented is None
        assert "invented requirement" in _last_warning(path)["warnings"][0]

    clean = si.summarize(
        _json_client(json.dumps([{
            "tag": "0510",
            "description": "The licensee failed to post 3 hours.",
        }])),
        "survey",
        False,
        None,
        (
            "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
            "0510 not met as evidenced by the licensee failed to post the hours."
        ),
        state_code="MN",
        deficiency_count=1,
        d_tags=["0510"],
        record_date="2024-03-10",
    )
    assert clean and "failed to" in clean and "3" not in clean
    assert "garbled" not in clean.lower()

    copied = si.summarize(
        _json_client(json.dumps([{
            "tag": "0510",
            "description": "The facility is required to maintain proper water temperature.",
        }])),
        "survey",
        False,
        None,
        (
            "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
            "0510 not met as evidenced by the facility is required to maintain proper water temperature."
        ),
        state_code="MN",
        deficiency_count=1,
        d_tags=["0510"],
        record_date="2024-03-10",
    )
    assert copied and "proper water temperature" in copied
    assert "in more detail" not in copied

    long_bits = ["The licensee failed to post the hours."] * 9
    long_out = si.summarize(
        _json_client(json.dumps([{
            "tag": None,
            "description": " ".join(long_bits),
        }])),
        "survey",
        False,
        None,
        (
            "On March 10, 2024, the Oregon Department of Human Services completed a full survey. "
            + " ".join(long_bits)
        ),
        state_code="OR",
        deficiency_count=1,
        record_date="2024-03-10",
    )
    assert long_out and "1 violation" in long_out
    sentences = si._sentences(long_out)
    detail = "The report describes this finding in more detail."
    assert sentences[-1] == detail
    assert len(sentences) - 1 <= 6
    assert long_out.count("The licensee failed to post the hours.") < 9


def test_v12_3_withdrawn_advice_instructions_and_paraphrase() -> None:
    """A removed citation, advice, an order, column bleed, a made-up duty, rule text, or a new outcome word holds the row.

    A normal 'failed to' finding, a requirement copied from the span, and a quoted
    licensee policy still store. The report text is not rewritten.
    """
    import tempfile

    survey = "On March 10, 2024, the Minnesota Department of Health completed a full survey. "
    removed = (
        survey
        + "0510 not met as evidenced by the carbon monoxide detector was not installed in the home. "
        + "Deficiency removed."
    )
    called = {"n": 0}

    class _Count:
        def create(self, **kw):
            called["n"] += 1
            return types.SimpleNamespace(content=[types.SimpleNamespace(text="[]")])

    with tempfile.TemporaryDirectory() as tmp:
        path = f"{tmp}/warnings.jsonl"

        def run(payload: str, narrative: str, **kwargs):
            return si.summarize(
                _json_client(payload),
                "survey",
                False,
                None,
                narrative,
                state_code=kwargs.pop("state_code", "MN"),
                deficiency_count=kwargs.pop("deficiency_count", 1),
                record_date="2024-03-10",
                warning_log=path,
                **kwargs,
            )

        held = si.summarize(
            types.SimpleNamespace(messages=_Count()),
            "survey",
            False,
            None,
            removed,
            state_code="MN",
            deficiency_count=1,
            d_tags=["0510"],
            record_date="2024-03-10",
            warning_log=path,
            inspection_id="removed",
        )
        assert held is None and called["n"] == 0
        assert "withdrawn finding" in _last_warning(path)["warnings"][0]
        assert "header count 0" in _last_warning(path)["warnings"][0]
        assert "record count 1" in _last_warning(path)["warnings"][0]

        advice = (
            survey
            + "0510 not met as evidenced by the licensee failed to post the hours. "
            + "Technical Assistance: The medication should have been assessed before the dose. "
            + "CSMAR advice was offered to the nurse."
        )
        advised = run(
            json.dumps([{
                "tag": "0510",
                "description": "The medication should have been assessed before the dose.",
            }]),
            advice,
            d_tags=["0510"],
            inspection_id="advice",
        )
        assert advised is None
        assert "technical assistance" in _last_warning(path)["warnings"][0]

        ordered = run(
            json.dumps([{"tag": "0510", "description": "Unlock medications."}]),
            survey + "0510 not met as evidenced by the licensee failed to lock the medications.",
            d_tags=["0510"],
            inspection_id="order",
        )
        assert ordered is None
        assert "inspector instruction" in _last_warning(path)["warnings"][0]

        bled = run(
            json.dumps([{
                "tag": "0510",
                "description": (
                    "The licensee failed to post the hours. "
                    "No Plan of Correction (PoC) required."
                ),
            }]),
            survey + "0510 not met as evidenced by the licensee failed to post the hours. "
            + "No Plan of Correction (PoC) required.",
            d_tags=["0510"],
            inspection_id="chrome",
        )
        assert bled is None
        assert "garbled column text" in _last_warning(path)["warnings"][0]

        invented = run(
            json.dumps([{
                "tag": "0510",
                "description": "The facility must ensure water temperature is maintained properly.",
            }]),
            survey + "0510 not met as evidenced by the facility did not maintain the water temperature.",
            d_tags=["0510"],
            inspection_id="must-ensure",
        )
        assert invented is None
        assert "invented requirement" in _last_warning(path)["warnings"][0]

        statute = run(
            json.dumps([{
                "tag": "0510",
                "description": "A licensee may not accept appointments as guardians.",
            }]),
            survey
            + "0510 not met as evidenced by the licensee accepted an appointment as guardian for a resident. "
            + "A licensee may not accept appointments as guardians.",
            d_tags=["0510"],
            inspection_id="guardians",
        )
        assert statute is None
        assert "rule text" in _last_warning(path)["warnings"][0]

        hospital = run(
            json.dumps([{
                "tag": "0510",
                "description": "The resident was discharged to the hospital.",
            }]),
            survey + "0510 not met as evidenced by the licensee failed to complete the transfer form.",
            d_tags=["0510"],
            inspection_id="hospital",
        )
        assert hospital is None
        assert "unsupported outcome" in _last_warning(path)["warnings"][0]

        mold = run(
            json.dumps([{
                "tag": "0510",
                "description": "The licensee failed to clean the mold.",
            }]),
            survey + "0510 not met as evidenced by the licensee failed to clean the mole.",
            d_tags=["0510"],
            inspection_id="mold",
        )
        assert mold is None
        assert "unsupported outcome" in _last_warning(path)["warnings"][0]

        drill = run(
            json.dumps([{
                "tag": "0510",
                "description": "The last drill was over a year ago.",
            }]),
            survey + "0510 not met as evidenced by the last drill was not recorded.",
            d_tags=["0510"],
            inspection_id="drill",
        )
        assert drill is None
        assert "unsupported outcome" in _last_warning(path)["warnings"][0]

    kept = si.summarize(
        _json_client(json.dumps([{
            "tag": "0510",
            "description": "The licensee failed to post the hours.",
        }])),
        "survey",
        False,
        None,
        survey + "0510 not met as evidenced by the licensee failed to post the hours.",
        state_code="MN",
        deficiency_count=1,
        d_tags=["0510"],
        record_date="2024-03-10",
    )
    assert kept and "failed to post the hours" in kept
    assert "withdrawn" not in kept.lower()
    assert "in more detail" not in kept

    advised_ok = si.summarize(
        _json_client(json.dumps([{
            "tag": "0510",
            "description": "The licensee failed to post the hours.",
        }])),
        "survey",
        False,
        None,
        survey
        + "0510 not met as evidenced by the licensee failed to post the hours. "
        + "Technical Assistance: The medication should have been assessed before the dose.",
        state_code="MN",
        deficiency_count=1,
        d_tags=["0510"],
        record_date="2024-03-10",
    )
    assert advised_ok and "failed to post the hours" in advised_ok
    assert "assessed" not in advised_ok

    locked = si.summarize(
        _json_client(json.dumps([{
            "tag": "0510",
            "description": "The licensee failed to lock the medications.",
        }])),
        "survey",
        False,
        None,
        survey + "0510 not met as evidenced by the licensee failed to lock the medications.",
        state_code="MN",
        deficiency_count=1,
        d_tags=["0510"],
        record_date="2024-03-10",
    )
    assert locked and "failed to lock the medications" in locked

    policy = si.summarize(
        _json_client(json.dumps([{
            "tag": "0510",
            "description": "The facility's policy indicated medications must be locked in the cabinet.",
        }])),
        "survey",
        False,
        None,
        survey
        + "0510 not met as evidenced by the facility's policy indicated medications must be locked in the cabinet.",
        state_code="MN",
        deficiency_count=1,
        d_tags=["0510"],
        record_date="2024-03-10",
    )
    assert policy and "policy indicated" in policy

    copied = si.summarize(
        _json_client(json.dumps([{
            "tag": "0510",
            "description": "The facility is required to maintain proper water temperature.",
        }])),
        "survey",
        False,
        None,
        survey
        + "0510 not met as evidenced by the facility is required to maintain proper water temperature.",
        state_code="MN",
        deficiency_count=1,
        d_tags=["0510"],
        record_date="2024-03-10",
    )
    assert copied and "proper water temperature" in copied

    observed = si.summarize(
        _json_client(json.dumps([{
            "tag": "0510",
            "description": "The licensee accepted an appointment as guardian for a resident.",
        }])),
        "survey",
        False,
        None,
        survey
        + "0510 not met as evidenced by the licensee accepted an appointment as guardian for a resident. "
        + "A licensee may not accept appointments as guardians.",
        state_code="MN",
        deficiency_count=1,
        d_tags=["0510"],
        record_date="2024-03-10",
    )
    assert observed and "accepted an appointment" in observed
    assert "may not" not in observed

    discharged = si.summarize(
        _json_client(json.dumps([{
            "tag": "0510",
            "description": "The resident was discharged to the hospital.",
        }])),
        "survey",
        False,
        None,
        survey + "0510 not met as evidenced by the resident was discharged to the hospital.",
        state_code="MN",
        deficiency_count=1,
        d_tags=["0510"],
        record_date="2024-03-10",
    )
    assert discharged and "discharged to the hospital" in discharged

    other_state = si.summarize(
        _json_client(json.dumps([{
            "tag": None,
            "description": "Residents have the right to refuse treatment.",
        }])),
        "survey",
        False,
        None,
        "On March 10, 2024, the department completed a full survey. "
        "Residents have the right to refuse treatment.",
        state_code="IL",
        deficiency_count=1,
        record_date="2024-03-10",
    )
    assert other_state is None


if __name__ == "__main__":
    for _n, _f in sorted(globals().items()):
        if _n.startswith("test_") and callable(_f):
            _f()
            print("ok", _n)
