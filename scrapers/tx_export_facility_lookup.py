#!/usr/bin/env python3
"""
Export TX facility roster lookup CSV from Supabase.

Why this exists
---------------
The HHSC bulk PIA files Texas delivers (FVH = Facility Visit History,
IntakeHistory = complaint log) join on `STATEID` / `Facility ID`, which is
the agency's internal facility identifier — not the 6-digit license number
the rest of the ingest pipeline uses. This script pulls a once-off lookup
from Supabase so [`tx_pia_to_bundle.py`](./tx_pia_to_bundle.py) and
[`tx_narrative_request_batch.py`](./tx_narrative_request_batch.py) can
resolve STATEID → license_number without round-tripping the DB.

The CSV is gitignored (see [`scrapers/data/.gitignore`](./data/.gitignore)).

Usage
-----
    # Default: writes scrapers/data/tx_facility_lookup.csv
    python3 scrapers/tx_export_facility_lookup.py

    # Custom output path
    python3 scrapers/tx_export_facility_lookup.py --out /tmp/tx_lookup.csv

Requires DATABASE_URL in .env.local or environment.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = Path(__file__).resolve().parent / "data" / "tx_facility_lookup.csv"

QUERY = """
    SELECT
        license_number,
        tx_facility_id,
        name,
        city,
        tx_county,
        tx_alzheimer_certified,
        license_status
    FROM facilities
    WHERE state_code = 'TX'
      AND license_number IS NOT NULL
    ORDER BY license_number
"""


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def main() -> None:
    ap = argparse.ArgumentParser(description="Export TX facility roster lookup CSV")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output CSV path")
    args = ap.parse_args()

    load_env()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print(
            "ERROR: DATABASE_URL not set. Add it to .env.local "
            "(Supabase → Database → Connection string).",
            file=sys.stderr,
        )
        sys.exit(1)

    args.out.parent.mkdir(parents=True, exist_ok=True)

    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.execute(QUERY)
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()

    with args.out.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for r in rows:
            w.writerow(["" if v is None else v for v in r])

    alz_count = sum(1 for r in rows if r[cols.index("tx_alzheimer_certified")])
    print(f"Wrote {len(rows)} TX facilities to {args.out}")
    print(f"  Alzheimer-certified: {alz_count}")


if __name__ == "__main__":
    main()
