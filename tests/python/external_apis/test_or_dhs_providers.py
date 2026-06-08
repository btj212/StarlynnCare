"""
Tests: Oregon DHS LTC Licensing Providers endpoint
Source: https://ltclicensing.oregon.gov/Providers (CSV export via CSRF-gated POST)

Verifies that the OR DHS provider export returns a parseable CSV with the
expected columns for the StarlynnCare ingest pipeline.
"""

from __future__ import annotations

import csv
import io
import re

import pytest
import requests

OR_PROVIDERS_URL = "https://ltclicensing.oregon.gov/Providers"
OR_PROVIDERS_EXPORT_URL = f"{OR_PROVIDERS_URL}/Export"

# Columns the or_providers_ingest.py script reads from the CSV.
# From the docstring: "ID | Name | Type | Address | City | Zip | County |
#   Licensed beds | Accepts Medicaid | Memory Care | Status"
REQUIRED_CSV_COLUMNS = {
    "ID",
    "Name",
    "Type",
    "Address",
    "City",
    "Zip",
    "County",
    "Licensed beds",
    "Memory Care",
    "Status",
}

# OR memory care endpoint types: facilities with endorsement show "Yes" in Memory Care.
KNOWN_MEMORY_CARE_TYPES = {
    "Assisted Living Facility",
    "Residential Care Facility",
    "Memory Care Community",
}


@pytest.fixture(scope="module")
def or_providers_csv(http_session: requests.Session) -> str:
    """Fetch OR DHS providers CSV via the CSRF-gated export endpoint."""
    page = http_session.get(OR_PROVIDERS_URL, timeout=30)
    token_match = re.search(r'__RequestVerificationToken.*?value="([^"]+)"', page.text)
    assert token_match, "Could not find CSRF token on OR providers page"
    token = token_match.group(1)
    resp = http_session.post(
        OR_PROVIDERS_EXPORT_URL,
        data={
            "PageNumber": "1",
            "PageSize": "500",
            "Sorts": "Name",
            "Filters": "Status=Open",
            "initialLoad": "false",
            "type": "csv",
            "__RequestVerificationToken": token,
        },
        headers={"Referer": OR_PROVIDERS_URL},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.text


@pytest.mark.external_api
def test_or_providers_endpoint_responds(http_session: requests.Session) -> None:
    """OR DHS providers endpoint returns HTTP 200 with downloadable content."""
    resp = http_session.get(OR_PROVIDERS_URL, timeout=30)
    assert resp.status_code == 200, (
        f"OR DHS providers endpoint returned {resp.status_code}. "
        "Possible portal change — update or_providers_ingest.py."
    )


@pytest.mark.external_api
def test_or_providers_returns_csv_or_excel(or_providers_csv: str) -> None:
    """Export response is a parseable CSV with a quoted header line."""
    sample = or_providers_csv[:2048]
    # The CSV starts with a quoted header — check it can be sniffed as CSV
    try:
        dialect = csv.Sniffer().sniff(sample)
        assert dialect is not None, "CSV sniffer could not detect CSV dialect"
    except csv.Error as exc:
        pytest.fail(f"OR DHS providers export is not parseable CSV: {exc}")


@pytest.mark.external_api
def test_or_providers_csv_has_required_columns(or_providers_csv: str) -> None:
    """CSV has all columns the ingest script reads."""
    reader = csv.DictReader(io.StringIO(or_providers_csv))
    header = set(reader.fieldnames or [])
    # Normalize: strip whitespace
    header = {h.strip() for h in header}
    missing = REQUIRED_CSV_COLUMNS - header
    assert not missing, (
        f"OR DHS providers CSV is missing columns: {missing}\n"
        f"Found columns: {sorted(header)}"
    )


@pytest.mark.external_api
def test_or_providers_has_substantial_row_count(or_providers_csv: str) -> None:
    """CSV has at least 500 OR provider records (OR has ~8k facilities total)."""
    reader = csv.DictReader(io.StringIO(or_providers_csv))
    rows = list(reader)
    assert len(rows) >= 500, (
        f"Expected ≥500 OR provider rows, got {len(rows)}. "
        "Possible data truncation or portal issue."
    )


@pytest.mark.external_api
def test_or_providers_id_field_non_empty(or_providers_csv: str) -> None:
    """ID field (used as external_id in facilities) is non-empty on all records."""
    reader = csv.DictReader(io.StringIO(or_providers_csv))
    nulls = [r for r in reader if not (r.get("ID") or "").strip()]
    assert not nulls, f"{len(nulls)} OR providers have empty ID field"


@pytest.mark.external_api
def test_or_providers_memory_care_column_present_and_boolean_like(
    or_providers_csv: str,
) -> None:
    """Memory Care column exists and its values are 'Yes' or 'No' (or empty)."""
    reader = csv.DictReader(io.StringIO(or_providers_csv))
    bad = []
    for r in reader:
        mc = (r.get("Memory Care") or "").strip()
        if mc and mc not in ("Yes", "No"):
            bad.append((r.get("ID"), mc))
    assert not bad, f"Unexpected Memory Care values: {bad[:5]}"


@pytest.mark.external_api
def test_or_providers_has_at_least_one_memory_care_facility(
    or_providers_csv: str,
) -> None:
    """At least one facility has Memory Care = 'Yes' (the Tier-1 mce_endorsed signal)."""
    reader = csv.DictReader(io.StringIO(or_providers_csv))
    mc_endorsed = [r for r in reader if (r.get("Memory Care") or "").strip() == "Yes"]
    assert mc_endorsed, (
        "No OR facilities with Memory Care='Yes' found. "
        "The mce_endorsed Tier-1 signal depends on this column."
    )
