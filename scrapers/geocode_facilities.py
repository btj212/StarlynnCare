#!/usr/bin/env python3
"""
geocode_facilities.py — Geocode facilities using Google Maps Geocoding API.

Fills latitude/longitude for any facility missing coordinates.
Uses the existing GOOGLE_MAPS_API_KEY from .env.local.

Usage:
    python3 scrapers/geocode_facilities.py             # all missing
    python3 scrapers/geocode_facilities.py --smoke     # first 5 only
    python3 scrapers/geocode_facilities.py --state CA  # one state
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.parse
import urllib.request
import json

import psycopg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


def geocode(address: str) -> tuple[float, float] | None:
    params = urllib.parse.urlencode({"address": address, "key": API_KEY})
    url = f"{GEOCODE_URL}?{params}"
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read())
        if data.get("status") != "OK":
            return None
        loc = data["results"][0]["geometry"]["location"]
        return loc["lat"], loc["lng"]
    except Exception as e:
        print(f"    Geocode error: {e}")
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="First 5 only")
    parser.add_argument("--state", help="Filter by state_code (e.g. CA)")
    args = parser.parse_args()

    if not API_KEY:
        print("ERROR: GOOGLE_MAPS_API_KEY not set in .env.local")
        sys.exit(1)
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            where = ["latitude IS NULL", "street IS NOT NULL"]
            params: list = []
            if args.state:
                where.append("state_code = %s")
                params.append(args.state)
            cur.execute(
                f"""
                SELECT id, name, street, city, zip, state_code
                FROM facilities
                WHERE {" AND ".join(where)}
                ORDER BY state_code, name
                """,
                params,
            )
            rows = cur.fetchall()

    if args.smoke:
        rows = rows[:5]

    print(f"Facilities to geocode: {len(rows)}")
    if not rows:
        print("Nothing to do.")
        return

    succeeded = 0
    failed = 0

    with psycopg.connect(DATABASE_URL) as conn:
        for fac_id, name, street, city, zip_code, state in rows:
            address = ", ".join(filter(None, [street, city, zip_code, state, "USA"]))
            print(f"\n→ {name[:50]} | {address[:60]}")

            result = geocode(address)
            if result:
                lat, lng = result
                print(f"  ✓ {lat:.6f}, {lng:.6f}")
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE facilities SET latitude=%s, longitude=%s WHERE id=%s",
                        (str(lat), str(lng), fac_id),
                    )
                conn.commit()
                succeeded += 1
            else:
                print("  ✗ no result")
                failed += 1

            # Stay well within Google's 50 QPS free-tier limit
            time.sleep(0.05)

    print(f"\nDone. {succeeded} geocoded, {failed} failed.")


if __name__ == "__main__":
    main()
