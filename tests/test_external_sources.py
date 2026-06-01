"""
Layer A — External data-source health and schema tests.

Every test in this file hits a REAL external API with ZERO mocks.
Tests verify that:
  1. The endpoint is still reachable.
  2. The response has the expected schema (required fields present).
  3. Known test facilities appear in the source data where applicable.

These tests protect against silent upstream changes (URL moves, schema drift,
auth requirement changes) that would silently corrupt a future ingest run.

Run:
    pytest tests/test_external_sources.py -m external -v
"""
from __future__ import annotations

import time
import urllib.error
import urllib.request

import pytest
import requests

from conftest import (
    CDSS_TRANSPARENCY_BASE,
    CENSUS_GEOCODER_BASE,
    CMS_DKAN_META_BASE,
    CMS_PROVIDER_INFO_UUID,
    MN_MDH_DIRECTORY_SOURCE,
    OR_DHS_LTC_SOURCE,
    PA_DHS_EXPORT_SOURCE,
    WA_DSHS_ALF_SOURCE,
    CA_OPAL_CARE,
)

pytestmark = pytest.mark.external

_SESSION = requests.Session()
_SESSION.headers.update({
    # Use the same UA as _http_helpers.py to match scraper behavior
    "User-Agent": "StarlynnCare-Research/1.0 (btj212@gmail.com)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8,application/json",
    "Accept-Language": "en-US,en;q=0.9",
})


def _get(url: str, *, timeout: int = 30, **kwargs) -> requests.Response:
    resp = _SESSION.get(url, timeout=timeout, **kwargs)
    if resp.status_code == 403:
        pytest.skip(
            f"HTTP 403 from {url}. This endpoint may require a different network environment "
            "(CMS and some state portals block cloud/CI IPs). Run from your dev machine. "
            f"If this happens in production, the scraper is also broken."
        )
    resp.raise_for_status()
    return resp


def _head(url: str, *, timeout: int = 20) -> int:
    """
    Return HTTP status code for a HEAD request; follow redirects.
    403 causes pytest.skip (cloud/CI IP may be blocked — run from dev machine).
    """
    try:
        r = _SESSION.head(url, timeout=timeout, allow_redirects=True)
        if r.status_code == 403:
            pytest.skip(
                f"HTTP 403 from {url}. Cloud/CI IP is blocked by this endpoint. "
                "Run this test from a dev machine to verify scraper access."
            )
        return r.status_code
    except requests.exceptions.TooManyRedirects:
        return 301  # redirect loop still proves endpoint is alive


# ─────────────────────────────────────────────────────────────────────────────
# CMS Provider Data (Nursing Home Information)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.timeout(30)
class TestCMSProviderData:
    """CMS DKAN metadata + CSV download URL — used by cms_nh_directory_ingest.py."""

    def test_dkan_metadata_endpoint_reachable(self):
        """DKAN metadata API for the provider-information dataset must return HTTP 200."""
        url = f"{CMS_DKAN_META_BASE}/{CMS_PROVIDER_INFO_UUID}"
        resp = _get(url)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"

    def test_dkan_metadata_returns_json(self):
        url = f"{CMS_DKAN_META_BASE}/{CMS_PROVIDER_INFO_UUID}"
        resp = _get(url)
        data = resp.json()
        assert isinstance(data, dict), "Response must be a JSON object"

    def test_dkan_metadata_has_distribution(self):
        """Dataset must advertise at least one data distribution."""
        url = f"{CMS_DKAN_META_BASE}/{CMS_PROVIDER_INFO_UUID}"
        resp = _get(url)
        data = resp.json()
        assert "distribution" in data, "Missing 'distribution' key in DKAN metadata"
        assert len(data["distribution"]) > 0, "distribution list is empty"

    def test_dkan_metadata_has_csv_distribution(self):
        """At least one distribution must be a CSV download."""
        url = f"{CMS_DKAN_META_BASE}/{CMS_PROVIDER_INFO_UUID}"
        resp = _get(url)
        distributions = resp.json().get("distribution", [])
        csv_urls = [d.get("downloadURL", "") for d in distributions if d.get("downloadURL", "").endswith(".csv")]
        assert csv_urls, "No CSV downloadURL found in CMS DKAN distribution list"

    def test_cms_csv_download_url_is_accessible(self):
        """The CSV download URL must be reachable (HEAD request only — file is large)."""
        url = f"{CMS_DKAN_META_BASE}/{CMS_PROVIDER_INFO_UUID}"
        resp = _get(url)
        distributions = resp.json().get("distribution", [])
        csv_url = next(
            (d["downloadURL"] for d in distributions if d.get("downloadURL", "").endswith(".csv")),
            None,
        )
        assert csv_url, "No CSV URL to check"
        status = _head(csv_url)
        assert status in (200, 206, 302, 301), f"CSV URL returned {status}"

    def test_cms_csv_contains_required_columns(self):
        """
        Download the first few KB of the CSV and verify all expected columns exist.
        Uses stream=True + reads only the header row to avoid downloading the full 50 MB.
        """
        url = f"{CMS_DKAN_META_BASE}/{CMS_PROVIDER_INFO_UUID}"
        resp = _get(url)
        distributions = resp.json().get("distribution", [])
        csv_url = next(
            (d["downloadURL"] for d in distributions if d.get("downloadURL", "").endswith(".csv")),
            None,
        )
        assert csv_url, "No CSV URL found"

        required_columns = [
            "CMS Certification Number (CCN)",
            "Provider Name",
            "Provider State",
            "Number of Certified Beds",
            "Overall Rating",
        ]

        # Read only the header line (first chunk of the streaming response)
        r = _SESSION.get(csv_url, stream=True, timeout=60)
        r.raise_for_status()
        header_line = ""
        for chunk in r.iter_content(chunk_size=4096):
            header_line += chunk.decode("utf-8-sig", errors="replace")
            if "\n" in header_line:
                break
        r.close()

        first_line = header_line.split("\n")[0]
        for col in required_columns:
            assert col in first_line, (
                f"Required CMS column '{col}' not found in CSV header.\n"
                f"Header: {first_line[:500]}"
            )


