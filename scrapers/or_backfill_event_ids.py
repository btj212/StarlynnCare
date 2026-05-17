#!/usr/bin/env python3
"""
or_backfill_event_ids.py — One-time backfill of Event IDs into inspections.complaint_id.

Reads the OR Inspections CSV and uses a temp table + single UPDATE to backfill
complaint_id (the Event ID) for all OR inspections efficiently.

Usage:
    python3 scrapers/or_backfill_event_ids.py --input data/or_inspections.csv
    python3 scrapers/or_backfill_event_ids.py --input data/or_inspections.csv --dry-run
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import date, datetime
from pathlib import Path

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
            return


def get_conn() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set")
    return psycopg.connect(url)


def parse_date(raw: str) -> date | None:
    raw = raw.strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            pass
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_env()
    conn = get_conn()

    # Pre-load: external_id → facility uuid
    with conn.cursor() as cur:
        cur.execute("SELECT external_id, id FROM facilities WHERE state_code='OR' AND external_id IS NOT NULL")
        fac_map: dict[str, str] = {r[0]: str(r[1]) for r in cur.fetchall()}
    print(f"Loaded {len(fac_map)} OR facility IDs from DB")

    with open(args.input, newline="", encoding="utf-8-sig") as f:
        csv_rows = list(csv.DictReader(f))
    print(f"CSV rows: {len(csv_rows)}")

    # Build (facility_id, inspection_date) → event_id map
    mapping: list[tuple[str, date, str]] = []
    skipped = 0
    for row in csv_rows:
        external_id = row.get("Provider ID", "").strip()
        event_id = row.get("Event ID", "").strip()
        dt = parse_date(row.get("Date", ""))
        if not external_id or not event_id or not dt:
            skipped += 1
            continue
        fac_id = fac_map.get(external_id)
        if not fac_id:
            skipped += 1
            continue
        mapping.append((fac_id, dt, event_id))

    print(f"Valid mappings: {len(mapping)}, skipped: {skipped}")

    if args.dry_run:
        for fac_id, dt, event_id in mapping[:10]:
            print(f"  fac={fac_id[:8]}... date={dt} event_id={event_id}")
        print("  ... (dry-run, no DB writes)")
        return

    # Load into a temp table and do a single join UPDATE
    with conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TEMP TABLE _or_event_ids (
                    facility_id uuid,
                    inspection_date date,
                    event_id text
                ) ON COMMIT DROP
            """)
            cur.executemany(
                "INSERT INTO _or_event_ids VALUES (%s, %s, %s)",
                mapping,
            )
            cur.execute("""
                UPDATE inspections i
                SET complaint_id = t.event_id
                FROM _or_event_ids t
                WHERE i.facility_id = t.facility_id
                  AND i.inspection_date = t.inspection_date
                  AND i.complaint_id IS NULL
                  AND i.source_agency = 'OR-ODHS'
            """)
            updated = cur.rowcount

    print(f"Done — updated {updated} inspection rows with Event IDs")


if __name__ == "__main__":
    main()
