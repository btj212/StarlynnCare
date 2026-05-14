#!/usr/bin/env python3
"""
Layer 2 — Pre-deploy content validation for StarlynnCare.

Validates report content files and static data against the live DB.
Run before every production deploy:
    python3 scripts/validate/content_checks.py

Exit 0 = all checks passed. Exit 1 = one or more checks failed.
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._lib import check, get_conn, run_all_checks, REPO_ROOT  # noqa: E402

# ── Paths ──────────────────────────────────────────────────────────────────────

DATA_SAMPLE_CSV = (
    REPO_ROOT
    / "docs/analyses/repeat_offender_report/data_sample.csv"
)
REPORT_TS = (
    REPO_ROOT
    / "src/lib/content/reports/california-rcfe-repeat-citations-2026.ts"
)

# ── Composite percentile proxy (same as db_invariants.py) ─────────────────────

_COMPOSITE_PCT_SQL = """
WITH raw AS (
    SELECT
        f.id,
        f.state_code,
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
    WHERE f.publishable = true
    GROUP BY f.id, f.state_code, f.care_category, f.beds
),
ranked AS (
    SELECT
        id,
        state_code,
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
    ROUND((sev_pct + rep_pct + freq_pct)::numeric / 3) AS composite_pct
FROM ranked
"""


def _parse_chain_scorecard() -> list[dict]:
    """
    Extract CHAIN_SCORECARD entries from the TypeScript report file using regex.
    Returns a list of dicts with keys:
      displayName, cdssOperatorNames, caFacilitiesInDataset, totalBeds, weightedCitationScore
    """
    if not REPORT_TS.exists():
        print(f"  WARNING: report TS file not found at {REPORT_TS}", file=sys.stderr)
        return []

    src = REPORT_TS.read_text()
    # Find the CHAIN_SCORECARD array block
    match = re.search(
        r"export const CHAIN_SCORECARD.*?\[(.+?)\];",
        src,
        re.DOTALL,
    )
    if not match:
        print("  WARNING: could not parse CHAIN_SCORECARD from TS file", file=sys.stderr)
        return []

    block = match.group(1)
    chains = []
    # Each entry is a { ... } object; split on top-level braces
    for entry in re.finditer(r"\{([^{}]+)\}", block, re.DOTALL):
        text = entry.group(1)

        def _extract(key: str, default=None):
            m = re.search(rf'{key}\s*:\s*(.+?)(?:,|\n)', text)
            if not m:
                return default
            val = m.group(1).strip().strip('"').strip("'")
            return val

        def _extract_num(key: str) -> float | None:
            val = _extract(key)
            if val is None:
                return None
            try:
                return float(val)
            except ValueError:
                return None

        def _extract_str(key: str) -> str | None:
            # Handles both single-line and pipe-separated multi-line strings
            m = re.search(rf'{key}\s*:\s*"([^"]+)"', text, re.DOTALL)
            if m:
                return m.group(1).strip()
            m = re.search(rf"{key}\s*:\s*'([^']+)'", text, re.DOTALL)
            if m:
                return m.group(1).strip()
            return None

        display_name = _extract_str("displayName")
        operator_names_raw = _extract_str("cdssOperatorNames")
        fac_count = _extract_num("caFacilitiesInDataset")
        total_beds = _extract_num("totalBeds")
        wcs = _extract_num("weightedCitationScore")

        if display_name and operator_names_raw and fac_count is not None:
            chains.append(
                {
                    "displayName": display_name,
                    "cdssOperatorNames": operator_names_raw,
                    "caFacilitiesInDataset": int(fac_count),
                    "totalBeds": int(total_beds) if total_beds else 0,
                    "weightedCitationScore": wcs,
                }
            )

    return chains


def _check_repeat_offender_csv(cur) -> None:
    """
    For each facility in data_sample.csv:
    1. Confirm the facility exists in the DB as publishable
    2. Confirm the repeat_citation_count matches DB
    3. Flag any with composite_pct > 50 (bad facility should have low rank)
    """
    print("\n[Repeat offender CSV vs DB reconciliation]")

    if not DATA_SAMPLE_CSV.exists():
        check(
            "data_sample.csv exists",
            False,
            f"not found at {DATA_SAMPLE_CSV}",
        )
        return
    check("data_sample.csv exists", True)

    # Load CSV rows (skip blank name rows that are regulation-only)
    rows = []
    with open(DATA_SAMPLE_CSV, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("name") and row["name"].strip():
                rows.append(row)

    if not rows:
        check("data_sample.csv has rows", False, "file is empty or all blank names")
        return
    check("data_sample.csv has rows", True, f"{len(rows)} rows")

    # Pre-compute composite percentiles for all CA facilities
    cur.execute(f"WITH pct AS ({_COMPOSITE_PCT_SQL}) SELECT id, composite_pct FROM pct WHERE state_code = 'CA'")
    pct_map = {str(r["id"]): r["composite_pct"] for r in cur.fetchall()}

    not_found = []
    bad_count = []
    bad_rank = []

    for row in rows:
        name = row["name"].strip()
        city = row.get("city", "").strip()
        regulation = row.get("regulation_id", "").strip()
        expected_count = int(row.get("count", 0))

        # Look up the facility in DB by name (case-insensitive) + state CA
        cur.execute(
            """
            SELECT id, name, slug, beds
            FROM facilities
            WHERE state_code = 'CA'
              AND publishable = true
              AND LOWER(name) = LOWER(%s)
            LIMIT 1
            """,
            (name,),
        )
        fac = cur.fetchone()
        if not fac:
            not_found.append(f"{name} / {city}")
            continue

        fac_id = str(fac["id"])

        # Recompute repeat-citation count for this facility+regulation using
        # the same methodology: COUNT(DISTINCT inspection_id) >= 3 per code
        cur.execute(
            """
            SELECT COUNT(DISTINCT i.id) AS distinct_visits
            FROM deficiencies d
            JOIN inspections i ON i.id = d.inspection_id
            WHERE i.facility_id = %s
              AND d.code = %s
            """,
            (fac_id, regulation),
        )
        db_row = cur.fetchone()
        db_count = db_row["distinct_visits"] if db_row else 0

        if abs(db_count - expected_count) > 0:
            bad_count.append(
                f"{name} reg={regulation}: CSV={expected_count} DB={db_count}"
            )

        # Flag if composite_pct > 50 (worst-offender list should have low rank)
        composite_pct = pct_map.get(fac_id)
        if composite_pct is not None and int(composite_pct) > 50:
            bad_rank.append(
                f"{name} (composite_pct={composite_pct})"
            )

    check(
        "All repeat-offender facilities found in DB",
        len(not_found) == 0,
        f"{len(not_found)} not found: {not_found[:3]}" if not_found else "",
    )
    check(
        "Repeat citation counts match DB",
        len(bad_count) == 0,
        f"{len(bad_count)} mismatch(es): {bad_count[:3]}" if bad_count else "",
    )
    if bad_rank:
        print(f"  WARNING: {len(bad_rank)} repeat offenders have composite_pct > 50 (good rank for bad actor):")
        for item in bad_rank:
            print(f"    • {item}")
    check(
        "Repeat offenders have low composite rank (≤ 50)",
        len(bad_rank) == 0,
        f"{len(bad_rank)} with composite_pct > 50" if bad_rank else "",
    )


def _check_chain_scorecard(cur) -> None:
    """
    For each chain in the TS report file, re-query the DB and confirm
    facility_count, total_beds, and WCS are within 5%.
    """
    print("\n[Chain scorecard reconciliation]")

    chains = _parse_chain_scorecard()
    if not chains:
        check(
            "CHAIN_SCORECARD parseable from TS file",
            False,
            "could not extract chain data",
        )
        return
    check("CHAIN_SCORECARD parseable from TS file", True, f"{len(chains)} chains")

    drift_failures = []

    for chain in chains:
        display = chain["displayName"]
        # Expand pipe-separated operator names for combined entities
        op_names = [
            n.strip()
            for n in chain["cdssOperatorNames"].replace(" | ", "|").split("|")
        ]
        expected_fac = chain["caFacilitiesInDataset"]
        expected_beds = chain["totalBeds"]
        expected_wcs = chain.get("weightedCitationScore") or 0.0

        # Build parameterized ILIKE OR clause
        ilike_clause = " OR ".join("LOWER(f.operator_name) = LOWER(%s)" for _ in op_names)
        params = op_names

        # Count facilities and sum beds
        cur.execute(
            f"""
            SELECT COUNT(*) AS fac_count, COALESCE(SUM(beds), 0) AS total_beds
            FROM facilities f
            WHERE f.state_code = 'CA'
              AND f.publishable = true
              AND ({ilike_clause})
            """,
            params,
        )
        row = cur.fetchone()
        db_fac = row["fac_count"] or 0
        db_beds = row["total_beds"] or 0

        # Recompute WCS: average per-facility (sum(severity) / beds) over last 3yr
        cur.execute(
            f"""
            SELECT
                f.id,
                f.beds,
                COALESCE(
                    SUM(COALESCE(d.severity, 1))::numeric / NULLIF(f.beds, 0),
                    0
                ) AS per_fac_wcs
            FROM facilities f
            LEFT JOIN inspections i
                ON i.facility_id = f.id
                AND i.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
            LEFT JOIN deficiencies d ON d.inspection_id = i.id
            WHERE f.state_code = 'CA'
              AND f.publishable = true
              AND ({ilike_clause})
            GROUP BY f.id, f.beds
            """,
            params,
        )
        wcs_rows = cur.fetchall()
        if wcs_rows:
            db_wcs = sum(r["per_fac_wcs"] for r in wcs_rows) / len(wcs_rows)
        else:
            db_wcs = 0.0

        def _within_5pct(expected: float, actual: float) -> bool:
            if expected == 0 and actual == 0:
                return True
            if expected == 0:
                return abs(actual) < 0.01
            return abs(actual - expected) / max(abs(expected), 0.001) <= 0.05

        fac_ok = _within_5pct(float(expected_fac), float(db_fac))
        beds_ok = _within_5pct(float(expected_beds), float(db_beds))
        wcs_ok = _within_5pct(float(expected_wcs), float(db_wcs))

        if not (fac_ok and beds_ok and wcs_ok):
            detail = (
                f"fac: expect={expected_fac} db={db_fac} {'OK' if fac_ok else 'DRIFT'} | "
                f"beds: expect={expected_beds} db={db_beds} {'OK' if beds_ok else 'DRIFT'} | "
                f"wcs: expect={expected_wcs:.3f} db={db_wcs:.3f} {'OK' if wcs_ok else 'DRIFT'}"
            )
            drift_failures.append(f"{display}: {detail}")

        check(
            f"Chain '{display}' within 5% of DB",
            fac_ok and beds_ok and wcs_ok,
            f"fac={db_fac}/{expected_fac} beds={db_beds}/{expected_beds} wcs={db_wcs:.3f}/{expected_wcs:.3f}",
        )

    if drift_failures:
        print("  Chains that have drifted:")
        for f in drift_failures:
            print(f"    • {f}")


def _check_positive_label_audit(cur) -> None:
    """
    Scan all facility content headlines for positive superlatives.
    Flag if composite_pct < 50.
    """
    print("\n[Positive label audit — content headlines vs composite rank]")

    POSITIVE_TERMS = [
        "highly rated",
        "top rated",
        "award",
        "best in",
        "outstanding",
    ]
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
        ORDER BY pct.composite_pct ASC
        """,
        params,
    )
    all_hits = cur.fetchall()
    low_rank_hits = [r for r in all_hits if r["composite_pct"] is not None and int(r["composite_pct"]) < 50]

    print(f"  Total facilities with positive headline: {len(all_hits)}")
    if low_rank_hits:
        print(f"  Facilities with positive headline AND composite_pct < 50 ({len(low_rank_hits)}):")
        for row in low_rank_hits:
            print(
                f"    • {row['name']} ({row['state_code']}) "
                f"slug={row['slug']} "
                f"composite_pct={row['composite_pct']} "
                f"headline=\"{row['headline']}\""
            )

    check(
        "No positive headlines with composite_pct < 50",
        len(low_rank_hits) == 0,
        f"{len(low_rank_hits)} affected facilities" if low_rank_hits else "",
    )


def main() -> None:
    print("=" * 60)
    print("StarlynnCare — Layer 2: Content Validation Checks")
    print("=" * 60)

    with get_conn() as conn:
        with conn.cursor() as cur:
            _check_repeat_offender_csv(cur)
            _check_chain_scorecard(cur)
            _check_positive_label_audit(cur)

    run_all_checks("Layer 2 (content checks)")


if __name__ == "__main__":
    main()
