#!/usr/bin/env python3
"""
Oregon Violations CSV Ingest — OR Universe, Phase 1.

Ingests the full Violations export from ltclicensing.oregon.gov.

Actual CSV columns (as downloaded 2026-05-16):
  Date | Provider ID | Name | Provider type | Report number | Allegation | Type

Column mapping:
  Date          → violation date (join to nearest inspection)
  Provider ID   → facilities.external_id
  Report number → state case reference (e.g. "CALMS - 00105883") — not a PDF URL
  Allegation    → deficiency description
  Type          → state_severity_raw (e.g. "Licensing Violation")

NOTE: This CSV has no OAR citation column. The `regulation_code` field will be
NULL for CSV-sourced rows. OAR citations come from PDF parse (or_pdf_parse.py).

Severity integers are NOT set here — they come from or_pdf_backfill.py once
PDFs are parsed. state_severity_raw is set to the Type column value.

Usage:
  python3 scrapers/or_violations_ingest.py --input data/or_violations.csv
  python3 scrapers/or_violations_ingest.py --input data/or_violations.csv --dry-run
  python3 scrapers/or_violations_ingest.py --input data/or_violations.csv --limit 200
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "OR"


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
            return


def get_conn() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    return psycopg.connect(url)


def parse_date(raw: str) -> date | None:
    raw = raw.strip()
    if not raw:
        return None
    from datetime import datetime
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            pass
    return None


def find_inspection_id(conn: psycopg.Connection, facility_id: str, viol_date: date) -> str | None:
    """
    Match violation to the nearest inspection within ±90 days.
    Violations in OR are typically cited during or immediately after an inspection.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM inspections
            WHERE facility_id = %s
              AND inspection_date BETWEEN %s::date - INTERVAL '90 days'
                                     AND %s::date + INTERVAL '90 days'
            ORDER BY ABS(EXTRACT(EPOCH FROM (inspection_date::timestamp - %s::timestamp)))
            LIMIT 1
            """,
            (facility_id, viol_date, viol_date, viol_date),
        )
        row = cur.fetchone()
    return str(row[0]) if row else None


DEF_INSERT_SQL = """
INSERT INTO deficiencies (
    inspection_id, code, description,
    severity, immediate_jeopardy, state_severity_raw
)
VALUES (
    %(inspection_id)s, %(code)s, %(description)s,
    %(severity)s, %(immediate_jeopardy)s, %(state_severity_raw)s
)
"""


def ingest(input_path: Path, dry_run: bool, limit: int | None) -> None:
    with open(input_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        all_rows = list(reader)

    if limit:
        all_rows = all_rows[:limit]

    print(f"  Loaded {len(all_rows)} rows from {input_path.name}")

    if dry_run:
        for row in all_rows[:5]:
            pid  = row.get("Provider ID", "")
            dt   = row.get("Date", "")
            typ  = row.get("Type", "")
            alg  = row.get("Allegation", "")
            rpt  = row.get("Report number", "")
            print(f"    pid={pid:12s}  date={dt}  type={typ:20s}  rpt={rpt[:20]}  alg={alg[:40]}")
        print("  ... (dry-run, no DB writes)")
        return

    # Pre-load facility external_id → uuid map for OR to avoid per-row SELECT
    conn = get_conn()
    ok = skip_fac = skip_insp = err = 0

    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT external_id, id FROM facilities WHERE state_code = 'OR' AND external_id IS NOT NULL"
            )
            fac_map: dict[str, str] = {row[0]: str(row[1]) for row in cur.fetchall()}

        for row in all_rows:
            external_id = row.get("Provider ID", "").strip()
            if not external_id:
                skip_fac += 1
                continue

            facility_id = fac_map.get(external_id)
            if not facility_id:
                skip_fac += 1
                continue

            viol_date  = parse_date(row.get("Date", ""))
            allegation = row.get("Allegation", "").strip() or None
            viol_type  = row.get("Type", "").strip() or "Licensing Violation"

            inspection_id = None
            if viol_date:
                inspection_id = find_inspection_id(conn, facility_id, viol_date)

            if not inspection_id:
                skip_insp += 1
                continue

            try:
                with conn.cursor() as cur:
                    cur.execute("SAVEPOINT sp_viol")
                    try:
                        cur.execute(
                            DEF_INSERT_SQL,
                            {
                                "inspection_id": inspection_id,
                                "code": None,                          # no OAR citation in CSV
                                "description": allegation[:1000] if allegation else None,
                                "severity": None,                      # set by or_pdf_backfill.py
                                "immediate_jeopardy": False,
                                "state_severity_raw": viol_type,
                            },
                        )
                        cur.execute("RELEASE SAVEPOINT sp_viol")
                        ok += 1
                    except Exception as exc:
                        cur.execute("ROLLBACK TO SAVEPOINT sp_viol")
                        cur.execute("RELEASE SAVEPOINT sp_viol")
                        print(f"  WARN: {external_id} {viol_date} — {exc}", file=sys.stderr)
                        err += 1
            except Exception as exc_outer:
                print(f"  WARN outer: {external_id} — {exc_outer}", file=sys.stderr)
                err += 1

        conn.commit()

    print(f"  Deficiencies: {ok} inserted, {skip_fac} no-facility, {skip_insp} no-inspection, {err} errors")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest OR Violations CSV into deficiencies.")
    parser.add_argument("--input", required=True, help="Path to Violations CSV")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    load_env()
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    ingest(input_path, args.dry_run, args.limit)


if __name__ == "__main__":
    main()
