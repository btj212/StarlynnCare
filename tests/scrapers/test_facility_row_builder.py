"""
ccld_rcfe_ingest.py — build_facility_row() comprehensive tests.

Tests every output field of build_facility_row() with a representative set
of CKAN rows. Validates:
  • All required DB columns are present and correctly typed
  • Memory care classification logic (explicit, chain, neither, CCRC)
  • Publishable gate (LICENSED + MC signal)
  • City exclusion filter returns None for out-of-county cities
  • Zip/phone normalization
  • Slug stability
  • Transparency API date merge

No DB. No network. Pure function tests on build_facility_row() and classify_facility().
"""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest
from ccld_rcfe_ingest import build_facility_row, classify_facility, pad_license

# ─────────────────────────────────────────────────────────────────────────────
# Fixtures — representative CKAN rows
# ─────────────────────────────────────────────────────────────────────────────

_BASE_CKAN: dict[str, Any] = {
    "facility_number": "100001234",
    "facility_name": "MEMORY CARE AT MAPLE GROVE",
    "facility_address": "123 MAIN ST",
    "facility_city": "OAKLAND",
    "facility_zip": "94601",
    "facility_state": "CA",
    "county_name": "ALAMEDA",
    "facility_telephone_number": "(510) 555-1234",
    "facility_status": "LICENSED",
    "facility_type": "RESIDENTIAL CARE FACILITY FOR THE ELDERLY",
    "facility_capacity": "24",
    "licensee": "MEMORY CARE LLC",
    "facility_administrator": "JANE DOE",
    "license_first_date": "1/1/2010",
}

_CHAIN_ONLY_CKAN: dict[str, Any] = {
    **_BASE_CKAN,
    "facility_name": "BROOKDALE SAN JOSE",
    "licensee": "BROOKDALE SENIOR LIVING",
    "facility_city": "OAKLAND",
    "facility_zip": "94601",
}

_NO_MC_CKAN: dict[str, Any] = {
    **_BASE_CKAN,
    "facility_name": "MAPLE GROVE ASSISTED LIVING",
    "licensee": "SMITH FAMILY LLC",
    "facility_city": "OAKLAND",
    "facility_zip": "94601",
}

_CLOSED_CKAN: dict[str, Any] = {
    **_BASE_CKAN,
    "facility_status": "CLOSED",
}

_CCRC_CKAN: dict[str, Any] = {
    **_BASE_CKAN,
    "facility_name": "GRAND MANOR CONTINUING CARE RETIREMENT COMMUNITY",
    "facility_type": "CONTINUING CARE RETIREMENT COMMUNITY",
    "licensee": "GRAND MANOR LLC",
}

_NULL_CAPACITY_CKAN: dict[str, Any] = {
    **_BASE_CKAN,
    "facility_capacity": None,
}

_FLOAT_CAPACITY_CKAN: dict[str, Any] = {
    **_BASE_CKAN,
    "facility_capacity": "6.0",
}

_NULL_PHONE_CKAN: dict[str, Any] = {
    **_BASE_CKAN,
    "facility_telephone_number": None,
}

_EXCLUDED_CITY_CKAN: dict[str, Any] = {
    **_BASE_CKAN,
    "facility_city": "SAN JOSE",  # In ALAMEDA exclusion list
}

_FLOAT_ZIP_CKAN: dict[str, Any] = {
    **_BASE_CKAN,
    "facility_zip": "94601.0",
}


def _build(ckan: dict, trans: dict | None = None, force: bool = False) -> dict | None:
    return build_facility_row(ckan, trans=trans, force_publish=force, ingest_county="ALAMEDA")


# ─────────────────────────────────────────────────────────────────────────────
# Required output fields — none may be absent
# ─────────────────────────────────────────────────────────────────────────────

REQUIRED_OUTPUT_FIELDS = {
    "state_code", "name", "cms_id", "license_number", "license_type",
    "street", "city", "zip", "city_slug", "slug",
    "beds", "facility_type", "certification_type",
    "operator_name", "management_company", "ownership_type",
    "phone", "website", "cms_star_rating", "last_inspection_date",
    "latitude", "longitude", "source_url",
    "care_category", "serves_memory_care", "memory_care_designation",
    "license_status", "license_expiration", "publishable",
    "mc_signal_explicit_name", "mc_signal_chain_name", "mc_review_status",
}


