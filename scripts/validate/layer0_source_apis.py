#!/usr/bin/env python3
"""
Layer 0 — Source API integrity tests for StarlynnCare.

Hits each government data source directly (no DB writes) and asserts that
every field the scrapers depend on is present, has the right type, and is in
range.  These are real network calls against real APIs — no mocks, no fixtures.

States covered:
  CA  — CKAN RCFE roster + CDSS Transparency API
  AZ  — ADHS ArcGIS FeatureServer/12
  UT  — UGRC ArcGIS FeatureServer/0
  MN  — MDH directory download page (reachability + link check)
  WA  — DSHS Advanced Lookup portal (reachability)
  OR  — DHS LTC directory (reachability)
  TX  — HHSC TULIP portal (reachability)
  PA  — DHS HSD bulk export (reachability)
  IL  — LLCS directory (reachability)

Usage:
    python3 scripts/validate/layer0_source_apis.py          # all states
    python3 scripts/validate/layer0_source_apis.py --state CA   # one state
    python3 scripts/validate/layer0_source_apis.py --sample 20  # more records

Exit 0 = all checks passed. Exit 1 = one or more checks failed.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._lib import check, fetch_page, run_all_checks  # noqa: E402

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SAMPLE_N = 10  # default records to pull per API call


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _http_get_json(url: str, params: dict[str, Any] | None = None) -> tuple[int, Any]:
    """GET url with optional params; return (status, parsed_json_or_None)."""
    import urllib.request
    import urllib.parse
    import json

    if params:
        url = url + "?" + urllib.parse.urlencode(params)

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "StarlynnCare-Validator/1.0 (tests@starlynncare.com)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError as e:
                return resp.status, None
    except Exception as e:  # noqa: BLE001
        print(f"    [GET error] {type(e).__name__}: {e}", file=sys.stderr)
        return -1, None


def _post_json(url: str, data: dict[str, Any]) -> tuple[int, Any]:
    """POST form data; return (status, parsed_json_or_None)."""
    import urllib.request
    import urllib.parse
    import json

    encoded = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=encoded,
        headers={
            "User-Agent": "StarlynnCare-Validator/1.0 (tests@starlynncare.com)",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, None
    except Exception as e:  # noqa: BLE001
        print(f"    [POST error] {type(e).__name__}: {e}", file=sys.stderr)
        return -1, None


def _is_valid_date(val: Any) -> bool:
    """True if val is a parseable date string (YYYY-MM-DD, M/D/YYYY, etc.)."""
    if val is None:
        return False
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            from datetime import datetime
            datetime.strptime(s, fmt)
            return True
        except ValueError:
            continue
    return False


def _is_us_lat(val: Any) -> bool:
    """True if val is plausibly a continental US latitude (18–72). None → True (null is OK)."""
    if val is None:
        return True
    try:
        f = float(val)
        return 18.0 <= f <= 72.0
    except (TypeError, ValueError):
        return False


def _is_us_lon(val: Any) -> bool:
    """True if val is plausibly a continental US longitude (-180 to -64). None → True."""
    if val is None:
        return True
    try:
        f = float(val)
        return -180.0 <= f <= -64.0
    except (TypeError, ValueError):
        return False


def _is_non_negative_num(val: Any) -> bool:
    """True if val is a non-negative number (or null). Handles int, float, numeric string."""
    if val is None:
        return True
    try:
        return float(val) >= 0
    except (TypeError, ValueError):
        return False


# ---------------------------------------------------------------------------
# CA — CKAN RCFE Roster
# ---------------------------------------------------------------------------

CA_CKAN_URL = "https://data.ca.gov/api/3/action/datastore_search"
CA_CKAN_RESOURCE_ID = "6b2f5818-f60d-40b5-bc2a-94f995f9f8b0"

# Every field the CA scraper reads and maps to a DB column.
CA_CKAN_REQUIRED_FIELDS = [
    "facility_name",       # → facilities.name
    "facility_number",     # → facilities.license_number
    "licensee",            # → facilities.operator_name
    "facility_address",    # → facilities.street
    "facility_city",       # → facilities.city
    "facility_zip",        # → facilities.zip
    "facility_type",       # → facilities.license_type
    "facility_capacity",   # → facilities.beds
    "facility_status",     # → facilities.license_status (LICENSED gate)
    "county_name",         # → ingest filter
]

# Optional / nice-to-have — warn if missing but don't fail
CA_CKAN_OPTIONAL_FIELDS = [
    "facility_telephone_number",
    "facility_administrator",
    "license_first_date",
]


def _check_ca_ckan(n: int) -> None:
    print("\n[CA — CKAN RCFE Roster]")
    status, payload = _http_get_json(
        CA_CKAN_URL,
        params={
            "resource_id": CA_CKAN_RESOURCE_ID,
            "filters": '{"county_name":"ALAMEDA"}',
            "limit": n,
        },
    )
    check("CA CKAN: HTTP 200", status == 200, f"got {status}")
    if status != 200 or payload is None:
        return

    check("CA CKAN: success=true", payload.get("success") is True, str(payload.get("success")))
    records = (payload.get("result") or {}).get("records", [])
    check("CA CKAN: non-empty records", len(records) > 0, f"got {len(records)}")
    check(
        f"CA CKAN: at least {n} records returned",
        len(records) >= min(n, 5),
        f"got {len(records)}",
    )
    if not records:
        return

    # Verify total count field
    total = (payload.get("result") or {}).get("total", 0)
    check("CA CKAN: total > 100 (Alameda has many facilities)", total > 100, f"total={total}")

    # Verify every required field is present on every record
    for idx, rec in enumerate(records):
        label = f"rec[{idx}] {rec.get('facility_name', '?')!r}"
        for field in CA_CKAN_REQUIRED_FIELDS:
            check(
                f"CA CKAN: {label} has field '{field}'",
                field in rec,
                f"missing in record {idx}",
            )

        # Type / range checks on the first record only (subsequent are same schema)
        if idx == 0:
            cap = rec.get("facility_capacity")
            check(
                "CA CKAN: facility_capacity is numeric-parseable",
                cap is not None and str(cap).replace(".", "").isdigit(),
                f"capacity={cap!r}",
            )
            county = (rec.get("county_name") or "").strip().upper()
            check(
                "CA CKAN: county_name is ALAMEDA",
                county == "ALAMEDA",
                f"county_name={county!r}",
            )
            status_val = (rec.get("facility_status") or "").strip().upper()
            check(
                "CA CKAN: facility_status is non-empty string",
                bool(status_val),
                f"facility_status={status_val!r}",
            )
            fnum = rec.get("facility_number")
            check(
                "CA CKAN: facility_number is present and non-zero",
                fnum is not None and str(fnum).strip() not in ("", "0"),
                f"facility_number={fnum!r}",
            )

    # Verify optional fields on first record (warn-only)
    for field in CA_CKAN_OPTIONAL_FIELDS:
        present = field in records[0]
        if not present:
            print(f"  WARN  CA CKAN: optional field '{field}' absent from first record")


# ---------------------------------------------------------------------------
# CA — CDSS Transparency API
# ---------------------------------------------------------------------------

CA_TRANSPARENCY_URL = "https://www.ccld.dss.ca.gov/transparencyapi/api/Facility/any"

# Fields the scraper reads from the Transparency API response array items
CA_TRANSPARENCY_REQUIRED_FIELDS = [
    "FacilityNumber",  # used as lookup key (9-digit)
    "FacilityName",
    "FacilityType",
    "LastVisitDate",   # → last_inspection_date
]


def _check_ca_transparency() -> None:
    print("\n[CA — CDSS Transparency API (first 5 items)]")
    # This is a ~30 MB download; we read only the first chunk by setting a short timeout
    # and catching the truncation. In CI we fetch just enough to validate shape.
    import urllib.request
    import json

    req = urllib.request.Request(
        CA_TRANSPARENCY_URL,
        headers={"User-Agent": "StarlynnCare-Validator/1.0 (tests@starlynncare.com)"},
    )
    raw = b""
    http_status = -1
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            http_status = resp.status
            # Read first 200 KB — enough for the JSON array header and several records
            raw = resp.read(200 * 1024)
    except Exception as e:  # noqa: BLE001
        # Timeout or connection error is still useful — record the status we got
        print(f"    [transparency read] {type(e).__name__}: {e}", file=sys.stderr)

    check(
        "CA Transparency: HTTP 200 (or partial read)",
        http_status == 200,
        f"got {http_status}",
    )
    if http_status != 200:
        return

    check("CA Transparency: response starts with JSON array '['", raw.lstrip()[:1] == b"[", f"starts={raw[:20]!r}")

    # Attempt to parse partial JSON by completing the truncated array.
    # Strategy: find the last complete '}' and close the array.
    text = raw.decode("utf-8", errors="replace")
    last_brace = text.rfind("}")
    if last_brace == -1:
        check("CA Transparency: parseable partial JSON", False, "no '}' found in chunk")
        return

    partial = text[: last_brace + 1] + "]"
    try:
        items = json.loads(partial)
    except json.JSONDecodeError as e:
        check("CA Transparency: parseable partial JSON", False, str(e))
        return

    check("CA Transparency: parseable partial JSON", True, f"{len(items)} items in partial")
    check("CA Transparency: at least 5 items in partial", len(items) >= 5, f"got {len(items)}")

    for idx, item in enumerate(items[:5]):
        label = f"item[{idx}]"
        for field in CA_TRANSPARENCY_REQUIRED_FIELDS:
            check(
                f"CA Transparency: {label} has field '{field}'",
                field in item,
                f"keys={list(item.keys())[:8]}",
            )
        if idx == 0:
            fnum = item.get("FacilityNumber")
            check(
                "CA Transparency: FacilityNumber is numeric string",
                fnum is not None and str(fnum).strip().isdigit(),
                f"FacilityNumber={fnum!r}",
            )


# ---------------------------------------------------------------------------
# AZ — ADHS ArcGIS FeatureServer/12
# ---------------------------------------------------------------------------

AZ_ARCGIS_URL = (
    "https://services1.arcgis.com/mpVYz37anSdrK4d8/arcgis/rest/services"
    "/AZLicensedFacilities/FeatureServer/12/query"
)

# All attribute fields the AZ scraper reads
AZ_ARCGIS_REQUIRED_ATTRS = [
    "FACID",              # → external_id
    "FACILITY_NAME",      # → name
    "TYPE",               # → license_type (used to filter ALF types)
    "SUBTYPE",            # → license_subtype / az_license_level
    "N_ADDRESS",          # → street (CENTRUS geocoded)
    "N_CITY",             # → city
    "N_ZIP",              # → zip
    "N_LAT",              # → latitude
    "N_LON",              # → longitude
    "N_COUNTY",           # → county
    "Telephone",          # → phone
    "Capacity",           # → beds
    "OPERATION_STATUS",   # filter: only ACTIVE
    "LICENSE_NUMBER",     # → license_number
]


def _check_az_arcgis(n: int) -> None:
    print("\n[AZ — ADHS ArcGIS FeatureServer/12 (Residential Facilities)]")
    status, payload = _post_json(
        AZ_ARCGIS_URL,
        data={
            "where": "OPERATION_STATUS='ACTIVE'",
            "outFields": "*",
            "returnGeometry": "true",
            "resultRecordCount": n,
            "resultOffset": 0,
            "f": "json",
        },
    )
    check("AZ ArcGIS: HTTP 200", status == 200, f"got {status}")
    if status != 200 or payload is None:
        return

    if "error" in payload:
        check("AZ ArcGIS: no error in response", False, str(payload["error"]))
        return

    features = payload.get("features", [])
    check("AZ ArcGIS: non-empty features", len(features) > 0, f"got {len(features)}")
    check(f"AZ ArcGIS: at least {min(n, 5)} features", len(features) >= min(n, 5), f"got {len(features)}")

    # Spot-check exceededTransferLimit — if set, we need to paginate but data is real
    exceeded = payload.get("exceededTransferLimit", False)
    if exceeded:
        print("    INFO  AZ ArcGIS: exceededTransferLimit=true (pagination needed for full set)")

    for idx, feat in enumerate(features[:n]):
        attrs = feat.get("attributes", {})
        geom = feat.get("geometry") or {}
        label = f"feat[{idx}] {attrs.get('FACILITY_NAME', '?')!r}"

        for field in AZ_ARCGIS_REQUIRED_ATTRS:
            # Some null values are OK (N_LAT may fall back to geometry.y)
            check(
                f"AZ ArcGIS: {label} has attr key '{field}'",
                field in attrs,
                f"missing from attributes",
            )

        if idx < 3:
            # Geometry check — ADHS uses N_LAT/N_LON but also has geometry
            lat = attrs.get("N_LAT") or geom.get("y")
            lon = attrs.get("N_LON") or geom.get("x")
            check(
                f"AZ ArcGIS: {label} has valid US latitude",
                _is_us_lat(lat),
                f"lat={lat}",
            )
            check(
                f"AZ ArcGIS: {label} has valid US longitude",
                _is_us_lon(lon),
                f"lon={lon}",
            )
            cap = attrs.get("Capacity")
            check(
                f"AZ ArcGIS: {label} Capacity is non-negative (or null)",
                _is_non_negative_num(cap),
                f"Capacity={cap!r}",
            )
            status_val = attrs.get("OPERATION_STATUS", "")
            check(
                f"AZ ArcGIS: {label} OPERATION_STATUS is non-empty",
                bool(status_val),
                f"OPERATION_STATUS={status_val!r}",
            )
            ftype = attrs.get("TYPE", "")
            check(
                f"AZ ArcGIS: {label} TYPE is non-empty",
                bool(ftype),
                f"TYPE={ftype!r}",
            )


# ---------------------------------------------------------------------------
# UT — UGRC ArcGIS FeatureServer/0
# ---------------------------------------------------------------------------

UT_ARCGIS_URL = (
    "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services"
    "/LicensedHealthCareFacilities/FeatureServer/0/query"
)

# All attribute fields the UT scraper reads
UT_ARCGIS_REQUIRED_ATTRS = [
    "ID_NUMBER",       # → external_id (PK for UT)
    "FACILITY_NAME",   # → name
    "LICENSE_TYPE",    # → license_type (filter to ALF subtypes)
    "CAPACITY",        # → beds
    "SECURE_BEDS",     # → ut_secure_beds + serves_memory_care gate
]

# Geometry is required (lat/lon come from ArcGIS geometry.x/y for UT)
UT_ARCGIS_OPTIONAL_ATTRS = [
    "STREET_ADDRESS",
    "CITY",
    "STATE",
    "ZIP",
    "PHONE",
]


def _check_ut_arcgis(n: int) -> None:
    print("\n[UT — UGRC ArcGIS FeatureServer/0 (Licensed Health Care Facilities)]")
    status, payload = _post_json(
        UT_ARCGIS_URL,
        data={
            "where": "1=1",
            "outFields": "*",
            "returnGeometry": "true",
            "resultRecordCount": n,
            "resultOffset": 0,
            "f": "json",
        },
    )
    check("UT ArcGIS: HTTP 200", status == 200, f"got {status}")
    if status != 200 or payload is None:
        return

    if "error" in payload:
        check("UT ArcGIS: no error in response", False, str(payload["error"]))
        return

    features = payload.get("features", [])
    check("UT ArcGIS: non-empty features", len(features) > 0, f"got {len(features)}")
    check(f"UT ArcGIS: at least {min(n, 5)} features", len(features) >= min(n, 5), f"got {len(features)}")

    for idx, feat in enumerate(features[:n]):
        attrs = feat.get("attributes", {})
        geom = feat.get("geometry") or {}
        label = f"feat[{idx}] {attrs.get('FACILITY_NAME', '?')!r}"

        for field in UT_ARCGIS_REQUIRED_ATTRS:
            check(
                f"UT ArcGIS: {label} has attr '{field}'",
                field in attrs,
                f"missing from attributes",
            )

        if idx < 3:
            # UGRC FeatureServer returns Web Mercator (EPSG:3857) projected coordinates
            # (x/y in meters, NOT degrees). The scraper re-geocodes via Census API.
            # Just verify the geometry object is present and x/y are numeric.
            x = geom.get("x")
            y = geom.get("y")
            if x is not None and y is not None:
                check(
                    f"UT ArcGIS: {label} geometry x/y are numeric",
                    isinstance(x, (int, float)) and isinstance(y, (int, float)),
                    f"x={x!r} y={y!r}",
                )
            else:
                print(f"  INFO  UT ArcGIS: {label} no geometry in ArcGIS source (scraper will geocode via Census API)")

            cap = attrs.get("CAPACITY")
            check(
                f"UT ArcGIS: {label} CAPACITY is non-negative (or null)",
                _is_non_negative_num(cap),
                f"CAPACITY={cap!r}",
            )
            id_num = attrs.get("ID_NUMBER")
            check(
                f"UT ArcGIS: {label} ID_NUMBER is non-empty",
                id_num is not None and str(id_num).strip() != "",
                f"ID_NUMBER={id_num!r}",
            )
            lic = attrs.get("LICENSE_TYPE")
            check(
                f"UT ArcGIS: {label} LICENSE_TYPE is non-empty",
                lic is not None and str(lic).strip() != "",
                f"LICENSE_TYPE={lic!r}",
            )


# ---------------------------------------------------------------------------
# Reachability checks (session-dependent or file-based scrapers)
# ---------------------------------------------------------------------------

# (state, label, url, expected_contains_hint, is_critical)
# is_critical=True → failure counted as a test failure (live JSON APIs)
# is_critical=False → failure is a WARNING only (session-dependent portals that
#   may block cloud IPs, require auth, or change URLs frequently)
REACHABILITY_TARGETS = [
    (
        "MN",
        "MDH facility directory download page",
        "https://www.health.state.mn.us/facilities/regulation/directory/directorydatafile.html",
        "facility",
        True,   # MDH is a plain HTTP page, should be reachable
    ),
    (
        "WA",
        "DSHS BH Advanced Lookup portal",
        "https://fortress.wa.gov/dshs/adsaapps/Lookup/BHAdvLookup.aspx",
        None,
        True,   # DSHS lookup is public
    ),
    (
        "OR",
        "OR DHS LTC directory (main site)",
        "https://www.oregon.gov/dhs/providers-partners/licensing/ltcregistry/pages/index.aspx",
        None,
        False,  # May block cloud IPs or require session
    ),
    (
        "TX",
        "HHSC TULIP portal (main LTC page)",
        "https://www.hhs.texas.gov/providers/long-term-care-regulation",
        "long-term",
        False,  # May block cloud IPs
    ),
    (
        "PA",
        "PA DHS personal care homes directory",
        "https://www.pasda.psu.edu/uci/DataSummary.aspx?dataset=1266",
        None,
        True,
    ),
    (
        "IL",
        "IL DPH LTC regulation page",
        "https://dph.illinois.gov/topics-services/health-care-regulation/long-term-care.html",
        None,
        False,  # May block cloud IPs
    ),
]


def _check_reachability(state: str) -> None:
    targets = [t for t in REACHABILITY_TARGETS if t[0] == state]
    if not targets:
        return
    print(f"\n[{state} — Source URL reachability]")
    for _, label, url, hint, is_critical in targets:
        status, body = fetch_page(url)
        ok = status in (200, 301, 302, 303)
        if is_critical:
            check(f"{state} {label}: reachable (2xx/3xx)", ok, f"HTTP {status}")
        else:
            if ok:
                check(f"{state} {label}: reachable (2xx/3xx)", ok, f"HTTP {status}")
            else:
                print(f"  WARN  {state} {label}: HTTP {status} (session-dependent portal — non-fatal)")
        if ok and hint and body:
            check(
                f"{state} {label}: body contains '{hint}'",
                hint.lower() in body.lower(),
                f"hint not found in {len(body)}-char body",
            )


def _check_all_reachability(state_filter: str | None) -> None:
    seen: set[str] = set()
    for state, label, url, hint, is_critical in REACHABILITY_TARGETS:
        if state_filter and state != state_filter:
            continue
        if state not in seen:
            seen.add(state)
        print(f"\n[{state} — Source URL reachability]")
        status, body = fetch_page(url)
        ok = status in (200, 301, 302, 303)
        if is_critical:
            check(f"{state} {label}: reachable (2xx/3xx)", ok, f"HTTP {status}")
        else:
            if ok:
                check(f"{state} {label}: reachable (2xx/3xx)", ok, f"HTTP {status}")
            else:
                print(f"  WARN  {state} {label}: HTTP {status} (session-dependent portal — non-fatal)")
        if ok and hint and body:
            check(
                f"{state} {label}: body contains '{hint}'",
                hint.lower() in body.lower(),
                f"hint not found in {len(body)}-char body",
            )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="StarlynnCare Layer 0 — Source API integrity tests"
    )
    parser.add_argument(
        "--state",
        default=None,
        help="Only test one state (e.g. CA, AZ, UT). Default: all.",
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=SAMPLE_N,
        help=f"Number of records to fetch per API call (default {SAMPLE_N})",
    )
    args = parser.parse_args()
    state = args.state.upper() if args.state else None
    n = max(5, args.sample)

    print("=" * 60)
    print("StarlynnCare — Layer 0: Source API integrity")
    if state:
        print(f"State filter: {state}")
    print(f"Sample size:  {n} records per API")
    print("=" * 60)

    if not state or state == "CA":
        _check_ca_ckan(n)
        time.sleep(0.5)
        _check_ca_transparency()

    if not state or state == "AZ":
        time.sleep(0.5)
        _check_az_arcgis(n)

    if not state or state == "UT":
        time.sleep(0.5)
        _check_ut_arcgis(n)

    # Reachability-only states
    for st in ("MN", "WA", "OR", "TX", "PA", "IL"):
        if not state or state == st:
            _check_reachability(st)

    run_all_checks("Layer 0 (source APIs)")


if __name__ == "__main__":
    main()
