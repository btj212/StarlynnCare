#!/usr/bin/env python3
"""
Weekly inspection check + ingest for all COVERED_STATES.

Queries the DB for baseline max inspection dates, runs each state's source
scraper/ingest pipeline, reports deltas, then runs post-ingest validation.

Usage:
  python3 scripts/weekly_inspection_ingest.py
  python3 scripts/weekly_inspection_ingest.py --state CA
  python3 scripts/weekly_inspection_ingest.py --skip-ca   # CA handled by cdss-weekly-ingest

Requires DATABASE_URL in .env.local or environment.
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

sys.path.insert(0, str(REPO_ROOT / "scripts"))
from validate._lib import get_conn  # noqa: E402


def _run(cmd: list[str], *, label: str, allow_fail: bool = False) -> int:
    print(f"\n── {label} ──")
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=REPO_ROOT)
    if result.returncode != 0 and not allow_fail:
        print(f"  ERROR: exit {result.returncode}", file=sys.stderr)
    return result.returncode


def _python(script: str, *args: str, label: str | None = None, allow_fail: bool = False) -> int:
    cmd = [sys.executable, "-u", script, *args]
    return _run(cmd, label=label or script, allow_fail=allow_fail)


def _baseline(cur, state: str) -> dict[str, Any]:
    cur.execute(
        """
        SELECT
            COUNT(DISTINCT i.id) AS inspection_count,
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


def _after_delta(cur, state: str, before: dict[str, Any]) -> dict[str, Any]:
    after = _baseline(cur, state)
    max_before = before["max_date"]
    max_after = after["max_date"]
    new_max = (
        max_after is not None
        and (max_before is None or max_after > max_before)
    )
    return {
        **after,
        "new_inspections": after["inspection_count"] - before["inspection_count"],
        "new_max_date": new_max,
        "changed": after["inspection_count"] != before["inspection_count"] or new_max,
    }


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
        reader = csv.DictReader(f)
        for row in reader:
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


def _max_date_in_mn_findings(path: Path) -> date | None:
    if not path.is_file():
        return None
    data = json.loads(path.read_text())
    max_d: date | None = None
    for fac in data:
        for key in ("inspections", "complaints"):
            for insp in fac.get(key) or []:
                for field in ("resolvedDate", "insertDate"):
                    raw = insp.get(field)
                    if not raw:
                        continue
                    try:
                        d = datetime.strptime(raw, "%m/%d/%Y").date()
                        if max_d is None or d > max_d:
                            max_d = d
                    except ValueError:
                        pass
    return max_d


def ingest_ca(skip: bool) -> bool:
    if skip:
        print("\n[CA] Skipped (--skip-ca)")
        return False
    rc = _python(str(SCRAPERS / "ccld_citations_ingest.py"), "--publishable", label="CA citations ingest")
    return rc == 0


def _or_source_max() -> date | None:
    out_dir = REPO_ROOT / ".firecrawl" / "or-scrape"
    rc = _python(str(SCRAPERS / "or_csv_export.py"), label="OR CSV export", allow_fail=True)
    if rc != 0:
        return None
    insp_csv = out_dir / f"inspections-{date.today().isoformat()}.csv"
    if not insp_csv.is_file():
        print("  OR: inspections CSV missing after export", file=sys.stderr)
        return None
    return _max_date_in_or_csv(insp_csv)


def _mn_source_max() -> date | None:
    out_dir = REPO_ROOT / ".firecrawl" / "mn-scrape"
    rc = _python(str(SCRAPERS / "mn_mdh_inspections_scrape.py"), label="MN MDH findings scrape", allow_fail=True)
    if rc != 0:
        return None
    findings = out_dir / f"mn-findings-{date.today().isoformat()}.json"
    if not findings.is_file():
        print("  MN: findings JSON missing", file=sys.stderr)
        return None
    return _max_date_in_mn_findings(findings)


def ingest_or(conn) -> bool:
    out_dir = REPO_ROOT / ".firecrawl" / "or-scrape"
    source_max = _or_source_max()
    if source_max is None:
        return False

    today = date.today().isoformat()
    insp_csv = out_dir / f"inspections-{today}.csv"
    with conn.cursor() as cur:
        base = _baseline(cur, "OR")
    db_max = base["max_date"]
    if source_max and db_max and source_max <= db_max:
        print(f"  OR: source max {source_max} ≤ DB max {db_max} — no new data, skipping ingest")
        return False

    _python(str(SCRAPERS / "or_inspections_ingest.py"), "--input", str(insp_csv), label="OR inspections ingest")
    # Violations CSV is 6MB+ and takes >1h — run monthly via or_overnight_run.sh, not weekly.
    _python(str(SCRAPERS / "recompute_publishable.py"), "--state", "OR", label="OR recompute publishable")
    return True


