#!/usr/bin/env python3
"""
Internal linking validation — facility → parent hub and hub → facility reciprocity.

Usage:
    python3 scripts/validate/internal_links_check.py --env production
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._html_parse import count_href_matches  # noqa: E402
from validate._lib import check, fetch_page, get_conn, run_all_checks  # noqa: E402

PRODUCTION_URL = "https://starlynn.care"
PUBLISHABLE_STATES = ("CA", "OR", "WA", "MN", "TX")
STATE_SLUG = {
    "CA": "california",
    "OR": "oregon",
    "WA": "washington",
    "MN": "minnesota",
    "TX": "texas",
}


def _get_base_url(args: argparse.Namespace) -> str:
    if args.env == "preview":
        if not args.url:
            print("ERROR: --url is required when --env=preview", file=sys.stderr)
            sys.exit(1)
        return args.url.rstrip("/")
    return PRODUCTION_URL


def _sample_facilities(n_per_state: int = 4) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows: list[dict] = []
            for state in PUBLISHABLE_STATES:
                cur.execute(
                    """
                    SELECT f.state_code, f.city_slug, f.slug, f.name, f.city
                    FROM facilities f
                    WHERE f.publishable = true AND f.state_code = %s
                    ORDER BY random()
                    LIMIT %s
                    """,
                    (state, n_per_state),
                )
                rows.extend(cur.fetchall())
    return rows


def _sample_city_hubs(n: int = 10) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (f.state_code, f.city_slug)
                       f.state_code, f.city_slug,
                       (SELECT slug FROM facilities f2
                        WHERE f2.publishable = true
                          AND f2.state_code = f.state_code
                          AND f2.city_slug = f.city_slug
                        ORDER BY random()
                        LIMIT 1) AS sample_facility_slug
                FROM facilities f
                WHERE f.publishable = true
                  AND f.state_code = ANY(%s)
                ORDER BY f.state_code, f.city_slug, random()
                LIMIT %s
                """,
                (list(PUBLISHABLE_STATES), n),
            )
            return cur.fetchall()


def _check_facility_parent_links(base_url: str, row: dict) -> None:
    state_slug = STATE_SLUG[row["state_code"]]
    city_slug = row["city_slug"]
    slug = row["slug"]
    label = f"{state_slug}/{city_slug}/{slug}"
    url = f"{base_url}/{state_slug}/{city_slug}/{slug}"
    parent_path = f"/{state_slug}/{city_slug}"

    status, body = fetch_page(url)
    if not check(f"facility {label}: HTTP 200", status == 200, f"got {status}"):
        return

    parent_count = count_href_matches(body, parent_path)
    check(
        f"facility {label}: exactly one parent-city link",
        parent_count == 1,
        f"href={parent_path} count={parent_count}",
    )

    # County link when copy suggests county hub exists (optional — not all facilities have county)
    has_county_copy = "county-wide hub" in body.lower() or "Browse " in body and "county" in body.lower()
    if has_county_copy:
        county_links = re.findall(
            rf'href="/{re.escape(state_slug)}/[^"]+-county"',
            body,
        )
        check(
            f"facility {label}: county hub link when county block present",
            len(county_links) >= 1,
            "county block visible but no county href",
        )


def _check_hub_facility_links(base_url: str, row: dict) -> None:
    state_slug = STATE_SLUG[row["state_code"]]
    city_slug = row["city_slug"]
    fac_slug = row["sample_facility_slug"]
    if not fac_slug:
        return
    label = f"city hub /{state_slug}/{city_slug}"
    url = f"{base_url}/{state_slug}/{city_slug}"
    fac_path = f"/{state_slug}/{city_slug}/{fac_slug}"

    status, body = fetch_page(url)
    if not check(f"{label}: HTTP 200", status == 200, f"got {status}"):
        return

    check(
        f"{label}: links down to sample facility",
        count_href_matches(body, fac_path) >= 1,
        f"missing {fac_path}",
    )

    # ItemList / facility grid: at least one facility profile link
    facility_link_pattern = re.compile(
        rf'href="/{re.escape(state_slug)}/{re.escape(city_slug)}/[^"]+"'
    )
    facility_links = facility_link_pattern.findall(body)
    check(
        f"{label}: has facility profile links",
        len(facility_links) >= 1,
        f"found {len(facility_links)}",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="StarlynnCare internal link validation")
    parser.add_argument("--env", choices=["production", "preview"], default="production")
    parser.add_argument("--url", default=None)
    args = parser.parse_args()
    base_url = _get_base_url(args)

    print("=" * 60)
    print(f"StarlynnCare — Internal link validation ({args.env})")
    print(f"Target: {base_url}")
    print("=" * 60)

    print("\n[C4 — nearby cities adjacency]")
    print("  STOP NOTE: no deterministic city-adjacency list in repo (regions.ts has")
    print("  county membership only). Skipping nearby-cities cross-link task.")

    print("\n[Facility → parent city/county]")
    facilities = _sample_facilities(n_per_state=4)
    for row in facilities:
        _check_facility_parent_links(base_url, row)

    print("\n[Hub → facility reciprocal]")
    hubs = _sample_city_hubs(n=10)
    for row in hubs:
        _check_hub_facility_links(base_url, row)

    run_all_checks("Internal link validation")


if __name__ == "__main__":
    main()
