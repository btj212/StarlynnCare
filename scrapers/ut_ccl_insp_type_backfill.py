#!/usr/bin/env python3
"""
ut_ccl_insp_type_backfill.py — Correct inspection_type on existing UT-CCL rows.

The original scraper mapped all non-complaint types to "annual". This script
re-fetches the CCL API per facility and updates inspection rows to the correct
type (follow-up, monitoring, focused, initial, etc.).

Safe to re-run: only updates rows where inspection_type = 'annual' AND the
re-mapped type is different (keeps genuine annual inspections unchanged).

Usage:
    python3 scrapers/ut_ccl_insp_type_backfill.py --smoke   # 5 facilities
    python3 scrapers/ut_ccl_insp_type_backfill.py --dry-run
    python3 scrapers/ut_ccl_insp_type_backfill.py
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from datetime import date
from pathlib import Path

import psycopg
import psycopg.rows
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
CCL_BASE = "https://cclapi.dlbc.utah.gov/api/public"
REQUEST_DELAY = 0.4

_SESSION = requests.Session()
_SESSION.headers.update({"User-Agent": "Mozilla/5.0", "Accept": "application/json"})


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def get_db_url() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit("DATABASE_URL not set.")
    return url


def external_id_to_ccl_id(external_id: str) -> int | None:
    m = re.match(r"[A-Z]\d+-(\d+)", external_id or "")
    return int(m.group(1)) if m else None


def _parse_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except (ValueError, TypeError):
        return None


def _insp_type(types_str: str | None) -> tuple[str, bool]:
    raw = (types_str or "").lower()
    is_complaint = "complaint" in raw or "investigation" in raw
    if "annual" in raw or "federal survey" in raw or "licensure" in raw or "recertification" in raw:
        itype = "annual"
    elif "follow-up" in raw or "follow up" in raw:
        itype = "follow-up"
    elif "monitoring" in raw:
        itype = "monitoring"
    elif "focus" in raw:
        itype = "focused"
    elif "initial" in raw:
        itype = "initial"
    elif is_complaint:
        itype = "complaint"
    else:
        itype = "inspection"
    return itype, is_complaint


def fetch_facility_detail(ccl_id: int) -> dict | None:
    try:
        r = _SESSION.get(f"{CCL_BASE}/facilities/{ccl_id}", timeout=20)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()
    except requests.RequestException as exc:
        print(f"  API ERROR {ccl_id}: {exc}", flush=True)
        return None


def load_target_facilities(conn: psycopg.Connection) -> list[dict]:
    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(
            """
            SELECT DISTINCT f.id, f.external_id, f.name
            FROM facilities f
            JOIN inspections i ON i.facility_id = f.id
            WHERE f.state_code = 'UT'
              AND f.external_id IS NOT NULL
              AND i.source_agency = 'UT-CCL'
            ORDER BY f.name
            """
        )
        return cur.fetchall()


def backfill_insp_types(conn: psycopg.Connection, facility_id: str, detail: dict, dry_run: bool) -> tuple[int, int]:
    """Re-map inspection_type for this facility's CCL inspections.
    Returns (checked, updated).
    """
    inspections = detail.get("inspections") or []
    checked = 0
    updated = 0

    with conn.cursor() as cur:
        for insp in inspections:
            insp_date = _parse_date(insp.get("inspectionDate"))
            if not insp_date:
                continue
            correct_type, is_complaint = _insp_type(insp.get("inspectionTypes"))
            checked += 1

            if correct_type == "annual":
                continue  # was already correct, skip

            if dry_run:
                print(
                    f"    [DRY] {insp_date} '{insp.get('inspectionTypes')}' → {correct_type}"
                )
                updated += 1
                continue

            # UPDATE rows that currently have inspection_type='annual' for this date.
            # The unique constraint (facility_id, inspection_date, inspection_type, source_agency)
            # means we can only rename if the target type doesn't already exist for that date.
            # In practice all UT-CCL rows were ingested as 'annual', so conflicts are unlikely.
            try:
                cur.execute(
                    """
                    UPDATE inspections
                    SET inspection_type = %s,
                        is_complaint    = %s
                    WHERE facility_id    = %s
                      AND inspection_date = %s
                      AND inspection_type = 'annual'
                      AND source_agency   = 'UT-CCL'
                    """,
                    (correct_type, is_complaint, facility_id, insp_date),
                )
                if cur.rowcount:
                    updated += cur.rowcount
            except Exception as exc:
                print(f"    UPDATE ERROR {insp_date}: {exc}", flush=True)
                conn.rollback()

    return checked, updated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_env()
    db_url = get_db_url()

    with psycopg.connect(db_url) as conn:
        facilities = load_target_facilities(conn)
        if args.smoke:
            facilities = facilities[:5]

        print(f"Facilities to process: {len(facilities)}", flush=True)
        total_checked = 0
        total_updated = 0
        errors = 0

        for i, fac in enumerate(facilities, 1):
            ccl_id = external_id_to_ccl_id(fac["external_id"])
            if not ccl_id:
                continue
            print(f"  [{i}/{len(facilities)}] {fac['name']} (CCL {ccl_id})", flush=True)
            detail = fetch_facility_detail(ccl_id)
            time.sleep(REQUEST_DELAY)
            if not detail:
                errors += 1
                continue

            chk, upd = backfill_insp_types(conn, str(fac["id"]), detail, dry_run=args.dry_run)
            if not args.dry_run:
                conn.commit()
            print(f"    checked={chk}  updated={upd}", flush=True)
            total_checked += chk
            total_updated += upd

        print(f"\nDone. checked={total_checked}  updated={total_updated}  errors={errors}")
        if args.dry_run:
            print("(dry-run — no DB writes)")


if __name__ == "__main__":
    main()
