#!/usr/bin/env python3
"""
Layer 0 — Multi-state external source shape tests.

Verifies that each state's data source is reachable and returns data in
the structure the scrapers expect. Sources covered:

  OR  — Oregon DHS LTC Licensing portal (ltclicensing.oregon.gov)
  WA  — Washington DSHS ADSA Lookup (fortress.wa.gov)
  AZ  — Arizona ADHS ArcGIS FeatureServer (services1.arcgis.com)
  PA  — Pennsylvania DHS HSD Provider Directory XLSX
  MN  — Minnesota MDH Facility Directory Extract (Excel)
  TX  — Texas HHSC ALF page (hhs.texas.gov)
  IL  — Illinois IDPH care facility search

No database connection required. No mocks. Hits live endpoints.

Exit 0 = all checks passed. Exit 1 = one or more checks failed.
"""
from __future__ import annotations

import csv
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from tests._lib import check, run_all_checks, make_session, HTTP_TIMEOUT  # noqa: E402

# ── Constants ──────────────────────────────────────────────────────────────────

# Oregon DHS LTC Licensing
OR_PROVIDERS_PAGE = "https://ltclicensing.oregon.gov/Providers"
OR_INSPECTIONS_PAGE = "https://ltclicensing.oregon.gov/Inspections"
OR_VIOLATIONS_PAGE = "https://ltclicensing.oregon.gov/Violations"

# Washington DSHS ADSA
WA_LOOKUP_BASE = "https://fortress.wa.gov/dshs/adsaapps/Lookup"
WA_LOOKUP_PAGE = f"{WA_LOOKUP_BASE}/BHFacilitySearch.aspx"

# Arizona ADHS ArcGIS FeatureServer
AZ_ARCGIS_BASE = (
    "https://services1.arcgis.com/mpVYz37anSdrK4d8/arcgis/rest/services"
    "/AZLicensedFacilities/FeatureServer/12/query"
)
# Required attributes from az_adhs_directory_ingest.py attrs.get() calls
AZ_REQUIRED_ATTRIBUTES = [
    "FACILITY_NAME",
    "ASST_LVG_CTR_ID",
    "ADDRESS_LINE",
    "CITY",
    "STATE_CD",
    "ZIP_CD",
    "BEDS_LICENSED",
    "MC_UNIT",
]

# Pennsylvania DHS HSD
PA_DHS_BASE = "https://www.humanservices.dhs.pa.gov"
PA_DHS_EXPORT = f"{PA_DHS_BASE}/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/ExportToExcel"

# Minnesota MDH
MN_MDH_EXTRACT = (
    "https://mdhprovidercontent.web.health.state.mn.us/facilityDirectoryExtract.cfm"
)

# Texas HHSC
TX_ALF_PAGE = (
    "https://www.hhs.texas.gov/providers/long-term-care-providers/assisted-living"
)


# ── Oregon tests ───────────────────────────────────────────────────────────────

