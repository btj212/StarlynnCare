"""
Tests: CMS Provider Information Dataset (Nursing Homes)
Source: https://data.cms.gov/provider-data/dataset/4pq5-n9py

The CMS data portal uses DKAN. The JSON data-api endpoint was retired; the
current access pattern is:
  1. GET the metastore record to discover the current CSV download URL.
  2. Fetch the CSV (Range request for first ~20 KB to keep tests fast).
  3. Validate column names and sample row values.

Field names in the CSV use title-case with spaces/parentheses, e.g.:
  "CMS Certification Number (CCN)", "Provider Name", "Overall Rating", …
"""

from __future__ import annotations

import csv
import io

import pytest
import requests

CMS_METASTORE_URL = (
    "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/4pq5-n9py"
)

# Fields the cms_nh_directory_ingest.py script reads.
# Names are as they appear in the CSV headers (verified May 2026).
REQUIRED_FIELDS = {
    "CMS Certification Number (CCN)",  # primary key
    "Provider Name",                   # display name
    "Provider Address",                # street
    "City/Town",                       # city
    "State",                           # two-letter state code
    "ZIP Code",                        # zip
    "County/Parish",                   # county
    "Number of Certified Beds",        # bed count
    "Overall Rating",                  # 1–5 star rating (or empty)
    "Health Inspection Rating",        # health inspection sub-rating
    "Staffing Rating",                 # staffing sub-rating
    "QM Rating",                       # quality measures sub-rating
    "Ownership Type",                  # for-profit / non-profit / government
}


@pytest.fixture(scope="module")
def csv_url(http_session: requests.Session) -> str:
    """Resolve the current NH ProviderInfo CSV URL via the DKAN metastore."""
    resp = http_session.get(CMS_METASTORE_URL, timeout=30)
    assert resp.status_code == 200, (
        f"CMS metastore returned {resp.status_code} for dataset 4pq5-n9py"
    )
    body = resp.json()
    distributions = body.get("distribution", [])
    assert distributions, "CMS metastore returned no distributions for 4pq5-n9py"
    url = distributions[0].get("downloadURL", "")
    assert url.endswith(".csv"), f"Expected a .csv download URL, got: {url}"
    return url


@pytest.fixture(scope="module")
def cms_sample(http_session: requests.Session, csv_url: str) -> list[dict]:
    """Fetch first ~20 KB of the NH CSV and return up to 10 parsed rows."""
    resp = http_session.get(
        csv_url,
        headers={"Range": "bytes=0-20479"},
        timeout=30,
    )
    # 206 Partial Content is correct; 200 is acceptable if Range is ignored
    assert resp.status_code in (200, 206), (
        f"CMS CSV download returned {resp.status_code}"
    )
    text = resp.content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    # Last row may be truncated — drop it to avoid partial-row failures
    if len(rows) > 1:
        rows = rows[:-1]
    return rows[:10]


# ── Basic reachability ────────────────────────────────────────────────────────

@pytest.mark.external_api
def test_cms_metastore_returns_dataset(http_session: requests.Session) -> None:
    """CMS DKAN metastore returns a record for dataset 4pq5-n9py."""
    resp = http_session.get(CMS_METASTORE_URL, timeout=30)
    assert resp.status_code == 200, f"Metastore returned {resp.status_code}"
    body = resp.json()
    assert body.get("identifier") == "4pq5-n9py", (
        f"Unexpected identifier: {body.get('identifier')}"
    )
    assert body.get("title"), "Dataset title is missing"


@pytest.mark.external_api
def test_cms_csv_url_is_resolvable(http_session: requests.Session, csv_url: str) -> None:
    """The CSV download URL resolves to a valid CSV file."""
    resp = http_session.head(csv_url, timeout=20)
    assert resp.status_code in (200, 206), (
        f"CSV HEAD returned {resp.status_code} for {csv_url}"
    )
    ct = resp.headers.get("content-type", "")
    assert "csv" in ct or "text" in ct or "octet" in ct, (
        f"Unexpected Content-Type for CSV: {ct}"
    )


