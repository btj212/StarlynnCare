#!/usr/bin/env python3
"""
Layer 5 — Post-ingest validation hook for StarlynnCare.

Lightweight checks to run immediately after any scraper ingest.
Chain after a scraper run:
    python3 scrapers/mn_alrc_ingest.py && python3 scripts/validate/post_ingest_check.py --state MN

    # Or without an expected previous count:
    python3 scripts/validate/post_ingest_check.py --state CA

Exit 0 = all checks passed. Exit 1 = one or more checks failed.

Flags:
    --state STATE     State code to validate (required, e.g. CA, OR, WA, MN, TX)
    --prev-count N    Expected minimum row count before this ingest (optional).
                      If provided, asserts current count >= N. Use the output of
                      a pre-ingest SELECT COUNT(*) to catch accidental deletes.
    --allow-shrink    Allow the row count to decrease (use when intentionally removing
                      facilities, e.g. unpublishing). Suppresses the shrink check.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._lib import check, get_conn, run_all_checks  # noqa: E402


def _check_row_count(cur, state: str, prev_count: int | None, allow_shrink: bool) -> None:
    """Row count for the state must not have decreased."""
    print(f"\n[Row count — {state}]")
    cur.execute(
        """
        SELECT COUNT(*) AS n
        FROM facilities
        WHERE state_code = %s AND publishable = true
        """,
        (state,),
    )
    current = cur.fetchone()["n"] or 0
    print(f"  Current publishable count for {state}: {current}")

    if prev_count is not None and not allow_shrink:
        check(
            f"{state}: row count did not decrease",
            current >= prev_count,
            f"was {prev_count}, now {current} (shrunk by {prev_count - current})",
        )
    elif prev_count is None:
        check(
            f"{state}: at least 1 publishable facility",
            current >= 1,
            f"found {current}",
        )
    else:
        check(
            f"{state}: row count check skipped (--allow-shrink)",
            True,
            f"current={current}",
        )


def _check_rank_distribution(cur, state: str) -> None:
    """peer_rank_pct distribution for the state must be non-degenerate (stddev > 5)."""
    print(f"\n[Rank distribution — {state}]")

    cur.execute(
        """
        WITH raw AS (
            SELECT
                f.id,
                f.care_category,
                COALESCE(
                    SUM(
                        CASE
                            WHEN i.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
                            THEN COALESCE(d.severity, 1)
                            ELSE 0
                        END
                    )::numeric / NULLIF(f.beds, 0),
                    0
                ) AS sev_raw,
                COALESCE(
                    COUNT(DISTINCT CASE
                        WHEN i.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
                             AND d.is_repeat = true
                        THEN i.id END
                    )::numeric
                    / NULLIF(COUNT(DISTINCT CASE
                        WHEN i.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
                        THEN i.id END
                    ), 0),
                    0
                ) AS rep_raw,
                COALESCE(
                    COUNT(DISTINCT CASE
                        WHEN i.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
                        THEN i.id END
                    )::numeric / 3.0,
                    0
                ) AS freq_raw
            FROM facilities f
            LEFT JOIN inspections i ON i.facility_id = f.id
            LEFT JOIN deficiencies d ON d.inspection_id = i.id
            WHERE f.publishable = true AND f.state_code = %s
            GROUP BY f.id, f.care_category, f.beds
        ),
        ranked AS (
            SELECT
                ROUND((1 - PERCENT_RANK() OVER (
                    PARTITION BY care_category
                    ORDER BY sev_raw ASC
                )) * 100)::int AS sev_pct,
                ROUND((1 - PERCENT_RANK() OVER (
                    PARTITION BY care_category
                    ORDER BY rep_raw ASC
                )) * 100)::int AS rep_pct,
                ROUND((1 - PERCENT_RANK() OVER (
                    PARTITION BY care_category
                    ORDER BY freq_raw ASC
                )) * 100)::int AS freq_pct
            FROM raw
        )
        SELECT
            COUNT(*) AS n,
            ROUND(STDDEV(ROUND((sev_pct + rep_pct + freq_pct)::numeric / 3)), 2) AS stddev
        FROM ranked
        """,
        (state,),
    )
    row = cur.fetchone()
    n = row["n"] or 0
    stddev = float(row["stddev"] or 0)

    if n < 10:
        print(f"  Only {n} publishable facilities — skipping stddev check (need ≥10)")
        check(f"{state}: enough facilities for rank check", n >= 10, f"only {n} publishable")
        return

    check(
        f"{state}: peer_rank stddev > 5",
        stddev > 5,
        f"stddev={stddev:.2f}, n={n}",
    )


def _check_freshness(cur, state: str) -> None:
    """At least 80% of publishable facilities for the state must have updated_at within 7 days."""
    print(f"\n[Freshness — {state}]")

    cur.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (
                WHERE updated_at >= NOW() - INTERVAL '7 days'
            ) AS recent
        FROM facilities
        WHERE publishable = true AND state_code = %s
        """,
        (state,),
    )
    row = cur.fetchone()
    total = row["total"] or 0
    recent = row["recent"] or 0
    pct = (recent / total * 100) if total > 0 else 0

    check(
        f"{state}: ≥80% of publishable facilities updated within 7 days",
        pct >= 80 or total == 0,
        f"{recent}/{total} ({pct:.1f}%)",
    )


def _check_no_null_rank_publishable(cur, state: str) -> None:
    """
    No new facilities should be set publishable=true with beds IS NULL
    (a proxy for missing enough data to compute a meaningful rank).
    """
    print(f"\n[Null data on newly-published facilities — {state}]")

    cur.execute(
        """
        SELECT COUNT(*) AS n
        FROM facilities
        WHERE state_code = %s
          AND publishable = true
          AND beds IS NULL
        """,
        (state,),
    )
    n = cur.fetchone()["n"] or 0
    check(
        f"{state}: no publishable facilities with beds IS NULL",
        n == 0,
        f"{n} facilities with beds=NULL and publishable=true",
    )

    # Also check for missing last_inspection_date on new facilities
    cur.execute(
        """
        SELECT COUNT(*) AS n
        FROM facilities
        WHERE state_code = %s
          AND publishable = true
          AND last_inspection_date IS NULL
        """,
        (state,),
    )
    n = cur.fetchone()["n"] or 0
    check(
        f"{state}: no publishable facilities with last_inspection_date IS NULL",
        n == 0,
        f"{n} facilities with last_inspection_date=NULL and publishable=true",
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="StarlynnCare Layer 5 — Post-ingest validation"
    )
    parser.add_argument(
        "--state",
        required=True,
        help="State code to validate (e.g. CA, OR, WA, MN, TX)",
    )
    parser.add_argument(
        "--prev-count",
        type=int,
        default=None,
        help="Expected minimum publishable row count before this ingest",
    )
    parser.add_argument(
        "--allow-shrink",
        action="store_true",
        default=False,
        help="Allow row count to decrease (for intentional depublishing)",
    )
    args = parser.parse_args()
    state = args.state.upper()

    print("=" * 60)
    print(f"StarlynnCare — Layer 5: Post-Ingest Check ({state})")
    print("=" * 60)

    with get_conn() as conn:
        with conn.cursor() as cur:
            _check_row_count(cur, state, args.prev_count, args.allow_shrink)
            _check_rank_distribution(cur, state)
            _check_freshness(cur, state)
            _check_no_null_rank_publishable(cur, state)

    run_all_checks(f"Layer 5 (post-ingest {state})")


if __name__ == "__main__":
    main()
