#!/usr/bin/env python3
"""Illinois IDPH FOIA visit ingest.

The workbook column "Name" is the visit id. It is not a facility license.
Visits are grouped by the facility's physical name and attached only to an
Illinois facility already in the directory. A name the directory does not
list is quarantined. This script does not create facilities and does not
invent license numbers.

A stored visit that has no event id can be claimed by one workbook row. The
lowest visit id keeps that row. Every other visit is inserted on its own id.

Usage:
    python3 -u scrapers/il_foia_visits_ingest.py --input /path/to/visits.xlsx
    python3 -u scrapers/il_foia_visits_ingest.py --input /path/to/visits.xlsx --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

sys.path.insert(0, str(Path(__file__).resolve().parent))
from il_foia_parse import (
    REASON_AMBIGUOUS,
    REASON_UNMATCHED,
    normalize_facility_name,
    pair_visits,
    parse_visit_row,
    visit_id_from_cell,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = "foia_visits"
AGENCY = "IDPH-DAL"
PORTAL = "https://llcs.dph.illinois.gov/s/?language=en_US"


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            return


def database_url() -> str | None:
    return os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL") or os.environ.get("POSTGRES_URL")


def load_rows(path: Path) -> list[tuple[int, tuple[Any, ...]]]:
    try:
        import openpyxl
    except ImportError:
        sys.exit("openpyxl not installed — run: pip3 install openpyxl")
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = workbook.active
    rows: list[tuple[int, tuple[Any, ...]]] = []
    for excel_row, values in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        if not values or values[0] is None:
            continue
        rows.append((excel_row, tuple(values)))
    workbook.close()
    return rows


def classify_visits(
    visits: list[dict[str, Any]],
    facilities: list[dict[str, Any]],
) -> None:
    by_name: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for facility in facilities:
        by_name[normalize_facility_name(facility["name"])].append(facility)
    for visit in visits:
        if visit["disposition"] != "normalized":
            continue
        matches = by_name.get(visit["normalized_name"], [])
        if len(matches) == 1:
            visit["facility_id"] = matches[0]["id"]
            continue
        visit["disposition"] = "quarantined"
        visit["reason"] = REASON_AMBIGUOUS if len(matches) > 1 else REASON_UNMATCHED
        visit["facility_id"] = None


_LEDGER_SQL = """
INSERT INTO il_source_rows (
    source, source_key, disposition, reason, facility_external_id, raw
) VALUES (%s, %s, %s, %s, %s, %s)
ON CONFLICT (source, source_key) DO UPDATE SET
    disposition = EXCLUDED.disposition,
    reason = EXCLUDED.reason,
    facility_external_id = EXCLUDED.facility_external_id,
    raw = EXCLUDED.raw,
    ingested_at = now()