def test_all_required_fields_present_explicit_mc():
    row = _build(_BASE_CKAN)
    assert row is not None
    missing = REQUIRED_OUTPUT_FIELDS - set(row.keys())
    assert not missing, f"Missing fields: {missing}"


def test_all_required_fields_present_chain_only():
    row = _build(_CHAIN_ONLY_CKAN)
    assert row is not None
    missing = REQUIRED_OUTPUT_FIELDS - set(row.keys())
    assert not missing, f"Missing fields: {missing}"


def test_all_required_fields_present_no_mc():
    row = _build(_NO_MC_CKAN)
    assert row is not None
    missing = REQUIRED_OUTPUT_FIELDS - set(row.keys())
    assert not missing, f"Missing fields: {missing}"


# ─────────────────────────────────────────────────────────────────────────────
# state_code, facility_type, certification_type — constants
# ─────────────────────────────────────────────────────────────────────────────


def test_state_code_is_ca():
    assert _build(_BASE_CKAN)["state_code"] == "CA"


def test_facility_type_is_rcfe():
    assert _build(_BASE_CKAN)["facility_type"] == "rcfe"


def test_certification_type_is_state():
    assert _build(_BASE_CKAN)["certification_type"] == "state"


def test_cms_id_is_none():
    assert _build(_BASE_CKAN)["cms_id"] is None


def test_ownership_type_is_none():
    """CA RCFE data has no ownership_type field."""
    assert _build(_BASE_CKAN)["ownership_type"] is None


def test_website_is_none():
    assert _build(_BASE_CKAN)["website"] is None


def test_cms_star_rating_is_none():
    assert _build(_BASE_CKAN)["cms_star_rating"] is None


def test_latitude_is_none():
    assert _build(_BASE_CKAN)["latitude"] is None


def test_longitude_is_none():
    assert _build(_BASE_CKAN)["longitude"] is None


def test_license_expiration_is_none():
    assert _build(_BASE_CKAN)["license_expiration"] is None


# ─────────────────────────────────────────────────────────────────────────────
# name — titleized from raw CKAN uppercase
# ─────────────────────────────────────────────────────────────────────────────


def test_name_is_titleized():
    row = _build(_BASE_CKAN)
    assert row["name"] == "Memory Care at Maple Grove"


def test_name_is_nonempty_string():
    row = _build(_BASE_CKAN)
    assert isinstance(row["name"], str) and row["name"].strip()


def test_operator_name_is_titleized():
    row = _build(_BASE_CKAN)
    assert row["operator_name"] == "Memory Care Llc"


# ─────────────────────────────────────────────────────────────────────────────
# license_number — zero-padded to 9 digits
# ─────────────────────────────────────────────────────────────────────────────


def test_license_number_is_9_digits():
    row = _build(_BASE_CKAN)
    assert len(row["license_number"]) == 9


def test_license_number_is_all_digits():
    row = _build(_BASE_CKAN)
    assert row["license_number"].isdigit()


def test_license_number_matches_pad_license():
    row = _build(_BASE_CKAN)
    expected = pad_license(_BASE_CKAN["facility_number"])
    assert row["license_number"] == expected


# ─────────────────────────────────────────────────────────────────────────────
# slug and city_slug
# ─────────────────────────────────────────────────────────────────────────────


def test_city_slug_is_lowercase():
    row = _build(_BASE_CKAN)
    assert row["city_slug"] == row["city_slug"].lower()


def test_city_slug_no_spaces():
    row = _build(_BASE_CKAN)
    assert " " not in row["city_slug"]


def test_slug_is_lowercase():
    row = _build(_BASE_CKAN)
    assert row["slug"] == row["slug"].lower()


def test_slug_no_spaces():
    row = _build(_BASE_CKAN)
    assert " " not in row["slug"]


def test_slug_is_stable():
    row1 = _build(_BASE_CKAN)
    row2 = _build(_BASE_CKAN)
    assert row1["slug"] == row2["slug"]


# ─────────────────────────────────────────────────────────────────────────────
# beds
# ─────────────────────────────────────────────────────────────────────────────


