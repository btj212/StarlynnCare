#!/usr/bin/env python3
"""CLI runner for all StarlynnCare analyses.

Usage:
    python3 scripts/analyses/run_all.py                       # run all
    python3 scripts/analyses/run_all.py --only cost_vs_quality_ca
    python3 scripts/analyses/run_all.py --list                # list registered analyses
"""
from __future__ import annotations

import argparse
import importlib
import sys
import traceback
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ANALYSES_DIR = REPO_ROOT / "docs" / "analyses"

# Registry: slug → module_path
REGISTRY: dict[str, str] = {
    "cost_vs_quality_ca": "scripts.analyses.cost_vs_quality_ca",
    "chain_operator_scorecard_ca": "scripts.analyses.chain_operator_scorecard_ca",
    "repeat_offender_report": "scripts.analyses.repeat_offender_report",
    "memory_care_specific_violations": "scripts.analyses.memory_care_specific_violations",
    "geographic_equity_map": "scripts.analyses.geographic_equity_map",
    "severity_trends_2020_2025": "scripts.analyses.severity_trends_2020_2025",
    "worst_week_seasonal": "scripts.analyses.worst_week_seasonal",
}


def run_analysis(slug: str) -> dict | None:
    """Import and execute a single analysis module. Returns findings dict or None on error."""
    module_path = REGISTRY[slug]
    print(f"\n{'='*60}")
    print(f"  Running: {slug}")
    print(f"{'='*60}")
    try:
        # Add repo root to path so relative imports work
        if str(REPO_ROOT) not in sys.path:
            sys.path.insert(0, str(REPO_ROOT))
        mod = importlib.import_module(module_path)
        result = mod.run()
        print(f"  ✓ {slug} complete")
        return result
    except Exception:
        print(f"  ✗ {slug} failed:")
        traceback.print_exc()
        return None


def write_index(results: dict[str, dict | None]) -> None:
    """Write docs/analyses/INDEX.md with a summary table."""
    ANALYSES_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "# Stage 6 Analysis Index",
        "",
        f"*Last updated: {now}*",
        "",
        "| Analysis | Run Date | Top Finding | Output |",
        "|----------|----------|-------------|--------|",
    ]
    for slug, result in results.items():
        if result:
            top = result.get("top_finding", "—")
            run_date = result.get("run_date", now)
        else:
            top = "ERROR — see terminal output"
            run_date = now
        lines.append(f"| {slug} | {run_date} | {top} | [docs/analyses/{slug}/](docs/analyses/{slug}/) |")
    lines.append("")
    index_path = ANALYSES_DIR / "INDEX.md"
    index_path.write_text("\n".join(lines))
    print(f"\nIndex written → {index_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run StarlynnCare analyses")
    parser.add_argument("--only", metavar="SLUG", help="Run a single analysis by slug")
    parser.add_argument("--list", action="store_true", help="List registered analyses and exit")
    args = parser.parse_args()

    if args.list:
        print("Registered analyses:")
        for slug in REGISTRY:
            print(f"  {slug}")
        return

    # Ensure repo root on sys.path
    if str(REPO_ROOT) not in sys.path:
        sys.path.insert(0, str(REPO_ROOT))

    if args.only:
        if args.only not in REGISTRY:
            print(f"Unknown analysis: {args.only}")
            print(f"Available: {', '.join(REGISTRY)}")
            sys.exit(1)
        slugs = [args.only]
    else:
        slugs = list(REGISTRY)

    results: dict[str, dict | None] = {}
    for slug in slugs:
        results[slug] = run_analysis(slug)

    write_index(results)

    failed = [s for s, r in results.items() if r is None]
    if failed:
        print(f"\n⚠  {len(failed)} analysis/analyses failed: {', '.join(failed)}")
        sys.exit(1)
    else:
        print(f"\n✓ All {len(results)} analyses completed successfully.")


if __name__ == "__main__":
    main()
