#!/usr/bin/env python3
"""Prompt-string checks for scrapers/summarize_inspections.py (no DB, no API calls).

Every state prompt must: carry no run date ("Today is"), carry no license-type sentence,
state the record-date rule, and state the attribution rule (what a resident or staff
member said is attributed, never stated as fact).

The report text sent to the model is not truncated. A 20,000-character report is
passed in full. A report that cannot fit in one context window is split on
finding boundaries, or on paragraphs when it has none, and no character is dropped.
"""

from __future__ import annotations

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
            self.content = [types.SimpleNamespace(text="A complaint visit on March 10, 2025 found one deficiency.")]

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
    user = sent["messages"][0]["content"]
    assert "Record date (state database): 2025-03-10" in user
    assert "Today is" not in sent["system"]
    sent.clear()
    si.summarize(client, "visit", False, None, "Visit made.", state_code="ZZ")
    assert "Record date (state database): unknown" in sent["messages"][0]["content"]
    assert sent["system"] == si.SYSTEM_PROMPT_GENERIC


def _stub_client(sent: list[dict]) -> types.SimpleNamespace:
    class _Resp:
        def __init__(self) -> None:
            self.content = [
                types.SimpleNamespace(text="A routine inspection found a lighting problem in the hallway.")
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
        out = si.summarize(_stub_client(sent), "visit", False, None, marked, state_code="CA")
    finally:
        si._narrative_budget = original_budget
    assert out
    assert len(sent) > 1
    delivered = []
    for call in sent:
        user = call["messages"][0]["content"]
        start = user.index("Narrative:\n") + len("Narrative:\n")
        end = user.index("\n\nWrite a 2-3 sentence plain-English summary for families.")
        delivered.append(user[start:end])
    assert "".join(delivered) == marked


if __name__ == "__main__":
    for _n, _f in sorted(globals().items()):
        if _n.startswith("test_") and callable(_f):
            _f()
            print("ok", _n)
