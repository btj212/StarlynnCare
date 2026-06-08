"""
Tests: California CDSS CKAN API (Open Data)
Source: https://data.ca.gov/dataset/community-care-licensing-facilities
Resource ID: 6b2f5818-f60d-40b5-bc2a-94f995f9f8b0

Verifies every field the ingest script reads, for a small sample of records.

Note: This CKAN instance returns lowercase snake_case field names (not uppercase).
Filters must also use lowercase key names, e.g. {"county_name": "ALAMEDA"}.
"""

from __future__ import annotations

import json

import pytest
import requests

CKAN_BASE = "https://data.ca.gov/api/3/action/datastore_search"
RESOURCE_ID = "6b2f5818-f60d-40b5-bc2a-94f995f9f8b0"

# Complete set of columns expected in each RCFE record.
# Derived from ccld_rcfe_ingest.py — any column the script reads must be here.
# Field names are lowercase snake_case as returned by data.ca.gov CKAN.
REQUIRED_COLUMNS = {
    "facility_number",        # license number used as primary key
    "facility_name",          # display name
    "licensee",               # legal entity / operator
    "facility_city",          # mailing city
    "county_name",            # for geographic scoping
    "facility_zip",           # zip code
    "facility_type",          # e.g. "RESIDENTIAL CARE FACILITY FOR THE ELDERLY"
    "facility_capacity",      # integer beds
    "facility_status",        # "LICENSED" / "CLOSED" / etc.
    "facility_address",       # street address
    "facility_telephone_number",  # phone number
    "regional_office",        # CDSS district office
}


@pytest.mark.external_api
def test_ckan_api_responds(http_session: requests.Session) -> None:
    """CKAN API returns HTTP 200 for a minimal query."""
    resp = http_session.get(
        CKAN_BASE,
        params={"resource_id": RESOURCE_ID, "limit": 1},
        timeout=30,
    )
    assert resp.status_code == 200, f"Unexpected status: {resp.status_code}"


@pytest.mark.external_api
def test_ckan_response_structure(http_session: requests.Session) -> None:
    """Top-level response has 'result' with 'records' and 'total'."""
    resp = http_session.get(
        CKAN_BASE,
        params={"resource_id": RESOURCE_ID, "limit": 1},
        timeout=30,
    )
    body = resp.json()
    assert body.get("success") is True, f"CKAN reported failure: {body.get('error')}"
    assert "result" in body, "Missing 'result' key in CKAN response"
    result = body["result"]
    assert "records" in result, "Missing 'result.records' in CKAN response"
    assert "total" in result, "Missing 'result.total' in CKAN response"
    assert isinstance(result["total"], int), "'total' is not an int"
    assert result["total"] > 0, "Zero RCFE records returned — data source may be unavailable"


@pytest.mark.external_api
def test_ckan_alameda_county_filter_returns_records(http_session: requests.Session) -> None:
    """Filtering by county_name=ALAMEDA returns at least 20 facilities."""
    resp = http_session.get(
        CKAN_BASE,
        params={
            "resource_id": RESOURCE_ID,
            "filters": json.dumps({"county_name": "ALAMEDA"}),
            "limit": 50,
        },
        timeout=30,
    )
    assert resp.status_code == 200
    result = resp.json()["result"]
    assert result["total"] >= 20, (
        f"Expected ≥20 Alameda RCFE records, got {result['total']}"
    )


@pytest.mark.external_api
def test_ckan_record_has_all_required_columns(http_session: requests.Session) -> None:
    """Every required column is present on each record in a 25-record sample."""
    resp = http_session.get(
        CKAN_BASE,
        params={
            "resource_id": RESOURCE_ID,
            "filters": json.dumps({"county_name": "ALAMEDA"}),
            "limit": 25,
        },
        timeout=30,
    )
    records = resp.json()["result"]["records"]
    assert records, "No records returned"
    for record in records:
        missing = REQUIRED_COLUMNS - set(record.keys())
        assert not missing, f"Record missing columns: {missing}\nRecord keys: {set(record.keys())}"


