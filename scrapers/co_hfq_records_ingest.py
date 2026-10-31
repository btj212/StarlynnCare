#!/usr/bin/env python3
"""Load the May 18, 2026 CDPHE complaint and citation workbooks.

The ArcGIS directory must already be loaded. A workbook facility that is not
in that directory is quarantined. Inspection rows are found again by
`raw_data.co_event_key`, so a second run replaces that inspection's
deficiencies instead of inserting a duplicate.

There is no public CDPHE report URL for these rows. `source_url` is an empty
string, which keeps the page from inventing a link.

Usage:
    python3 -u scrapers/co_hfq_records_ingest.py --dry-run
    python3 -u scrapers/co_hfq_records_ingest.py
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from collections import Counter
from pathlib import Path
from typing import Any

import openpyxl
import psycopg
from dotenv import load_dotenv
from psycopg.types.json import Json

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scrapers.co_hfq_parse import (
    HFQ_AS_OF,
    SOURCE_COMPLAINTS,
    SOURCE_SURVEYS,
    Assembly,
    InspectionRecord,
    assemble,
    complaint_from_cells,
    survey_from_cells,
)

COMPLAINTS_DEFAULT = Path(
    "/Users/blakejones/Downloads/Data Request - Blake Jones - 2026.5.18 - Complaints.xlsx"
)
SURVEYS_DEFAULT = Path(
    "/Users/blakejones/Downloads/Data Request - Blake Jones - 2026.5.18 - Surveys & Citations.xlsx"
)
AGENCY = "CO-CDPHE"
RECORDS_AS_OF = HFQ_AS_OF.isoformat()

SOURCE_SQL = """
    INSERT INTO co_source_rows (
        source, source_key, disposition, reason, facility_external_id, raw
    ) VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT (source, source_key) DO UPDATE SET
        disposition = EXCLUDED.disposition,
        reason = EXCLUDED.reason,
        facility_external_id = EXCLUDED.facility_external_id,
        raw = EXCLUDED.raw,
        ingested_at = now()
"""

INSERT_INSPECTION_SQL = """
    INSERT INTO inspections (
        id, facility_id, inspection_date, inspection_type, is_complaint,
        complaint_id, total_deficiency_count, source_url, source_agency, raw_data
    ) VALUES (
        %(id)s, %(facility_id)s, %(inspection_date)s, %(inspection_type)s, %(is_complaint)s,
        %(complaint_id)s, %(total_deficiency_count)s, '', %(source_agency)s, %(raw_data)s
    )
"""

UPDATE_INSPECTION_SQL = """
    UPDATE inspections
       SET inspection_date = %(inspection_date)s,
           inspection_type = %(inspection_type)s,
           is_complaint = %(is_complaint)s,
           complaint_id = %(complaint_id)s,
           total_deficiency_count = %(total_deficiency_count)s,
           source_agency = %(source_agency)s,
           raw_data = %(raw_data)s
     WHERE id = %(id)s
"""

INSERT_DEFICIENCY_SQL = """
    INSERT INTO deficiencies (
        inspection_id, code, scope, severity, class, immediate_jeopardy,
        description, inspector_narrative, plan_of_correction, state_severity_raw,
        cited_date
    ) VALUES (
        %(inspection_id)s, %(code)s, %(scope)s, %(severity)s, %(class)s,
        %(immediate_jeopardy)s, %(description)s, %(inspector_narrative)s,
        %(plan_of_correction)s, %(state_severity_raw)s, %(cited_date)s
    )
