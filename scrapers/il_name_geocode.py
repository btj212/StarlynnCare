#!/usr/bin/env python3
"""
il_name_geocode.py — Geocode Illinois facilities that lack street addresses.

Uses Google Maps Geocoding API with the facility name + "IL" as the query to
resolve name → (street, city, zip, lat, lng) in one pass.

Only updates if the API returns a precise enough result (street_number + route
present in address_components).  City-only or ambiguous results are skipped and
logged.

Usage:
    python3 scrapers/il_name_geocode.py              # all IL facilities missing street
    python3 scrapers/il_name_geocode.py --smoke      # first 10 only (dry-run preview)
    python3 scrapers/il_name_geocode.py --dry-run    # resolve but do not write to DB
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from typing import Optional

import psycopg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


def _component(comps: list[dict], *types: str) -> str:
    for t in types:
        for c in comps:
            if t in c.get("types", []):
                return c["long_name"]
    return ""


def geocode_by_name(
    name: str, state: str = "IL"
) -> Optional[tuple[str, str, str, float, float]]:
    """Return (street, city, zip, lat, lng) or None if result is too coarse."""
    query = f"{name}, {state}, USA"
    params = urllib.parse.urlencode({"address": query, "key": API_KEY})
    url = f"{GEOCODE_URL}?{params}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        print(f"    network error: {exc}")
        return None

    if data.get("status") != "OK" or not data.get("results"):
        return None

    result = data["results"][0]
    comps = result.get("address_components", [])
    loc = result["geometry"]["location"]

    street_number = _component(comps, "street_number")
    route = _component(comps, "route")
    city = _component(comps, "locality", "sublocality", "neighborhood")
    postal_code = _component(comps, "postal_code")

    if not (street_number and route):
        return None  # not precise enough

    street = f"{street_number} {route}".strip()
    return street, city, postal_code, loc["lat"], loc["lng"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--smoke", action="store_true", help="Process first 10 facilities only"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Resolve addresses but do not write to DB",
    )
    args = parser.parse_args()

    if not API_KEY:
        print("ERROR: GOOGLE_MAPS_API_KEY not set in .env.local")
        sys.exit(1)
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name
                FROM facilities
                WHERE state_code = 'IL'
                  AND street IS NULL
                ORDER BY name
                """
            )
            rows = cur.fetchall()

    if args.smoke:
        rows = rows[:10]

    print(f"IL facilities without street: {len(rows)}")
    if not rows:
        print("Nothing to do.")
        return

    succeeded = 0
    skipped = 0

    with psycopg.connect(DATABASE_URL) as conn:
        for fac_id, name in rows:
            print(f"\n→ {name[:70]}")
            result = geocode_by_name(name)
            if result:
                street, city, zipcode, lat, lng = result
                print(f"  ✓ {street}, {city} {zipcode}  [{lat:.5f}, {lng:.5f}]")
                if not args.dry_run:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            UPDATE facilities
                            SET street = %s,
                                city   = %s,
                                zip    = %s,
                                latitude  = %s,
                                longitude = %s
                            WHERE id = %s
                            """,
                            (street, city, zipcode, str(lat), str(lng), fac_id),
                        )
                    conn.commit()
                    succeeded += 1
                else:
                    succeeded += 1
            else:
                print("  – skipped (no street-level result)")
                skipped += 1

            time.sleep(0.06)  # ~15 QPS, well under 50 QPS free-tier limit

    label = " (dry-run)" if args.dry_run else ""
    print(f"\nDone{label}. {succeeded} geocoded, {skipped} skipped.")


if __name__ == "__main__":
    main()