"""


def write_ledger(cur: psycopg.Cursor, visits: list[dict[str, Any]]) -> None:
    if not visits:
        return
    cur.executemany(
        _LEDGER_SQL,
        [
            (
                SOURCE,
                visit["source_key"],
                visit["disposition"],
                visit["reason"],
                None,
                Jsonb({**visit["raw"], "facility_id": visit.get("facility_id")}),
            )
            for visit in visits
        ],
    )


def insert_visit(
    cur: psycopg.Cursor,
    visit: dict[str, Any],
    scrape_run_id: str,
) -> str | None:
    cur.execute(
        """
        INSERT INTO inspections (
            facility_id, inspection_date, inspection_type,
            is_complaint, civil_money_penalty_total,
            source_url, source_agency, source_event_id, scrape_run_id,
            raw_data
        ) VALUES (
            %(facility_id)s, %(inspection_date)s, %(inspection_type)s,
            %(is_complaint)s, %(civil_money_penalty_total)s,
            '', %(source_agency)s, %(source_event_id)s, %(scrape_run_id)s,
            %(raw_data)s
        )
        ON CONFLICT (source_agency, source_event_id) WHERE source_event_id IS NOT NULL
        DO NOTHING
        RETURNING id::text
        """,
        {
            "facility_id": visit["facility_id"],
            "inspection_date": visit["inspection_date"],
            "inspection_type": visit["inspection_type"],
            "is_complaint": visit["is_complaint"],
            "civil_money_penalty_total": visit["civil_penalty_total"],
            "source_agency": AGENCY,
            "source_event_id": visit["source_event_id"],
            "scrape_run_id": scrape_run_id,
            "raw_data": Jsonb({
                "survey_subtype": visit["survey_subtype"],
                "visit_id": visit["source_event_id"],
                "portal_url": PORTAL,
            }),
        },
    )
    row = cur.fetchone()
    if row:
        return str(row["id"])
    cur.execute(
        """
        SELECT id::text AS id
        FROM inspections
        WHERE source_agency = %s AND source_event_id = %s
        """,
        (AGENCY, visit["source_event_id"]),
    )
    found = cur.fetchone()
    return str(found["id"]) if found else None


def insert_missing_citations(cur: psycopg.Cursor, inspection_id: str, visit: dict[str, Any]) -> int:
    citations = visit["citations"] or []
    inserted = 0
    for citation in citations:
        cur.execute(
            """
            INSERT INTO deficiencies (
                inspection_id, code, description,
                severity, state_severity_raw,
                is_repeat, civil_money_penalty, status
            )
            SELECT %(inspection_id)s, %(code)s, %(description)s,
                   %(severity)s, %(state_severity_raw)s,
                   %(is_repeat)s, %(civil_money_penalty)s, %(status)s
            WHERE NOT EXISTS (
                SELECT 1 FROM deficiencies existing
                WHERE existing.inspection_id = %(inspection_id)s
                  AND existing.code = %(code)s
            )
            RETURNING id
            """,
            {
                "inspection_id": inspection_id,
                "code": citation["code"][:200],
                "description": (citation.get("raw_line") or "")[:2000] or None,
                "severity": citation.get("severity"),
                "state_severity_raw": citation.get("state_severity_raw"),
                "is_repeat": bool(citation.get("is_repeat")),
                "civil_money_penalty": citation.get("civil_money_penalty"),
                "status": citation.get("status") or "open",
            },
        )
        if cur.fetchone():
            inserted += 1
    return inserted


def claim_visit(cur: psycopg.Cursor, inspection_id: str, visit: dict[str, Any]) -> None:
    cur.execute(
        """
        UPDATE inspections
        SET source_event_id = %(source_event_id)s,
            raw_data = COALESCE(raw_data, '{}'::jsonb) || %(raw_data)s
        WHERE id = %(id)s
          AND source_event_id IS NULL
        """,
        {
            "id": inspection_id,
            "source_event_id": visit["source_event_id"],
            "raw_data": Jsonb({
                "visit_id": visit["source_event_id"],
                "portal_url": PORTAL,
            }),
        },
    )


def run(path: Path, dry_run: bool, smoke: bool, visit_id: str | None) -> None:
    load_env()
    numbered = load_rows(path)
    if smoke:
        numbered = numbered[:20]
    if visit_id:
        target = visit_id_from_cell(visit_id)
        numbered = [row for row in numbered if visit_id_from_cell(row[1][1] if len(row[1]) > 1 else None) == target]
        print(f"Filtered to visit id {target}: {len(numbered)} rows.", flush=True)

    visits = [parse_visit_row(values, excel_row) for excel_row, values in numbered]
    print(f"Loaded {len(visits)} visit rows.", flush=True)

    url = database_url()
    if dry_run and not url:
        quarantined = sum(1 for visit in visits if visit["disposition"] == "quarantined")
        print(f"Dry-run without a database: {len(visits) - quarantined} dated visits, {quarantined} quarantined by the file.")
        return
    if not url:
        sys.exit("DATABASE_URL not set")

    with psycopg.connect(url, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id::text AS id, name
                FROM facilities
                WHERE state_code = 'IL'
                """
            )
            facilities = list(cur.fetchall())
            cur.execute(
                """
                SELECT i.id::text AS id,
                       i.facility_id::text AS facility_id,
                       i.inspection_date,
                       i.inspection_type,
                       i.source_event_id,
                       i.raw_data->>'survey_subtype' AS survey_subtype
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.state_code = 'IL' AND i.source_agency = %s
                """,
                (AGENCY,),
            )
            stored = list(cur.fetchall())

    classify_visits(visits, facilities)
    ready = [visit for visit in visits if visit["disposition"] == "normalized"]
    print(
        f"  {len(ready)} visits match a directory name. "
        f"{len(visits) - len(ready)} are quarantined.",
        flush=True,
    )
    if dry_run:
        print("Dry-run: no rows written.")
        return

    by_facility: dict[str, list[dict[str, Any]]] = defaultdict(list)
    stored_by_facility: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for visit in ready:
        by_facility[visit["facility_id"]].append(visit)
    for row in stored:
        stored_by_facility[row["facility_id"]].append(row)

    scrape_run_id = str(uuid.uuid4())
    claimed = 0
    inserted_visits = 0
    inserted_findings = 0
    with psycopg.connect(url, row_factory=dict_row, autocommit=True) as conn:
        for facility_id, facility_visits in by_facility.items():
            claims, inserts = pair_visits(facility_visits, stored_by_facility.get(facility_id, []))
            visit_by_id = {visit["source_event_id"]: visit for visit in facility_visits}
            with conn.transaction():
                with conn.cursor() as cur:
                    for inspection_id, source_event_id in claims:
                        claim_visit(cur, inspection_id, visit_by_id[source_event_id])
                        claimed += 1
                    for visit in inserts:
                        inspection_id = insert_visit(cur, visit, scrape_run_id)
                        if inspection_id is None:
                            raise RuntimeError(f"visit {visit['source_event_id']} was not stored")
                        inserted_visits += 1
                        inserted_findings += insert_missing_citations(cur, inspection_id, visit)
                    write_ledger(cur, facility_visits)

        quarantined = [visit for visit in visits if visit["disposition"] != "normalized"]
        for start in range(0, len(quarantined), 200):
            chunk = quarantined[start:start + 200]
            with conn.transaction():
                with conn.cursor() as cur:
                    write_ledger(cur, chunk)

        matched_ids = [visit["source_event_id"] for visit in ready]
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT count(*)::int AS n
                FROM inspections
                WHERE source_agency = %s AND source_event_id = ANY(%s)
                """,
                (AGENCY, matched_ids or [""]),
            )
            stored_events = cur.fetchone()["n"]
            cur.execute(
                "SELECT count(*)::int AS n FROM il_source_rows WHERE source = %s",
                (SOURCE,),
            )
            stored_ledger = cur.fetchone()["n"]

    print(
        f"Done. claimed={claimed} inserted_visits={inserted_visits} "
        f"inserted_findings={inserted_findings}",
        flush=True,
    )
    print(f"Reconcile: events {stored_events}/{len(ready)} ledger {stored_ledger}/{len(visits)}", flush=True)
    if stored_events != len(ready) or stored_ledger != len(visits):
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Illinois IDPH FOIA visit ingest")
    parser.add_argument("--input", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--visit-id", help="Process one workbook visit id. This is not a facility license.")
    parser.add_argument("--license", help="Deprecated name for --visit-id. The workbook value is a visit id.")
    args = parser.parse_args()
    path = Path(args.input)
    if not path.is_file():
        sys.exit(f"File not found: {path}")
    if args.license:
        print("--license filters the visit id column. It is not a facility license.", flush=True)
    run(path, args.dry_run, args.smoke, args.visit_id or args.license)


if __name__ == "__main__":
    main()
