#!/usr/bin/env python3
"""
PRR Request Builder — Wave 4.

Generates a templated Public Records Request (PRR) letter based on the
DSHS 17-041 form for WA DSHS inspection records, and creates a tracking
row in the `prr_requests` table.

The generated letter can be submitted via:
  • DSHS Public Records: https://www.dshs.wa.gov/office-of-the-secretary/public-records
  • GovQA portal: https://wa-dshs.govqa.us/

Usage:
  python3 scrapers/prr_request_builder.py \\
      --licenses 1234567890 2345678901 \\
      --scope "Inspection records 2020-2023 for listed ALF licenses" \\
      --output /tmp/prr_request.txt

  python3 scrapers/prr_request_builder.py \\
      --from-db-gaps \\     # auto-detect licenses missing >3 years of coverage
      --max-licenses 50

  python3 scrapers/prr_request_builder.py --list   # show open PRR requests
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent

PRR_IMPORTS_DIR = REPO_ROOT / "prr-imports"

_PRR_LETTER_TEMPLATE = """\
PUBLIC RECORDS REQUEST
Submitted: {today}
Requester: StarlynnCare Research <btj212@gmail.com>

AGENCY: Washington State Department of Social and Health Services (DSHS)
        Aging and Disability Services Administration (ADSA)
        Residential Care Services (RCS)

REQUEST PURSUANT TO: Washington Public Records Act (RCW 42.56)

RECORDS REQUESTED:
  All inspection reports, complaint investigation reports, and statement
  of deficiencies for the following licensed facilities, covering the period
  {period_start} through {period_end}:

{facility_list}

PREFERRED FORMAT: PDF, email delivery to btj212@gmail.com

NOTES: {notes}

Scope description: {scope}
---
PRR Tracking ID: {prr_id}
Batch license count: {license_count}
"""


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


def detect_coverage_gaps(
    conn: psycopg.Connection,
    max_licenses: int | None,
) -> list[str]:
    """
    Find WA facility license numbers that have no inspection older than 3 years.
    These are candidates for a PRR to fill the historical gap.
    """
    sql = """
        SELECT f.license_number
        FROM facilities f
        WHERE f.state_code = 'WA'
          AND f.publishable = true
          AND f.license_number IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM inspections i
            WHERE i.facility_id = f.id
              AND i.inspection_date < NOW() - INTERVAL '3 years'
          )
        ORDER BY f.license_number
        {limit}
    """
    limit = f"LIMIT {max_licenses}" if max_licenses else ""
    with conn.cursor() as cur:
        cur.execute(sql.format(limit=limit))
        return [row[0] for row in cur.fetchall()]


def create_prr_row(
    conn: psycopg.Connection,
    licenses: list[str],
    scope: str,
    *,
    period_start: str = "2018-01-01",
    period_end: str | None = None,
) -> str:
    """Insert a tracking row into prr_requests. Returns the new PRR UUID."""
    period_end = period_end or date.today().isoformat()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO prr_requests
              (state_code, scope_description, batched_license_numbers, status)
            VALUES ('WA', %s, %s::jsonb, 'draft')
            RETURNING id::text
            """,
            (scope, json.dumps(licenses)),
        )
        row = cur.fetchone()
    conn.commit()
    return str(row[0])


def build_letter(
    prr_id: str,
    licenses: list[str],
    scope: str,
    facility_names: dict[str, str],
    period_start: str = "2018-01-01",
    period_end: str | None = None,
    notes: str = "",
) -> str:
    period_end = period_end or date.today().isoformat()
    facility_lines = "\n".join(
        f"  License {lic}: {facility_names.get(lic, '(name lookup failed')}"
        for lic in licenses
    )
    return _PRR_LETTER_TEMPLATE.format(
        today=date.today().isoformat(),
        period_start=period_start,
        period_end=period_end,
        facility_list=facility_lines,
        scope=scope,
        notes=notes or "Please provide records in the order listed.",
        prr_id=prr_id,
        license_count=len(licenses),
    )


def lookup_facility_names(
    conn: psycopg.Connection,
    licenses: list[str],
) -> dict[str, str]:
    if not licenses:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT license_number, name FROM facilities WHERE state_code='WA' AND license_number=ANY(%s)",
            (licenses,),
        )
        return {row[0]: row[1] for row in cur.fetchall()}


def list_open_prrs(conn: psycopg.Connection) -> None:
    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(
            """
            SELECT id, status, scope_description,
                   jsonb_array_length(batched_license_numbers) as lic_count,
                   submitted_at, fulfilled_at
            FROM prr_requests
            WHERE status NOT IN ('fulfilled', 'closed')
            ORDER BY created_at DESC
            """
        )
        rows = cur.fetchall()
    if not rows:
        print("  No open PRR requests.")
        return
    print(f"  {'ID':<38} {'Status':<14} {'Lic#':>5}  {'Submitted':>12}  Scope")
    print("  " + "-" * 90)
    for r in rows:
        submitted = str(r["submitted_at"] or "not yet")
        print(f"  {r['id']:<38} {r['status']:<14} {r['lic_count']:>5}  {submitted:>12}  {r['scope_description'][:50]}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="PRR request builder — Wave 4")
    parser.add_argument("--licenses", nargs="+", help="License numbers to include")
    parser.add_argument("--scope", default="WA DSHS inspection and complaint records for listed facilities")
    parser.add_argument("--period-start", default="2018-01-01")
    parser.add_argument("--period-end")
    parser.add_argument("--notes", default="")
    parser.add_argument("--output", type=Path, help="Write letter to file instead of stdout")
    parser.add_argument("--from-db-gaps", action="store_true", help="Auto-detect coverage gaps from DB")
    parser.add_argument("--max-licenses", type=int, default=50)
    parser.add_argument("--list", action="store_true", help="List open PRR requests")
    parser.add_argument("--dry-run", action="store_true", help="Build letter but don't create DB row")
    args = parser.parse_args(argv)

    load_env()
    conn = get_conn()

    if args.list:
        print("=== Open PRR Requests ===")
        list_open_prrs(conn)
        conn.close()
        return

    licenses: list[str] = []
    if args.licenses:
        licenses = list(args.licenses)
    if args.from_db_gaps:
        gaps = detect_coverage_gaps(conn, args.max_licenses)
        print(f"  Detected {len(gaps)} licenses with coverage gaps")
        licenses.extend(gaps)

    licenses = list(set(licenses))
    if not licenses:
        print("  No licenses specified. Use --licenses or --from-db-gaps.")
        conn.close()
        return

    print(f"  Building PRR for {len(licenses)} licenses…")
    names = lookup_facility_names(conn, licenses)

    if args.dry_run:
        prr_id = "DRY-RUN-00000000"
    else:
        prr_id = create_prr_row(
            conn, licenses, args.scope,
            period_start=args.period_start,
            period_end=args.period_end,
        )
        print(f"  Created PRR row: {prr_id}")
        # Create import directory
        import_dir = PRR_IMPORTS_DIR / prr_id
        import_dir.mkdir(parents=True, exist_ok=True)
        print(f"  Import directory: {import_dir}")

    letter = build_letter(
        prr_id, licenses, args.scope, names,
        period_start=args.period_start,
        period_end=args.period_end,
        notes=args.notes,
    )

    if args.output:
        args.output.write_text(letter)
        print(f"  Letter written to {args.output}")
    else:
        print("\n" + "="*70)
        print(letter)

    conn.close()


if __name__ == "__main__":
    main()