@pytest.mark.external_api
def test_ckan_facility_number_is_non_empty(http_session: requests.Session) -> None:
    """facility_number (primary key) is non-null and non-empty on all sampled records."""
    resp = http_session.get(
        CKAN_BASE,
        params={
            "resource_id": RESOURCE_ID,
            "filters": json.dumps({"county_name": "ALAMEDA"}),
            "limit": 50,
        },
        timeout=30,
    )
    records = resp.json()["result"]["records"]
    nulls = [r for r in records if not r.get("facility_number")]
    assert not nulls, f"{len(nulls)} records have empty facility_number"


@pytest.mark.external_api
def test_ckan_facility_name_is_non_empty(http_session: requests.Session) -> None:
    """facility_name is non-null on all sampled records."""
    resp = http_session.get(
        CKAN_BASE,
        params={
            "resource_id": RESOURCE_ID,
            "filters": json.dumps({"county_name": "ALAMEDA"}),
            "limit": 50,
        },
        timeout=30,
    )
    records = resp.json()["result"]["records"]
    nulls = [r for r in records if not r.get("facility_name")]
    assert not nulls, f"{len(nulls)} records have empty facility_name"


@pytest.mark.external_api
def test_ckan_capacity_is_numeric_where_present(http_session: requests.Session) -> None:
    """facility_capacity is numeric (or null) — never a free-form string that would break int() cast."""
    resp = http_session.get(
        CKAN_BASE,
        params={
            "resource_id": RESOURCE_ID,
            "filters": json.dumps({"county_name": "ALAMEDA"}),
            "limit": 100,
        },
        timeout=30,
    )
    records = resp.json()["result"]["records"]
    bad = []
    for r in records:
        cap = r.get("facility_capacity")
        if cap is None or str(cap).strip() == "":
            continue
        try:
            int(float(str(cap)))
        except (ValueError, TypeError):
            bad.append((r.get("facility_number"), cap))
    assert not bad, f"Non-numeric facility_capacity values: {bad[:5]}"


@pytest.mark.external_api
def test_ckan_facility_status_is_known_value(http_session: requests.Session) -> None:
    """facility_status values are from the expected domain (no unexpected states)."""
    known_statuses = {
        "LICENSED",
        "CLOSED",
        "PENDING",
        "REVOKED",
        "SURRENDERED",
        "SUSPENDED",
        "PROVISIONAL",
    }
    resp = http_session.get(
        CKAN_BASE,
        params={
            "resource_id": RESOURCE_ID,
            "filters": json.dumps({"county_name": "ALAMEDA"}),
            "limit": 100,
        },
        timeout=30,
    )
    records = resp.json()["result"]["records"]
    unknown = {
        r.get("facility_status", "").upper()
        for r in records
        if r.get("facility_status", "").upper() not in known_statuses
        and r.get("facility_status")
    }
    assert not unknown, (
        f"Unexpected facility_status values: {unknown}. "
        "Update known_statuses set if CDSS added new states."
    )


@pytest.mark.external_api
def test_ckan_at_least_one_rcfe_memory_care_facility(http_session: requests.Session) -> None:
    """At least one Alameda RCFE has 'MEMORY' or 'DEMENTIA' in its name."""
    resp = http_session.get(
        CKAN_BASE,
        params={
            "resource_id": RESOURCE_ID,
            "filters": json.dumps({"county_name": "ALAMEDA"}),
            "limit": 500,
        },
        timeout=30,
    )
    records = resp.json()["result"]["records"]
    mc_facilities = [
        r for r in records
        if any(
            kw in (r.get("facility_name") or "").upper()
            for kw in ("MEMORY", "DEMENTIA", "ALZHEIMER")
        )
    ]
    assert mc_facilities, (
        "No Alameda RCFE facilities with memory-care keywords found. "
        "Check if the CKAN data is stale or the filter changed."
    )