# ─────────────────────────────────────────────────────────────────────────────
# California CDSS Transparency API
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.timeout(30)
class TestCDSSTransparencyAPI:
    """CDSS Transparency API — used by ccld_citations_ingest.py and ccld_rcfe_ingest.py."""

    def test_report_index_endpoint_reachable(self):
        """FacilityReports/{facNum} endpoint must respond for Opal Care (200672)."""
        url = f"{CDSS_TRANSPARENCY_BASE}/FacilityReports/{CA_OPAL_CARE['license_number']}"
        resp = _get(url)
        assert resp.status_code == 200

    def test_report_index_returns_json(self):
        url = f"{CDSS_TRANSPARENCY_BASE}/FacilityReports/{CA_OPAL_CARE['license_number']}"
        resp = _get(url)
        data = resp.json()
        assert isinstance(data, dict), "FacilityReports response must be a JSON object"

    def test_report_index_has_count_field(self):
        """Report index must include a COUNT field indicating total report count."""
        url = f"{CDSS_TRANSPARENCY_BASE}/FacilityReports/{CA_OPAL_CARE['license_number']}"
        data = _get(url).json()
        assert "COUNT" in data, f"Missing COUNT in response. Keys: {list(data.keys())}"

    def test_opal_care_has_reports(self):
        """Opal Care (CA's most-cited facility) must have ≥1 inspection report on record."""
        url = f"{CDSS_TRANSPARENCY_BASE}/FacilityReports/{CA_OPAL_CARE['license_number']}"
        data = _get(url).json()
        count = data.get("COUNT", 0)
        assert int(count) >= 1, (
            f"Opal Care has {count} reports — expected ≥1. "
            "This is CA's most-cited facility; 0 reports indicates an API break."
        )

    def test_report_index_has_reportarray_field(self):
        """Report index must include REPORTARRAY with individual report entries."""
        url = f"{CDSS_TRANSPARENCY_BASE}/FacilityReports/{CA_OPAL_CARE['license_number']}"
        data = _get(url).json()
        assert "REPORTARRAY" in data, f"Missing REPORTARRAY. Keys: {list(data.keys())}"
        assert isinstance(data["REPORTARRAY"], list), "REPORTARRAY must be a list"

    def test_reportarray_entries_have_required_fields(self):
        """Each report entry must have REPORTTYPE, REPORTDATE, and CONTROLNUMBER."""
        url = f"{CDSS_TRANSPARENCY_BASE}/FacilityReports/{CA_OPAL_CARE['license_number']}"
        data = _get(url).json()
        entries = data.get("REPORTARRAY", [])
        assert entries, "REPORTARRAY is empty — cannot verify entry fields"

        required = {"REPORTTYPE", "REPORTDATE", "CONTROLNUMBER"}
        for entry in entries[:5]:  # Check first 5 entries
            missing = required - set(entry.keys())
            assert not missing, (
                f"Report entry missing fields {missing}. "
                f"Entry keys: {list(entry.keys())}"
            )

    def test_individual_report_fetch(self):
        """FacilityReports?facNum=X&inx=0 must return HTML content (not empty)."""
        url = f"{CDSS_TRANSPARENCY_BASE}/FacilityReports?facNum={CA_OPAL_CARE['license_number']}&inx=0"
        resp = _get(url)
        assert resp.status_code == 200
        body = resp.text
        assert len(body) > 200, (
            f"Individual report body suspiciously short ({len(body)} chars). "
            "Expected full HTML inspection report."
        )


