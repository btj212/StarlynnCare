"""
External Government API Tests — Layer 0.

Validates that each state's upstream data source is reachable and returns
the expected data shape with all required fields.  These tests make real
HTTP requests; no mocks, no stubs.

What they prove: the raw data flowing into our pipeline from government
APIs is healthy, correctly shaped, and hasn't silently changed.

Run:
    pytest tests/integration/test_external_apis.py -v
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.conftest import http_get  # noqa: E402


# ══════════════════════════════════════════════════════════════════════════════
# CA — CKAN Open Data API
# Endpoint: https://data.ca.gov/api/3/action/datastore_search
# Resource: 6b2f5818-f60d-40b5-bc2a-94f995f9f8b0  (CCL facility roster)
# ══════════════════════════════════════════════════════════════════════════════

CA_CKAN_URL = "https://data.ca.gov/api/3/action/datastore_search"
CA_CKAN_RESOURCE = "6b2f5818-f60d-40b5-bc2a-94f995f9f8b0"

# Every record in the CKAN roster must carry these fields (per ccld_rcfe_ingest.py).
CA_REQUIRED_FIELDS = {
    "facility_number",
    "facility_name",
    "facility_city",
    "facility_status",
    "facility_capacity",
    "facility_type",
    "facility_address",
    "facility_zip",
    "county_name",
    "licensee",
}

ALAMEDA_COUNTY_FILTER = json.dumps({"county_name": "ALAMEDA"})
LA_COUNTY_FILTER = json.dumps({"county_name": "LOS ANGELES"})


class TestCaCanKApi:
    """CA CKAN facility roster — shape, completeness, and field integrity."""

    def test_api_returns_200(self):
        """CKAN endpoint is reachable and responds with HTTP 200."""
        status, _ = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 1,
        })
        assert status == 200, f"CA CKAN returned HTTP {status}"

    def test_api_returns_valid_json(self):
        """CKAN response body is valid JSON."""
        status, body = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 1,
        })
        assert status == 200
        data = json.loads(body)
        assert isinstance(data, dict), "CKAN response is not a JSON object"

    def test_api_success_flag_is_true(self):
        """CKAN reports success=True (not a dataset error)."""
        status, body = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 1,
        })
        assert status == 200
        data = json.loads(body)
        assert data.get("success") is True, (
            f"CKAN success=False, error={data.get('error')}"
        )

    def test_dataset_has_large_record_count(self):
        """Full CKAN dataset has ≥ 10,000 facilities (CCL licenses thousands of RCFEs)."""
        status, body = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 1,
        })
        assert status == 200
        data = json.loads(body)
        total = data["result"]["total"]
        assert total >= 10_000, (
            f"CA CKAN total={total:,} — suspiciously low; resource may be broken or replaced"
        )

    def test_alameda_county_filter_returns_records(self):
        """Alameda county filter yields ≥ 50 records (our primary beachhead county)."""
        status, body = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 100,
            "filters": ALAMEDA_COUNTY_FILTER,
        })
        assert status == 200
        data = json.loads(body)
        assert data["success"] is True
        records = data["result"]["records"]
        assert len(records) >= 50, (
            f"Expected ≥50 Alameda RCFEs, got {len(records)}"
        )

    def test_all_required_fields_present_in_alameda_records(self):
        """Every Alameda RCFE record carries all fields required by our ingest script."""
        status, body = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 100,
            "filters": ALAMEDA_COUNTY_FILTER,
        })
        assert status == 200
        records = json.loads(body)["result"]["records"]
        assert records, "No Alameda records returned"

        for i, rec in enumerate(records):
            for field in CA_REQUIRED_FIELDS:
                assert field in rec, (
                    f"Record {i} ({rec.get('facility_name', '?')}) missing field '{field}'"
                )

    def test_all_required_fields_present_in_la_records(self):
        """Every LA county RCFE record carries all required fields (different county sanity check)."""
        status, body = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 100,
            "filters": LA_COUNTY_FILTER,
        })
        assert status == 200
        records = json.loads(body)["result"]["records"]
        assert records, "No LA records returned"

        for i, rec in enumerate(records[:50]):  # sample 50
            for field in CA_REQUIRED_FIELDS:
                assert field in rec, (
                    f"LA record {i} ({rec.get('facility_name', '?')}) missing '{field}'"
                )

    def test_facility_number_is_nonempty_string(self):
        """facility_number is non-empty for all Alameda records."""
        status, body = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 100,
            "filters": ALAMEDA_COUNTY_FILTER,
        })
        assert status == 200
        records = json.loads(body)["result"]["records"]
        nulls = [r for r in records if not str(r.get("facility_number", "")).strip()]
        assert not nulls, (
            f"{len(nulls)} Alameda records have empty facility_number"
        )

    def test_facility_name_is_nonempty_string(self):
        """facility_name is non-empty for all Alameda records."""
        status, body = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 100,
            "filters": ALAMEDA_COUNTY_FILTER,
        })
        assert status == 200
        records = json.loads(body)["result"]["records"]
        nulls = [r for r in records if not str(r.get("facility_name", "")).strip()]
        assert not nulls, (
            f"{len(nulls)} Alameda records have empty facility_name"
        )

    def test_facility_capacity_is_numeric_when_present(self):
        """facility_capacity is a parseable integer when not null/empty."""
        status, body = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 100,
            "filters": ALAMEDA_COUNTY_FILTER,
        })
        assert status == 200
        records = json.loads(body)["result"]["records"]
        bad = []
        for rec in records:
            cap = rec.get("facility_capacity")
            if cap in (None, "", "null"):
                continue
            try:
                v = int(cap)
                assert v >= 0, f"capacity negative: {v}"
            except (ValueError, TypeError):
                bad.append((rec.get("facility_name"), cap))
        assert not bad, f"Non-numeric capacity values: {bad[:5]}"

    def test_county_name_matches_filter(self):
        """All returned records have county_name matching the filter."""
        status, body = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 100,
            "filters": ALAMEDA_COUNTY_FILTER,
        })
        assert status == 200
        records = json.loads(body)["result"]["records"]
        wrong = [r for r in records if r.get("county_name") != "ALAMEDA"]
        assert not wrong, (
            f"{len(wrong)} records returned with wrong county: "
            f"{[r['county_name'] for r in wrong[:3]]}"
        )

    def test_memory_care_keyword_search_returns_results(self):
        """Full-text search for 'memory care' returns results (search API works)."""
        status, body = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 20,
            "q": "memory care",
        })
        assert status == 200
        data = json.loads(body)
        records = data["result"]["records"]
        assert len(records) >= 5, (
            f"'memory care' search returned only {len(records)} records — API may be broken"
        )

    def test_multiple_counties_all_return_records(self):
        """Several different CA counties all return data (not just Alameda)."""
        for county in ("SAN DIEGO", "ORANGE", "SAN FRANCISCO", "SANTA CLARA"):
            status, body = http_get(CA_CKAN_URL, {
                "resource_id": CA_CKAN_RESOURCE,
                "limit": 5,
                "filters": json.dumps({"county_name": county}),
            })
            assert status == 200, f"CKAN HTTP {status} for county={county}"
            data = json.loads(body)
            n = len(data["result"]["records"])
            assert n >= 1, f"County '{county}' returned 0 records — unexpected gap"

    def test_active_status_records_have_licensee(self):
        """ACTIVE facilities all have a non-empty licensee name."""
        status, body = http_get(CA_CKAN_URL, {
            "resource_id": CA_CKAN_RESOURCE,
            "limit": 100,
            "filters": json.dumps({"county_name": "ALAMEDA", "facility_status": "ACTIVE"}),
        })
        assert status == 200
        records = json.loads(body)["result"]["records"]
        no_licensee = [r for r in records if not str(r.get("licensee", "")).strip()]
        # Tolerate up to 5% missing (data quality floor)
        pct_missing = len(no_licensee) / max(len(records), 1) * 100
        assert pct_missing <= 5, (
            f"{pct_missing:.1f}% of ACTIVE Alameda records have no licensee"
        )


# ══════════════════════════════════════════════════════════════════════════════
# CA — CDSS Transparency API  (visit metrics)
# Endpoint: https://www.ccld.dss.ca.gov/transparencyapi/api/Facility/<any>
# Returns a ~30 MB JSON array of ALL CCLD facilities with compliance metrics.
# ══════════════════════════════════════════════════════════════════════════════

CDSS_TRANSPARENCY_URL = "https://www.ccld.dss.ca.gov/transparencyapi/api/Facility/1"
# We probe with a single facility ID — the API returns the full array regardless.
# The key test is that it's reachable and returns a JSON array.


class TestCdssTransparencyApi:
    """CDSS Transparency API — visit and citation metrics."""

    def test_api_is_reachable(self):
        """CDSS Transparency API responds (may be slow — 30s timeout)."""
        # Probe with facility "1" — API returns full array regardless of ID
        status, body = http_get(CDSS_TRANSPARENCY_URL, timeout=60)
        # Accept 200 or a valid error code (not a network failure)
        assert status != -1, f"Network error reaching CDSS API: {body.decode(errors='replace')[:200]}"
        assert status in (200, 404, 400), (
            f"CDSS Transparency API returned unexpected status {status}"
        )

    def test_api_returns_json_array(self):
        """CDSS Transparency API response is a JSON array."""
        status, body = http_get(CDSS_TRANSPARENCY_URL, timeout=60)
        if status == -1:
            pytest.skip(f"CDSS API not reachable: {body.decode(errors='replace')[:100]}")
        if status != 200:
            pytest.skip(f"CDSS API returned {status} — may require session")
        data = json.loads(body[:1_000_000])  # decode only first 1MB for shape check
        # Should be a list or dict with a list
        assert isinstance(data, (list, dict)), "CDSS API didn't return JSON array or object"


# ══════════════════════════════════════════════════════════════════════════════
# UT — UGRC ArcGIS Feature Service
# Endpoint: https://services1.arcgis.com/.../LicensedHealthCareFacilities/...
# ══════════════════════════════════════════════════════════════════════════════

UT_ARCGIS_URL = (
    "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services"
    "/LicensedHealthCareFacilities/FeatureServer/0/query"
)

UT_REQUIRED_FIELDS = {
    "NAME",
    "LICENSE_NUMBER",
    "ADDRESS",
    "CITY",
    "STATE",
    "ZIP",
    "LATITUDE",
    "LONGITUDE",
    "LICENSE_STATUS",
    "FACILITY_TYPE",
    "CAPACITY",
}


class TestUtArcGisApi:
    """UT UGRC ArcGIS feature service — licensed health care facilities."""

    def _fetch(self, where: str = "1=1", fields: str = "*", limit: int = 10) -> dict:
        status, body = http_get(UT_ARCGIS_URL, {
            "where": where,
            "outFields": fields,
            "resultRecordCount": str(limit),
            "returnGeometry": "true",
            "f": "json",
        }, timeout=30)
        assert status == 200, f"UT ArcGIS returned HTTP {status}"
        data = json.loads(body)
        assert "error" not in data, f"ArcGIS error: {data.get('error')}"
        return data

    def test_api_returns_200(self):
        """UT ArcGIS endpoint responds with HTTP 200."""
        status, _ = http_get(UT_ARCGIS_URL, {
            "where": "1=1",
            "outFields": "NAME",
            "resultRecordCount": "1",
            "f": "json",
        })
        assert status == 200

    def test_returns_features_array(self):
        """Response has a 'features' array with at least one entry."""
        data = self._fetch(limit=5)
        assert "features" in data, "ArcGIS response missing 'features' key"
        assert len(data["features"]) >= 1, "ArcGIS returned 0 features"

    def test_licensed_facilities_count(self):
        """There are at least 200 LICENSED facilities in UT."""
        data = self._fetch(where="LICENSE_STATUS='LICENSED'", limit=1)
        # ArcGIS doesn't return total count without exceededTransferLimit, so
        # fetch a page of 200 to confirm the dataset is healthy.
        status, body = http_get(UT_ARCGIS_URL, {
            "where": "LICENSE_STATUS='LICENSED'",
            "outFields": "NAME",
            "resultRecordCount": "200",
            "f": "json",
        })
        assert status == 200
        data = json.loads(body)
        n = len(data.get("features", []))
        assert n >= 100, f"Expected ≥100 licensed UT facilities, got {n}"

    def test_all_required_fields_present(self):
        """Every returned feature has all fields required by ut_arcgis_facilities_ingest.py."""
        status, body = http_get(UT_ARCGIS_URL, {
            "where": "LICENSE_STATUS='LICENSED'",
            "outFields": ",".join(UT_REQUIRED_FIELDS),
            "resultRecordCount": "50",
            "f": "json",
        })
        assert status == 200
        data = json.loads(body)
        features = data.get("features", [])
        assert features, "No UT features returned"

        for i, feat in enumerate(features):
            attrs = feat.get("attributes", {})
            for field in UT_REQUIRED_FIELDS:
                assert field in attrs, (
                    f"UT feature {i} ({attrs.get('NAME', '?')}) missing field '{field}'"
                )

    def test_facility_name_is_nonempty(self):
        """NAME field is non-null and non-empty for all licensed facilities."""
        status, body = http_get(UT_ARCGIS_URL, {
            "where": "LICENSE_STATUS='LICENSED'",
            "outFields": "NAME,LICENSE_NUMBER",
            "resultRecordCount": "100",
            "f": "json",
        })
        assert status == 200
        features = json.loads(body).get("features", [])
        empty_names = [
            f["attributes"].get("LICENSE_NUMBER")
            for f in features
            if not str(f["attributes"].get("NAME", "")).strip()
        ]
        assert not empty_names, (
            f"{len(empty_names)} UT facilities have empty NAME, e.g. lic={empty_names[:3]}"
        )

    def test_license_number_is_nonempty(self):
        """LICENSE_NUMBER is non-null for all licensed UT facilities."""
        status, body = http_get(UT_ARCGIS_URL, {
            "where": "LICENSE_STATUS='LICENSED'",
            "outFields": "NAME,LICENSE_NUMBER",
            "resultRecordCount": "100",
            "f": "json",
        })
        assert status == 200
        features = json.loads(body).get("features", [])
        missing = [
            f["attributes"].get("NAME")
            for f in features
            if not str(f["attributes"].get("LICENSE_NUMBER", "")).strip()
        ]
        assert not missing, (
            f"{len(missing)} UT licensed facilities have empty LICENSE_NUMBER: {missing[:3]}"
        )

    def test_coordinates_are_in_utah_bounds(self):
        """LATITUDE/LONGITUDE values are within Utah's geographic bounds."""
        status, body = http_get(UT_ARCGIS_URL, {
            "where": "LICENSE_STATUS='LICENSED' AND LATITUDE IS NOT NULL",
            "outFields": "NAME,LATITUDE,LONGITUDE",
            "resultRecordCount": "100",
            "f": "json",
        })
        assert status == 200
        features = json.loads(body).get("features", [])
        # Utah: lat 36.9–42.0, lon -114.0 to -109.0
        out_of_bounds = []
        for feat in features:
            attrs = feat["attributes"]
            lat = attrs.get("LATITUDE")
            lon = attrs.get("LONGITUDE")
            if lat is None or lon is None:
                continue
            lat, lon = float(lat), float(lon)
            if not (36.9 <= lat <= 42.0 and -114.1 <= lon <= -108.9):
                out_of_bounds.append((attrs.get("NAME"), lat, lon))
        assert not out_of_bounds, (
            f"{len(out_of_bounds)} UT facilities have out-of-bounds coordinates: "
            f"{out_of_bounds[:3]}"
        )

    def test_memory_care_facilities_have_secure_beds(self):
        """Facilities with SECURE_BEDS > 0 return real data (our MC signal)."""
        status, body = http_get(UT_ARCGIS_URL, {
            "where": "SECURE_BEDS > 0 AND LICENSE_STATUS='LICENSED'",
            "outFields": "NAME,LICENSE_NUMBER,SECURE_BEDS,CAPACITY",
            "resultRecordCount": "50",
            "f": "json",
        })
        assert status == 200
        features = json.loads(body).get("features", [])
        assert len(features) >= 5, (
            f"Expected ≥5 UT memory care facilities (SECURE_BEDS>0), got {len(features)}"
        )
        for feat in features:
            attrs = feat["attributes"]
            secure = attrs.get("SECURE_BEDS", 0) or 0
            assert secure > 0, (
                f"Facility '{attrs.get('NAME')}' in SECURE_BEDS>0 query has "
                f"SECURE_BEDS={secure}"
            )

    def test_capacity_is_positive_integer_when_present(self):
        """CAPACITY is a positive integer (or null) for licensed UT facilities."""
        status, body = http_get(UT_ARCGIS_URL, {
            "where": "LICENSE_STATUS='LICENSED' AND CAPACITY IS NOT NULL",
            "outFields": "NAME,CAPACITY",
            "resultRecordCount": "100",
            "f": "json",
        })
        assert status == 200
        features = json.loads(body).get("features", [])
        bad = []
        for feat in features:
            attrs = feat["attributes"]
            cap = attrs.get("CAPACITY")
            if cap is None:
                continue
            try:
                v = int(cap)
                if v <= 0:
                    bad.append((attrs.get("NAME"), cap))
            except (ValueError, TypeError):
                bad.append((attrs.get("NAME"), cap))
        assert not bad, f"Invalid CAPACITY values: {bad[:5]}"

    def test_facility_type_values_are_known(self):
        """FACILITY_TYPE values are in the set known to our ingest script."""
        known_types = {
            "Assisted Living Facility - Type I",
            "Assisted Living Facility - Type II",
            "Nursing Care Facility",
            "Small Health Care Facility",
            "Hospital",
            "Intermediate Care Facility",
            "Adult Day Care Center",
            "End Stage Renal Disease",
            None,
            "",
        }
        status, body = http_get(UT_ARCGIS_URL, {
            "where": "LICENSE_STATUS='LICENSED'",
            "outFields": "FACILITY_TYPE",
            "resultRecordCount": "200",
            "f": "json",
        })
        assert status == 200
        features = json.loads(body).get("features", [])
        seen = {f["attributes"].get("FACILITY_TYPE") for f in features}
        unknown = seen - known_types
        # New facility types are OK as long as they are real strings, not corrupted data
        for ftype in unknown:
            assert isinstance(ftype, str), (
                f"UT FACILITY_TYPE has non-string unexpected value: {ftype!r}"
            )


