#!/usr/bin/env python3
"""
WA Adult Family Home (AFH) Directory Ingest — Wave 3a.

Pulls AFH records from WA Geo Open Data (ArcGIS REST) filtered to
facility type "Adult Family Home" and upserts into `facilities`.

AFHs are 2–6 bed residential homes. Unlike ALFs they are private residences,
so we set `wa_afh_residential_flag = true` for privacy-aware display.

Note: The universe is pulled via wa_geo_directory_ingest.py with --type AFH.
This script is a thin wrapper that:
  1. Calls wa_geo_directory_ingest with AFH filter
  2. Tags all AFHs with wa_afh_residential_flag = true (migration column)
  3. Also reads dementia-specialty AFHs from AFHAdvLookup and marks them

Usage:
  python3 scrapers/wa_afh_directory_ingest.py --dry-run
  python3 scrapers/wa_afh_directory_ingest.py
  python3 scrapers/wa_afh_directory_ingest.py --limit 100
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from wa_geo_directory_ingest import main as geo_main, get_conn, load_env as _geo_load_env
from wa_signal_dementia_specialty import scrape_adv_lookup, stamp_dementia_specialty

AFH_ADV_URL = "https://fortress.wa.gov/dshs/adsaapps/lookup/AFHAdvLookup.aspx"


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
            return


def tag_afh_residential_flag(conn: psycopg.Connection, *, dry_run: bool = False) -> int:
    """Set wa_afh_residential_flag=true for all WA AFH facilities."""
    if dry_run:
        print("  DRY-RUN: would tag AFHs with residential flag")
        return 0
    with conn.cursor() as cur:
        # Conditionally add column if not yet present (idempotent)
        cur.execute(
            """
            ALTER TABLE facilities
            ADD COLUMN IF NOT EXISTS wa_afh_residential_flag boolean NOT NULL DEFAULT false
            """
        )
        cur.execute(
            """
            UPDATE facilities
            SET wa_afh_residential_flag = true
            WHERE state_code = 'WA'
              AND wa_facility_type = 'AFH'
            """
        )
        count = cur.rowcount
    conn.commit()
    return count


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="WA AFH directory ingest — Wave 3a")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--skip-geo", action="store_true", help="Skip Geo API pull, only re-tag")
    args = parser.parse_args(argv)

    load_env()
    print("=== WA AFH Directory Ingest ===")

    # Step 1: Pull from WA Geo
    if not args.skip_geo:
        print("\nStep 1: Pulling AFHs from WA Geo Open Data…")
        geo_argv = ["--type", "AFH"]
        if args.dry_run:
            geo_argv.append("--dry-run")
        if args.limit:
            geo_argv += ["--limit", str(args.limit)]
        geo_main(geo_argv)
    else:
        print("\nStep 1: Skipped (--skip-geo)")

    # Step 2: Tag residential flag
    print("\nStep 2: Tagging wa_afh_residential_flag…")
    conn = get_conn()
    n = tag_afh_residential_flag(conn, dry_run=args.dry_run)
    print(f"  Tagged {n} AFHs with residential flag")

    # Step 3: Dementia specialty from AFHAdvLookup
    print("\nStep 3: Stamping dementia-specialty AFHs from AFHAdvLookup…")
    if not args.dry_run:
        try:
            licenses = scrape_adv_lookup(AFH_ADV_URL, "AFH")
            if licenses:
                n2 = stamp_dementia_specialty(conn, licenses)
                print(f"  Stamped {n2} dementia-specialty AFHs")
        except Exception as exc:
            print(f"  Warning: could not scrape AFHAdvLookup: {exc}", file=sys.stderr)
    else:
        print("  DRY-RUN: skipping live scrape")

    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
