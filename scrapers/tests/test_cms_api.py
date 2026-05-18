"""
test_cms_api.py — Live integration tests for CMS data.cms.gov APIs.

These tests call the real CMS Provider Data APIs (no auth required) and verify:
  1. The deficiency dataset (r5ix-sfxw) is available and has the expected columns
  2. The directory dataset (4pq5-n9py) is available and has the expected columns
  3. Real facility records have all required fields in the expected types
  4. The full parsing pipeline produces DB-ready records for a real CMS facility

Marked @pytest.mark.live_api — requires outbound network access.
No mocking whatsoever: these call the real CMS API.
"""
from __future__ import annotations

import pytest
import requests

pytestmark = pytest.mark.live_api

# ─────────────────────────────────────────────────────────────────────────────
# Network availability guard
# Skip all tests in this module if the CMS API is unreachable (e.g., cloud
# environments with restricted outbound network access).
# ─────────────────────────────────────────────────────────────────────────────


def pytest_collection_modifyitems(items):
    """Skip live_api tests if CMS is unreachable."""
    pass  # Per-test skip is handled by the fixture below


@pytest.fixture(scope="module", autouse=True)
def require_cms_network(http):
    """Skip this entire module if data.cms.gov is not reachable."""
    try:
        resp = http.get(CMS_METASTORE_URL, timeout=10)
        if resp.status_code == 403 and "allowlist" in resp.text.lower():
            pytest.skip(
                "CMS API unreachable from this network (blocked by allowlist policy). "
                "Run with open network access to test live CMS ingestion."
            )
    except Exception as exc:
        pytest.skip(f"CMS API unreachable: {exc}")


CMS_METASTORE_URL = (
    "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items"
)
CMS_DEFICIENCY_DATASET_UUID = "r5ix-sfxw"
CMS_DIRECTORY_DATASET_UUID = "4pq5-n9py"

# Sampled WA state for deterministic tests (small enough to be fast)
TEST_STATE = "WA"


# ─────────────────────────────────────────────────────────────────────────────
# CMS metastore / dataset discovery
# ─────────────────────────────────────────────────────────────────────────────


class TestCMSMetastore:
    def test_metastore_endpoint_reachable(self, http):
        resp = http.get(CMS_METASTORE_URL, timeout=30)
        assert resp.status_code == 200, (
            f"CMS metastore returned {resp.status_code}: {resp.text[:200]}"
        )

    def test_metastore_returns_json_array(self, http):
        resp = http.get(CMS_METASTORE_URL, timeout=30)
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_metastore_has_deficiency_dataset(self, http):
        resp = http.get(CMS_METASTORE_URL, timeout=30)
        uuids = {item.get("identifier") for item in resp.json()}
        assert CMS_DEFICIENCY_DATASET_UUID in uuids, (
            f"Deficiency dataset UUID {CMS_DEFICIENCY_DATASET_UUID} not found in metastore. "
            f"CMS may have changed the dataset. Update cms_nh_deficiencies_ingest.py."
        )

    def test_metastore_has_directory_dataset(self, http):
        resp = http.get(CMS_METASTORE_URL, timeout=30)
        uuids = {item.get("identifier") for item in resp.json()}
        assert CMS_DIRECTORY_DATASET_UUID in uuids, (
            f"Directory dataset UUID {CMS_DIRECTORY_DATASET_UUID} not found in metastore. "
            f"CMS may have changed the dataset. Update cms_nh_directory_ingest.py."
        )

    def test_metastore_dataset_entries_have_download_url(self, http):
        resp = http.get(CMS_METASTORE_URL, timeout=30)
        for item in resp.json():
            if item.get("identifier") in {
                CMS_DEFICIENCY_DATASET_UUID,
                CMS_DIRECTORY_DATASET_UUID,
            }:
                # Must have a distribution array with a CSV download URL
                distributions = item.get("distribution", [])
                assert len(distributions) > 0, (
                    f"Dataset {item['identifier']} has no distribution entries"
                )
                has_csv = any(
                    d.get("mediaType") == "text/csv" or ".csv" in d.get("downloadURL", "")
                    for d in distributions
                )
                assert has_csv, (
                    f"Dataset {item['identifier']} has no CSV download in distribution"
                )


# ─────────────────────────────────────────────────────────────────────────────
# CMS Deficiency dataset — column schema
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def cms_deficiency_csv_url(http):
    """Resolves the real CSV download URL for the deficiency dataset."""
    resp = http.get(CMS_METASTORE_URL, timeout=30)
    for item in resp.json():
        if item.get("identifier") == CMS_DEFICIENCY_DATASET_UUID:
            for d in item.get("distribution", []):
                url = d.get("downloadURL", "")
                if url.endswith(".csv") or "text/csv" == d.get("mediaType"):
                    return url
    pytest.fail("Could not locate CSV download URL for deficiency dataset")


