"""
or_ltc_to_bundle.py — Oregon LTC bundle format tests.

Tests the bundle_format used by the OR inspection pipeline:
  • format_version: 1 schema compliance
  • Facility and inspection field presence
  • Date parsing (all supported formats)
  • Severity inference from state_severity_raw text
  • Deficiency deduplication key generation
  • License number padding to 10 digits (OR-specific)

Uses synthetic CSV input (no network) to drive build_bundle() end-to-end.
"""

from __future__ import annotations

import csv
import io
import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest
from or_ltc_to_bundle import build_bundle, pad_license_or, parse_date

SCRAPERS_DIR = Path(__file__).resolve().parent.parent.parent / "scrapers"
FIXTURES_DIR = SCRAPERS_DIR / "fixtures"


# ─────────────────────────────────────────────────────────────────────────────
# pad_license_or()
# ─────────────────────────────────────────────────────────────────────────────


def test_pad_license_or_pads_to_10():
    assert pad_license_or("12345") == "0000012345"


def test_pad_license_or_10_digit_unchanged():
    assert pad_license_or("1234567890") == "1234567890"


def test_pad_license_or_strips_non_digits():
    assert pad_license_or("OR-12345") == "0000012345"


def test_pad_license_or_none_returns_zeros():
    assert pad_license_or(None) == "0000000000"


def test_pad_license_or_empty_string_returns_zeros():
    assert pad_license_or("") == "0000000000"


def test_pad_license_or_result_is_all_digits():
    result = pad_license_or("12345")
    assert result.isdigit()


def test_pad_license_or_result_is_10_chars():
    assert len(pad_license_or("99999")) == 10


# ─────────────────────────────────────────────────────────────────────────────
# parse_date()
# ─────────────────────────────────────────────────────────────────────────────


def test_parse_date_yyyy_mm_dd():
    assert parse_date("2023-06-15") == "2023-06-15"


def test_parse_date_mm_dd_yyyy():
    assert parse_date("06/15/2023") == "2023-06-15"


def test_parse_date_mm_dd_yy():
    assert parse_date("06/15/23") == "2023-06-15"


def test_parse_date_none_returns_none():
    assert parse_date(None) is None


def test_parse_date_empty_returns_none():
    assert parse_date("") is None


def test_parse_date_returns_iso_format():
    result = parse_date("01/01/2020")
    assert result is not None
    assert len(result) == 10
    assert result[4] == "-" and result[7] == "-"


def test_parse_date_invalid_returns_none():
    assert parse_date("not-a-date") is None


# ─────────────────────────────────────────────────────────────────────────────
# build_bundle() — synthetic CSV input
# ─────────────────────────────────────────────────────────────────────────────


def _make_csv_file(rows: list[dict], fieldnames: list[str]) -> io.TextIOWrapper:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    buf.seek(0)
    return buf


# Simulated inspection rows matching OR DHS LTC CSV export format
_INSP_ROWS = [
    {
        "Provider ID": "12345",
        "Event ID": "EVT001",
        "Date": "2023-06-15",
        "Inspection type(s)": "Routine",
        "Type": "ALF",
        "Deficiencies cited": "2",
    },
    {
        "Provider ID": "12345",
        "Event ID": "EVT002",
        "Date": "2022-09-10",
        "Inspection type(s)": "Complaint",
        "Type": "ALF",
        "Deficiencies cited": "0",
    },
    {
        "Provider ID": "99999",
        "Event ID": "EVT003",
        "Date": "2023-01-05",
        "Inspection type(s)": "Routine",
        "Type": "RCF",
        "Deficiencies cited": "1",
    },
]

_INSP_HEADERS = ["Provider ID", "Event ID", "Date", "Inspection type(s)", "Type", "Deficiencies cited"]

_VIOL_ROWS = [
    {
        "Provider ID": "12345",
        "Report number": "RPT001",
        "Date": "2023-08-01",
        "Allegation": "Staff failed to follow care plan.",
        "Type": "Type A",
        "Provider type": "ALF",
    },
    {
        "Provider ID": "12345",
        "Report number": "RPT001",
        "Date": "2023-08-01",
        "Allegation": "Medication not administered on time.",
        "Type": "Type B",
        "Provider type": "ALF",
    },
    {
        "Provider ID": "99999",
        "Report number": "RPT002",
        "Date": "2023-02-14",
        "Allegation": "Unsafe environment observed.",
        "Type": "Immediate Jeopardy",
        "Provider type": "RCF",
    },
]

_VIOL_HEADERS = ["Provider ID", "Report number", "Date", "Allegation", "Type", "Provider type"]


def _build_test_bundle(
    roster_ids: set[str] | None = None,
    since_date: date | None = None,
) -> dict[str, Any]:
    insp_path = FIXTURES_DIR / "_test_inspections.csv"
    viol_path = FIXTURES_DIR / "_test_violations.csv"

    try:
        # Write temp CSVs
        with open(insp_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=_INSP_HEADERS)
            w.writeheader()
            w.writerows(_INSP_ROWS)

        with open(viol_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=_VIOL_HEADERS)
            w.writeheader()
            w.writerows(_VIOL_ROWS)

        return build_bundle(insp_path, viol_path, roster_ids, since_date=since_date)
    finally:
        insp_path.unlink(missing_ok=True)
        viol_path.unlink(missing_ok=True)


