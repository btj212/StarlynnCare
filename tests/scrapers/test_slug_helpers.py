"""
ccld_rcfe_ingest.py — slug/name normalization helpers.

Tests every function that transforms raw CKAN strings into the DB keys
that drive URL routing and upsert deduplication:
  • slugify()
  • slugify_city()  (includes alias correction)
  • titleize()
  • pad_license()
  • facility_slug()
  • parse_date_cdss()

All are pure functions — no DB, no network.
"""

from __future__ import annotations

from datetime import date

import pytest
from ccld_rcfe_ingest import (
    facility_slug,
    pad_license,
    parse_date_cdss,
    slugify,
    slugify_city,
    titleize,
)


# ─────────────────────────────────────────────────────────────────────────────
# slugify()
# ─────────────────────────────────────────────────────────────────────────────


def test_slugify_lowercases():
    assert slugify("MEMORY CARE") == "memory-care"


def test_slugify_replaces_spaces_with_hyphens():
    assert slugify("Memory Care Center") == "memory-care-center"


def test_slugify_replaces_special_chars():
    assert slugify("St. Patrick's Home") == "st-patrick-s-home"


def test_slugify_collapses_multiple_separators():
    assert slugify("Memory  Care---Center") == "memory-care-center"


def test_slugify_strips_leading_trailing_hyphens():
    assert slugify("--Memory Care--") == "memory-care"


def test_slugify_handles_empty_string():
    assert slugify("") == "facility"


def test_slugify_handles_only_special_chars():
    result = slugify("!@#$%")
    assert result == "facility"


def test_slugify_preserves_numbers():
    assert slugify("Route 66 Senior Center") == "route-66-senior-center"


def test_slugify_unicode_chars_become_hyphens():
    # Non-ASCII chars get replaced with hyphens
    result = slugify("Café Senior Living")
    assert "caf" in result  # 'é' → '-', so 'caf' + '-' remains
    assert " " not in result
    assert "--" not in result


def test_slugify_ampersand_becomes_hyphen():
    assert slugify("Health & Care") == "health-care"


# ─────────────────────────────────────────────────────────────────────────────
# slugify_city()
# ─────────────────────────────────────────────────────────────────────────────


def test_slugify_city_basic():
    assert slugify_city("Oakland") == "oakland"


def test_slugify_city_multi_word():
    assert slugify_city("San Francisco") == "san-francisco"


def test_slugify_city_corrects_known_alias():
    """CKAN has a persistent typo 'Cirtus Heights' → must become 'citrus-heights'."""
    assert slugify_city("Cirtus Heights") == "citrus-heights"


def test_slugify_city_correct_spelling_unchanged():
    assert slugify_city("Citrus Heights") == "citrus-heights"


def test_slugify_city_uppercase_input():
    assert slugify_city("ALAMEDA") == "alameda"


def test_slugify_city_mixed_case():
    assert slugify_city("Castro Valley") == "castro-valley"


def test_slugify_city_punctuation():
    assert slugify_city("St. Helena") == "st-helena"


# ─────────────────────────────────────────────────────────────────────────────
# titleize()
# ─────────────────────────────────────────────────────────────────────────────


def test_titleize_basic_uppercase_input():
    assert titleize("MEMORY CARE CENTER") == "Memory Care Center"


def test_titleize_stop_words_lowercase():
    """Prepositions and articles in non-initial positions are lowercase."""
    result = titleize("CARE OF THE ELDERLY")
    assert result == "Care of the Elderly"


def test_titleize_stop_words_at_start_are_capitalized():
    """First word is always capitalized even if it's a stop word."""
    result = titleize("THE MEMORY CARE CENTER")
    assert result.startswith("The ")


def test_titleize_preserves_multi_word_stop_combos():
    result = titleize("SUNRISE OF POWAY")
    assert result == "Sunrise of Poway"


def test_titleize_handles_de_del_etc():
    result = titleize("CASA DE LOS ANGELES")
    # 'de', 'los' are stop words → lowercase after first word
    assert "de" in result.lower()
    assert result.startswith("Casa")


def test_titleize_handles_empty_string():
    assert titleize("") == ""


def test_titleize_single_word():
    assert titleize("SILVERADO") == "Silverado"


def test_titleize_already_titlecase():
    result = titleize("Memory Care Center")
    assert result == "Memory Care Center"


def test_titleize_ampersand_preserved():
    result = titleize("HEALTH & CARE LLC")
    assert "&" in result


def test_titleize_returns_string():
    assert isinstance(titleize("MEMORY CARE"), str)


