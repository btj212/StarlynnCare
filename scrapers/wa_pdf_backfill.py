#!/usr/bin/env python3
"""
WA PDF Backfill — Wave 1a, Step 3.

Reads sidecar JSON files written by wa_pdf_parse.py and:
  1. Replaces placeholder deficiency rows (description starts with "WA DSHS report:")
     with the parsed deficiency rows from Claude Haiku.
  2. Rebuilds inspections.raw_data->>'narrative' from the real extracted text.
  3. Marks wa_pdf_inventory.backfill_status='done'.
  4. Optionally re-triggers summarize_inspections.py for updated inspections.

Usage:
  python3 scrapers/wa_pdf_backfill.py                   # all done-parse pending-backfill
  python3 scrapers/wa_pdf_backfill.py --limit 20
  python3 scrapers/wa_pdf_backfill.py --facility-id UUID
  python3 scrapers/wa_pdf_backfill.py --dry-run
  python3 scrapers/wa_pdf_backfill.py --rescore         # also re-run summarize_inspections
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import subprocess
import uuid as uuid_lib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

_WA_PLACEHOLDER_PREFIX = "WA DSHS report:"


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


def _is_placeholder(text: str | None) -> bool:
    return bool(text and text.startswith(_WA_PLACEHOLDER_PREFIX))


def _deficiency_key(inspection_id: str, code: str, desc: str) -> str:
    h = hashlib.sha256(f"{inspection_id}|{code}|{desc[:200]}".encode()).hexdigest()[:32]
    return f"__wa_{h}"


# WA DSHS ALF severity taxonomy → integer severity used by facility_snapshot.
# IJ/Type A map to severity >= 3 (the "severe" threshold in the state hub stat).
_WA_SEVERITY_MAP: dict[str, int] = {
    "ij":                 4,
    "immediate jeopardy": 4,
    "type a":             3,
    "typea":              3,
    "type-a":             3,
    "class 1":            3,
    "class1":             3,
    "class i":            3,
    "type b":             2,
    "typeb":              2,
    "type-b":             2,
    "class 2":            2,
    "class2":             2,
    "class ii":           2,
    "type c":             1,
    "typec":              1,
    "type-c":             1,
    "class 3":            1,
    "class3":             1,
    "class iii":          1,
}


def _map_wa_severity(raw: str | None) -> int | None:
    if not raw:
        return None
    return _WA_SEVERITY_MAP.get(raw.strip().lower())


def get_pending_backfill(
    conn: psycopg.Connection,
    facility_id: str | None,
    limit: int | None,
    created_after: str | None = None,
) -> list[dict[str, Any]]:
    sql = """
        SELECT i.id, i.sha256, i.local_path, i.facility_id
        FROM wa_pdf_inventory i
        WHERE i.parse_status = 'done'
          AND i.backfill_status = 'pending'
          {fac_filter}
          {created_after_filter}
        ORDER BY i.created_at
        {limit_clause}
    """
    fac_filter = "AND i.facility_id = %s::uuid" if facility_id else ""
    created_after_filter = "AND i.created_at >= %s::timestamptz" if created_after else ""
    limit_clause = f"LIMIT {limit}" if limit else ""
    params: list[Any] = [facility_id] if facility_id else []
    if created_after:
        params.append(created_after)

    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(
            sql.format(
                fac_filter=fac_filter,
                created_after_filter=created_after_filter,
                limit_clause=limit_clause,
            ),
            params,
        )
        return cur.fetchall()


def find_inspection_for_pdf(
    conn: psycopg.Connection,
    facility_id: str,
    source_url: str,
) -> str | None:
    """Return inspection id that matches the PDF source URL."""
    # The URL is stored in deficiencies.inspector_narrative or description
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT i.id::text
            FROM deficiencies d
            JOIN inspections i ON i.id = d.inspection_id
            WHERE i.facility_id = %s::uuid
              AND (
                d.inspector_narrative = %s
                OR d.description LIKE %s
              )
            LIMIT 1
            """,
            (facility_id, source_url, f"%{source_url}%"),
        )
        row = cur.fetchone()
    return str(row[0]) if row else None


def rebuild_narrative_from_deficiencies(
    parsed_deficiencies: list[dict[str, Any]],
) -> str:
    """Build a plain-text narrative from parsed deficiency list."""
    parts: list[str] = []
    for d in parsed_deficiencies:
        code = (d.get("code") or "—").strip()
        desc = (d.get("description") or "").strip()
        if desc:
            parts.append(f"{code}: {desc}")
    return "\n\n".join(parts)[:12_000]


