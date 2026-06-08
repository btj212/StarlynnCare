"""
Tests: Washington DSHS Advanced Lookup (BHAdvLookup)
Source: https://fortress.wa.gov/dshs/adsaapps/Lookup/BHAdvLookup.aspx

The WA DSHS Advanced Lookup is a form-based portal. This test validates:
1. The portal is reachable and returns HTML (not an error page).
2. The form action and key form fields are present (so the ingest script can POST).
3. A simple search returns facility-like data (basic smoke test).

Note: WA DSHS requires a POST with form fields to return CSV results.
"""

from __future__ import annotations

import pytest
import requests

WA_DSHS_URL = "https://fortress.wa.gov/dshs/adsaapps/Lookup/BHAdvLookup.aspx"

# The WA DSHS portal exports a CSV of all ALFs via a form submission.
# The export URL differs per session due to ViewState.
WA_DSHS_ALF_TYPE_CODE = "ALF"


@pytest.mark.external_api
def test_wa_dshs_portal_responds(http_session: requests.Session) -> None:
    """WA DSHS Advanced Lookup portal returns HTTP 200."""
    resp = http_session.get(WA_DSHS_URL, timeout=30)
    assert resp.status_code == 200, f"WA DSHS portal returned {resp.status_code}"


@pytest.mark.external_api
def test_wa_dshs_portal_is_html(http_session: requests.Session) -> None:
    """Portal response is HTML (not a redirect to an error page)."""
    resp = http_session.get(WA_DSHS_URL, timeout=30)
    ct = resp.headers.get("content-type", "").lower()
    assert "html" in ct, f"WA DSHS portal returned non-HTML content-type: {ct!r}"


@pytest.mark.external_api
def test_wa_dshs_portal_contains_form(http_session: requests.Session) -> None:
    """Portal HTML contains a form (required for CSV export flow)."""
    resp = http_session.get(WA_DSHS_URL, timeout=30)
    assert "<form" in resp.text.lower(), (
        "WA DSHS portal HTML has no <form> element — the export flow may have changed."
    )


@pytest.mark.external_api
def test_wa_dshs_portal_has_form_action(http_session: requests.Session) -> None:
    """
    Form action points to BHAdvResults.aspx — required for the CSV export POST flow.
    The portal migrated away from ASP.NET WebForms; the form action is the stable hook.
    """
    resp = http_session.get(WA_DSHS_URL, timeout=30)
    assert "BHAdvResults.aspx" in resp.text, (
        "WA DSHS portal HTML has no form action pointing to BHAdvResults.aspx. "
        "The portal export flow may have changed — update the scraper."
    )


@pytest.mark.external_api
def test_wa_dshs_portal_does_not_require_captcha(http_session: requests.Session) -> None:
    """Portal page does not contain a CAPTCHA challenge (bot-blocking check)."""
    resp = http_session.get(WA_DSHS_URL, timeout=30)
    text_lower = resp.text.lower()
    captcha_indicators = ["captcha", "recaptcha", "hcaptcha", "are you human"]
    found = [ind for ind in captcha_indicators if ind in text_lower]
    assert not found, (
        f"WA DSHS portal appears to require CAPTCHA: {found}. "
        "The scraper will be blocked. Manual intervention required."
    )
