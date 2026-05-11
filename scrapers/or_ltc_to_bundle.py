#!/usr/bin/env python3
"""
Join Oregon DHS LTC inspections CSV + violations CSV → format_version: 1 bundle
for [`scrapers/or_inspections_ingest.py`](./or_inspections_ingest.py).

Join: inspections.Event ID ↔ violations.Report number (same provider).

Usage:
  python3 scrapers/or_ltc_to_bundle.py \\
    --inspections .firecrawl/or-scrape/inspections-2026-05-08.csv \\
    --violations .firecrawl/or-scrape/violations-2026-05-08.csv \\
    --output .firecrawl/or-scrape/bundle.json

Optional: --roster-csv providers.csv — only include Provider IDs present in roster (memory-care export).
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


def pad_license_or(raw: Any) -> str:
    if raw is None or str(raw).strip() == "":
        return "0000000000"
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return "0000000000"
    return digits.zfill(10)


def norm_key(h: str) -> str:
    return re.sub(r"[^a-z0-9]", "", h.lower())


def parse_date(val: Any) -> str | None:
    if val is None or val == "":
        return None
    if hasattr(val, "isoformat"):
        try:
            return val.isoformat()[:10]
        except Exception:  # noqa: BLE001
            pass
    s = str(val).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    if len(s) >= 10:
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d").date().isoformat()
        except ValueError:
            pass
    return None


# Inspections/violations CSVs include NF/AFH/etc.; scope to assisted living + RCF.
OR_LTC_PROVIDER_TYPES = frozenset({"ALF", "RCF"})


def detect_col(headers: list[str], *keywords: str) -> str | None:
    """Return original header name whose normalized form contains any keyword."""
    for h in headers:
        nk = norm_key(h)
        for kw in keywords:
            if kw in nk:
                return h
    return None


def load_roster_ids(path: Path) -> set[str]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        ids: set[str] = set()
        for row in r:
            for k, v in row.items():
                if not k or v is None:
                    continue
                if norm_key(k) in ("id", "providerid") and str(v).strip():
                    ids.add(str(v).strip())
                    break
    return ids


def build_bundle(
    inspections_path: Path,
    violations_path: Path,
    roster_ids: set[str] | None,
    *,
    since_date: "date | None" = None,
) -> dict[str, Any]:
    with inspections_path.open(encoding="utf-8-sig", newline="") as f:
        insp_reader = csv.DictReader(f)
        insp_headers = list(insp_reader.fieldnames or [])
        insp_rows = list(insp_reader)

    with violations_path.open(encoding="utf-8-sig", newline="") as f:
        viol_reader = csv.DictReader(f)
        viol_headers = list(viol_reader.fieldnames or [])
        viol_rows = list(viol_reader)

    col_prov_i = detect_col(insp_headers, "providerid")
    col_event = detect_col(insp_headers, "eventid")
    col_date_i = detect_col(insp_headers, "date", "inspectiondate")
    # Do not pass keyword "type" — it matches provider Type before "Inspection type(s)".
    col_insp_kinds = detect_col(insp_headers, "inspectiontypes", "inspectiontype")
    col_provider_i = next((h for h in insp_headers if (h or "").strip() == "Type"), None)
    col_def_count = detect_col(insp_headers, "deficienciescited", "deficiencies")

    col_prov_v = detect_col(viol_headers, "providerid")
    col_report = detect_col(viol_headers, "reportnumber", "report")
    col_date_v = detect_col(viol_headers, "date", "incidentdate")
    col_alleg = detect_col(viol_headers, "allegation", "description")
    # Use exact-match for bare "Type" header to avoid shadowing by "Provider type".
    # detect_col("type") matches "providertype" first (keyword "type" is in "providertype").
    col_vtype = next((h for h in viol_headers if norm_key(h) == "type"), None)
    if not col_vtype:
        col_vtype = detect_col(viol_headers, "violationtype", "allegationtype")
    col_provider_v = detect_col(viol_headers, "providertype")

    missing = [
        k
        for k, v in [
            ("inspections provider id", col_prov_i),
            ("inspections event id", col_event),
            ("inspections date", col_date_i),
            ("violations provider id", col_prov_v),
            ("violations report number", col_report),
        ]
        if not v
    ]
    if missing:
        print(f"ERROR: missing columns: {missing}", file=sys.stderr)
        print(f"Inspection headers: {insp_headers[:12]}", file=sys.stderr)
        print(f"Violation headers: {viol_headers[:12]}", file=sys.stderr)
        sys.exit(2)

    # violations[(prov, report_num)] -> list of rows
    viol_by_key: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in viol_rows:
        pv = (row.get(col_prov_v) or "").strip()
        rep = (row.get(col_report) or "").strip()
        if not pv or not rep:
            continue
        if col_provider_v:
            pt = (row.get(col_provider_v) or "").strip().upper()
            if pt not in OR_LTC_PROVIDER_TYPES:
                continue
        if roster_ids is not None and pv not in roster_ids:
            continue
        # Apply since_date filter on the violation date
        if since_date is not None and col_date_v:
            vd_raw = row.get(col_date_v) or ""
            vd_iso = parse_date(vd_raw)
            if vd_iso:
                try:
                    from datetime import date as _date
                    if _date.fromisoformat(vd_iso) < since_date:
                        continue
                except ValueError:
                    pass
        viol_by_key[(pv, rep)].append(row)

    # Group inspections by (license_padded, insp_iso_date, event_id)
    insp_groups: dict[tuple[str, str, str], dict[str, Any]] = {}

    for row in insp_rows:
        pid = (row.get(col_prov_i) or "").strip()
        if not pid:
            continue
        if col_provider_i:
            pt = (row.get(col_provider_i) or "").strip().upper()
            if pt not in OR_LTC_PROVIDER_TYPES:
                continue
        if roster_ids is not None and pid not in roster_ids:
            continue
        ev = (row.get(col_event) or "").strip()
        d_raw = row.get(col_date_i or "")
        d_iso = parse_date(d_raw)
        if not d_iso:
            continue
        lic = pad_license_or(pid)
        types_raw = (row.get(col_insp_kinds) or "") if col_insp_kinds else ""
        key = (lic, d_iso, ev)

        is_complaint = "complaint" in types_raw.lower()
        source_url = (
            f"https://ltclicensing.oregon.gov/Inspections#or-{lic}-{ev}-{d_iso}"
        )

        if key not in insp_groups:
            def_count_raw = (row.get(col_def_count) or "").strip() if col_def_count else ""
            try:
                def_count = int(def_count_raw) if def_count_raw else None
            except ValueError:
                def_count = None
            insp_groups[key] = {
                "license_number": lic,
                "inspection_date": d_iso,
                "inspection_type": "complaint" if is_complaint else "standard",
                "is_complaint": is_complaint,
                "complaint_id": None,
                "source_url": source_url,
                "total_deficiency_count": def_count,
                "raw_data": {
                    "oregon": True,
                    "provider_id": pid,
                    "event_id": ev,
                    "inspection_types": types_raw,
                    "deficiency_count_csv": def_count,
                    "source_row": row,
                },
                "deficiencies": [],
            }

        # OR violations use a different report numbering system from inspection Event IDs
        # — no join is possible by key. Violations are added as standalone records below.

    # Violations as standalone complaint inspections (grouped by provider + report number + date)
    # OR violations CSV (Date, Provider ID, Provider type, Report number, Allegation, Type)
    # is an independent enforcement system — not joinable to inspection Event IDs.
    viol_insp_groups: dict[tuple[str, str, str], dict[str, Any]] = {}
    for (pv, rep), v_rows in viol_by_key.items():
        lic_v = pad_license_or(pv)
        # Use first row's date as the investigation date
        first_date = None
        for vrow in v_rows:
            first_date = parse_date(vrow.get(col_date_v)) if col_date_v else None
            if first_date:
                break
        if not first_date:
            continue
        viol_key = (lic_v, first_date, rep)
        if viol_key not in viol_insp_groups:
            alleg_types = {(vrow.get(col_vtype) or "").strip() for vrow in v_rows}
            source_url = f"https://ltclicensing.oregon.gov/Violations#or-{lic_v}-{rep}"
            viol_insp_groups[viol_key] = {
                "license_number": lic_v,
                "inspection_date": first_date,
                "inspection_type": "complaint",
                "is_complaint": True,
                "complaint_id": rep,
                "source_url": source_url,
                "raw_data": {"oregon": True, "provider_id": pv, "report_number": rep, "violation_record": True},
                "deficiencies": [],
            }
        for vrow in v_rows:
            alleg = (vrow.get(col_alleg) or "").strip() if col_alleg else ""
            vtyp = (vrow.get(col_vtype) or "").strip() if col_vtype else ""
            vd = parse_date(vrow.get(col_date_v)) if col_date_v else first_date
            viol_insp_groups[viol_key]["deficiencies"].append(
                {
                    "code": None,
                    "category": vtyp[:500] if vtyp else None,
                    "description": alleg[:4000] if alleg else None,
                    "inspector_narrative": alleg[:8000] if alleg else None,
                    "state_severity_raw": vtyp,
                    "cited_date": vd or first_date,
                    # OR violations CSV has no explicit immediate-jeopardy flag.
                    # Do not infer IJ from the violation type alone — that would
                    # fabricate data not present in the source. Severity is inferred
                    # separately from state_severity_raw via _SEVERITY_HINTS.
                    "immediate_jeopardy": False,
                }
            )

    # Bucket by license — combine inspection events + violation investigations
    by_lic: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for _k, block in {**insp_groups, **viol_insp_groups}.items():
        lic = block["license_number"]
        entry: dict[str, Any] = {
            "inspection_date": block["inspection_date"],
            "inspection_type": block["inspection_type"],
            "is_complaint": block["is_complaint"],
            "complaint_id": block["complaint_id"],
            "source_url": block["source_url"],
            "raw_data": block["raw_data"],
            "deficiencies": block["deficiencies"],
        }
        if block.get("total_deficiency_count") is not None:
            entry["total_deficiency_count"] = block["total_deficiency_count"]
        by_lic[lic].append(entry)

    facilities_out = [
        {"license_number": lic, "inspections": sorted(insp_list, key=lambda x: x["inspection_date"])}
        for lic, insp_list in sorted(by_lic.items())
    ]

    return {"format_version": 1, "facilities": facilities_out}


def main() -> int:
    ap = argparse.ArgumentParser(description="Oregon LTC CSV → bundle JSON")
    ap.add_argument("--inspections", type=Path, required=True)
    ap.add_argument("--violations", type=Path, required=True)
    ap.add_argument("--roster-csv", type=Path, default=None, help="Optional memory-care roster to filter IDs")
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument(
        "--since",
        default=None,
        help="Only include violation records on or after this date (YYYY-MM-DD). Defaults to 48 months ago.",
    )
    args = ap.parse_args()

    from datetime import date, timedelta

    if args.since:
        since_date: date | None = date.fromisoformat(args.since)
    else:
        since_date = date.today() - timedelta(days=48 * 30)

    roster_ids = load_roster_ids(args.roster_csv) if args.roster_csv else None
    bundle = build_bundle(args.inspections, args.violations, roster_ids, since_date=since_date)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(bundle, indent=2), encoding="utf-8")
    n_insp = sum(len(f["inspections"]) for f in bundle["facilities"])
    print(f"Wrote {args.output} — {len(bundle['facilities'])} facilities, {n_insp} inspections")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
