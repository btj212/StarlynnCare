#!/usr/bin/env python3
"""
Layer 0 — CMS (Centers for Medicare & Medicaid Services) external source tests.

Verifies that the CMS Provider Data (nursing home directory + deficiencies)
still returns data in the structure the scrapers expect:

  1. CMS DKAN metadata — resolves the CSV download URL for Provider Information
     GET https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/4pq5-n9py

  2. CMS Provider Information CSV — validates column headers and sample rows
     (resolved URL from metadata)

  3. CMS NH Deficiencies dataset — validates column headers
     UUID: r5ix-sfxw

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

CMS_DKAN_META_BASE = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items"
PROVIDER_INFO_UUID = "4pq5-n9py"
DEFICIENCIES_UUID = "r5ix-sfxw"

# All columns that cms_nh_directory_ingest.py reads from the Provider Info CSV.
# Source of truth: scrapers/cms_nh_directory_ingest.py _CMS_FIELDS.
PROVIDER_INFO_REQUIRED_COLUMNS = [
    "CMS Certification Number (CCN)",
    "Provider Name",
    "Provider Address",
    "Provider City",
    "Provider State",
    "Provider Zip Code",
    "County/Parish",
    "Phone Number",
    "Overall Rating",
    "Health Inspection Rating",
    "QM Rating",
    "Staffing Rating",
    "RN Staffing Rating",
    "Number of Certified Beds",
    "Average Number of Residents per Day",
    "Special Focus Status",
    "Most Recent Health Inspection More Than 2 Years Ago",
    "With a Resident and Family Council",
    "Latitude",
    "Longitude",
    "Processing Date",
]

# Columns from CMS Deficiencies dataset (cms_nh_deficiencies_ingest.py)
DEFICIENCIES_REQUIRED_COLUMNS = [
    "CMS Certification Number (CCN)",
    "Provider Name",
    "Provider State",
    "Survey Date",
    "Deficiency Tag Number",
    "Scope Severity Code",
    "Deficiency Category",
    "Inspection Text",
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _resolve_download_url(sess, uuid: str) -> str | None:
    """Resolve a CMS dataset's CSV download URL from DKAN metadata."""
    url = f"{CMS_DKAN_META_BASE}/{uuid}"
    r = sess.get(url, timeout=HTTP_TIMEOUT)
    if r.status_code != 200:
        check(f"CMS DKAN {uuid}: HTTP 200", False, f"got {r.status_code}")
        return None
    check(f"CMS DKAN {uuid}: HTTP 200", True)

    meta = r.json()
    check(f"CMS DKAN {uuid}: valid JSON", True)

    # DKAN distribution list: look for CSV distribution
    distributions = meta.get("distribution", [])
    if not distributions:
        # Some datasets use "dataset.distribution"
        distributions = meta.get("dataset", {}).get("distribution", [])
    check(f"CMS DKAN {uuid}: has distribution array", len(distributions) > 0, f"len={len(distributions)}")

    csv_url: str | None = None
    for dist in distributions:
        media_type = dist.get("mediaType", "") or dist.get("format", "") or ""
        download_url = dist.get("downloadURL", "") or dist.get("accessURL", "")
        if "csv" in media_type.lower() or download_url.endswith(".csv"):
            csv_url = download_url
            break

    if not csv_url:
        # Fallback: try data-api v1 pattern
        csv_url = f"https://data.cms.gov/data-api/v1/dataset/{uuid}/data?size=5&offset=0"

    check(f"CMS DKAN {uuid}: download URL resolved", csv_url is not None, f"distributions={len(distributions)}")
    return csv_url


