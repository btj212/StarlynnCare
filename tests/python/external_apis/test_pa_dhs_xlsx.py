"""
Tests: Pennsylvania DHS Human Services Provider Directory XLSX export
Source: https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/ExportToExcel

Verifies the complete data shape expected by pa_hsd_directory_ingest.py.
This is the most rigorously specified external API because MEMORY.md documents
exact column positions and reference fixture assertions (Section 4 gotcha).
"""

from __future__ import annotations

from io import BytesIO
from typing import Any

import pytest
import requests

DHS_BASE = "https://www.humanservices.dhs.pa.gov"
DHS_DIRECTORY_HOME = f"{DHS_BASE}/HUMAN_SERVICE_PROVIDER_DIRECTORY/"
DHS_EXPORT_URL = f"{DHS_BASE}/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/ExportToExcel"
PROGRAM_OFFICE_OLTL = "Office of Long-Term Living"

# Column count the script asserts at startup (MEMORY.md 2026-05).
EXPECTED_COLUMN_COUNT = 26

# Known reference fixtures from pa-memory-care-data-methodology.md Section 4.
# License number → expected URL id (last digit stripped).
URL_ID_FIXTURES = [
    ("223010", "22301"),   # Rittenhouse Village at Lehigh Valley
    ("110780", "11078"),   # A Second Chance
    ("231010", "23101"),   # Serenity Gardens at Mount Carmel
    ("456560", "45656"),   # Cambridge Village PCH
]

# Columns at indices the script reads (0-based).
# From pa_hsd_directory_ingest.py row_to_record():
# idx 0: Service Type  idx 1: Program Office  idx 2: Facility Name
# idx 16: License Number  idx 3: Legal Entity
COLUMN_NAMES_REQUIRED = {
    "Service Type",
    "Program Office",
    "Facility Name",
    "License Number",
}


@pytest.fixture(scope="module")
def pa_xlsx_bytes(http_session: requests.Session) -> bytes:
    """
    Fetch the live PA DHS XLSX export, seeding cookies from the home page first
    (required by the DHS portal — see pa_hsd_directory_ingest.py fetch_live_xlsx).
    """
    http_session.get(DHS_DIRECTORY_HOME, timeout=30)
    resp = http_session.get(DHS_EXPORT_URL, timeout=120)
    resp.raise_for_status()
    return resp.content


@pytest.fixture(scope="module")
def pa_workbook(pa_xlsx_bytes: bytes) -> tuple[list[str], list[tuple[Any, ...]]]:
    """Parse the XLSX and return (header_row, data_rows)."""
    try:
        import openpyxl  # type: ignore[import-untyped]
    except ImportError:
        pytest.skip("openpyxl not installed — cannot parse XLSX")
    wb = openpyxl.load_workbook(BytesIO(pa_xlsx_bytes), read_only=True, data_only=True)
    ws = wb["Provider Directory Report"]
    rows = list(ws.iter_rows(values_only=True))
    header = [(h or "").strip() if isinstance(h, str) else h for h in rows[0]]
    return header, rows[1:]


@pytest.mark.external_api
@pytest.mark.slow
def test_pa_dhs_endpoint_responds(http_session: requests.Session) -> None:
    """PA DHS directory home page returns HTTP 200."""
    resp = http_session.get(DHS_DIRECTORY_HOME, timeout=30)
    assert resp.status_code == 200, f"PA DHS home returned {resp.status_code}"


@pytest.mark.external_api
@pytest.mark.slow
def test_pa_dhs_export_returns_xlsx(http_session: requests.Session) -> None:
    """Export endpoint returns an XLSX content-type (not HTML/404)."""
    http_session.get(DHS_DIRECTORY_HOME, timeout=30)
    resp = http_session.get(DHS_EXPORT_URL, timeout=120)
    assert resp.status_code == 200, f"PA DHS export returned {resp.status_code}"
    ct = resp.headers.get("content-type", "").lower()
    is_xlsx = (
        "spreadsheetml" in ct
        or "excel" in ct
        or "octet-stream" in ct
        or "openxmlformats" in ct
    )
    assert is_xlsx, f"PA DHS export returned unexpected content-type: {ct!r}"


