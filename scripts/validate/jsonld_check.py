#!/usr/bin/env python3
"""
JSON-LD validation — facility + hub structured data and YMYL aggregateRating rule.

Usage:
    python3 scripts/validate/jsonld_check.py --env production
    python3 scripts/validate/jsonld_check.py --env preview --url https://your-preview.vercel.app

Exit 0 = all checks passed. Exit 1 = one or more checks failed.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._html_parse import (  # noqa: E402
    extract_jsonld_blocks,
    find_nodes_by_type,
    has_type,
    iter_schema_nodes,
)
from validate._lib import check, fetch_page, get_conn, run_all_checks  # noqa: E402

PRODUCTION_URL = "https://www.starlynncare.com"
STATE_SLUG = {
    "CA": "california",
    "OR": "oregon",
    "WA": "washington",
    "MN": "minnesota",
    "TX": "texas",
}


def _state_path(state_code: str) -> str:
    return STATE_SLUG[state_code.upper()]


PUBLISHABLE_STATES = ("CA", "OR", "WA", "MN", "TX")
MIN_FACILITIES = 10
MIN_HUBS = 10
MIN_STATES = 3


def _get_base_url(args: argparse.Namespace) -> str:
    if args.env == "preview":
        if not args.url:
            print("ERROR: --url is required when --env=preview", file=sys.stderr)
            sys.exit(1)
        return args.url.rstrip("/")
    return PRODUCTION_URL


def _sample_facilities(n_per_state: int = 3) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows: list[dict] = []
            for state in PUBLISHABLE_STATES:
                cur.execute(
                    """
                    SELECT f.state_code, f.city_slug, f.slug, f.name,
                           (SELECT COUNT(*)::int FROM reviews r
                            WHERE r.facility_id = f.id AND r.status = 'published') AS review_count
                    FROM facilities f
                    WHERE f.publishable = true AND f.state_code = %s
                    ORDER BY random()
                    LIMIT %s
                    """,
                    (state, n_per_state),
                )
                rows.extend(cur.fetchall())
    return rows


def _sample_hubs(n: int = 12) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (f.state_code, f.city_slug)
                       f.state_code, f.city_slug, f.city
                FROM facilities f
                WHERE f.publishable = true
                  AND f.state_code = ANY(%s)
                ORDER BY f.state_code, f.city_slug, random()
                LIMIT %s
                """,
                (list(PUBLISHABLE_STATES), n),
            )
            cities = cur.fetchall()
            counties = [
                {"state_code": "CA", "county_slug": "alameda-county"},
                {"state_code": "CA", "county_slug": "san-diego-county"},
                {"state_code": "TX", "county_slug": "harris-county"},
                {"state_code": "WA", "county_slug": "king-county"},
            ]
    return {"cities": cities, "counties": counties}


def _check_facility_jsonld(base_url: str, row: dict) -> None:
    state = _state_path(row["state_code"])
    city = row["city_slug"]
    slug = row["slug"]
    review_count = int(row["review_count"] or 0)
    label = f"facility {state.upper()}/{city}/{slug}"
    url = f"{base_url}/{state}/{city}/{slug}"

    status, body = fetch_page(url)
    if not check(f"{label}: HTTP 200", status == 200, f"got {status}"):
        return

    blocks = extract_jsonld_blocks(body)
    check(f"{label}: has JSON-LD blocks", len(blocks) > 0, "none found")

    parse_errors = [
        n for b in blocks for n in iter_schema_nodes(b) if n.get("__parse_error__")
    ]
    check(f"{label}: JSON-LD parses", len(parse_errors) == 0, f"{len(parse_errors)} bad blocks")

    lb_nodes = find_nodes_by_type(blocks, "LocalBusiness")
    mo_nodes = find_nodes_by_type(blocks, "MedicalOrganization")
    bc_nodes = find_nodes_by_type(blocks, "BreadcrumbList")

    # LocalBusiness + MedicalOrganization may be combined in one node (@type array)
    combined = [n for n in lb_nodes if has_type(n, "MedicalOrganization")]
    check(
        f"{label}: LocalBusiness + MedicalOrganization",
        len(combined) > 0 or (len(lb_nodes) > 0 and len(mo_nodes) > 0),
        f"lb={len(lb_nodes)} mo={len(mo_nodes)} combined={len(combined)}",
    )
    check(f"{label}: BreadcrumbList", len(bc_nodes) > 0, "missing")

    rating_nodes = find_nodes_by_type(blocks, "AggregateRating")
    if review_count == 0:
        check(
            f"{label}: no aggregateRating (0 reviews)",
            len(rating_nodes) == 0,
            f"found {len(rating_nodes)} AggregateRating node(s) without published reviews",
        )
    else:
        check(
            f"{label}: aggregateRating present ({review_count} reviews)",
            len(rating_nodes) > 0,
            "expected AggregateRating from published reviews",
        )
        if rating_nodes:
            rc = rating_nodes[0].get("ratingCount")
            check(
                f"{label}: ratingCount matches DB",
                rc == review_count,
                f"schema ratingCount={rc} db={review_count}",
            )