@pytest.mark.external_api
def test_cms_csv_is_large_enough(http_session: requests.Session, csv_url: str) -> None:
    """CSV file is at least 2 MB — consistent with 14,000+ nursing home records."""
    with http_session.get(csv_url, stream=True, timeout=30) as resp:
        assert resp.status_code == 200, f"CMS CSV returned {resp.status_code}"
        size = int(resp.headers.get("content-length", 0))
    assert size >= 2_000_000, (
        f"CMS CSV Content-Length is {size:,} bytes — expected ≥2 MB for a national dataset. "
        "The dataset may have been truncated or the URL has changed."
    )


# ── Column schema ─────────────────────────────────────────────────────────────

@pytest.mark.external_api
def test_cms_record_has_all_required_fields(cms_sample: list[dict]) -> None:
    """Every sampled record contains all fields the ingest script reads."""
    assert cms_sample, "No CMS records to test"
    for record in cms_sample:
        missing = REQUIRED_FIELDS - set(record.keys())
        assert not missing, (
            f"CMS CSV record missing required fields: {missing}\n"
            f"Available (first 20): {sorted(record.keys())[:20]}"
        )


# ── Value validation ──────────────────────────────────────────────────────────

@pytest.mark.external_api
def test_cms_ccn_is_non_empty(cms_sample: list[dict]) -> None:
    """CMS Certification Number (primary key) is non-empty on all sampled records."""
    assert cms_sample, "No CMS records"
    nulls = [r for r in cms_sample if not r.get("CMS Certification Number (CCN)", "").strip()]
    assert not nulls, f"{len(nulls)} CMS records have an empty CCN"


@pytest.mark.external_api
def test_cms_provider_name_is_non_empty(cms_sample: list[dict]) -> None:
    """Provider Name is non-empty on all sampled records."""
    assert cms_sample, "No CMS records"
    nulls = [r for r in cms_sample if not r.get("Provider Name", "").strip()]
    assert not nulls, f"{len(nulls)} CMS records have an empty Provider Name"


@pytest.mark.external_api
def test_cms_state_code_is_two_letters(cms_sample: list[dict]) -> None:
    """State is a two-letter code on all sampled records."""
    assert cms_sample, "No CMS records"
    bad = [
        r.get("State") for r in cms_sample
        if len((r.get("State") or "").strip()) != 2
    ]
    assert not bad, f"Non-two-letter State values: {bad}"


@pytest.mark.external_api
def test_cms_overall_rating_is_1_to_5_or_null(cms_sample: list[dict]) -> None:
    """Overall Rating is 1–5 (integer) or empty — never out of range."""
    assert cms_sample, "No CMS records"
    bad = []
    for r in cms_sample:
        rating = (r.get("Overall Rating") or "").strip()
        if not rating:
            continue
        try:
            val = int(float(rating))
            if not 1 <= val <= 5:
                bad.append((r.get("CMS Certification Number (CCN)"), val))
        except (ValueError, TypeError):
            bad.append((r.get("CMS Certification Number (CCN)"), rating))
    assert not bad, f"Overall Rating out of 1–5 range: {bad}"


@pytest.mark.external_api
def test_cms_certified_beds_is_numeric_where_present(cms_sample: list[dict]) -> None:
    """Number of Certified Beds is numeric (or empty) — never a free-form string."""
    assert cms_sample, "No CMS records"
    bad = []
    for r in cms_sample:
        beds = (r.get("Number of Certified Beds") or "").strip()
        if not beds:
            continue
        try:
            int(float(beds))
        except (ValueError, TypeError):
            bad.append((r.get("CMS Certification Number (CCN)"), beds))
    assert not bad, f"Non-numeric Number of Certified Beds: {bad}"