@pytest.mark.external_api
@pytest.mark.slow
def test_pa_dhs_xlsx_has_expected_column_count(
    pa_workbook: tuple[list[str], list[tuple[Any, ...]]],
) -> None:
    """XLSX has the 26 columns the ingest script expects (schema drift alert)."""
    header, _ = pa_workbook
    assert len(header) == EXPECTED_COLUMN_COUNT, (
        f"PA DHS XLSX has {len(header)} columns, expected {EXPECTED_COLUMN_COUNT}. "
        "Schema may have shifted — review pa_hsd_directory_ingest.py column indices."
    )


@pytest.mark.external_api
@pytest.mark.slow
def test_pa_dhs_xlsx_has_required_columns(
    pa_workbook: tuple[list[str], list[tuple[Any, ...]]],
) -> None:
    """Required column names are present in the header row."""
    header, _ = pa_workbook
    header_set = {str(h or "").strip() for h in header}
    missing = COLUMN_NAMES_REQUIRED - header_set
    assert not missing, (
        f"PA DHS XLSX missing required columns: {missing}\n"
        f"Found: {sorted(str(h) for h in header_set if h)}"
    )


@pytest.mark.external_api
@pytest.mark.slow
def test_pa_dhs_xlsx_oltl_row_count(
    pa_workbook: tuple[list[str], list[tuple[Any, ...]]],
) -> None:
    """OLTL-filtered rows ≥ 355 (MEMORY.md 2026-05 result: 355 publishable PA facilities)."""
    header, rows = pa_workbook
    header_lower = [str(h or "").strip().lower() for h in header]
    try:
        po_idx = header_lower.index("program office")
    except ValueError:
        pytest.skip("Program Office column not found — check test_pa_dhs_xlsx_has_required_columns")

    oltl_rows = [
        r for r in rows
        if len(r) > po_idx and (r[po_idx] or "") == PROGRAM_OFFICE_OLTL
    ]
    assert len(oltl_rows) >= 355, (
        f"Expected ≥355 OLTL-scoped rows, got {len(oltl_rows)}. "
        "Data may have been truncated or provider count dropped."
    )


@pytest.mark.external_api
@pytest.mark.slow
def test_pa_dhs_xlsx_memory_care_column_present(
    pa_workbook: tuple[list[str], list[tuple[Any, ...]]],
) -> None:
    """The 'Special Care/Secure Dementia Care Unit' column exists (PA MC signal)."""
    header, _ = pa_workbook
    header_strs = [str(h or "").strip() for h in header]
    mc_cols = [h for h in header_strs if "dementia" in h.lower() or "special care" in h.lower()]
    assert mc_cols, (
        f"No memory-care / dementia-related column found in PA XLSX header: {header_strs}"
    )


@pytest.mark.external_api
@pytest.mark.slow
def test_pa_dhs_xlsx_known_fixtures_present(
    pa_workbook: tuple[list[str], list[tuple[Any, ...]]],
) -> None:
    """
    Reference facilities from MEMORY.md / pa-memory-care-data-methodology.md Section 4
    are present in the XLSX with the expected license numbers.
    """
    header, rows = pa_workbook
    header_lower = [str(h or "").strip().lower() for h in header]
    try:
        lic_idx = header_lower.index("license number")
    except ValueError:
        pytest.skip("License Number column not found")

    lic_numbers_in_xlsx = {
        str(r[lic_idx]).strip()
        for r in rows
        if len(r) > lic_idx and r[lic_idx]
    }

    for license_num, _ in URL_ID_FIXTURES:
        assert license_num in lic_numbers_in_xlsx, (
            f"Reference fixture license {license_num!r} not found in PA XLSX. "
            "Either the facility was removed or the license column index changed."
        )
