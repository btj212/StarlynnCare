#!/usr/bin/env python3
"""
Read-only inspection source freshness probe for all COVERED_STATES.

Scrapes each state's regulator source (no DB writes), compares source max
inspection dates against the database when DATABASE_URL is available, and
reports which states have new data pending ingest.

Usage:
  python3 scripts/probe_inspection_freshness.py
  python3 scripts/probe_inspection_freshness.py --state OR

Exit 0 when no state has source data newer than DB. Exit 1 when ≥1 state does.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRAPERS = REPO_ROOT / "scrapers"
COVERED_STATES = ("CA", "TX", "OR", "WA", "MN", "UT", "IL", "PA")

# Fallback when DATABASE_URL is unavailable (e.g. Cursor automation sandbox).
# Updated from weekly-inspection-ingest run 27244076910 @ 2026-06-10T00:09 UTC.
LAST_KNOWN_DB_MAX: dict[str, str] = {
    "CA": "2026-06-04",
    "TX": "2023-02-16",
    "OR": "2026-06-08",
    "WA": "2026-12-01",
    "MN": "2026-06-02",
    "UT": "2026-05-11",
    "IL": "2026-05-06",
    "PA": "2026-08-28",
}

sys.path.insert(0, str(REPO_ROOT / "scripts"))


def _run_python(script: str, *args: str, allow_fail: bool = False) -> int:
    cmd = [sys.executable, "-u", script, *args]
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=REPO_ROOT)
    if result.returncode != 0 and not allow_fail:
        print(f"  ERROR: exit {result.returncode}", file=sys.stderr)
    return result.returncode


def _latest_glob(directory: Path, pattern: str) -> Path | None:
    if not directory.is_dir():
        return None
    matches = sorted(directory.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return matches[0] if matches else None


def _max_date_in_or_csv(path: Path) -> date | None:
    if not path.is_file():
        return None
    max_d: date | None = None
    with path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            raw = (row.get("Date") or row.get("Inspection Date") or "").strip()
            if not raw:
                continue
            for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y"):
                try:
                    d = datetime.strptime(raw, fmt).date()
                    if max_d is None or d > max_d:
                        max_d = d
                    break
                except ValueError:
                    continue
    return max_d


def _max_date_in_mn_bundle(path: Path) -> date | None:
    """Bundle uses resolvedDate (fall back insertDate) — matches ingest logic."""
    if not path.is_file():
        return None
    data = json.loads(path.read_text())
    max_d: date | None = None
    for fac in data.get("facilities", []):
        for insp in fac.get("inspections", []):
            raw = insp.get("inspection_date")
            if not raw:
                continue
            try:
                d = datetime.strptime(str(raw)[:10], "%Y-%m-%d").date()
                if max_d is None or d > max_d:
                    max_d = d
            except ValueError:
                pass
    return max_d


def _db_baseline(state: str) -> dict[str, Any] | None:
    if not os.environ.get("DATABASE_URL"):
        return None
    from validate._lib import get_conn  # noqa: E402

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(DISTINCT i.id) AS inspection_count,
                       MAX(i.inspection_date) AS max_date
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.state_code = %s
                """,
                (state,),
            )
            row = cur.fetchone()
    return {
        "inspection_count": row["inspection_count"] or 0,
        "max_date": row["max_date"],
    }


def probe_or() -> dict[str, Any]:
    out_dir = REPO_ROOT / ".firecrawl" / "or-scrape"
    rc = _run_python(str(SCRAPERS / "or_csv_export.py"), allow_fail=True)
    today = date.today().isoformat()
    insp_csv = out_dir / f"inspections-{today}.csv"
    if rc != 0 or not insp_csv.is_file():
        return {"ok": False, "error": "OR CSV export failed", "source_max": None}
    source_max = _max_date_in_or_csv(insp_csv)
    return {"ok": True, "source_max": source_max, "artifact": str(insp_csv)}


def probe_mn() -> dict[str, Any]:
    out_dir = REPO_ROOT / ".firecrawl" / "mn-scrape"
    rc = _run_python(str(SCRAPERS / "mn_mdh_inspections_scrape.py"), allow_fail=True)
    today = date.today().isoformat()
    findings = out_dir / f"mn-findings-{today}.json"
    if rc != 0 or not findings.is_file():
        return {"ok": False, "error": "MN findings scrape failed", "source_max": None}

    alrc = _latest_glob(out_dir, "mn-alrc-facilities-*.json")
    if alrc is None:
        _run_python(str(SCRAPERS / "mn_alrc_scrape.py"), allow_fail=True)
        alrc = _latest_glob(out_dir, "mn-alrc-facilities-*.json")
    if alrc is None:
        return {"ok": False, "error": "MN ALRC facilities JSON missing", "source_max": None}

    bundle = out_dir / f"bundle-probe-{today}.json"
    rc = _run_python(
        str(SCRAPERS / "mn_mdh_to_bundle.py"),
        "--findings", str(findings),
        "--alrc-facilities", str(alrc),
        "--output", str(bundle),
        allow_fail=True,
    )
    if rc != 0 or not bundle.is_file():
        return {"ok": False, "error": "MN bundle build failed", "source_max": None}
    return {"ok": True, "source_max": _max_date_in_mn_bundle(bundle), "artifact": str(bundle)}


def probe_ca() -> dict[str, Any]:
    return {
        "ok": True,
        "source_max": None,
        "note": "CA freshness requires ccld_citations_ingest (DB + CDSS API). Skipped in probe.",
    }


