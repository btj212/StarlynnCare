#!/usr/bin/env python3
"""Print a draft of the monthly record update.

This script does not email anyone. Monthly sends stay off until the
audience, the copy, and the privacy wording are approved.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    if "--approve" in sys.argv:
        print(
            "Refusing to send. Approve the audience and the copy before any monthly email is built.",
            file=sys.stderr,
        )
        return 2

    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            break

    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        print("DATABASE_URL is not set. Nothing was sent.", file=sys.stderr)
        return 1

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select r.state_code, r.id::text, r.status, r.completed_at
                from state_scan_runs r
                where r.started_at >= now() - interval '35 days'
                  and r.started_at = (
                    select max(s.started_at)
                    from state_scan_runs s
                    where s.state_code = r.state_code
                  )
                order by r.state_code
                """
            )
            runs = cur.fetchall()
            print("# This month in the record")
            print()
            print("Draft only. Do not send.")
            print()
            for state_code, run_id, status, completed_at in runs:
                if status != "completed":
                    print(f"## {state_code}")
                    print(f"Skipped. Latest scan status is {status}.")
                    print()
                    continue
                cur.execute(
                    """
                    select d.summary, f.name, f.city
                    from state_scan_facility_deltas d
                    left join facilities f on f.id = d.facility_id
                    where d.scan_run_id = %s
                      and d.change_type = 'inspection_record_changed'
                    order by d.created_at desc
                    limit 8
                    """,
                    (run_id,),
                )
                rows = cur.fetchall()
                print(f"## {state_code}")
                print(f"Latest completed scan: {completed_at}")
                if not rows:
                    print("No inspection-record changes in that scan.")
                for summary, name, city in rows:
                    where = ", ".join(part for part in (name, city) if part)
                    print(f"- {where or 'Facility'}: {summary}")
                print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