def _check_hub_jsonld(base_url: str, path: str, label: str) -> None:
    url = f"{base_url}{path}"
    status, body = fetch_page(url)
    if not check(f"{label}: HTTP 200", status == 200, f"got {status}"):
        return

    blocks = extract_jsonld_blocks(body)
    check(f"{label}: has JSON-LD", len(blocks) > 0, "none found")

    parse_errors = [
        n for b in blocks for n in iter_schema_nodes(b) if n.get("__parse_error__")
    ]
    check(f"{label}: JSON-LD parses", len(parse_errors) == 0, f"{len(parse_errors)} bad")

    check(
        f"{label}: CollectionPage",
        len(find_nodes_by_type(blocks, "CollectionPage")) > 0,
        "missing",
    )
    check(
        f"{label}: ItemList",
        len(find_nodes_by_type(blocks, "ItemList")) > 0,
        "missing",
    )
    check(
        f"{label}: BreadcrumbList",
        len(find_nodes_by_type(blocks, "BreadcrumbList")) > 0,
        "missing",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="StarlynnCare JSON-LD validation")
    parser.add_argument("--env", choices=["production", "preview"], default="production")
    parser.add_argument("--url", default=None, help="Preview base URL")
    args = parser.parse_args()
    base_url = _get_base_url(args)

    print("=" * 60)
    print(f"StarlynnCare — JSON-LD validation ({args.env})")
    print(f"Target: {base_url}")
    print("=" * 60)

    print("\n[Homepage]")
    status, body = fetch_page(base_url + "/")
    check("homepage: HTTP 200", status == 200, f"got {status}")
    if status == 200:
        blocks = extract_jsonld_blocks(body)
        check("homepage: has JSON-LD", len(blocks) > 0, "none found")

    print("\n[Facility profiles]")
    facilities = _sample_facilities(n_per_state=3)
    states_seen = {r["state_code"] for r in facilities}
    check(
        f"sample size ≥ {MIN_FACILITIES} facilities",
        len(facilities) >= MIN_FACILITIES,
        f"got {len(facilities)}",
    )
    check(
        f"sample spans ≥ {MIN_STATES} states",
        len(states_seen) >= MIN_STATES,
        f"got {sorted(states_seen)}",
    )
    for row in facilities:
        _check_facility_jsonld(base_url, row)

    print("\n[Hub pages — state]")
    for state in PUBLISHABLE_STATES:
        slug = {"CA": "california", "OR": "oregon", "WA": "washington", "MN": "minnesota", "TX": "texas"}[
            state
        ]
        _check_hub_jsonld(base_url, f"/{slug}", f"state hub /{slug}")

    print("\n[Hub pages — city + county sample]")
    hubs = _sample_hubs(n=12)
    hub_count = 0
    for row in hubs["cities"]:
        state = _state_path(row["state_code"])
        city = row["city_slug"]
        _check_hub_jsonld(base_url, f"/{state}/{city}", f"city hub /{state}/{city}")
        hub_count += 1
    for row in hubs["counties"]:
        state = _state_path(row["state_code"])
        county = row["county_slug"]
        _check_hub_jsonld(
            base_url, f"/{state}/{county}", f"county hub /{state}/{county}"
        )
        hub_count += 1
    check(f"hub sample ≥ {MIN_HUBS}", hub_count >= MIN_HUBS, f"got {hub_count}")

    run_all_checks("JSON-LD validation")


if __name__ == "__main__":
    main()
