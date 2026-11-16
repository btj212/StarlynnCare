#!/usr/bin/env python3
"""Put line breaks into Colorado plans that are already stored.

The workbook cell has no breaks. format_plan_text inserts a blank line around
a known heading and changes no words. A row that is already formatted is left
alone, so this is safe to run twice.

    python3 scrapers/co_plan_reformat.py --dry-run
    python3 scrapers/co_plan_reformat.py --limit 5
    python3 scrapers/co_plan_reformat.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scrapers.co_hfq_parse import format_plan_text

SELECT_SQL = """
    SELECT d.id::text AS id, d.plan_of_correction AS plan
    FROM deficiencies d
    JOIN inspections i ON i.id = d.inspection_id
    JOIN facilities f ON f.id = i.facility_id
    WHERE f.state_code = 'CO'
      AND d.plan_of_correction IS NOT NULL
      AND btrim(d.plan_of_correction) <> ''
    ORDER BY length(d.plan_of_correction) DESC, d.id
"""

UPDATE_SQL = """
    UPDATE deficiencies
       SET plan_of_correction = %s
     WHERE id = %s
       AND plan_of_correction = %s
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Update at most this many rows that actually change.",
    )
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        sys.exit("--limit must be at least 1")

    load_dotenv(REPO_ROOT / ".env.local")
    dsn = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        sys.exit("Set DATABASE_URL or SUPABASE_DB_URL")

    with psycopg.connect(dsn, row_factory=dict_row) as conn:
        rows = conn.execute(SELECT_SQL).fetchall()
        pending: list[tuple[str, str, str]] = []
        for row in rows:
            original = row["plan"] or ""
            formatted = format_plan_text(original)
            if formatted == original:
                continue
            if formatted.replace("\n", "") != original.replace("\n", ""):
                sys.exit(f"Refusing to change words on deficiency {row['id']}")
            pending.append((str(row["id"]), original, formatted))
        to_write = pending if args.limit is None else pending[: args.limit]
        for n, (row_id, original, formatted) in enumerate(to_write):
            if n < 3:
                print(f"--- {row_id}")
                print(original[:240].replace("\n", "\\n"))
                print(formatted[:240].replace("\n", "\\n"))
            if args.dry_run:
                continue
            updated = conn.execute(UPDATE_SQL, (formatted, row_id, original)).rowcount
            if updated != 1:
                conn.rollback()
                sys.exit(f"Did not update deficiency {row_id}")
        if args.dry_run:
            conn.rollback()
        else:
            conn.commit()

    verb = "would update" if args.dry_run else "updated"
    print(f"{verb} {len(to_write)} of {len(pending)} plans that need a break ({len(rows)} scanned)")


if __name__ == "__main__":
    main()
