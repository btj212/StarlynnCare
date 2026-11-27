#!/usr/bin/env python3
"""Read-only count of summaries whose deficiency claim disagrees with the file.

Does not write. Uses DATABASE_URL.

  python3 scripts/count_summary_deficiency_mismatches.py
  python3 scripts/count_summary_deficiency_mismatches.py --examples 3

The SQL net is also printed so it can be run in the SQL editor. Postgres
POSIX regex is broader than the Python gate; this script re-filters with
`citation_mismatch`, which uses the same `is_real_citation` rule as the
summarizer.
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
    citation_mismatch,
    coerce_deficiency_rows,
    real_citation_count,
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
        parsed_rows = coerce_deficiency_rows(def_rows)
        if not citation_mismatch(summary, parsed_rows, state):
            continue
        real_count = real_citation_count(parsed_rows, state)
        by_state[state] += 1
        if args.examples > 0:
            bucket = examples.setdefault(state, [])
            if len(bucket) < args.examples:
                bucket.append(
                    (license_number, name, insp_date, total_def, real_count, summary)
                )

    total = sum(by_state.values())
    print(f"SQL net: {sql_hits} rows")
    print(f"After Python filter (summary disagrees with real citation count): {total}\n")
    print("state\tcount")
    for state, count in sorted(by_state.items(), key=lambda item: (-item[1], item[0])):
        print(f"{state}\t{count}")
    print(f"ALL\t{total}")

    if args.examples > 0:
        print("\nExamples")
        for state in sorted(examples):
            print(f"\n{state}")
            for license_number, name, insp_date, total_def, real_count, summary in examples[state]:
                print(
                    f"  {license_number} {name} {insp_date} "
                    f"stored={total_def} real_citations={real_count}"
                )
                print(f"    {summary}")


if __name__ == "__main__":
    main()
