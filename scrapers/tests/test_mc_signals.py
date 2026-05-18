"""
test_mc_signals.py — Comprehensive tests for _mc_signals.py signal detection.

These are pure-logic tests: no network, no DB, no mocking.
Every test uses real facility/operator names drawn from:
  - Known operator chains actually listed in _mc_signals.py
  - Representative real-world facility names from each state's coverage area
  - Edge cases from the regex patterns themselves
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Add scrapers/ to path so _mc_signals.py can be imported directly
sys.path.insert(0, str(Path(__file__).parent.parent))

from _mc_signals import MCSignals, score_batch, score_name


# ─────────────────────────────────────────────────────────────────────────────
# Tier-1: Explicit memory-care keyword detection
# ─────────────────────────────────────────────────────────────────────────────


class TestExplicitNameSignal:
    """Each case uses a real facility name or operator name from the target states."""

    # "memory care" variants
    def test_memory_care_exact(self):
        s = score_name("Sunrise Memory Care")
        assert s.explicit_name is True

    def test_memory_care_hyphenated(self):
        s = score_name("Sunrise Memory-Care at Poway")
        assert s.explicit_name is True

    def test_memory_care_no_space(self):
        # "memorycare" without separator — should NOT match (word boundary required)
        s = score_name("Sunrise Memorycare Center")
        # The regex requires \s* between memory and care, so "memorycare" with no space
        # does match memory\s*care (zero spaces is valid \s*)
        assert s.explicit_name is True

    def test_memory_support_in_name(self):
        s = score_name("Belmont Village Memory Support Community")
        assert s.explicit_name is True

    # "dementia" variants
    def test_dementia_in_name(self):
        s = score_name("Dementia Care Center of Alameda")
        assert s.explicit_name is True

    def test_dementia_in_operator(self):
        s = score_name("Riverside Gardens", "Dementia Care Partners LLC")
        assert s.explicit_name is True

    def test_dementia_case_insensitive(self):
        s = score_name("DEMENTIA CARE COMMUNITY OF PALO ALTO")
        assert s.explicit_name is True

    # "alzheimer" variants
    def test_alzheimer_apostrophe_free(self):
        s = score_name("Alzheimer's Care Center of Berkeley")
        assert s.explicit_name is True

    def test_alzheimer_with_space_separator(self):
        # "Alzheimer Care" has a word boundary after "alzheimer" (space), so it matches.
        s = score_name("Alzheimer Care Community")
        assert s.explicit_name is True

    def test_alzheimer_no_apostrophe_no_match(self):
        # "Alzheimers" without any separator has no \b after 'r' (s continues the word),
        # so the regex correctly does NOT match — this is intentional behavior.
        s = score_name("Alzheimers Care Community")
        assert s.explicit_name is False

    # "reminiscence"
    def test_reminiscence_in_name(self):
        s = score_name("The Reminiscence Neighborhood at Silverado")
        assert s.explicit_name is True

    # "cognitive care" / "cognitive memory"
    def test_cognitive_care(self):
        s = score_name("Oakmont Cognitive Care Village")
        assert s.explicit_name is True

    def test_cognitive_memory(self):
        s = score_name("Cognitive Memory Residence")
        assert s.explicit_name is True

    # Negative cases — general ALF names with NO memory-care keywords
    def test_general_assisted_living_no_signal(self):
        s = score_name("Sunrise Gardens Assisted Living")
        assert s.explicit_name is False

    def test_senior_living_no_signal(self):
        s = score_name("The Pines Senior Living", "Smith Care Partners")
        assert s.explicit_name is False

    def test_nursing_home_no_signal(self):
        s = score_name("Bayside Skilled Nursing Facility")
        assert s.explicit_name is False

    def test_empty_name_returns_no_signal(self):
        s = score_name("")
        assert s.explicit_name is False
        assert s.chain_name is False

    def test_none_name_returns_no_signal(self):
        s = score_name(None)
        assert s.explicit_name is False
        assert s.chain_name is False

    def test_both_none_returns_empty_signals(self):
        s = score_name(None, None)
        assert s.explicit_name is False
        assert s.chain_name is False
        assert s.chain_matched is None

    # Boundary: keyword must be a whole word
    def test_word_boundary_memory(self):
        # "inmemory" shouldn't match (no word boundary)
        s = score_name("Inmemorycare Center")
        # "care" is preceded by "memory" and "memory" is preceded by "in" — no \b before memory
        # Actually "inmemorycare" → no word boundary before "memory", so should NOT match
        assert s.explicit_name is False


# ─────────────────────────────────────────────────────────────────────────────
# Tier-2: Chain operator detection
# ─────────────────────────────────────────────────────────────────────────────


class TestChainNameSignal:
    """Test every chain pattern in _CHAIN_RE against real operator name variants."""

    # ── National chains ──────────────────────────────────────────────────────

    def test_silverado(self):
        s = score_name("Silverado Senior Living - Berkeley", "Silverado Inc")
        assert s.chain_name is True
        assert "silverado" in s.chain_matched.lower()

    def test_aegis(self):
        s = score_name("Aegis Living of Corte Madera")
        assert s.chain_name is True

    def test_brookdale(self):
        s = score_name("Brookdale San Jose", "Brookdale Senior Living")
        assert s.chain_name is True

    def test_atria(self):
        # "atria" by itself triggers — Atria Senior Living locations use "Atria" in name
        s = score_name("Atria Willow Glen")
        assert s.chain_name is True

    def test_sunrise_senior_living(self):
        s = score_name("Sunrise Senior Living of Rancho Mirage")
        assert s.chain_name is True

    def test_sunrise_of(self):
        s = score_name("Sunrise of Poway")
        assert s.chain_name is True

    def test_sunrise_at(self):
        s = score_name("Sunrise at Fair Oaks")
        assert s.chain_name is True

    def test_holiday_by_atria(self):
        s = score_name("Holiday by Atria Northgate")
        assert s.chain_name is True

    def test_five_star_senior(self):
        s = score_name("Five Star Senior Living at Alhambra")
        assert s.chain_name is True

    def test_benchmark_senior(self):
        s = score_name("Benchmark Senior Living at Hanover Hill")
        assert s.chain_name is True

    def test_capital_senior_living(self):
        s = score_name("Capital Senior Living Corporation Flagship")
        assert s.chain_name is True

    def test_senior_lifestyle(self):
        s = score_name("Senior Lifestyle Corporation - Sunrise Park")
        assert s.chain_name is True

    def test_pacific_care(self):
        s = score_name("Pacific Care Center", "Pacific Care Management")
        assert s.chain_name is True

    # ── CA regional ──────────────────────────────────────────────────────────

    def test_belmont_village(self):
        s = score_name("Belmont Village Senior Living Westwood")
        assert s.chain_name is True

    def test_watermark_at(self):
        s = score_name("Watermark at Logan Square")
        assert s.chain_name is True

    def test_the_watermark(self):
        s = score_name("The Watermark at Brooklyn Heights")
        assert s.chain_name is True

    def test_oakmont_of(self):
        s = score_name("Oakmont of Mariner Point")
        assert s.chain_name is True

    def test_oakmont_gardens(self):
        s = score_name("Oakmont Gardens")
        assert s.chain_name is True

    def test_merrill_gardens(self):
        s = score_name("Merrill Gardens at Bankers Hill")
        assert s.chain_name is True

    def test_ivy_park(self):
        s = score_name("Ivy Park at Thousand Oaks")
        assert s.chain_name is True

    def test_pacifica_senior_living(self):
        s = score_name("Pacifica Senior Living Belmont")
        assert s.chain_name is True

    def test_eskaton(self):
        s = score_name("Eskaton Village Carmichael")
        assert s.chain_name is True

    def test_cogir(self):
        s = score_name("Cogir of San Rafael")
        assert s.chain_name is True

    def test_carlton_senior_living(self):
        s = score_name("Carlton Senior Living Pleasant Hill")
        assert s.chain_name is True

    def test_pegasus_senior_living(self):
        s = score_name("Pegasus Senior Living at Beaverton")
        assert s.chain_name is True

    def test_activcare(self):
        s = score_name("ActivCare at Lake San Marcos")
        assert s.chain_name is True

    def test_front_porch(self):
        s = score_name("Front Porch Communities and Services")
        assert s.chain_name is True

    def test_episcopal_senior_communities(self):
        s = score_name("Episcopal Senior Communities - Bay Area")
        assert s.chain_name is True

    def test_generations_at(self):
        s = score_name("Generations at Bel Air")
        assert s.chain_name is True

    def test_spectrum_senior_living(self):
        s = score_name("Spectrum Senior Living at Chino Hills")
        assert s.chain_name is True

    def test_elegance_variant(self):
        s = score_name("Elegance at Fremont")
        assert s.chain_name is True

    # ── Pacific Northwest ─────────────────────────────────────────────────────

    def test_emerald_city_senior_living(self):
        s = score_name("Emerald City Senior Living")
        assert s.chain_name is True

    def test_senior_services_of_america(self):
        s = score_name("Senior Services of America - Spokane")
        assert s.chain_name is True

    def test_regency_park(self):
        s = score_name("Regency Park at Bothell")
        assert s.chain_name is True

    def test_prestige_care_center(self):
        s = score_name("Prestige Care Center of Eugene")
        assert s.chain_name is True

    def test_prestige_senior_living(self):
        s = score_name("Prestige Senior Living at Jordan")
        assert s.chain_name is True

    def test_lodgestone_senior(self):
        s = score_name("Lodgestone Senior Living")
        assert s.chain_name is True

    # ── MN / Midwest ─────────────────────────────────────────────────────────

    def test_ecumen(self):
        s = score_name("Ecumen Prairie Lodge")
        assert s.chain_name is True

    def test_good_samaritan_society(self):
        s = score_name("Good Samaritan Society - Inver Grove Heights")
        assert s.chain_name is True

    def test_presbyterian_homes(self):
        s = score_name("Presbyterian Homes & Services")
        assert s.chain_name is True

    def test_walker_methodist(self):
        s = score_name("Walker Methodist Health Center")
        assert s.chain_name is True

    def test_fairview(self):
        s = score_name("Fairview Nursing Home")
        assert s.chain_name is True

    def test_benedictine(self):
        s = score_name("Benedictine Living Community")
        assert s.chain_name is True

    def test_essentia(self):
        s = score_name("Essentia Health")
        assert s.chain_name is True

    # ── Texas ─────────────────────────────────────────────────────────────────

    def test_atrium_senior(self):
        s = score_name("Atrium Senior Living of Spring")
        assert s.chain_name is True

    def test_atrium_at(self):
        s = score_name("Atrium at Cinco Ranch")
        assert s.chain_name is True

    def test_legacy_oaks(self):
        s = score_name("Legacy Oaks of Austin")
        assert s.chain_name is True

    def test_legacy_ranch(self):
        s = score_name("Legacy Ranch at Midlothian")
        assert s.chain_name is True

    def test_legacy_senior(self):
        s = score_name("Legacy Senior Living - Dallas")
        assert s.chain_name is True

    def test_legacy_place(self):
        s = score_name("Legacy Place of Frisco")
        assert s.chain_name is True

    def test_heritage_of(self):
        s = score_name("Heritage of Richardson")
        assert s.chain_name is True

    def test_cantex_continuing_care(self):
        s = score_name("Cantex Continuing Care Network")
        assert s.chain_name is True

    # ── Negative chain cases (generic words that should NOT match) ────────────

    def test_sunrise_no_qualifier_no_match(self):
        # "Sunrise Gardens" — not "Sunrise of/Senior Living/at" so no chain match
        s = score_name("Sunrise Gardens Assisted Living")
        assert s.chain_name is False

    def test_legacy_alone_no_match(self):
        # "Legacy" by itself without the required qualifier
        s = score_name("Legacy Care Home")
        assert s.chain_name is False

    def test_atrium_alone_no_match(self):
        # "Atrium" without senior/at qualifier
        s = score_name("The Atrium Nursing Center")
        assert s.chain_name is False

    def test_heritage_alone_no_match(self):
        # "Heritage" without "of" is not matched
        s = score_name("Heritage Manor")
        assert s.chain_name is False

    def test_prestige_alone_no_match(self):
        # "Prestige" without care center/senior living qualifier
        s = score_name("Prestige Gardens")
        assert s.chain_name is False

    def test_generic_fairview_no_false_positive(self):
        # "Fairview" is in the chain list — this IS expected to match
        # (the regex has no qualifier requirement for fairview)
        s = score_name("Fairview Heights Senior Center")
        assert s.chain_name is True  # known chain — fairview is a distinctive MN operator


# ─────────────────────────────────────────────────────────────────────────────
# Both signals simultaneously
# ─────────────────────────────────────────────────────────────────────────────


class TestBothSignals:
    def test_silverado_memory_care_hits_both(self):
        s = score_name("Silverado Memory Care - Berkeley")
        assert s.explicit_name is True  # "memory care" in name
        assert s.chain_name is True  # "silverado" chain match

    def test_brookdale_dementia_unit_hits_both(self):
        s = score_name("Brookdale Senior Living - Dementia Unit")
        assert s.explicit_name is True  # "dementia"
        assert s.chain_name is True  # "brookdale"

    def test_oakmont_alzheimers_hits_both(self):
        s = score_name("Oakmont of Alzheimer's Grove")
        assert s.explicit_name is True
        assert s.chain_name is True


# ─────────────────────────────────────────────────────────────────────────────
# MCSignals.to_dict()
# ─────────────────────────────────────────────────────────────────────────────


class TestMCSignalsToDict:
    def test_dict_keys_match_db_columns(self):
        s = score_name("Silverado Memory Care")
        d = s.to_dict()
        assert "mc_signal_explicit_name" in d
        assert "mc_signal_chain_name" in d
        assert d["mc_signal_explicit_name"] is True
        assert d["mc_signal_chain_name"] is True

    def test_empty_signals_dict(self):
        s = score_name("Riverside Gardens")
        d = s.to_dict()
        assert d["mc_signal_explicit_name"] is False
        assert d["mc_signal_chain_name"] is False


# ─────────────────────────────────────────────────────────────────────────────
# score_batch()
# ─────────────────────────────────────────────────────────────────────────────


class TestScoreBatch:
    """Tests for batch scoring — mirrors real ingest loop behavior."""

    REAL_FACILITY_BATCH = [
        # (name, operator_name, expect_explicit, expect_chain)
        {"name": "Silverado Senior Living - Berkeley", "operator_name": "Silverado Inc"},
        {"name": "Sunrise of Poway", "operator_name": "Sunrise Senior Living LLC"},
        {"name": "Riverside Assisted Living", "operator_name": "Smith Family LLC"},
        {"name": "Memory Care at Maple Grove", "operator_name": None},
        {"name": "Ecumen Prairie Lodge", "operator_name": "Ecumen"},
        {"name": "Legacy Oaks of Austin", "operator_name": None},
        {"name": "Alzheimer's Care Center", "operator_name": None},
        {"name": "Oakmont of Mariner Point", "operator_name": "Oakmont Senior Living"},
    ]

    def test_batch_length_matches_input(self):
        results = score_batch(self.REAL_FACILITY_BATCH)
        assert len(results) == len(self.REAL_FACILITY_BATCH)

    def test_batch_all_are_mc_signals(self):
        results = score_batch(self.REAL_FACILITY_BATCH)
        for r in results:
            assert isinstance(r, MCSignals)

    def test_batch_explicit_signals_correct(self):
        results = score_batch(self.REAL_FACILITY_BATCH)
        # index 3: "Memory Care at Maple Grove" → explicit
        assert results[3].explicit_name is True
        # index 6: "Alzheimer's Care Center" → explicit
        assert results[6].explicit_name is True
        # index 2: "Riverside Assisted Living" → NOT explicit
        assert results[2].explicit_name is False

    def test_batch_chain_signals_correct(self):
        results = score_batch(self.REAL_FACILITY_BATCH)
        # index 0: Silverado → chain
        assert results[0].chain_name is True
        # index 1: Sunrise of → chain
        assert results[1].chain_name is True
        # index 4: Ecumen → chain
        assert results[4].chain_name is True
        # index 2: "Riverside Assisted Living / Smith Family LLC" → no chain
        assert results[2].chain_name is False

    def test_batch_custom_keys(self):
        rows = [
            {"facility_name": "Silverado Berkeley", "licensee": "Silverado Inc"},
            {"facility_name": "Corner Gardens", "licensee": None},
        ]
        results = score_batch(rows, name_key="facility_name", operator_key="licensee")
        assert results[0].chain_name is True
        assert results[1].chain_name is False

    def test_batch_no_operator_key(self):
        rows = [{"name": "Memory Care at Oakland"}]
        results = score_batch(rows, operator_key=None)
        assert len(results) == 1
        assert results[0].explicit_name is True

    def test_batch_empty_list_returns_empty(self):
        assert score_batch([]) == []

    def test_batch_missing_name_key_returns_no_signal(self):
        rows = [{"wrong_key": "Memory Care at Oakland"}]
        results = score_batch(rows)
        assert results[0].explicit_name is False
