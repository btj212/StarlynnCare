#!/usr/bin/env python3
"""
fetch_streetview.py — Populate photo_url for facilities missing images.

Uses the Google Street View Static API with existing lat/lon coordinates.
Falls back to a Google Maps Embed thumbnail if Street View has no imagery.

Usage:
    python3 scrapers/fetch_streetview.py --smoke          # first 5 only
    python3 scrapers/fetch_streetview.py --state CA       # all CA missing
    python3 scrapers/fetch_streetview.py --refetch        # re-fetch existing too
    python3 scrapers/fetch_streetview.py --state CA --city-slugs "a,b"  # filter (publishable)
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.parse
import urllib.request

import psycopg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Street View Static API — 640×480 gives a wide exterior shot
SV_URL = "https://maps.googleapis.com/maps/api/streetview"
SV_META_URL = "https://maps.googleapis.com/maps/api/streetview/metadata"


def sv_has_imagery(lat: float, lon: float) -> bool:
    """Return True if Street View has real imagery at this location."""
    params = urllib.parse.urlencode({
        "location": f"{lat},{lon}",
        "radius": "50",
        "source": "outdoor",
        "key": API_KEY,
    })
    try:
        with urllib.request.urlopen(f"{SV_META_URL}?{params}", timeout=8) as r:
            import json
            data = json.loads(r.read())
            return data.get("status") == "OK"
    except Exception as e:
        print(f"    metadata error: {e}")
        return False


def sv_url(lat: float, lon: float) -> str:
    """Build a signed Street View Static URL (unsigned for dev; sign in prod if needed)."""
    params = urllib.parse.urlencode({
        "size": "640x400",
        "location": f"{lat},{lon}",
        "radius": "50",
        "source": "outdoor",
        "fov": "90",
        "pitch": "5",
        "key": API_KEY,
    })
    return f"{SV_URL}?{params}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="First 5 only")
    parser.add_argument("--state", default="CA", help="State code (default: CA)")
    parser.add_argument("--refetch", action="store_true", help="Re-fetch even if photo_url is set")
    parser.add_argument(
        "--city-slugs",
        dest="city_slugs",
        help="Comma-separated city_slug values to filter",
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
            where = ["latitude IS NOT NULL", "longitude IS NOT NULL", "state_code = %s"]
            params: list = [args.state]
            if not args.refetch:
                where.append("photo_url IS NULL")
            if args.city_slugs:
                parts = [p.strip() for p in args.city_slugs.split(",") if p.strip()]
                if parts:
                    where.append("city_slug = ANY(%s)")
                    params.append(parts)
                    where.append("publishable = true")
            cur.execute(
                f"""
                SELECT id, name, latitude, longitude
                FROM facilities
                WHERE {" AND ".join(where)}
                ORDER BY name
                """,
                params,
            )
            rows = cur.fetchall()

    if args.smoke:
        rows = rows[:5]

    print(f"Facilities to process: {len(rows)}")
    if not rows:
        print("Nothing to do.")
        return

    ok = skip = fail = 0

    with psycopg.connect(DATABASE_URL) as conn:
        for fac_id, name, lat_str, lon_str in rows:
            try:
                lat, lon = float(lat_str), float(lon_str)
            except (TypeError, ValueError):
                print(f"  ✗ {name[:50]} — bad coordinates, skipping")
                fail += 1
                continue

            print(f"\n→ {name[:60]}")

            if sv_has_imagery(lat, lon):
                url = sv_url(lat, lon)
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE facilities SET photo_url = %s WHERE id = %s",
                        (url, fac_id),
                    )
                conn.commit()
                print(f"  ✓ Street View image set")
                ok += 1
            else:
                print(f"  – No Street View imagery found, skipping")
                skip += 1

            # Stay within Google's 50 QPS free-tier limit
            time.sleep(0.05)

    print(f"\nDone. {ok} updated, {skip} skipped (no imagery), {fail} errored.\n")


if __name__ == "__main__":
    main()
