#!/usr/bin/env python3
"""
Populate facilities.memory_care_disclosure_filed for California RCFEs.

Background
----------
HSC §1569.627 requires any RCFE that advertises or promotes special care,
special programming, or a special environment for persons with dementia to
disclose the special features of the facility in its plan of operation filed
with CDSS.  That filing is the canonical "this is actually a memory-care
facility" signal — more reliable than facility name patterns alone.

Current state of the data source
---------------------------------
As of April 2026, CDSS does NOT publish a machine-readable list of facilities
that have filed a §1569.627 disclosure.  The plan of operation special-features
document lives in regional office paper files and is not exposed through the
CA Open Data CKAN API or the CDSS Transparency API.

This script uses two fallback strategies in order of confidence:

Strategy A (automatic, already present) — §87705/§87706 citation scan
  Any facility that has been cited under Title 22 §87705 (dementia-care
  requirements) or §87706 (dementia-advertising requirements) has been
  confirmed by a CDSS evaluator to operate a dementia program.  These
  citations are ingested by ccld_citations_ingest.py → deficiencies table.
  We query deficiencies.description ILIKE '%87705%' OR '%87706%'.

Strategy B (manual list placeholder) — future §1569.627 disclosure list
  Once CDSS publishes a structured list, replace the stub section below with
  a real fetch call.  Expected format: CSV or JSON from data.ca.gov, keyed
  by facility_number (9-digit zero-padded string).

  TODO: file a PRA request to CDSS for the §1569.627 disclosure registry if
  a public download does not appear by Q3 2026.

Usage
-----
    python mc_disclosure_ingest.py --dry-run     # print what would change
    python mc_disclosure_ingest.py               # write to DB

The script is idempotent and safe to re-run.  It only sets
memory_care_disclosure_filed = true (it never resets to false).
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "CA"

SOURCE_CITATION = "§87705/§87706 citation"
SOURCE_DISCLOSURE_LIST = "§1569.627 disclosure list (CDSS)"  # unused until list exists


# ---------------------------------------------------------------------------
# Env
# ---------------------------------------------------------------------------


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ---------------------------------------------------------------------------
# Strategy A — §87705/§87706 citation scan
# ---------------------------------------------------------------------------


def find_facilities_via_citations(
    conn: psycopg.Connection,
) -> list[dict[str, Any]]:
    """
    Return facility IDs (and license numbers) for any CA facility that has a
    deficiency citing §87705 or §87706, using the inspections→deficiencies join.
    """
    sql = """
        SELECT DISTINCT
            f.id           AS facility_id,
            f.license_number,
            f.name
        FROM facilities f
        JOIN inspections i   ON i.facility_id = f.id
        JOIN deficiencies d  ON d.inspection_id = i.id
        WHERE f.state_code = %s
          AND (
            d.description ILIKE %s
            OR d.description ILIKE %s
            OR d.code        ILIKE %s
            OR d.code        ILIKE %s
          )
        ORDER BY f.name
    """
    with conn.cursor() as cur:
        cur.execute(
            sql,
            (
                STATE_CODE,
                "%87705%", "%87706%",
                "%87705%", "%87706%",
            ),
        )
        rows = cur.fetchall()

    return [
        {"facility_id": r[0], "license_number": r[1], "name": r[2]}
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Strategy B — §1569.627 disclosure list stub
# ---------------------------------------------------------------------------


def find_facilities_via_disclosure_list() -> list[dict[str, Any]]:
    """
    Placeholder for the future CDSS §1569.627 disclosure list.

    Once CDSS publishes a structured list (CSV/JSON on data.ca.gov), replace
    this stub with a real fetch that returns rows of the form:
        {"license_number": "015601302", "source": SOURCE_DISCLOSURE_LIST}

    For now, returns an empty list so the rest of the pipeline runs cleanly.
    """
    # TODO: implement once a public list is available.
    # Suggested check: https://data.ca.gov/api/3/action/package_search?q=1569.627+dementia+disclosure
    return []


# ---------------------------------------------------------------------------
# DB upsert
# ---------------------------------------------------------------------------

UPDATE_SQL = """
UPDATE facilities
SET
    memory_care_disclosure_filed  = true,
    memory_care_disclosure_source = %s,
    updated_at                    = now()
WHERE id = %s
  AND memory_care_disclosure_filed = false
RETURNING id
"""


def upsert_disclosures(
    conn: psycopg.Connection,
    facility_rows: list[dict[str, Any]],
    source: str,
    dry_run: bool,
) -> int:
    """Returns number of rows updated."""
    if not facility_rows:
        return 0

    updated = 0
    with conn.cursor() as cur:
        for row in facility_rows:
            if dry_run:
                print(
                    f"  [dry-run] would set memory_care_disclosure_filed=true "
                    f"on {row['name']} (id={row['facility_id']}, source={source!r})"
                )
                updated += 1
            else:
                cur.execute(UPDATE_SQL, (source, row["facility_id"]))
                if cur.fetchone():
                    updated += 1
    if not dry_run:
        conn.commit()
    return updated


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Populate memory_care_disclosure_filed for CA RCFEs "
            "via §87705/§87706 citation scan and (future) §1569.627 disclosure list."
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be updated; do not write to DB.",
    )
    args = parser.parse_args()

    load_env()

    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print(
            "DATABASE_URL is not set. Add your Supabase Postgres URI to .env.local.",
            file=sys.stderr,
        )
        sys.exit(1)

    dsn = os.environ.get("DATABASE_URL", "")

    with psycopg.connect(dsn) as conn:
        # Strategy A: citation scan
        print("Strategy A — scanning for §87705/§87706 citations …")
        citation_rows = find_facilities_via_citations(conn)
        print(f"  Found {len(citation_rows)} facilities with dementia-regulation citations")

        # Strategy B: disclosure list (stub)
        print("Strategy B — checking §1569.627 disclosure list …")
        disclosure_rows = find_facilities_via_disclosure_list()
        print(f"  Found {len(disclosure_rows)} facilities in disclosure list (stub returns 0)")

        if args.dry_run:
            print("\n--- Dry-run output ---")

        citation_updated = upsert_disclosures(
            conn, citation_rows, SOURCE_CITATION, args.dry_run
        )
        disclosure_updated = upsert_disclosures(
            conn, disclosure_rows, SOURCE_DISCLOSURE_LIST, args.dry_run
        )

        total = citation_updated + disclosure_updated
        label = "would update" if args.dry_run else "updated"
        print(
            f"\nDone. {label} {total} facilities "
            f"(citations: {citation_updated}, disclosure list: {disclosure_updated})."
        )
        if total == 0 and not args.dry_run:
            print(
                "  Note: 0 updates usually means no §87705/§87706 citations have been "
                "ingested yet (Phase D inspection ingest is required), or all matching "
                "facilities were already flagged."
            )

        # Log to scrape_runs if this was a real run
        if not args.dry_run and total > 0:
            started_at = datetime.now(timezone.utc)
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO scrape_runs (
                            state_code, scraper_name, status, started_at,
                            completed_at, records_found, records_updated
                        ) VALUES (%s, %s, 'success', %s, now(), %s, %s)
                        """,
                        (
                            STATE_CODE,
                            "mc_disclosure_ingest",
                            started_at,
                            total,
                            total,
                        ),
                    )
                conn.commit()
            except Exception as e:
                print(f"Note: could not record scrape_run: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
