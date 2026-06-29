#!/usr/bin/env python3
"""
Validate facility photo URLs and null out dead references.

Performs HEAD requests against each facilities.photo_url to detect deleted
Supabase Storage objects.  Dead URLs are nulled out in the database so the
facility page falls back to a placeholder or Street View image.

Usage:
    python3 scrapers/validate_facility_photos.py --dry-run      # report only
    python3 scrapers/validate_facility_photos.py                 # null dead rows
    python3 scrapers/validate_facility_photos.py --state AZ      # one state
    python3 scrapers/validate_facility_photos.py --requeue       # flag for Street View re-fetch
"""
import argparse
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import psycopg
from psycopg.rows import dict_row
import urllib.request
import urllib.error


DSN = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
WORKERS = 20
TIMEOUT = 10


def head_ok(url: str) -> bool:
    """Return True if the URL responds with a 2xx status."""
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return 200 <= r.status < 300
    except Exception:
        return False


def run(state_code: str | None, dry_run: bool, requeue: bool) -> None:
    if not DSN:
        sys.exit("Set SUPABASE_DB_URL or DATABASE_URL env var")

    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        conn.autocommit = True

        where = "WHERE photo_url IS NOT NULL"
        params: list = []
        if state_code:
            where += " AND state_code = %s"
            params.append(state_code.upper())

        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id, state_code, name, photo_url FROM facilities {where}",
                params,
            )
            rows = cur.fetchall()

    total = len(rows)
    print(f"Checking {total} photo URLs"
          f"{' in ' + state_code.upper() if state_code else ''}...", flush=True)

    dead: list[dict] = []
    ok_count = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(head_ok, row["photo_url"]): row for row in rows}
        for i, future in enumerate(as_completed(futures), 1):
            row = futures[future]
            alive = future.result()
            if alive:
                ok_count += 1
            else:
                dead.append(row)
                print(f"  DEAD [{row['state_code']}] {row['name']}: {row['photo_url']}", flush=True)
            if i % 100 == 0:
                print(f"  {i}/{total} checked...", end="\r", flush=True)

    print(f"\nResults: {ok_count} alive, {len(dead)} dead", flush=True)

    if not dead:
        print("Nothing to update.")
        return

    if dry_run:
        print("Dry-run: not writing changes.")
        return

    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            for row in dead:
                if requeue:
                    cur.execute(
                        "UPDATE facilities SET photo_url = NULL, streetview_fetched = false WHERE id = %s",
                        (row["id"],),
                    )
                else:
                    cur.execute(
                        "UPDATE facilities SET photo_url = NULL WHERE id = %s",
                        (row["id"],),
                    )

    print(f"Nulled {len(dead)} dead photo URLs"
          f"{' (re-queued for Street View)' if requeue else ''}.", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and clean up dead facility photo URLs")
    parser.add_argument("--state", help="Limit to one state code (e.g. AZ)")
    parser.add_argument("--dry-run", action="store_true", help="Report only, no DB writes")
    parser.add_argument("--requeue", action="store_true",
                        help="Also set streetview_fetched=false so fetch_streetview.py re-fetches")
    args = parser.parse_args()
    run(state_code=args.state, dry_run=args.dry_run, requeue=args.requeue)


if __name__ == "__main__":
    main()
