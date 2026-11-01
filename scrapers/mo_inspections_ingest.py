#!/usr/bin/env python3
"""Missouri DHSS inspection ingest from the FOIA workbook.

One inspection per EVENT_ID. Two events on the same day stay two visits.
A zero-deficiency marker is kept on the event and is not stored as a finding.
Malformed rows are quarantined in mo_source_rows. They are not merged into
another visit.

Severity 4 is an immediate-jeopardy phrase or a high-harm keyword in the tag
text. A complaint survey does not raise severity by itself.

Usage:
    python3 scrapers/mo_inspections_ingest.py --excel /path/to/records.xlsx
    python3 scrapers/mo_inspections_ingest.py --excel /path/to/records.xlsx --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mo_records_parse import (
    REASON_UNMATCHED,
    assemble,
    map_severity,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
EXCEL_DEFAULT = REPO_ROOT / "data" / "missourirecords.xlsx"
SOURCE = "foia_records"
AGENCY = "MO-DHSS"


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            return


def database_url() -> str:
    url = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("Set SUPABASE_DB_URL or DATABASE_URL")
    return url


def load_excel(path: Path) -> list[tuple[int, dict[str, Any]]]:
    try:
        import openpyxl
    except ImportError:
        sys.exit("openpyxl not installed — run: pip3 install openpyxl")

    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = workbook.active
    headers = [str(cell.value).strip() if cell.value is not None else "" for cell in next(sheet.iter_rows(min_row=1, max_row=1))]
    rows: list[tuple[int, dict[str, Any]]] = []
    for excel_row, values in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        record = dict(zip(headers, values))
        if any(value is not None for value in record.values()):
            rows.append((excel_row, record))
    workbook.close()
    return rows


def mark_unmatched(ledger: list[dict[str, Any]], event_id: str) -> None:
    for item in ledger:
        if item["event_id"] == event_id and item["disposition"] == "normalized":
            item["disposition"] = "quarantined"
            item["reason"] = REASON_UNMATCHED


_LEDGER_SQL = """
INSERT INTO mo_source_rows (
    source, source_key, disposition, reason, facility_external_id, raw
) VALUES (%s, %s, %s, %s, %s, %s)
ON CONFLICT (source, source_key) DO UPDATE SET
    disposition = EXCLUDED.disposition,
    reason = EXCLUDED.reason,
    facility_external_id = EXCLUDED.facility_external_id,
    raw = EXCLUDED.raw,
    ingested_at = now()