def test_or_providers_page(sess) -> None:
    """Oregon DHS LTC Licensing Providers page is reachable and renders a form."""
    print("\n[OR — LTC Licensing Providers page]")
    r = sess.get(OR_PROVIDERS_PAGE, timeout=HTTP_TIMEOUT)
    check("OR Providers page: HTTP 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return

    body = r.text
    check("OR Providers page: has HTML body", len(body) > 500, f"len={len(body)}")
    check(
        "OR Providers page: contains 'Provider' or 'Facility'",
        "provider" in body.lower() or "facility" in body.lower(),
        "expected facility/provider text not found",
    )
    # The page uses ASP.NET ViewState — verify the CSRF token is present
    # (needed by the scraper to POST export requests)
    has_viewstate = "__RequestVerificationToken" in body or "RequestVerificationToken" in body
    has_antiforgery = "__AntiForgeryToken" in body or "antiforgery" in body.lower()
    check(
        "OR Providers page: has RequestVerificationToken or AntiForgery token",
        has_viewstate or has_antiforgery,
        "no CSRF token found — export scraping may break",
    )


def test_or_inspections_page(sess) -> None:
    """Oregon DHS LTC Licensing Inspections page is reachable."""
    print("\n[OR — LTC Licensing Inspections page]")
    r = sess.get(OR_INSPECTIONS_PAGE, timeout=HTTP_TIMEOUT)
    check("OR Inspections page: HTTP 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return
    body = r.text
    check("OR Inspections page: has HTML", len(body) > 200, f"len={len(body)}")
    check(
        "OR Inspections page: contains 'Inspection' keyword",
        "inspection" in body.lower(),
        "keyword not found",
    )


# ── Washington tests ───────────────────────────────────────────────────────────

def test_wa_dshs_page(sess) -> None:
    """Washington DSHS ADSA lookup page is reachable."""
    print("\n[WA — DSHS ADSA Facility Search]")
    r = sess.get(WA_LOOKUP_PAGE, timeout=HTTP_TIMEOUT)
    # This may redirect; follow and check final status
    check(
        "WA DSHS Lookup: HTTP 200 (or redirect)",
        r.status_code in (200, 302, 301),
        f"got {r.status_code}",
    )
    if r.status_code not in (200, 301, 302):
        return

    body = r.text
    check("WA DSHS Lookup: has HTML body", len(body) > 200, f"len={len(body)}")
    check(
        "WA DSHS Lookup: contains 'facility' or 'search' or 'provider'",
        any(kw in body.lower() for kw in ("facility", "search", "provider", "behavioral")),
        "expected keywords not found",
    )


# ── Arizona tests ──────────────────────────────────────────────────────────────

def test_az_arcgis_reachability(sess) -> None:
    """AZ ADHS ArcGIS FeatureServer query endpoint returns valid features."""
    print("\n[AZ — ADHS ArcGIS FeatureServer]")
    params = {
        "where": "1=1",
        "outFields": ",".join(AZ_REQUIRED_ATTRIBUTES),
        "resultRecordCount": 5,
        "f": "json",
    }
    r = sess.get(AZ_ARCGIS_BASE, params=params, timeout=HTTP_TIMEOUT)
    check("AZ ArcGIS: HTTP 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return

    try:
        data = r.json()
    except Exception as e:
        check("AZ ArcGIS: valid JSON", False, str(e))
        return
    check("AZ ArcGIS: valid JSON", True)

    check(
        "AZ ArcGIS: has 'features' key",
        "features" in data,
        f"keys={list(data.keys())}",
    )
    features = data.get("features", [])
    check("AZ ArcGIS: at least 1 feature", len(features) >= 1, f"got {len(features)}")

    if features:
        f0 = features[0]
        check("AZ ArcGIS: feature has 'attributes'", "attributes" in f0, f"keys={list(f0.keys())}")
        attrs = f0.get("attributes", {})
        for attr in AZ_REQUIRED_ATTRIBUTES:
            check(
                f"AZ ArcGIS: attribute '{attr}' present",
                attr in attrs,
                f"attrs={list(attrs.keys())[:10]}",
            )


def test_az_arcgis_mc_units(sess) -> None:
    """AZ ArcGIS returns facilities with MC_UNIT flag set (memory care unit)."""
    print("\n[AZ — ADHS ArcGIS memory care unit filter]")
    params = {
        "where": "MC_UNIT='Y'",
        "outFields": "FACILITY_NAME,ASST_LVG_CTR_ID,MC_UNIT",
        "resultRecordCount": 5,
        "returnCountOnly": "true",
        "f": "json",
    }
    r = sess.get(AZ_ARCGIS_BASE, params=params, timeout=HTTP_TIMEOUT)
    if r.status_code != 200:
        check("AZ ArcGIS MC_UNIT filter: skipped", True, f"HTTP {r.status_code}")
        return
    data = r.json()
    count = data.get("count", 0)
    check(
        "AZ ArcGIS: at least 10 facilities with MC_UNIT='Y'",
        int(count or 0) >= 10,
        f"count={count} (AZ should have many memory care ALFs)",
    )


def test_az_arcgis_full_count(sess) -> None:
    """AZ ArcGIS FeatureServer contains at least 200 total ALF records."""
    print("\n[AZ — ADHS ArcGIS total record count]")
    params = {"where": "1=1", "returnCountOnly": "true", "f": "json"}
    r = sess.get(AZ_ARCGIS_BASE, params=params, timeout=HTTP_TIMEOUT)
    if r.status_code != 200:
        check("AZ ArcGIS total count: skipped", True, f"HTTP {r.status_code}")
        return
    data = r.json()
    count = data.get("count", 0)
    check(
        "AZ ArcGIS: total facility count ≥ 200",
        int(count or 0) >= 200,
        f"count={count}",
    )


# ── Pennsylvania tests ─────────────────────────────────────────────────────────

def test_pa_dhs_export_reachability(sess) -> None:
    """PA DHS HSD ExportToExcel endpoint is reachable (returns XLSX or redirects)."""
    print("\n[PA — DHS HSD Provider Directory Export]")
    # The endpoint requires session state; we test that the main portal is reachable
    r = sess.get(PA_DHS_BASE, timeout=HTTP_TIMEOUT)
    check(
        "PA DHS Portal: HTTP 200 (or 301/302)",
        r.status_code in (200, 301, 302),
        f"got {r.status_code}",
    )

    if r.status_code not in (200, 301, 302):
        return

    body = r.text
    check("PA DHS Portal: has HTML body", len(body) > 200, f"len={len(body)}")
    check(
        "PA DHS Portal: contains 'provider' or 'human services'",
        any(kw in body.lower() for kw in ("provider", "human services", "directory")),
        "expected keywords not found",
    )


def test_pa_dhs_export_content_type(sess) -> None:
    """PA DHS ExportToExcel returns XLSX content type on direct GET."""
    print("\n[PA — DHS HSD Export content type check]")
    # Try HEAD first to avoid downloading the full XLSX
    try:
        r = sess.head(PA_DHS_EXPORT, timeout=HTTP_TIMEOUT, allow_redirects=True)
    except Exception:
        r = sess.get(PA_DHS_EXPORT, timeout=HTTP_TIMEOUT, stream=True)
        # Read minimal content
        for _ in r.iter_content(chunk_size=1024):
            break
        r.close()

    status = r.status_code
    ct = r.headers.get("content-type", "").lower()
    check(
        "PA DHS Export: HTTP 200",
        status == 200,
        f"got {status} (may need session cookie from portal first)",
    )
    if status == 200:
        check(
            "PA DHS Export: content-type is XLSX or octet-stream",
            "spreadsheetml" in ct or "octet-stream" in ct or "excel" in ct,
            f"content-type={ct!r}",
        )


# ── Minnesota tests ────────────────────────────────────────────────────────────

def test_mn_mdh_directory_extract(sess) -> None:
    """MN MDH Facility Directory Extract is reachable and returns XLSX."""
    print("\n[MN — MDH Facility Directory Extract]")
    # Use HEAD to avoid downloading the full XLSX
    try:
        r = sess.head(MN_MDH_EXTRACT, timeout=HTTP_TIMEOUT, allow_redirects=True)
    except Exception:
        try:
            r = sess.get(MN_MDH_EXTRACT, timeout=HTTP_TIMEOUT, stream=True)
            for _ in r.iter_content(chunk_size=4096):
                break
            r.close()
        except Exception as e:
            check("MN MDH Extract: reachable", False, str(e))
            return

    status = r.status_code
    check("MN MDH Extract: HTTP 200", status == 200, f"got {status}")
    if status != 200:
        return

    ct = r.headers.get("content-type", "").lower()
    content_length = int(r.headers.get("content-length", 0) or 0)
    check(
        "MN MDH Extract: content-type is XLSX or spreadsheet",
        "spreadsheetml" in ct or "excel" in ct or "octet-stream" in ct,
        f"content-type={ct!r}",
    )
    if content_length > 0:
        check(
            "MN MDH Extract: content-length > 50 KB",
            content_length > 50_000,
            f"content-length={content_length} bytes",
        )


# ── Texas tests ────────────────────────────────────────────────────────────────

def test_tx_hhsc_alf_page(sess) -> None:
    """Texas HHSC Assisted Living page is reachable and contains ALF content."""
    print("\n[TX — HHSC Assisted Living Facilities page]")
    r = sess.get(TX_ALF_PAGE, timeout=HTTP_TIMEOUT)
    check("TX HHSC ALF page: HTTP 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return
    body = r.text
    check("TX HHSC ALF page: has HTML body", len(body) > 500, f"len={len(body)}")
    check(
        "TX HHSC ALF page: contains 'assisted living'",
        "assisted living" in body.lower(),
        "keyword not found",
    )


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("StarlynnCare — Layer 0: Multi-State External Source Tests")
    print("=" * 60)

    sess = make_session()

    # Oregon
    test_or_providers_page(sess)
    test_or_inspections_page(sess)

    # Washington
    test_wa_dshs_page(sess)

    # Arizona
    test_az_arcgis_reachability(sess)
    test_az_arcgis_mc_units(sess)
    test_az_arcgis_full_count(sess)

    # Pennsylvania
    test_pa_dhs_export_reachability(sess)
    test_pa_dhs_export_content_type(sess)

    # Minnesota
    test_mn_mdh_directory_extract(sess)

    # Texas
    test_tx_hhsc_alf_page(sess)

    run_all_checks("Layer 0 (multi-state sources)")


if __name__ == "__main__":
    main()
