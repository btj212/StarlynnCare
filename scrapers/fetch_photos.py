#!/usr/bin/env python3
"""
fetch_photos.py — Fetch Google Street View exterior photos for publishable
Alameda County facilities and store them in Supabase Storage.

Usage:
    python fetch_photos.py             # fetch all facilities missing a photo
    python fetch_photos.py --smoke     # fetch exactly one facility, then stop
    python fetch_photos.py --dry-run   # log what would be fetched, no writes
    python fetch_photos.py --refetch   # re-fetch even facilities that already have a photo

Reads from .env.local:
    GOOGLE_MAPS_API_KEY         — Google Maps Platform (Street View Static API)
    NEXT_PUBLIC_SUPABASE_URL    — e.g. https://xyzxyz.supabase.co
    SUPABASE_SERVICE_ROLE_KEY   — service role key (bypasses RLS for storage writes)
    DATABASE_URL                — Postgres connection URI

Cost: ~$0.007 per successful fetch × 14 facilities ≈ $0.10 one-time.
Metadata probe is free; skipped locations with no Street View coverage cost $0.

Google Maps Static API terms require the attribution "© Google Street View"
to appear whenever the image is displayed; this is stored in photo_attribution.
"""

import argparse
import os
import sys
import time
import urllib.parse

import psycopg
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

GOOGLE_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

BUCKET = "facility-photos"
PHOTO_SIZE = "800x500"
ATTRIBUTION = "© Google Street View"

METADATA_URL = "https://maps.googleapis.com/maps/api/streetview/metadata"
STATIC_URL = "https://maps.googleapis.com/maps/api/streetview"

# ---------------------------------------------------------------------------
# Supabase storage helpers (pure requests — no Python SDK required)
# ---------------------------------------------------------------------------


def ensure_bucket() -> bool:
    """Create the storage bucket if it doesn't exist. Returns True on success."""
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    # Check if bucket already exists
    r = requests.get(
        f"{SUPABASE_URL}/storage/v1/bucket/{BUCKET}",
        headers=headers,
        timeout=10,
    )
    if r.status_code == 200:
        return True
    # Supabase returns 400 or 404 for non-existent bucket — try to create it either way
    r2 = requests.post(
        f"{SUPABASE_URL}/storage/v1/bucket",
        headers=headers,
        json={"id": BUCKET, "name": BUCKET, "public": True},
        timeout=10,
    )
    if r2.status_code in (200, 201):
        print(f"  ✓ Created storage bucket '{BUCKET}'")
        return True
    # If creation fails with "already exists", that's fine
    body = r2.json() if r2.headers.get("Content-Type", "").startswith("application/json") else {}
    if "already exists" in str(body).lower() or r2.status_code == 409:
        return True
    print(f"  ✗ Could not create bucket: {r2.status_code} {r2.text}")
    return False


def upload_jpeg(facility_id: str, jpeg_bytes: bytes) -> str | None:
    """Upload JPEG to Supabase Storage, return public URL or None on error."""
    key = f"{facility_id}.jpg"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{key}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "image/jpeg",
        # Overwrite if already exists
        "x-upsert": "true",
    }
    r = requests.post(url, headers=headers, data=jpeg_bytes, timeout=30)
    if r.status_code in (200, 201):
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{key}"
    print(f"    ✗ Upload failed: {r.status_code} {r.text[:200]}")
    return None


# ---------------------------------------------------------------------------
# Street View helpers
# ---------------------------------------------------------------------------


def build_location(street: str, city: str, state: str = "CA") -> str:
    return urllib.parse.quote(f"{street}, {city}, {state}")


def check_coverage(location_encoded: str) -> bool:
    """Return True if Google has Street View coverage for this address."""
    r = requests.get(
        METADATA_URL,
        params={"location": urllib.parse.unquote(location_encoded), "key": GOOGLE_KEY},
        timeout=10,
    )
    if r.status_code != 200:
        return False
    data = r.json()
    return data.get("status") == "OK"


def fetch_street_view(location_encoded: str) -> bytes | None:
    """Fetch the Street View JPEG. Returns raw bytes or None on error."""
    r = requests.get(
        STATIC_URL,
        params={
            "size": PHOTO_SIZE,
            "location": urllib.parse.unquote(location_encoded),
            "key": GOOGLE_KEY,
            "return_error_code": "true",
        },
        timeout=20,
    )
    if r.status_code == 200 and r.headers.get("Content-Type", "").startswith(
        "image/"
    ):
        return r.content
    print(f"    ✗ Street View fetch failed: {r.status_code}")
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Google Street View photos")
    parser.add_argument(
        "--smoke",
        action="store_true",
        help="Fetch exactly one facility then stop",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log actions without fetching or writing",
    )
    parser.add_argument(
        "--refetch",
        action="store_true",
        help="Re-fetch even facilities that already have a photo_url",
    )
    args = parser.parse_args()

    # Validate env
    missing = [k for k in ("GOOGLE_MAPS_API_KEY", "NEXT_PUBLIC_SUPABASE_URL",
                            "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL")
               if not os.environ.get(k)]
    if missing and not args.dry_run:
        print(f"ERROR: Missing environment variables: {', '.join(missing)}")
        print("Set them in .env.local (see .env.local.example)")
        sys.exit(1)

    if not args.dry_run:
        if not ensure_bucket():
            sys.exit(1)

    # Load facilities
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            where_photo = "" if args.refetch else "AND photo_url IS NULL"
            cur.execute(f"""
                SELECT id, name, street, city, zip, state_code
                FROM facilities
                WHERE publishable = true
                  AND state_code = 'CA'
                  AND street IS NOT NULL
                  {where_photo}
                ORDER BY name
            """)
            facilities = cur.fetchall()

    print(f"Facilities to process: {len(facilities)}")
    if not facilities:
        print("Nothing to do.")
        return

    processed = 0
    fetched = 0
    skipped = 0

    with psycopg.connect(DATABASE_URL) as conn:
        for fac_id, name, street, city, _zip, state_code in facilities:
            print(f"\n→ {name} ({city})")
            location = build_location(street, city, state_code or "CA")

            if args.dry_run:
                print(f"  [dry-run] Would probe: {street}, {city}")
                processed += 1
                if args.smoke:
                    break
                continue

            # Probe coverage first (free API call)
            has_coverage = check_coverage(location)
            if not has_coverage:
                print("  — No Street View coverage at this address, skipping")
                skipped += 1
                processed += 1
                if args.smoke:
                    break
                time.sleep(0.2)
                continue

            # Fetch image
            jpeg = fetch_street_view(location)
            if not jpeg:
                skipped += 1
                processed += 1
                if args.smoke:
                    break
                time.sleep(0.2)
                continue

            # Upload to Supabase Storage
            public_url = upload_jpeg(str(fac_id), jpeg)
            if not public_url:
                skipped += 1
                processed += 1
                if args.smoke:
                    break
                time.sleep(0.2)
                continue

            # Write URL back to DB
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE facilities
                    SET photo_url = %s, photo_attribution = %s
                    WHERE id = %s
                    """,
                    (public_url, ATTRIBUTION, fac_id),
                )
                conn.commit()

            print(f"  ✓ Photo saved → {public_url}")
            fetched += 1
            processed += 1

            if args.smoke:
                print("\n[smoke] Stopping after first successful fetch.")
                break

            time.sleep(0.3)  # be polite to the API

    print(f"\nDone. {fetched} fetched, {skipped} skipped, {processed} processed.")


if __name__ == "__main__":
    main()
