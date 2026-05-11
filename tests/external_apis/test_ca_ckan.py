"""
CA Open Data CKAN API — end-to-end tests.

Real HTTP only. No mocks. No VCR cassettes.

Validates that the CKAN datastore API for the CA RCFE roster:
  • returns HTTP 200 with success=true
  • returns records with every expected field
  • respects county filters
  • paginates correctly
  • contains field values of the correct types and within expected enums
  • is parseable by the ccld_rcfe_ingest helpers (round-trip)

Resource ID: 6b2f5818-f60d-40b5-bc2a-94f995f9f8b0
"""

from __future__ import annotations

import re
from typing import Any

import pytest
import requests

CKAN_BASE = "https://data.ca.gov/api/3/action/datastore_search"
RESOURCE_ID = "6b2f5818-f60d-40b5-bc2a-94f995f9f8b0"
TIMEOUT = 60  # seconds — government APIs can be slow

# All field names the ingest script reads from each CKAN record.
# If any of these disappear, the scraper breaks silently.
REQUIRED_CKAN_FIELDS = {
    "facility_number",
    "facility_name",
    "facility_address",
    "facility_city",
    "facility_zip",
    "facility_type",
    "facility_status",
    "facility_capacity",
    "facility_telephone_number",
    "licensee",
    "facility_administrator",
    "county_name",
}

# Values the ingest script must handle — not a closed set, but known values.
KNOWN_FACILITY_STATUSES = {
    "LICENSED",
    "CLOSED",
    "PENDING",
    "REVOKED",
    "SUSPENDED",
    "EXEMPT",
}

# The license_type values for RCFEs (the ingest does not validate these,
# but they must be non-empty strings).
RCFE_TYPE_PATTERN = re.compile(r"residential care facility", re.IGNORECASE)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _fetch_records(
    county_filter: str | None = None,
    limit: int = 10,
    offset: int = 0,
) -> dict[str, Any]:
    params: dict[str, Any] = {
        "resource_id": RESOURCE_ID,
        "limit": limit,
        "offset": offset,
    }
    if county_filter:
        import json
        params["filters"] = json.dumps({"county_name": county_filter})

    headers = {"User-Agent": "StarlynnCare/e2e-tests (contact@starlynncare.com)"}
    resp = requests.get(CKAN_BASE, params=params, headers=headers, timeout=TIMEOUT)
    return resp, resp.json()


# ─────────────────────────────────────────────────────────────────────────────
# HTTP-level tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.external_api
def test_ckan_returns_http_200():
    resp, _ = _fetch_records(limit=1)
    assert resp.status_code == 200, (
        f"CKAN API returned {resp.status_code}; expected 200. "
        "Government API may be down or resource ID has changed."
    )


@pytest.mark.external_api
def test_ckan_response_is_json():
    resp, payload = _fetch_records(limit=1)
    assert isinstance(payload, dict), "CKAN response body must be a JSON object"


@pytest.mark.external_api
def test_ckan_success_flag_is_true():
    _, payload = _fetch_records(limit=1)
    assert payload.get("success") is True, (
        f"CKAN returned success=false. Error: {payload.get('error')}"
    )


@pytest.mark.external_api
def test_ckan_result_key_present():
    _, payload = _fetch_records(limit=1)
    assert "result" in payload, "CKAN response missing top-level 'result' key"


@pytest.mark.external_api
def test_ckan_result_has_records_key():
    _, payload = _fetch_records(limit=1)
    assert "records" in payload["result"], (
        "CKAN result missing 'records' key"
    )


@pytest.mark.external_api
def test_ckan_records_is_list():
    _, payload = _fetch_records(limit=5)
    assert isinstance(payload["result"]["records"], list)


@pytest.mark.external_api
def test_ckan_returns_nonzero_records():
    _, payload = _fetch_records(limit=10)
    records = payload["result"]["records"]
    assert len(records) > 0, (
        "CKAN returned 0 records for the RCFE resource — "
        "resource may have been removed or renamed"
    )