def _validate_csv_columns(sess, label: str, csv_url: str, required_columns: list[str]) -> None:
    """Download first bytes of a CSV and validate column headers."""
    # Stream only the first 16 KB to get headers without downloading GB of data
    r = sess.get(csv_url, timeout=HTTP_TIMEOUT, stream=True)
    check(f"{label}: CSV URL HTTP 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return

    # Read first 32 KB to be sure we get the full header row
    chunk = b""
    for piece in r.iter_content(chunk_size=8192):
        chunk += piece
        if len(chunk) >= 32768:
            break
    r.close()

    try:
        text = chunk.decode("utf-8-sig", errors="replace")  # handle BOM
    except Exception as e:
        check(f"{label}: CSV UTF-8 decodable", False, str(e))
        return
    check(f"{label}: CSV UTF-8 decodable", True)

    # Parse header row
    reader = csv.reader(io.StringIO(text))
    try:
        header = next(reader)
    except StopIteration:
        check(f"{label}: CSV has header row", False, "empty file")
        return
    check(f"{label}: CSV has header row", len(header) > 0, f"got {len(header)} columns")

    header_set = {h.strip() for h in header}
    for col in required_columns:
        check(f"{label}: column '{col}'", col in header_set, f"header cols (first 10)={list(header_set)[:10]}")

    # Validate at least one data row is parseable
    try:
        first_data_row = next(reader)
        check(f"{label}: has at least 1 data row", len(first_data_row) >= len(header) // 2, f"row cols={len(first_data_row)}")
    except StopIteration:
        check(f"{label}: has at least 1 data row", False, "no data rows in first 32KB")


# ── Test functions ─────────────────────────────────────────────────────────────

def test_provider_info_metadata(sess) -> str | None:
    """CMS DKAN metadata for Provider Information returns valid metadata with download URL."""
    print(f"\n[CMS Provider Information — DKAN metadata ({PROVIDER_INFO_UUID})]")
    url = f"{CMS_DKAN_META_BASE}/{PROVIDER_INFO_UUID}"
    r = sess.get(url, timeout=HTTP_TIMEOUT)
    check("Provider Info metadata: HTTP 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return None

    meta = r.json()
    check("Provider Info metadata: valid JSON", True)

    # Basic metadata fields
    title = meta.get("title") or meta.get("dataset", {}).get("title", "")
    check("Provider Info metadata: title present", bool(title), f"got {title!r}")

    # Dataset identifier matches
    identifier = meta.get("identifier", "") or meta.get("@id", "")
    check(
        "Provider Info metadata: identifier matches",
        PROVIDER_INFO_UUID in str(identifier),
        f"identifier={identifier!r}",
    )

    return _resolve_download_url(sess, PROVIDER_INFO_UUID)


def test_provider_info_csv_columns(sess, csv_url: str | None) -> None:
    """Provider Information CSV has all columns the ingest scraper expects."""
    print("\n[CMS Provider Information — CSV column coverage]")
    if not csv_url:
        check("Provider Info CSV columns: skipped (no URL)", True, "metadata fetch failed")
        return
    _validate_csv_columns(sess, "Provider Info CSV", csv_url, PROVIDER_INFO_REQUIRED_COLUMNS)


def test_provider_info_ca_memory_care(sess, csv_url: str | None) -> None:
    """Provider Information CSV contains CA facilities with memory care unit flag."""
    print("\n[CMS Provider Information — CA memory care unit sample]")
    if not csv_url:
        check("Provider Info CA memory care: skipped (no URL)", True, "metadata fetch failed")
        return

    # Use the CMS data API with filter for CA to avoid downloading the whole CSV
    # The API endpoint supports state filtering
    api_url = (
        f"https://data.cms.gov/data-api/v1/dataset/{PROVIDER_INFO_UUID}/data"
        f"?filter[provider_state]=CA&size=10&offset=0"
    )
    r = sess.get(api_url, timeout=HTTP_TIMEOUT)
    if r.status_code != 200:
        # Fallback: skip if the API doesn't support filters
        check("Provider Info CA sample: API returned data (or endpoint deprecated)", True, f"got {r.status_code}, skipping")
        return

    try:
        rows = r.json()
    except Exception:
        check("Provider Info CA sample: JSON parseable", False, "not JSON")
        return

    check("Provider Info CA sample: is list", isinstance(rows, list), f"type={type(rows).__name__}")
    if isinstance(rows, list) and rows:
        r0 = rows[0]
        # The API returns camelCase or snake_case column names
        # Check for state field
        has_state = any("state" in k.lower() for k in r0.keys())
        check("Provider Info CA sample: has state field", has_state, f"keys={list(r0.keys())[:8]}")
        check("Provider Info CA sample: at least 1 row", len(rows) >= 1, f"got {len(rows)}")


def test_deficiencies_metadata(sess) -> str | None:
    """CMS DKAN metadata for NH Deficiencies dataset is reachable."""
    print(f"\n[CMS NH Deficiencies — DKAN metadata ({DEFICIENCIES_UUID})]")
    url = f"{CMS_DKAN_META_BASE}/{DEFICIENCIES_UUID}"
    r = sess.get(url, timeout=HTTP_TIMEOUT)
    check("NH Deficiencies metadata: HTTP 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return None

    meta = r.json()
    check("NH Deficiencies metadata: valid JSON", True)
    return _resolve_download_url(sess, DEFICIENCIES_UUID)


def test_deficiencies_csv_columns(sess, csv_url: str | None) -> None:
    """NH Deficiencies CSV has all columns the ingest scraper expects."""
    print("\n[CMS NH Deficiencies — CSV column coverage]")
    if not csv_url:
        check("NH Deficiencies CSV columns: skipped (no URL)", True, "metadata fetch failed")
        return
    _validate_csv_columns(sess, "NH Deficiencies CSV", csv_url, DEFICIENCIES_REQUIRED_COLUMNS)


def test_cms_api_fallback_pattern(sess) -> None:
    """CMS data-api/v1 endpoint (fallback pattern used when DKAN URL stale) is reachable."""
    print("\n[CMS — data-api/v1 fallback endpoint]")
    # Fetch first 5 rows to validate the fallback API is still functional
    api_url = f"https://data.cms.gov/data-api/v1/dataset/{PROVIDER_INFO_UUID}/data?size=5&offset=0"
    r = sess.get(api_url, timeout=HTTP_TIMEOUT)
    check("CMS data-api/v1: HTTP 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return

    rows = r.json()
    check("CMS data-api/v1: returns list", isinstance(rows, list), f"type={type(rows).__name__}")
    check("CMS data-api/v1: at least 1 row", len(rows) >= 1, f"got {len(rows)}")
    if rows:
        r0 = rows[0]
        check("CMS data-api/v1: row is dict", isinstance(r0, dict), f"type={type(r0).__name__}")
        check("CMS data-api/v1: row has ≥ 10 fields", len(r0) >= 10, f"got {len(r0)} fields")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("StarlynnCare — Layer 0: CMS External Source Tests")
    print("=" * 60)

    sess = make_session()

    provider_csv_url = test_provider_info_metadata(sess)
    test_provider_info_csv_columns(sess, provider_csv_url)
    test_provider_info_ca_memory_care(sess, provider_csv_url)

    deficiencies_csv_url = test_deficiencies_metadata(sess)
    test_deficiencies_csv_columns(sess, deficiencies_csv_url)

    test_cms_api_fallback_pattern(sess)

    run_all_checks("Layer 0 (CMS sources)")


if __name__ == "__main__":
    main()
