#!/usr/bin/env python3
"""Set Pennsylvania citation counts from deficiency rows already stored.

The failing live pages are nursing homes. They have no DHS license id, so
the personal-care portal (AzureInspVioltnReprtSearchResults) is not their
source. Their inspections are CMS health surveys: a date, a data.cms.gov
URL, and one deficiencies row per F-tag. total_deficiency_count was left
null. The count is the number of those rows. The join key on the facility
is cms_ccn. license_number is empty.

    python3 scrapers/backfill_pa_inspection_gate.py
    python3 scrapers/backfill_pa_inspection_gate.py --apply

Dry-run is the default.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def pa_match_key(cms_ccn: str | None, license_number: str | None) -> tuple[str, str]:
    """These nursing homes have a CMS certification number and no state license id."""
    if cms_ccn:
        return ("cms_ccn", cms_ccn)
    if license_number:
        return ("license_number", license_number)
    raise ValueError("Pennsylvania inspection has neither a CCN nor a license number")


def citation_count_for_survey(codes: list[str]) -> int:
    """One stored F-tag row is one citation. The caller passes the rows for that survey."""
    return len(codes)


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
        sys.exit("DATABASE_URL is not set. Dry-run reads the database and does not write it.")
    return url


def _print_plan(totals: dict, gained: list[dict], update_count: int) -> None:
    newest_values = []
    for row in gained:
        raw = row["newest_gap"]
        if raw is None:
            continue
        newest_values.append(raw.isoformat() if not isinstance(raw, str) else raw[:10])
    newest = max(newest_values) if newest_values else None
    before = int(totals["passing"])
    print(f"PA live pages: {totals['live_pages']}")
    print(f"PA passing before: {before}")
    print(f"PA that would pass after storing the F-tag count: {before + len(gained)}")
    print(f"PA facilities that would gain a passing inspection: {len(gained)}")
    print(f"PA newest date among those inspections: {newest or 'none'}")
    print(f"PA inspection rows whose citation count would be filled: {update_count}")
    print("PA match key: cms_ccn. license_number is empty on these nursing homes.")
    for row in gained:
        print(f"  ccn={row['cms_ccn']}  newest={str(row['newest_gap'])[:10]}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Pennsylvania inspection-gate backfill")
    parser.add_argument("--apply", action="store_true", help="Write citation counts. Omit to dry-run.")
    parser.add_argument("--rows", help="JSON export of the dry-run query, instead of the database")
    args = parser.parse_args()
    load_env()
    if args.rows:
        payload = json.loads(Path(args.rows).read_text())
        _print_plan(payload["totals"], payload["gained"], int(payload["update_count"]))
        if args.apply:
            sys.exit("Refusing --apply with --rows. Writing uses the database, not a snapshot file.")
        print("Dry-run only. No database writes. Re-run with --apply to store the counts.")
        return

    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH live AS (
                    SELECT f.id, f.cms_ccn, f.license_number
                    FROM facilities f
                    WHERE f.publishable AND f.state_code = 'PA'
                ),
                scored AS (
                    SELECT l.id,
                           l.cms_ccn,
                           l.license_number,
                           bool_or(
                               i.inspection_date IS NOT NULL
                               AND btrim(coalesce(i.source_url, '')) <> ''
                               AND i.total_deficiency_count IS NOT NULL
                           ) AS passes_now,
                           bool_or(
                               i.inspection_date IS NOT NULL
                               AND btrim(coalesce(i.source_url, '')) <> ''
                               AND (
                                   i.total_deficiency_count IS NOT NULL
                                   OR EXISTS (
                                       SELECT 1 FROM deficiencies d WHERE d.inspection_id = i.id
                                   )
                               )
                           ) AS would_pass,
                           max(i.inspection_date) FILTER (
                               WHERE btrim(coalesce(i.source_url, '')) <> ''
                                 AND EXISTS (
                                     SELECT 1 FROM deficiencies d WHERE d.inspection_id = i.id
                                 )
                                 AND i.total_deficiency_count IS NULL
                           ) AS newest_gap
                    FROM live l
                    LEFT JOIN inspections i ON i.facility_id = l.id
                    GROUP BY l.id, l.cms_ccn, l.license_number
                )
                SELECT *
                FROM scored
                WHERE NOT passes_now AND would_pass
                ORDER BY cms_ccn
                """
            )
            gained = list(cur.fetchall())
            cur.execute(
                """
                SELECT count(*) AS live_pages,
                       count(*) FILTER (
                           WHERE EXISTS (
                               SELECT 1 FROM inspections i
                               WHERE i.facility_id = f.id
                                 AND i.inspection_date IS NOT NULL
                                 AND btrim(coalesce(i.source_url, '')) <> ''
                                 AND i.total_deficiency_count IS NOT NULL
                           )
                       ) AS passing
                FROM facilities f
                WHERE f.publishable AND f.state_code = 'PA'
                """
            )
            totals = cur.fetchone()
            cur.execute(
                """
                SELECT i.id::text AS inspection_id,
                       (SELECT count(*) FROM deficiencies d WHERE d.inspection_id = i.id) AS n
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.publishable
                  AND f.state_code = 'PA'
                  AND i.total_deficiency_count IS NULL
                  AND EXISTS (SELECT 1 FROM deficiencies d WHERE d.inspection_id = i.id)
                """
            )
            updates = [(int(row["n"]), row["inspection_id"]) for row in cur.fetchall()]

    _print_plan(totals, gained, len(updates))
    if not args.apply:
        print("Dry-run only. No database writes. Re-run with --apply to store the counts.")
        return
    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.executemany(
                """
                UPDATE inspections
                SET total_deficiency_count = %s
                WHERE id = %s::uuid
                  AND total_deficiency_count IS NULL
                """,
                updates,
            )
        conn.commit()
    print(f"PA updated {len(updates)} citation counts from stored deficiency rows.")


if __name__ == "__main__":
    main()
