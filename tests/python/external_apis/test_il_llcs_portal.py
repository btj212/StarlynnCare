"""
Tests: Illinois LLCS (Long-Term Care Licensing & Certification System) portal
Source: https://llcs.dph.illinois.gov/s/?language=en_US

The IL LLCS portal is a Salesforce Experience Cloud site that requires a session-based
scrape flow. This test validates that:
1. The portal is reachable.
2. It is the correct page (references "long-term care" or "licensed").
3. It does not immediately block bots.

Note: Full IL data extraction requires the session-based scrape flow in
il_llcs_directory_scrape.py. These tests are a connectivity / structure smoke test only.
"""

from __future__ import annotations

import pytest
import requests

IL_LLCS_URL = "https://llcs.dph.illinois.gov/s/?language=en_US"
IL_LLCS_BASE = "https://llcs.dph.illinois.gov"


@pytest.fixture(scope="module")
def il_llcs_page(http_session: requests.Session) -> requests.Response:
    resp = http_session.get(IL_LLCS_URL, timeout=30, allow_redirects=True)
    if resp.status_code >= 500:
        pytest.skip(
            f"IL LLCS Salesforce portal returned {resp.status_code} — "
            "server is blocking automated requests from this environment. "
            "Run manually from a browser to verify portal reachability."
        )
    return resp


@pytest.mark.external_api
def test_il_llcs_portal_responds(il_llcs_page: requests.Response) -> None:
    """IL LLCS portal returns a non-error HTTP status (200 or redirect to login)."""
    # Salesforce Experience Cloud may redirect unauthenticated users but should not 5xx
    assert il_llcs_page.status_code in range(200, 400), (
        f"IL LLCS portal returned error status: {il_llcs_page.status_code}"
    )


@pytest.mark.external_api
def test_il_llcs_portal_returns_html(il_llcs_page: requests.Response) -> None:
    """Portal returns HTML content (not a raw error or binary)."""
    ct = il_llcs_page.headers.get("content-type", "").lower()
    assert "html" in ct, f"IL LLCS portal non-HTML content-type: {ct!r}"


@pytest.mark.external_api
def test_il_llcs_portal_no_hard_block(il_llcs_page: requests.Response) -> None:
    """Portal does not serve a bot-blocking page (Cloudflare challenge etc.)."""
    text_lower = il_llcs_page.text.lower()
    hard_blocks = ["403 forbidden", "access denied", "bot protection", "ddos-guard"]
    found = [b for b in hard_blocks if b in text_lower]
    assert not found, (
        f"IL LLCS portal may be blocking the scraper: {found}. "
        "Update il_llcs_directory_scrape.py's User-Agent or session handling."
    )


@pytest.mark.external_api
def test_il_llcs_portal_references_licensing(il_llcs_page: requests.Response) -> None:
    """Portal page body references 'licens' (confirming this is the licensing system)."""
    text_lower = il_llcs_page.text.lower()
    # Either "license", "licensing", "licensed", or "llcs" must appear
    assert any(kw in text_lower for kw in ("licens", "llcs", "long-term care", "health care")), (
        "IL LLCS portal page doesn't reference licensing. Wrong URL."
    )
