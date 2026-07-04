#!/usr/bin/env python3
"""
Source-only inspection freshness probe for all COVERED_STATES.

Downloads regulator exports where possible (no DATABASE_URL required) and
compares source max dates against production API baselines or optional DB
baselines when DATABASE_URL is set.

Usage:
  python3 scripts/probe_inspection_freshness.py
  python3 scripts/probe_inspection_freshness.py --state OR
  python3 scripts/probe_inspection_freshness.py --skip-download   # use cached files only

Exit 0 always — this is a read-only reconnaissance tool.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRAPERS = REPO_ROOT / "scrapers"
COVERED_STATES = ("CA", "TX", "OR", "WA", "MN", "UT", "IL", "PA", "AZ", "MO")
STATE_SLUGS = {
    "CA": "california",
    "TX": "texas",
    "OR": "oregon",
    "WA": "washington",
    "MN": "minnesota",
    "UT": "utah",
    "IL": "illinois",
    "PA": "pennsylvania",
    "AZ": "arizona",
    "MO": "missouri",
}
PRODUCTION_API = "https://www.starlynncare.com/api/facilities"

# Last known DB max dates from GitHub Actions weekly-inspection-ingest runs.
# Run 28688642112 (2026-07-04T00:02 UTC, push-triggered after schedule 28688620603):
#   MN +4 max=2026-06-24; all other matrix states +0.
# Cron probe 2026-07-04T23:01 UTC flagged MN insertDate max 2026-07-04 (+6 events vs baseline 2026-07-03).
# CA/TX/WA/UT/IL/PA/AZ/MO: no new source data detected (DB-backed states need workflow ingest).
# Used when DATABASE_URL is unavailable.
LAST_INGEST_BASELINES: dict[str, date] = {
    "CA": date(2026, 6, 26),
    "TX": date(2023, 2, 16),
    "OR": date(2026, 7, 1),
    "WA": date(2026, 12, 1),  # known data-quality outlier in source
    "MN": date(2026, 6, 24),
    "UT": date(2026, 6, 9),
    "IL": date(2026, 5, 6),
    "PA": date(2026, 8, 28),
    "AZ": date(2026, 7, 1),
    "MO": date(2026, 6, 1),  # FOIA Excel; no live regulator feed
}
# MN MDH posts events with insertDate later than resolvedDate; track separately.
LAST_MN_INSERT_BASELINE = date(2026, 7, 3)


def _run(cmd: list[str], *, label: str) -> int:
    print(f"\n── {label} ──")
    print(f"  $ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=REPO_ROOT).returncode


def _max_or_csv(path: Path) -> tuple[int, date | None]:
    if not path.is_file():
        return 0, None
    max_d: date | None = None
    count = 0
    with path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            count += 1
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
                    pass
    return count, max_d


def _max_mn_json(path: Path) -> tuple[int, date | None, date | None]:
    if not path.is_file():
        return 0, None, None
    data = json.loads(path.read_text())
    max_resolved: date | None = None
    max_insert: date | None = None
    count = 0
    for fac in data:
        for key in ("inspections", "complaints"):
            for insp in fac.get(key) or []:
                count += 1
                for field, target in (("resolvedDate", "resolved"), ("insertDate", "insert")):
                    raw = insp.get(field)
                    if not raw:
                        continue
                    try:
                        d = datetime.strptime(raw, "%m/%d/%Y").date()
                    except ValueError:
                        continue
                    if target == "resolved":
                        if max_resolved is None or d > max_resolved:
                            max_resolved = d
                    elif max_insert is None or d > max_insert:
                        max_insert = d
    return count, max_resolved, max_insert


def _production_max_date(state_code: str) -> date | None:
    slug = STATE_SLUGS[state_code]
    url = f"{PRODUCTION_API}/{slug}"
    req = urllib.request.Request(url, headers={"User-Agent": "StarlynnCare-probe/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        print(f"  WARN: production API failed for {state_code}: {exc}")
        return None
    dates: list[date] = []
    for fac in data.get("facilities", []):
        raw = fac.get("last_inspection_date")
        if not raw:
            continue
        try:
            dates.append(datetime.strptime(raw[:10], "%Y-%m-%d").date())
        except ValueError:
            pass
    return max(dates) if dates else None


def _db_baseline(state_code: str) -> dict[str, Any] | None:
    if not os.environ.get("DATABASE_URL"):
        return None
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from validate._lib import get_conn  # noqa: E402

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(DISTINCT i.id) AS n, MAX(i.inspection_date) AS max_date
            FROM inspections i
            JOIN facilities f ON f.id = i.facility_id
            WHERE f.state_code = %s
            """,
            (state_code,),
        )
        row = cur.fetchone()
    return {"count": row["n"] or 0, "max_date": row["max_date"]}