"""


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            return


def load_table(path: Path) -> tuple[list[str], list[tuple[int, dict[str, Any]]]]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook.active
        headers: list[str] | None = None
        rows: list[tuple[int, dict[str, Any]]] = []
        for number, values in enumerate(sheet.iter_rows(values_only=True), start=1):
            if headers is None:
                labels = [str(cell).strip() if cell is not None else "" for cell in values]
                if "Facility ID" in labels and ("EVENTID" in labels or "Event ID" in labels):
                    headers = labels
                continue
            if all(cell is None or str(cell).strip() == "" for cell in values):
                continue
            cells: dict[str, Any] = {}
            for index, label in enumerate(headers):
                if not label or index >= len(values):
                    continue
                cells[label] = values[index]
            rows.append((number, cells))
        if headers is None:
            raise RuntimeError(f"No header row found in {path.name}")
        return headers, rows
    finally:
        workbook.close()


def require_headers(headers: list[str], required: list[str], path: Path) -> None:
    missing = [name for name in required if name not in headers]
    if missing:
        raise RuntimeError(f"{path.name} is missing columns: {', '.join(missing)}")


def load_assembly(complaints_path: Path, surveys_path: Path, known_ids: set[str]) -> Assembly:
    complaint_headers, complaint_rows = load_table(complaints_path)
    survey_headers, survey_rows = load_table(surveys_path)
    require_headers(
        complaint_headers,
        ["Facility ID", "Event ID", "Start Date", "Findings"],
        complaints_path,
    )
    require_headers(
        survey_headers,
        ["Facility ID", "EVENTID", "REGSETID", "Citation Code", "Citation Text", "Ss", "Inspection Date"],
        surveys_path,
    )
    complaints = [complaint_from_cells(str(number), cells) for number, cells in complaint_rows]
    surveys = [survey_from_cells(str(number), cells) for number, cells in survey_rows]
    print(
        f"Loaded {len(complaints)} complaint rows and {len(surveys)} survey rows",
        flush=True,
    )
    return assemble(complaints, surveys, known_facility_ids=known_ids, as_of=HFQ_AS_OF)


def print_summary(assembly: Assembly) -> None:
    reasons = Counter(
        f"{row.source}:{row.reason or row.disposition}" for row in assembly.dispositions
    )
    deficiencies = sum(len(inspection.deficiencies) for inspection in assembly.inspections)
    print(f"Inspections: {len(assembly.inspections)}", flush=True)
    print(f"Deficiencies: {deficiencies}", flush=True)
    print("Dispositions:", flush=True)
    for key, count in sorted(reasons.items()):
        print(f"  {key}: {count}", flush=True)
    print("\nSample inspections:", flush=True)
    for inspection in assembly.inspections[:5]:
        print(
            f"  {inspection.facility_id} {inspection.inspection_date.isoformat()} "
            f"{inspection.inspection_type_label} date_source={inspection.date_source} "
            f"defs={len(inspection.deficiencies)} complaint={inspection.is_complaint}",
            flush=True,
        )


def known_facility_ids(conn: psycopg.Connection) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT external_id
              FROM facilities
             WHERE state_code = 'CO'
               AND co_care_setting = 'ALR'
               AND external_id IS NOT NULL
            """
        )
        return {str(row[0]) for row in cur.fetchall()}


def inspection_payload(inspection: InspectionRecord, facility_uuid: str) -> dict[str, Any]:
    return {
        "facility_id": facility_uuid,
        "inspection_date": inspection.inspection_date,
        "inspection_type": inspection.inspection_type_label,
        "is_complaint": inspection.is_complaint,
        "complaint_id": inspection.complaint_ids,
        "total_deficiency_count": len(inspection.deficiencies),
        "source_agency": AGENCY,
        "raw_data": Json(
            {
                "co_event_key": inspection.event_key,
                "co_event_id": inspection.event_id,
                "co_regset_id": inspection.regset_id,
                "date_source": inspection.date_source,
                "inspection_type_label": inspection.inspection_type_label,
                "complaint_findings": inspection.findings,
                "allegation": inspection.allegation,
                "tag_list": inspection.tag_list,
                "inspection_comments": inspection.inspection_comments,
                "facility_type_code": inspection.type_code,
                "records_as_of": RECORDS_AS_OF,
            }
        ),
    }


def _chunks(items: list[Any], size: int) -> list[list[Any]]:
    return [items[index:index + size] for index in range(0, len(items), size)]


