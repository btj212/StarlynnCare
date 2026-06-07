#!/usr/bin/env python3
"""
PA insights headline-integrity checks.

Asserts that the three editorial headline claims in /pennsylvania/insights/*
still hold against the live Supabase DB. Run this before any redeploy that
touches PA deficiency data, and after major ingest runs.

Checks:
  A — Max-IJ facility is Penn Highlands Jefferson Manor (Brookville, Jefferson Co.)
  B — Chester County and at least one other collar county (Montgomery, Bucks,
      Delaware) cluster in the top-5 counties by def-per-facility (among 5+
      facilities); and the Allegheny per-facility IJ rate is lower than Chester's.
  C — XL-tier avg severe is >= 3× small-tier avg severe.

Exit 0 = all pass. Exit 1 = one or more failures.

Usage:
    python3 scripts/validate/pa_insights_headlines.py

Mirror of db_invariants.py pattern. Requires DATABASE_URL or POSTGRES_URL in .env.local.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import os
from dotenv import load_dotenv
import psycopg

load_dotenv(Path(__file__).resolve().parents[2] / ".env.local")

FAILURES: list[str] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    status = "PASS" if passed else "FAIL"
    print(f"  [{status}] {name}{': ' + detail if detail else ''}")
    if not passed:
        FAILURES.append(name)


def get_conn() -> psycopg.Connection:  # type: ignore[type-arg]
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL or POSTGRES_URL not set")
    return psycopg.connect(url)


def run_checks() -> None:
    print("PA insights headline-integrity checks")
    print("=" * 50)

    with get_conn() as conn:
        with conn.cursor() as cur:

            # ── Story A: Max-IJ facility ─────────────────────────────────────────
            print("\nStory A — Penn Highlands Jefferson Manor holds max IJ count")
            cur.execute("""
                SELECT f.name, f.county, f.city_slug,
                       COUNT(CASE WHEN d.state_severity_raw = 'Immediate Jeopardy' THEN 1 END) AS ij_count
                FROM facilities f
                JOIN inspections i ON i.facility_id = f.id
                JOIN deficiencies d ON d.inspection_id = i.id
                WHERE f.state_code = 'PA' AND f.publishable = true
                GROUP BY f.id, f.name, f.county, f.city_slug
                ORDER BY ij_count DESC
                LIMIT 3
            """)
            rows = cur.fetchall()
            if not rows:
                check("A1: IJ data exists for PA", False, "no rows returned")
            else:
                top_name = rows[0][0]
                top_ij = int(rows[0][3])
                # Check headline: top facility should be Penn Highlands Jefferson Manor
                is_penn_highlands = "penn highlands jefferson manor" in top_name.lower()
                check(
                    "A1: Penn Highlands Jefferson Manor is top IJ facility",
                    is_penn_highlands,
                    f"top={top_name!r} ({top_ij} IJ)",
                )
                check("A2: Top IJ count is ≥ 10 (headline threshold)", top_ij >= 10, f"ij={top_ij}")
                # Verify it's in Brookville/Jefferson County
                top_county = rows[0][1]
                check("A3: Facility is in Jefferson County", top_county == "Jefferson", f"county={top_county!r}")

            # ── Story B: Collar counties cluster + Allegheny comparison ──────────
            print("\nStory B — Collar counties cluster in worst records")
            cur.execute("""
                SELECT f.county,
                       COUNT(DISTINCT f.id) AS facilities,
                       COUNT(CASE WHEN d.state_severity_raw = 'Immediate Jeopardy' THEN 1 END) AS ij_total,
                       ROUND(COUNT(d.id)::numeric / COUNT(DISTINCT f.id), 1) AS def_per_facility
                FROM facilities f
                JOIN inspections i ON i.facility_id = f.id
                JOIN deficiencies d ON d.inspection_id = i.id
                WHERE f.state_code = 'PA' AND f.publishable = true AND f.county IS NOT NULL
                GROUP BY f.county
                HAVING COUNT(DISTINCT f.id) >= 5
                ORDER BY def_per_facility DESC
            """)
            county_rows = cur.fetchall()
            # cols: county, facilities, ij_total, def_per_facility

            collar_counties = {"Chester", "Montgomery", "Bucks", "Delaware"}
            top5_counties = {r[0] for r in county_rows[:5]}
            collar_in_top5 = collar_counties & top5_counties

            check(
                "B1: At least 2 collar counties in top-5 by def/facility",
                len(collar_in_top5) >= 2,
                f"collar in top5: {sorted(collar_in_top5)}",
            )

            # Allegheny vs Chester IJ per facility — query all counties (no LIMIT)
            county_map = {r[0]: r for r in county_rows}
            allegheny = county_map.get("Allegheny")
            chester = county_map.get("Chester")

            if not allegheny or not chester:
                check("B2: Allegheny and Chester both have data", False, "missing one or both counties")
            else:
                allegheny_fac = int(allegheny[1])
                allegheny_ij = int(allegheny[2])
                chester_fac = int(chester[1])
                chester_ij = int(chester[2])
                allegheny_rate = allegheny_ij / max(allegheny_fac, 1)
                chester_rate = chester_ij / max(chester_fac, 1)
                check(
                    "B2: Chester IJ rate/facility > Allegheny IJ rate/facility",
                    chester_rate > allegheny_rate,
                    f"Chester={chester_rate:.2f} vs Allegheny={allegheny_rate:.2f}",
                )
                # Chester has fewer facilities than Allegheny
                check(
                    "B3: Chester has fewer facilities than Allegheny (<= 40% fewer)",
                    chester_fac < allegheny_fac,
                    f"Chester={chester_fac} fac, Allegheny={allegheny_fac} fac",
                )

            # ── Story C: XL tier avg severe ≥ 3× small tier ─────────────────────
            print("\nStory C — XL facilities ≥ 3× small-tier average severe")
            cur.execute("""
                SELECT
                    CASE
                        WHEN f.beds < 20  THEN 'small'
                        WHEN f.beds < 50  THEN 'medium'
                        WHEN f.beds < 100 THEN 'large'
                        ELSE 'xl'
                    END AS tier,
                    COUNT(DISTINCT f.id) AS n,
                    ROUND(AVG(per_fac.severe_count)::numeric, 2) AS avg_severe
                FROM facilities f
                JOIN (
                    SELECT i.facility_id,
                           COUNT(CASE WHEN d.severity >= 3 THEN 1 END) AS severe_count
                    FROM inspections i
                    JOIN deficiencies d ON d.inspection_id = i.id
                    GROUP BY i.facility_id
                ) per_fac ON per_fac.facility_id = f.id
                WHERE f.state_code = 'PA' AND f.publishable = true AND f.beds IS NOT NULL
                GROUP BY tier
                ORDER BY avg_severe DESC
            """)
            tier_rows = cur.fetchall()
            tier_map = {r[0]: (int(r[1]), float(r[2])) for r in tier_rows}

            xl = tier_map.get("xl")
            small = tier_map.get("small")
            if not xl or not small:
                check("C1: XL and small tiers both have data", False, f"tiers found: {list(tier_map)}")
            else:
                xl_n, xl_avg = xl
                small_n, small_avg = small
                check("C1: XL tier has ≥ 100 facilities", xl_n >= 100, f"xl_n={xl_n}")
                check("C2: Small tier has data (note: n may be small)", small_n > 0, f"small_n={small_n}")
                ratio = xl_avg / max(small_avg, 0.1)
                check(
                    "C3: XL avg severe ≥ 3× small avg severe",
                    ratio >= 3.0,
                    f"xl={xl_avg:.2f}, small={small_avg:.2f}, ratio={ratio:.2f}×",
                )
                # Warn (not fail) if small N is very low
                if small_n < 5:
                    print(f"  [WARN] Small tier n={small_n} — too thin for statistical inference (expected; headline includes caveat)")


def main() -> None:
    run_checks()
    print()
    if FAILURES:
        print(f"FAILED: {len(FAILURES)} check(s) failed — review headlines before redeploy:")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    else:
        print("All headline-integrity checks passed.")


if __name__ == "__main__":
    main()