def ingest_wa(conn) -> bool:
    _python(str(SCRAPERS / "wa_afh_inspections_scrape.py"), label="WA AFH inspection scrape", allow_fail=True)
    _python(str(SCRAPERS / "wa_pdf_download.py"), label="WA PDF download", allow_fail=True)
    _python(str(SCRAPERS / "wa_pdf_parse.py"), label="WA PDF parse", allow_fail=True)
    _python(str(SCRAPERS / "wa_pdf_backfill.py"), label="WA PDF backfill", allow_fail=True)
    _python(str(SCRAPERS / "recompute_publishable.py"), "--state", "WA", label="WA recompute publishable")
    return True


def ingest_mn(conn) -> bool:
    out_dir = REPO_ROOT / ".firecrawl" / "mn-scrape"
    source_max = _mn_source_max()
    if source_max is None:
        return False

    today = date.today().isoformat()
    findings = out_dir / f"mn-findings-{today}.json"
    with conn.cursor() as cur:
        base = _baseline(cur, "MN")
    db_max = base["max_date"]
    if source_max and db_max and source_max <= db_max:
        print(f"  MN: source max {source_max} ≤ DB max {db_max} — no new data, skipping ingest")
        return False

    alrc = _latest_glob(out_dir, "mn-alrc-facilities-*.json")
    if alrc is None:
        _python(str(SCRAPERS / "mn_alrc_scrape.py"), label="MN ALRC scrape", allow_fail=True)
        alrc = _latest_glob(out_dir, "mn-alrc-facilities-*.json")
    if alrc is None:
        print("  MN: no ALRC facilities JSON — cannot bundle", file=sys.stderr)
        return False

    bundle = out_dir / f"bundle-{today}.json"
    _python(
        str(SCRAPERS / "mn_mdh_to_bundle.py"),
        "--findings", str(findings),
        "--alrc-facilities", str(alrc),
        "--output", str(bundle),
        label="MN bundle build",
    )
    if bundle.is_file():
        _python(
            str(SCRAPERS / "mn_inspections_ingest.py"),
            "--import-json", str(bundle),
            label="MN inspections ingest",
        )
    _python(str(SCRAPERS / "recompute_publishable.py"), "--state", "MN", label="MN recompute publishable")
    return True


def ingest_tx(_conn: object) -> bool:
    capture_dirs = list((REPO_ROOT / ".firecrawl").glob("tulip*"))
    if not capture_dirs:
        print("\n[TX] No TULIP capture directory — manual browser capture required; skipping.")
        return False
    print("\n[TX] TULIP ingest requires hand-captured Aura JSON — skipping automated weekly run.")
    return False


def ingest_ut(_conn: object) -> bool:
    _python(str(SCRAPERS / "ut_ccl_inspections_scraper.py"), label="UT CCL inspections", allow_fail=True)
    _python(str(SCRAPERS / "recompute_publishable.py"), "--state", "UT", label="UT recompute publishable")
    return True


def ingest_il(_conn: object) -> bool:
    _python(str(SCRAPERS / "il_llcs_event_scrape.py"), label="IL LLCS event scrape", allow_fail=True)
    _python(str(SCRAPERS / "il_pdf_download.py"), label="IL PDF download", allow_fail=True)
    _python(str(SCRAPERS / "il_pdf_parse.py"), label="IL PDF parse", allow_fail=True)
    _python(str(SCRAPERS / "il_pdf_backfill.py"), label="IL PDF backfill", allow_fail=True)
    _python(str(SCRAPERS / "recompute_publishable.py"), "--state", "IL", label="IL recompute publishable")
    return True


def ingest_pa(_conn: object) -> bool:
    _python(str(SCRAPERS / "pa_dhs_inspections_scraper.py"), label="PA DHS inspections scrape", allow_fail=True)
    _python(str(SCRAPERS / "pa_pdf_download.py"), label="PA PDF download", allow_fail=True)
    _python(str(SCRAPERS / "pa_pdf_parse.py"), label="PA PDF parse", allow_fail=True)
    _python(str(SCRAPERS / "pa_pdf_backfill.py"), label="PA PDF backfill", allow_fail=True)
    _python(str(SCRAPERS / "recompute_publishable.py"), "--state", "PA", label="PA recompute publishable")
    return True


STATE_RUNNERS = {
    "CA": lambda conn, skip_ca: ingest_ca(skip_ca),
    "OR": ingest_or,
    "WA": ingest_wa,
    "MN": ingest_mn,
    "TX": ingest_tx,
    "UT": ingest_ut,
    "IL": ingest_il,
    "PA": ingest_pa,
}