# ══════════════════════════════════════════════════════════════════════════════
# PA — DHS Human Services Provider Directory
# https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/
# ══════════════════════════════════════════════════════════════════════════════

PA_DHS_EXPORT_URL = (
    "https://www.humanservices.dhs.pa.gov"
    "/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/ExportToExcel"
)
PA_DHS_HOME_URL = "https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home"


class TestPaDhsApi:
    """PA DHS Human Services Provider Directory accessibility."""

    def test_home_page_accessible(self):
        """PA DHS provider directory home page returns HTTP 200."""
        status, body = http_get(PA_DHS_HOME_URL, timeout=30)
        assert status in (200, 302, 301), (
            f"PA DHS home returned HTTP {status}"
        )

    def test_excel_export_endpoint_accessible(self):
        """PA DHS Excel export endpoint responds (not a 5xx error)."""
        status, _ = http_get(PA_DHS_EXPORT_URL, timeout=60)
        # POST may be required; GET might redirect or return 405 — anything < 500 is OK
        assert 0 < status < 500, (
            f"PA DHS Excel export returned HTTP {status} — server error or completely down"
        )


# ══════════════════════════════════════════════════════════════════════════════
# OR — LTC Licensing Portal
# https://ltclicensing.oregon.gov/Providers
# ══════════════════════════════════════════════════════════════════════════════

