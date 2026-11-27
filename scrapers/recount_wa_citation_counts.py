#!/usr/bin/env python3
"""List Washington inspections whose stored citation count would change.

The count is the number of distinct WAC codes in the citation rows. One
rule is one row. A second "This requirement was not met" line under the
same rule does not add a second count, and a rule the letter restates
later is still one row.

This does not change a count that has no citation rows. Those inspections
have a stored number and nothing to match it to. Setting them to zero
would erase that number.

Dry-run is the default. It does not write the database.

    python3 scrapers/recount_wa_citation_counts.py
    python3 scrapers/recount_wa_citation_counts.py --rows /tmp/wa_count_mismatch.json

--apply is the write. It sets total_deficiency_count to the distinct-code
count only where citation rows exist and the stored number differs.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    repo = Path(__file__).resolve().parent.parent
    for name in (".env.local", ".env"):
        path = repo / name
        if path.is_file():
            load_dotenv(path)
            return


def database_url() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        sys.exit("DATABASE_URL is not set. Pass --rows for a snapshot, or set the database URL.")
    return url


LIST_SQL = """
SELECT
    i.id::text AS inspection_id,
    f.license_number,
    f.name,
    i.inspection_date::text AS inspection_date,
    i.total_deficiency_count AS stored_count,
    count(DISTINCT d.code) AS distinct_codes
FROM inspections i
JOIN facilities f ON f.id = i.facility_id
JOIN deficiencies d ON d.inspection_id = i.id
WHERE f.state_code = 'WA'
  AND i.total_deficiency_count IS NOT NULL
  AND btrim(coalesce(d.code, '')) <> ''
GROUP BY i.id, f.license_number, f.name, i.inspection_date, i.total_deficiency_count
HAVING i.total_deficiency_count <> count(DISTINCT d.code)
ORDER BY f.license_number, i.inspection_date
"""

SUMMARY_SQL = """
SELECT
    count(*) FILTER (
        WHERE s.distinct_codes > 0 AND i.total_deficiency_count <> s.distinct_codes
    ) AS would_change,
    count(*) FILTER (
        WHERE s.distinct_codes > 0 AND i.total_deficiency_count > s.distinct_codes
    ) AS would_decrease,
    count(*) FILTER (
        WHERE s.distinct_codes > 0 AND i.total_deficiency_count < s.distinct_codes
    ) AS would_increase,
    count(*) FILTER (
        WHERE s.distinct_codes = 0 AND i.total_deficiency_count > 0
    ) AS count_without_rows
FROM inspections i
JOIN facilities f ON f.id = i.facility_id
JOIN LATERAL (
    SELECT count(DISTINCT d.code) FILTER (
        WHERE btrim(coalesce(d.code, '')) <> ''
    ) AS distinct_codes
    FROM deficiencies d
    WHERE d.inspection_id = i.id
) s ON true
WHERE f.state_code = 'WA'
  AND i.total_deficiency_count IS NOT NULL
"""

# The inspection being updated is not visible inside FROM. Join facilities
# there on the state only, and match f.id to i.facility_id in WHERE.
APPLY_SQL = """
UPDATE inspections AS i
SET total_deficiency_count = s.distinct_codes
FROM (
    SELECT d.inspection_id, count(DISTINCT d.code) AS distinct_codes
    FROM deficiencies d
    WHERE trim(coalesce(d.code, '')) <> ''
    GROUP BY d.inspection_id
) AS s
JOIN facilities AS f ON f.state_code = 'WA'
WHERE i.id = s.inspection_id
  AND f.id = i.facility_id
  AND i.total_deficiency_count IS NOT NULL
  AND i.total_deficiency_count <> s.distinct_codes
  AND s.distinct_codes > 0
"""


def update_from_clause(sql: str) -> str:
    """The FROM clause of an UPDATE, not including a WHERE at paren depth 0."""
    depth = 0
    from_at: int | None = None
    index = 0
    while index < len(sql):
        char = sql[index]
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif depth == 0 and _keyword_at(sql, index, "FROM"):
            from_at = index
        elif depth == 0 and from_at is not None and _keyword_at(sql, index, "WHERE"):
            return sql[from_at:index]
        index += 1
    raise ValueError("UPDATE has no FROM and WHERE at the outer level")


def _keyword_at(sql: str, index: int, word: str) -> bool:
    if not sql[index:].upper().startswith(word):
        return False
    before = sql[index - 1] if index else " "
    after_index = index + len(word)
    after = sql[after_index] if after_index < len(sql) else " "
    return not (before.isalnum() or before == "_") and not (after.isalnum() or after == "_")


def _print_rows(rows: list[dict]) -> None:
    decrease = sum(1 for row in rows if int(row["stored_count"]) > int(row["distinct_codes"]))
    increase = sum(1 for row in rows if int(row["stored_count"]) < int(row["distinct_codes"]))
    print(f"WA inspections whose stored count would change: {len(rows)}")
    print(f"WA of those that would go down: {decrease}")
    print(f"WA of those that would go up: {increase}")
    print("license\tdate\tstored\tdistinct\tname")
    for row in rows:
        date = str(row.get("inspection_date") or "")[:10]
        print(
            f"{row.get('license_number')}\t{date}\t{row.get('stored_count')}\t"
            f"{row.get('distinct_codes')}\t{row.get('name')}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Washington distinct-WAC citation recount")
    parser.add_argument("--apply", action="store_true", help="Write the distinct-code count. Omit to dry-run.")
    parser.add_argument("--rows", help="JSON list of the mismatch query, instead of the database")
    args = parser.parse_args()
    if args.rows:
        rows = json.loads(Path(args.rows).read_text())
        _print_rows(rows)
        print("Dry-run from a snapshot. No database writes.")
        if args.apply:
            sys.exit("Refusing --apply with --rows. Writing uses the database, not a snapshot file.")
        return

    load_env()
    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(SUMMARY_SQL)
            summary = dict(cur.fetchone())
            cur.execute(LIST_SQL)
            rows = list(cur.fetchall())
        print(f"WA inspections with a stored count and no citation rows, left unchanged: {summary['count_without_rows']}")
        _print_rows(rows)
        if not args.apply:
            print("Dry-run only. No database writes.")
            return
        with conn.cursor() as cur:
            cur.execute(APPLY_SQL)
            updated = cur.rowcount
        conn.commit()
    print(f"WA updated {updated} citation counts. Inspections with no citation rows were left unchanged.")


if __name__ == "__main__":
    main()
