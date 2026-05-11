"""
_mc_signals.py — comprehensive unit tests for memory care signal detection.

No mocks. No fake DB. Pure function tests on the real regex logic.

Covers every pattern in _EXPLICIT_RE and _CHAIN_RE, including:
  • Case-insensitivity
  • Word-boundary anchoring (prevents false positives)
  • Operator-name fallback (score_name uses both facility + operator strings)
  • score_batch() batch interface
  • MCSignals.to_dict() output shape
  • Edge cases: None inputs, empty strings, Unicode, hyphenation variants
"""

from __future__ import annotations

import pytest
from _mc_signals import MCSignals, score_batch, score_name


# ─────────────────────────────────────────────────────────────────────────────
# Tier 1 — Explicit MC keywords
# Each keyword in _EXPLICIT_RE must produce explicit_name=True.
# ─────────────────────────────────────────────────────────────────────────────


EXPLICIT_POSITIVE_CASES: list[tuple[str, str | None, str]] = [
    # (facility_name, operator_name, reason)
    ("Memory Care at Maple Grove", None, "bare 'memory care' keyword"),
    ("Maple Grove Memory Care", None, "'memory care' at end"),
    ("MemoryCare Center", None, "memorycare no space"),
    ("Memory-Care Gardens", None, "memory-care hyphenated"),
    ("Memory Support Center", None, "memory support"),
    ("Memory-Support Gardens", None, "memory-support hyphenated"),
    ("Dementia Care Center", None, "dementia keyword"),
    ("Alzheimer's Care Center", None, "alzheimer keyword with apostrophe"),
    ("Alzheimer Care Community", None, "alzheimer no apostrophe"),
    ("Reminiscence Gardens", None, "reminiscence keyword"),
    ("Cognitive Care Community", None, "cognitive care keyword"),
    ("Cognitive Memory Center", None, "cognitive memory keyword"),
    ("MEMORY CARE CENTER", None, "all-caps (case-insensitive)"),
    ("memory care center", None, "all-lowercase (case-insensitive)"),
    ("The Gardens — Memory Care Wing", None, "memory care in longer name"),
    ("Sunrise Memory Care", None, "memory care with prefix"),
    (
        "Sunrise Senior Living of Poway",
        "Memory Care Division Inc",
        "memory care in operator name only",
    ),
    ("My Alzheimers Community Place", None, "alzheimers plural variant"),
]

EXPLICIT_NEGATIVE_CASES: list[tuple[str, str | None, str]] = [
    # (facility_name, operator_name, reason)
    ("Maple Grove Assisted Living", None, "no MC keyword"),
    ("Sunrise of Poway", None, "chain name but no MC keyword"),
    ("Memory Lane Senior Living", None, "'memory' alone is not 'memory care'"),
    ("The Cognitive Institute", None, "'cognitive' alone is not 'cognitive care'"),
    ("Brookdale San Jose", "Brookdale Senior Living", "chain but no explicit MC"),
    ("", None, "empty string"),
    (None, None, "both None"),  # type: ignore[arg-type]
    ("Reminder Center", None, "similar but not 'reminiscence'"),
    ("DementiaCareNotAWord", None, "word boundary: dementia must be word-start"),
    # "DementiaCareNotAWord" — 'dementia' appears but let's check word boundary:
    # Actually \b anchors on word breaks. "DementiaCareNotAWord" starts with 'Dementia' at position 0,
    # which is a word boundary. So this WILL match. Remove from negative.
]

# Correct the boundary case — DementiaCareNotAWord WILL match because
# 'Dementia' starts at position 0 (which is a word boundary).
EXPLICIT_NEGATIVE_CASES_FIXED: list[tuple[str, str | None, str]] = [
    ("Maple Grove Assisted Living", None, "no MC keyword"),
    ("Sunrise of Poway", None, "chain name but no MC keyword"),
    ("Memory Lane Senior Living", None, "'memory' alone is not 'memory care'"),
    ("The Cognitive Institute", None, "'cognitive' alone is not 'cognitive care/memory'"),
    ("Brookdale San Jose", "Brookdale Senior Living", "chain but no explicit MC"),
    ("", None, "empty string"),
    ("Reminder Center", None, "similar but not 'reminiscence'"),
    ("Cogitation Senior Center", None, "'cogit' not 'cognitive'"),
    ("Memoir House", None, "'memoir' not 'memory'"),
]


