#!/usr/bin/env python3
"""
facility_data_validity.py — Audit publishable facilities for real inspection text.

An inspection has "real narrative text" when inspection_has_real_narrative(id)
returns true (SQL helper from migration 0026). Facilities where none of their
freshness-window inspections pass this test are flagged.

Modes
-----
  --dry-run   (default) Print summary table. No DB writes.
  --write-queue         Upsert rows into facility_data_quality_issues.
  --write-report        Write docs/FACILITY_DATA_VALIDITY_AUDIT.md.
  --state XX            Filter to one state code.

Usage
-----
  python3 scripts/audit/facility_data_validity.py
  python3 scripts/audit/facility_data_validity.py --write-queue --write-report
  python3 scripts/audit/facility_data_validity.py --state WA --write-queue
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# ── Config ─────────────────────────────────────────────────────────────────

# Must match _FRESHNESS_MONTHS in recompute_publishable.py
FRESHNESS_MONTHS: dict[str, int | None] = {
    "CA": None,
    "TX": 48,
    "OR": 36,
    "MN": 48,
    "WA": 48,
}

REPORT_PATH = REPO_ROOT / "docs" / "FACILITY_DATA_VALIDITY_AUDIT.md"

ALL_STATES = list(FRESHNESS_MONTHS.keys())


# ── Env ────────────────────────────────────────────────────────────────────

def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ── Query ──────────────────────────────────────────────────────────────────

def classify_failure_reason(
    inspection_count: int,
    inspections_with_real_text: int,
    has_url_narratives: bool,
    has_placeholder_narratives: bool,
) -> str:
    if inspection_count == 0:
        return "no_inspections"
    if has_url_narratives:
        return "url_as_narrative"
    if has_placeholder_narratives:
        return "placeholder_narrative"
    return "no_narrative_text"


def audit_state(
    conn: psycopg.Connection,
    state_code: str,
) -> list[dict[str, Any]]:
    """
    Return one dict per publishable facility in state_code with validity data.
    """
    freshness_months = FRESHNESS_MONTHS.get(state_code.upper())
    if freshness_months is not None:
        since = date.today() - timedelta(days=freshness_months * 30)
        freshness_clause = "AND i.inspection_date >= %s"
        params: list[Any] = [state_code, since]
    else:
        freshness_clause = ""
        params = [state_code]

    sql = f"""
        SELECT
            f.id::text                         AS facility_id,
            f.name                             AS facility_name,
            f.city                             AS city,
            f.state_code,
            COUNT(i.id)::int                   AS inspection_count,
            SUM(CASE WHEN inspection_has_real_narrative(i.id) THEN 1 ELSE 0 END)::int
                                               AS inspections_with_real_text,
            -- detect URL-as-narrative: inspector_narrative starts with http
            BOOL_OR(
                EXISTS (
                    SELECT 1 FROM deficiencies d
                    WHERE d.inspection_id = i.id
                      AND d.inspector_narrative ~ '^https?://'
                )
            )                                  AS has_url_narratives,
            -- detect placeholder description
            BOOL_OR(
                EXISTS (
                    SELECT 1 FROM deficiencies d
                    WHERE d.inspection_id = i.id
                      AND d.description ~ '^WA DSHS report:'
                )
            )                                  AS has_placeholder_narratives,
            MAX(i.inspection_date)             AS last_inspection_date
        FROM facilities f
        LEFT JOIN inspections i
               ON i.facility_id = f.id
              {freshness_clause}
        WHERE f.state_code = %s
          AND f.publishable = true
        GROUP BY f.id, f.name, f.city, f.state_code
        ORDER BY f.name
    """

    # Reorder params: freshness date goes before state_code in the LEFT JOIN clause,
    # but state_code is the WHERE clause — need them in declaration order.
    if freshness_months is not None:
        ordered_params = [since, state_code]
    else:
        ordered_params = [state_code]

    with conn.cursor() as cur:
        cur.execute(sql, ordered_params)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]

    results: list[dict[str, Any]] = []
    for row in rows:
        insp_count: int = row["inspection_count"] or 0
        real_count: int = row["inspections_with_real_text"] or 0
        has_real = real_count > 0
        failed = not has_real

        reason: str | None = None
        if failed:
            reason = classify_failure_reason(
                insp_count,
                real_count,
                bool(row["has_url_narratives"]),
                bool(row["has_placeholder_narratives"]),
            )

        results.append(
            {
                "facility_id": row["facility_id"],
                "facility_name": row["facility_name"],
                "city": row["city"],
                "state_code": row["state_code"],
                "inspection_count": insp_count,
                "inspections_with_real_text": real_count,
                "has_real_inspection_text": has_real,
                "reason": reason,
                "last_inspection_date": row["last_inspection_date"],
            }
        )

    return results


# ── Queue writer ────────────────────────────────────────────────────────────

def write_queue(conn: psycopg.Connection, rows: list[dict[str, Any]]) -> int:
    """Upsert failing facilities into facility_data_quality_issues. Returns count written."""
    failing = [r for r in rows if not r["has_real_inspection_text"]]
    if not failing:
        return 0

    with conn.cursor() as cur:
        for r in failing:
            cur.execute(
                """
                INSERT INTO facility_data_quality_issues (
                    facility_id, state_code, reason,
                    inspection_count, inspections_with_real_text,
                    last_inspection_date, scanned_at
                ) VALUES (
                    %s::uuid, %s, %s, %s, %s, %s, now()
                )
                ON CONFLICT (facility_id) DO UPDATE SET
                    state_code               = EXCLUDED.state_code,
                    reason                   = EXCLUDED.reason,
                    inspection_count         = EXCLUDED.inspection_count,
                    inspections_with_real_text = EXCLUDED.inspections_with_real_text,
                    last_inspection_date     = EXCLUDED.last_inspection_date,
                    scanned_at               = now()
                """,
                (
                    r["facility_id"],
                    r["state_code"],
                    r["reason"],
                    r["inspection_count"],
                    r["inspections_with_real_text"],
                    r["last_inspection_date"],
                ),
            )
    conn.commit()
    return len(failing)


# ── Report writer ────────────────────────────────────────────────────────────

def write_report(
    all_rows: dict[str, list[dict[str, Any]]],
    report_path: Path,
) -> None:
    today = date.today().isoformat()
    lines: list[str] = [
        f"# Facility Data Validity Audit",
        f"",
        f"Generated: {today}",
        f"",
        f"A publishable facility **passes** the data-validity gate when at least one of its",
        f"inspections in the freshness window has real parsed narrative text (length ≥ 100 chars,",
        f"not a WA PDF-link placeholder). Facilities that fail are shown with a 'PDF links only'",
        f"banner and have their quality grade suppressed until PDFs are parsed.",
        f"",
        f"---",
        f"",
        f"## State-by-State Summary",
        f"",
        f"| State | Publishable | Has Real Text | % Real | Top failure reason |",
        f"|-------|-------------|--------------|--------|--------------------|",
    ]

    reason_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for state_code, rows in sorted(all_rows.items()):
        total = len(rows)
        with_real = sum(1 for r in rows if r["has_real_inspection_text"])
        failing = [r for r in rows if not r["has_real_inspection_text"]]
        pct = f"{round(with_real / total * 100)}%" if total else "—"

        for r in failing:
            if r["reason"]:
                reason_counts[state_code][r["reason"]] += 1

        top_reason = "—"
        if reason_counts[state_code]:
            top = max(reason_counts[state_code], key=lambda k: reason_counts[state_code][k])
            top_reason = f"{top} ({reason_counts[state_code][top]})"

        lines.append(f"| {state_code} | {total} | {with_real} | {pct} | {top_reason} |")

    lines += [
        f"",
        f"---",
        f"",
        f"## Failing Facilities (up to 50 per state)",
        f"",
    ]

    for state_code, rows in sorted(all_rows.items()):
        failing = [r for r in rows if not r["has_real_inspection_text"]]
        if not failing:
            continue

        lines.append(f"### {state_code} — {len(failing)} failing")
        lines.append(f"")
        lines.append(f"| Facility | City | Inspections (total / real) | Reason | Last Inspection |")
        lines.append(f"|----------|------|---------------------------|--------|-----------------|")
        for r in failing[:50]:
            insp_str = f"{r['inspection_count']} / {r['inspections_with_real_text']}"
            last = str(r["last_inspection_date"]) if r["last_inspection_date"] else "—"
            lines.append(
                f"| {r['facility_name']} | {r['city'] or '—'} | {insp_str} | {r['reason']} | {last} |"
            )
        if len(failing) > 50:
            lines.append(f"| *…{len(failing) - 50} more* | | | | |")
        lines.append(f"")

    lines += [
        f"---",
        f"",
        f"## Next Steps by State",
        f"",
        f"- **WA**: Parse PDF text from DSHS inspection reports. PDF URLs are stored in",
        f"  `deficiencies.inspector_narrative`. Run `pdfplumber` extraction, then re-run",
        f"  `summarize_inspections.py --state WA` to generate real AI summaries.",
        f"  See `docs/drafts/washington-pipeline-audit.md` Priority 1.",
        f"",
        f"- **OR/CA/MN/TX**: Review individual no-inspection or no-narrative facilities.",
        f"  These are likely recently-licensed or complaint-only facilities. No bulk action needed.",
        f"",
        f"---",
        f"",
        f"*Report generated: {today} | Read-only audit | No code or data was modified.*",
    ]

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Report written to {report_path}")


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Audit publishable facilities for real inspection text")
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="Print summary only, no DB writes (default)")
    parser.add_argument("--write-queue", action="store_true",
                        help="Upsert failing facilities into facility_data_quality_issues")
    parser.add_argument("--write-report", action="store_true",
                        help=f"Write {REPORT_PATH}")
    parser.add_argument("--state", type=str, default=None,
                        help="Only audit facilities in this state code (e.g. WA)")
    args = parser.parse_args()

    # --write-queue / --write-report imply not-dry-run reads, but we still
    # need a DB connection either way.
    load_env()
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn:
        print("ERROR: DATABASE_URL not set in .env.local", file=sys.stderr)
        sys.exit(1)

    states_to_audit = [args.state.upper()] if args.state else ALL_STATES

    all_rows: dict[str, list[dict[str, Any]]] = {}

    with psycopg.connect(dsn) as conn:
        for state_code in states_to_audit:
            print(f"\nAuditing {state_code}…")
            rows = audit_state(conn, state_code)
            all_rows[state_code] = rows

            total = len(rows)
            with_real = sum(1 for r in rows if r["has_real_inspection_text"])
            failing = total - with_real
            pct_real = f"{round(with_real / total * 100)}%" if total else "—"
            print(f"  {total} publishable | {with_real} with real text ({pct_real}) | {failing} failing")

            if failing and args.write_queue:
                written = write_queue(conn, rows)
                print(f"  Wrote {written} rows to facility_data_quality_issues")

    # Print summary table
    print("\n" + "=" * 70)
    print(f"{'State':<8} {'Publishable':>11} {'Real Text':>9} {'% Real':>7} {'Failing':>8}")
    print("-" * 70)
    grand_total = 0
    grand_real = 0
    for state_code in states_to_audit:
        rows = all_rows[state_code]
        total = len(rows)
        with_real = sum(1 for r in rows if r["has_real_inspection_text"])
        pct_real = f"{round(with_real / total * 100)}%" if total else "—"
        print(f"{state_code:<8} {total:>11} {with_real:>9} {pct_real:>7} {total - with_real:>8}")
        grand_total += total
        grand_real += with_real
    print("-" * 70)
    grand_pct = f"{round(grand_real / grand_total * 100)}%" if grand_total else "—"
    print(f"{'ALL':<8} {grand_total:>11} {grand_real:>9} {grand_pct:>7} {grand_total - grand_real:>8}")
    print("=" * 70)

    if args.write_report:
        write_report(all_rows, REPORT_PATH)


if __name__ == "__main__":
    main()
