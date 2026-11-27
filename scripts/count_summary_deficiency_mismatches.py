#!/usr/bin/env python3
"""Read-only count of summaries that claim a clean visit despite deficiencies.

Does not write. Uses DATABASE_URL.

  python3 scripts/count_summary_deficiency_mismatches.py
  python3 scripts/count_summary_deficiency_mismatches.py --examples 3

The SQL net is also printed so it can be run in the SQL editor. Postgres
POSIX regex is broader than the Python gate; this script re-filters with
the same `claims_clean_visit` used when generating summaries.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter
from pathlib import Path

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scrapers"))

from _summary_guard import (  # noqa: E402
    AUDIT_CLAIM_PATTERN,
    AUDIT_SQL,
    claims_clean_visit,
)

load_dotenv(ROOT / ".env.local")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--examples",
        type=int,
        default=2,
        help="Example rows to print per state (0 to skip).",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        print("ERROR: DATABASE_URL is not set")
        sys.exit(1)

    print("Read-only. SQL net (Postgres POSIX; Python re-filters):\n")
    print(AUDIT_SQL.strip())
    print(f"\n-- claim pattern: {AUDIT_CLAIM_PATTERN}\n")

    by_state: Counter[str] = Counter()
    examples: dict[str, list[tuple]] = {}
    sql_hits = 0

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(AUDIT_SQL, {"claim": AUDIT_CLAIM_PATTERN})
            rows = cur.fetchall()

    for state, license_number, name, _insp_id, insp_date, total_def, def_rows, summary in rows:
        sql_hits += 1
        if not claims_clean_visit(summary):
            continue
        by_state[state] += 1
        if args.examples > 0:
            bucket = examples.setdefault(state, [])
            if len(bucket) < args.examples:
                bucket.append((license_number, name, insp_date, total_def, def_rows, summary))

    total = sum(by_state.values())
    print(f"SQL net: {sql_hits} rows")
    print(f"After Python filter (clean-visit claim + citation count > 0): {total}\n")
    print("state\tcount")
    for state, count in sorted(by_state.items(), key=lambda item: (-item[1], item[0])):
        print(f"{state}\t{count}")
    print(f"ALL\t{total}")

    if args.examples > 0:
        print("\nExamples")
        for state in sorted(examples):
            print(f"\n{state}")
            for license_number, name, insp_date, total_def, def_rows, summary in examples[state]:
                print(
                    f"  {license_number} {name} {insp_date} "
                    f"total_def={total_def} citations={def_rows}"
                )
                print(f"    {summary}")


if __name__ == "__main__":
    main()
