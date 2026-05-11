"""
or_inspections_ingest.py — severity inference tests.

The infer_severity() function is the most safety-critical transform in the pipeline:
it determines how dangerous a deficiency is scored, which affects grade computation.
Every path in the function must be tested exhaustively.

Effective-severity mapping (mirrors the facility_snapshot() SQL):
  explicit severity col (1–4)  → use if valid
  immediate_jeopardy=True      → 4 (overrides explicit < 4)
  state_severity_raw "Type A" / "serious" / "actual harm"  → 3
  state_severity_raw "Type B" / "potential" / "lesser"     → 2
  state_severity_raw "Type C" / "no harm" / "administrative" → 1
  state_severity_raw "immediate jeopardy" / "priority 1" / "I/J" → 4
  None / unrecognized          → None (no inference possible)

No mocks. Pure function tests.
"""

from __future__ import annotations

import pytest
from or_inspections_ingest import infer_severity


# ─────────────────────────────────────────────────────────────────────────────
# Explicit severity column takes precedence
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("explicit", [1, 2, 3, 4])
def test_explicit_severity_returned_as_is(explicit):
    result = infer_severity(None, explicit, immediate_jeopardy=False)
    assert result == explicit, (
        f"Expected explicit={explicit} to be returned unchanged, got {result}"
    )


def test_explicit_severity_overrides_state_raw():
    """Explicit column overrides text hints — explicit=2, raw says 'Type A' (3)."""
    result = infer_severity("Type A", 2, immediate_jeopardy=False)
    assert result == 2


def test_explicit_severity_1_not_overridden_by_type_a_raw():
    result = infer_severity("serious", 1, immediate_jeopardy=False)
    assert result == 1


def test_explicit_severity_out_of_range_falls_through_to_raw():
    """explicit=5 is out of range (1–4) → should fall through to raw hint."""
    result = infer_severity("Type A", 5, immediate_jeopardy=False)
    assert result == 3  # Type A → 3


def test_explicit_severity_0_falls_through_to_raw():
    result = infer_severity("Type B", 0, immediate_jeopardy=False)
    assert result == 2


# ─────────────────────────────────────────────────────────────────────────────
# immediate_jeopardy flag overrides lower explicit severity
# ─────────────────────────────────────────────────────────────────────────────


def test_immediate_jeopardy_true_forces_severity_4():
    result = infer_severity(None, None, immediate_jeopardy=True)
    assert result == 4


def test_immediate_jeopardy_overrides_explicit_2():
    result = infer_severity(None, 2, immediate_jeopardy=True)
    assert result == 4


def test_immediate_jeopardy_overrides_explicit_1():
    result = infer_severity(None, 1, immediate_jeopardy=True)
    assert result == 4


def test_immediate_jeopardy_does_not_downgrade_explicit_4():
    """When both explicit=4 and IJ=True, result is still 4."""
    result = infer_severity(None, 4, immediate_jeopardy=True)
    assert result == 4


def test_immediate_jeopardy_overrides_type_b_raw():
    result = infer_severity("Type B", None, immediate_jeopardy=True)
    assert result == 4


def test_immediate_jeopardy_false_does_not_force_4():
    result = infer_severity(None, 2, immediate_jeopardy=False)
    assert result == 2


# ─────────────────────────────────────────────────────────────────────────────
# State severity raw text → numeric severity
# ─────────────────────────────────────────────────────────────────────────────


# Severity 4 (IJ-equivalent) hints
@pytest.mark.parametrize("raw", [
    "Immediate Jeopardy",
    "immediate jeopardy",
    "IMMEDIATE JEOPARDY",
    "IJ",
    "ij",
    "Priority 1",
    "priority 1",
    "PRIORITY 1",
    "I/J",
    "i/j",
])
def test_state_raw_severity_4_hints(raw):
    result = infer_severity(raw, None, immediate_jeopardy=False)
    assert result == 4, (
        f"Expected severity 4 for raw={raw!r}, got {result}"
    )


# Severity 3 (actual harm) hints
@pytest.mark.parametrize("raw", [
    "Type A",
    "type a",
    "TYPE A",
    "Pattern A",
    "Class A",
    "class a",
    "Serious",
    "serious",
    "SERIOUS",
    "Actual Harm",
    "actual harm",
])
def test_state_raw_severity_3_hints(raw):
    result = infer_severity(raw, None, immediate_jeopardy=False)
    assert result == 3, (
        f"Expected severity 3 for raw={raw!r}, got {result}"
    )


# Severity 2 (potential for harm) hints
@pytest.mark.parametrize("raw", [
    "Type B",
    "type b",
    "TYPE B",
    "Pattern B",
    "Class B",
    "class b",
    "Potential",
    "potential",
    "POTENTIAL",
    "Lesser",
    "lesser",
])
def test_state_raw_severity_2_hints(raw):
    result = infer_severity(raw, None, immediate_jeopardy=False)
    assert result == 2, (
        f"Expected severity 2 for raw={raw!r}, got {result}"
    )


# Severity 1 (no harm) hints
@pytest.mark.parametrize("raw", [
    "Type C",
    "type c",
    "TYPE C",
    "Class C",
    "class c",
    "No Harm",
    "no harm",
    "NO HARM",
    "Administrative",
    "administrative",
    "ADMINISTRATIVE",
])
def test_state_raw_severity_1_hints(raw):
    result = infer_severity(raw, None, immediate_jeopardy=False)
    assert result == 1, (
        f"Expected severity 1 for raw={raw!r}, got {result}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# No inference possible → None
# ─────────────────────────────────────────────────────────────────────────────


def test_no_info_returns_none():
    result = infer_severity(None, None, immediate_jeopardy=False)
    assert result is None


def test_empty_raw_no_explicit_returns_none():
    result = infer_severity("", None, immediate_jeopardy=False)
    assert result is None


def test_unrecognized_raw_returns_none():
    result = infer_severity("Unknown Category XYZ", None, immediate_jeopardy=False)
    assert result is None


def test_whitespace_raw_returns_none():
    result = infer_severity("   ", None, immediate_jeopardy=False)
    assert result is None


# ─────────────────────────────────────────────────────────────────────────────
# Result is always None or int in 1–4
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("raw,explicit,ij", [
    (None, None, False),
    ("Type A", None, False),
    ("Type B", 2, False),
    (None, 3, True),
    ("Immediate Jeopardy", None, True),
    ("garbage", None, False),
    ("", 5, False),
])
def test_result_is_none_or_1_to_4(raw, explicit, ij):
    result = infer_severity(raw, explicit, immediate_jeopardy=ij)
    assert result is None or (isinstance(result, int) and 1 <= result <= 4), (
        f"infer_severity({raw!r}, {explicit}, ij={ij}) = {result!r} — "
        "must be None or int 1-4"
    )
