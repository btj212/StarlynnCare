#!/usr/bin/env python3
"""
Recompute serves_memory_care and publishable flags from tiered signal model.

Background
----------
This script runs SQL steps for the tiered signal model (Option C for directories):

1. Recompute serves_memory_care (gov/chain tier-1, or APFM ∩ Caring, or manual publish)
2. Recompute publishable from serves_memory_care + license + review status
4. Promote needs_review → auto_published when Option C tier-1 appears
3a. Mark chain-name-only matches as needs_review
3b. Mark single-directory-only (APFM XOR Caring) as needs_review

The script is idempotent and safe to re-run. It should be run after:
- ccld_rcfe_ingest.py (writes signal flags)
- mc_disclosure_ingest.py (Strategy A sets memory_care_disclosure_filed)

And before:
- summarize_inspections.py (so summaries only run for newly publishable rows)

Usage
-----
    python recompute_publishable.py --dry-run     # print what would change
    python recompute_publishable.py               # write to DB
    python recompute_publishable.py --state CA    # specific state (default: CA)
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STATE_CODE = "CA"


# ---------------------------------------------------------------------------
# Env
# ---------------------------------------------------------------------------


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ---------------------------------------------------------------------------
# Recompute logic
# ---------------------------------------------------------------------------


def get_before_counts(conn: psycopg.Connection, state_code: str) -> dict[str, int]:
    """Get before counts for reporting."""
    sql = """
        SELECT 
            COUNT(*) FILTER (WHERE serves_memory_care = true) as serves_mc_before,
            COUNT(*) FILTER (WHERE publishable = true) as publishable_before,
            COUNT(*) FILTER (WHERE mc_review_status = 'needs_review') as needs_review_before
        FROM facilities 
        WHERE state_code = %s AND license_status = 'LICENSED'
    """
    
    with conn.cursor() as cur:
        cur.execute(sql, (state_code,))
        row = cur.fetchone()
        
    return {
        "serves_mc_before": row[0] if row else 0,
        "publishable_before": row[1] if row else 0, 
        "needs_review_before": row[2] if row else 0,
    }


def get_after_counts(conn: psycopg.Connection, state_code: str) -> dict[str, int]:
    """Get after counts for reporting."""
    sql = """
        SELECT 
            COUNT(*) FILTER (WHERE serves_memory_care = true) as serves_mc_after,
            COUNT(*) FILTER (WHERE publishable = true) as publishable_after,
            COUNT(*) FILTER (WHERE mc_review_status = 'needs_review') as needs_review_after
        FROM facilities 
        WHERE state_code = %s AND license_status = 'LICENSED'
    """
    
    with conn.cursor() as cur:
        cur.execute(sql, (state_code,))
        row = cur.fetchone()
        
    return {
        "serves_mc_after": row[0] if row else 0,
        "publishable_after": row[1] if row else 0,
        "needs_review_after": row[2] if row else 0,
    }


def recompute_serves_memory_care(
    conn: psycopg.Connection, 
    state_code: str, 
    dry_run: bool = False
) -> int:
    """
    Recompute serves_memory_care from Tier 1 signals + manual approvals.
    Returns count of rows updated.
    """
    # Option C: directories count only when BOTH APFM and Caring agree (plus gov/chain tier-1).
    sql = """
        UPDATE facilities
        SET serves_memory_care = (
             mc_signal_explicit_name
          OR memory_care_disclosure_filed
          OR mc_signal_chain_curated
          OR (mc_signal_apfm_listed AND mc_signal_caring_listed)
          OR mc_review_status = 'reviewed_publish'
        )
        WHERE state_code = %s
    """
    
    if dry_run:
        print("  Step 1: Would recompute serves_memory_care from Tier 1 signals + manual approvals")
        return 0
    
    with conn.cursor() as cur:
        cur.execute(sql, (state_code,))
        return cur.rowcount


def recompute_publishable(
    conn: psycopg.Connection, 
    state_code: str, 
    dry_run: bool = False
) -> int:
    """
    Recompute publishable from serves_memory_care + license status + review status.
    Returns count of rows updated.
    """
    sql = """
        UPDATE facilities 
        SET publishable = (
          license_status = 'LICENSED'
          AND serves_memory_care = true
          AND mc_review_status <> 'reviewed_reject'
        )
        WHERE state_code = %s
    """
    
    if dry_run:
        print("  Step 2: Would recompute publishable from serves_memory_care + license + review status")
        return 0
    
    with conn.cursor() as cur:
        cur.execute(sql, (state_code,))
        return cur.rowcount


def mark_chain_only_for_review(
    conn: psycopg.Connection, 
    state_code: str, 
    dry_run: bool = False
) -> int:
    """
    Mark chain-only matches as needing review (only if not already adjudicated).
    Returns count of rows updated.
    """
    sql = """
        UPDATE facilities
        SET mc_review_status = 'needs_review'
        WHERE state_code = %s
          AND license_status = 'LICENSED'
          AND mc_signal_chain_name = true
          AND NOT mc_signal_explicit_name
          AND NOT memory_care_disclosure_filed
          AND NOT mc_signal_chain_curated
          AND NOT (mc_signal_apfm_listed AND mc_signal_caring_listed)
          AND mc_review_status NOT IN ('reviewed_publish','reviewed_reject')
    """
    
    if dry_run:
        print("  Step 3a: Would mark chain-only matches as needs_review (preserving manual decisions)")
        return 0
    
    with conn.cursor() as cur:
        cur.execute(sql, (state_code,))
        return cur.rowcount


def mark_single_directory_for_review(
    conn: psycopg.Connection,
    state_code: str,
    dry_run: bool = False,
) -> int:
    """
    Queue LICENSED facilities whose only corroboration is a single directory listing.
    Option C requires APFM ∩ Caring for auto tier-1; XOR directories need human review.
    """
    sql = """
        UPDATE facilities
        SET mc_review_status = 'needs_review'
        WHERE state_code = %s
          AND license_status = 'LICENSED'
          AND (mc_signal_apfm_listed OR mc_signal_caring_listed)
          AND NOT (mc_signal_apfm_listed AND mc_signal_caring_listed)
          AND NOT mc_signal_explicit_name
          AND NOT memory_care_disclosure_filed
          AND NOT mc_signal_chain_curated
          AND NOT mc_signal_deficiency_keyword
          AND mc_review_status NOT IN ('reviewed_publish','reviewed_reject')
    """

    if dry_run:
        print("  Step 3b: Would mark single-directory-only rows as needs_review")
        return 0

    with conn.cursor() as cur:
        cur.execute(sql, (state_code,))
        return cur.rowcount


def promote_queue_with_tier1_signals(
    conn: psycopg.Connection,
    state_code: str,
    dry_run: bool = False,
) -> int:
    """
    Demote `needs_review` -> `auto_published` when a facility has acquired a
    Tier 1 signal (explicit name, disclosure, or chain_curated). This handles
    the case where a backfill or earlier ingest stamped `needs_review` and a
    later strong signal arrived.
    """
    sql = """
        UPDATE facilities
        SET mc_review_status = 'auto_published'
        WHERE state_code = %s
          AND license_status = 'LICENSED'
          AND mc_review_status = 'needs_review'
          AND (
                mc_signal_explicit_name
             OR memory_care_disclosure_filed
             OR mc_signal_chain_curated
             OR (mc_signal_apfm_listed AND mc_signal_caring_listed)
          )
    """

    if dry_run:
        print("  Step 4: Would promote needs_review facilities that now have Option C Tier-1 signal")
        return 0

    with conn.cursor() as cur:
        cur.execute(sql, (state_code,))
        return cur.rowcount


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Recompute serves_memory_care and publishable flags from tiered signal model. "
            "Run after ingest + mc_disclosure_ingest, before summarize_inspections."
        )
    )
    parser.add_argument(
        "--state",
        default=DEFAULT_STATE_CODE,
        help=f"State code to recompute (default: {DEFAULT_STATE_CODE})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be updated; do not write to DB.",
    )
    args = parser.parse_args()

    load_env()

    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print(
            "DATABASE_URL is not set. Add your Supabase Postgres URI to .env.local.",
            file=sys.stderr,
        )
        sys.exit(1)

    dsn = os.environ.get("DATABASE_URL", "")

    with psycopg.connect(dsn) as conn:
        print(f"Recomputing publishable flags for state: {args.state}")
        
        # Get before counts
        before = get_before_counts(conn, args.state)
        print(f"\nBefore counts (LICENSED facilities only):")
        print(f"  serves_memory_care = true:  {before['serves_mc_before']:>4}")  
        print(f"  publishable = true:         {before['publishable_before']:>4}")
        print(f"  mc_review_status = needs_review: {before['needs_review_before']:>4}")
        
        if args.dry_run:
            print(f"\n--- Dry-run mode ---")
        
        # Execute the recompute steps in order. Step 4 (promote) runs BEFORE
        # step 3 (queue chain-only) so promotions don't get re-queued in the
        # same run.
        step1_updated = recompute_serves_memory_care(conn, args.state, args.dry_run)
        step2_updated = recompute_publishable(conn, args.state, args.dry_run)
        step4_updated = promote_queue_with_tier1_signals(conn, args.state, args.dry_run)
        step3a_updated = mark_chain_only_for_review(conn, args.state, args.dry_run)
        step3b_updated = mark_single_directory_for_review(conn, args.state, args.dry_run)

        if not args.dry_run:
            conn.commit()
            
            # Get after counts
            after = get_after_counts(conn, args.state)
            print(f"\nAfter counts (LICENSED facilities only):")
            print(f"  serves_memory_care = true:  {after['serves_mc_after']:>4} (Δ{after['serves_mc_after'] - before['serves_mc_before']:+})")
            print(f"  publishable = true:         {after['publishable_after']:>4} (Δ{after['publishable_after'] - before['publishable_before']:+})")  
            print(f"  mc_review_status = needs_review: {after['needs_review_after']:>4} (Δ{after['needs_review_after'] - before['needs_review_before']:+})")
            
            total_rows_touched = (
                step1_updated
                + step2_updated
                + step3a_updated
                + step3b_updated
                + step4_updated
            )
            print(
                f"\nTotal database rows touched: {total_rows_touched} "
                f"(step4 promote: {step4_updated}, step3a chain-only: {step3a_updated}, "
                f"step3b single-dir: {step3b_updated})"
            )
        else:
            print(f"\nDry-run complete. No changes made to database.")


if __name__ == "__main__":
    main()