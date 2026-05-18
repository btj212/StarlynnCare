#!/usr/bin/env python3
"""
ut_ccl_narrative_backfill.py — Backfill inspector_narrative + plan_of_correction
onto existing Utah deficiency rows using the CCL JSON API's findingText and
correctionAction fields (already available but previously ignored).

Also writes a combined inspection-level narrative into inspections.raw_data so
summarize_inspections.py --state UT can generate plain-English summaries.

Safe to re-run: UPDATEs are idempotent (only writes where inspector_narrative IS NULL).

Usage:
    python3 scrapers/ut_ccl_narrative_backfill.py --smoke      # 5 facilities
    python3 scrapers/ut_ccl_narrative_backfill.py --dry-run    # no DB writes
    python3 scrapers/ut_ccl_narrative_backfill.py              # all UT facilities
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any

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
        sys.exit("DATABASE_URL or SUPABASE_DB_URL not set.")
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


def _insp_type(types_str: str | None) -> str:
    raw = (types_str or "").lower()
    if "complaint" in raw:
        return "complaint"
    return "annual"


def fetch_facility_detail(ccl_id: int) -> dict | None:
    url = f"{CCL_BASE}/facilities/{ccl_id}"
    try:
        r = _SESSION.get(url, timeout=20)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()
    except requests.RequestException as exc:
        print(f"  API ERROR {ccl_id}: {exc}", flush=True)
        return None


def load_target_facilities(conn: psycopg.Connection) -> list[dict]:
    """Only return UT facilities that already have UT-CCL inspection rows (the backfill target)."""
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


def get_inspection_id(conn: psycopg.Connection, facility_id: str, insp_date: date, insp_type: str) -> str | None:
    """Find the DB inspection row matching facility + date + type."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id FROM inspections
            WHERE facility_id = %s
              AND inspection_date = %s
              AND source_agency = 'UT-CCL'
            ORDER BY created_at
            LIMIT 1
            """,
            (facility_id, insp_date),
        )
        row = cur.fetchone()
        return row[0] if row else None


def backfill_deficiency(conn: psycopg.Connection, inspection_id: str, code: str,
                        narrative: str | None, poc: str | None, dry_run: bool) -> int:
    """UPDATE existing deficiency rows for this inspection+code with narrative fields.
    Only updates rows where inspector_narrative IS NULL to avoid overwriting richer data.
    Returns number of rows updated.
    """
    if dry_run or not (narrative or poc):
        return 0
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE deficiencies
            SET inspector_narrative = COALESCE(%s, inspector_narrative),
                plan_of_correction   = COALESCE(%s, plan_of_correction)
            WHERE inspection_id = %s
              AND code = %s
              AND inspector_narrative IS NULL
            """,
            (narrative, poc, inspection_id, code),
        )
        return cur.rowcount


def write_raw_data_narrative(conn: psycopg.Connection, inspection_id: str,
                             combined_narrative: str, dry_run: bool) -> None:
    """Merge the combined findingText narrative into inspections.raw_data->>'narrative'."""
    if dry_run or not combined_narrative.strip():
        return
    with conn.cursor() as cur:
        # Only write if raw_data narrative not already set (avoids overwriting richer data)
        cur.execute(
            """
            UPDATE inspections
            SET raw_data = COALESCE(raw_data, '{}'::jsonb) || jsonb_build_object('narrative', %s::text)
            WHERE id = %s
              AND (raw_data IS NULL OR raw_data->>'narrative' IS NULL OR raw_data->>'narrative' = '')
            """,
            (combined_narrative, inspection_id),
        )


def process_facility(conn: psycopg.Connection, facility: dict, detail: dict, dry_run: bool) -> tuple[int, int]:
    """Process one facility's CCL API response. Returns (def_updated, insp_updated)."""
    facility_id = str(facility["id"])
    inspections = detail.get("inspections") or []
    def_updated = 0
    insp_updated = 0

    for insp in inspections:
        insp_date = _parse_date(insp.get("inspectionDate"))
        if not insp_date:
            continue

        insp_type = _insp_type(insp.get("inspectionTypes"))
        findings = insp.get("findings") or []

        inspection_id = get_inspection_id(conn, facility_id, insp_date, insp_type)
        if not inspection_id:
            continue

        # Build combined inspection-level narrative from all findingText blocks
        narrative_parts: list[str] = []

        for finding in findings:
            code = str(finding.get("ruleNumber") or f"UT-{finding.get('ruleId', 'UNK')}")
            finding_text = (finding.get("findingText") or "").strip()
            correction = (finding.get("correctionAction") or "").strip()

            if finding_text:
                narrative_parts.append(f"[{code}] {finding_text}")

            n = backfill_deficiency(conn, inspection_id, code,
                                    finding_text or None, correction or None, dry_run)
            def_updated += n

        # Write combined narrative to inspections.raw_data
        if narrative_parts:
            combined = "\n\n".join(narrative_parts)
            if dry_run:
                print(f"    [DRY] Would write {len(combined)} chars to insp raw_data")
            else:
                write_raw_data_narrative(conn, inspection_id, combined, dry_run=False)
                insp_updated += 1

    return def_updated, insp_updated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="Only process first 5 facilities")
    parser.add_argument("--dry-run", action="store_true", help="No DB writes")
    args = parser.parse_args()

    load_env()
    db_url = get_db_url()

    with psycopg.connect(db_url) as conn:
        facilities = load_target_facilities(conn)
        if args.smoke:
            facilities = facilities[:5]

        print(f"Facilities to process: {len(facilities)}", flush=True)

        total_def = 0
        total_insp = 0
        errors = 0

        for i, fac in enumerate(facilities, 1):
            ccl_id = external_id_to_ccl_id(fac["external_id"])
            if not ccl_id:
                print(f"  [{i}/{len(facilities)}] SKIP {fac['name']} — cannot parse CCL id from {fac['external_id']}")
                continue

            print(f"  [{i}/{len(facilities)}] {fac['name']} (CCL {ccl_id})", flush=True)
            detail = fetch_facility_detail(ccl_id)
            time.sleep(REQUEST_DELAY)

            if not detail:
                print(f"    API returned nothing")
                errors += 1
                continue

            d, ins = process_facility(conn, fac, detail, dry_run=args.dry_run)

            if not args.dry_run:
                conn.commit()

            print(f"    deficiencies updated={d}  inspections raw_data written={ins}", flush=True)
            total_def += d
            total_insp += ins

        print(f"\nDone. deficiencies updated: {total_def}  inspections: {total_insp}  errors: {errors}")
        if args.dry_run:
            print("(dry-run — no DB writes)")


if __name__ == "__main__":
    main()
