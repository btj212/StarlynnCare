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
    python recompute_publishable.py --state CA    # California (default)
    python recompute_publishable.py --state TX    # Texas publish gate (Alz cert + inspection freshness)
    python recompute_publishable.py --state OR    # Oregon endorsement + inspection freshness
    python recompute_publishable.py --state MN    # Minnesota dementia-care flag + freshness
    python recompute_publishable.py --state WA    # Washington dementia contract + freshness
    python recompute_publishable.py --state UT    # Utah SECURE_BEDS > 0 gate + freshness
    python recompute_publishable.py --state IL    # Illinois il_dementia_program_flag OR il_mc_name_match + freshness
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
    dry_run: bool = False,
) -> int:
    """
    Recompute serves_memory_care using the unified Option C tier-1 signal model.

    Core signals (all states):
      - mc_signal_explicit_name: name keywords ("memory care", "Alzheimer", "dementia")
      - memory_care_disclosure_filed: government regulatory confirmation filed
      - mc_signal_chain_curated: hand-verified chain match (APFM, SH, Benchmark, etc.)
      - mc_signal_apfm_listed AND mc_signal_caring_listed: both major directories agree
      - mc_review_status = 'reviewed_publish': manually adjudicated by admin

    Additional state-specific Tier-1 signals (override for each state):
      - WA: wa_dementia_care_contract — DSHS Dementia Care contract (already maps to
             memory_care_disclosure_filed=true in wa_dshs_directory_ingest.py, kept here
             as belt-and-suspenders)
      - OR: mce_endorsed — ORS 443.886 Memory Care Endorsement (set by or_signal_mce.py)
            unendorsed_mc_violation — ORS 443.886(6) "memory care name without endorsement"
            bucket; surfaces these facilities as an editorial signal even without MCE.
      - MN: mn_dementia_care_licensed — MDH ALDC license
      - TX: tx_alzheimer_certified — HHSC Alzheimer Certification
    """
    sql = """
        UPDATE facilities
        SET serves_memory_care = COALESCE(
             COALESCE(mc_signal_explicit_name, false)
          OR COALESCE(memory_care_disclosure_filed, false)
          OR COALESCE(mc_signal_chain_curated, false)
          OR (COALESCE(mc_signal_apfm_listed, false) AND COALESCE(mc_signal_caring_listed, false))
          OR (mc_review_status = 'reviewed_publish')
          -- State-specific Tier-1 signals
          OR (state_code = 'WA' AND COALESCE(wa_dementia_care_contract, false))
          OR (state_code = 'WA' AND COALESCE(wa_memory_care_certified, false))
          OR (state_code = 'WA' AND COALESCE(wa_earc_sdc_contracted, false))
          OR (state_code = 'WA' AND COALESCE(wa_dementia_specialty, false))
          -- OR: only the state-issued MCE endorsement qualifies as a Tier-1 signal.
          -- unendorsed_mc_violation is a warning flag — it must NOT set serves_memory_care.
          OR (state_code = 'OR' AND COALESCE(mce_endorsed, false))
          OR (state_code = 'MN' AND COALESCE(mn_dementia_care_licensed, false))
          OR (state_code = 'TX' AND COALESCE(tx_alzheimer_certified, false))
          -- UT: SECURE_BEDS > 0 is the statutory primary signal (R432-270-16 Secure Units).
          -- Set directly by ut_arcgis_facilities_ingest.py; this is belt-and-suspenders.
          OR (state_code = 'UT' AND COALESCE(secure_beds, 0) > 0)
          -- IL: either portal-confirmed dementia program (Tier 2) or name-match (Tier 1).
          -- mc_signal_explicit_name already fires on name keywords, but these two
          -- IL-specific columns give per-column auditability for future review.
          OR (state_code = 'IL' AND COALESCE(il_dementia_program_flag, false))
          OR (state_code = 'IL' AND COALESCE(il_mc_name_match, false))
        , false)
        WHERE state_code = %s
    """

    if dry_run:
        print("  Step 1: Would recompute serves_memory_care from unified Option C + state-specific Tier-1 signals")
        return 0

    with conn.cursor() as cur:
        cur.execute(sql, (state_code,))
        return cur.rowcount


# Freshness gate per state (months). CA has no freshness gate — CDSS is comprehensive.
# UT: 36 months — public portal only exposes last 36 months; also matches the coverage
#     window (records only go back to October 2023). Facilities with no inspections in
#     this window are not yet inspectable via public data and should not be published.
_FRESHNESS_MONTHS: dict[str, int | None] = {
    "CA": None,
    "TX": 48,
    "OR": 36,
    "MN": 48,
    "WA": 48,
    "UT": 36,
    # IL: FOIA window is Jan 2024 – May 2026; 36 months matches OR gate and keeps
    # the publishable set fresh. Facilities with no events in 36 months are stale.
    "IL": 36,
}


