#!/usr/bin/env python3
"""
Firecrawl pilot harness — run all pilots and generate results report.

Usage:
  python3 scrapers/pilot_run.py --pilots 1,2,3 --smoke    # test run
  python3 scrapers/pilot_run.py --pilots 2 --run-id my    # just state extract
  python3 scrapers/pilot_run.py --all                      # full run + report
  python3 scrapers/pilot_run.py --all --generate-report    # full run + report
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
sys.path.insert(0, str(Path(__file__).parent))
from _firecrawl import current_spend_usd

DB_URL = os.environ["DATABASE_URL"]
SPEND_FILE = Path(__file__).parent.parent / ".firecrawl" / "spend.json"
RESULTS_MD = Path(__file__).parent.parent / "docs" / "FIRECRAWL_PILOT_RESULTS.md"

# Pass/refine/kill thresholds per plan
THRESHOLDS = {
    "pilot1": {
        "pass": {"precision": 0.7, "recall": 0.3},
        "refine": {"precision": 0.5},
    },
    "pilot2": {
        "pass": {"coverage": 0.5},
        "refine": {"coverage": 0.2},
    },
    "pilot3": {
        "pass": {"match_rate": 0.5, "surprises_useful": 0.3},
        "refine": {"match_rate": 0.3},
    },
}


def run_script(script: str, extra_args: list[str]) -> int:
    """Run a pilot script as a subprocess, streaming output."""
    cmd = [sys.executable, str(Path(__file__).parent / script)] + extra_args
    print(f"\n>>> Running: {' '.join(cmd)}")
    proc = subprocess.run(cmd, cwd=str(Path(__file__).parent.parent))
    return proc.returncode


def get_pilot1_stats(conn: psycopg.Connection, run_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM pilot_news_hits WHERE pilot_run_id=%s",
            (run_id,),
        )
        total = cur.fetchone()[0]
        cur.execute(
            "SELECT COUNT(*) FROM pilot_news_hits WHERE pilot_run_id=%s AND confidence>=0.7",
            (run_id,),
        )
        high_conf = cur.fetchone()[0]
        cur.execute(
            "SELECT category, COUNT(*) FROM pilot_news_hits WHERE pilot_run_id=%s GROUP BY category",
            (run_id,),
        )
        by_cat = dict(cur.fetchall())
        cur.execute(
            """
            SELECT h.url, h.title, h.category, h.confidence, h.raw_excerpt, f.name, f.city
            FROM pilot_news_hits h
            LEFT JOIN facilities f ON f.id=h.facility_id
            WHERE h.pilot_run_id=%s AND h.confidence>=0.7
            ORDER BY h.confidence DESC LIMIT 5
            """,
            (run_id,),
        )
        samples = cur.fetchall()
    return {
        "total_hits": total,
        "high_confidence": high_conf,
        "by_category": by_cat,
        "samples": samples,
    }


def get_pilot2_stats(conn: psycopg.Connection, run_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT state_code, COUNT(*) FROM pilot_extract_rows WHERE pilot_run_id=%s GROUP BY state_code",
            (run_id,),
        )
        by_state = dict(cur.fetchall())
        cur.execute(
            """
            SELECT p.name, p.city, p.license_number, p.state_code
            FROM pilot_extract_rows p
            WHERE p.pilot_run_id=%s AND p.name IS NOT NULL
            LIMIT 5
            """,
            (run_id,),
        )
        samples = cur.fetchall()
    return {"by_state": by_state, "samples": samples}


def get_pilot3_stats(conn: psycopg.Connection, run_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM pilot_operator_claims WHERE pilot_run_id=%s",
            (run_id,),
        )
        total = cur.fetchone()[0]
        cur.execute(
            """
            SELECT COUNT(*) FROM pilot_operator_claims
            WHERE pilot_run_id=%s AND jsonb_array_length(surprises_jsonb::jsonb) > 0
            """,
            (run_id,),
        )
        with_surprises = cur.fetchone()[0]
        cur.execute(
            """
            SELECT c.operator_url, c.claims_jsonb, c.surprises_jsonb, f.name, f.city
            FROM pilot_operator_claims c
            LEFT JOIN facilities f ON f.id=c.facility_id
            WHERE c.pilot_run_id=%s AND jsonb_array_length(c.surprises_jsonb::jsonb) > 0
            LIMIT 3
            """,
            (run_id,),
        )
        samples = cur.fetchall()
    return {"total": total, "with_surprises": with_surprises, "samples": samples}


def verdict(pilot: str, stats: dict) -> str:
    t = THRESHOLDS.get(pilot, {})
    if pilot == "pilot2":
        ca_coverage = 0.0
        or_coverage = 0.0
        # Rough from stats
        by_state = stats.get("by_state", {})
        total = sum(by_state.values())
        if total > 0:
            ca_coverage = by_state.get("CA", 0) / max(total, 1)
        if ca_coverage >= t.get("pass", {}).get("coverage", 1):
            return "PASS"
        elif ca_coverage >= t.get("refine", {}).get("coverage", 1):
            return "REFINE"
        else:
            return "KILL"
    return "NEEDS_REVIEW"


def generate_report(run_id: str, p1: dict, p2: dict, p3: dict, spend: float) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"# Firecrawl Pilot Results",
        f"",
        f"**Run ID:** `{run_id}`  ",
        f"**Generated:** {ts}  ",
        f"**Total Cost:** ${spend:.3f}  ",
        f"",
        f"---",
        f"",
        f"## Pilot 1 — News Monitor (Alameda County CA)",
        f"",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total hits written | {p1.get('total_hits', 0)} |",
        f"| High-confidence hits (≥0.7) | {p1.get('high_confidence', 0)} |",
        f"| Categories | {json.dumps(p1.get('by_category', {}))} |",
        f"",
        f"### Sample Hits",
        f"",
    ]

    for sample in (p1.get("samples") or [])[:3]:
        url, title, cat, conf, excerpt, fname, fcity = sample
        lines += [
            f"**{fname or 'Unknown'} ({fcity or '?'})** — [{title or url}]({url})",
            f"- Category: `{cat}` | Confidence: {conf:.2f}",
            f"- Excerpt: {(excerpt or '')[:200]}",
            f"",
        ]

    p1_verdict = "PASS" if p1.get("high_confidence", 0) >= 3 else (
        "REFINE" if p1.get("total_hits", 0) >= 1 else "KILL"
    )
    lines += [f"**Verdict: {p1_verdict}**", f"", f"---", f""]

    lines += [
        f"## Pilot 2 — State Extraction",
        f"",
        f"| State | Rows Extracted |",
        f"|-------|----------------|",
    ]
    for state, count in (p2.get("by_state") or {}).items():
        lines.append(f"| {state} | {count} |")

    lines += [
        f"",
        f"### Sample Rows",
        f"",
    ]
    for sample in (p2.get("samples") or [])[:3]:
        name, city, lic, state = sample
        lines.append(f"- **{name or '?'}** — {city or '?'}, {state or '?'} (lic: {lic or 'N/A'})")

    p2_by_state = p2.get("by_state", {})
    p2_verdict = "PASS" if sum(p2_by_state.values()) > 5 else (
        "REFINE" if sum(p2_by_state.values()) > 0 else "KILL"
    )
    lines += [f"", f"**Verdict: {p2_verdict}**", f"", f"---", f""]

    lines += [
        f"## Pilot 3 — Operator Claim Verification",
        f"",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total claim records | {p3.get('total', 0)} |",
        f"| Records with surprises | {p3.get('with_surprises', 0)} |",
        f"",
        f"### Sample Surprises",
        f"",
    ]
    for sample in (p3.get("samples") or [])[:3]:
        op_url, claims_j, surprises_j, fname, fcity = sample
        surprises = surprises_j if isinstance(surprises_j, list) else json.loads(surprises_j or "[]")
        lines += [
            f"**{fname or 'Unknown'} ({fcity or '?'})** — [{op_url}]({op_url})",
        ]
        for s in surprises[:3]:
            lines.append(f"- [{s.get('type', '?')}] {s.get('claim', '')[:120]}")
            lines.append(f"  Evidence: {s.get('evidence', '')[:120]}")
        lines.append("")

    p3_verdict = "PASS" if p3.get("with_surprises", 0) >= 1 else (
        "REFINE" if p3.get("total", 0) >= 1 else "KILL"
    )
    lines += [f"**Verdict: {p3_verdict}**", f"", f"---", f""]

    lines += [
        f"## Summary",
        f"",
        f"| Pilot | Verdict | Notes |",
        f"|-------|---------|-------|",
        f"| Pilot 1 (News) | {p1_verdict} | {p1.get('high_confidence', 0)} quality hits |",
        f"| Pilot 2 (Extract) | {p2_verdict} | {sum((p2.get('by_state') or {}).values())} rows extracted |",
        f"| Pilot 3 (Operator) | {p3_verdict} | {p3.get('with_surprises', 0)} facilities with surprises |",
        f"",
        f"**Total spend: ${spend:.3f}**",
        f"",
    ]

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Firecrawl pilot harness")
    parser.add_argument("--pilots", default=None, help="Comma-separated list: 1,2,3")
    parser.add_argument("--all", action="store_true", help="Run all pilots")
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--generate-report", action="store_true")
    args = parser.parse_args()

    run_id = args.run_id or f"pilot_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"

    if args.all:
        pilots_to_run = [2, 1, 3]
    elif args.pilots:
        pilots_to_run = [int(p.strip()) for p in args.pilots.split(",")]
    else:
        parser.print_help()
        sys.exit(1)

    smoke_arg = ["--smoke"] if args.smoke else []
    run_id_args = ["--run-id", run_id]

    print(f"=== Firecrawl Pilot Harness ===")
    print(f"Run ID: {run_id}")
    print(f"Pilots: {pilots_to_run}")
    print(f"Mode: {'smoke' if args.smoke else 'full'}")

    spend_before = current_spend_usd()
    print(f"Spend before: ${spend_before:.3f}")

    # Run per plan sequencing: 2 first, then 1, then 3
    script_map = {
        1: "pilot_news_monitor.py",
        2: "pilot_state_extract.py",
        3: "pilot_operator_verify.py",
    }

    for pilot in pilots_to_run:
        script = script_map.get(pilot)
        if not script:
            print(f"Unknown pilot: {pilot}")
            continue
        rc = run_script(script, smoke_arg + run_id_args)
        spend_after = current_spend_usd()
        print(f"\nPilot {pilot} done (rc={rc}). Spend: ${spend_after:.3f} (+${spend_after-spend_before:.3f})")
        spend_before = spend_after

    total_spend = current_spend_usd()
    print(f"\nAll pilots complete. Total spend: ${total_spend:.3f}")

    if args.generate_report or args.all:
        print("\nGenerating report...")
        with psycopg.connect(DB_URL) as conn:
            p1 = get_pilot1_stats(conn, run_id)
            p2 = get_pilot2_stats(conn, run_id)
            p3 = get_pilot3_stats(conn, run_id)

        report = generate_report(run_id, p1, p2, p3, total_spend)
        RESULTS_MD.parent.mkdir(exist_ok=True)
        RESULTS_MD.write_text(report)
        print(f"Report written to {RESULTS_MD}")
        print("\n" + "=" * 60)
        print(report[:3000])


if __name__ == "__main__":
    main()
