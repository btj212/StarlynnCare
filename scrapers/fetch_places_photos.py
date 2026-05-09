#!/usr/bin/env python3
"""
fetch_places_photos.py — Populate the photo_urls gallery with Google Places photos.

Uses Google Places API (New) to find each facility by name + address, then fetches
up to 4 photo URIs to fill gallery slots 1-4 (slot 0 is kept from Street View).

Attribution requirement: Google Places API Terms require displaying the attribution
string (photo.html_attributions or the photo.author_attributions list) wherever
the photo is shown. This script stores attribution in photo_sources jsonb alongside
each URL so the UI can surface it.

Usage:
    python3 scrapers/fetch_places_photos.py --smoke          # first 5 only
    python3 scrapers/fetch_places_photos.py --state CA       # all CA facilities
    python3 scrapers/fetch_places_photos.py --refetch        # overwrite existing entries
    python3 scrapers/fetch_places_photos.py --state CA --max-photos 3  # 3 per facility

Requires:
    GOOGLE_MAPS_API_KEY in .env.local  (Places API must be enabled on the key)
    DATABASE_URL in .env.local
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from typing import Any

import psycopg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Google Places API (New) endpoints
PLACES_TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText"
PLACES_PHOTO_URL = "https://places.googleapis.com/v1/{name}/media"

# Max photos to fetch per facility (plus the existing Street View as index 0)
DEFAULT_MAX_PHOTOS = 4


def find_place(name: str, address: str, city: str, state: str) -> str | None:
    """Search Google Places for a facility. Returns the Places resource name (ID)."""
    query = f"{name}, {address}, {city}, {state}"
    payload = json.dumps({
        "textQuery": query,
        "maxResultCount": 1,
        "locationBias": {},
    }).encode()
    req = urllib.request.Request(
        PLACES_TEXT_SEARCH,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": "places.id,places.name,places.photos",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
            places = data.get("places", [])
            if not places:
                return None
            return places[0].get("name")  # resource name like "places/ChIJ..."
    except Exception as e:
        print(f"    Places search error: {e}")
        return None


def get_place_photos(place_name: str, max_photos: int) -> list[dict[str, str]]:
    """Fetch photo metadata for a place. Returns list of {url, attribution} dicts."""
    # Re-fetch the place with the photos field mask
    place_id = place_name.split("/")[-1] if "/" in place_name else place_name
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": "photos",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
            photos: list[dict[str, Any]] = data.get("photos", [])
    except Exception as e:
        print(f"    Places detail error: {e}")
        return []

    results = []
    for photo in photos[:max_photos]:
        photo_name = photo.get("name", "")
        if not photo_name:
            continue
        # Build the media URI — use maxHeightPx to get a usable image
        photo_url = (
            f"https://places.googleapis.com/v1/{photo_name}/media"
            f"?maxHeightPx=800&key={API_KEY}&skipHttpRedirect=false"
        )
        # Attribution: collect display name attributions
        attr_parts = []
        for auth in photo.get("authorAttributions", []):
            display = auth.get("displayName", "")
            if display:
                attr_parts.append(display)
        attribution = ", ".join(attr_parts) if attr_parts else "Google Places"
        results.append({"url": photo_url, "source": "Google Places", "attribution": attribution})

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Google Places photos for facility gallery")
    parser.add_argument("--smoke", action="store_true", help="First 5 only")
    parser.add_argument("--state", default="CA", help="State code filter (default: CA)")
    parser.add_argument("--refetch", action="store_true", help="Re-fetch even if photos already exist")
    parser.add_argument(
        "--max-photos", dest="max_photos", type=int, default=DEFAULT_MAX_PHOTOS,
        help=f"Max Places photos per facility (default: {DEFAULT_MAX_PHOTOS})",
    )
    parser.add_argument(
        "--city-slugs", dest="city_slugs",
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
            where = ["publishable = true", "state_code = %s", "latitude IS NOT NULL"]
            params: list = [args.state.upper()]

            if not args.refetch:
                # Only target facilities whose gallery has ≤1 photo (just Street View)
                where.append("(photo_urls IS NULL OR array_length(photo_urls, 1) <= 1)")

            if args.city_slugs:
                parts = [p.strip() for p in args.city_slugs.split(",") if p.strip()]
                if parts:
                    where.append("city_slug = ANY(%s)")
                    params.append(parts)

            cur.execute(
                f"""
                SELECT id, name, address, city, state_code, photo_urls, photo_sources
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
        for fac_id, name, address, city, state_code, existing_urls, existing_sources in rows:
            print(f"\n→ {name[:60]}")

            # Keep existing Street View photo at index 0
            base_urls: list[str] = list(existing_urls or [])
            base_sources: list[dict] = list(existing_sources or [])
            if not base_urls and address:
                # No Street View yet either — skip (fetch_streetview.py should run first)
                print("  – No Street View base photo, run fetch_streetview.py first")
                skip += 1
                continue

            # Find the facility in Places
            place_name = find_place(name, address or "", city or "", state_code)
            time.sleep(0.1)  # rate limit
            if not place_name:
                print("  – Not found in Google Places")
                skip += 1
                continue

            # Fetch up to max_photos additional images
            photos = get_place_photos(place_name, args.max_photos)
            time.sleep(0.1)

            if not photos:
                print("  – No Places photos available")
                skip += 1
                continue

            # Merge: keep index 0 (Street View), append new Places photos
            sv_entry = base_sources[0] if base_sources else {
                "url": base_urls[0], "source": "Google Street View", "attribution": "© Google"
            }
            new_urls = base_urls[:1] + [p["url"] for p in photos]
            new_sources = [sv_entry] + photos

            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE facilities SET photo_urls = %s, photo_sources = %s WHERE id = %s",
                    (new_urls, json.dumps(new_sources), fac_id),
                )
            conn.commit()

            print(f"  ✓ {len(photos)} Places photos added (total gallery: {len(new_urls)})")
            ok += 1

    print(f"\nDone. {ok} updated, {skip} skipped, {fail} errored.\n")


if __name__ == "__main__":
    main()
