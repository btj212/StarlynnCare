"""
Tests: PA scraper helper functions (pure Python, no IO).

Tests the deterministic logic from pa_hsd_directory_ingest.py:
  - derive_url_id (the PA "gotcha": license[-1] stripped for Azure portal URLs)
  - parse_capacity, parse_secure_beds
  - parse_date
  - clean_cell, slugify, titleize
  - assert_url_id_fixtures (verifies all 4 known reference fixtures)

These tests are always runnable — no DB, no network required.
"""

from __future__ import annotations

import sys
from datetime import date, datetime
from pathlib import Path

# Add scrapers/ to path so we can import helpers directly.
SCRAPERS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "scrapers"
sys.path.insert(0, str(SCRAPERS_DIR))

from pa_hsd_directory_ingest import (
    URL_ID_FIXTURES,
    assert_url_id_fixtures,
    clean_cell,
    derive_url_id,
    parse_capacity,
    parse_date,
    parse_secure_beds,
    slugify,
    titleize,
)


# ── derive_url_id ─────────────────────────────────────────────────────────────

class TestDeriveUrlId:
    """PA gotcha: the last digit of the license number is stripped for Azure URLs."""

    def test_rittenhouse_village(self) -> None:
        assert derive_url_id("223010") == "22301"

    def test_a_second_chance(self) -> None:
        assert derive_url_id("110780") == "11078"

    def test_serenity_gardens(self) -> None:
        assert derive_url_id("231010") == "23101"

    def test_cambridge_village(self) -> None:
        assert derive_url_id("456560") == "45656"

    def test_strips_last_character_generically(self) -> None:
        assert derive_url_id("123456") == "12345"

    def test_strips_whitespace_before_slicing(self) -> None:
        assert derive_url_id("  223010  ") == "22301"

    def test_single_digit_license_strips_to_empty_string(self) -> None:
        # Edge case: license "5" → "" (strips the only character)
        result = derive_url_id("5")
        assert result == ""

    def test_two_digit_license(self) -> None:
        assert derive_url_id("42") == "4"


class TestAssertUrlIdFixtures:
    """assert_url_id_fixtures() must pass all 4 known reference cases."""

    def test_all_fixtures_pass(self) -> None:
        """No AssertionError means all 4 PA URL-id fixtures are correct."""
        assert_url_id_fixtures()  # should not raise

    def test_fixtures_match_constants(self) -> None:
        """Every URL_ID_FIXTURES entry validates via derive_url_id."""
        for license_num, expected in URL_ID_FIXTURES:
            actual = derive_url_id(license_num)
            assert actual == expected, (
                f"Fixture mismatch: license {license_num!r} → {actual!r}, expected {expected!r}"
            )


# ── parse_capacity ────────────────────────────────────────────────────────────

class TestParseCapacity:
    def test_integer_string(self) -> None:
        assert parse_capacity("24") == 24

    def test_integer_value(self) -> None:
        assert parse_capacity(60) == 60

    def test_float_string(self) -> None:
        assert parse_capacity("24.0") == 24

    def test_none_returns_none(self) -> None:
        assert parse_capacity(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert parse_capacity("") is None

    def test_whitespace_only_returns_none(self) -> None:
        assert parse_capacity("   ") is None

    def test_non_numeric_returns_none(self) -> None:
        assert parse_capacity("N/A") is None

    def test_zero(self) -> None:
        assert parse_capacity("0") == 0

    def test_large_capacity(self) -> None:
        assert parse_capacity("200") == 200


class TestParseSecureBeds:
    """parse_secure_beds has the same contract as parse_capacity."""

    def test_integer_string(self) -> None:
        assert parse_secure_beds("12") == 12

    def test_none_returns_none(self) -> None:
        assert parse_secure_beds(None) is None

    def test_empty_returns_none(self) -> None:
        assert parse_secure_beds("") is None


# ── parse_date ────────────────────────────────────────────────────────────────

class TestParseDate:
    def test_datetime_object(self) -> None:
        dt = datetime(2026, 3, 15, 0, 0)
        result = parse_date(dt)
        assert result == date(2026, 3, 15)

    def test_iso_string(self) -> None:
        assert parse_date("2026-01-15") == date(2026, 1, 15)

    def test_us_format_string(self) -> None:
        assert parse_date("01/15/2026") == date(2026, 1, 15)

    def test_datetime_string(self) -> None:
        assert parse_date("2026-01-15 00:00:00") == date(2026, 1, 15)

    def test_none_returns_none(self) -> None:
        assert parse_date(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert parse_date("") is None

    def test_unrecognized_format_returns_none(self) -> None:
        assert parse_date("not-a-date") is None


# ── clean_cell ────────────────────────────────────────────────────────────────

class TestCleanCell:
    def test_strips_whitespace(self) -> None:
        assert clean_cell("  hello  ") == "hello"

    def test_empty_string_becomes_none(self) -> None:
        assert clean_cell("   ") is None

    def test_none_passthrough(self) -> None:
        assert clean_cell(None) is None

    def test_int_passthrough(self) -> None:
        assert clean_cell(42) == 42

    def test_float_passthrough(self) -> None:
        assert clean_cell(3.14) == 3.14

    def test_non_empty_string_unchanged(self) -> None:
        assert clean_cell("Facility Name") == "Facility Name"


# ── slugify ───────────────────────────────────────────────────────────────────

class TestSlugify:
    def test_lowercase(self) -> None:
        assert slugify("HELLO WORLD") == "hello-world"

    def test_special_chars_become_dashes(self) -> None:
        assert slugify("Hello, World!") == "hello-world"

    def test_consecutive_dashes_collapsed(self) -> None:
        assert slugify("A  B") == "a-b"

    def test_leading_trailing_dashes_stripped(self) -> None:
        assert slugify(" -hello- ") == "hello"

    def test_empty_returns_facility(self) -> None:
        assert slugify("") == "facility"

    def test_real_facility_name(self) -> None:
        result = slugify("Rittenhouse Village at Lehigh Valley")
        assert result == "rittenhouse-village-at-lehigh-valley"

    def test_numbers_preserved(self) -> None:
        assert slugify("Facility 123") == "facility-123"


# ── titleize ─────────────────────────────────────────────────────────────────

class TestTitleize:
    def test_basic_titlecase(self) -> None:
        assert titleize("hello world") == "Hello World"

    def test_stop_words_lowercase(self) -> None:
        # "of", "the", "and" etc. are stop words
        assert titleize("facility of the state") == "Facility of the State"

    def test_first_word_always_capitalized(self) -> None:
        # Even stop words are capitalized if first
        assert titleize("the facility") == "The Facility"

    def test_all_caps_input(self) -> None:
        assert titleize("MEMORY CARE COMMUNITY") == "Memory Care Community"

    def test_none_returns_none(self) -> None:
        assert titleize(None) is None

    def test_empty_string_passthrough(self) -> None:
        result = titleize("")
        assert result == "" or result is None

    def test_real_pa_facility(self) -> None:
        result = titleize("CAMBRIDGE VILLAGE PCH")
        assert result == "Cambridge Village Pch"