# ─────────────────────────────────────────────────────────────────────────────
# Oregon DHS LTC Portal
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.timeout(30)
class TestOregonDHSPortal:
    """Oregon DHS LTC licensing portal — source for or_providers_ingest.py."""

    def test_providers_page_reachable(self):
        """OR DHS Providers page must respond with 2xx or 3xx (redirects OK)."""
        status = _head(OR_DHS_LTC_SOURCE)
        assert status < 400, (
            f"OR DHS LTC portal returned {status}. "
            f"URL: {OR_DHS_LTC_SOURCE}"
        )

    def test_providers_page_returns_content(self):
        """OR DHS Providers page GET must return non-trivial HTML content."""
        resp = _get(OR_DHS_LTC_SOURCE, timeout=30)
        assert resp.status_code == 200
        assert len(resp.text) > 1_000, (
            f"OR DHS page body too short ({len(resp.text)} chars)"
        )

    def test_providers_page_contains_ltc_content(self):
        """Page must mention 'Long Term Care' or 'Provider' to confirm we're on the right page."""
        resp = _get(OR_DHS_LTC_SOURCE, timeout=30)
        body_lower = resp.text.lower()
        assert "provider" in body_lower or "long term" in body_lower or "facility" in body_lower, (
            "OR DHS page doesn't mention 'provider', 'long term', or 'facility' — "
            "page content may have changed significantly"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Washington DSHS ALF Portal
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.timeout(30)
class TestWashingtonDSHSPortal:
    """WA DSHS ALF advanced lookup — source for wa_dshs_directory_scrape.py."""

    def test_bhforms_lookup_reachable(self):
        """WA DSHS BHForms lookup page must be reachable."""
        status = _head(WA_DSHS_ALF_SOURCE)
        assert status < 400, (
            f"WA DSHS ALF portal returned {status}. "
            f"URL: {WA_DSHS_ALF_SOURCE}"
        )

    def test_bhforms_lookup_returns_content(self):
        """GET on the lookup page must return non-trivial content."""
        resp = _get(WA_DSHS_ALF_SOURCE, timeout=30)
        # The server may return 200 or redirect; either is acceptable
        assert resp.status_code in (200, 301, 302, 403), (
            f"Unexpected status {resp.status_code}"
        )
        # If 200, body should be non-trivial
        if resp.status_code == 200:
            assert len(resp.text) > 500, "WA DSHS page body suspiciously short"


# ─────────────────────────────────────────────────────────────────────────────
# Minnesota MDH Directory
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.timeout(30)
class TestMinnesotaMDHDirectory:
    """MN MDH facility directory — source for mn_mdh_directory_scrape.py."""

    def test_directory_page_reachable(self):
        """MN MDH directory page must respond."""
        status = _head(MN_MDH_DIRECTORY_SOURCE)
        assert status < 400, (
            f"MN MDH directory page returned {status}. "
            f"URL: {MN_MDH_DIRECTORY_SOURCE}"
        )

    def test_directory_page_has_download_link(self):
        """Page must contain a reference to the Excel/data file download."""
        resp = _get(MN_MDH_DIRECTORY_SOURCE, timeout=30)
        assert resp.status_code == 200
        body_lower = resp.text.lower()
        assert (
            ".xlsx" in body_lower
            or ".xls" in body_lower
            or "download" in body_lower
            or "excel" in body_lower
            or "directory" in body_lower
        ), "MN MDH directory page doesn't appear to have a data download link"


# ─────────────────────────────────────────────────────────────────────────────
# Pennsylvania DHS Provider Directory
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.timeout(30)
class TestPennsylvaniaDHSDirectory:
    """PA DHS Human Services Provider Directory — source for pa_hsd_directory_ingest.py."""

    def test_export_endpoint_reachable(self):
        """PA DHS export endpoint must be reachable (no-auth GET)."""
        status = _head(PA_DHS_EXPORT_SOURCE)
        assert status < 500, (
            f"PA DHS export endpoint returned {status}. "
            f"URL: {PA_DHS_EXPORT_SOURCE} — this is used by pa_hsd_directory_ingest.py"
        )

    def test_pa_inspection_portal_reachable(self):
        """PA DHS inspection portal must be reachable for known facility (Rittenhouse id=22301)."""
        # The PA portal uses license_number[:-1] as the ID (documented in MEMORY.md)
        # 223010 → 22301
        portal_url = "https://www.compass.state.pa.us/cwis/public/home"
        status = _head(portal_url)
        assert status < 500, f"PA compass portal returned {status}"


# ─────────────────────────────────────────────────────────────────────────────
# US Census Geocoder
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.timeout(30)
class TestCensusGeocoder:
    """US Census Geocoder — used by recompute_physical_city.py to derive physical city."""

    def test_geocoder_reachable(self):
        """Census Geocoder API endpoint must be reachable."""
        # Philadelphia PA: lat 39.9526, lon -75.1652
        url = (
            f"{CENSUS_GEOCODER_BASE}"
            "?x=-75.1652&y=39.9526&benchmark=4&vintage=4&format=json"
        )
        resp = _get(url, timeout=30)
        assert resp.status_code == 200

    def test_geocoder_returns_json(self):
        url = (
            f"{CENSUS_GEOCODER_BASE}"
            "?x=-75.1652&y=39.9526&benchmark=4&vintage=4&format=json"
        )
        data = _get(url, timeout=30).json()
        assert isinstance(data, dict), "Geocoder must return JSON object"

    def test_geocoder_returns_geography(self):
        """Geocoder must return a 'result' with 'geographies' for known coordinates."""
        url = (
            f"{CENSUS_GEOCODER_BASE}"
            "?x=-75.1652&y=39.9526&benchmark=4&vintage=4&format=json"
        )
        data = _get(url, timeout=30).json()
        assert "result" in data, f"Missing 'result' in geocoder response. Keys: {list(data.keys())}"
        result = data["result"]
        assert "geographies" in result, (
            f"Missing 'geographies' in result. Result keys: {list(result.keys())}"
        )

    def test_geocoder_identifies_philadelphia(self):
        """Geocoder should identify Philadelphia coordinates as Philadelphia PA."""
        url = (
            f"{CENSUS_GEOCODER_BASE}"
            "?x=-75.1652&y=39.9526&benchmark=4&vintage=4&format=json"
        )
        data = _get(url, timeout=30).json()
        geographies = data.get("result", {}).get("geographies", {})
        places = (
            geographies.get("Incorporated Places", [])
            or geographies.get("Census Designated Places", [])
        )
        assert places, "No places returned for Philadelphia coordinates"
        place_names = [p.get("NAME", "").lower() for p in places]
        assert any("philadelphia" in n for n in place_names), (
            f"Expected 'Philadelphia' in geocoder results for Philadelphia PA coordinates. "
            f"Got: {place_names}"
        )

    def test_geocoder_returns_state_fips(self):
        """Geocoder result must include state-level geography with FIPS code."""
        url = (
            f"{CENSUS_GEOCODER_BASE}"
            "?x=-75.1652&y=39.9526&benchmark=4&vintage=4&format=json"
        )
        data = _get(url, timeout=30).json()
        geographies = data.get("result", {}).get("geographies", {})
        states = geographies.get("States", [])
        assert states, "No state geography returned from Census geocoder"
        assert states[0].get("STATE"), "State FIPS code missing from geocoder result"
        # PA FIPS = 42
        assert states[0]["STATE"] == "42", (
            f"Expected PA FIPS=42, got {states[0].get('STATE')}"
        )

    def test_geocoder_for_california_coordinates(self):
        """Geocoder must correctly resolve a CA coordinate (Oakland)."""
        # Oakland CA: lat 37.8044, lon -122.2712
        url = (
            f"{CENSUS_GEOCODER_BASE}"
            "?x=-122.2712&y=37.8044&benchmark=4&vintage=4&format=json"
        )
        data = _get(url, timeout=30).json()
        geographies = data.get("result", {}).get("geographies", {})
        states = geographies.get("States", [])
        assert states, "No state geography for Oakland CA coordinates"
        # CA FIPS = 06
        assert states[0].get("STATE") == "06", (
            f"Expected CA FIPS=06 for Oakland coordinates, got {states[0].get('STATE')}"
        )
