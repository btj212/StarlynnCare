"""
test_ccld_api.py — Live integration tests for CA CDSS APIs.

Tests both the CA Open Data (CKAN) endpoint and the CDSS Transparency API
using real HTTP calls. No mocking.

Endpoints tested:
  - CKAN: https://data.ca.gov/api/3/action/datastore_search (RCFE roster)
  - CDSS Transparency: https://www.ccld.dss.ca.gov/transparencyapi/api/Facility/any
  - CDSS Facility Reports: https://www.ccld.dss.ca.gov/transparencyapi/api/FacilityReports/{facNum}

Marked @pytest.mark.live_api — requires outbound network access.
"""
from __future__ import annotations

import re

import pytest
import requests

pytestmark = pytest.mark.live_api

CKAN_URL = "https://data.ca.gov/api/3/action/datastore_search"
CKAN_RESOURCE_ID = "6b2f5818-f60d-40b5-bc2a-94f995f9f8b0"


@pytest.fixture(scope="module", autouse=True)
def require_ca_network(http):
    """Skip this entire module if CA Open Data is not reachable from this network."""
    try:
        resp = http.get(CKAN_URL, params={"resource_id": CKAN_RESOURCE_ID, "limit": 1}, timeout=10)
        if resp.status_code == 403 and "allowlist" in resp.text.lower():
            pytest.skip(
                "CA CDSS/CKAN API unreachable from this network (blocked by allowlist policy). "
                "Run with open network access to test live CA ingestion."
            )
    except Exception as exc:
        pytest.skip(f"CA CDSS/CKAN API unreachable: {exc}")
CDSS_FACILITY_URL = "https://www.ccld.dss.ca.gov/transparencyapi/api/Facility/any"
CDSS_REPORTS_URL = "https://www.ccld.dss.ca.gov/transparencyapi/api/FacilityReports/{facNum}"

# A real Silverado facility license from CA (publicly known)
# Silverado Senior Living - Berkeley (RCFE, memory care, publicly published)
KNOWN_SILVERADO_LICENSE = "197603485"


# ─────────────────────────────────────────────────────────────────────────────
# CKAN / CA Open Data RCFE Roster
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def ckan_sample(http):
    """10 real RCFE records from the CA Open Data CKAN endpoint."""
    resp = http.get(
        CKAN_URL,
        params={"resource_id": CKAN_RESOURCE_ID, "limit": 10},
        timeout=30,
    )
    assert resp.status_code == 200, f"CKAN returned {resp.status_code}: {resp.text[:200]}"
    return resp.json()


class TestCKANEndpoint:
    def test_ckan_success_flag(self, ckan_sample):
        assert ckan_sample.get("success") is True, (
            f"CKAN returned success=False: {ckan_sample}"
        )

    def test_ckan_has_result(self, ckan_sample):
        assert "result" in ckan_sample
        assert "records" in ckan_sample["result"]

    def test_ckan_returns_records(self, ckan_sample):
        records = ckan_sample["result"]["records"]
        assert len(records) > 0, "CKAN returned no records"

    def test_ckan_total_count_is_plausible(self, ckan_sample):
        total = ckan_sample["result"].get("total", 0)
        assert total > 5000, (
            f"CKAN total {total} is suspiciously low — expected > 5000 CA RCFEs"
        )

    def test_ckan_record_has_license_number(self, ckan_sample):
        for r in ckan_sample["result"]["records"]:
            assert "FACILITY_NUMBER" in r or "facility_number" in r, (
                f"CKAN record missing FACILITY_NUMBER: {list(r.keys())[:10]}"
            )

    def test_ckan_record_has_facility_name(self, ckan_sample):
        for r in ckan_sample["result"]["records"]:
            name_key = next(
                (k for k in r if "name" in k.lower() or "facility" in k.lower()),
                None,
            )
            assert name_key is not None, (
                f"CKAN record has no name-like field: {list(r.keys())[:10]}"
            )

    def test_ckan_record_has_city(self, ckan_sample):
        for r in ckan_sample["result"]["records"]:
            city_key = next(
                (k for k in r if "city" in k.lower()),
                None,
            )
            assert city_key is not None, (
                f"CKAN record has no city field: {list(r.keys())[:10]}"
            )

    def test_ckan_record_has_status_field(self, ckan_sample):
        for r in ckan_sample["result"]["records"]:
            status_key = next(
                (k for k in r if "status" in k.lower() or "license" in k.lower()),
                None,
            )
            assert status_key is not None, (
                f"CKAN record has no status/license field: {list(r.keys())[:10]}"
            )


# ─────────────────────────────────────────────────────────────────────────────
# CDSS Transparency API — Facility endpoint
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def cdss_facility_sample(http):
    """Sample from the CDSS Transparency facility endpoint."""
    resp = http.get(
        CDSS_FACILITY_URL,
        params={"$top": 5, "$format": "json"},
        timeout=60,
    )
    if resp.status_code in (404, 503):
        pytest.skip(f"CDSS Transparency API unavailable: {resp.status_code}")
    assert resp.status_code == 200, f"CDSS returned {resp.status_code}: {resp.text[:200]}"
    return resp.json()