def test_bundle_has_format_version():
    bundle = _build_test_bundle()
    assert bundle.get("format_version") == 1, (
        f"bundle format_version must be 1, got {bundle.get('format_version')!r}"
    )


def test_bundle_has_facilities_list():
    bundle = _build_test_bundle()
    assert "facilities" in bundle
    assert isinstance(bundle["facilities"], list)


def test_bundle_facilities_are_nonempty():
    bundle = _build_test_bundle()
    assert len(bundle["facilities"]) > 0


def test_bundle_each_facility_has_license_number():
    bundle = _build_test_bundle()
    for fac in bundle["facilities"]:
        assert "license_number" in fac
        assert isinstance(fac["license_number"], str)
        assert len(fac["license_number"]) == 10  # OR pads to 10


def test_bundle_each_facility_has_inspections():
    bundle = _build_test_bundle()
    for fac in bundle["facilities"]:
        assert "inspections" in fac
        assert isinstance(fac["inspections"], list)


def test_bundle_each_inspection_has_required_fields():
    bundle = _build_test_bundle()
    required = {"inspection_date", "inspection_type", "is_complaint", "source_url"}
    for fac in bundle["facilities"]:
        for insp in fac["inspections"]:
            missing = required - set(insp.keys())
            assert not missing, (
                f"Inspection for license {fac['license_number']!r} missing fields: {missing}"
            )


def test_bundle_inspection_dates_are_iso_format():
    bundle = _build_test_bundle()
    import re
    iso_re = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    for fac in bundle["facilities"]:
        for insp in fac["inspections"]:
            d = insp["inspection_date"]
            assert iso_re.match(d), (
                f"inspection_date {d!r} is not ISO format (YYYY-MM-DD)"
            )


def test_bundle_is_complaint_is_boolean():
    bundle = _build_test_bundle()
    for fac in bundle["facilities"]:
        for insp in fac["inspections"]:
            assert isinstance(insp["is_complaint"], bool)


def test_bundle_inspection_type_is_known_value():
    bundle = _build_test_bundle()
    known = {"standard", "complaint", "follow-up", "focused"}
    for fac in bundle["facilities"]:
        for insp in fac["inspections"]:
            itype = insp["inspection_type"]
            assert itype in known, (
                f"Unknown inspection_type {itype!r} — ingest will store this to DB"
            )


def test_bundle_complaint_inspections_have_is_complaint_true():
    bundle = _build_test_bundle()
    for fac in bundle["facilities"]:
        for insp in fac["inspections"]:
            if insp.get("inspection_type") == "complaint":
                assert insp["is_complaint"] is True, (
                    "Complaint inspection must have is_complaint=True"
                )


def test_bundle_deficiencies_are_list():
    bundle = _build_test_bundle()
    for fac in bundle["facilities"]:
        for insp in fac["inspections"]:
            assert isinstance(insp.get("deficiencies", []), list)


def test_bundle_violation_deficiencies_have_required_fields():
    bundle = _build_test_bundle()
    # Violation records (from violations CSV) should have description
    for fac in bundle["facilities"]:
        for insp in fac["inspections"]:
            for d in insp.get("deficiencies", []):
                # Must have at least some narrative content
                has_content = (
                    (d.get("description") or "").strip()
                    or (d.get("inspector_narrative") or "").strip()
                )
                assert has_content, (
                    f"Deficiency has no description or inspector_narrative: {d}"
                )


def test_bundle_deficiency_immediate_jeopardy_is_boolean():
    bundle = _build_test_bundle()
    for fac in bundle["facilities"]:
        for insp in fac["inspections"]:
            for d in insp.get("deficiencies", []):
                ij = d.get("immediate_jeopardy")
                assert isinstance(ij, bool), (
                    f"immediate_jeopardy must be bool, got {type(ij).__name__}: {ij!r}"
                )


def test_bundle_source_url_is_ltclicensing_domain():
    bundle = _build_test_bundle()
    for fac in bundle["facilities"]:
        for insp in fac["inspections"]:
            url = insp.get("source_url", "")
            assert "ltclicensing.oregon.gov" in url, (
                f"source_url {url!r} doesn't contain expected OR DHS domain"
            )


def test_bundle_inspections_sorted_by_date():
    bundle = _build_test_bundle()
    for fac in bundle["facilities"]:
        dates = [i["inspection_date"] for i in fac["inspections"]]
        assert dates == sorted(dates), (
            f"Inspections for license {fac['license_number']!r} not sorted ascending by date"
        )


def test_bundle_two_providers_both_included():
    bundle = _build_test_bundle()
    licenses = {f["license_number"] for f in bundle["facilities"]}
    # Provider IDs 12345 and 99999 padded to 10 digits
    assert "0000012345" in licenses
    assert "0000099999" in licenses


def test_bundle_roster_filter_excludes_non_roster_providers():
    """With roster_ids={"12345"}, only provider 12345 should appear."""
    bundle = _build_test_bundle(roster_ids={"12345"})
    licenses = {f["license_number"] for f in bundle["facilities"]}
    assert "0000012345" in licenses
    assert "0000099999" not in licenses


def test_bundle_json_serializable():
    bundle = _build_test_bundle()
    # Must be serializable without errors (no date objects, no non-serializable types)
    json_str = json.dumps(bundle)
    assert len(json_str) > 0
    # Verify round-trip
    parsed = json.loads(json_str)
    assert parsed["format_version"] == 1