def test_beds_parsed_from_string():
    row = _build(_BASE_CKAN)  # facility_capacity = "24"
    assert row["beds"] == 24


def test_beds_parsed_from_float_string():
    row = _build(_FLOAT_CAPACITY_CKAN)  # "6.0"
    assert row["beds"] == 6


def test_beds_is_none_when_null():
    row = _build(_NULL_CAPACITY_CKAN)
    assert row["beds"] is None


def test_beds_is_int_when_present():
    row = _build(_BASE_CKAN)
    assert isinstance(row["beds"], int)


# ─────────────────────────────────────────────────────────────────────────────
# zip
# ─────────────────────────────────────────────────────────────────────────────


def test_zip_is_5_digit_string():
    row = _build(_BASE_CKAN)
    assert isinstance(row["zip"], str)
    assert len(row["zip"]) == 5
    assert row["zip"].isdigit()


def test_zip_from_float_string():
    row = _build(_FLOAT_ZIP_CKAN)
    assert row["zip"] == "94601"


# ─────────────────────────────────────────────────────────────────────────────
# phone
# ─────────────────────────────────────────────────────────────────────────────


def test_phone_is_string_when_present():
    row = _build(_BASE_CKAN)
    assert isinstance(row["phone"], str) and row["phone"].strip()


def test_phone_is_none_when_null():
    row = _build(_NULL_PHONE_CKAN)
    assert row["phone"] is None


# ─────────────────────────────────────────────────────────────────────────────
# source_url
# ─────────────────────────────────────────────────────────────────────────────


def test_source_url_contains_license_number():
    row = _build(_BASE_CKAN)
    assert row["license_number"] in row["source_url"]


def test_source_url_is_cdss_domain():
    row = _build(_BASE_CKAN)
    assert "ccld.dss.ca.gov" in row["source_url"]


# ─────────────────────────────────────────────────────────────────────────────
# Memory care classification — explicit MC
# ─────────────────────────────────────────────────────────────────────────────


def test_explicit_mc_sets_care_category_rcfe_memory_care():
    row = _build(_BASE_CKAN)  # name has "MEMORY CARE"
    assert row["care_category"] == "rcfe_memory_care"


def test_explicit_mc_sets_mc_signal_explicit_name_true():
    row = _build(_BASE_CKAN)
    assert row["mc_signal_explicit_name"] is True


def test_explicit_mc_sets_serves_memory_care_true():
    row = _build(_BASE_CKAN)
    assert row["serves_memory_care"] is True


def test_explicit_mc_sets_mc_review_status_auto_published():
    row = _build(_BASE_CKAN)
    assert row["mc_review_status"] == "auto_published"


def test_explicit_mc_licensed_is_publishable():
    row = _build(_BASE_CKAN)  # LICENSED + explicit
    assert row["publishable"] is True


# ─────────────────────────────────────────────────────────────────────────────
# Memory care classification — chain only
# ─────────────────────────────────────────────────────────────────────────────


def test_chain_only_sets_care_category_rcfe_general():
    row = _build(_CHAIN_ONLY_CKAN)
    assert row["care_category"] == "rcfe_general"


def test_chain_only_sets_mc_signal_chain_name_true():
    row = _build(_CHAIN_ONLY_CKAN)
    assert row["mc_signal_chain_name"] is True


def test_chain_only_sets_mc_signal_explicit_name_false():
    row = _build(_CHAIN_ONLY_CKAN)
    assert row["mc_signal_explicit_name"] is False


def test_chain_only_sets_mc_review_status_needs_review():
    row = _build(_CHAIN_ONLY_CKAN)
    assert row["mc_review_status"] == "needs_review"


def test_chain_only_licensed_is_publishable():
    row = _build(_CHAIN_ONLY_CKAN)
    # chain_match → serves_memory_care=True, so publishable=True for LICENSED
    assert row["publishable"] is True


# ─────────────────────────────────────────────────────────────────────────────
# Memory care classification — no MC signal
# ─────────────────────────────────────────────────────────────────────────────


def test_no_mc_sets_care_category_rcfe_general():
    row = _build(_NO_MC_CKAN)
    assert row["care_category"] == "rcfe_general"


def test_no_mc_sets_explicit_false():
    row = _build(_NO_MC_CKAN)
    assert row["mc_signal_explicit_name"] is False


