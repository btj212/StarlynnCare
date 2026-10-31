#!/usr/bin/env python3
"""
Layer 1 — Database invariant checks for StarlynnCare.

Run after every DB migration and every scraper ingest:
    python3 scripts/validate/db_invariants.py

Exit 0 = all checks passed. Exit 1 = one or more checks failed.

Peer-rank percentile proxy
──────────────────────────
The live site uses facility_snapshot() RPC (one call per facility, slow).
These checks use a SQL window-function proxy that mirrors the RPC's logic:
  composite_pct ≈ average of:
    sev_pct   = 100 * (1 - percent_rank() OVER peers ORDER BY severity_score ASC)
    rep_pct   = 100 * (1 - percent_rank() OVER peers ORDER BY repeat_score ASC)
    freq_pct  = 100 * (1 - percent_rank() OVER peers ORDER BY freq_score ASC)
where peers = same state_code + care_category, publishable = true.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._lib import check, get_conn, run_all_checks  # noqa: E402

PUBLISHABLE_STATES = ("CA", "OR", "WA", "MN", "TX", "UT", "CO")
# A state that publishes bed counts can have a few blanks. Illinois publishes none.
BED_GAP_ALLOWANCE = 5
# One near-future date is the known Washington source file for Aegis Living Kirkland.
# A second future date, or a date more than 120 days ahead, means a parser is wrong.
FUTURE_DATE_ALLOWANCE = 1
FUTURE_DATE_MAX_DAYS = 120


def bed_gap_is_structural(publishable: int, missing: int) -> bool:
    """True when this state does not publish bed counts at all."""
    return publishable > 0 and missing >= publishable


def bed_gaps_pass(missing: int, allowance: int = BED_GAP_ALLOWANCE) -> bool:
    """Blanks inside the allowance are not a broken roster."""
    return missing <= allowance


def future_dates_pass(
    future_count: int,
    furthest_days_ahead: float,
    allowance: int = FUTURE_DATE_ALLOWANCE,
    max_days: int = FUTURE_DATE_MAX_DAYS,
) -> bool:
    """A pile of future dates, or one date months ahead, is a parser writing the wrong day."""
    if future_count > allowance:
        return False
    return furthest_days_ahead <= max_days

# ── SQL: bulk composite percentile per publishable facility ────────────────────
# Mirrors facility_snapshot() logic but runs in one query across all facilities.
# Uses 36-month window for severity + repeat, 12-month for trajectory (omitted
# from composite here; same as snapshot). Lower raw score → higher percentile.

_COMPOSITE_PCT_SQL = """
WITH raw AS (
    SELECT
        f.id,
        f.state_code,
        f.care_category,
        -- Severity score: severity-weighted deficiency count / beds (per 36 mo)
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
        -- Repeat score: fraction of inspections with ≥1 repeat deficiency (36 mo)
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
        -- Frequency score: inspection count per year (36 mo)
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
    WHERE f.publishable = true
    GROUP BY f.id, f.state_code, f.care_category, f.beds
),
ranked AS (
    SELECT
        id,
        state_code,
        care_category,
        ROUND((1 - PERCENT_RANK() OVER (
            PARTITION BY state_code, care_category
            ORDER BY sev_raw ASC
        )) * 100)::int AS sev_pct,
        ROUND((1 - PERCENT_RANK() OVER (
            PARTITION BY state_code, care_category
            ORDER BY rep_raw ASC
        )) * 100)::int AS rep_pct,
        ROUND((1 - PERCENT_RANK() OVER (
            PARTITION BY state_code, care_category
            ORDER BY freq_raw ASC
        )) * 100)::int AS freq_pct
    FROM raw
)
SELECT
    id,
    state_code,
    care_category,
    ROUND((sev_pct + rep_pct + freq_pct)::numeric / 3) AS composite_pct,
    sev_pct,
    rep_pct,
    freq_pct
FROM ranked
"""

# ── SQL: repeat deficiency count per facility (distinct-visit methodology) ──────
# A facility's repeat_deficiency_count = number of (regulation code, facility_id)
# pairs where the same code appears in ≥3 distinct inspection visits.

_REPEAT_DEF_COUNT_SQL = """
WITH visit_counts AS (
    SELECT
        i.facility_id,
        d.code AS regulation_code,
        COUNT(DISTINCT i.id) AS distinct_visits
    FROM deficiencies d
    JOIN inspections i ON i.id = d.inspection_id
    WHERE d.code IS NOT NULL
      AND i.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
    GROUP BY i.facility_id, d.code
)
SELECT
    facility_id,
    COUNT(*) AS repeat_deficiency_count
