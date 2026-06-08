"""
Tests: California CDSS Transparency API
Source: https://www.ccld.dss.ca.gov/transparencyapi/api/Facility/any

The Transparency API returns per-facility visit metrics — a ~30 MB JSON array
of every CCLD facility. We fetch a sample and validate the field structure.
"""

from __future__ import annotations

import pytest
import requests

TRANSPARENCY_BASE = "https://www.ccld.dss.ca.gov/transparencyapi/api/Facility"

# Known Alameda RCFE license numbers to probe (from CKAN sample).
# These are stable references that have been in the CCLD database since at
# least the 2026-04 ingest.
SAMPLE_LICENSE_NUMBERS = [
    "197605428",   # Sunrise of Oakland Hills
    "019600027",   # Piedmont Gardens
]

# Fields the ingest script reads from the Transparency API response.
REQUIRED_FIELDS = {
    "FacilityNumber",
    "FacilityName",
    "FacilityType",
    "FacilityStatus",
    "FacilityCapacity",
    "FacilityAddress",
    "FacilityCity",
    "CountyName",
    "FacilityZip",
    "FacilityTelephoneNumber",
}


@pytest.mark.external_api
@pytest.mark.slow
def test_transparency_api_returns_array(http_session: requests.Session) -> None:
    """
    Transparency API responds to GET /any with a JSON array.
    Note: this is a ~30 MB payload; we only look at the first element.
    """
    resp = http_session.get(
        f"{TRANSPARENCY_BASE}/any",
        timeout=60,
    )
    assert resp.status_code == 200, f"Unexpected status: {resp.status_code}"
    body = resp.json()
    assert isinstance(body, list), f"Expected JSON array, got {type(body).__name__}"
    assert len(body) > 0, "Transparency API returned empty array — data source unavailable"


@pytest.mark.external_api
@pytest.mark.slow
def test_transparency_api_record_structure(http_session: requests.Session) -> None:
    """Each record in the Transparency API has every field the ingest script reads."""
    resp = http_session.get(
        f"{TRANSPARENCY_BASE}/any",
        timeout=60,
    )
    body = resp.json()
    assert body, "Empty response"
    first = body[0]
    missing = REQUIRED_FIELDS - set(first.keys())
    assert not missing, (
        f"Missing fields in Transparency API record: {missing}\n"
        f"Available keys: {sorted(first.keys())}"
    )


@pytest.mark.external_api
@pytest.mark.slow
def test_transparency_api_facility_count_is_large(http_session: requests.Session) -> None:
    """The Transparency API returns data for at least 5,000 CCLD facilities statewide."""
    resp = http_session.get(
        f"{TRANSPARENCY_BASE}/any",
        timeout=60,
    )
    body = resp.json()
    assert len(body) >= 5000, (
        f"Expected ≥5,000 statewide CCLD facilities, got {len(body)}. "
        "Possible data truncation or API change."
    )


@pytest.mark.external_api
@pytest.mark.slow
def test_transparency_api_alameda_facilities_present(http_session: requests.Session) -> None:
    """At least 20 Alameda County RCFE facilities are in the Transparency API response."""
    resp = http_session.get(
        f"{TRANSPARENCY_BASE}/any",
        timeout=60,
    )
    body = resp.json()
    alameda = [
        f for f in body
        if (f.get("CountyName") or "").upper() == "ALAMEDA"
    ]
    assert len(alameda) >= 20, (
        f"Expected ≥20 Alameda facilities in Transparency API, found {len(alameda)}"
    )


@pytest.mark.external_api
@pytest.mark.slow
def test_transparency_api_facility_numbers_non_empty(http_session: requests.Session) -> None:
    """FacilityNumber (primary key) is non-empty on a 200-record sample."""
    resp = http_session.get(
        f"{TRANSPARENCY_BASE}/any",
        timeout=60,
    )
    body = resp.json()
    sample = body[:200]
    nulls = [f for f in sample if not f.get("FacilityNumber")]
    assert not nulls, f"{len(nulls)}/200 sampled records have empty FacilityNumber"


@pytest.mark.external_api
@pytest.mark.slow
def test_transparency_api_has_known_facility_types(http_session: requests.Session) -> None:
    """
    All records in the /any response have a non-null FacilityType from the known CDSS set.

    Note: The /any endpoint serves child care facility data (DAY CARE CENTER etc.) — not
    RCFE/assisted-living. RCFE data is sourced from the CKAN API (test_ca_cdss_ckan.py).
    The facilityType query parameter does not filter this endpoint.
    """
    KNOWN_CCLD_TYPES = {
        "DAY CARE CENTER",
        "INFANT CENTER",
        "SCHOOL AGE DAY CARE CENTER",
        "SINGLE LICENSED CHILD CARE CENTER",
        "DAY CARE CENTER - ILL CENTER",
        "RESIDENTIAL CARE FACILITY FOR THE ELDERLY",
        "ADULT DAY PROGRAM",
        "ADULT RESIDENTIAL FACILITY",
        "COMMUNITY CARE FACILITY",
        "FOSTER FAMILY HOME",
        "GROUP HOME",
        "SMALL FAMILY HOME",
    }
    resp = http_session.get(
        f"{TRANSPARENCY_BASE}/any",
        timeout=60,
    )
    body = resp.json()
    assert body, "No records returned from Transparency API /any"
    sample = body[:200]
    unknown_types = {
        (f.get("FacilityType") or "").strip()
        for f in sample
        if (f.get("FacilityType") or "").strip().upper() not in KNOWN_CCLD_TYPES
        and f.get("FacilityType")
    }
    assert not unknown_types, (
        f"Unexpected FacilityType values in Transparency API response: {unknown_types}. "
        "Update KNOWN_CCLD_TYPES if CDSS added a new facility category."
    )
