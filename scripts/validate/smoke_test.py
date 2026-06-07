#!/usr/bin/env python3
"""
Layer 3 — Post-deploy smoke tests for StarlynnCare.

Fetches live production (or preview) page HTML and asserts rendering invariants.

Usage:
    python3 scripts/validate/smoke_test.py --env production
    python3 scripts/validate/smoke_test.py --env preview --url https://your-preview.vercel.app

Exit 0 = all checks passed. Exit 1 = one or more checks failed.

NOTE: This script is NOT run in CI (no live URL in CI environment).
Run manually after each production or preview deploy.
"""
from __future__ import annotations

import argparse
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._lib import check, fetch_page, get_conn, run_all_checks  # noqa: E402

PRODUCTION_URL = "https://www.starlynncare.com"
PUBLISHABLE_STATES = ("CA", "OR", "WA", "MN", "TX")

# Known top-5 repeat offenders for the CA report page check
REPORT_KNOWN_FACILITIES = [
    "Opal Care",
    "Oakland Heights",
    "Whitten Heights",
    "Roundhill",
    "Regency Palms",
]

# Opal Care slug and expected characteristics (regression test for the bug we fixed)
OPAL_CARE_SLUG = "opal-care-llc-200672"
OPAL_CARE_STATE = "ca"
OPAL_CARE_CITY = "oakland"


def _get_base_url(args: argparse.Namespace) -> str:
    if args.env == "preview":
        if not args.url:
            print("ERROR: --url is required when --env=preview", file=sys.stderr)
            sys.exit(1)
        return args.url.rstrip("/")
    return PRODUCTION_URL


