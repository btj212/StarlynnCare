#!/usr/bin/env python3
"""
OR Unendorsed MC Flag — ORS 443.886(6) marketing-without-endorsement flag.

Finds OR facilities where:
  - name ILIKE '%memory care%' OR name ILIKE '%alzheimer%' OR name ILIKE '%dementia%'
  - AND mce_endorsed = false (or null)
  - AND facility_type IN ('ALF','RCF','NF','alf','rcf','nf') — these must hold MCE
  - AND license_status = 'LICENSED'

Sets unendorsed_mc_violation = true on matching rows.
This is the ORS 443.886(6) "memory care in name without endorsement" editorial flag.

Usage:
  python3 scrapers/or_flag_unendorsed_mc.py --dry-run
  python3 scrapers/or_flag_unendorsed_mc.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

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


def run(dry_run: bool) -> None:
    conn = get_conn()

    # First, clear stale flags (facilities that since received MCE endorsement)
    clear_sql = """
        UPDATE facilities
        SET unendorsed_mc_violation = false
        WHERE state_code = 'OR'
          AND mce_endorsed = true
          AND unendorsed_mc_violation = true
    """

    # Flag ORS 443.886(6) violators
    flag_sql = """
        UPDATE facilities
        SET unendorsed_mc_violation = true
        WHERE state_code = 'OR'
          AND license_status = 'LICENSED'
          AND (
               name ILIKE '%memory care%'
            OR name ILIKE '%alzheimer%'
            OR name ILIKE '%dementia%'
          )
          AND (mce_endorsed IS NULL OR mce_endorsed = false)
          AND (
               license_type ILIKE '%ALF%'
            OR license_type ILIKE '%assisted living%'
            OR license_type ILIKE '%residential care%'
            OR license_type ILIKE '%RCF%'
            OR license_type ILIKE '%nursing%'
            OR facility_type IN ('ALF', 'RCF', 'NF', 'alf', 'rcf', 'nf')
          )
    """

    if dry_run:
        with conn.cursor() as cur:
            cur.execute(clear_sql.replace("UPDATE", "SELECT count(*) FROM").replace("SET unendorsed_mc_violation = false", "").replace("WHERE", "WHERE 1=1 AND"))
            # simpler: just run a SELECT to preview
            cur.execute(
                """
                SELECT id, name, license_type
                FROM facilities
                WHERE state_code = 'OR'
                  AND license_status = 'LICENSED'
                  AND (
                       name ILIKE '%memory care%'
                    OR name ILIKE '%alzheimer%'
                    OR name ILIKE '%dementia%'
                  )
                  AND (mce_endorsed IS NULL OR mce_endorsed = false)
                  AND (
                       license_type ILIKE '%ALF%'
                    OR license_type ILIKE '%assisted living%'
                    OR license_type ILIKE '%residential care%'
                    OR license_type ILIKE '%RCF%'
                    OR license_type ILIKE '%nursing%'
                    OR facility_type IN ('ALF','RCF','NF','alf','rcf','nf')
                  )
                ORDER BY name
                """,
            )
            rows = cur.fetchall()
        print(f"  Would flag {len(rows)} facilities as ORS 443.886(6) violators:")
        for fac_id, name, ftype in rows:
            print(f"    {str(fac_id)[:8]}  {name[:50]:50s}  {ftype}")
        print("  ... (dry-run, no DB writes)")
        return

    with conn:
        with conn.cursor() as cur:
            cur.execute(clear_sql)
            cleared = cur.rowcount
        with conn.cursor() as cur:
            cur.execute(flag_sql)
            flagged = cur.rowcount
        conn.commit()

    print(f"  Done — flagged: {flagged} as ORS 443.886(6) violators, cleared: {cleared} stale flags")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Flag OR facilities with 'memory care' in name but no MCE (ORS 443.886(6))."
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_env()
    run(args.dry_run)


if __name__ == "__main__":
    main()
