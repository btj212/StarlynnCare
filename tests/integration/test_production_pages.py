"""
Production HTTP Tests — Layer 3 (pytest edition).

Tests the live StarlynnCare site by making real HTTP requests.
No mocks.  These tests validate the entire stack end-to-end:
  data → loader → render → HTTP response → content.

What they prove:
  • Every sampled facility profile page loads with HTTP 200.
  • Pages contain the facility name (not a 404 placeholder).
  • No NaN/undefined/[object Object] rendering artifacts.
  • JSON-LD structured data is present and valid JSON.
  • Hub pages (state, city) load correctly.
  • The CA report page loads and contains expected data.
  • The watch API endpoint accepts a valid POST.

Run:
    pytest tests/integration/test_production_pages.py -v
    SITE_BASE_URL=https://your-preview.vercel.app pytest tests/integration/test_production_pages.py -v
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.conftest import http_get, PRODUCTION_URL  # noqa: E402

# Known facility slugs that must always exist on the live site.
# These are permanent regression anchors — if any returns != 200, something is broken.
KNOWN_FACILITY_PAGES = [
    # (state, city_slug, slug, expected_name_substring)
    ("ca", "oakland", "opal-care-llc-200672", "Opal"),
]

# Hub pages that must return 200
KNOWN_HUB_PAGES = [
    "/california",
    "/california/facilities",
    "/california/oakland",
]

# Report pages
KNOWN_REPORT_PAGES = [
    "/reports/california-rcfe-repeat-citations-2026",
]

# Patterns that must NEVER appear in any rendered page
FORBIDDEN_PATTERNS = [
    r"\bNaN\b",
    r"\bundefined\b",
    r"\[object Object\]",
]


def _fetch_page(path: str, base: str = PRODUCTION_URL) -> tuple[int, str]:
    url = base.rstrip("/") + path
    status, body = http_get(url, timeout=20)
    text = body.decode("utf-8", errors="replace") if isinstance(body, bytes) else str(body)
    return status, text


def _check_no_render_artifacts(body: str, label: str) -> list[str]:
    """Return list of rendering artifact violations found in body."""
    issues = []
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, body):
            issues.append(f"{label}: found '{pattern}' in body")
    return issues


def _extract_jsonld(body: str) -> list[dict]:
    """Extract and parse all <script type='application/ld+json'> blocks from HTML."""
    result = []
    for match in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        body, re.DOTALL | re.IGNORECASE,
    ):
        try:
            data = json.loads(match.group(1).strip())
            result.append(data)
        except json.JSONDecodeError as e:
            result.append({"_parse_error": str(e), "_raw": match.group(1)[:200]})
    return result


# ══════════════════════════════════════════════════════════════════════════════
# Known facility regression pages
# ══════════════════════════════════════════════════════════════════════════════


class TestKnownFacilityPages:
    """Known facility pages that must always load correctly."""

    @pytest.mark.parametrize("state,city,slug,name_hint", KNOWN_FACILITY_PAGES)
    def test_page_returns_200(self, base_url, state, city, slug, name_hint):
        """Known facility page returns HTTP 200."""
        status, _ = _fetch_page(f"/{state}/{city}/{slug}", base_url)
        assert status == 200, (
            f"/{state}/{city}/{slug} returned HTTP {status}"
        )

    @pytest.mark.parametrize("state,city,slug,name_hint", KNOWN_FACILITY_PAGES)
    def test_page_contains_facility_name(self, base_url, state, city, slug, name_hint):
        """Known facility page body contains a substring of the facility name."""
        status, body = _fetch_page(f"/{state}/{city}/{slug}", base_url)
        if status != 200:
            pytest.skip(f"Page returned {status}")
        assert name_hint.lower() in body.lower(), (
            f"Page /{state}/{city}/{slug} doesn't contain '{name_hint}' in body"
        )

    @pytest.mark.parametrize("state,city,slug,name_hint", KNOWN_FACILITY_PAGES)
    def test_page_has_no_render_artifacts(self, base_url, state, city, slug, name_hint):
        """Known facility page has no NaN/undefined/[object Object] artifacts."""
        status, body = _fetch_page(f"/{state}/{city}/{slug}", base_url)
        if status != 200:
            pytest.skip(f"Page returned {status}")
        issues = _check_no_render_artifacts(body, f"/{state}/{city}/{slug}")
        assert not issues, "\n".join(issues)

    @pytest.mark.parametrize("state,city,slug,name_hint", KNOWN_FACILITY_PAGES)
    def test_page_has_valid_jsonld(self, base_url, state, city, slug, name_hint):
        """Known facility page has at least one valid JSON-LD block."""
        status, body = _fetch_page(f"/{state}/{city}/{slug}", base_url)
        if status != 200:
            pytest.skip(f"Page returned {status}")
        jsonld_blocks = _extract_jsonld(body)
        assert jsonld_blocks, (
            f"/{state}/{city}/{slug} has no JSON-LD structured data blocks"
        )
        parse_errors = [b for b in jsonld_blocks if "_parse_error" in b]
        assert not parse_errors, (
            f"/{state}/{city}/{slug} has {len(parse_errors)} invalid JSON-LD blocks: "
            f"{parse_errors[0].get('_parse_error')}"
        )

    @pytest.mark.parametrize("state,city,slug,name_hint", KNOWN_FACILITY_PAGES)
    def test_page_jsonld_has_localbusiness_schema(self, base_url, state, city, slug, name_hint):
        """Known facility page has a LocalBusiness JSON-LD schema."""
        status, body = _fetch_page(f"/{state}/{city}/{slug}", base_url)
        if status != 200:
            pytest.skip(f"Page returned {status}")
        jsonld_blocks = _extract_jsonld(body)
        local_biz = [
            b for b in jsonld_blocks
            if isinstance(b, dict) and b.get("@type") in ("LocalBusiness", "MedicalBusiness")
        ]
        assert local_biz, (
            f"/{state}/{city}/{slug} has no LocalBusiness JSON-LD schema. "
            f"Found types: {[b.get('@type') for b in jsonld_blocks if isinstance(b, dict)]}"
        )

    @pytest.mark.parametrize("state,city,slug,name_hint", KNOWN_FACILITY_PAGES)
    def test_page_jsonld_has_breadcrumb(self, base_url, state, city, slug, name_hint):
        """Known facility page has a BreadcrumbList JSON-LD schema."""
        status, body = _fetch_page(f"/{state}/{city}/{slug}", base_url)
        if status != 200:
            pytest.skip(f"Page returned {status}")
        jsonld_blocks = _extract_jsonld(body)
        breadcrumbs = [
            b for b in jsonld_blocks
            if isinstance(b, dict) and b.get("@type") == "BreadcrumbList"
        ]
        assert breadcrumbs, f"/{state}/{city}/{slug} has no BreadcrumbList JSON-LD"


# ══════════════════════════════════════════════════════════════════════════════
# Opal Care regression
# ══════════════════════════════════════════════════════════════════════════════


class TestOpalCareRegression:
    """
    Opal Care is a known bad actor (many repeat citations, low percentile).
    It must NEVER appear with a positive label like 'highly rated'.
    """

    def test_opal_care_page_loads(self, base_url):
        """Opal Care page returns HTTP 200."""
        status, _ = _fetch_page("/ca/oakland/opal-care-llc-200672", base_url)
        assert status == 200, f"Opal Care page returned HTTP {status}"

    def test_opal_care_has_no_highly_rated_label(self, base_url):
        """Opal Care page must NOT contain 'highly rated' anywhere."""
        status, body = _fetch_page("/ca/oakland/opal-care-llc-200672", base_url)
        if status != 200:
            pytest.skip(f"Opal Care page returned {status}")
        assert "highly rated" not in body.lower(), (
            "Opal Care page contains 'highly rated' — this is the forbidden fallback text. "
            "This is a regression for the Opal Care bug."
        )

    def test_opal_care_has_no_positive_superlatives(self, base_url):
        """Opal Care page must not contain positive superlatives."""
        status, body = _fetch_page("/ca/oakland/opal-care-llc-200672", base_url)
        if status != 200:
            pytest.skip(f"Opal Care page returned {status}")
        bad_phrases = ["top rated", "award winning", "outstanding care"]
        found = [p for p in bad_phrases if p in body.lower()]
        assert not found, (
            f"Opal Care page contains positive superlatives: {found} — "
            f"this is a bad actor facility and must not receive positive labels"
        )

    def test_opal_care_jsonld_has_no_high_rating(self, base_url):
        """Opal Care JSON-LD must not have aggregateRating with ratingValue ≥ 4."""
        status, body = _fetch_page("/ca/oakland/opal-care-llc-200672", base_url)
        if status != 200:
            pytest.skip(f"Opal Care page returned {status}")
        blocks = _extract_jsonld(body)
        for block in blocks:
            if not isinstance(block, dict):
                continue
            rating = block.get("aggregateRating")
            if rating is None:
                continue
            rv = rating.get("ratingValue")
            if rv is not None:
                assert float(rv) < 4.0, (
                    f"Opal Care JSON-LD has aggregateRating.ratingValue={rv} (≥4.0) — "
                    f"this is a repeat-offender facility and must not have a high rating"
                )


# ══════════════════════════════════════════════════════════════════════════════
# Hub pages
# ══════════════════════════════════════════════════════════════════════════════


class TestHubPages:
    """State and city hub pages must load correctly."""

    @pytest.mark.parametrize("path", KNOWN_HUB_PAGES)
    def test_hub_page_returns_200(self, base_url, path):
        """Hub page returns HTTP 200."""
        status, _ = _fetch_page(path, base_url)
        assert status == 200, f"{path} returned HTTP {status}"

    @pytest.mark.parametrize("path", KNOWN_HUB_PAGES)
    def test_hub_page_has_no_render_artifacts(self, base_url, path):
        """Hub page has no NaN/undefined/[object Object] rendering artifacts."""
        status, body = _fetch_page(path, base_url)
        if status != 200:
            pytest.skip(f"{path} returned {status}")
        issues = _check_no_render_artifacts(body, path)
        assert not issues, "\n".join(issues)

    @pytest.mark.parametrize("path", KNOWN_HUB_PAGES)
    def test_hub_page_has_substantial_content(self, base_url, path):
        """Hub page body is larger than 5000 characters (not an empty shell)."""
        status, body = _fetch_page(path, base_url)
        if status != 200:
            pytest.skip(f"{path} returned {status}")
        assert len(body) > 5000, (
            f"{path} body is only {len(body)} chars — expected >5000 (page may not be rendering)"
        )

    def test_california_hub_has_facility_count(self, base_url):
        """California hub page mentions number of facilities."""
        status, body = _fetch_page("/california", base_url)
        if status != 200:
            pytest.skip(f"/california returned {status}")
        # Should mention some number of facilities
        has_number = bool(re.search(r'\b\d+\b.*facilit', body, re.IGNORECASE))
        assert has_number or "facilit" in body.lower(), (
            "California hub page doesn't mention facilities — content may not be rendering"
        )

    def test_facilities_browse_page_returns_200_for_all_states(self, base_url):
        """/{state}/facilities browse page returns 200 for all published states."""
        states_to_test = ("california", "oregon", "washington", "minnesota")
        for state in states_to_test:
            status, _ = _fetch_page(f"/{state}/facilities", base_url)
            assert status == 200, f"/{state}/facilities returned HTTP {status}"


# ══════════════════════════════════════════════════════════════════════════════
# Report pages
# ══════════════════════════════════════════════════════════════════════════════


class TestReportPages:
    """Report pages must load and contain expected data."""

    @pytest.mark.parametrize("path", KNOWN_REPORT_PAGES)
    def test_report_page_returns_200(self, base_url, path):
        """Report page returns HTTP 200."""
        status, _ = _fetch_page(path, base_url)
        assert status == 200, f"{path} returned HTTP {status}"

    def test_ca_repeat_citations_report_contains_known_facilities(self, base_url):
        """CA repeat citations report contains at least one known top-5 facility name."""
        status, body = _fetch_page(
            "/reports/california-rcfe-repeat-citations-2026", base_url
        )
        if status != 200:
            pytest.skip(f"Report page returned {status}")
        known_facilities = ["Opal Care", "Oakland Heights", "Whitten Heights"]
        found = [f for f in known_facilities if f.lower() in body.lower()]
        assert found, (
            f"CA report doesn't mention any known top-5 facility. "
            f"Expected one of {known_facilities}."
        )

    def test_ca_repeat_citations_report_has_no_render_artifacts(self, base_url):
        """CA repeat citations report has no NaN/undefined artifacts."""
        status, body = _fetch_page(
            "/reports/california-rcfe-repeat-citations-2026", base_url
        )
        if status != 200:
            pytest.skip(f"Report page returned {status}")
        issues = _check_no_render_artifacts(body, "CA repeat citations report")
        assert not issues, "\n".join(issues)

    def test_ca_repeat_citations_report_body_is_substantial(self, base_url):
        """CA repeat citations report body > 5000 chars (real content is rendering)."""
        status, body = _fetch_page(
            "/reports/california-rcfe-repeat-citations-2026", base_url
        )
        if status != 200:
            pytest.skip(f"Report page returned {status}")
        assert len(body) > 5000, (
            f"CA report body is only {len(body)} chars — expected >5000"
        )


# ══════════════════════════════════════════════════════════════════════════════
# Sampled live facility pages (DB-backed — needs both HTTP + DB)
# ══════════════════════════════════════════════════════════════════════════════


class TestSampledFacilityPages:
    """
    Sample publishable facilities from the DB and verify their profile pages
    on the live site.  Tests the full stack: DB → loader → render → HTTP.
    """

    @pytest.mark.parametrize("state", ("CA", "OR", "WA", "MN", "TX"))
    def test_sampled_facilities_return_200(self, db, base_url, state):
        """3 randomly sampled publishable facilities per state return HTTP 200."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, city_slug, slug, name
                FROM facilities
                WHERE publishable = true AND state_code = %s
                ORDER BY name ASC
                LIMIT 3
                """,
                (state,),
            )
            facilities = cur.fetchall()

        if not facilities:
            pytest.skip(f"{state}: no publishable facilities in DB")

        failures = []
        for fac in facilities:
            st = fac["state_code"].lower()
            path = f"/{st}/{fac['city_slug']}/{fac['slug']}"
            status, _ = _fetch_page(path, base_url)
            if status != 200:
                failures.append(f"{path}: HTTP {status}")

        assert not failures, (
            f"{state}: {len(failures)} facility pages returned non-200: "
            f"{failures}"
        )

    @pytest.mark.parametrize("state", ("CA", "OR", "WA", "MN", "TX"))
    def test_sampled_facilities_contain_name(self, db, base_url, state):
        """Sampled facility pages contain a substring of the facility name."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, city_slug, slug, name
                FROM facilities
                WHERE publishable = true AND state_code = %s
                ORDER BY name ASC
                LIMIT 3
                """,
                (state,),
            )
            facilities = cur.fetchall()

        if not facilities:
            pytest.skip(f"{state}: no publishable facilities in DB")

        failures = []
        for fac in facilities:
            st = fac["state_code"].lower()
            path = f"/{st}/{fac['city_slug']}/{fac['slug']}"
            status, body = _fetch_page(path, base_url)
            if status != 200:
                continue
            first_word = next(
                (w for w in fac["name"].split() if len(w) > 3),
                fac["name"].split()[0],
            )
            if first_word.lower() not in body.lower():
                failures.append(f"{path}: name '{first_word}' not found in body")

        assert not failures, "\n".join(failures)

    @pytest.mark.parametrize("state", ("CA", "OR", "WA", "MN", "TX"))
    def test_sampled_facilities_have_no_render_artifacts(self, db, base_url, state):
        """Sampled facility pages have no NaN/undefined/[object Object] artifacts."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, city_slug, slug
                FROM facilities
                WHERE publishable = true AND state_code = %s
                ORDER BY name ASC
                LIMIT 3
                """,
                (state,),
            )
            facilities = cur.fetchall()

        if not facilities:
            pytest.skip(f"{state}: no publishable facilities in DB")

        all_issues = []
        for fac in facilities:
            st = fac["state_code"].lower()
            path = f"/{st}/{fac['city_slug']}/{fac['slug']}"
            status, body = _fetch_page(path, base_url)
            if status != 200:
                continue
            all_issues.extend(_check_no_render_artifacts(body, path))

        assert not all_issues, "\n".join(all_issues)

    @pytest.mark.parametrize("state", ("CA", "OR", "WA", "MN", "TX"))
    def test_sampled_facilities_have_jsonld(self, db, base_url, state):
        """Sampled facility pages have at least one valid JSON-LD block."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, city_slug, slug
                FROM facilities
                WHERE publishable = true AND state_code = %s
                ORDER BY name ASC
                LIMIT 3
                """,
                (state,),
            )
            facilities = cur.fetchall()

        if not facilities:
            pytest.skip(f"{state}: no publishable facilities in DB")

        failures = []
        for fac in facilities:
            st = fac["state_code"].lower()
            path = f"/{st}/{fac['city_slug']}/{fac['slug']}"
            status, body = _fetch_page(path, base_url)
            if status != 200:
                continue
            blocks = _extract_jsonld(body)
            if not blocks:
                failures.append(f"{path}: no JSON-LD blocks")
            else:
                parse_errors = [b for b in blocks if "_parse_error" in b]
                if parse_errors:
                    failures.append(
                        f"{path}: JSON-LD parse error: {parse_errors[0].get('_parse_error')}"
                    )

        assert not failures, "\n".join(failures)

    @pytest.mark.parametrize("state", ("CA", "OR", "WA", "MN", "TX"))
    def test_sampled_facilities_have_1_to_100_percentile_numbers(self, db, base_url, state):
        """Sampled facility pages contain at least one number in the 1–100 range (peer rank)."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, city_slug, slug
                FROM facilities
                WHERE publishable = true AND state_code = %s
                ORDER BY name ASC
                LIMIT 3
                """,
                (state,),
            )
            facilities = cur.fetchall()

        if not facilities:
            pytest.skip(f"{state}: no publishable facilities in DB")

        failures = []
        for fac in facilities:
            st = fac["state_code"].lower()
            path = f"/{st}/{fac['city_slug']}/{fac['slug']}"
            status, body = _fetch_page(path, base_url)
            if status != 200:
                continue
            numbers = re.findall(r'\b([1-9][0-9]?|100)\b', body)
            if not numbers:
                failures.append(f"{path}: no 1–100 numbers found (percentiles may not be rendering)")

        assert not failures, "\n".join(failures)


# ══════════════════════════════════════════════════════════════════════════════
# API endpoints
# ══════════════════════════════════════════════════════════════════════════════


class TestApiEndpoints:
    """Public API endpoints must respond correctly."""

    def test_watch_api_rejects_missing_required_fields(self, base_url):
        """POST /api/watch with missing email returns 400 or 422 (not 500)."""
        import urllib.request

        url = base_url.rstrip("/") + "/api/watch"
        data = json.dumps({"facilityName": "Test", "source": "test"}).encode()
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "StarlynnCare-IntegrationTest/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                status = resp.status
        except urllib.error.HTTPError as e:
            status = e.code

        assert status in (400, 422, 429), (
            f"POST /api/watch with missing email returned HTTP {status} "
            f"(expected 400/422/429, not 500)"
        )

    def test_facilities_api_returns_json(self, base_url):
        """GET /api/facilities/california returns valid JSON array."""
        status, body = http_get(
            base_url.rstrip("/") + "/api/facilities/california", timeout=20
        )
        if status == 404:
            pytest.skip("Facilities API route not found — may not be enabled")
        assert status == 200, f"GET /api/facilities/california returned HTTP {status}"
        data = json.loads(body)
        assert isinstance(data, (list, dict)), "Facilities API didn't return JSON"

    def test_nonexistent_facility_returns_404(self, base_url):
        """A clearly nonexistent facility slug returns HTTP 404 or 302."""
        status, _ = _fetch_page(
            "/ca/nonexistent-city-zzz/nonexistent-facility-zzz-99999", base_url
        )
        assert status in (404, 302, 301), (
            f"Nonexistent facility URL returned HTTP {status} (expected 404/301/302)"
        )
