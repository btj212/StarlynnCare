#!/usr/bin/env python3
"""
Production page spot-check without DATABASE_URL.

Fetches state hubs, city/county hubs, facilities browse, and sample facility
profiles across all COVERED_STATES. Use after nightly inspection ingest when
the automation env cannot reach Postgres.

Usage:
  python3 scripts/validate/production_page_spot_check.py
  python3 scripts/validate/production_page_spot_check.py --base-url https://www.starlynncare.com

Exit 0 = all checks passed. Exit 1 = one or more failures.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._lib import check, fetch_page, run_all_checks  # noqa: E402

BASE = "https://www.starlynncare.com"
STATE_SLUGS = {
    "CA": "california",
    "TX": "texas",
    "OR": "oregon",
    "WA": "washington",
    "MN": "minnesota",
    "UT": "utah",
    "IL": "illinois",
    "PA": "pennsylvania",
    "AZ": "arizona",
    "MO": "missouri",
}

# City + county hubs with known publishable facilities
HUB_PAGES = [
    "/minnesota",
    "/minnesota/hennepin-county",
    "/minnesota/minneapolis",
    "/oregon",
    "/oregon/multnomah-county",
    "/oregon/portland",
    "/california",
    "/california/alameda-county",
    "/california/oakland",
    "/washington",
    "/washington/king-county",
    "/washington/seattle",
    "/pennsylvania",
    "/pennsylvania/montgomery-county",
    "/pennsylvania/philadelphia",
    "/utah",
    "/utah/salt-lake-city",
    "/illinois",
    "/illinois/springfield",
    "/illinois/peoria",
    "/texas",
    "/texas/facilities",
    "/arizona",
    "/arizona/maricopa",
    "/arizona/phoenix",
    "/missouri",
    "/missouri/st-louis",
]

FACILITY_FALLBACKS = [
    "/minnesota/minneapolis/presbyterian-homes-of-minnesota-alf-106718",
    "/oregon/portland/footsteps-at-carman-oaks-415600900",
    "/california/oakland/opal-care-llc-200672",
    "/washington/seattle/kline-galland-home-alf-1234",
    "/pennsylvania/philadelphia/rittenhouse-223010",
]


def _api_facility_urls(state_slug: str, limit: int = 2) -> list[str]:
    url = f"{BASE}/api/facilities/{state_slug}"
    req = urllib.request.Request(url, headers={"User-Agent": "StarlynnCare-spotcheck/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception:
        return []
    paths: list[str] = []
    for fac in (data.get("facilities") or [])[:limit]:
        city = fac.get("city_slug")
        slug = fac.get("slug")
        if city and slug:
            paths.append(f"/{state_slug}/{city}/{slug}")
    return paths


def _check_page(base: str, path: str, *, must_contain: list[str] | None = None) -> None:
    url = f"{base}{path}"
    status, body = fetch_page(url, timeout=20)
    label = path
    ok = check(f"{label}: HTTP 200", status == 200, f"got {status}")
    if not ok:
        return
    check(f"{label}: body > 2000 chars", len(body) > 2000, f"len={len(body)}")
    has_nan = bool(re.search(r"\bNaN\b", body))
    has_obj = "[object Object]" in body
    check(f"{label}: no NaN or [object Object]", not has_nan and not has_obj, f"NaN={has_nan}")
    for phrase in must_contain or []:
        check(f"{label}: contains '{phrase}'", phrase.lower() in body.lower(), "missing")


def main() -> int:
    ap = argparse.ArgumentParser(description="Production page spot-check (no DB)")
    ap.add_argument("--base-url", default=BASE)
    args = ap.parse_args()
    base = args.base_url.rstrip("/")

    print("=" * 60)
    print("StarlynnCare — Production page spot-check")
    print(f"  Target: {base}")
    print("=" * 60)

    print("\n[State hubs + facilities browse]")
    for _code, slug in STATE_SLUGS.items():
        _check_page(base, f"/{slug}")
        _check_page(base, f"/{slug}/facilities")

    print("\n[City + county hubs]")
    for path in HUB_PAGES:
        _check_page(base, path)

    print("\n[Facility profiles]")
    facility_paths: list[str] = []
    for slug in STATE_SLUGS.values():
        facility_paths.extend(_api_facility_urls(slug, limit=1))
    if not facility_paths:
        facility_paths = FACILITY_FALLBACKS
    seen: set[str] = set()
    for path in facility_paths + FACILITY_FALLBACKS:
        if path in seen:
            continue
        seen.add(path)
        _check_page(base, path)
        if len(seen) >= 12:
            break

    run_all_checks("Production page spot-check")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