def probe_or(skip_download: bool) -> dict[str, Any]:
    out_dir = REPO_ROOT / ".firecrawl" / "or-scrape"
    if not skip_download:
        _run([sys.executable, str(SCRAPERS / "or_csv_export.py")], label="OR CSV export")
    today = date.today().isoformat()
    insp = out_dir / f"inspections-{today}.csv"
    count, source_max = _max_or_csv(insp)
    return {"state": "OR", "source_rows": count, "source_max": source_max, "source_file": str(insp)}


def probe_mn(skip_download: bool) -> dict[str, Any]:
    out_dir = REPO_ROOT / ".firecrawl" / "mn-scrape"
    if not skip_download:
        _run([sys.executable, str(SCRAPERS / "mn_mdh_inspections_scrape.py")], label="MN MDH findings")
    today = date.today().isoformat()
    findings = out_dir / f"mn-findings-{today}.json"
    count, source_max, insert_max = _max_mn_json(findings)
    return {
        "state": "MN",
        "source_rows": count,
        "source_max": source_max,
        "source_insert_max": insert_max,
        "source_file": str(findings),
    }


def probe_static(state: str, note: str) -> dict[str, Any]:
    return {"state": state, "source_rows": None, "source_max": None, "note": note}


STATE_PROBERS = {
    "CA": lambda skip: probe_static("CA", "Requires DATABASE_URL for ccld_citations_ingest; use cdss-weekly-ingest.yml"),
    "TX": lambda skip: probe_static("TX", "TULIP Aura JSON requires manual browser capture"),
    "OR": probe_or,
    "WA": lambda skip: probe_static("WA", "Requires DATABASE_URL for facility list; use weekly_inspection_ingest.py"),
    "MN": probe_mn,
    "UT": lambda skip: probe_static("UT", "Requires DATABASE_URL for facility list; use weekly_inspection_ingest.py"),
    "IL": lambda skip: probe_static("IL", "Requires DATABASE_URL for facility list; use weekly_inspection_ingest.py"),
    "PA": lambda skip: probe_static("PA", "Requires DATABASE_URL for facility list; use weekly_inspection_ingest.py"),
    "AZ": lambda skip: probe_static("AZ", "Requires DATABASE_URL for facility list; use weekly_inspection_ingest.py"),
    "MO": lambda skip: probe_static("MO", "FOIA Excel (missourirecords.xlsx) — no live regulator feed; manual refresh"),
}


def main() -> int:
    ap = argparse.ArgumentParser(description="Source-only inspection freshness probe")
    ap.add_argument("--state", choices=COVERED_STATES)
    ap.add_argument("--skip-download", action="store_true")
    args = ap.parse_args()

    states = [args.state] if args.state else list(COVERED_STATES)
    print("=" * 60)
    print("StarlynnCare — Inspection source freshness probe")
    print(f"  Date: {date.today().isoformat()}")
    print(f"  States: {', '.join(states)}")
    print("=" * 60)

    pending: list[str] = []
    results: list[dict[str, Any]] = []

    for st in states:
        print(f"\n{'=' * 60}\n  STATE: {st}\n{'=' * 60}")
        probe = STATE_PROBERS[st](args.skip_download)
        db = _db_baseline(st)
        prod_max = _production_max_date(st)

        probe["db_max"] = db["max_date"] if db else None
        probe["db_count"] = db["count"] if db else None
        probe["production_max"] = prod_max

        last_ingest = LAST_INGEST_BASELINES.get(st)
        baseline = probe["db_max"] or last_ingest or probe["production_max"]
        source_max = probe.get("source_max")
        probe["last_ingest_max"] = last_ingest
        insert_max = probe.get("source_insert_max")
        mn_insert_pending = (
            st == "MN"
            and insert_max is not None
            and insert_max > LAST_MN_INSERT_BASELINE
        )
        if (source_max and baseline and source_max > baseline) or mn_insert_pending:
            probe["pending_new_data"] = True
            pending.append(st)
        else:
            probe["pending_new_data"] = False

        results.append(probe)

        print(f"  source_max:     {source_max}")
        if probe.get("source_insert_max"):
            print(f"  source_insert:  {probe['source_insert_max']}")
        print(f"  db_max:         {probe['db_max']}")
        print(f"  last_ingest:    {last_ingest}")
        print(f"  production_max: {prod_max}")
        if probe.get("note"):
            print(f"  note:           {probe['note']}")
        if probe.get("pending_new_data"):
            print("  >>> NEW DATA LIKELY — run weekly_inspection_ingest.py")
        else:
            print("  no new source data detected (or probe unavailable)")

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    if pending:
        print(f"  States with likely new data: {', '.join(pending)}")
        print("  Action: run scripts/weekly_inspection_ingest.py (requires DATABASE_URL)")
    else:
        print("  No new source data detected in probed states.")
        skipped = [r["state"] for r in results if r.get("note")]
        if skipped:
            print(f"  States not fully probed (need DB or manual): {', '.join(skipped)}")

    report_path = REPO_ROOT / ".firecrawl" / f"freshness-probe-{date.today().isoformat()}.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(results, indent=2, default=str))
    print(f"\n  Report: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