# ─────────────────────────────────────────────────────────────────────────────
# pad_license()
# ─────────────────────────────────────────────────────────────────────────────


def test_pad_license_pads_short_number():
    assert pad_license("123456") == "000123456"


def test_pad_license_9_digit_number_unchanged():
    assert pad_license("123456789") == "123456789"


def test_pad_license_integer_input():
    assert pad_license(123456) == "000123456"


def test_pad_license_float_string():
    """CKAN stores facility_number as float string e.g. '100001234.0'"""
    assert pad_license("100001234.0") == "100001234"


def test_pad_license_leading_zeros_preserved():
    assert pad_license(1) == "000000001"


def test_pad_license_exactly_9_digits():
    assert len(pad_license("123456789")) == 9


def test_pad_license_result_is_all_digits():
    result = pad_license("12345")
    assert result.isdigit(), f"pad_license result {result!r} contains non-digit characters"


def test_pad_license_result_is_string():
    assert isinstance(pad_license(123456789), str)


def test_pad_license_large_number_unchanged():
    result = pad_license(999999999)
    assert result == "999999999"


# ─────────────────────────────────────────────────────────────────────────────
# facility_slug()
# ─────────────────────────────────────────────────────────────────────────────


def test_facility_slug_contains_name_part():
    slug = facility_slug("Memory Care Center", "123456789")
    assert "memory-care-center" in slug


def test_facility_slug_contains_license_suffix():
    slug = facility_slug("Memory Care Center", "123456789")
    # Last 6 digits of "123456789" are "456789", stripped of leading zeros
    assert slug.endswith("-456789")


def test_facility_slug_is_lowercase():
    slug = facility_slug("MEMORY CARE CENTER", "123456789")
    assert slug == slug.lower()


def test_facility_slug_no_spaces():
    slug = facility_slug("Memory Care Center", "123456789")
    assert " " not in slug


def test_facility_slug_is_url_safe():
    slug = facility_slug("St. Patrick's Home", "000111222")
    # Should only contain lowercase letters, digits, hyphens
    import re
    assert re.match(r"^[a-z0-9-]+$", slug), f"Slug {slug!r} contains URL-unsafe characters"


def test_facility_slug_stable_for_same_inputs():
    slug1 = facility_slug("Memory Care Center", "123456789")
    slug2 = facility_slug("Memory Care Center", "123456789")
    assert slug1 == slug2


def test_facility_slug_different_names_different_slugs():
    slug1 = facility_slug("Memory Care Center", "123456789")
    slug2 = facility_slug("Alzheimer Care Center", "123456789")
    assert slug1 != slug2


def test_facility_slug_license_suffix_strips_leading_zeros():
    # License "000000001" → last 6 = "000001" → stripped = "1"
    slug = facility_slug("Test Facility", "000000001")
    assert slug.endswith("-1")


def test_facility_slug_license_suffix_all_zeros_fallback():
    # When the last-6 stripped is empty, use last 2 chars
    slug = facility_slug("Test Facility", "000000000")
    assert "-" in slug  # Must have a suffix separator


# ─────────────────────────────────────────────────────────────────────────────
# parse_date_cdss()
# ─────────────────────────────────────────────────────────────────────────────


def test_parse_date_cdss_m_d_yyyy():
    d = parse_date_cdss("1/15/2023")
    assert d == date(2023, 1, 15)


def test_parse_date_cdss_mm_dd_yyyy():
    d = parse_date_cdss("12/31/2022")
    assert d == date(2022, 12, 31)


def test_parse_date_cdss_iso_format():
    d = parse_date_cdss("2023-06-15")
    assert d == date(2023, 6, 15)


def test_parse_date_cdss_iso_datetime():
    d = parse_date_cdss("2023-06-15T00:00:00")
    assert d == date(2023, 6, 15)


def test_parse_date_cdss_none_input():
    assert parse_date_cdss(None) is None


def test_parse_date_cdss_empty_string():
    assert parse_date_cdss("") is None


def test_parse_date_cdss_none_string():
    assert parse_date_cdss("None") is None


def test_parse_date_cdss_returns_date_type():
    d = parse_date_cdss("1/15/2023")
    assert isinstance(d, date)


def test_parse_date_cdss_year_is_plausible():
    d = parse_date_cdss("6/1/2020")
    assert d is not None
    assert 1990 <= d.year <= 2030


def test_parse_date_cdss_invalid_string_returns_none():
    assert parse_date_cdss("not-a-date") is None


def test_parse_date_cdss_whitespace_string():
    assert parse_date_cdss("   ") is None
