#!/usr/bin/env python3
"""Report Colorado inspections that still have no public document URL.

CDPHE publishes assisted-living inspections through the Find and Compare
tableau workbook, not as a stable link per event:

    https://cdphe.colorado.gov/health-facilities/find-and-compare-facilities
    https://cohealthviz.dphe.state.co.us/t/HealthFacilitiesPublic/views/HealthFacilitySearchSite/1_HealthFacilitySearchSite

The rows in this database came from the May 18, 2026 records workbooks.
Each inspection already has a date, a citation count, and raw_data.co_event_id
(for example M5T211). One visit is stored once per rule set, so that id is
shared by two or three rows (AL18, OONO, RJ0H). raw_data.co_event_key
(for example 23033N|035H13|AL18) is unique. There is no per-event URL in
that file. This script does not invent one. --apply copies the event key
into source_event_id only where that column is null. It does not write a URL.
It refuses to write if the resulting (source_agency, source_event_id) values
are not unique.

    python3 scrapers/backfill_co_inspection_gate.py
    python3 scrapers/backfill_co_inspection_gate.py --apply
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def source_event_id_to_store(raw: dict | None) -> str | None:
    """The value that belongs in source_event_id.

    co_event_id is the visit. co_event_key is that visit plus the rule set,
    and the unique index is (source_agency, source_event_id).
    """
    if not isinstance(raw, dict):
        return None
    key = str(raw.get("co_event_key") or "").strip()
    return key or None


def duplicate_agency_event_ids(pairs: list[tuple[str, str]]) -> list[tuple[str, str, int]]:
    """(source_agency, source_event_id) values that would appear more than once."""
    counts: dict[tuple[str, str], int] = {}
    for agency, event_id in pairs:
        agency_text = str(agency or "").strip()
        event_text = str(event_id or "").strip()
        if not agency_text or not event_text:
            continue
        key = (agency_text, event_text)
        counts[key] = counts.get(key, 0) + 1
    return [(agency, event_id, count) for (agency, event_id), count in sorted(counts.items()) if count > 1]


def abort_if_duplicate_event_ids(pairs: list[tuple[str, str]]) -> None:
    duplicates = duplicate_agency_event_ids(pairs)
    if not duplicates:
        return
    report_duplicate_event_ids(duplicates)
    sys.exit(
        f"Refusing to write. {len(duplicates)} (source_agency, source_event_id) values are not unique."
    )


def report_duplicate_event_ids(duplicates: list[tuple[str, str, int]]) -> None:
    print(f"CO duplicate (source_agency, source_event_id) values: {len(duplicates)}")
    for agency, event_id, count in duplicates:
        print(f"{agency}\t{event_id}\t{count}")


COPY_EVENT_ID_SQL = """
UPDATE inspections
SET source_event_id = raw_data->>'co_event_key'
WHERE source_agency = 'CO-CDPHE'
  AND source_event_id IS NULL
  AND coalesce(btrim(raw_data->>'co_event_key'), '') <> ''
