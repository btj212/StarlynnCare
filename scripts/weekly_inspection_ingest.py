#!/usr/bin/env python3
"""
Weekly source scan + ingest for all live states.

Queries the DB for baseline max inspection dates, runs each state's source
scraper/ingest pipeline, records source outcomes and material facility deltas,
then runs post-ingest validation.

Usage:
  python3 scripts/weekly_inspection_ingest.py
  python3 scripts/weekly_inspection_ingest.py --state CA
  python3 scripts/weekly_inspection_ingest.py --skip-ca   # CA handled by cdss-weekly-ingest

Requires DATABASE_URL in .env.local or environment.

See also scripts/probe_inspection_freshness.py for source-only reconnaissance
when DATABASE_URL is unavailable (Cursor automation env).
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
COVERED_STATES = ("CA", "TX", "OR", "WA", "MN", "UT", "IL", "PA", "AZ", "MO")

sys.path.insert(0, str(REPO_ROOT / "scripts"))
from validate._lib import get_conn  # noqa: E402
from state_watch_ledger import (  # noqa: E402
    begin_scan,
    capture_facility_state,
    complete_scan,
    fail_scan,
    record_source,
    require_tables,
    state_counts,
)

_SOURCE_RESULTS: list[tuple[str, int]] = []

def _run(cmd: list[str], *, label: str, allow_fail: bool = False) -> int:
    print(f"\n── {label} ──")
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=REPO_ROOT)
    _SOURCE_RESULTS.append((label, result.returncode))
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


def ingest_ca(skip: bool, county: str | None = None) -> bool | None:
    if skip:
        print("\n[CA] Skipped (--skip-ca)")
        return None
    if county:
        # Roster refresh for one county
        roster_rc = _python(
            str(SCRAPERS / "ccld_rcfe_ingest.py"),
            "--county", county,
            label=f"CA {county.title()} County RCFE roster",
            allow_fail=True,
        )
        recompute_rc = _python(
            str(SCRAPERS / "recompute_publishable.py"),
            "--state", "CA",
            label="CA recompute publishable",
            allow_fail=True,
        )
        citations_rc = _python(
            str(SCRAPERS / "ccld_citations_ingest.py"),
            "--publishable", "--county", county,
            label=f"CA {county.title()} County citations ingest",
            allow_fail=True,
        )
        return roster_rc == 0 and recompute_rc == 0 and citations_rc == 0
    rc = _python(str(SCRAPERS / "ccld_citations_ingest.py"), "--publishable", label="CA citations ingest")
    return rc == 0


def ingest_or(conn) -> bool:
    out_dir = REPO_ROOT / ".firecrawl" / "or-scrape"
    rc = _python(str(SCRAPERS / "or_csv_export.py"), label="OR CSV export", allow_fail=True)
    if rc != 0:
        return False

    today = date.today().isoformat()
    insp_csv = out_dir / f"inspections-{today}.csv"
    viol_csv = out_dir / f"violations-{today}.csv"
    if not insp_csv.is_file():
        print("  OR: inspections CSV missing after export", file=sys.stderr)
        return False

    source_max = _max_date_in_or_csv(insp_csv)
    with conn.cursor() as cur:
        base = _baseline(cur, "OR")
    db_max = base["max_date"]
    if source_max and db_max and source_max <= db_max:
        print(f"  OR: source max {source_max} ≤ DB max {db_max} — running ingest anyway (idempotent)")

    _python(str(SCRAPERS / "or_inspections_ingest.py"), "--input", str(insp_csv), label="OR inspections ingest")
    # Violations CSV is 6MB+ and takes >1h — run monthly via or_overnight_run.sh, not weekly.
    rc = _python(str(SCRAPERS / "recompute_publishable.py"), "--state", "OR", label="OR recompute publishable")
    return rc == 0


def ingest_wa(conn) -> bool:
    steps = [
        _python(str(SCRAPERS / "wa_geo_directory_ingest.py"), label="WA Geo universe", allow_fail=True),
        _python(
            str(SCRAPERS / "recompute_physical_city.py"),
            "--state", "WA", "--apply",
            label="WA physical-city recompute",
            allow_fail=True,
        ),
        _python(
            str(SCRAPERS / "cms_nh_directory_ingest.py"),
            "--state", "WA",
            label="WA CMS nursing-home directory",
            allow_fail=True,
        ),
        _python(
            str(SCRAPERS / "cms_nh_deficiencies_ingest.py"),
            "--state", "WA",
            label="WA CMS nursing-home deficiencies",
            allow_fail=True,
        ),
        _python(str(SCRAPERS / "wa_signal_sdcp.py"), label="WA SDCP signal", allow_fail=True),
        _python(
            str(SCRAPERS / "wa_signal_dementia_specialty.py"),
            label="WA dementia-specialty signal",
            allow_fail=True,
        ),
        _python(
            str(SCRAPERS / "wa_afh_directory_ingest.py"),
            "--skip-geo",
            label="WA AFH directory",
            allow_fail=True,
        ),
        _python(
            str(SCRAPERS / "wa_afh_inspections_scrape.py"),
            label="WA AFH inspection discovery",
            allow_fail=True,
        ),
        _python(
            str(SCRAPERS / "wa_bh_inspections_scrape.py"),
            label="WA ALF/ESF inspection discovery",
            allow_fail=True,
        ),
        _python(
            str(SCRAPERS / "wa_esf_ingest.py"),
            "--skip-geo",
            label="WA ESF directory",
            allow_fail=True,
        ),
        _python(str(SCRAPERS / "wa_pdf_download.py"), label="WA PDF download", allow_fail=True),
        _python(str(SCRAPERS / "wa_pdf_parse.py"), label="WA PDF parse", allow_fail=True),
        _python(
            str(SCRAPERS / "wa_pdf_backfill.py"),
            "--rescore",
            label="WA PDF backfill",
            allow_fail=True,
        ),
        _python(
            str(SCRAPERS / "recompute_publishable.py"),
            "--state", "WA",
            label="WA recompute publishable",
            allow_fail=True,
        ),
    ]
    return all(rc == 0 for rc in steps)


def ingest_mn(conn) -> bool:
    out_dir = REPO_ROOT / ".firecrawl" / "mn-scrape"
    rc = _python(str(SCRAPERS / "mn_mdh_inspections_scrape.py"), label="MN MDH findings scrape", allow_fail=True)
    if rc != 0:
        return False

    today = date.today().isoformat()
    findings = out_dir / f"mn-findings-{today}.json"
    if not findings.is_file():
        print("  MN: findings JSON missing", file=sys.stderr)
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
        rc = _python(
            str(SCRAPERS / "mn_inspections_ingest.py"),
            "--import-json", str(bundle),
            label="MN inspections ingest",
        )
        if rc != 0:
            return False
    rc = _python(str(SCRAPERS / "recompute_publishable.py"), "--state", "MN", label="MN recompute publishable")
    return rc == 0


def ingest_tx(_conn: object) -> bool:
    capture_dirs = list((REPO_ROOT / ".firecrawl").glob("tulip*"))
    if not capture_dirs:
        print("\n[TX] No TULIP capture directory — manual browser capture required.")
    else:
        print("\n[TX] TULIP ingest requires hand-captured Aura JSON.")
    _SOURCE_RESULTS.append(("TX TULIP inspection source requires manual capture", 2))
    return False


def ingest_ut(_conn: object) -> bool:
    _python(str(SCRAPERS / "ut_ccl_inspections_scraper.py"), label="UT CCL inspections", allow_fail=True)
    rc = _python(str(SCRAPERS / "recompute_publishable.py"), "--state", "UT", label="UT recompute publishable")
    return rc == 0


def ingest_il(_conn: object) -> bool:
    _python(str(SCRAPERS / "il_llcs_event_scrape.py"), label="IL LLCS event scrape", allow_fail=True)
    _python(str(SCRAPERS / "il_pdf_download.py"), label="IL PDF download", allow_fail=True)
    _python(str(SCRAPERS / "il_pdf_parse.py"), label="IL PDF parse", allow_fail=True)
    _python(str(SCRAPERS / "il_pdf_backfill.py"), label="IL PDF backfill", allow_fail=True)
    rc = _python(str(SCRAPERS / "recompute_publishable.py"), "--state", "IL", label="IL recompute publishable")
    return rc == 0


def ingest_pa(_conn: object) -> bool:
    _python(str(SCRAPERS / "pa_dhs_inspections_scraper.py"), label="PA DHS inspections scrape", allow_fail=True)
    _python(str(SCRAPERS / "pa_pdf_download.py"), label="PA PDF download", allow_fail=True)
    _python(str(SCRAPERS / "pa_pdf_parse.py"), label="PA PDF parse", allow_fail=True)
    _python(str(SCRAPERS / "pa_pdf_backfill.py"), label="PA PDF backfill", allow_fail=True)
    rc = _python(str(SCRAPERS / "recompute_publishable.py"), "--state", "PA", label="PA recompute publishable")
    return rc == 0


def ingest_az(_conn: object) -> bool:
    _python(
        str(SCRAPERS / "az_adhs_inspections_ingest.py"),
        "--mode", "inspect",
        label="AZ ADHS inspections",
        allow_fail=True,
    )
    rc = _python(str(SCRAPERS / "recompute_publishable.py"), "--state", "AZ", label="AZ recompute publishable")
    return rc == 0


def ingest_mo(_conn: object) -> bool:
    directory_rc = _python(
        str(SCRAPERS / "mo_dhss_directory_ingest.py"),
        label="MO DHSS directory",
        allow_fail=True,
    )
    _SOURCE_RESULTS.append(("MO inspection records (manual FOIA source)", 0))
    print("  MO inspections: manual FOIA source unchanged; directory refresh only")
    publish_rc = _python(
        str(SCRAPERS / "recompute_publishable.py"),
        "--state", "MO",
        label="MO recompute publishable",
        allow_fail=True,
    )
    return directory_rc == 0 and publish_rc == 0


STATE_RUNNERS = {
    "CA": lambda conn, skip_ca: ingest_ca(skip_ca),
    "OR": ingest_or,
    "WA": ingest_wa,
    "MN": ingest_mn,
    "TX": ingest_tx,
    "UT": ingest_ut,
    "IL": ingest_il,
    "PA": ingest_pa,
    "AZ": ingest_az,
    "MO": ingest_mo,
}


def main() -> int:
    ap = argparse.ArgumentParser(description="Weekly inspection ingest for all covered states")
    ap.add_argument("--state", choices=COVERED_STATES, help="Run one state only")
    ap.add_argument("--skip-ca", action="store_true", help="Skip California")
    ap.add_argument(
        "--ca-county",
        metavar="COUNTY",
        help="Scope CA ingest to one county (e.g. ORANGE). Refreshes roster + citations for that county only.",
    )
    ap.add_argument("--skip-validate", action="store_true", help="Skip post-ingest validation")
    ap.add_argument(
        "--scan-run-output",
        type=Path,
        help="Write the latest state_scan_runs UUID for downstream alert dispatch",
    )
    args = ap.parse_args()

    states = [args.state] if args.state else list(COVERED_STATES)
    print("=" * 60)
    print("StarlynnCare — Weekly inspection ingest")
    print(f"  States: {', '.join(states)}")
    print(f"  Date:   {date.today().isoformat()}")
    print("=" * 60)

    with get_conn() as conn:
        require_tables(conn)
        baselines: dict[str, dict[str, Any]] = {}
        with conn.cursor() as cur:
            for st in states:
                baselines[st] = _baseline(cur, st)
                print(f"  {st} baseline: {baselines[st]['inspection_count']} inspections, max={baselines[st]['max_date']}")

        changed_states: list[str] = []
        failed_states: list[str] = []
        for st in states:
            print(f"\n{'=' * 60}\n  STATE: {st}\n{'=' * 60}")
            before_snapshot = capture_facility_state(conn, st)
            before_counts = state_counts(conn, st)
            scan_metadata: dict[str, Any] = {"orchestrator": "weekly_inspection_ingest.py"}
            if st == "CA" and args.ca_county:
                scan_metadata["ca_county"] = args.ca_county
            scan_run_id = begin_scan(
                conn,
                st,
                before_counts,
                scan_metadata,
            )
            if args.scan_run_output:
                args.scan_run_output.write_text(scan_run_id)
            _SOURCE_RESULTS.clear()
            try:
                runner = STATE_RUNNERS[st]
                os.environ["STATE_SCAN_STARTED_AT"] = datetime.now().astimezone().isoformat()
                try:
                    if st == "CA":
                        ok = ingest_ca(args.skip_ca, county=args.ca_county)
                    else:
                        ok = runner(conn)
                finally:
                    os.environ.pop("STATE_SCAN_STARTED_AT", None)

                if ok is False:
                    failed_states.append(st)

                after_snapshot = capture_facility_state(conn, st)
                after_counts = state_counts(conn, st)
                composite_watermark = (
                    f"facilities={after_counts.facilities};"
                    f"inspections={after_counts.inspections};"
                    f"deficiencies={after_counts.deficiencies}"
                )
                source_failures: list[str] = []
                for label, return_code in _SOURCE_RESULTS:
                    status = "completed" if return_code == 0 else "failed"
                    record_source(
                        conn,
                        scan_run_id,
                        label,
                        status=status,
                        records_before=before_counts.inspections,
                        records_after=after_counts.inspections,
                        watermark=composite_watermark,
                        error=f"exit {return_code}" if return_code else None,
                    )
                    if return_code:
                        source_failures.append(f"{label}: exit {return_code}")

                material_changes = complete_scan(
                    conn,
                    scan_run_id,
                    before_snapshot,
                    after_snapshot,
                    after_counts,
                    source_failures=source_failures,
                )
                print(
                    f"  {st} watch ledger: run={scan_run_id}, "
                    f"material facility changes={material_changes}"
                )
            except Exception as exc:
                fail_scan(conn, scan_run_id, str(exc))
                failed_states.append(st)
                print(f"  {st} scan failed: {exc}", file=sys.stderr)
                continue

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
    if failed_states:
        print(f"  States with ingest failures: {', '.join(failed_states)}", file=sys.stderr)
    if changed_states:
        print(f"  States with new/changed inspection data: {', '.join(changed_states)}")
    else:
        print("  No new inspection data ingested in any state.")

    if args.skip_validate:
        return 1 if failed_states else 0

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

    return 1 if failed_states else 0


if __name__ == "__main__":
    raise SystemExit(main())
