#!/usr/bin/env python3
"""
Refresh the facility_snapshot_cache columns on the facilities table.

Reads the full facility_snapshot() RPC for every publishable facility and writes
the result to facilities.grade_letter and facilities.composite_percentile so
discovery rails and facility cards can avoid per-facility RPC calls.

Run after any ingest that changes inspection or deficiency data:
    python3 scrapers/refresh_snapshot_cache.py
    python3 scrapers/refresh_snapshot_cache.py --state AZ
    python3 scrapers/refresh_snapshot_cache.py --dry-run

The script is safe to re-run; it upserts in batches of 200 facilities.
"""
import argparse
import os
import sys
from datetime import datetime, timezone

import psycopg
from psycopg.rows import dict_row


DSN = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
BATCH = 200


def run(state_code: str | None, dry_run: bool) -> None:
    if not DSN:
        sys.exit("Set SUPABASE_DB_URL or DATABASE_URL env var")

    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        conn.autocommit = True

        # Fetch IDs of publishable facilities (optionally scoped to one state)
        where = "WHERE publishable = true"
        params: list = []
        if state_code:
            where += " AND state_code = %s"
            params.append(state_code.upper())

        with conn.cursor() as cur:
            cur.execute(f"SELECT id FROM facilities {where} ORDER BY id", params)
            rows = cur.fetchall()

        ids = [r["id"] for r in rows]
        total = len(ids)
        print(f"Refreshing snapshot cache for {total} publishable facilities"
              f"{' in ' + state_code.upper() if state_code else ''}...", flush=True)

        updated = 0
        skipped = 0
        now = datetime.now(timezone.utc).isoformat()

        for i in range(0, total, BATCH):
            batch = ids[i : i + BATCH]
            with conn.cursor() as cur:
                for fid in batch:
                    cur.execute(
                        "SELECT (facility_snapshot(%s)) AS snap",
                        (fid,),
                    )
                    result = cur.fetchone()
                    snap = result["snap"] if result else None

                    grade_letter: str | None = None
                    composite_percentile: int | None = None

                    if snap and isinstance(snap, dict):
                        g = snap.get("grade")
                        if isinstance(g, dict):
                            grade_letter = g.get("letter")
                            cp = g.get("composite_percentile")
                            if cp is not None:
                                composite_percentile = int(cp)

                    if dry_run:
                        print(f"  [dry] {fid}: grade={grade_letter} pct={composite_percentile}")
                        skipped += 1
                    else:
                        cur.execute(
                            """
                            UPDATE facilities
                            SET grade_letter         = %s,
                                composite_percentile = %s,
                                grade_refreshed_at   = %s
                            WHERE id = %s
                            """,
                            (grade_letter, composite_percentile, now, fid),
                        )
                        updated += 1

            print(
                f"  {min(i + BATCH, total)}/{total} processed...",
                end="\r",
                flush=True,
            )

        print(f"\nDone. updated={updated} skipped={skipped}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh facility snapshot cache columns")
    parser.add_argument("--state", help="Limit to a single state code (e.g. AZ)")
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing")
    args = parser.parse_args()
    run(state_code=args.state, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
