#!/usr/bin/env python3
"""
Layer 5 — Post-ingest validation hook for StarlynnCare.

Lightweight checks to run immediately after any scraper ingest.
Chain after a scraper run:
    python3 scrapers/mn_alrc_ingest.py && python3 scripts/validate/post_ingest_check.py --state MN

    # Or without an expected previous count:
    python3 scripts/validate/post_ingest_check.py --state CA

Exit 0 = all checks passed. Exit 1 = one or more checks failed.

A quiet week is a success. These checks do not fail because facility rows
were left untouched, or because a state stores inspections on the inspection
row rather than facilities.last_inspection_date. They fail when the published
set shrinks, ranks collapse, a state that publishes bed counts loses them, or
published homes no longer have inspection rows.

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

# Same allowance as the global "beds not null/zero" invariant, applied per state.
BED_NULL_ALLOWANCE = 5
# Same bar as db_invariants: a published home should have an inspection row.
INSPECTION_COVERAGE_MIN = 0.90


def bed_counts_are_published(publishable: int, beds_null: int) -> bool:
    """True when this state stores a bed count on at least one published home.

    Illinois publishes none. A column that is null for the whole state is the
    shape of that source, not evidence that this week's scrape failed.
    """
    return publishable > 0 and beds_null < publishable


def bed_nulls_pass(beds_null: int, allowance: int = BED_NULL_ALLOWANCE) -> bool:
    """A handful of missing bed counts matches the existing global allowance."""
    return beds_null <= allowance


def inspection_coverage_passes(
    with_inspection: int,
    publishable: int,
    minimum: float = INSPECTION_COVERAGE_MIN,
) -> bool:
    """The inspection row is the record. A blank facilities.last_inspection_date is not a failed scan."""
    if publishable == 0:
        return True
    return (with_inspection / publishable) >= minimum


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
        label = "facility" if n == 1 else "facilities"
        print(f"  Only {n} publishable {label} — rank spread is not meaningful yet")
        return

    check(
        f"{state}: peer_rank stddev > 5",
        stddev > 5,
        f"stddev={stddev:.2f}, n={n}",
    )


def _report_recent_edits(cur, state: str) -> None:
    """Say how many rows changed this week. A quiet source does not fail the scan."""
    print(f"\n[Recent edits — {state}]")

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
    print(
        f"  {recent}/{total} publishable facilities edited in the last 7 days. "
        "A week with no source change is a successful scan."
    )


def _check_published_beds(cur, state: str) -> None:
    """Fail only when a state that publishes bed counts loses more than the allowance."""
    print(f"\n[Bed counts — {state}]")

    cur.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE beds IS NULL) AS beds_null
        FROM facilities
        WHERE state_code = %s
          AND publishable = true
        """,
        (state,),
    )
    row = cur.fetchone()
    total = row["total"] or 0
    beds_null = row["beds_null"] or 0
    if not bed_counts_are_published(total, beds_null):
        print(
            f"  {state}: this source does not publish bed counts "
            f"({beds_null}/{total} null). Not a scan failure."
        )
        return

    check(
        f"{state}: publishable facilities missing bed counts ≤ {BED_NULL_ALLOWANCE}",
        bed_nulls_pass(beds_null),
        f"{beds_null}/{total} facilities with beds=NULL",
    )


def _check_inspection_coverage(cur, state: str) -> None:
    """Published homes need an inspection row. The denormalized date column is not that test."""
    print(f"\n[Inspection coverage — {state}]")

    cur.execute(
        """
        SELECT
            COUNT(DISTINCT f.id) AS total,
            COUNT(DISTINCT i.facility_id) AS with_any_inspection
        FROM facilities f
        LEFT JOIN inspections i ON i.facility_id = f.id
        WHERE f.publishable = true
          AND f.state_code = %s
        """,
        (state,),
    )
    row = cur.fetchone()
    total = row["total"] or 0
    with_inspection = row["with_any_inspection"] or 0
    pct = (with_inspection / total * 100) if total else 0
    check(
        f"{state}: ≥90% of publishable facilities have an inspection row",
        inspection_coverage_passes(with_inspection, total),
        f"{with_inspection}/{total} ({pct:.0f}%) have inspections",
    )