"""

DUPLICATE_EVENT_ID_SQL = """
WITH planned AS (
    SELECT source_agency, btrim(raw_data->>'co_event_key') AS source_event_id
    FROM inspections
    WHERE source_agency = 'CO-CDPHE'
      AND source_event_id IS NULL
      AND coalesce(btrim(raw_data->>'co_event_key'), '') <> ''
    UNION ALL
    SELECT source_agency, btrim(source_event_id) AS source_event_id
    FROM inspections
    WHERE source_event_id IS NOT NULL
      AND btrim(source_event_id) <> ''
)
SELECT source_agency, source_event_id, count(*) AS copies
FROM planned
GROUP BY source_agency, source_event_id
HAVING count(*) > 1
ORDER BY source_agency, source_event_id
"""


def document_url_for_cdphe_event(event_id: str | None) -> None:
    """The HFQ workbook names the event. It does not contain a document address.

    The public lookup is the Health Facility Search tableau. That page is one
    search for every facility, not a stable URL for this event. Returning a
    value here would invent a source.
    """
    del event_id
    return None


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Colorado inspection-gate report")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Copy raw_data.co_event_key into source_event_id where it is null. Does not write a URL.",
    )
    parser.add_argument("--rows", help="JSON object from the dry-run query, instead of the database")
    args = parser.parse_args()
    load_env()
    if args.rows:
        row = json.loads(Path(args.rows).read_text())
    else:
        row = _query()
    newest = row["newest_cdphe"]
    if newest is not None and not isinstance(newest, str):
        newest = newest.isoformat()
    elif isinstance(newest, str):
        newest = newest[:10]
    print(f"CO live pages: {row['live_pages']}")
    print(f"CO passing the URL rule before: {row['passing']}")
    print(
        "CO live pages with a date, a citation count, and a CDPHE event id, and no document URL: "
        f"{row['event_without_url']}"
    )
    print(f"CO inspections whose event key would be copied into source_event_id: {row['event_ids_to_copy']}")
    print(f"CO newest CDPHE inspection date: {newest or 'none'}")
    print(
        "CO source URL: not stored. The public lookup is the Health Facility Search tableau. "
        "It is not a per-event address. The gate accepts a Colorado inspection when the date, "
        "the citation count, and the event key in source_event_id are present. "
        "A date, a citation count, and an http source URL also count."
    )
    duplicates = [
        (item["source_agency"], item["source_event_id"], int(item["copies"]))
        for item in row.get("duplicates") or []
    ]
    report_duplicate_event_ids(duplicates)
    if args.apply and args.rows:
        sys.exit("Refusing --apply with --rows. Writing uses the database, not a snapshot file.")
    if duplicates:
        sys.exit(
            f"Refusing to write. {len(duplicates)} (source_agency, source_event_id) values are not unique."
        )
    if not args.apply:
        print("Dry-run only. No database writes. Re-run with --apply to copy the event keys.")
        return

    import psycopg

    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(DUPLICATE_EVENT_ID_SQL)
            fresh = cur.fetchall()
            if fresh:
                report_duplicate_event_ids(
                    [(agency, event_id, int(copies)) for agency, event_id, copies in fresh]
                )
                sys.exit("Refusing to write. Duplicate (source_agency, source_event_id) values were found.")
            cur.execute(COPY_EVENT_ID_SQL)
            copied = cur.rowcount
        conn.commit()
    print(f"CO copied {copied} event keys into source_event_id. No source URL was written.")


def _query() -> dict:
    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH live AS (
                    SELECT f.id, f.license_number
                    FROM facilities f
                    WHERE f.publishable AND f.state_code = 'CO'
                ),
                gate AS (
                    SELECT l.id,
                           bool_or(
                               i.inspection_date IS NOT NULL
                               AND btrim(coalesce(i.source_url, '')) <> ''
                               AND i.total_deficiency_count IS NOT NULL
                           ) AS passes,
                           bool_or(
                               i.source_agency = 'CO-CDPHE'
                               AND i.inspection_date IS NOT NULL
                               AND i.total_deficiency_count IS NOT NULL
                               AND coalesce(i.raw_data->>'co_event_id', '') <> ''
                           ) AS has_event,
                           max(i.inspection_date) FILTER (
                               WHERE i.source_agency = 'CO-CDPHE'
                           ) AS newest_cdphe
                    FROM live l
                    LEFT JOIN inspections i ON i.facility_id = l.id
                    GROUP BY l.id
                )
                SELECT
                    count(*) AS live_pages,
                    count(*) FILTER (WHERE passes) AS passing,
                    count(*) FILTER (WHERE NOT passes AND has_event) AS event_without_url,
                    max(newest_cdphe) AS newest_cdphe,
                    (
                        SELECT count(*)
                        FROM inspections i
                        WHERE i.source_agency = 'CO-CDPHE'
                          AND i.source_event_id IS NULL
                          AND coalesce(btrim(i.raw_data->>'co_event_key'), '') <> ''
                    ) AS event_ids_to_copy
                FROM gate
                """
            )
            row = dict(cur.fetchone())
            cur.execute(DUPLICATE_EVENT_ID_SQL)
            row["duplicates"] = [dict(item) for item in cur.fetchall()]
    return row


if __name__ == "__main__":
    main()
