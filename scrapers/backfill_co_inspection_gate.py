#!/usr/bin/env python3
"""Report Colorado inspections that still have no public document URL.

CDPHE publishes assisted-living inspections through the Find and Compare
tableau workbook, not as a stable link per event:

    https://cdphe.colorado.gov/health-facilities/find-and-compare-facilities
    https://cohealthviz.dphe.state.co.us/t/HealthFacilitiesPublic/views/HealthFacilitySearchSite/1_HealthFacilitySearchSite

The rows in this database came from the May 18, 2026 records workbooks.
Each inspection already has a date, a citation count, and raw_data.co_event_id
(for example 23Q180|ETHC11|AL20). There is no per-event URL in that file.
This script does not invent one. --apply refuses to write.

    python3 scrapers/backfill_co_inspection_gate.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


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
    parser.add_argument("--apply", action="store_true", help="Refused. There is no public per-event URL to store.")
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
    print(f"CO passing before: {row['passing']}")
    print(f"CO that would pass after this backfill: {row['passing']}")
    print(
        "CO live pages with a date, a citation count, and a CDPHE event id, and no document URL: "
        f"{row['event_without_url']}"
    )
    print(f"CO newest CDPHE inspection date: {newest or 'none'}")
    print(
        "CO source URL: not stored. The public lookup is the Health Facility Search tableau. "
        "It is not a per-event address. Gate proposal: accept a CO-CDPHE row when the date, "
        "the citation count, and raw_data.co_event_id are present."
    )
    if args.apply:
        sys.exit("Refusing --apply. Writing a tableau search URL onto every event would invent a source.")
    print("Dry-run only. No database writes.")


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
                    max(newest_cdphe) AS newest_cdphe
                FROM gate
                """
            )
            row = cur.fetchone()
    return dict(row)


if __name__ == "__main__":
    main()