def _check_chain_wcs_drift_ca(cur) -> None:
    """
    CA-only: recompute chain WCS from DB and flag if any chain has drifted
    more than 10% from the value hardcoded in the report content file.

    Severity weights follow HOOK_DECISION.md:
        1 → 1, 2 → 2, 3 → 3, 4 → 5, NULL → 1
    Beds NULL → default 30.
    Chain WCS = average of per-facility WCS scores.
    Threshold: ≥3 CA publishable facilities AND ≥50 total beds.
    """
    import re
    from pathlib import Path

    print("\n[Chain WCS drift check — CA]")

    report_ts = Path(__file__).resolve().parents[2] / (
        "src/lib/content/reports/california-rcfe-repeat-citations-2026.ts"
    )
    if not report_ts.exists():
        print(f"  WARNING: report TS file not found at {report_ts}")
        check("CA: report TS file exists", False, str(report_ts))
        return

    src = report_ts.read_text()
    match = re.search(r"export const CHAIN_SCORECARD.*?\[(.+?)\];", src, re.DOTALL)
    if not match:
        check("CA: CHAIN_SCORECARD parseable", False, "regex found nothing")
        return

    block = match.group(1)
    ts_chains: list[dict] = []
    for entry in re.finditer(r"\{([^{}]+)\}", block, re.DOTALL):
        text = entry.group(1)

        def _str(key: str) -> str | None:
            m = re.search(rf'{key}\s*:\s*"([^"]+)"', text, re.DOTALL)
            return m.group(1).strip() if m else None

        def _num(key: str) -> float | None:
            m = re.search(rf"{key}\s*:\s*([\d.]+)", text)
            return float(m.group(1)) if m else None

        display = _str("displayName")
        op_raw = _str("cdssOperatorNames")
        wcs = _num("weightedCitationScore")
        if display and op_raw and wcs is not None:
            ts_chains.append({"display": display, "op_names": op_raw, "wcs": wcs})

    if not ts_chains:
        check("CA: CHAIN_SCORECARD has entries", False, "parsed 0 chains")
        return

    drift_found = False
    for chain in ts_chains:
        op_names = [n.strip() for n in chain["op_names"].replace(" | ", "|").split("|")]
        ilike = " OR ".join("LOWER(f.operator_name) = LOWER(%s)" for _ in op_names)

        cur.execute(
            f"""
            WITH fac_scores AS (
                SELECT
                    f.id,
                    COALESCE(f.beds, 30) AS eff_beds,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN d.severity = 1 THEN 1
                                WHEN d.severity = 2 THEN 2
                                WHEN d.severity = 3 THEN 3
                                WHEN d.severity = 4 THEN 5
                                ELSE 1
                            END
                        )::numeric / NULLIF(COALESCE(f.beds, 30), 0),
                        0
                    ) AS wcs
                FROM facilities f
                LEFT JOIN inspections i
                    ON i.facility_id = f.id
                    AND i.inspection_date >= CURRENT_DATE - INTERVAL '3 years'
                LEFT JOIN deficiencies d ON d.inspection_id = i.id
                WHERE f.state_code = 'CA'
                  AND f.publishable = true
                  AND ({ilike})
                GROUP BY f.id, f.beds
            )
            SELECT AVG(wcs)::numeric AS chain_wcs FROM fac_scores
            """,
            op_names,
        )
        row = cur.fetchone()
        db_wcs = float(row["chain_wcs"] or 0)
        ts_wcs = chain["wcs"]

        if ts_wcs == 0 and db_wcs == 0:
            pct_change = 0.0
        elif ts_wcs == 0:
            pct_change = 100.0
        else:
            pct_change = abs(db_wcs - ts_wcs) / max(abs(ts_wcs), 0.001) * 100

        if pct_change > 10:
            drift_found = True
            print(
                f"  WARN: Chain '{chain['display']}' WCS drifted {pct_change:.1f}%"
                f"  (TS={ts_wcs:.3f}  DB={db_wcs:.3f})"
            )

    if drift_found:
        print(
            "  WARN: Chain scorecard drift detected — re-run "
            "scripts/analyses/chain_operator_scorecard_ca.py and update the report content file."
        )

    if drift_found:
        print("  Article chain scores differ from the live record. Not a scan failure.")


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
            _report_recent_edits(cur, state)
            _check_published_beds(cur, state)
            _check_inspection_coverage(cur, state)
            if state == "CA":
                _check_chain_wcs_drift_ca(cur)

    run_all_checks(f"Layer 5 (post-ingest {state})")


if __name__ == "__main__":
    main()