def test_no_mc_sets_chain_false():
    row = _build(_NO_MC_CKAN)
    assert row["mc_signal_chain_name"] is False


def test_no_mc_licensed_is_not_publishable():
    row = _build(_NO_MC_CKAN)
    assert row["publishable"] is False


# ─────────────────────────────────────────────────────────────────────────────
# CLOSED facility — never publishable
# ─────────────────────────────────────────────────────────────────────────────


def test_closed_mc_facility_not_publishable():
    row = _build(_CLOSED_CKAN)
    assert row["publishable"] is False


def test_closed_license_status_preserved():
    row = _build(_CLOSED_CKAN)
    assert row["license_status"] == "CLOSED"


# ─────────────────────────────────────────────────────────────────────────────
# CCRC — continuing care retirement community
# ─────────────────────────────────────────────────────────────────────────────


def test_ccrc_sets_care_category_ccrc():
    row = _build(_CCRC_CKAN)
    assert row["care_category"] == "ccrc"


# ─────────────────────────────────────────────────────────────────────────────
# City exclusion filter
# ─────────────────────────────────────────────────────────────────────────────


def test_excluded_city_returns_none():
    result = _build(_EXCLUDED_CITY_CKAN, ingest_county="ALAMEDA")
    assert result is None, (
        "build_facility_row() should return None for cities in the ALAMEDA exclusion list"
    )


def _build(ckan, trans=None, force=False, ingest_county="ALAMEDA"):  # noqa: F811
    return build_facility_row(ckan, trans=trans, force_publish=force, ingest_county=ingest_county)


# ─────────────────────────────────────────────────────────────────────────────
# Transparency API date merge
# ─────────────────────────────────────────────────────────────────────────────


def test_last_inspection_date_from_transparency():
    trans = {"FacilityNumber": "100001234", "LastVisitDate": "6/15/2023"}
    row = _build(_BASE_CKAN, trans=trans)
    assert row["last_inspection_date"] == date(2023, 6, 15)


def test_last_inspection_date_none_when_no_transparency():
    row = _build(_BASE_CKAN, trans=None)
    assert row["last_inspection_date"] is None


def test_last_inspection_date_none_when_transparency_missing_field():
    trans = {"FacilityNumber": "100001234"}  # No LastVisitDate
    row = _build(_BASE_CKAN, trans=trans)
    assert row["last_inspection_date"] is None


# ─────────────────────────────────────────────────────────────────────────────
# force_publish flag
# ─────────────────────────────────────────────────────────────────────────────


def test_force_publish_makes_no_mc_facility_publishable():
    row = _build(_NO_MC_CKAN, force=True)
    assert row["publishable"] is True


def test_force_publish_sets_mc_review_status_auto_published():
    row = _build(_NO_MC_CKAN, force=True)
    assert row["mc_review_status"] == "auto_published"


def test_force_publish_closed_facility_not_publishable():
    """force_publish does NOT override CLOSED status."""
    row = _build(_CLOSED_CKAN, force=True)
    assert row["publishable"] is False


# ─────────────────────────────────────────────────────────────────────────────
# classify_facility() — internal helper
# ─────────────────────────────────────────────────────────────────────────────


def test_classify_facility_returns_4_tuple():
    result = classify_facility(_BASE_CKAN)
    assert isinstance(result, tuple) and len(result) == 4


def test_classify_facility_explicit_mc_care_category():
    care_cat, _, explicit, chain = classify_facility(_BASE_CKAN)
    assert care_cat == "rcfe_memory_care"
    assert explicit is True


def test_classify_facility_chain_only():
    care_cat, _, explicit, chain = classify_facility(_CHAIN_ONLY_CKAN)
    assert care_cat == "rcfe_general"
    assert chain is True
    assert explicit is False


def test_classify_facility_ccrc_type():
    care_cat, designation, _, _ = classify_facility(_CCRC_CKAN)
    assert care_cat == "ccrc"
    assert designation is not None
    assert "CCRC" in designation


def test_classify_facility_no_mc():
    care_cat, designation, explicit, chain = classify_facility(_NO_MC_CKAN)
    assert care_cat == "rcfe_general"
    assert explicit is False
    assert chain is False
    assert designation is None
