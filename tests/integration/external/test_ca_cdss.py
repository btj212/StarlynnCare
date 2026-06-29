#!/usr/bin/env python3
"""
Layer 0 — California CDSS external source shape tests.

Verifies that the two CDSS data sources still return data in the exact
structure the scrapers expect:

  1. CA Open Data CKAN datastore (RCFE roster)
     GET https://data.ca.gov/api/3/action/datastore_search
     resource_id: 6b2f5818-f60d-40b5-bc2a-94f995f9f8b0

  2. CDSS Transparency API (facility visit reports)
     GET https://www.ccld.dss.ca.gov/transparencyapi/api/FacilityReports/<facNum>
     GET https://www.ccld.dss.ca.gov/transparencyapi/api/Facility/any

No database connection required. No mocks. Hits live endpoints.

Exit 0 = all checks passed. Exit 1 = one or more checks failed.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from tests._lib import check, run_all_checks, make_session, HTTP_TIMEOUT  # noqa: E402

# ── Constants ──────────────────────────────────────────────────────────────────

CKAN_URL = "https://data.ca.gov/api/3/action/datastore_search"
CKAN_RESOURCE_ID = "6b2f5818-f60d-40b5-bc2a-94f995f9f8b0"

TRANSPARENCY_BASE = "https://www.ccld.dss.ca.gov/transparencyapi/api"
# Use a well-known large RCFE (Sunrise Senior Living, Roseville area) as a known fixture.
# This facility number is stable and has multiple inspection records.
KNOWN_FAC_NUM = "197605139"

# All columns the ccld_rcfe_ingest.py scraper reads from the CKAN datastore.
# Source of truth: ccld_rcfe_ingest.py row_to_record() + CKAN field names.
CKAN_REQUIRED_COLUMNS = [
    "FACNUM",
    "FACNAME",
    "COUNTY_NAME",
    "LICENSEE_NAME",
    "FACILITY_ADDRESS",
    "FACILITY_CITY",
    "FACILITY_STATE",
    "FACILITY_ZIP",
    "CAPACITY",
    "LICENSEETYPE_NAME",
    "FAC_STATUS",
]

# Fields returned by the FacilityReports endpoint per inspection visit.
# Source of truth: ccld_citations_ingest.py FacilityReport parsing.
TRANSPARENCY_REPORT_FIELDS = [
    "FacilityNumber",
    "VisitType",
    "VisitDate",
    "TotalDeficiencies",
    "Deficiencies",
]


# ── Test functions ─────────────────────────────────────────────────────────────

def test_ckan_reachability(sess) -> None:
    """CKAN endpoint returns HTTP 200 with success=true."""
    print("\n[CA CKAN — reachability]")
    r = sess.get(
        CKAN_URL,
        params={"resource_id": CKAN_RESOURCE_ID, "limit": 3},
        timeout=HTTP_TIMEOUT,
    )
    check("CKAN: HTTP 200", r.status_code == 200, f"got {r.status_code}")
    body = r.json()
    check("CKAN: success=true", body.get("success") is True, f"success={body.get('success')!r}")
    result = body.get("result", {})
    check("CKAN: result.total > 0", (result.get("total") or 0) > 0, f"total={result.get('total')!r}")
    check("CKAN: result.records is list", isinstance(result.get("records"), list), "")
    return result


def test_ckan_field_coverage(sess) -> None:
    """Every required scraper column is present in the CKAN schema."""
    print("\n[CA CKAN — field coverage]")
    r = sess.get(
        CKAN_URL,
        params={"resource_id": CKAN_RESOURCE_ID, "limit": 5},
        timeout=HTTP_TIMEOUT,
    )
    body = r.json()
    result = body.get("result", {})

    # Check fields from the schema definition
    schema_fields = {f["id"] for f in result.get("fields", [])}
    for col in CKAN_REQUIRED_COLUMNS:
        check(f"CKAN field '{col}' in schema", col in schema_fields, f"schema_fields={sorted(schema_fields)[:8]}...")

    # Also validate the first record has the expected keys
    records = result.get("records", [])
    if records:
        r0 = records[0]
        for col in CKAN_REQUIRED_COLUMNS:
            check(f"CKAN record[0] has '{col}'", col in r0, f"record keys={list(r0.keys())[:10]}...")


def test_ckan_record_data_validity(sess) -> None:
    """Records contain valid non-empty values for key fields."""
    print("\n[CA CKAN — data validity on 5 sample records]")
    r = sess.get(
        CKAN_URL,
        params={"resource_id": CKAN_RESOURCE_ID, "limit": 5, "sort": "FACNUM asc"},
        timeout=HTTP_TIMEOUT,
    )
    body = r.json()
    records = body.get("result", {}).get("records", [])
    check("CKAN: at least 1 record", len(records) >= 1, f"got {len(records)}")
    for i, rec in enumerate(records):
        label = f"CKAN record[{i}]"
        check(f"{label} FACNUM non-empty", bool(rec.get("FACNUM")), f"got {rec.get('FACNUM')!r}")
        check(f"{label} FACNAME non-empty", bool(rec.get("FACNAME")), f"got {rec.get('FACNAME')!r}")
        check(f"{label} COUNTY_NAME non-empty", bool(rec.get("COUNTY_NAME")), f"got {rec.get('COUNTY_NAME')!r}")
        check(f"{label} CAPACITY is numeric-ish", str(rec.get("CAPACITY", "")).isdigit() or rec.get("CAPACITY") is None, f"got {rec.get('CAPACITY')!r}")
        fac_status = rec.get("FAC_STATUS", "")
        check(f"{label} FAC_STATUS non-empty", bool(fac_status), f"got {fac_status!r}")


def test_ckan_total_record_count(sess) -> None:
    """CKAN dataset has at least 3,000 RCFE records (CA universe sanity check)."""
    print("\n[CA CKAN — total count]")
    r = sess.get(
        CKAN_URL,
        params={"resource_id": CKAN_RESOURCE_ID, "limit": 0},
        timeout=HTTP_TIMEOUT,
    )
    body = r.json()
    total = body.get("result", {}).get("total", 0)
    check(
        "CKAN: total record count ≥ 3000",
        int(total or 0) >= 3000,
        f"total={total} (CA should have 5,000+ RCFEs)",
    )


def test_transparency_facility_reports(sess) -> None:
    """CDSS Transparency FacilityReports endpoint returns valid inspection records."""
    print(f"\n[CA CDSS Transparency — FacilityReports for facNum={KNOWN_FAC_NUM}]")
    url = f"{TRANSPARENCY_BASE}/FacilityReports/{KNOWN_FAC_NUM}"
    r = sess.get(url, timeout=HTTP_TIMEOUT)
    check(
        "Transparency FacilityReports: HTTP 200",
        r.status_code == 200,
        f"got {r.status_code}",
    )
    if r.status_code != 200:
        return

    try:
        data = r.json()
    except Exception as e:
        check("Transparency FacilityReports: valid JSON", False, str(e))
        return

    check("Transparency FacilityReports: valid JSON", True)
    check(
        "Transparency FacilityReports: is list or dict",
        isinstance(data, (list, dict)),
        f"got {type(data).__name__}",
    )

    # The endpoint returns either a list of reports or a dict with a list
    if isinstance(data, list):
        reports = data
    else:
        # Some endpoints wrap in {"Reports": [...]} or similar
        reports = data.get("Reports") or data.get("reports") or data.get("FacilityReports") or []
        if not reports and isinstance(data, dict):
            # Try to find any list value
            for v in data.values():
                if isinstance(v, list):
                    reports = v
                    break

    check(
        "Transparency FacilityReports: at least 1 report",
        len(reports) >= 1,
        f"got {len(reports)} reports",
    )

    if reports:
        r0 = reports[0] if isinstance(reports[0], dict) else {}
        for field in TRANSPARENCY_REPORT_FIELDS:
            check(
                f"Transparency report[0] has '{field}'",
                field in r0,
                f"keys={list(r0.keys())[:8]}",
            )
        # Visit date should be a date string
        visit_date = r0.get("VisitDate", "")
        check(
            "Transparency report[0] VisitDate non-empty",
            bool(visit_date),
            f"got {visit_date!r}",
        )
        # TotalDeficiencies should be numeric
        total_defs = r0.get("TotalDeficiencies")
        check(
            "Transparency report[0] TotalDeficiencies is integer",
            isinstance(total_defs, int),
            f"got {type(total_defs).__name__}={total_defs!r}",
        )


def test_transparency_deficiency_structure(sess) -> None:
    """CDSS Transparency inspection reports include structured deficiency objects."""
    print(f"\n[CA CDSS Transparency — deficiency structure for facNum={KNOWN_FAC_NUM}]")
    url = f"{TRANSPARENCY_BASE}/FacilityReports/{KNOWN_FAC_NUM}"
    r = sess.get(url, timeout=HTTP_TIMEOUT)
    if r.status_code != 200:
        check("Transparency deficiency structure: skipped (endpoint unavailable)", True, f"HTTP {r.status_code}")
        return

    data = r.json()
    reports = data if isinstance(data, list) else []
    if not reports:
        check("Transparency deficiency structure: skipped (no reports)", True, "")
        return

    # Find a report that has deficiencies
    report_with_defs = next(
        (rpt for rpt in reports if isinstance(rpt, dict) and rpt.get("TotalDeficiencies", 0) > 0),
        None,
    )
    if report_with_defs is None:
        print("  NOTE: no reports with deficiencies found in first result; skipping deficiency structure check")
        return

    deficiencies = report_with_defs.get("Deficiencies", [])
    check(
        "Deficiencies list non-empty for deficiency-having inspection",
        len(deficiencies) > 0,
        f"got {len(deficiencies)}",
    )

    if deficiencies:
        d0 = deficiencies[0] if isinstance(deficiencies[0], dict) else {}
        # Key fields in each deficiency record
        deficiency_fields = ["Regulation", "Type", "Description"]
        for field in deficiency_fields:
            check(
                f"Deficiency[0] has '{field}'",
                field in d0,
                f"keys={list(d0.keys())[:8]}",
            )


def test_ckan_memory_care_filter(sess) -> None:
    """Can filter CKAN for memory-care-keyword facilities (basic pipeline sanity)."""
    print("\n[CA CKAN — memory care keyword filter]")
    # Filter facilities whose name contains 'memory' — there should be many in CA
    r = sess.get(
        CKAN_URL,
        params={
            "resource_id": CKAN_RESOURCE_ID,
            "limit": 5,
            "q": "memory",
        },
        timeout=HTTP_TIMEOUT,
    )
    body = r.json()
    result = body.get("result", {})
    total = int(result.get("total", 0) or 0)
    check(
        "CKAN: 'memory' keyword filter returns ≥ 10 facilities",
        total >= 10,
        f"total={total} (there should be dozens of Memory Care facilities in CA)",
    )


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("StarlynnCare — Layer 0: CA CDSS External Source Tests")
    print("=" * 60)

    sess = make_session()

    test_ckan_reachability(sess)
    test_ckan_field_coverage(sess)
    test_ckan_record_data_validity(sess)
    test_ckan_total_record_count(sess)
    test_transparency_facility_reports(sess)
    test_transparency_deficiency_structure(sess)
    test_ckan_memory_care_filter(sess)

    run_all_checks("Layer 0 (CA CDSS sources)")


if __name__ == "__main__":
    main()