class TestCDSSFacilityEndpoint:
    def test_cdss_returns_list_or_dict(self, cdss_facility_sample):
        assert isinstance(cdss_facility_sample, (list, dict)), (
            f"CDSS returned unexpected type: {type(cdss_facility_sample)}"
        )

    def test_cdss_has_records(self, cdss_facility_sample):
        if isinstance(cdss_facility_sample, dict):
            records = cdss_facility_sample.get("value", [])
        else:
            records = cdss_facility_sample
        assert len(records) > 0, "CDSS Transparency API returned 0 facilities"

    def test_cdss_record_has_facility_number(self, cdss_facility_sample):
        if isinstance(cdss_facility_sample, dict):
            records = cdss_facility_sample.get("value", [])
        else:
            records = cdss_facility_sample
        for r in records:
            # Accept either camelCase or snake_case field names
            has_number = any(
                "number" in k.lower() or "facilitynum" in k.lower() or "facnum" in k.lower()
                for k in r.keys()
            )
            assert has_number, f"CDSS record missing facility number field: {list(r.keys())[:10]}"

    def test_cdss_record_has_name_field(self, cdss_facility_sample):
        if isinstance(cdss_facility_sample, dict):
            records = cdss_facility_sample.get("value", [])
        else:
            records = cdss_facility_sample
        for r in records:
            has_name = any("name" in k.lower() for k in r.keys())
            assert has_name, f"CDSS record missing name field: {list(r.keys())[:10]}"

    def test_cdss_record_has_status_field(self, cdss_facility_sample):
        if isinstance(cdss_facility_sample, dict):
            records = cdss_facility_sample.get("value", [])
        else:
            records = cdss_facility_sample
        for r in records:
            has_status = any("status" in k.lower() or "license" in k.lower() for k in r.keys())
            assert has_status, f"CDSS record missing status field: {list(r.keys())[:10]}"


# ─────────────────────────────────────────────────────────────────────────────
# CDSS Transparency API — Facility Reports (inspection index)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def cdss_reports_response(http):
    """Real CDSS FacilityReports response for a known CA RCFE."""
    url = CDSS_REPORTS_URL.format(facNum=KNOWN_SILVERADO_LICENSE)
    resp = http.get(url, timeout=30)
    if resp.status_code in (404, 503):
        pytest.skip(f"CDSS FacilityReports unavailable for {KNOWN_SILVERADO_LICENSE}")
    return resp


class TestCDSSFacilityReports:
    def test_reports_endpoint_returns_200_or_204(self, cdss_reports_response):
        assert cdss_reports_response.status_code in (200, 204), (
            f"CDSS FacilityReports returned {cdss_reports_response.status_code}"
        )

    def test_reports_response_is_json_or_html(self, cdss_reports_response):
        ct = cdss_reports_response.headers.get("content-type", "")
        assert "json" in ct or "html" in ct, (
            f"Unexpected content-type from CDSS FacilityReports: {ct}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# MC signal integration: CKAN data → score_name → expected signals
# ─────────────────────────────────────────────────────────────────────────────


class TestCKANDataWithMCSignals:
    """
    End-to-end: pull real CKAN facility names and score them with _mc_signals.
    Verifies the signal pipeline works on real CA data.
    """

    def test_ckan_facilities_scored_without_error(self, http, ckan_sample):
        import sys
        from pathlib import Path

        sys.path.insert(0, str(Path(__file__).parent.parent))
        from _mc_signals import score_batch

        records = ckan_sample["result"]["records"]
        # Build rows in the format score_batch expects
        rows = []
        for r in records:
            name = r.get("FACILITY_NAME") or r.get("facility_name", "")
            operator = r.get("LICENSEE_NAME") or r.get("licensee_name") or r.get("operator_name")
            rows.append({"name": name, "operator_name": operator})

        results = score_batch(rows)
        assert len(results) == len(rows), "score_batch returned fewer results than input rows"

        # All results should be MCSignals objects
        from _mc_signals import MCSignals

        for r in results:
            assert isinstance(r, MCSignals)
            # to_dict() must have both DB columns
            d = r.to_dict()
            assert "mc_signal_explicit_name" in d
            assert "mc_signal_chain_name" in d
            assert isinstance(d["mc_signal_explicit_name"], bool)
            assert isinstance(d["mc_signal_chain_name"], bool)

    def test_ckan_memory_care_facility_gets_explicit_signal(self, http, ckan_sample):
        """If any CKAN record has 'memory care' in the name, it must get explicit_name=True."""
        import sys
        from pathlib import Path

        sys.path.insert(0, str(Path(__file__).parent.parent))
        from _mc_signals import score_name

        records = ckan_sample["result"]["records"]
        for r in records:
            name = r.get("FACILITY_NAME") or r.get("facility_name", "") or ""
            if any(kw in name.lower() for kw in ("memory care", "dementia", "alzheimer")):
                sig = score_name(name)
                assert sig.explicit_name is True, (
                    f"Facility '{name}' has MC keyword but explicit_name=False"
                )