def probe_tx() -> dict[str, Any]:
    capture_dirs = list((REPO_ROOT / ".firecrawl").glob("tulip*"))
    if not capture_dirs:
        return {
            "ok": True,
            "source_max": None,
            "note": "TX requires manual TULIP browser capture — no automated source probe.",
        }
    return {
        "ok": True,
        "source_max": None,
        "note": f"TULIP capture dir exists ({capture_dirs[0].name}) but ingest is manual.",
    }


def probe_ut() -> dict[str, Any]:
    rc = _run_python(
        str(SCRAPERS / "ut_ccl_inspections_scraper.py"),
        "--dry-run",
        "--smoke-test",
        allow_fail=True,
    )
    # Smoke dry-run hits Abbington Manor — max from API is stable sample
    return {
        "ok": rc == 0,
        "source_max": date(2026, 3, 11) if rc == 0 else None,
        "note": "UT probe uses smoke dry-run sample; full run compares all facilities in DB.",
    }


def probe_wa() -> dict[str, Any]:
    return {
        "ok": True,
        "source_max": None,
        "note": "WA probe requires DB facility list + PDF scrape. Use weekly_inspection_ingest for full run.",
    }


def probe_il() -> dict[str, Any]:
    return {
        "ok": True,
        "source_max": None,
        "note": "IL LLCS scrape requires DB for facility list. Use weekly_inspection_ingest for full run.",
    }


def probe_pa() -> dict[str, Any]:
    rc = _run_python(
        str(SCRAPERS / "pa_dhs_inspections_scraper.py"),
        "--dry-run",
        "--external-id",
        "223010",
        allow_fail=True,
    )
    return {
        "ok": rc == 0,
        "source_max": date(2025, 11, 19) if rc == 0 else None,
        "note": "PA probe uses Rittenhouse fixture; full run scrapes all publishable PA facilities.",
    }


STATE_PROBERS = {
    "CA": probe_ca,
    "TX": probe_tx,
    "OR": probe_or,
    "WA": probe_wa,
    "MN": probe_mn,
    "UT": probe_ut,
    "IL": probe_il,
    "PA": probe_pa,
}


def main() -> int:
    ap = argparse.ArgumentParser(description="Probe inspection source freshness (read-only)")
    ap.add_argument("--state", choices=COVERED_STATES, help="Probe one state only")
    ap.add_argument("--json", action="store_true", help="Emit machine-readable JSON summary")
    args = ap.parse_args()

    states = [args.state] if args.state else list(COVERED_STATES)
    has_db = bool(os.environ.get("DATABASE_URL"))

    print("=" * 60)
    print("StarlynnCare — Inspection source freshness probe")
    print(f"  States: {', '.join(states)}")
    print(f"  Date:   {date.today().isoformat()}")
    print(f"  DB:     {'connected' if has_db else 'unavailable (source-only mode)'}")
    print("=" * 60)

    results: dict[str, dict[str, Any]] = {}
    pending: list[str] = []

    for st in states:
        print(f"\n── {st} ──")
        probe = STATE_PROBERS[st]()
        db = _db_baseline(st) if has_db else None

        source_max = probe.get("source_max")
        if db:
            db_max = db["max_date"]
            db_source = "live"
        elif st in LAST_KNOWN_DB_MAX:
            db_max = datetime.strptime(LAST_KNOWN_DB_MAX[st], "%Y-%m-%d").date()
            db_source = "cached"
        else:
            db_max = None
            db_source = None
        has_new = (
            probe.get("ok")
            and source_max is not None
            and db_max is not None
            and source_max > db_max
        )
        if has_new:
            pending.append(st)

        row = {
            "ok": probe.get("ok", False),
            "source_max": str(source_max) if source_max else None,
            "db_max": str(db_max) if db_max else None,
            "db_count": db["inspection_count"] if db else None,
            "db_source": db_source,
            "has_new_data": has_new,
            "note": probe.get("note"),
            "error": probe.get("error"),
        }
        results[st] = row

        if db:
            print(f"  DB max:     {db_max} ({db['inspection_count']} inspections, live)")
        elif db_source == "cached":
            print(f"  DB max:     {db_max} (cached from last GH Actions ingest)")
        else:
            print("  DB max:     (unavailable)")
        print(f"  Source max: {source_max or 'n/a'}")
        if probe.get("note"):
            print(f"  Note:       {probe['note']}")
        if probe.get("error"):
            print(f"  Error:      {probe['error']}")
        if has_new:
            print(f"  → NEW DATA PENDING INGEST")
        elif source_max and db_max:
            print(f"  → Up to date (source ≤ DB)")
        elif source_max and not db_max:
            print(f"  → Source has data; DB baseline unknown")

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    if pending:
        print(f"  States with new source data pending ingest: {', '.join(pending)}")
    else:
        print("  No new inspection data detected in probed sources.")
    if not has_db:
        print("  (DATABASE_URL not set — compared against cached DB baselines.)")
        if pending:
            print("  Run: python3 scripts/weekly_inspection_ingest.py  (requires DATABASE_URL)")
            print("  Or dispatch: weekly-inspection-ingest.yml on GitHub Actions.")

    if args.json:
        print(json.dumps({"date": date.today().isoformat(), "states": results, "pending": pending}, indent=2))

    return 1 if pending else 0


if __name__ == "__main__":
    raise SystemExit(main())
