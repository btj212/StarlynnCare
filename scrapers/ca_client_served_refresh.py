#!/usr/bin/env python3
"""Store CDSS FacilityDetail client types (CLIENTSERVED1..6) on CA rows.

The facility page uses code 983 ("RCFE / DEMENTIA") as the California
memory-care basis. Only 983 counts; 935 (ELDERLY) does not. The CHHS GIS layer
keeps only the first client type, so FacilityDetail is the source.

Each run refreshes the rows checked longest ago (never-checked first), for
non-closed CA licenses, so the daily job walks the whole state in a few weeks
without hammering CDSS. Writes only ca_cdss_client_served and
ca_cdss_client_served_checked_at. Never touches publishable.

Usage:
  python3 scrapers/ca_client_served_refresh.py --limit 400            # dry run
  python3 scrapers/ca_client_served_refresh.py --limit 400 --apply
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _cdss_live as live  # noqa: E402
from ca_status_refresh import load_env  # noqa: E402

SELECT_SQL = """
SELECT id, license_number
FROM facilities
WHERE state_code = 'CA'
  AND license_number IS NOT NULL
  AND coalesce(license_status, '') NOT IN ('CLOSED', 'REVOKED')
  AND (ca_cdss_client_served_checked_at IS NULL
       OR ca_cdss_client_served_checked_at < now() - make_interval(days => %(stale_days)s))
ORDER BY publishable DESC, ca_cdss_client_served_checked_at NULLS FIRST, license_number
LIMIT %(limit)s
"""

UPDATE_SQL = """
UPDATE facilities
SET ca_cdss_client_served = %(served)s,
    ca_cdss_client_served_checked_at = %(checked_at)s
WHERE id = %(id)s AND state_code = 'CA'
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=400)
    ap.add_argument("--stale-days", type=int, default=30)
    ap.add_argument("--delay", type=float, default=1.0, help="Seconds between FacilityDetail calls.")
    args = ap.parse_args()

    load_env()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 1
    import psycopg

    with psycopg.connect(dsn, connect_timeout=30) as conn:
        cols = {r[0] for r in conn.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='facilities' AND column_name LIKE 'ca_cdss_client_served%%'")}
        if "ca_cdss_client_served" not in cols:
            print("ca_cdss_client_served column missing (apply migration 0083)", file=sys.stderr)
            return 1
        rows = conn.execute(SELECT_SQL, {"limit": args.limit, "stale_days": args.stale_days}).fetchall()
        print(f"{len(rows)} CA rows to refresh")
        session = requests.Session()
        ok = fail = dementia = 0
        for row_id, lic in rows:
            try:
                served = live.client_served(live.fetch_facility_detail(lic, session=session))
            except Exception as exc:  # CDSS outage or a withdrawn number: skip, retry next run
                fail += 1
                print(f"  {lic}: {exc}", file=sys.stderr)
                time.sleep(args.delay)
                continue
            ok += 1
            dementia += live.has_dementia_client_code(served)
            if args.apply:
                conn.execute(UPDATE_SQL, {"id": row_id, "served": served, "checked_at": datetime.now(timezone.utc)})
            time.sleep(args.delay)
        if args.apply:
            conn.commit()
        print(f"fetched {ok}, failed {fail}, with 983 {dementia}, applied={args.apply}")
    return 0 if ok or not rows else 1


if __name__ == "__main__":
    raise SystemExit(main())