FROM visit_counts
WHERE distinct_visits >= 3
GROUP BY facility_id
"""


def _check_peer_rank_distribution(cur) -> None:
    """
    Peer rank distribution checks per state.

    Threshold notes:
    - stddev > 5: a degenerate ranking (all=100) has stddev=0; any real spread
      produces stddev >> 5.
    - min < 40: composite = avg(sev_pct, rep_pct, freq_pct). Even if a facility
      is worst on severity only, the other two metrics average ~50, giving
      composite ≈ 33. We use 40 as the threshold to confirm bad actors exist
      without demanding a facility be worst on all three dimensions.
    - TX / small states: skip distribution checks when n < 5 (too few peers
      to produce meaningful spread).
    """
    print("\n[Peer rank distribution]")
    for state in PUBLISHABLE_STATES:
        cur.execute(
            f"""
            WITH pct AS ({_COMPOSITE_PCT_SQL})
            SELECT
                COUNT(*) AS n,
                ROUND(STDDEV(composite_pct), 2) AS stddev,
                MIN(composite_pct) AS min_pct,
                MAX(composite_pct) AS max_pct
            FROM pct
            WHERE state_code = %s
            """,
            (state,),
        )
        row = cur.fetchone()
        n = row["n"] or 0
        if n == 0:
            check(
                f"{state}: peer_rank has facilities",
                False,
                "0 publishable facilities found",
            )
            continue

        if n < 5:
            print(f"  SKIP  {state}: peer_rank spread checks (only {n} facilities — too few for meaningful distribution)")
            continue

        stddev = row["stddev"] or 0
        min_pct = row["min_pct"]
        max_pct = row["max_pct"]

        check(
            f"{state}: peer_rank stddev > 5",
            float(stddev) > 5,
            f"stddev={stddev}, n={n}",
        )
        # composite = avg of 3 percentiles; min achievable ≈ 33 when worst on 1 dimension.
        # Threshold 42 catches truly degenerate rankings (all=100 → min=100) while
        # allowing realistic distributions where min ≈ 33–40.
        check(
            f"{state}: peer_rank min < 42",
            min_pct is not None and int(min_pct) < 42,
            f"min={min_pct} (no facilities below 42nd percentile — ranking may be broken)",
        )
        check(
            f"{state}: peer_rank max > 80",
            max_pct is not None and int(max_pct) > 80,
            f"max={max_pct}",
        )


def _check_cross_metric_contradictions(cur) -> None:
    """
    Where a state actually stores repeat flags, a home with the same code on
    three visits should not also sit in the cleaner half of the composite rank.

    Oregon, California, and most other states store no is_repeat flags, so the
    repeat leg of the composite is the same number for every home. A high
    composite there does not mean the home is clean. Marquis Oregon City was
    the false failure: three repeated codes, composite 78, and zero repeat flags
    in the whole state.
    """
    print("\n[Cross-metric contradiction — repeat citations vs composite rank]")

    cur.execute(
        f"""
        WITH pct AS ({_COMPOSITE_PCT_SQL}),
        rdc AS ({_REPEAT_DEF_COUNT_SQL}),
        repeat_states AS (
            SELECT DISTINCT f2.state_code
            FROM deficiencies d
            JOIN inspections i ON i.id = d.inspection_id
            JOIN facilities f2 ON f2.id = i.facility_id
            WHERE d.is_repeat IS TRUE
              AND f2.publishable = true
        )
        SELECT
            f.id,
            f.name,
            f.state_code,
            f.slug,
            rdc.repeat_deficiency_count,
            pct.composite_pct
        FROM facilities f
        JOIN rdc ON rdc.facility_id = f.id
        JOIN pct ON pct.id = f.id
        JOIN repeat_states rs ON rs.state_code = f.state_code
        WHERE f.publishable = true
          AND rdc.repeat_deficiency_count >= 3
          AND pct.composite_pct > 70
        ORDER BY rdc.repeat_deficiency_count DESC, pct.composite_pct DESC
        """
    )
    contradictions = cur.fetchall()
    if contradictions:
        print(f"  Contradiction candidates ({len(contradictions)}):")
        for row in contradictions:
            print(
                f"    • {row['name']} ({row['state_code']}) "
                f"slug={row['slug']} "
                f"repeat_def={row['repeat_deficiency_count']} "
                f"composite_pct={row['composite_pct']}"
            )
    check(
        "No repeat-flagged state has a 3-visit repeat code and composite_pct > 70",
        len(contradictions) == 0,
        f"{len(contradictions)} contradiction(s) — review rankings for listed facilities",
    )


def _check_positive_label_contradictions(cur) -> None:
    """
    Any facility whose content.headline contains a positive superlative
    but has composite_pct < 40 is a contradiction.
    """
    print("\n[Positive label contradiction — headline vs composite rank]")
    POSITIVE_TERMS = [
        "highly rated",
        "top rated",
        "best",
        "excellent",
        "award",
        "outstanding",
    ]

    # Build ILIKE pattern list
    ilike_clauses = " OR ".join(
        f"(f.content->>'headline') ILIKE %s" for _ in POSITIVE_TERMS
    )
    params = [f"%{t}%" for t in POSITIVE_TERMS]

    cur.execute(
        f"""
        WITH pct AS ({_COMPOSITE_PCT_SQL})
        SELECT
            f.id,
            f.name,
            f.state_code,
            f.slug,
            f.content->>'headline' AS headline,
            pct.composite_pct
        FROM facilities f
        JOIN pct ON pct.id = f.id
        WHERE f.publishable = true
          AND f.content->>'headline' IS NOT NULL
          AND ({ilike_clauses})
          AND pct.composite_pct < 40
        ORDER BY pct.composite_pct ASC
        """,
        params,
    )
    hits = cur.fetchall()
    if hits:
        print(f"  Positive-label contradictions ({len(hits)}):")
        for row in hits:
            print(
                f"    • {row['name']} ({row['state_code']}) "
                f"slug={row['slug']} "
                f"composite_pct={row['composite_pct']} "
                f"headline=\"{row['headline']}\""
            )
    check(
        "No positive headlines with composite_pct < 40",
        len(hits) == 0,
        f"{len(hits)} contradiction(s) found",
    )


def _check_coverage_nulls(cur) -> None:
    """Coverage and null checks for publishable facilities."""
    print("\n[Coverage / null checks]")

    # Bed counts exist only for states that publish them. Illinois does not.
    cur.execute(
        """
        SELECT
            state_code,
            COUNT(*) AS publishable,
            COUNT(*) FILTER (WHERE beds IS NULL OR beds = 0) AS missing,
            COUNT(*) FILTER (
                WHERE state_code NOT IN ('CA','OR','WA','MN','TX','UT','AZ','PA','IL','MO','CO')
            ) AS bad_state
        FROM facilities
        WHERE publishable = true
        GROUP BY state_code
        ORDER BY state_code
        """
    )
    rows = cur.fetchall()
    total = sum(row["publishable"] or 0 for row in rows)
    bad_state = sum(row["bad_state"] or 0 for row in rows)
    missing_where_published = 0
    for row in rows:
        publishable = row["publishable"] or 0
        missing = row["missing"] or 0
        if bed_gap_is_structural(publishable, missing):
            print(
                f"  {row['state_code']}: bed counts are not in this source "
                f"({missing}/{publishable}). Not a data failure."
            )
            continue
        missing_where_published += missing
    check(
        f"States that publish bed counts are missing them on ≤ {BED_GAP_ALLOWANCE} homes",
        bed_gaps_pass(missing_where_published),
        f"{missing_where_published}/{total} missing outside states with no bed counts",
    )
    check(
        "All publishable: state_code in allowed set",
        bad_state == 0,
        f"{bad_state} with unexpected state_code",
    )

    # last_inspection_date: the denormalized column on facilities is only backfilled
    # for MN (other states use the inspections table directly). Check that all
    # publishable facilities have at least one inspection row per state.
    cur.execute(
        """
        SELECT
            f.state_code,
            COUNT(DISTINCT f.id) AS total,
            COUNT(DISTINCT f.id) FILTER (
              WHERE i.id IS NOT NULL
                 OR (
                   f.state_code = 'WA'
                   AND f.wa_facility_type = 'AFH'
                   AND f.state_records_checked_at IS NOT NULL
                 )
            ) AS with_any_inspection
        FROM facilities f
        LEFT JOIN inspections i ON i.facility_id = f.id
        WHERE f.publishable = true
        GROUP BY f.state_code
        ORDER BY f.state_code
        """
    )
    for srow in cur.fetchall():
        st = srow["state_code"]
        total = srow["total"] or 0
        with_insp = srow["with_any_inspection"] or 0
        pct = (with_insp / total * 100) if total > 0 else 0
        check(
            f"{st}: ≥90% publishable have at least one inspection row",
            pct >= 90 or total == 0,
            f"{with_insp}/{total} ({pct:.0f}%) have an inspection or a completed records check",
        )

    # CA: ≥60% of inspections must have non-null, non-empty narrative
    cur.execute(
        """
        SELECT
            COUNT(d.id) AS total_defs,
            COUNT(d.id) FILTER (
                WHERE d.inspector_narrative IS NOT NULL
                  AND TRIM(d.inspector_narrative) <> ''
            ) AS with_narrative
        FROM deficiencies d
        JOIN inspections i ON i.id = d.inspection_id
        JOIN facilities f ON f.id = i.facility_id
        WHERE f.publishable = true AND f.state_code = 'CA'
        """
    )
    row = cur.fetchone()
    total_defs = row["total_defs"] or 0
    with_narr = row["with_narrative"] or 0
    pct_narr = (with_narr / total_defs * 100) if total_defs > 0 else 0
    check(
        "CA: ≥60% of deficiencies have narrative",
        pct_narr >= 60 or total_defs == 0,
        f"{with_narr}/{total_defs} ({pct_narr:.1f}%)",
    )

    # Deficiency severity distribution: ≥10% of deficiencies should have severity >= 2
    cur.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE severity >= 2) AS sev_ge2
        FROM deficiencies d
        JOIN inspections i ON i.id = d.inspection_id
        JOIN facilities f ON f.id = i.facility_id
        WHERE f.publishable = true
        """
    )
    row = cur.fetchone()
    total_d = row["total"] or 0
    sev_ge2 = row["sev_ge2"] or 0
    pct_sev = (sev_ge2 / total_d * 100) if total_d > 0 else 0
    check(
        "Deficiency severity: ≥10% have severity ≥ 2",
        pct_sev >= 10 or total_d == 0,
        f"{sev_ge2}/{total_d} ({pct_sev:.1f}%)",
    )


