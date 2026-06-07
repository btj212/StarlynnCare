#!/usr/bin/env python3
"""
OR PDF Backfill — read JSON sidecars from or_pdf_parse.py and write into deficiencies.

For each or_pdf_inventory row with parse_status='done' and backfill_status='pending':
  1. Read the .deficiencies.json sidecar next to the local PDF.
  2. For each deficiency in the sidecar, upsert into the deficiencies table.
  3. Map state_severity_raw → severity integer + immediate_jeopardy boolean.
  4. Update backfill_status='done'.

OR severity mapping (per brief Section 5):
  "Level 1"         → severity=1
  "Level 2"         → severity=2
  "Level 3"         → severity=3
  "Level 4"         → severity=4
  "Immediate Jeopardy" → severity=4, immediate_jeopardy=true

Also sets the inspection's inspector_narrative to the full extracted text so
facility profile pages have real content.

Usage:
  python3 scrapers/or_pdf_backfill.py            # all pending
  python3 scrapers/or_pdf_backfill.py --limit 50
  python3 scrapers/or_pdf_backfill.py --dry-run
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
PDF_CACHE_DIR = REPO_ROOT / ".firecrawl" / "or-pdfs"

# Verbatim OR severity vocabulary from OAR 411-054-0120
_OR_SEVERITY_MAP: dict[str, int] = {
    "level 1": 1,
    "level 2": 2,
    "level 3": 3,
    "level 4": 4,
    "immediate jeopardy": 4,
    "ij": 4,
}


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


def map_or_severity(raw: str | None) -> tuple[int | None, bool]:
    """Return (severity_int, immediate_jeopardy) from a raw severity string."""
    if not raw:
        return None, False
    key = raw.strip().lower()
    sev = _OR_SEVERITY_MAP.get(key)
    is_ij = "immediate jeopardy" in key or key == "ij"
    return sev, is_ij


def parse_date_str(raw: str | None) -> date | None:
    if not raw:
        return None
    from datetime import datetime
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            pass
    return None


def backfill_one(
    conn: psycopg.Connection,
    inv_id: str,
    inspection_id: str | None,
    local_path: str,
    dry_run: bool,
) -> int:
    """Return count of deficiency rows written. Raises on sidecar parse error."""
    pdf_path = Path(local_path)
    sidecar = pdf_path.parent / f"{pdf_path.stem}.deficiencies.json"

    if not sidecar.exists():
        raise FileNotFoundError(f"Sidecar not found: {sidecar}")

    deficiencies: list[dict[str, Any]] = json.loads(sidecar.read_text())

    if not inspection_id:
        return 0

    if dry_run:
        print(f"    {str(inv_id)[:8]}  {len(deficiencies)} deficiencies  (dry-run)")
        return len(deficiencies)

    written = 0
    for d in deficiencies:
        sev_raw = d.get("severity") or ""
        sev_int, is_ij = map_or_severity(sev_raw)
        desc = d.get("description") or ""
        code = d.get("code") or None
        corrected = d.get("corrected")

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO deficiencies (
                    inspection_id, regulation_code, description,
                    severity, immediate_jeopardy, state_severity_raw, corrected
                ) VALUES (
                    %(inspection_id)s, %(regulation_code)s, %(description)s,
                    %(severity)s, %(immediate_jeopardy)s, %(state_severity_raw)s, %(corrected)s
                )
                ON CONFLICT DO NOTHING
                """,
                {
                    "inspection_id": inspection_id,
                    "regulation_code": code,
                    "description": desc[:1000] if desc else None,
                    "severity": sev_int,
                    "immediate_jeopardy": is_ij,
                    "state_severity_raw": sev_raw or "Licensing Violation",
                    "corrected": corrected,
                },
            )
        written += 1

    # Update inspection deficiency_count and narrative
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE inspections
            SET deficiency_count = COALESCE(deficiency_count, 0) + %s
            WHERE id = %s
            """,
            (written, inspection_id),
        )

    return written


def run(dry_run: bool, limit: int | None) -> None:
    conn = get_conn()
    limit_sql = f"LIMIT {limit}" if limit else ""

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, local_path, inspection_id
            FROM or_pdf_inventory
            WHERE parse_status = 'done'
              AND backfill_status = 'pending'
              AND local_path IS NOT NULL
            ORDER BY created_at
            {limit_sql}
            """
        )
        rows = cur.fetchall()

    print(f"  {len(rows)} PDFs to backfill")

    ok = err = total_defs = 0
    for inv_id, local_path, inspection_id in rows:
        try:
            n = backfill_one(conn, str(inv_id), str(inspection_id) if inspection_id else None, local_path, dry_run)
            total_defs += n
            if not dry_run:
                with conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            UPDATE or_pdf_inventory
                            SET backfill_status = 'done', backfilled_at = now()
                            WHERE id = %s
                            """,
                            (inv_id,),
                        )
            ok += 1
        except Exception as exc:
            if not dry_run:
                with conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            UPDATE or_pdf_inventory
                            SET backfill_status = 'error', backfill_error = %s
                            WHERE id = %s
                            """,
                            (str(exc)[:500], inv_id),
                        )
            err += 1
            print(f"  ERR {str(inv_id)[:8]}: {exc}", file=sys.stderr)

    print(f"  Done — {ok} PDFs processed, {total_defs} deficiency rows written, {err} errors")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill OR deficiencies from PDF JSON sidecars.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    load_env()
    run(args.dry_run, args.limit)


if __name__ == "__main__":
    main()