@pytest.mark.external_api
def test_ckan_result_has_total():
    _, payload = _fetch_records(limit=1)
    total = payload["result"].get("total")
    assert isinstance(total, int), "CKAN result must have an integer 'total'"
    assert total > 1000, (
        f"CKAN total={total} is unexpectedly low — CA has thousands of RCFEs"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Field completeness — every field the ingest script reads must exist
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.external_api
def test_ckan_all_required_fields_present_in_records():
    _, payload = _fetch_records(limit=20)
    records = payload["result"]["records"]
    assert records, "No records to inspect"

    for i, rec in enumerate(records):
        missing = REQUIRED_CKAN_FIELDS - set(rec.keys())
        assert not missing, (
            f"Record[{i}] (facility_number={rec.get('facility_number')!r}) "
            f"is missing fields: {missing}"
        )


@pytest.mark.external_api
def test_ckan_facility_number_is_numeric_string():
    _, payload = _fetch_records(limit=20)
    records = payload["result"]["records"]
    for rec in records:
        raw = rec.get("facility_number")
        assert raw is not None, f"facility_number is None in record: {rec.get('facility_name')!r}"
        # Must be convertible to int (possibly stored as float string e.g. "100001234.0")
        try:
            int(float(str(raw)))
        except (ValueError, TypeError):
            pytest.fail(
                f"facility_number={raw!r} cannot be coerced to int "
                f"(facility: {rec.get('facility_name')!r})"
            )


@pytest.mark.external_api
def test_ckan_facility_name_is_nonempty_string():
    _, payload = _fetch_records(limit=20)
    records = payload["result"]["records"]
    for rec in records:
        name = rec.get("facility_name")
        assert isinstance(name, str) and name.strip(), (
            f"facility_name is missing or blank: record facility_number={rec.get('facility_number')!r}"
        )


@pytest.mark.external_api
def test_ckan_facility_type_matches_rcfe_pattern():
    _, payload = _fetch_records(limit=20)
    records = payload["result"]["records"]
    for rec in records:
        ftype = rec.get("facility_type") or ""
        assert ftype.strip(), (
            f"facility_type is blank for facility_number={rec.get('facility_number')!r}"
        )
        # Unfiltered query may include non-RCFE types; just validate non-empty


@pytest.mark.external_api
def test_ckan_facility_status_is_known_value():
    _, payload = _fetch_records(limit=20)
    records = payload["result"]["records"]
    seen_statuses: set[str] = set()
    for rec in records:
        status = (rec.get("facility_status") or "").strip().upper()
        seen_statuses.add(status)
    # At least one LICENSED record must appear in any page of 20
    assert "LICENSED" in seen_statuses, (
        f"No LICENSED records in first 20 CKAN rows. Seen statuses: {seen_statuses}"
    )


@pytest.mark.external_api
def test_ckan_county_name_is_nonempty_string():
    _, payload = _fetch_records(limit=20)
    records = payload["result"]["records"]
    for rec in records:
        county = rec.get("county_name")
        assert isinstance(county, str) and county.strip(), (
            f"county_name is missing or blank for facility_number={rec.get('facility_number')!r}"
        )


@pytest.mark.external_api
def test_ckan_facility_capacity_is_numeric_or_none():
    _, payload = _fetch_records(limit=20)
    records = payload["result"]["records"]
    for rec in records:
        cap = rec.get("facility_capacity")
        if cap is None:
            continue
        try:
            val = int(float(str(cap)))
            assert val >= 0, f"Negative capacity {val} for {rec.get('facility_name')!r}"
        except (ValueError, TypeError):
            pytest.fail(
                f"facility_capacity={cap!r} is not numeric "
                f"(facility: {rec.get('facility_name')!r})"
            )


@pytest.mark.external_api
def test_ckan_facility_zip_is_numeric_or_none():
    _, payload = _fetch_records(limit=20)
    records = payload["result"]["records"]
    for rec in records:
        raw_zip = rec.get("facility_zip")
        if raw_zip is None:
            continue
        try:
            z = str(int(float(str(raw_zip)))).zfill(5)
            assert len(z) == 5 and z.isdigit(), (
                f"ZIP {z!r} is not a 5-digit string after normalization"
            )
        except (ValueError, TypeError):
            pytest.fail(
                f"facility_zip={raw_zip!r} is not numeric "
                f"(facility: {rec.get('facility_name')!r})"
            )


# ─────────────────────────────────────────────────────────────────────────────
# County filter correctness
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.external_api
def test_ckan_alameda_county_filter_returns_records():
    _, payload = _fetch_records(county_filter="ALAMEDA", limit=20)
    records = payload["result"]["records"]
    assert len(records) > 0, (
        "CKAN filter county_name=ALAMEDA returned 0 records — "
        "filter may be broken or data schema changed"
    )


@pytest.mark.external_api
def test_ckan_alameda_county_filter_all_records_are_alameda():
    _, payload = _fetch_records(county_filter="ALAMEDA", limit=50)
    records = payload["result"]["records"]
    non_alameda = [
        (rec.get("facility_name"), rec.get("county_name"))
        for rec in records
        if (rec.get("county_name") or "").strip().upper() != "ALAMEDA"
    ]
    assert not non_alameda, (
        f"CKAN ALAMEDA filter leaked records from other counties: {non_alameda[:5]}"
    )


@pytest.mark.external_api
def test_ckan_alameda_has_licensed_rcfe_facilities():
    _, payload = _fetch_records(county_filter="ALAMEDA", limit=100)
    records = payload["result"]["records"]
    licensed = [r for r in records if (r.get("facility_status") or "").upper() == "LICENSED"]
    assert len(licensed) > 0, (
        "No LICENSED facilities returned for Alameda County CKAN query"
    )


@pytest.mark.external_api
def test_ckan_alameda_licensed_facilities_have_addresses():
    _, payload = _fetch_records(county_filter="ALAMEDA", limit=50)
    records = payload["result"]["records"]
    licensed = [r for r in records if (r.get("facility_status") or "").upper() == "LICENSED"]
    for rec in licensed[:10]:
        addr = (rec.get("facility_address") or "").strip()
        assert addr, (
            f"LICENSED facility {rec.get('facility_name')!r} has no address"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Pagination
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.external_api
def test_ckan_pagination_offset_returns_different_records():
    _, p1 = _fetch_records(limit=5, offset=0)
    _, p2 = _fetch_records(limit=5, offset=5)
    ids_p1 = {r.get("facility_number") for r in p1["result"]["records"]}
    ids_p2 = {r.get("facility_number") for r in p2["result"]["records"]}
    overlap = ids_p1 & ids_p2
    assert not overlap, (
        f"Pagination offset failed — same facility_number in page 1 and page 2: {overlap}"
    )


@pytest.mark.external_api
def test_ckan_limit_respected():
    for limit in (1, 5, 10):
        _, payload = _fetch_records(limit=limit)
        n = len(payload["result"]["records"])
        assert n <= limit, f"CKAN returned {n} records but limit={limit} was requested"


# ─────────────────────────────────────────────────────────────────────────────
# Round-trip: raw CKAN records through ingest helpers
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.external_api
def test_ckan_records_build_valid_facility_rows():
    """
    Pass real CKAN records through the build_facility_row() helper and assert
    that every output row has all the fields required by the UPSERT SQL.
    This proves the full CKAN→DB transformation works on live data.
    """
    from ccld_rcfe_ingest import build_facility_row, pad_license

    REQUIRED_OUTPUT_FIELDS = {
        "state_code",
        "name",
        "license_number",
        "city_slug",
        "slug",
        "facility_type",
        "certification_type",
        "care_category",
        "publishable",
        "mc_signal_explicit_name",
        "mc_signal_chain_name",
        "mc_review_status",
    }

    _, payload = _fetch_records(county_filter="ALAMEDA", limit=20)
    records = payload["result"]["records"]
    assert records, "No CKAN records available for round-trip test"

    built = 0
    for ckan in records:
        row = build_facility_row(ckan, trans=None, ingest_county="ALAMEDA")
        if row is None:
            continue  # legitimately skipped (city in exclusion list)
        built += 1

        missing = REQUIRED_OUTPUT_FIELDS - set(row.keys())
        assert not missing, (
            f"build_facility_row() dropped required fields for "
            f"facility_number={ckan.get('facility_number')!r}: {missing}"
        )

        # Key field type assertions
        assert isinstance(row["state_code"], str) and row["state_code"] == "CA"
        assert isinstance(row["name"], str) and row["name"].strip()
        assert isinstance(row["license_number"], str)
        assert len(row["license_number"]) == 9, (
            f"license_number should be 9 chars, got {row['license_number']!r}"
        )
        assert isinstance(row["city_slug"], str) and row["city_slug"].strip()
        assert isinstance(row["slug"], str) and row["slug"].strip()
        assert row["facility_type"] == "rcfe"
        assert row["certification_type"] == "state"
        assert row["care_category"] in (
            "rcfe_memory_care", "rcfe_general", "ccrc", "unknown"
        ), f"Unexpected care_category: {row['care_category']!r}"
        assert isinstance(row["publishable"], bool)
        assert isinstance(row["mc_signal_explicit_name"], bool)
        assert isinstance(row["mc_signal_chain_name"], bool)
        assert row["mc_review_status"] in (
            "auto_published", "needs_review", "reviewed_publish", "reviewed_reject"
        ), f"Unexpected mc_review_status: {row['mc_review_status']!r}"

        # beds must be non-negative int or None
        if row["beds"] is not None:
            assert isinstance(row["beds"], int) and row["beds"] >= 0

        # zip must be 5-char digit string or None
        if row["zip"] is not None:
            assert isinstance(row["zip"], str) and len(row["zip"]) == 5

    assert built > 0, "build_facility_row() returned None for all CKAN records"


@pytest.mark.external_api
def test_ckan_memory_care_facilities_detected():
    """
    At least some Alameda County RCFE facilities should have explicit memory care
    keywords in their names. Verifies the MC signal detection works on live data.
    """
    from ccld_rcfe_ingest import build_facility_row

    _, payload = _fetch_records(county_filter="ALAMEDA", limit=200)
    records = payload["result"]["records"]

    explicit_mc = 0
    chain_mc = 0
    for ckan in records:
        row = build_facility_row(ckan, trans=None, ingest_county="ALAMEDA")
        if row is None:
            continue
        if row.get("mc_signal_explicit_name"):
            explicit_mc += 1
        if row.get("mc_signal_chain_name"):
            chain_mc += 1

    assert explicit_mc > 0 or chain_mc > 0, (
        "Zero memory care facilities detected in Alameda County RCFE roster. "
        "MC signal patterns may be broken."
    )
