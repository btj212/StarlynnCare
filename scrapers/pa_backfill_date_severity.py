#!/usr/bin/env python3
"""
PA Backfill Date + Severity — one-off remediation script.

Patches cited_date and state_severity_raw on existing PA deficiency rows.
The original pa_pdf_backfill.py INSERT did not write these two columns.
This script re-reads each *.deficiencies.json sidecar and issues batched
UPDATE statements to fill in the missing values.

Idempotent: only patches rows where cited_date IS NULL or state_severity_raw
IS NULL, matching on (inspection_id, code) — the uniqueness key from backfill.

Usage:
  python3 -u scrapers/pa_backfill_date_severity.py --dry-run  # count only, no writes
  python3 -u scrapers/pa_backfill_date_severity.py            # apply updates
  python3 -u scrapers/pa_backfill_date_severity.py --limit 500
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
_BATCH = 500   # rows per executemany batch
_PROGRESS_EVERY = 1000


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
            return


def get_dsn() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        sys.exit("ERROR: DATABASE_URL or POSTGRES_URL not set")
    return url


def parse_date_str(raw: str | None) -> date | None:
    if not raw:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            pass
    return None


def flush_batch(
    conn: psycopg.Connection,
    batch: list[dict[str, Any]],
    dry_run: bool,
) -> int:
    if not batch:
        return 0
    if dry_run:
        return len(batch)
    with conn.cursor() as cur:
        cur.executemany(
            """
            UPDATE deficiencies
            SET
              cited_date        = COALESCE(cited_date,        %(cited_date)s),
              state_severity_raw = COALESCE(state_severity_raw, %(state_severity_raw)s)
            WHERE inspection_id = %(inspection_id)s
              AND code           = %(code)s
              AND (cited_date IS NULL OR state_severity_raw IS NULL)
            """,
            batch,
        )
    conn.commit()
    return len(batch)


def run(dry_run: bool, limit: int | None) -> None:
    dsn = get_dsn()
    limit_sql = f"LIMIT {limit}" if limit else ""

    with psycopg.connect(dsn) as fetch_conn:
        with fetch_conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, local_path, inspection_id
                FROM pa_pdf_inventory
                WHERE parse_status    = 'done'
                  AND backfill_status = 'done'
                  AND local_path IS NOT NULL
                  AND inspection_id IS NOT NULL
                ORDER BY created_at
                {limit_sql}
                """
            )
            rows = cur.fetchall()

    n_inv = len(rows)
    print(f"  {n_inv} PDF inventory rows to process", flush=True)

    total_pairs = 0     # deficiency rows with usable date/severity
    total_updated = 0
    total_skipped = 0   # sidecar deficiencies with no date AND no severity
    total_errors = 0

    batch: list[dict[str, Any]] = []

    with psycopg.connect(dsn, autocommit=False) as conn:
        for idx, (inv_id, local_path, inspection_id) in enumerate(rows, 1):
            pdf_path = Path(local_path)
            sidecar = pdf_path.parent / f"{pdf_path.stem}.deficiencies.json"

            if not sidecar.exists():
                total_errors += 1
                print(f"  WARN sidecar missing: {sidecar}", flush=True)
                continue

            try:
                text = sidecar.read_text(encoding="utf-8")
                deficiencies: list[dict[str, Any]] = json.loads(text)
            except Exception as exc:
                total_errors += 1
                print(f"  WARN sidecar error {str(inv_id)[:8]}: {exc}", flush=True)
                continue

            for d in deficiencies:
                code = d.get("code") or None
                sev_raw = d.get("severity") or None
                cited_date = parse_date_str(d.get("date"))

                if not code:
                    total_skipped += 1
                    continue
                if cited_date is None and sev_raw is None:
                    total_skipped += 1
                    continue

                total_pairs += 1
                batch.append(
                    {
                        "inspection_id": str(inspection_id),
                        "code": code,
                        "cited_date": cited_date,
                        "state_severity_raw": sev_raw,
                    }
                )

                if len(batch) >= _BATCH:
                    total_updated += flush_batch(conn, batch, dry_run)
                    batch = []

            if idx % _PROGRESS_EVERY == 0:
                print(
                    f"  {idx}/{n_inv} inventory rows done; "
                    f"{total_pairs} pairs queued; {total_updated} written so far",
                    flush=True,
                )

        # Final flush
        total_updated += flush_batch(conn, batch, dry_run)

    verb = "would update" if dry_run else "updated"
    print(
        f"\n  {verb} {total_updated} deficiency rows "
        f"({total_pairs} pairs found, {total_skipped} skipped, {total_errors} errors)",
        flush=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill cited_date + state_severity_raw on existing PA deficiency rows."
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    load_env()
    run(args.dry_run, args.limit)


if __name__ == "__main__":
    main()