def recompute_publishable(
    conn: psycopg.Connection,
    state_code: str,
    dry_run: bool = False,
) -> int:
    """
    Recompute publishable from serves_memory_care + license status + review status.

    For non-CA states a freshness override is applied: at least one inspection must
    exist within _FRESHNESS_MONTHS months. This ensures we don't surface stale or
    data-shallow facilities while the CA-style signal model promotes them.
    """
    freshness_months = _FRESHNESS_MONTHS.get(state_code.upper())

    if freshness_months is not None:
        freshness_clause = f"""
          AND EXISTS (
            SELECT 1 FROM inspections i
            WHERE i.facility_id = facilities.id
              AND i.inspection_date >= (CURRENT_DATE - INTERVAL '{freshness_months} months')
          )"""
    else:
        freshness_clause = ""

    # Geocode gate removed for OR: the CSV has addresses but not lat/lng.
    # Geocoding runs as a separate pass; we publish state-endorsed facilities
    # on the state's signal, not our own derived coordinates.
    geocode_clause = ""

    sql = f"""
        UPDATE facilities
        SET publishable = (
          license_status = 'LICENSED'
          AND serves_memory_care = true
          AND mc_review_status <> 'reviewed_reject'
          {freshness_clause}{geocode_clause}
        )
        WHERE state_code = %s
    """

    if dry_run:
        gate = f"+ ≥1 inspection in {freshness_months} months" if freshness_months else "(no freshness gate)"
        print(f"  Step 2: Would recompute publishable from serves_memory_care + license + review_status {gate}")
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


# Legacy constants — kept for reference; freshness logic now lives in _FRESHNESS_MONTHS
TX_PUBLISH_GATE_MONTHS = 48
OR_PUBLISH_GATE_MONTHS = 36
MN_PUBLISH_GATE_MONTHS = 48
WA_PUBLISH_GATE_MONTHS = 48


def recompute_has_inspection_text(
    conn: psycopg.Connection,
    state_code: str,
    dry_run: bool = False,
) -> int:
    """
    Set facilities.has_inspection_text based on whether any inspection in the
    freshness window has real parsed narrative text (not a WA placeholder).

    Uses the same SQL helper (inspection_has_real_narrative) that the audit
    script uses, keeping definitions in sync. Does NOT change publishable.

    Returns count of rows updated.
    """
    freshness_months = _FRESHNESS_MONTHS.get(state_code.upper())
    if freshness_months is not None:
        freshness_clause = f"AND i.inspection_date >= (CURRENT_DATE - INTERVAL '{freshness_months} months')"
    else:
        freshness_clause = ""

    sql = f"""
        UPDATE facilities
        SET has_inspection_text = EXISTS (
            SELECT 1
            FROM inspections i
            WHERE i.facility_id = facilities.id
              {freshness_clause}
              AND inspection_has_real_narrative(i.id)
        )
        WHERE state_code = %s
    """

    if dry_run:
        print(f"  Step 5: Would recompute has_inspection_text for {state_code} facilities")
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

        step1_updated = 0
        step2_updated = 0
        step4_updated = 0
        step3a_updated = 0
        step3b_updated = 0

        # Unified path for all states (Option C tier model + state-specific freshness gate).
        # Step 4 (promote) runs BEFORE step 3 (queue chain-only) so promotions
        # don't get re-queued in the same run.
        step1_updated = recompute_serves_memory_care(conn, args.state, args.dry_run)
        step2_updated = recompute_publishable(conn, args.state, args.dry_run)
        step4_updated = promote_queue_with_tier1_signals(conn, args.state, args.dry_run)
        step3a_updated = mark_chain_only_for_review(conn, args.state, args.dry_run)
        step3b_updated = mark_single_directory_for_review(conn, args.state, args.dry_run)
        step5_updated = recompute_has_inspection_text(conn, args.state, args.dry_run)

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
                + step5_updated
            )
            print(
                f"\nTotal database rows touched: {total_rows_touched} "
                f"(step4 promote: {step4_updated}, step3a chain-only: {step3a_updated}, "
                f"step3b single-dir: {step3b_updated}, step5 has_inspection_text: {step5_updated})"
            )
        else:
            print(f"\nDry-run complete. No changes made to database.")


if __name__ == "__main__":
    main()