def write_assembly(assembly: Assembly, facility_ids: dict[str, str]) -> None:
    """Write inspections in batches. Ids are chosen here so a rerun can replace rows."""
    load_env()
    dsn = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    matched_external_ids = sorted({inspection.facility_id for inspection in assembly.inspections})
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT raw_data->>'co_event_key', id::text, facility_id::text,
                       inspection_date, inspection_type
                  FROM inspections
                 WHERE source_agency = %s
                """,
                (AGENCY,),
            )
            existing: dict[str, tuple[str, str, date, str]] = {}
            used: set[tuple[str, date, str]] = set()
            for event_key, inspection_id, facility_uuid, inspection_date, inspection_type in cur.fetchall():
                if not event_key:
                    continue
                existing[event_key] = (inspection_id, facility_uuid, inspection_date, inspection_type or "")
                used.add((facility_uuid, inspection_date, inspection_type or ""))

            inserts: list[dict[str, Any]] = []
            updates: list[dict[str, Any]] = []
            deficiencies: list[dict[str, Any]] = []
            inspection_ids: list[str] = []
            for inspection in assembly.inspections:
                facility_uuid = facility_ids.get(inspection.facility_id)
                if facility_uuid is None:
                    raise RuntimeError(f"Normalized inspection has no facility row: {inspection.facility_id}")
                current = existing.get(inspection.event_key)
                if current:
                    inspection_id, old_facility, old_date, old_type = current
                    used.discard((old_facility, old_date, old_type))
                    label = old_type or inspection.inspection_type_label or "Survey"
                else:
                    inspection_id = str(uuid.uuid4())
                    label = inspection.inspection_type_label or "Survey"
                identity = (facility_uuid, inspection.inspection_date, label)
                if identity in used:
                    label = f"{inspection.inspection_type_label or 'Survey'} · {inspection.event_key}"
                    identity = (facility_uuid, inspection.inspection_date, label)
                if identity in used:
                    raise RuntimeError(f"Could not give {inspection.event_key} a unique inspection type")
                used.add(identity)
                payload = inspection_payload(inspection, facility_uuid)
                payload["id"] = inspection_id
                payload["inspection_type"] = label
                inspection_ids.append(inspection_id)
                if current:
                    updates.append(payload)
                else:
                    inserts.append(payload)
                for deficiency in inspection.deficiencies:
                    deficiencies.append(
                        {
                            "inspection_id": inspection_id,
                            "code": deficiency.citation_code,
                            "scope": deficiency.scope,
                            "severity": deficiency.severity,
                            "class": deficiency.severity_letter,
                            "immediate_jeopardy": deficiency.immediate_jeopardy,
                            "description": deficiency.regulation_text,
                            "inspector_narrative": deficiency.inspector_narrative,
                            "plan_of_correction": deficiency.plan_of_correction,
                            "state_severity_raw": deficiency.severity_letter,
                            "cited_date": inspection.inspection_date,
                        }
                    )

            source_rows = [
                (
                    row.source,
                    row.source_key,
                    row.disposition,
                    row.reason,
                    row.facility_external_id or None,
                    Json(row.raw),
                )
                for row in assembly.dispositions
            ]
            print(
                f"Writing {len(inserts)} new inspections, {len(updates)} updates, "
                f"{len(deficiencies)} deficiencies, {len(source_rows)} source rows",
                flush=True,
            )
            with conn.pipeline():
                for batch in _chunks(updates, 400):
                    cur.executemany(UPDATE_INSPECTION_SQL, batch)
                if inspection_ids:
                    cur.execute(
                        "DELETE FROM deficiencies WHERE inspection_id = ANY(%s::uuid[])",
                        (inspection_ids,),
                    )
                for batch in _chunks(inserts, 400):
                    cur.executemany(INSERT_INSPECTION_SQL, batch)
                for batch in _chunks(deficiencies, 400):
                    cur.executemany(INSERT_DEFICIENCY_SQL, batch)
                for batch in _chunks(source_rows, 400):
                    cur.executemany(SOURCE_SQL, batch)
                cur.execute(
                    """
                    UPDATE facilities
                       SET co_records_as_of = %s
                     WHERE state_code = 'CO'
                       AND external_id = ANY(%s)
                    """,
                    (HFQ_AS_OF, matched_external_ids),
                )
        conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest CDPHE HFQ complaint and citation workbooks")
    parser.add_argument("--complaints", type=Path, default=COMPLAINTS_DEFAULT)
    parser.add_argument("--surveys", type=Path, default=SURVEYS_DEFAULT)
    parser.add_argument("--dry-run", action="store_true", help="Parse and count, but do not write")
    args = parser.parse_args()
    if not args.complaints.is_file() or not args.surveys.is_file():
        raise SystemExit("The May 18, 2026 HFQ workbooks were not found. Pass --complaints and --surveys.")

    load_env()
    dsn = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is not set")
    with psycopg.connect(dsn) as conn:
        known = known_facility_ids(conn)
        id_map = {}
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT external_id, id::text
                  FROM facilities
                 WHERE state_code = 'CO'
                   AND co_care_setting = 'ALR'
                   AND external_id IS NOT NULL
                """
            )
            id_map = {str(row[0]): str(row[1]) for row in cur.fetchall()}
    print(f"Colorado assisted-living facilities in the database: {len(known)}", flush=True)
    if not known and not args.dry_run:
        raise SystemExit("Load the CDPHE directory before the workbooks.")

    assembly = load_assembly(args.complaints, args.surveys, known)
    print_summary(assembly)
    if args.dry_run:
        print("Dry run complete. No database writes.", flush=True)
        return
    write_assembly(assembly, id_map)
    print("Workbook ingest committed.", flush=True)


if __name__ == "__main__":
    main()