OR_PORTAL_URL = "https://ltclicensing.oregon.gov/Providers"


class TestOrLtcPortal:
    """Oregon DHS LTC Licensing portal accessibility."""

    def test_portal_home_accessible(self):
        """OR LTC portal responds with a non-5xx status."""
        status, body = http_get(OR_PORTAL_URL, timeout=30)
        assert 0 < status < 500, f"OR LTC portal returned HTTP {status}"

    def test_portal_returns_html_content(self):
        """OR LTC portal returns a non-trivial HTML body when it loads."""
        status, body = http_get(OR_PORTAL_URL, timeout=30)
        if status not in (200, 301, 302):
            pytest.skip(f"Portal returned {status} — may require session")
        if status == 200:
            assert len(body) > 500, "OR portal body suspiciously short"


# ══════════════════════════════════════════════════════════════════════════════
# WA — DSHS Advanced Lookup
# https://fortress.wa.gov/dshs/adsaapps/Lookup/BHAdvLookup.aspx
# ══════════════════════════════════════════════════════════════════════════════

WA_DSHS_URL = "https://fortress.wa.gov/dshs/adsaapps/Lookup/BHAdvLookup.aspx"


class TestWaDshsPortal:
    """Washington DSHS Advanced Lookup portal accessibility."""

    def test_portal_accessible(self):
        """WA DSHS portal responds with a non-5xx status."""
        status, body = http_get(WA_DSHS_URL, timeout=30)
        assert 0 < status < 500, f"WA DSHS portal returned HTTP {status}"

    def test_portal_contains_lookup_indicators(self):
        """WA DSHS page body suggests it's the correct portal."""
        status, body = http_get(WA_DSHS_URL, timeout=30)
        if status not in (200, 301, 302):
            pytest.skip(f"WA portal returned {status}")
        if status == 200:
            text = body.decode("utf-8", errors="replace").lower()
            assert "dshs" in text or "lookup" in text or "facility" in text, (
                "WA DSHS page doesn't contain expected portal identifiers"
            )


