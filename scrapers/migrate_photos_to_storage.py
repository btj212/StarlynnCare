#!/usr/bin/env python3
"""
migrate_photos_to_storage.py — Backfill 1,522 facilities whose photo_url still
embeds a Google Street View Static API key.

For each matching facility:
  1. Download image bytes from the embedded-key URL (server-side — fine).
  2. Upload to Supabase Storage at {facility_id}.jpg.
  3. Update photo_url and photo_urls[1] with the key-free Supabase public URL.

Usage:
    python3 scrapers/migrate_photos_to_storage.py --smoke         # 5 rows only
    python3 scrapers/migrate_photos_to_storage.py --state CA      # one state
    python3 scrapers/migrate_photos_to_storage.py --state CA --limit 100
    python3 scrapers/migrate_photos_to_storage.py                 # everything
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.error
import urllib.request

import psycopg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

DATABASE_URL = os.environ.get("DATABASE_URL", "")
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET = "facility-photos"


def upload_to_storage(image_bytes: bytes, storage_path: str) -> str:
    """Upload image bytes to Supabase Storage. Returns the public URL."""
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


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migrate Google Street View API-key URLs to Supabase Storage"
    )
    parser.add_argument("--smoke", action="store_true", help="Process first 5 rows only")
    parser.add_argument("--state", help="Filter to a single state code (e.g. CA)")
    parser.add_argument("--limit", type=int, help="Max rows to process")
    args = parser.parse_args()

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env.local")
        sys.exit(1)

    # --- Fetch candidates ---
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            where = ["photo_url ILIKE '%maps.googleapis.com%'"]
            params: list = []
            if args.state:
                where.append("state_code = %s")
                params.append(args.state.upper())
            cur.execute(
                f"""
                SELECT id, name, state_code, photo_url, photo_urls
                FROM facilities
                WHERE {" AND ".join(where)}
                ORDER BY state_code, name
                """,
                params,
            )
            rows = cur.fetchall()

    if args.smoke:
        rows = rows[:5]
    elif args.limit:
        rows = rows[: args.limit]

    total = len(rows)
    print(f"Facilities to migrate: {total}")
    if not total:
        print("Nothing to do.")
        return

    ok = not_found = fail = 0

    with psycopg.connect(DATABASE_URL) as conn:
        for idx, (fac_id, name, state_code, photo_url, photo_urls) in enumerate(rows, start=1):
            if idx % 50 == 1:
                print(f"\n[{idx}/{total}] Processing…")

            print(f"  → [{state_code}] {name[:55]}")

            # --- Download from Google (key is already embedded in URL) ---
            try:
                with urllib.request.urlopen(photo_url, timeout=15) as r:
                    status = r.status
                    image_bytes = r.read()
                if status == 404 or len(image_bytes) < 1000:
                    raise urllib.error.HTTPError(photo_url, 404, "Not Found", {}, None)  # type: ignore[arg-type]
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    print(f"    ✗ 404 — nulling photo_url")
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            UPDATE facilities
                            SET photo_url = NULL,
                                photo_urls = CASE
                                    WHEN photo_urls IS NULL THEN NULL
                                    ELSE (
                                        SELECT array_agg(u)
                                        FROM unnest(photo_urls) AS u
                                        WHERE u NOT ILIKE '%%maps.googleapis.com%%'
                                    )
                                END
                            WHERE id = %s
                            """,
                            (fac_id,),
                        )
                    conn.commit()
                    not_found += 1
                    time.sleep(0.1)
                    continue
                print(f"    ✗ HTTP {e.code} — skipping")
                fail += 1
                time.sleep(0.1)
                continue
            except Exception as e:
                print(f"    ✗ Download error: {e}")
                fail += 1
                time.sleep(0.1)
                continue

            # --- Upload to Supabase Storage ---
            try:
                storage_path = f"{fac_id}.jpg"
                new_url = upload_to_storage(image_bytes, storage_path)
            except Exception as e:
                print(f"    ✗ Storage upload failed: {e}")
                fail += 1
                time.sleep(0.1)
                continue

            # --- Update DB: photo_url and photo_urls[1] (first element) ---
            existing_urls: list[str] = list(photo_urls or [])
            if existing_urls:
                existing_urls[0] = new_url
            else:
                existing_urls = [new_url]

            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE facilities SET photo_url = %s, photo_urls = %s WHERE id = %s",
                    (new_url, existing_urls, fac_id),
                )
            conn.commit()

            print(f"    ✓ Stored at {storage_path}")
            ok += 1

            time.sleep(0.1)

    print(f"\n{'='*60}")
    print(f"Migration complete.")
    print(f"  Migrated:  {ok}")
    print(f"  Not found: {not_found} (photo_url set to NULL)")
    print(f"  Errors:    {fail}")
    print(f"  Total:     {total}")


if __name__ == "__main__":
    main()
