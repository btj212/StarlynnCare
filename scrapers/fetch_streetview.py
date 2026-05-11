#!/usr/bin/env python3
"""
fetch_streetview.py — Populate photo_url for facilities missing images.

Uses the Google Street View Static API with existing lat/lon coordinates.
Falls back to a Google Maps Embed thumbnail if Street View has no imagery.

Usage:
    python3 scrapers/fetch_streetview.py --smoke          # first 5 only
    python3 scrapers/fetch_streetview.py --state CA       # all CA missing photos
    python3 scrapers/fetch_streetview.py --refetch --state CA  # re-fetch all (caution: quota)
    python3 scrapers/fetch_streetview.py --fix-attribution --state CA  # set attribution only, no API
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
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET = "facility-photos"

PHOTO_ATTRIBUTION = "© Google Street View"

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


def upload_to_storage(image_bytes: bytes, storage_path: str) -> str:
    """Upload image bytes to Supabase Storage and return the public URL."""
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{storage_path}"
    req = urllib.request.Request(
        upload_url,
        data=image_bytes,
        method="PUT",
        headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "image/jpeg",
            "x-upsert": "true",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        r.read()
    return f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{storage_path}"


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


def fix_attribution_only(conn: psycopg.Connection, state: str) -> int:
    """
    Set photo_attribution for facilities that already have a Street View photo_url
    but NULL attribution. No API calls — just a direct DB update.
    Returns number of rows updated.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE facilities
            SET photo_attribution = %s
            WHERE state_code = %s
              AND publishable = true
              AND photo_url IS NOT NULL
              AND photo_attribution IS NULL
              AND photo_url LIKE '%%maps.googleapis.com/maps/api/streetview%%'
            """,
            (PHOTO_ATTRIBUTION, state),
        )
        updated = cur.rowcount
    conn.commit()
    return updated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="First 5 only")
    parser.add_argument("--state", default="CA", help="State code (default: CA)")
    parser.add_argument("--refetch", action="store_true", help="Re-fetch even if photo_url is set")
    parser.add_argument(
        "--fix-attribution",
        dest="fix_attribution",
        action="store_true",
        help="Only fix NULL photo_attribution for existing Street View URLs — no API calls",
    )
    parser.add_argument(
        "--city-slugs",
        dest="city_slugs",
        help="Comma-separated city_slug values to filter",
    )
    args = parser.parse_args()

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    # --fix-attribution: purely a DB update, no API needed
    if args.fix_attribution:
        print(f"Fixing NULL photo_attribution for {args.state} Street View photos (no API calls)…")
        with psycopg.connect(DATABASE_URL) as conn:
            updated = fix_attribution_only(conn, args.state)
        print(f"Done. {updated} rows updated with attribution.")
        return

    if not API_KEY:
        print("ERROR: GOOGLE_MAPS_API_KEY not set in .env.local")
        sys.exit(1)
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env.local")
        sys.exit(1)

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            where = [
                "latitude IS NOT NULL",
                "longitude IS NOT NULL",
                "state_code = %s",
                "publishable = true",
            ]
            params: list = [args.state]
            if not args.refetch:
                where.append("photo_url IS NULL")
            if args.city_slugs:
                parts = [p.strip() for p in args.city_slugs.split(",") if p.strip()]
                if parts:
                    where.append("city_slug = ANY(%s)")
                    params.append(parts)
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
                api_url = sv_url(lat, lon)
                try:
                    with urllib.request.urlopen(api_url, timeout=15) as r:
                        image_bytes = r.read()
                    storage_path = f"{fac_id}.jpg"
                    public_url = upload_to_storage(image_bytes, storage_path)
                except Exception as e:
                    print(f"  ✗ Storage upload failed: {e}")
                    fail += 1
                    continue
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE facilities SET photo_url = %s, photo_attribution = %s WHERE id = %s",
                        (public_url, PHOTO_ATTRIBUTION, fac_id),
                    )
                conn.commit()
                print(f"  ✓ Street View image uploaded to Storage")
                ok += 1
            else:
                print(f"  – No Street View imagery found, skipping")
                skip += 1

            # Stay within Google's 50 QPS free-tier limit
            time.sleep(0.05)

    print(f"\nDone. {ok} updated, {skip} skipped (no imagery), {fail} errored.\n")


if __name__ == "__main__":
    main()