# Source-only freshness probes (no DATABASE_URL required).
SOURCE_CHECKERS: dict[str, Any] = {
    "OR": _or_source_max,
    "MN": _mn_source_max,
}


def _check_sources(states: list[str], db_baselines: dict[str, dict[str, Any]] | None) -> list[str]:
    """Return state codes whose regulator source has data newer than the DB max."""
    pending: list[str] = []
    label = "Source freshness check" if db_baselines else "Source-only freshness check (no DATABASE_URL)"
    print(f"\n[{label}]")
    for st in states:
        checker = SOURCE_CHECKERS.get(st)
        if checker is None:
            print(f"  {st}: no source-only probe — run full ingest with DATABASE_URL")
            continue
        source_max = checker()
        if db_baselines is None:
            print(f"  {st}: source max={source_max} (DB baseline unavailable)")
            continue
        db_max = db_baselines[st]["max_date"]
        newer = source_max is not None and (db_max is None or source_max > db_max)
        flag = "NEW DATA" if newer else "no change"
        print(f"  {st}: source max={source_max} db max={db_max} → {flag}")
        if newer:
            pending.append(st)
    return pending


def main() -> int:
    ap = argparse.ArgumentParser(description="Weekly inspection ingest for all covered states")
    ap.add_argument("--state", choices=COVERED_STATES, help="Run one state only")
    ap.add_argument("--skip-ca", action="store_true", help="Skip CA (already ran via cdss-weekly-ingest)")
    ap.add_argument("--skip-validate", action="store_true", help="Skip post-ingest validation")
    ap.add_argument(
        "--check-only",
        action="store_true",
        help="Probe regulator sources only; exit 2 if new data is pending ingest",
    )
    args = ap.parse_args()

    states = [args.state] if args.state else list(COVERED_STATES)

    if args.check_only:
        db_baselines: dict[str, dict[str, Any]] | None = None
        if os.environ.get("DATABASE_URL"):
            with get_conn() as conn:
                with conn.cursor() as cur:
                    db_baselines = {st: _baseline(cur, st) for st in states}
                    for st, base in db_baselines.items():
                        print(
                            f"  {st} DB baseline: {base['inspection_count']} inspections, "
                            f"max={base['max_date']}"
                        )
        else:
            print("  DATABASE_URL not set — comparing OR/MN sources only (no DB baseline).")
        pending = _check_sources(states, db_baselines)
        print("\n" + "=" * 60)
        print("CHECK-ONLY SUMMARY")
        print("=" * 60)
        if pending:
            print(f"  States with new source data pending ingest: {', '.join(pending)}")
            return 2
        print("  No new source data detected in checked states.")
        return 0
    print("=" * 60)
    print("StarlynnCare — Weekly inspection ingest")
    print(f"  States: {', '.join(states)}")
    print(f"  Date:   {date.today().isoformat()}")
    print("=" * 60)

    with get_conn() as conn:
        baselines: dict[str, dict[str, Any]] = {}
        with conn.cursor() as cur:
            for st in states:
                baselines[st] = _baseline(cur, st)
                print(f"  {st} baseline: {baselines[st]['inspection_count']} inspections, max={baselines[st]['max_date']}")

        changed_states: list[str] = []
        for st in states:
            print(f"\n{'=' * 60}\n  STATE: {st}\n{'=' * 60}")
            runner = STATE_RUNNERS[st]
            if st == "CA":
                runner(conn, args.skip_ca)
            else:
                runner(conn)

            with conn.cursor() as cur:
                delta = _after_delta(cur, st, baselines[st])
            print(
                f"  {st} result: +{delta['new_inspections']} inspections, "
                f"max={delta['max_date']} (was {baselines[st]['max_date']})"
            )
            if delta["changed"]:
                changed_states.append(st)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    if changed_states:
        print(f"  States with new/changed inspection data: {', '.join(changed_states)}")
    else:
        print("  No new inspection data ingested in any state.")

    if args.skip_validate:
        return 0

    for st in changed_states or states:
        _python(
            str(REPO_ROOT / "scripts" / "validate" / "post_ingest_check.py"),
            "--state", st,
            label=f"Layer 5 post-ingest — {st}",
            allow_fail=True,
        )

    _python(
        str(REPO_ROOT / "scripts" / "validate" / "hub_content_drift_check.py"),
        label="Layer 5b hub content drift",
        allow_fail=True,
    )

    _python(
        str(REPO_ROOT / "scripts" / "validate" / "smoke_test.py"),
        "--env", "production",
        label="Layer 3 production smoke",
        allow_fail=True,
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