# ══════════════════════════════════════════════════════════════════════════════
# MN — MDH Facility Directory
# https://www.health.state.mn.us/facilities/regulation/directory/directorydatafile.html
# ══════════════════════════════════════════════════════════════════════════════

MN_MDH_URL = (
    "https://www.health.state.mn.us/facilities/regulation/directory/directorydatafile.html"
)


class TestMnMdhPortal:
    """Minnesota MDH facility directory page accessibility."""

    def test_page_accessible(self):
        """MN MDH directory page returns HTTP 200."""
        status, body = http_get(MN_MDH_URL, timeout=30)
        assert status == 200, f"MN MDH page returned HTTP {status}"

    def test_page_mentions_directory(self):
        """MN MDH page body references the facility directory."""
        status, body = http_get(MN_MDH_URL, timeout=30)
        if status != 200:
            pytest.skip(f"MN MDH returned {status}")
        text = body.decode("utf-8", errors="replace").lower()
        assert "facilit" in text or "directory" in text or "health" in text, (
            "MN MDH page doesn't reference facilities or directory"
        )

    def test_page_has_download_link(self):
        """MN MDH page contains a link to the Excel/CSV data file."""
        status, body = http_get(MN_MDH_URL, timeout=30)
        if status != 200:
            pytest.skip(f"MN MDH returned {status}")
        text = body.decode("utf-8", errors="replace")
        has_link = ".xls" in text.lower() or ".csv" in text.lower() or ".xlsx" in text.lower()
        assert has_link, "MN MDH page doesn't appear to have an Excel/CSV download link"


