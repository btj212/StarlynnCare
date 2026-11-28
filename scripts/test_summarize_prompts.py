#!/usr/bin/env python3
"""Prompt-string checks for scrapers/summarize_inspections.py (no DB, no API calls).

Every state prompt must: carry no run date ("Today is"), carry no license-type sentence,
state the record-date rule, and state the attribution rule (what a resident or staff
member said is attributed, never stated as fact).
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


if __name__ == "__main__":
    for _n, _f in sorted(globals().items()):
        if _n.startswith("test_") and callable(_f):
            _f()
            print("ok", _n)