def _check_scraper_freshness(cur) -> None:
    """The inspection date is the record. Rewriting a facility row is not."""
    print("\n[Inspection dates — newest visit on file, and dates that have not happened]")
    cur.execute(
        """
        SELECT
            f.state_code,
            MAX(i.inspection_date) AS newest,
            COUNT(i.id) FILTER (WHERE i.inspection_date > CURRENT_DATE) AS future_count,
            MAX(i.inspection_date) FILTER (WHERE i.inspection_date > CURRENT_DATE) AS furthest
        FROM facilities f
        LEFT JOIN inspections i ON i.facility_id = f.id
        WHERE f.publishable = true
        GROUP BY f.state_code
        ORDER BY f.state_code
        """
    )
    rows = cur.fetchall()
    future_count = 0
    furthest_days = 0.0
    for row in rows:
        newest = row["newest"]
        state_future = row["future_count"] or 0
        future_count += state_future
        furthest = row["furthest"]
        if furthest is not None:
            days_ahead = (furthest - date.today()).days
            furthest_days = max(furthest_days, float(days_ahead))
        print(
            f"  {row['state_code']}: newest inspection {newest or 'none'}"
            + (f", {state_future} dated after today" if state_future else "")
        )
    if future_count:
        cur.execute(
            """
            SELECT f.state_code, f.name, i.inspection_date
            FROM inspections i
            JOIN facilities f ON f.id = i.facility_id
            WHERE f.publishable = true
              AND i.inspection_date > CURRENT_DATE
            ORDER BY i.inspection_date DESC
            LIMIT 5
            """
        )
        for row in cur.fetchall():
            print(f"    • {row['state_code']} {row['inspection_date']} {row['name']}")
    check(
        "Inspection dates are not a parser running ahead of the calendar",
        future_dates_pass(future_count, furthest_days),
        f"{future_count} future date(s), furthest {furthest_days:.0f} days ahead",
    )


def main() -> None:
    print("=" * 60)
    print("StarlynnCare — Layer 1: Database Invariant Checks")
    print("=" * 60)

    with get_conn() as conn:
        with conn.cursor() as cur:
            _check_peer_rank_distribution(cur)
            _check_cross_metric_contradictions(cur)
            _check_positive_label_contradictions(cur)
            _check_coverage_nulls(cur)
            _check_scraper_freshness(cur)

    run_all_checks("Layer 1 (DB invariants)")


if __name__ == "__main__":
    main()
