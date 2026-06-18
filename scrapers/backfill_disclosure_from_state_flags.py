#!/usr/bin/env python3
"""
backfill_disclosure_from_state_flags.py — Map each state's Tier-1 government flag
into the unified `memory_care_disclosure_filed` column.

This is the cross-state extension of the CA-style §1569.627 disclosure signal:
state regulators that publish an explicit memory-care credential / contract /
endorsement / certification get mapped to the unified column so the Tier-1
signal model in `recompute_publishable.py` works for every state without
adding state-specific branches in the rest of the pipeline.

Mappings (idempotent — only sets to true, never overwrites a different source):

  OR  or_memory_care_endorsed   → 'OR DHS Memory Care Endorsement'
  WA  wa_dementia_care_contract → 'WA DSHS Dementia Care Contract'
  MN  mn_dementia_care_licensed → 'MN ALRC ALDC'
  TX  tx_alzheimer_certified    → 'TX HHSC Alzheimer Certification'
  AZ  az_memory_care_endorsed   → 'ADHS Directed Care License'

Usage:
    python3 scrapers/backfill_disclosure_from_state_flags.py
    python3 scrapers/backfill_disclosure_from_state_flags.py --state OR
    python3 scrapers/backfill_disclosure_from_state_flags.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Final

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent


# Each entry: (state_code, source_flag_column, disclosure_source_label)
STATE_MAPPINGS: Final[list[tuple[str, str, str]]] = [
    ("OR", "or_memory_care_endorsed", "OR DHS Memory Care Endorsement"),
    ("WA", "wa_dementia_care_contract", "WA DSHS Dementia Care Contract"),
    ("MN", "mn_dementia_care_licensed", "MN ALRC ALDC"),
    ("TX", "tx_alzheimer_certified", "TX HHSC Alzheimer Certification"),
    ("AZ", "az_memory_care_endorsed", "ADHS Directed Care License"),
]


def load_env() -> None:
    for n in (".env.local", ".env"):
        p = REPO_ROOT / n
        if p.is_file():
            load_dotenv(p)


def backfill_one(
    conn: psycopg.Connection,
    state_code: str,
    flag_column: str,
    source_label: str,
    dry_run: bool,
) -> tuple[int, int]:
    """Return (would_match, actually_updated)."""
    select_sql = f"""
        SELECT COUNT(*)
        FROM facilities
        WHERE state_code = %s
          AND {flag_column} = true
          AND (memory_care_disclosure_filed = false
               OR memory_care_disclosure_source IS NULL
               OR memory_care_disclosure_source <> %s)
    """
    update_sql = f"""
        UPDATE facilities
        SET memory_care_disclosure_filed = true,
            memory_care_disclosure_source = %s,
            updated_at = now()
        WHERE state_code = %s
          AND {flag_column} = true
          AND (memory_care_disclosure_filed = false
               OR memory_care_disclosure_source IS NULL
               OR memory_care_disclosure_source <> %s)
    """

    with conn.cursor() as cur:
        cur.execute(select_sql, (state_code, source_label))
        would = cur.fetchone()[0] or 0

        if dry_run:
            return (would, 0)

        cur.execute(update_sql, (source_label, state_code, source_label))
        updated = cur.rowcount

    return (would, updated)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", choices=[m[0] for m in STATE_MAPPINGS], help="One state only")
    parser.add_argument("--dry-run", action="store_true", help="Print what would change")
    args = parser.parse_args()

    load_env()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    targets = [m for m in STATE_MAPPINGS if (args.state is None or m[0] == args.state)]

    with psycopg.connect(dsn) as conn:
        total_would = 0
        total_updated = 0
        for state_code, flag_column, source_label in targets:
            would, updated = backfill_one(
                conn, state_code, flag_column, source_label, args.dry_run
            )
            total_would += would
            total_updated += updated
            tag = "[dry-run]" if args.dry_run else ""
            print(
                f"  {state_code} ({flag_column}) -> '{source_label}': "
                f"would_match={would}, updated={updated} {tag}"
            )

        if not args.dry_run:
            conn.commit()

    print(f"\nTotals: would_match={total_would}, updated={total_updated}")


if __name__ == "__main__":
    main()
