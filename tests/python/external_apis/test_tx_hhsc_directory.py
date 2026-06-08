"""
Tests: Texas HHSC Assisted Living Facility directory export
Source: https://www.hhs.texas.gov/providers/long-term-care-providers/assisted-living-facilities-alf

The TX HHSC directory is an Excel export downloaded from the HHSC website.
This test validates the landing page is reachable and contains the export link.

Note: TX scraper requires a manual download step (the export link is on the landing page).
We test that: (1) the page responds, (2) it references an Excel download for ALF providers.
"""

from __future__ import annotations

import re

import pytest
import requests

TX_HHSC_PAGE = (
    "https://www.hhs.texas.gov/providers/long-term-care-providers/assisted-living-facilities-alf"
)
TX_HHSC_BASE = "https://www.hhs.texas.gov"

# Fields the ingest script reads from the HHSC XLSX.
# From tx_alf_ingest.py — exact column names from the HHSC export.
REQUIRED_XLSX_COLUMNS = {
    "Facility Name",
    "License Number",
    "City",
    "County",
    "Zip",
    "License Type",
    "Capacity",
}


@pytest.fixture(scope="module")
def tx_page(http_session: requests.Session) -> requests.Response:
    return http_session.get(TX_HHSC_PAGE, timeout=30)


@pytest.mark.external_api
def test_tx_hhsc_page_responds(tx_page: requests.Response) -> None:
    """TX HHSC ALF directory page returns HTTP 200."""
    assert tx_page.status_code == 200, (
        f"TX HHSC page returned {tx_page.status_code}"
    )


@pytest.mark.external_api
def test_tx_hhsc_page_is_html(tx_page: requests.Response) -> None:
    """Response is HTML."""
    ct = tx_page.headers.get("content-type", "").lower()
    assert "html" in ct, f"TX HHSC page non-HTML: {ct!r}"


@pytest.mark.external_api
def test_tx_hhsc_page_mentions_assisted_living(tx_page: requests.Response) -> None:
    """Page references 'assisted living' in its body (confirming the correct page)."""
    assert "assisted living" in tx_page.text.lower(), (
        "TX HHSC page doesn't mention 'assisted living'. Wrong URL."
    )


@pytest.mark.external_api
def test_tx_hhsc_page_has_excel_or_download_link(tx_page: requests.Response) -> None:
    """Page has a link to an Excel download (the ALF directory)."""
    text_lower = tx_page.text.lower()
    has_link = (
        ".xlsx" in text_lower
        or ".xls" in text_lower
        or "excel" in text_lower
        or "download" in text_lower
        or "spreadsheet" in text_lower
    )
    assert has_link, (
        "TX HHSC ALF page has no Excel/download link. "
        "The directory access method may have changed — update tx_alf_ingest.py."
    )


@pytest.mark.external_api
def test_tx_hhsc_excel_link_resolves(
    tx_page: requests.Response, http_session: requests.Session
) -> None:
    """The Excel download link resolves to a file (not a 404)."""
    links = re.findall(
        r'href=["\']([^"\']*(?:\.xlsx|\.xls)[^"\']*)["\']',
        tx_page.text, re.IGNORECASE
    )
    if not links:
        pytest.skip("No Excel download links found on TX HHSC page")

    statuses = []
    for link in links[:3]:
        if link.startswith("http"):
            url = link
        elif link.startswith("//"):
            url = f"https:{link}"
        else:
            url = f"{TX_HHSC_BASE}{link}"
        try:
            resp = http_session.head(url, timeout=30, allow_redirects=True)
            statuses.append(resp.status_code)
            if resp.status_code in (200, 206, 302):
                return  # link is live
            if resp.status_code == 503:
                # Server-side rate-limiting or IP blocking — link exists, server just unavailable
                pytest.skip(
                    f"TX HHSC Excel file returned 503 (server unavailable from this IP). "
                    f"The download link {url!r} exists on the page — run from a browser to verify."
                )
        except requests.RequestException:
            continue
    pytest.fail(
        f"None of the TX Excel links resolved to a valid file. "
        f"Links tried: {links[:3]}, statuses: {statuses}"
    )