@pytest.mark.parametrize("name,op,reason", EXPLICIT_POSITIVE_CASES)
def test_explicit_mc_detected(name, op, reason):
    sig = score_name(name, op)
    assert sig.explicit_name is True, (
        f"Expected explicit_name=True for {name!r} / {op!r} ({reason}). "
        f"Got MCSignals(explicit_name={sig.explicit_name}, chain_name={sig.chain_name})"
    )


@pytest.mark.parametrize("name,op,reason", EXPLICIT_NEGATIVE_CASES_FIXED)
def test_explicit_mc_not_detected(name, op, reason):
    sig = score_name(name, op)
    assert sig.explicit_name is False, (
        f"Expected explicit_name=False for {name!r} / {op!r} ({reason}). "
        f"Got MCSignals(explicit_name={sig.explicit_name})"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tier 2 — Chain operator patterns
# Every chain in _CHAIN_RE must produce chain_name=True.
# ─────────────────────────────────────────────────────────────────────────────


CHAIN_POSITIVE_CASES: list[tuple[str, str | None, str]] = [
    # National operators
    ("Silverado Senior Living - Encinitas", None, "Silverado"),
    ("Aegis Living of Kirkland", None, "Aegis"),
    ("Brookdale San Jose", None, "Brookdale"),
    ("Brookdale Senior Living", None, "Brookdale as operator"),
    ("Atria Senior Living", None, "Atria"),
    ("Atria Rancho Park", None, "Atria with location"),
    ("Sunrise Senior Living of Poway", None, "Sunrise Senior Living of"),
    ("Sunrise of Thousand Oaks", None, "Sunrise of"),
    ("Sunrise at Rancho Palos Verdes", None, "Sunrise at"),
    ("Holiday by Atria Newtown", None, "Holiday by Atria"),
    ("Five Star Senior Living of Beverly", None, "Five Star Senior"),
    ("Benchmark Senior Living", None, "Benchmark Senior"),
    ("Capital Senior Living", None, "Capital Senior Living"),
    ("Senior Lifestyle at Oakwood", None, "Senior Lifestyle"),
    ("Pacific Care Center Ventura", None, "Pacific Care"),
    # Regional California
    ("Belmont Village Senior Living", None, "Belmont Village"),
    ("Watermark at Logan Square", None, "Watermark at"),
    ("The Watermark at Brooklyn Heights", None, "The Watermark"),
    ("Oakmont of Folsom", None, "Oakmont of"),
    ("Oakmont Gardens Sacramento", None, "Oakmont Gardens"),
    ("Merrill Gardens at Anthem", None, "Merrill Gardens"),
    ("Ivy Park at Redwood City", None, "Ivy Park"),
    ("Pacifica Senior Living", None, "Pacifica Senior Living"),
    ("Eskaton Village Carmichael", None, "Eskaton"),
    ("Cogir of Napa", None, "Cogir"),
    ("Carlton Senior Living Fremont", None, "Carlton Senior Living"),
    ("Pegasus Senior Living at Tuscany", None, "Pegasus Senior Living"),
    ("ActivCare at Mission Gorge", None, "ActivCare"),
    ("Front Porch Senior Living", None, "Front Porch"),
    ("Episcopal Senior Communities of Oakland", None, "Episcopal Senior Communities"),
    ("Generations at Rupert", None, "Generations at"),
    ("Spectrum Senior Living", None, "Spectrum Senior Living"),
    ("Elegance at River Oaks", None, "Elegance at"),
    # Pacific Northwest
    ("Emerald City Senior Living Seattle", None, "Emerald City Senior Living"),
    ("Senior Services of America Inc", None, "Senior Services of America"),
    ("Regency Park Assisted Living", None, "Regency Park"),
    ("Prestige Care Center of Auburn", None, "Prestige Care Center"),
    ("Prestige Senior Living Beaverton", None, "Prestige Senior Living"),
    # Minnesota / Midwest
    ("Ecumen Prairie Lodge", None, "Ecumen"),
    ("Good Samaritan Society Sioux Falls", None, "Good Samaritan Society"),
    ("Presbyterian Homes of Minnesota", None, "Presbyterian Homes"),
    ("Walker Methodist Health Center", None, "Walker Methodist"),
    ("Fairview Southdale", None, "Fairview"),
    ("Benedictine Living", None, "Benedictine"),
    # Texas
    ("Atrium Senior Living at Kingwood", None, "Atrium Senior"),
    ("Atrium at Round Rock", None, "Atrium at"),
    ("Legacy Oaks of Austin", None, "Legacy Oaks"),
    ("Legacy Ranch Assisted Living", None, "Legacy Ranch"),
    ("Legacy Senior Living Center", None, "Legacy Senior"),
    ("Legacy Place Waco", None, "Legacy Place"),
    ("Heritage of Plano", None, "Heritage of"),
    # Operator name matching
    ("Sunrise Gardens", "Silverado Senior Living Inc", "chain in operator name"),
    ("Pine Grove AL", "Aegis Living Corporation", "Aegis in operator"),
]

CHAIN_NEGATIVE_CASES: list[tuple[str, str | None, str]] = [
    ("Maple Grove Assisted Living", None, "generic AL name"),
    ("Sunny Meadows Senior Center", None, "not a known chain"),
    ("Pacific Gardens", None, "'pacific' alone not 'pacific care'"),
    ("Heritage Gardens", None, "'heritage' alone not 'heritage of'"),
    ("Legacy Gardens Senior", None, "'legacy' alone not 'legacy oaks/ranch/senior/place'"),
    ("Premier Senior Living", None, "not in chain list"),
    ("", None, "empty string"),
    (None, None, "both None"),  # type: ignore[arg-type]
]


@pytest.mark.parametrize("name,op,reason", CHAIN_POSITIVE_CASES)
def test_chain_mc_detected(name, op, reason):
    sig = score_name(name, op)
    assert sig.chain_name is True, (
        f"Expected chain_name=True for {name!r} / {op!r} ({reason}). "
        f"Got MCSignals(chain_name={sig.chain_name}, chain_matched={sig.chain_matched!r})"
    )


@pytest.mark.parametrize("name,op,reason", CHAIN_NEGATIVE_CASES)
def test_chain_mc_not_detected(name, op, reason):
    sig = score_name(name, op)
    assert sig.chain_name is False, (
        f"Expected chain_name=False for {name!r} / {op!r} ({reason}). "
        f"Got MCSignals(chain_name={sig.chain_name}, chain_matched={sig.chain_matched!r})"
    )


# ─────────────────────────────────────────────────────────────────────────────
# chain_matched field
# ─────────────────────────────────────────────────────────────────────────────


def test_chain_matched_is_none_when_no_chain():
    sig = score_name("Maple Grove Assisted Living")
    assert sig.chain_matched is None


def test_chain_matched_is_string_when_chain_detected():
    sig = score_name("Silverado Senior Living Encinitas")
    assert sig.chain_name is True
    assert isinstance(sig.chain_matched, str)
    assert "silverado" in sig.chain_matched.lower()


def test_chain_matched_contains_the_matched_fragment():
    sig = score_name("Brookdale at Sunrise Creek")
    assert sig.chain_name is True
    assert sig.chain_matched is not None
    assert "brookdale" in sig.chain_matched.lower()


def test_chain_matched_for_aegis():
    sig = score_name("Aegis Living of Kirkland")
    assert sig.chain_matched is not None
    assert "aegis" in sig.chain_matched.lower()


# ─────────────────────────────────────────────────────────────────────────────
# Both signals can fire simultaneously
# ─────────────────────────────────────────────────────────────────────────────


def test_both_signals_can_fire():
    """A facility can have BOTH explicit MC keywords AND be a known chain."""
    sig = score_name("Brookdale Memory Care Community")
    assert sig.explicit_name is True, "Brookdale Memory Care should fire explicit_name"
    assert sig.chain_name is True, "Brookdale Memory Care should fire chain_name"


def test_explicit_does_not_require_chain():
    sig = score_name("Memory Care at Pine Glen", None)
    assert sig.explicit_name is True
    assert sig.chain_name is False


def test_chain_does_not_require_explicit():
    sig = score_name("Silverado Encinitas", None)
    assert sig.chain_name is True
    assert sig.explicit_name is False


# ─────────────────────────────────────────────────────────────────────────────
# Edge cases: None, empty, whitespace
# ─────────────────────────────────────────────────────────────────────────────


def test_score_name_none_facility_name():
    sig = score_name(None)
    assert sig.explicit_name is False
    assert sig.chain_name is False
    assert sig.chain_matched is None


def test_score_name_empty_facility_name():
    sig = score_name("")
    assert sig.explicit_name is False
    assert sig.chain_name is False


def test_score_name_whitespace_only():
    sig = score_name("   ", "  ")
    assert sig.explicit_name is False
    assert sig.chain_name is False


def test_score_name_none_operator_name():
    """operator_name=None is fine — only facility_name is scored."""
    sig = score_name("Memory Care Center", None)
    assert sig.explicit_name is True


def test_score_name_operator_name_only_match():
    """Chain match fires even if only operator name contains the pattern."""
    sig = score_name("Sunrise Gardens", "Silverado Senior Living Inc")
    assert sig.chain_name is True
    assert "silverado" in (sig.chain_matched or "").lower()


# ─────────────────────────────────────────────────────────────────────────────
# MCSignals dataclass
# ─────────────────────────────────────────────────────────────────────────────


def test_mcsignals_default_is_all_false():
    sig = MCSignals()
    assert sig.explicit_name is False
    assert sig.chain_name is False
    assert sig.chain_matched is None


def test_mcsignals_to_dict_has_required_db_keys():
    sig = MCSignals(explicit_name=True, chain_name=False, chain_matched=None)
    d = sig.to_dict()
    assert "mc_signal_explicit_name" in d
    assert "mc_signal_chain_name" in d


def test_mcsignals_to_dict_values_are_bools():
    sig = score_name("Memory Care at Maple Grove")
    d = sig.to_dict()
    assert isinstance(d["mc_signal_explicit_name"], bool)
    assert isinstance(d["mc_signal_chain_name"], bool)


def test_mcsignals_to_dict_reflects_detection():
    sig = score_name("Brookdale Memory Care")
    d = sig.to_dict()
    assert d["mc_signal_explicit_name"] is True
    assert d["mc_signal_chain_name"] is True


def test_mcsignals_to_dict_does_not_include_chain_matched():
    """chain_matched is metadata only — must NOT be a DB column."""
    sig = score_name("Silverado Senior Living Encinitas")
    d = sig.to_dict()
    assert "chain_matched" not in d, (
        "chain_matched must NOT appear in to_dict() — it is not a DB column"
    )


# ─────────────────────────────────────────────────────────────────────────────
# score_batch()
# ─────────────────────────────────────────────────────────────────────────────


def test_score_batch_returns_same_length():
    rows = [
        {"name": "Memory Care Center", "operator_name": None},
        {"name": "Brookdale San Jose", "operator_name": "Brookdale Senior Living"},
        {"name": "Maple Grove AL", "operator_name": None},
    ]
    results = score_batch(rows)
    assert len(results) == len(rows)


def test_score_batch_each_element_is_mcsignals():
    rows = [{"name": "Memory Care Center", "operator_name": None}]
    results = score_batch(rows)
    assert isinstance(results[0], MCSignals)


def test_score_batch_matches_individual_score_name():
    rows = [
        {"name": "Silverado Senior Living Encinitas", "operator_name": None},
        {"name": "Memory Care at Pine Glen", "operator_name": None},
        {"name": "Maple Grove Assisted Living", "operator_name": None},
    ]
    batch = score_batch(rows)
    for i, row in enumerate(rows):
        individual = score_name(row["name"], row.get("operator_name"))
        assert batch[i].explicit_name == individual.explicit_name, f"row {i} explicit mismatch"
        assert batch[i].chain_name == individual.chain_name, f"row {i} chain mismatch"


def test_score_batch_custom_name_key():
    rows = [{"facility_name": "Memory Care Center", "operator": None}]
    results = score_batch(rows, name_key="facility_name", operator_key="operator")
    assert results[0].explicit_name is True


def test_score_batch_operator_key_none_skips_operator():
    rows = [{"name": "Maple Grove", "operator_name": "Silverado Inc"}]
    # With operator_key=None, only the name is checked — no chain detection
    results = score_batch(rows, operator_key=None)
    # 'Maple Grove' alone has no chain keyword
    assert results[0].chain_name is False


def test_score_batch_empty_list():
    assert score_batch([]) == []


def test_score_batch_preserves_order():
    rows = [
        {"name": "Silverado A", "operator_name": None},  # chain
        {"name": "Memory Care B", "operator_name": None},  # explicit
        {"name": "Plain AL C", "operator_name": None},  # neither
    ]
    results = score_batch(rows)
    assert results[0].chain_name is True
    assert results[1].explicit_name is True
    assert results[2].explicit_name is False and results[2].chain_name is False