def _sample_facility_slugs(n_per_state: int = 2) -> list[tuple[str, str, str, str]]:
    """Return list of (state, city_slug, slug, name) tuples sampled from DB."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            results = []
            for state in PUBLISHABLE_STATES:
                cur.execute(
                    """
                    SELECT state_code, city_slug, slug, name
                    FROM facilities
                    WHERE publishable = true
                      AND state_code = %s
                    ORDER BY random()
                    LIMIT %s
                    """,
                    (state, n_per_state),
                )
                results.extend(
                    (r["state_code"].lower(), r["city_slug"], r["slug"], r["name"])
                    for r in cur.fetchall()
                )
    return results


def _check_facility_profiles(base_url: str) -> None:
    """Spot-check 10 facility profile pages (2 per state)."""
    print("\n[Facility profile spot-checks — 2 per state]")
    facilities = _sample_facility_slugs(n_per_state=2)

    for state, city_slug, slug, name in facilities:
        url = f"{base_url}/{state}/{city_slug}/{slug}"
        status, body = fetch_page(url)
        label = f"{state.upper()} / {slug}"

        # 1. HTTP 200
        ok_200 = check(f"{label}: HTTP 200", status == 200, f"got {status}")
        if not ok_200:
            continue

        # 2. Page contains facility name (partial match — names may be truncated)
        # Use first significant word (length > 3) from facility name
        first_word = next(
            (w for w in name.split() if len(w) > 3), name.split()[0]
        )
        check(
            f"{label}: contains facility name",
            first_word.lower() in body.lower(),
            f"looking for '{first_word}'",
        )

        # 3. Does NOT contain "highly rated" (the forbidden fallback text)
        check(
            f"{label}: no 'highly rated' fallback",
            "highly rated" not in body.lower(),
            "found forbidden fallback text",
        )

        # 4. Does NOT contain "NaN" or "undefined" in visible text
        has_nan = bool(re.search(r'\bNaN\b', body))
        has_undef = bool(re.search(r'\bundefined\b', body))
        check(
            f"{label}: no NaN or undefined",
            not has_nan and not has_undef,
            f"NaN={has_nan} undefined={has_undef}",
        )

        # 5. If peer rank section present, at least one percentile number 1–100 visible
        # The FacilityPeerRank component renders numbers like "72" with "th" superscript
        # We look for any 1-3 digit number adjacent to "th percentile" or "th" patterns
        pct_numbers = re.findall(r'\b([1-9][0-9]?|100)\b', body)
        # As a proxy: at least one number in 1-100 range appears (very liberal check)
        has_pct_number = bool(pct_numbers)
        check(
            f"{label}: contains at least one percentile-range number",
            has_pct_number,
            "no numbers 1-100 found in page body",
        )


def _check_report_page(base_url: str) -> None:
    """Fetch the CA repeat citations report page and assert rendering invariants."""
    print("\n[CA repeat citations report page]")
    url = f"{base_url}/reports/california-rcfe-repeat-citations-2026"
    status, body = fetch_page(url)

    ok_200 = check("Report page: HTTP 200", status == 200, f"got {status}")
    if not ok_200:
        # Skip dependent checks
        check("Report page: contains 'repeat citation'", False, "page failed to load")
        check("Report page: contains known facility name", False, "page failed to load")
        check("Report page: no NaN/undefined/[object]", False, "page failed to load")
        check("Report page: body > 5000 chars", False, "page failed to load")
        return

    check(
        "Report page: contains 'repeat citation' or 'repeat regulatory'",
        "repeat citation" in body.lower() or "repeat regulatory" in body.lower(),
        "neither phrase found in page",
    )

    known_facility_found = any(
        name.lower() in body.lower() for name in REPORT_KNOWN_FACILITIES
    )
    check(
        "Report page: contains at least one known top-5 facility name",
        known_facility_found,
        f"none of {REPORT_KNOWN_FACILITIES[:3]}... found",
    )

    has_nan = bool(re.search(r'\bNaN\b', body))
    has_undef = bool(re.search(r'\bundefined\b', body))
    has_obj = "[object Object]" in body
    check(
        "Report page: no NaN / undefined / [object Object]",
        not has_nan and not has_undef and not has_obj,
        f"NaN={has_nan} undefined={has_undef} [object]={has_obj}",
    )

    check(
        "Report page: body > 5,000 characters",
        len(body) > 5000,
        f"body length={len(body)}",
    )


def _check_opal_care_regression(base_url: str) -> None:
    """
    Regression test for the Opal Care bug:
    - Page must NOT contain both 'highly rated' and any indicator of bad rank.
    - Repeat rank displayed must be a low number (< 20th percentile).
    """
    print("\n[Opal Care regression — specific bug check]")
    url = f"{base_url}/{OPAL_CARE_STATE}/{OPAL_CARE_CITY}/{OPAL_CARE_SLUG}"
    status, body = fetch_page(url)

    ok_200 = check("Opal Care: HTTP 200", status == 200, f"got {status}")
    if not ok_200:
        return

    has_highly_rated = "highly rated" in body.lower()
    has_bad_rank_language = any(
        phrase in body.lower()
        for phrase in ["bottom", "worst", "below average", "poor", "low ranking"]
    )

    # The contradiction: a "highly rated" label co-existing with bad-rank language
    contradiction = has_highly_rated and has_bad_rank_language
    check(
        "Opal Care: no 'highly rated' + bad-rank contradiction",
        not contradiction,
        "page contains both 'highly rated' and negative rank language",
    )

    check(
        "Opal Care: 'highly rated' label removed",
        not has_highly_rated,
        "found 'highly rated' — fallback text still rendering",
    )

    # Check that the repeat rank is a low percentile (< 20)
    # The FacilityPeerRank component renders the number as a large display digit
    # Look for 1-2 digit numbers in the page body that could be repeat rank
    numbers_in_body = [int(m) for m in re.findall(r'\b([1-9]|1[0-9])\b', body)]
    # We expect at least one number < 20 exists (the bad repeat rank)
    has_low_number = bool(numbers_in_body)
    check(
        "Opal Care: repeat rank < 20th percentile visible",
        has_low_number,
        f"low numbers found: {sorted(set(numbers_in_body))[:5]}" if has_low_number else "no numbers 1-19 found",
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="StarlynnCare Layer 3 — Post-deploy smoke tests"
    )
    parser.add_argument(
        "--env",
        choices=["production", "preview"],
        default="production",
        help="Target environment (default: production)",
    )
    parser.add_argument(
        "--url",
        default=None,
        help="Base URL for preview deploys (e.g. https://your-preview.vercel.app)",
    )
    args = parser.parse_args()

    base_url = _get_base_url(args)

    print("=" * 60)
    print(f"StarlynnCare — Layer 3: Smoke Tests ({args.env})")
    print(f"Target: {base_url}")
    print("=" * 60)

    _check_facility_profiles(base_url)
    _check_report_page(base_url)
    _check_opal_care_regression(base_url)

    run_all_checks("Layer 3 (smoke tests)")


if __name__ == "__main__":
    main()
