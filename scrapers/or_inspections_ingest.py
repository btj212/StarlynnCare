#!/usr/bin/env python3
"""
Oregon Inspections CSV Ingest — OR Universe, Phase 1.

Ingests the full Inspections export from ltclicensing.oregon.gov.

Actual CSV columns (as downloaded 2026-05-16):
  Date | Provider ID | Name | Type | Event ID | Inspection type(s) | Deficiencies cited

NOTE: The Inspections CSV does NOT contain PDF report URLs. The PDF pipeline
(or_pdf_download.py) must source URLs from individual facility detail pages.
For Phase 1 this means or_pdf_inventory stays empty until a separate scrape
of detail pages is added. The structured violation counts are still captured.

Inspection type(s) field values observed:
  "Monitoring", "Standard", "Complaint", "Initial", "Annual", "Revisit", etc.
  These are mapped to is_complaint / is_relicensure / is_followup.

Usage:
  python3 scrapers/or_inspections_ingest.py --input data/or_inspections.csv
  python3 scrapers/or_inspections_ingest.py --input data/or_inspections.csv --dry-run
  python3 scrapers/or_inspections_ingest.py --input data/or_inspections.csv --limit 100
"""

from __future__ import annotations

import argparse
import csv
import os
import re
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


def parse_inspection_types(types_str: str) -> tuple[bool, str]:
    """
    Parse the "Inspection type(s)" field.
    Returns (is_complaint, inspection_type_label).
    """
    t = types_str.strip().lower()
    is_complaint = "complaint" in t
    if "revisit" in t or "follow-up" in t or "followup" in t or "monitoring" in t:
        label = "follow-up"
    elif "complaint" in t:
        label = "complaint"
    elif "annual" in t or "standard" in t or "relicensure" in t or "routine" in t:
        label = "standard"
    elif "initial" in t:
        label = "initial"
    else:
        label = types_str.strip() or "standard"
    return is_complaint, label


def parse_deficiency_count(raw: str) -> int | None:
    if not raw:
        return None
    try:
        return int(float(raw))
    except (ValueError, TypeError):
        return None


INSP_INSERT_SQL = """
INSERT INTO inspections (
    facility_id, inspection_date,
    inspection_type, is_complaint,
    total_deficiency_count, source_url, source_agency
)
VALUES (
    %(facility_id)s, %(inspection_date)s,
    %(inspection_type)s, %(is_complaint)s,
    %(total_deficiency_count)s, %(source_url)s, %(source_agency)s
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
            pid   = row.get("Provider ID", "")
            dt    = row.get("Date", "")
            typ   = row.get("Inspection type(s)", "")
            defs  = row.get("Deficiencies cited", "")
            eid   = row.get("Event ID", "")
            print(f"    pid={pid:12s}  date={dt}  eid={eid:10s}  type={typ:20s}  defs={defs}")
        print("  ... (dry-run, no DB writes)")
        return

    conn = get_conn()
    ok = err = skip = 0

    with conn:
        for row in all_rows:
            external_id = row.get("Provider ID", "").strip()
            if not external_id:
                skip += 1
                continue

            inspection_date = parse_date(row.get("Date", ""))
            if not inspection_date:
                skip += 1
                continue

            types_raw = row.get("Inspection type(s)", "")
            def_count = parse_deficiency_count(row.get("Deficiencies cited", ""))
            is_complaint, insp_type = parse_inspection_types(types_raw)

            try:
                with conn.cursor() as cur:
                    # Savepoint: lets us rollback only this row on failure
                    cur.execute("SAVEPOINT sp_insp")
                    try:
                        cur.execute(
                            "SELECT id FROM facilities WHERE state_code = 'OR' AND external_id = %s LIMIT 1",
                            (external_id,),
                        )
                        fac_row = cur.fetchone()
                        if not fac_row:
                            cur.execute("RELEASE SAVEPOINT sp_insp")
                            skip += 1
                            continue
                        facility_id = fac_row[0]

                        cur.execute(
                            INSP_INSERT_SQL,
                            {
                                "facility_id": facility_id,
                                "inspection_date": inspection_date,
                                "inspection_type": insp_type,
                                "is_complaint": is_complaint,
                                "total_deficiency_count": def_count,
                                "source_url": "https://ltclicensing.oregon.gov/Inspections",
                                "source_agency": "OR-ODHS",
                            },
                        )
                        cur.execute("RELEASE SAVEPOINT sp_insp")
                        ok += 1
                    except Exception as exc:
                        cur.execute("ROLLBACK TO SAVEPOINT sp_insp")
                        cur.execute("RELEASE SAVEPOINT sp_insp")
                        print(f"  WARN: {external_id} {inspection_date} — {exc}", file=sys.stderr)
                        err += 1
            except Exception as exc_outer:
                print(f"  WARN outer: {external_id} — {exc_outer}", file=sys.stderr)
                err += 1

        conn.commit()

    print(
        f"  Inspections: {ok} upserted, {skip} skipped (no facility match or no date), {err} errors"
    )
    print(
        "  NOTE: No PDF URLs in Inspections CSV. or_pdf_inventory will be seeded "
        "separately when facility detail-page scraping is added."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest OR Inspections CSV.")
    parser.add_argument("--input", required=True, help="Path to Inspections CSV")
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