"""


def write_ledger(cur: psycopg.Cursor, items: list[dict[str, Any]]) -> None:
    if not items:
        return
    cur.executemany(
        _LEDGER_SQL,
        [
            (
                SOURCE,
                item["source_key"],
                item["disposition"],
                item["reason"],
                item["facility_external_id"],
                Jsonb(item["raw"]),
            )
            for item in items
        ],
    )


def upsert_event(cur: psycopg.Cursor, facility_id: str, event: dict[str, Any]) -> str:
    cur.execute(
        """
        INSERT INTO inspections (
            facility_id, inspection_date, inspection_type,
            is_complaint, total_deficiency_count,
            source_url, source_agency, source_event_id, raw_data
        ) VALUES (
            %(facility_id)s, %(inspection_date)s, %(inspection_type)s,
            %(is_complaint)s, %(total_deficiency_count)s,
            '', %(source_agency)s, %(source_event_id)s, %(raw_data)s
        )
        ON CONFLICT (source_agency, source_event_id) WHERE source_event_id IS NOT NULL
        DO UPDATE SET
            total_deficiency_count = EXCLUDED.total_deficiency_count,
            is_complaint = EXCLUDED.is_complaint,
            inspection_type = EXCLUDED.inspection_type,
            inspection_date = EXCLUDED.inspection_date,
            raw_data = COALESCE(inspections.raw_data, '{}'::jsonb) || EXCLUDED.raw_data
        RETURNING id::text
        """,
        {
            "facility_id": facility_id,
            "inspection_date": event["event_date"],
            "inspection_type": event["inspection_type"],
            "is_complaint": event["is_complaint"],
            "total_deficiency_count": len(event["deficiencies"]),
            "source_agency": AGENCY,
            "source_event_id": event["event_id"],
            "raw_data": Jsonb({
                "event_id": event["event_id"],
                "survey_category": event["survey_category"],
                "facility_type": event["facility_type"],
                "facility_id": event["facility_id_raw"],
            }),
        },
    )
    row = cur.fetchone()
    if row is None:
        raise RuntimeError(f"event {event['event_id']} did not return an inspection id")
    return str(row["id"])


def insert_missing_finding(cur: psycopg.Cursor, inspection_id: str, event: dict[str, Any], finding: dict[str, Any]) -> bool:
    severity, immediate = map_severity(finding["description"])
    cur.execute(
        """
        INSERT INTO deficiencies (
            inspection_id, code, description,
            is_repeat, severity, immediate_jeopardy,
            cited_date, state_severity_raw, status
        )
        SELECT %(inspection_id)s, %(code)s, %(description)s,
               false, %(severity)s, %(immediate_jeopardy)s,
               %(cited_date)s, %(state_severity_raw)s, 'cited'
        WHERE NOT EXISTS (
            SELECT 1 FROM deficiencies existing
            WHERE existing.inspection_id = %(inspection_id)s
              AND existing.code = %(code)s
        )
        RETURNING id
        """,
        {
            "inspection_id": inspection_id,
            "code": finding["tag"],
            "description": finding["description"],
            "severity": severity,
            "immediate_jeopardy": immediate,
            "cited_date": event["event_date"],
            "state_severity_raw": event["survey_category"],
        },
    )
    return cur.fetchone() is not None


def run(excel_path: Path, dry_run: bool) -> None:
    load_env()
    print(f"Loading Excel: {excel_path}", flush=True)
    rows = load_excel(excel_path)
    assembled = assemble(rows)
    events = assembled["events"]
    ledger = assembled["ledger"]
    print(f"  {len(rows)} source rows, {len(events)} events", flush=True)
    if events:
        print(f"  sample {events[0]['event_id']} date={events[0]['event_date']}", flush=True)

    if dry_run and not (os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")):
        findings = sum(len(event["deficiencies"]) for event in events)
        quarantined = sum(1 for item in ledger if item["disposition"] == "quarantined")
        print(f"Dry-run without a database: {len(events)} events, {findings} findings, {quarantined} quarantined rows.")
        return

    dsn = database_url()
    numbers = sorted({event["facility_number"] for event in events if event["facility_number"]})
    with psycopg.connect(dsn, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT external_id, id::text AS id
                FROM facilities
                WHERE state_code = 'MO' AND external_id = ANY(%s)
                """,
                (numbers,),
            )
            facility_ids = {row["external_id"]: row["id"] for row in cur.fetchall()}

    matched = 0
    unmatched_events = 0
    for event in events:
        if facility_ids.get(event["facility_number"]):
            matched += 1
        else:
            unmatched_events += 1
            mark_unmatched(ledger, event["event_id"])
    print(f"  Matched {matched} events. Unmatched events: {unmatched_events}.", flush=True)

    if dry_run:
        findings = sum(len(event["deficiencies"]) for event in events if facility_ids.get(event["facility_number"]))
        print(f"Dry-run: would write {matched} events and {findings} findings. No changes written.")
        return

    ledger_by_event: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in ledger:
        if item["event_id"]:
            ledger_by_event[item["event_id"]].append(item)

    written = 0
    findings_inserted = 0
    failed: list[str] = []
    with psycopg.connect(dsn, row_factory=dict_row, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT source_event_id, id::text AS id
                FROM inspections
                WHERE source_agency = %s AND source_event_id IS NOT NULL
                """,
                (AGENCY,),
            )
            existing = {row["source_event_id"]: row["id"] for row in cur.fetchall()}

        # Existing visits keep their narratives and ShowMeLTC links. Only the
        # events the old date key dropped are inserted.
        for event in events:
            facility_id = facility_ids.get(event["facility_number"])
            if not facility_id or event["event_id"] in existing:
                continue
            if event["event_date"] is None:
                failed.append(event["event_id"])
                for item in ledger_by_event[event["event_id"]]:
                    item["disposition"] = "quarantined"
                    item["reason"] = "undated"
                continue
            try:
                with conn.transaction():
                    with conn.cursor() as cur:
                        inspection_id = upsert_event(cur, facility_id, event)
                        for finding in event["deficiencies"]:
                            if insert_missing_finding(cur, inspection_id, event, finding):
                                findings_inserted += 1
                existing[event["event_id"]] = inspection_id
                written += 1
            except Exception as exc:
                failed.append(event["event_id"])
                for item in ledger_by_event[event["event_id"]]:
                    item["disposition"] = "quarantined"
                    item["reason"] = "ingest_error"
                print(f"  EVENT ERROR {event['event_id']}: {exc}", flush=True)

        print(f"  inserted {written} missing events, {findings_inserted} findings", flush=True)
        for start in range(0, len(ledger), 500):
            with conn.transaction():
                with conn.cursor() as cur:
                    write_ledger(cur, ledger[start:start + 500])
            print(f"  ledger {min(start + 500, len(ledger))}/{len(ledger)}", flush=True)

        with conn.cursor() as cur:
            event_ids = [event["event_id"] for event in events if facility_ids.get(event["facility_number"])]
            cur.execute(
                """
                SELECT count(*)::int AS n
                FROM inspections
                WHERE source_agency = %s AND source_event_id = ANY(%s)
                """,
                (AGENCY, event_ids),
            )
            stored_events = cur.fetchone()["n"]
            cur.execute(
                """
                SELECT count(*)::int AS n
                FROM deficiencies d
                JOIN inspections i ON i.id = d.inspection_id
                WHERE i.source_agency = %s AND i.source_event_id = ANY(%s)
                """,
                (AGENCY, event_ids),
            )
            stored_findings = cur.fetchone()["n"]
            cur.execute(
                "SELECT count(*)::int AS n FROM mo_source_rows WHERE source = %s",
                (SOURCE,),
            )
            stored_ledger = cur.fetchone()["n"]

    expected_findings = sum(
        len(event["deficiencies"])
        for event in events
        if facility_ids.get(event["facility_number"]) and event["event_id"] not in failed
    )
    print(
        f"Done. events written={written} failed={len(failed)} "
        f"new findings={findings_inserted}",
        flush=True,
    )
    print(
        f"Reconcile: events {stored_events}/{matched} findings {stored_findings}/{expected_findings} "
        f"ledger {stored_ledger}/{len(ledger)}",
        flush=True,
    )
    if failed or stored_events != matched or stored_findings != expected_findings or stored_ledger != len(ledger):
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Missouri DHSS inspection ingest from the FOIA workbook")
    parser.add_argument("--excel", default=str(EXCEL_DEFAULT))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(Path(args.excel), args.dry_run)


if __name__ == "__main__":
    main()