def backfill_inspection(
    conn: psycopg.Connection,
    inspection_id: str,
    parsed_deficiencies: list[dict[str, Any]],
    source_url: str,
    *,
    dry_run: bool = False,
) -> int:
    """
    Replace placeholder deficiency rows and rebuild narrative.
    Returns count of deficiency rows written.
    """
    # Delete existing placeholder deficiencies for this inspection
    placeholder_count = 0
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) FROM deficiencies
            WHERE inspection_id = %s::uuid
              AND (
                description LIKE %s
                OR inspector_narrative LIKE %s
              )
            """,
            (inspection_id, f"{_WA_PLACEHOLDER_PREFIX}%", "https://%"),
        )
        row = cur.fetchone()
        placeholder_count = row[0] if row else 0

    print(f"    Found {placeholder_count} placeholder deficiencies to replace")

    if dry_run:
        print(f"    DRY-RUN: would replace {placeholder_count} rows with {len(parsed_deficiencies)} parsed rows")
        return 0

    with conn.cursor() as cur:
        # Remove placeholder deficiencies
        cur.execute(
            """
            DELETE FROM deficiencies
            WHERE inspection_id = %s::uuid
              AND (
                description LIKE %s
                OR inspector_narrative LIKE %s
              )
            """,
            (inspection_id, f"{_WA_PLACEHOLDER_PREFIX}%", "https://%"),
        )
        deleted = cur.rowcount

    # Insert parsed deficiencies
    inserted = 0
    with conn.cursor() as cur:
        for d in parsed_deficiencies:
            code = (d.get("code") or "").strip()
            desc = (d.get("description") or "").strip()
            severity_raw = d.get("severity")
            corrected = d.get("corrected")

            if not desc:
                continue

            key = _deficiency_key(inspection_id, code, desc)
            final_code = code if code else key
            severity_int = _map_wa_severity(severity_raw)
            is_ij = severity_raw and severity_raw.strip().lower() in ("ij", "immediate jeopardy")

            # Check for duplicates from previous runs
            cur.execute(
                "SELECT 1 FROM deficiencies WHERE inspection_id=%s::uuid AND code=%s",
                (inspection_id, final_code),
            )
            if cur.fetchone():
                continue

            cur.execute(
                """
                INSERT INTO deficiencies
                  (id, inspection_id, code, description, inspector_narrative,
                   state_severity_raw, severity, immediate_jeopardy)
                VALUES
                  (gen_random_uuid(), %s::uuid, %s, %s, null,
                   %s, %s, %s)
                """,
                (
                    inspection_id,
                    final_code,
                    desc,
                    severity_raw,
                    severity_int,
                    bool(is_ij),
                ),
            )
            inserted += cur.rowcount

    # Rebuild narrative in inspections.raw_data
    narrative = rebuild_narrative_from_deficiencies(parsed_deficiencies)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE inspections
            SET raw_data = jsonb_set(
                    coalesce(raw_data, '{}'::jsonb),
                    '{narrative}',
                    %s::jsonb
                )
            WHERE id = %s::uuid
            """,
            (json.dumps(narrative), inspection_id),
        )

    conn.commit()
    print(f"    Deleted {deleted} placeholders → inserted {inserted} parsed deficiencies")
    return inserted


def backfill_one(
    conn: psycopg.Connection,
    row: dict[str, Any],
    *,
    dry_run: bool = False,
) -> bool:
    """Process one wa_pdf_inventory row. Returns True on success."""
    inv_id = str(row["id"])
    local_path = row["local_path"]
    if not local_path:
        print(f"  SKIP {inv_id}: no local_path")
        return False

    sidecar = Path(local_path).with_suffix(".parsed.json")
    if not sidecar.exists():
        print(f"  SKIP {inv_id}: sidecar not found at {sidecar}")
        return False

    try:
        sidecar_data = json.loads(sidecar.read_text())
    except Exception as exc:
        print(f"  ERR {inv_id}: cannot read sidecar: {exc}", file=sys.stderr)
        return False

    parsed_defs: list[dict[str, Any]] = sidecar_data.get("deficiencies", [])
    facility_id = str(row["facility_id"])

    # We need to find the inspection_id. The source_url is stored in
    # the inventory table — fetch it.
    with conn.cursor() as cur:
        cur.execute("SELECT source_url FROM wa_pdf_inventory WHERE id=%s", (inv_id,))
        r = cur.fetchone()
    if not r:
        print(f"  ERR {inv_id}: inventory row gone", file=sys.stderr)
        return False
    source_url = r[0]

    inspection_id = find_inspection_for_pdf(conn, facility_id, source_url)
    if not inspection_id:
        print(f"  SKIP {inv_id}: no matching inspection for {source_url[:60]}")
        if not dry_run:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE wa_pdf_inventory SET backfill_status='skip', backfill_error='no matching inspection' WHERE id=%s",
                    (inv_id,),
                )
            conn.commit()
        return False

    print(f"  Backfilling inspection {inspection_id} ({len(parsed_defs)} parsed defs)")
    written = backfill_inspection(
        conn, inspection_id, parsed_defs, source_url, dry_run=dry_run
    )

    if not dry_run:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE wa_pdf_inventory SET backfill_status='done', backfilled_at=now() WHERE id=%s",
                (inv_id,),
            )
        conn.commit()

    return True


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="WA PDF backfill — Wave 1a step 3")
    parser.add_argument("--facility-id", help="Only backfill one facility UUID")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--rescore",
        action="store_true",
        help="After backfilling, run summarize_inspections.py --state WA --refetch",
    )
    args = parser.parse_args(argv)

    load_env()

    print("=== WA PDF Backfill ===")
    conn = get_conn()

    pending = get_pending_backfill(
        conn,
        args.facility_id,
        args.limit,
        os.environ.get("STATE_SCAN_STARTED_AT"),
    )
    print(f"  {len(pending)} inventory rows to backfill")

    done = 0
    errors = 0
    affected_inspections: set[str] = set()

    for row in pending:
        success = backfill_one(conn, row, dry_run=args.dry_run)
        if success:
            done += 1
        else:
            errors += 1

    print(f"\nDone: {done}  Errors: {errors}")

    if args.rescore and done > 0 and not args.dry_run:
        print("\nRe-running summarize_inspections.py --state WA --refetch …")
        summarize_script = SCRAPERS_DIR / "summarize_inspections.py"
        if summarize_script.exists():
            subprocess.run(
                [sys.executable, str(summarize_script), "--state", "WA", "--refetch"],
                check=False,
            )
        else:
            print("  WARNING: summarize_inspections.py not found", file=sys.stderr)

        print("\nRe-running recompute_publishable.py --state WA …")
        recompute_script = SCRAPERS_DIR / "recompute_publishable.py"
        if recompute_script.exists():
            subprocess.run(
                [sys.executable, str(recompute_script), "--state", "WA"],
                check=False,
            )

    conn.close()


if __name__ == "__main__":
    main()