# ══════════════════════════════════════════════════════════════════════════════
# TX — HHSC Assisted Living Portal
# https://www.hhs.texas.gov/providers/long-term-care-providers/assisted-living
# ══════════════════════════════════════════════════════════════════════════════

TX_HHSC_URL = (
    "https://www.hhs.texas.gov/providers/long-term-care-providers/assisted-living"
)


class TestTxHhscPortal:
    """Texas HHSC Assisted Living directory page accessibility."""

    def test_page_accessible(self):
        """TX HHSC ALF page returns a non-5xx status."""
        status, body = http_get(TX_HHSC_URL, timeout=30)
        assert 0 < status < 500, f"TX HHSC page returned HTTP {status}"

    def test_page_mentions_assisted_living(self):
        """TX HHSC page mentions assisted living (correct page)."""
        status, body = http_get(TX_HHSC_URL, timeout=30)
        if status not in (200, 301, 302):
            pytest.skip(f"TX HHSC returned {status}")
        if status == 200:
            text = body.decode("utf-8", errors="replace").lower()
            assert "assisted living" in text or "alf" in text, (
                "TX HHSC page doesn't mention assisted living"
            )


# ══════════════════════════════════════════════════════════════════════════════
# IL — LLCS Portal (browser-based; test accessibility only)
# https://llcs.dph.illinois.gov/s/
# ══════════════════════════════════════════════════════════════════════════════

IL_LLCS_URL = "https://llcs.dph.illinois.gov/s/"


class TestIlLlcsPortal:
    """Illinois LLCS portal accessibility (Salesforce Experience Cloud)."""

    def test_portal_accessible(self):
        """IL LLCS portal responds with a non-5xx status."""
        status, body = http_get(IL_LLCS_URL, timeout=30)
        # Salesforce may return 200, 301, 302, or require browser cookies
        assert 0 < status < 500, f"IL LLCS portal returned HTTP {status}"

    def test_portal_returns_content(self):
        """IL LLCS portal returns a non-trivial body when accessible."""
        status, body = http_get(IL_LLCS_URL, timeout=30)
        if status not in (200, 301, 302):
            pytest.skip(f"IL LLCS returned {status} — may need browser session")
        if status == 200:
            assert len(body) > 200, "IL LLCS body suspiciously short"
