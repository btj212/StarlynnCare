"""
Tests: Utah UGRC ArcGIS Feature Service
Source: https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/
        LicensedHealthCareFacilities/FeatureServer/0/query

Verifies the ArcGIS FeatureServer returns facility features with the expected
geometry and attribute structure for the UT ingest pipeline.
"""

from __future__ import annotations

import pytest
import requests

ARCGIS_URL = (
    "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services"
    "/LicensedHealthCareFacilities/FeatureServer/0/query"
)

# Attribute fields the ut_arcgis_facilities_ingest.py script reads.
# Actual ArcGIS layer fields (verified 2026-06): no STATUS or FAC_TYPE columns;
# license type is LICENSE_TYPE, license status is tracked via LICENSE_EXPIRATION_DATE.
REQUIRED_ATTRIBUTES = {
    "ID_NUMBER",              # facility license / identifier (primary key)
    "FACILITY_NAME",          # display name
    "ADDRESS",                # street address
    "CITY",                   # city
    "ZIP",                    # zip code
    "LICENSE_TYPE",           # license / facility type (replaces FAC_TYPE)
    "CAPACITY",               # bed count
    "LICENSE_EXPIRATION_DATE",  # license validity indicator
}


@pytest.fixture(scope="module")
def arcgis_sample(http_session: requests.Session) -> list[dict]:
    """Fetch a 10-record sample from the ArcGIS feature service (no geometry needed)."""
    resp = http_session.post(
        ARCGIS_URL,
        data={
            "where": "1=1",
            "outFields": "*",
            "returnGeometry": "true",
            "resultRecordCount": 10,
            "f": "json",
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        pytest.fail(f"ArcGIS API error: {data['error']}")
    return data.get("features", [])


@pytest.mark.external_api
def test_arcgis_endpoint_responds(http_session: requests.Session) -> None:
    """ArcGIS feature service returns HTTP 200 for a count query."""
    resp = http_session.post(
        ARCGIS_URL,
        data={"where": "1=1", "returnCountOnly": "true", "f": "json"},
        timeout=30,
    )
    assert resp.status_code == 200, f"ArcGIS returned {resp.status_code}"
    body = resp.json()
    assert "count" in body or "features" in body, (
        f"Unexpected ArcGIS response shape: {list(body.keys())}"
    )


@pytest.mark.external_api
def test_arcgis_facility_count_is_substantial(http_session: requests.Session) -> None:
    """ArcGIS service has at least 500 UT health care facilities."""
    resp = http_session.post(
        ARCGIS_URL,
        data={"where": "1=1", "returnCountOnly": "true", "f": "json"},
        timeout=30,
    )
    body = resp.json()
    count = body.get("count", 0)
    assert count >= 500, (
        f"Expected ≥500 UT facilities in ArcGIS, got {count}. "
        "Service may be down or filtered."
    )


@pytest.mark.external_api
def test_arcgis_record_has_required_attributes(arcgis_sample: list[dict]) -> None:
    """Each feature has all attribute fields the ingest script reads."""
    assert arcgis_sample, "No features returned from ArcGIS"
    for feature in arcgis_sample:
        attrs = feature.get("attributes", {})
        missing = REQUIRED_ATTRIBUTES - set(attrs.keys())
        assert not missing, (
            f"ArcGIS feature missing attributes: {missing}\n"
            f"Available: {sorted(attrs.keys())}"
        )


@pytest.mark.external_api
def test_arcgis_record_has_geometry(arcgis_sample: list[dict]) -> None:
    """Each feature has geometry with x (longitude) and y (latitude)."""
    assert arcgis_sample, "No features returned"
    for feature in arcgis_sample:
        geom = feature.get("geometry")
        assert geom is not None, f"Feature missing geometry: {feature.get('attributes', {}).get('ID_NUMBER')}"
        assert "x" in geom and "y" in geom, f"Geometry missing x/y: {geom}"
        # ArcGIS layer uses Web Mercator (EPSG:3857 / WKID 102100).
        # Utah in Web Mercator: x ≈ -12,700,000 to -12,100,000; y ≈ 4,400,000 to 5,250,000
        x, y = geom["x"], geom["y"]
        if x and y:
            assert -13_000_000 < x < -11_500_000, f"Web Mercator X {x} out of Utah range"
            assert 4_000_000 < y < 5_500_000, f"Web Mercator Y {y} out of Utah range"


@pytest.mark.external_api
def test_arcgis_id_number_non_empty(arcgis_sample: list[dict]) -> None:
    """ID_NUMBER (primary key for UT facilities) is non-empty on all sampled features."""
    assert arcgis_sample, "No features returned"
    nulls = [
        f for f in arcgis_sample
        if not f.get("attributes", {}).get("ID_NUMBER")
    ]
    assert not nulls, f"{len(nulls)} ArcGIS features have empty ID_NUMBER"


@pytest.mark.external_api
def test_arcgis_capacity_is_numeric_or_null(arcgis_sample: list[dict]) -> None:
    """CAPACITY is an integer or null — never a free-form string."""
    assert arcgis_sample, "No features returned"
    bad = []
    for f in arcgis_sample:
        cap = f.get("attributes", {}).get("CAPACITY")
        if cap is None:
            continue
        if not isinstance(cap, (int, float)):
            try:
                int(float(str(cap)))
            except (ValueError, TypeError):
                bad.append((f.get("attributes", {}).get("ID_NUMBER"), cap))
    assert not bad, f"Non-numeric CAPACITY values: {bad}"
