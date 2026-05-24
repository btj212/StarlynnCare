#!/usr/bin/env python3
"""
IL PDF Backfill — merge parsed deficiencies into the DB and re-summarize.

Reads sidecar JSON files written by il_pdf_parse.py and:
  1. Merges parsed deficiency rows (code, description, severity, fine) into the
     matching inspection row. The FOIA ingest may have already inserted stub
     deficiency rows from the Tags/Findings column; this step adds
     inspector_narrative text from the actual SOD/complaint PDF.
  2. Updates inspections.raw_data->>'narrative' from the full parsed text so
     summarize_inspections.py can produce a plain-English summary.
  3. Marks il_inspection_inventory.backfill_status='done'.
  4. Optionally re-triggers summarize_inspections.py for updated inspections.

Usage:
  python3 scrapers/il_pdf_backfill.py                   # all done-parse / pending-backfill
  python3 scrapers/il_pdf_backfill.py --limit 20
  python3 scrapers/il_pdf_backfill.py --facility-id UUID
  python3 scrapers/il_pdf_backfill.py --dry-run
  python3 scrapers/il_pdf_backfill.py --rescore         # also re-run summarize_inspections
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import psycopg
import psycopg.types.json
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent


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


def load_pending(
    conn: psycopg.Connection,
    limit: int | None,
    facility_id: str | None,
) -> list[dict[str, Any]]:
    where = (
        "parse_status = 'done' "
        "AND backfill_status = 'pending' "
        "AND local_path IS NOT NULL "
        "AND inspection_id IS NOT NULL"
    )
    params: list[Any] = []
    if facility_id:
        where += " AND facility_id = %s::uuid"
        params.append(facility_id)
    lim = f"LIMIT {int(limit)}" if limit else ""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id::text, inspection_id::text, facility_id::text,
                   license_number, local_path, sha256
            FROM il_inspection_inventory
            WHERE {where}
            ORDER BY created_at
            {lim}
            """,
            params,
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


_SEVERITY_MAP = {
    "type 1": (3, "Type 1"),
    "type1": (3, "Type 1"),
    "t1": (3, "Type 1"),
    "type 2": (2, "Type 2"),
    "type2": (2, "Type 2"),
    "t2": (2, "Type 2"),
    "type 3": (1, "Type 3"),
    "type3": (1, "Type 3"),
    "t3": (1, "Type 3"),
}


def _map_severity(raw: str | None) -> tuple[int | None, str | None]:
    if not raw:
        return None, None
    key = raw.strip().lower()
    pair = _SEVERITY_MAP.get(key)
    if pair:
        return pair
    return None, raw


def _deficiency_exists(cur: psycopg.Cursor, inspection_id: str, code: str) -> bool:
    cur.execute(
        "SELECT 1 FROM deficiencies WHERE inspection_id = %s::uuid AND code = %s LIMIT 1",
        (inspection_id, code),
    )
    return cur.fetchone() is not None