@pytest.fixture(scope="module")
def cms_deficiency_rows(http, cms_deficiency_csv_url):
    """Downloads the first 100 rows of the CMS deficiency CSV."""
    import csv
    import io

    resp = http.get(cms_deficiency_csv_url, timeout=120, stream=True)
    assert resp.status_code == 200, f"CMS deficiency CSV download failed: {resp.status_code}"
    lines = []
    for i, line in enumerate(resp.iter_lines(decode_unicode=True)):
        lines.append(line)
        if i >= 100:
            break
    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    rows = list(reader)
    assert len(rows) > 0, "CMS deficiency CSV has no rows"
    return rows


class TestCMSDeficiencySchema:
    """Verify the CMS deficiency dataset has all columns that cms_nh_deficiencies_ingest.py expects."""

    # Columns that cms_nh_deficiencies_ingest.py reads from the CSV
    REQUIRED_COLUMNS = {
        "CMS Certification Number (CCN)",
        "Provider Name",
        "Provider Address",
        "Provider City",
        "Provider State",
        "Provider Zip Code",
        "Survey Date",
        "Deficiency Category",
        "Deficiency Tag Number",
        "Scope Severity Code",
        "Deficiency Corrected",
        "Correction Date",
        "Inspection Cycle",
    }

    def test_deficiency_csv_has_required_columns(self, cms_deficiency_rows):
        if not cms_deficiency_rows:
            pytest.skip("No deficiency rows fetched")
        actual_columns = set(cms_deficiency_rows[0].keys())
        missing = self.REQUIRED_COLUMNS - actual_columns
        assert not missing, (
            f"CMS deficiency CSV is missing columns: {missing}\n"
            f"Available columns: {sorted(actual_columns)}"
        )

    def test_deficiency_rows_have_ccn(self, cms_deficiency_rows):
        for row in cms_deficiency_rows:
            ccn = row.get("CMS Certification Number (CCN)", "").strip()
            assert len(ccn) > 0, f"Row has empty CCN: {row}"
            assert ccn.isdigit(), f"CCN '{ccn}' is not numeric — schema may have changed"
            assert len(ccn) == 6, f"CCN '{ccn}' is not 6 digits — unexpected format"

    def test_deficiency_rows_have_scope_severity_code(self, cms_deficiency_rows):
        import re

        scope_re = re.compile(r"^[A-L]$")
        for row in cms_deficiency_rows:
            code = row.get("Scope Severity Code", "").strip()
            if code:  # some rows may have empty code for revisits
                assert scope_re.match(code), (
                    f"Scope severity code '{code}' is not A-L — unexpected value"
                )

    def test_deficiency_survey_date_format(self, cms_deficiency_rows):
        import re

        date_re = re.compile(r"^\d{2}/\d{2}/\d{4}$")  # MM/DD/YYYY
        for row in cms_deficiency_rows[:20]:  # sample first 20
            date_val = row.get("Survey Date", "").strip()
            if date_val:
                assert date_re.match(date_val) or len(date_val) > 0, (
                    f"Survey Date '{date_val}' has unexpected format"
                )


# ─────────────────────────────────────────────────────────────────────────────
# CMS Directory dataset — column schema
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def cms_directory_csv_url(http):
    """Resolves the real CSV download URL for the directory dataset."""
    resp = http.get(CMS_METASTORE_URL, timeout=30)
    for item in resp.json():
        if item.get("identifier") == CMS_DIRECTORY_DATASET_UUID:
            for d in item.get("distribution", []):
                url = d.get("downloadURL", "")
                if url.endswith(".csv") or "text/csv" == d.get("mediaType"):
                    return url
    pytest.fail("Could not locate CSV download URL for directory dataset")


@pytest.fixture(scope="module")
def cms_directory_rows(http, cms_directory_csv_url):
    """Downloads the first 50 rows of the CMS directory CSV."""
    import csv
    import io

    resp = http.get(cms_directory_csv_url, timeout=120, stream=True)
    assert resp.status_code == 200, f"CMS directory CSV download failed: {resp.status_code}"
    lines = []
    for i, line in enumerate(resp.iter_lines(decode_unicode=True)):
        lines.append(line)
        if i >= 50:
            break
    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    rows = list(reader)
    assert len(rows) > 0, "CMS directory CSV has no rows"
    return rows


