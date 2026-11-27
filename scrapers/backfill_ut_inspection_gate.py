#!/usr/bin/env python3
"""Fill empty Utah inspection source URLs from the public CCL page.

The API is GET https://cclapi.dlbc.utah.gov/api/public/facilities/{id}.
The id is the numeric part of ArcGIS idNumber (external_id), for example
F23-106488 → 106488. The public page is
https://provider.dlbc.utah.gov/ccl/facilities#106488 (ccl.utah.gov/facility/{id}
is the staff portal and shows "Page not found" to the public). license_number is empty on these
rows; the join key is external_id. Dates and citation counts are already
stored from findings[].

Dry-run is the default.

    python3 scrapers/backfill_ut_inspection_gate.py
    python3 scrapers/backfill_ut_inspection_gate.py --apply
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS = Path(__file__).resolve().parent
if str(SCRAPERS) not in sys.path:
    sys.path.insert(0, str(SCRAPERS))

from ut_ccl_inspections_scraper import ccl_facility_url, external_id_to_ccl_id  # noqa: E402


def load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            return


def database_url() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        sys.exit("DATABASE_URL is not set. Dry-run reads the database and does not write it.")
    return url


def load_rows() -> list[dict]:
    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    f.id::text AS facility_id,
                    f.external_id,
                    f.license_number,
                    i.id::text AS inspection_id,
                    i.inspection_date,
                    i.total_deficiency_count,
                    btrim(coalesce(i.source_url, '')) AS source_url,
                    EXISTS (
                        SELECT 1 FROM inspections p
                        WHERE p.facility_id = f.id
                          AND p.inspection_date IS NOT NULL
                          AND btrim(coalesce(p.source_url, '')) <> ''
                          AND p.total_deficiency_count IS NOT NULL
                    ) AS already_passes
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.publishable
                  AND f.state_code = 'UT'
                  AND i.source_agency = 'UT-CCL'
                """
            )
            return list(cur.fetchall())


def main() -> None:
    parser = argparse.ArgumentParser(description="Utah inspection-gate backfill")
    parser.add_argument("--apply", action="store_true", help="Write source URLs. Omit to dry-run.")
    parser.add_argument("--rows", help="JSON export of the dry-run query, instead of the database")
    args = parser.parse_args()
    load_env()
    if args.rows:
        rows = json.loads(Path(args.rows).read_text())
    else:
        rows = load_rows()
    by_facility: dict[str, dict] = {}
    updates: list[tuple[str, str]] = []
    for row in rows:
        ccl_id = external_id_to_ccl_id(row["external_id"] or "")
        url = ccl_facility_url(ccl_id) if ccl_id is not None else None
        slot = by_facility.setdefault(
            row["facility_id"],
            {"passes_now": False, "would_pass": False, "newest": None, "external_id": row["external_id"]},
        )
        has_count = row["total_deficiency_count"] is not None
        has_date = row["inspection_date"] is not None
        has_url = bool(row["source_url"])
        if row.get("already_passes") or (has_date and has_count and has_url):
            slot["passes_now"] = True
        if has_date and has_count and (has_url or url):
            slot["would_pass"] = True
        if has_date:
            raw_date = row["inspection_date"]
            iso = raw_date if isinstance(raw_date, str) else raw_date.isoformat()
            iso = iso[:10]
            if slot["newest"] is None or iso > slot["newest"]:
                slot["newest"] = iso
        if url and not has_url:
            updates.append((url, row["inspection_id"]))
    before = sum(1 for item in by_facility.values() if item["passes_now"])
    after = sum(1 for item in by_facility.values() if item["would_pass"])
    gained = [item for item in by_facility.values() if item["would_pass"] and not item["passes_now"]]
    newest = max((item["newest"] for item in gained if item["newest"]), default=None)
    print(f"UT live pages with a CCL inspection: {len(by_facility)}")
    print(f"UT passing before: {before}")
    print(f"UT that would pass after filling the facility URL: {after}")
    print(f"UT facilities that would gain a passing inspection: {len(gained)}")
    print(f"UT newest date among those facilities: {newest}")
    print(f"UT inspection rows whose source URL would be filled: {len(updates)}")
    for item in sorted(gained, key=lambda row: row["external_id"] or ""):
        ccl_id = external_id_to_ccl_id(item["external_id"] or "")
        print(f"  {item['external_id']}  {ccl_facility_url(ccl_id) if ccl_id else 'unparsed'}  newest={item['newest']}")
    if args.apply and args.rows:
        sys.exit("Refusing --apply with --rows. Writing uses the database, not a snapshot file.")
    if not args.apply:
        print("Dry-run only. No database writes. Re-run with --apply to store the URLs.")
        return
    import psycopg

    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.executemany(
                """
                UPDATE inspections
                SET source_url = %s
                WHERE id = %s::uuid
                  AND btrim(coalesce(source_url, '')) = ''
                """,
                updates,
            )
        conn.commit()
    print(f"UT updated {len(updates)} source URLs.")


if __name__ == "__main__":
    main()