def backfill_inspection(
    conn: psycopg.Connection,
    inv_row: dict[str, Any],
    dry_run: bool = False,
) -> int:
    """
    Load the sidecar JSON and merge deficiencies into DB.
    Returns count of deficiency rows inserted.
    """
    local_path = Path(inv_row["local_path"])
    sidecar = local_path.with_suffix(".deficiencies.json")

    if not sidecar.is_file():
        print(f"    SKIP: no sidecar at {sidecar}", file=sys.stderr, flush=True)
        return 0

    with sidecar.open() as f:
        deficiencies: list[dict[str, Any]] = json.load(f)

    if not deficiencies:
        return 0

    inspection_id = inv_row["inspection_id"]
    inserted = 0

    # Build a narrative string from all deficiency descriptions for summarize_inspections.py
    narrative_parts: list[str] = []
    for d in deficiencies:
        desc = (d.get("description") or "").strip()
        code = (d.get("code") or "").strip()
        if desc:
            narrative_parts.append(f"{code}: {desc}" if code else desc)

    narrative = "\n\n".join(narrative_parts)[:12000]

    if dry_run:
        print(
            f"    [dry-run] {len(deficiencies)} deficiencies, "
            f"{len(narrative)} chars narrative",
            flush=True,
        )
        return len(deficiencies)

    with conn.cursor() as cur:
        # Update inspection narrative so summarize_inspections.py picks it up
        if narrative:
            try:
                cur.execute(
                    """
                    UPDATE inspections
                    SET raw_data = jsonb_set(
                        COALESCE(raw_data, '{}'::jsonb),
                        '{narrative}',
                        to_jsonb(%s::text)
                    )
                    WHERE id = %s::uuid
                    """,
                    (narrative, inspection_id),
                )
            except Exception as exc:
                print(f"    narrative update error: {exc}", file=sys.stderr, flush=True)

        for d in deficiencies:
            code = (d.get("code") or "").strip()[:200]
            if not code:
                import uuid as _uuid
                code = f"__il_{_uuid.uuid4().hex[:16]}"
            description = (d.get("description") or "")[:2000] or None
            sev_raw = d.get("severity")
            sev_int, sev_label = _map_severity(str(sev_raw) if sev_raw else None)
            is_repeat = bool(d.get("is_repeat"))
            fine = d.get("fine_dollars")
            corrected = d.get("corrected")
            status = "corrected" if corrected else "open"

            if _deficiency_exists(cur, inspection_id, code):
                # Row exists from FOIA ingest — update inspector_narrative if we have it
                cur.execute(
                    """
                    UPDATE deficiencies
                    SET inspector_narrative = COALESCE(inspector_narrative, %s),
                        severity = COALESCE(severity, %s),
                        state_severity_raw = COALESCE(state_severity_raw, %s)
                    WHERE inspection_id = %s::uuid AND code = %s
                    """,
                    (description, sev_int, sev_label, inspection_id, code),
                )
                continue

            sp = f"sp_il_bfdef_{code[:20].replace('.', '_').replace('(', '').replace(')', '')}"
            try:
                cur.execute(f"SAVEPOINT {sp}")
                cur.execute(
                    """
                    INSERT INTO deficiencies (
                        inspection_id, code, description,
                        severity, state_severity_raw,
                        is_repeat, civil_money_penalty, status
                    ) VALUES (
                        %s::uuid, %s, %s,
                        %s, %s,
                        %s, %s, %s
                    )
                    """,
                    (
                        inspection_id, code, description,
                        sev_int, sev_label,
                        is_repeat,
                        float(fine) if fine is not None else None,
                        status,
                    ),
                )
                cur.execute(f"RELEASE SAVEPOINT {sp}")
                inserted += 1
            except Exception as exc:
                cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                print(f"    DEF insert error {code}: {exc}", file=sys.stderr, flush=True)

    return inserted


def mark_backfill_done(conn: psycopg.Connection, inv_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE il_inspection_inventory SET
                backfill_status = 'done',
                backfilled_at   = now(),
                updated_at      = now()
            WHERE id = %s::uuid
            """,
            (inv_id,),
        )


def mark_backfill_error(conn: psycopg.Connection, inv_id: str, msg: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE il_inspection_inventory SET
                backfill_status = 'error',
                backfill_error  = %s,
                updated_at      = now()
            WHERE id = %s::uuid
            """,
            (msg[:500], inv_id),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="IL PDF backfill — merge parsed deficiencies into DB")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--facility-id")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--rescore",
        action="store_true",
        help="After backfill, re-run summarize_inspections.py for updated IL inspections",
    )
    args = parser.parse_args()

    load_env()
    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    conn = get_conn()
    rows = load_pending(conn, args.limit, args.facility_id)
    print(f"  {len(rows)} inventory rows pending backfill.", flush=True)

    total_inserted = 0
    err_count = 0
    rescored_insp_ids: list[str] = []

    for row in rows:
        inv_id = row["id"]
        lic = row["license_number"]
        print(f"  → {lic} inv={inv_id[:8]}", flush=True)
        try:
            inserted = backfill_inspection(conn, row, dry_run=args.dry_run)
            total_inserted += inserted
            if not args.dry_run:
                mark_backfill_done(conn, inv_id)
                conn.commit()
                if row.get("inspection_id"):
                    rescored_insp_ids.append(row["inspection_id"])
        except Exception as exc:
            print(f"    BACKFILL ERROR {inv_id}: {exc}", file=sys.stderr, flush=True)
            if not args.dry_run:
                mark_backfill_error(conn, inv_id, str(exc))
                conn.commit()
            err_count += 1

    conn.close()

    print(
        f"\nDone. {total_inserted} deficiencies inserted/updated, {err_count} errors.",
        flush=True,
    )

    if args.rescore and not args.dry_run:
        print("\nRe-running summarize_inspections.py --state IL …", flush=True)
        subprocess.run(
            [
                sys.executable, "-u",
                str(SCRAPERS_DIR / "summarize_inspections.py"),
                "--state", "IL",
            ],
            check=False,
        )


if __name__ == "__main__":
    main()
