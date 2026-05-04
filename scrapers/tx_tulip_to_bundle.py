#!/usr/bin/env python3
"""
Convert hand-captured TULIP Aura responses → format_version: 1 bundle for
[`scrapers/tx_inspections_ingest.py`](./tx_inspections_ingest.py) `--import-json`.

Capture envelope (one file per facility, e.g. `.firecrawl/tulip-smoke/148715.json`):

    {
      "license_number": "148715",
      "account_id": "001cv00000RpEjOAAV",
      "source_url": "https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-detail?c__accountidparam=001cv00000RpEjOAAV",
      "captured_at": "2026-05-04",
      "aura": <verbatim Aura response from DevTools, the JSON whose top-level key is "actions">
    }

The Aura response shape we observed (TULIP "Inspections" tab):

    actions[0].returnValue.returnValue : Array<{
      correctedDate:        "M/D/YYYY",
      exitDate:             "M/D/YYYY",         # the inspection exit / cited date
      mostRecentExitDate:   "Month D, YYYY",   # most recent comprehensive (header)
      stateViolationCited:  "The facility failed to ...",
      visitType:            "Life Safty Code" | "Health Code" | ...
    }>

Mapping into our schema:

    inspections row per unique exitDate (groups all violations from one visit)
      - inspection_date     := exitDate
      - inspection_type     := "comprehensive"  (TULIP only exposes comprehensive surveys)
      - is_complaint        := False
      - source_url          := capture envelope source_url
      - raw_data            := { tulip_account_id, exitDate, mostRecentExitDate, items: [...] }

    deficiencies row per Aura row:
      - code                := null  (TULIP exposes no citation code — synthetic hash key applied by ingest)
      - state_severity_raw  := visitType (verbatim, including HHSC's "Life Safty" typo)
      - description         := stateViolationCited
      - inspector_narrative := stateViolationCited
      - cited_date          := exitDate
      - corrected_date      := correctedDate
      - immediate_jeopardy  := False  (TULIP does not expose this field for ALFs)

Severity ordinal (1-4) is intentionally NULL — TULIP does not publish CA-style Type A/B
labels for assisted living. Editorial layer surfaces narratives directly.

Usage
-----
    python3 scrapers/tx_tulip_to_bundle.py \
      --capture-dir .firecrawl/tulip-smoke/ \
      --output .firecrawl/tulip-smoke/bundle.json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


def parse_us_date(s: str) -> str | None:
    """'2/7/2020' -> '2020-02-07'; tolerant of M/D/YY too."""
    if not s:
        return None
    s = str(s).strip()
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def extract_rows(aura: dict[str, Any]) -> list[dict[str, Any]]:
    """Pull the violation rows out of an Aura response."""
    actions = aura.get("actions") or []
    out: list[dict[str, Any]] = []
    for action in actions:
        if action.get("state") != "SUCCESS":
            continue
        rv = action.get("returnValue") or {}
        # Aura wraps its returnValue: actions[i].returnValue.returnValue
        inner = rv.get("returnValue") if isinstance(rv, dict) else None
        if isinstance(inner, list):
            out.extend(inner)
    return out


def envelope_to_facility_block(env: dict[str, Any]) -> dict[str, Any] | None:
    license_number = str(env.get("license_number") or "").strip()
    if not license_number:
        return None

    source_url = env.get("source_url") or ""
    account_id = env.get("account_id") or ""
    aura = env.get("aura") or {}
    rows = extract_rows(aura)

    # Group rows by exit date → one inspections row per visit
    by_date: dict[str, list[dict[str, Any]]] = defaultdict(list)
    most_recent_str: str | None = None
    for r in rows:
        d = parse_us_date(r.get("exitDate"))
        if not d:
            continue
        by_date[d].append(r)
        if not most_recent_str:
            most_recent_str = r.get("mostRecentExitDate")

    inspections: list[dict[str, Any]] = []
    for inspection_date in sorted(by_date.keys(), reverse=True):
        items = by_date[inspection_date]
        deficiencies = []
        for r in items:
            deficiencies.append({
                "code": None,
                "state_severity_raw": r.get("visitType"),
                "description": r.get("stateViolationCited"),
                "inspector_narrative": r.get("stateViolationCited"),
                "cited_date": inspection_date,
                "corrected_date": parse_us_date(r.get("correctedDate")),
                "immediate_jeopardy": False,
            })
        inspections.append({
            "inspection_date": inspection_date,
            "inspection_type": "comprehensive",
            "is_complaint": False,
            "source_url": source_url,
            "raw_data": {
                "tulip_account_id": account_id,
                "exitDate": inspection_date,
                "mostRecentExitDate": most_recent_str,
                "items": items,
            },
            "deficiencies": deficiencies,
        })

    # TULIP also surfaces a "most recent comprehensive inspection" date in the page
    # header even when that visit had 0 violations (no rows returned). Synthesize a
    # zero-deficiency inspection row for it so the publish gate / hub copy can see
    # that a recent visit happened.
    most_recent_iso = _parse_long_date(most_recent_str)
    if most_recent_iso and most_recent_iso not in by_date:
        inspections.insert(0, {
            "inspection_date": most_recent_iso,
            "inspection_type": "comprehensive",
            "is_complaint": False,
            "source_url": source_url,
            "raw_data": {
                "tulip_account_id": account_id,
                "synthesized_from": "mostRecentExitDate header",
                "note": "TULIP header reported this visit; no violations returned for this date.",
                "mostRecentExitDate": most_recent_str,
            },
            "deficiencies": [],
        })

    if not inspections:
        # Facility has no inspection history in TULIP — still record a marker so
        # publish-gate sees we *checked*, but with no inspection rows.
        return {"license_number": license_number, "inspections": []}

    return {"license_number": license_number, "inspections": inspections}


def _parse_long_date(s: str | None) -> str | None:
    """'February 16, 2023' -> '2023-02-16'."""
    if not s:
        return None
    s = str(s).strip()
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    # Fall back to US date if header happens to be a slash format
    return parse_us_date(s)


def main() -> None:
    ap = argparse.ArgumentParser(description="TULIP capture → ingest bundle")
    ap.add_argument(
        "--capture-dir", required=True,
        help="Folder containing per-facility envelope JSON files (e.g. 148715.json)",
    )
    ap.add_argument(
        "--output", required=True,
        help="Path to write the format_version: 1 bundle (e.g. .firecrawl/tulip-smoke/bundle.json)",
    )
    ap.add_argument(
        "--license", default=None,
        help="Optional: only process the file matching this license number",
    )
    args = ap.parse_args()

    capture_dir = Path(args.capture_dir)
    if not capture_dir.is_dir():
        print(f"ERROR: capture-dir does not exist: {capture_dir}", file=sys.stderr)
        sys.exit(1)

    facilities: list[dict[str, Any]] = []
    files = sorted(capture_dir.glob("*.json"))
    for f in files:
        # Skip the bundle output if it lives in the same folder
        if f.name == Path(args.output).name:
            continue
        with f.open(encoding="utf-8") as fh:
            try:
                env = json.load(fh)
            except json.JSONDecodeError as e:
                print(f"WARN: skipping {f.name} — invalid JSON: {e}", file=sys.stderr)
                continue
        if not isinstance(env, dict) or "aura" not in env:
            # Allow skipping non-envelope helpers in the same folder
            continue
        if args.license and str(env.get("license_number")) != args.license:
            continue
        block = envelope_to_facility_block(env)
        if not block:
            continue
        facilities.append(block)

    bundle = {"format_version": 1, "facilities": facilities}
    Path(args.output).write_text(json.dumps(bundle, indent=2), encoding="utf-8")

    # Summary
    total_insp = sum(len(b["inspections"]) for b in facilities)
    total_def = sum(len(i["deficiencies"]) for b in facilities for i in b["inspections"])
    print(
        f"Wrote {args.output}\n"
        f"  facilities: {len(facilities)}\n"
        f"  inspections: {total_insp}\n"
        f"  deficiencies: {total_def}"
    )


if __name__ == "__main__":
    main()
