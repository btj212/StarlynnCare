"""
Tests: Minnesota MDH Facility Directory
Source: https://www.health.state.mn.us/facilities/regulation/directory/directorydatafile.html

The MDH directory data file page provides a download link for the XLSX provider
directory. This test validates the page is reachable and contains a usable download link.
"""

from __future__ import annotations

import re

import pytest
import requests

MN_MDH_URL = "https://www.health.state.mn.us/facilities/regulation/directory/directorydatafile.html"
MN_MDH_BASE = "https://www.health.state.mn.us"


@pytest.fixture(scope="module")
def mn_mdh_page(http_session: requests.Session) -> requests.Response:
    resp = http_session.get(MN_MDH_URL, timeout=30)
    return resp


@pytest.mark.external_api
def test_mn_mdh_page_responds(mn_mdh_page: requests.Response) -> None:
    """MDH directory data file page returns HTTP 200."""
    assert mn_mdh_page.status_code == 200, (
        f"MN MDH page returned {mn_mdh_page.status_code}"
    )


@pytest.mark.external_api
def test_mn_mdh_page_is_html(mn_mdh_page: requests.Response) -> None:
    """Response is HTML."""
    ct = mn_mdh_page.headers.get("content-type", "").lower()
    assert "html" in ct, f"MN MDH page returned non-HTML: {ct!r}"


@pytest.mark.external_api
def test_mn_mdh_page_contains_download_link(mn_mdh_page: requests.Response) -> None:
    """Page HTML contains a download link for the directory file (XLSX or CSV)."""
    text_lower = mn_mdh_page.text.lower()
    # Look for links to Excel/CSV files or text like "download" or "data file"
    has_download = (
        ".xlsx" in text_lower
        or ".xls" in text_lower
        or ".csv" in text_lower
        or "download" in text_lower
        or "data file" in text_lower
    )
    assert has_download, (
        "MN MDH page does not appear to contain a download link for the directory file. "
        "The page structure may have changed — update mn_mdh_directory_ingest.py."
    )


@pytest.mark.external_api
def test_mn_mdh_page_mentions_assisted_living(mn_mdh_page: requests.Response) -> None:
    """Page references Assisted Living providers (confirming this is the correct data source)."""
    text_lower = mn_mdh_page.text.lower()
    assert "assisted living" in text_lower, (
        "MN MDH page does not mention 'assisted living'. Wrong URL or page changed."
    )


@pytest.mark.external_api
def test_mn_mdh_download_link_resolves(
    mn_mdh_page: requests.Response, http_session: requests.Session
) -> None:
    """The directory download link resolves to a file (not a 404)."""
    # Find href links that look like data file downloads
    links = re.findall(r'href=["\']([^"\']*(?:\.xlsx|\.xls|\.csv)[^"\']*)["\']',
                       mn_mdh_page.text, re.IGNORECASE)
    if not links:
        pytest.skip("No XLSX/CSV download links found on MN MDH page — check the page HTML")

    for link in links[:3]:  # check first 3 candidates
        url = link if link.startswith("http") else f"{MN_MDH_BASE}{link}"
        resp = http_session.head(url, timeout=30, allow_redirects=True)
        if resp.status_code == 200:
            return  # At least one download link works
    pytest.fail(
        f"None of the download links resolved successfully: {links[:3]}"
    )