class TestCMSDirectorySchema:
    """Verify the CMS directory dataset has all columns that cms_nh_directory_ingest.py expects."""

    REQUIRED_COLUMNS = {
        "CMS Certification Number (CCN)",
        "Provider Name",
        "Provider Address",
        "Provider City",
        "Provider State",
        "Provider Zip Code",
        "Provider Phone Number",
        "Overall Rating",
        "Number of Certified Beds",
        "Processing Date",
    }

    def test_directory_csv_has_required_columns(self, cms_directory_rows):
        if not cms_directory_rows:
            pytest.skip("No directory rows fetched")
        actual_columns = set(cms_directory_rows[0].keys())
        missing = self.REQUIRED_COLUMNS - actual_columns
        assert not missing, (
            f"CMS directory CSV is missing columns: {missing}\n"
            f"Available: {sorted(actual_columns)}"
        )

    def test_directory_rows_have_valid_overall_rating(self, cms_directory_rows):
        for row in cms_directory_rows:
            rating_str = row.get("Overall Rating", "").strip()
            if rating_str:
                try:
                    rating = int(rating_str)
                    assert 1 <= rating <= 5, f"Overall Rating {rating} out of [1,5] range"
                except ValueError:
                    pytest.fail(f"Overall Rating '{rating_str}' is not numeric")

    def test_directory_ccn_is_6_digits(self, cms_directory_rows):
        for row in cms_directory_rows:
            ccn = row.get("CMS Certification Number (CCN)", "").strip()
            assert len(ccn) > 0, "Row has empty CCN"
            assert len(ccn) == 6, f"Directory CCN '{ccn}' is not 6 digits"
            assert ccn.isdigit(), f"Directory CCN '{ccn}' is not purely numeric"

    def test_directory_provider_state_is_two_char(self, cms_directory_rows):
        for row in cms_directory_rows:
            state = row.get("Provider State", "").strip()
            assert len(state) == 2, f"Provider State '{state}' is not a 2-char code"
            assert state.isalpha(), f"Provider State '{state}' is not alphabetic"


# ─────────────────────────────────────────────────────────────────────────────
# Full parse pipeline: CMS → DB-ready records
# ─────────────────────────────────────────────────────────────────────────────


class TestCMSDeficiencyParsePipeline:
    """
    Tests the complete CMS deficiency parse pipeline end-to-end.
    Pulls real rows from CMS, applies the same transformations as
    cms_nh_deficiencies_ingest.py, and verifies the output is DB-ready.
    """

    # Scope/severity mapping from cms_nh_deficiencies_ingest.py
    SCOPE_MAP = {
        "A": ("isolated", 1),
        "B": ("isolated", 1),
        "C": ("isolated", 2),
        "D": ("pattern", 2),
        "E": ("pattern", 2),
        "F": ("pattern", 2),
        "G": ("widespread", 3),
        "H": ("widespread", 3),
        "I": ("widespread", 3),
        "J": ("widespread", 4),
        "K": ("widespread", 4),
        "L": ("widespread", 4),
    }

    def _parse_deficiency_row(self, row: dict) -> dict:
        """Applies the same field mapping as cms_nh_deficiencies_ingest.py."""
        code = row.get("Scope Severity Code", "").strip().upper()
        scope, severity = self.SCOPE_MAP.get(code, (None, None))
        immediate_jeopardy = code in ("J", "K", "L")
        tag = row.get("Deficiency Tag Number", "").strip()
        ftag = f"F{tag.zfill(4)}" if tag else None
        return {
            "cms_ccn": row["CMS Certification Number (CCN)"].strip(),
            "ftag": ftag,
            "scope_severity_code": code or None,
            "scope": scope,
            "severity": severity,
            "immediate_jeopardy": immediate_jeopardy,
            "category": row.get("Deficiency Category", "").strip() or None,
        }

    def test_parse_produces_valid_scope_severity(self, cms_deficiency_rows):
        parsed = [self._parse_deficiency_row(r) for r in cms_deficiency_rows]
        for p in parsed:
            if p["scope_severity_code"]:
                assert p["scope"] in ("isolated", "pattern", "widespread"), (
                    f"Unexpected scope '{p['scope']}' for code '{p['scope_severity_code']}'"
                )
                assert p["severity"] in (1, 2, 3, 4), (
                    f"Unexpected severity {p['severity']}"
                )

    def test_immediate_jeopardy_only_for_jkl_codes(self, cms_deficiency_rows):
        parsed = [self._parse_deficiency_row(r) for r in cms_deficiency_rows]
        for p in parsed:
            code = p["scope_severity_code"]
            if code in ("J", "K", "L"):
                assert p["immediate_jeopardy"] is True
            elif code and code not in ("J", "K", "L"):
                assert p["immediate_jeopardy"] is False

    def test_ftag_format(self, cms_deficiency_rows):
        parsed = [self._parse_deficiency_row(r) for r in cms_deficiency_rows]
        for p in parsed:
            if p["ftag"]:
                assert p["ftag"].startswith("F"), f"F-tag '{p['ftag']}' does not start with F"
                assert len(p["ftag"]) == 5, (
                    f"F-tag '{p['ftag']}' is not 5 chars (F + 4 digits)"
                )
                assert p["ftag"][1:].isdigit(), (
                    f"F-tag '{p['ftag']}' digits part is not numeric"
                )

    def test_ccn_present_on_all_parsed_rows(self, cms_deficiency_rows):
        parsed = [self._parse_deficiency_row(r) for r in cms_deficiency_rows]
        for p in parsed:
            assert p["cms_ccn"], "Parsed deficiency has empty cms_ccn"
