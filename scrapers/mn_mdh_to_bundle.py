#!/usr/bin/env python3
"""
Minnesota MDH — findings API JSON → format_version:1 bundle.

Converts the raw response from `providerdata-api.web.health.state.mn.us/search`
(produced by mn_mdh_inspections_scrape.py) into a format_version:1 inspection
bundle for all licensed Minnesota assisted-living facilities.

Cross-reference: MDH provider records are matched by slugified name+city
against the ALRC facility JSON (mn-alrc-facilities-*.json), which is the
canonical ID source for MN rows in `facilities` (license_number = `ALRC:{id}`).
The bundle covers ALL ALFs in the ALRC export — both ALDC (Assisted Living
with Dementia Care) and standard AL — so the unified Tier-1 signal model in
`recompute_publishable.py` has freshness coverage for the whole MN roster,
not just the dementia subset.

Use `--aldc-only` to keep the legacy CA-style ALDC-only behaviour for spot
re-bundles when you specifically want to reduce volume.

Usage:
  python3 scrapers/mn_mdh_to_bundle.py \\
      --findings .firecrawl/mn-scrape/mn-findings-YYYY-MM-DD.json \\
      --alrc-facilities .firecrawl/mn-scrape/mn-alrc-facilities-YYYY-MM-DD.json \\
      --output .firecrawl/mn-scrape/bundle-YYYY-MM-DD.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def slugify_name(text: str) -> str:
    """Normalize a facility name for matching (lowercase, alpha only)."""
    return re.sub(r"[^a-z0-9]", "", text.lower())


def parse_mdh_date(date_str: str | None) -> str | None:
    """Convert 'MM/DD/YYYY' → 'YYYY-MM-DD'. Returns None if unparseable."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%m/%d/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return None


def build_inspection_entry(insp: dict, inspection_type: str) -> dict:
    """Convert an MDH inspection/complaint record to bundle inspection format."""
    resolved_date = parse_mdh_date(insp.get("resolvedDate"))
    insert_date = parse_mdh_date(insp.get("insertDate"))
    # Use resolvedDate as the inspection_date (when the inspection concluded)
    # fall back to insertDate (posted date) if not available
    inspection_date = resolved_date or insert_date or ""

    nbr = insp.get("nbr") or ""
    nbr2 = insp.get("nbr2") or ""
    report_link = insp.get("link") or ""

    is_complaint = inspection_type == "complaint"

    return {
        "inspection_date": inspection_date,
        "inspection_type": "complaint" if is_complaint else "standard",
        "is_complaint": is_complaint,
        "complaint_id": nbr if is_complaint else None,
        "source_url": report_link,
        "source_agency": "MDH",
        "source_id": nbr,
        "raw_data": {
            "mn": True,
            "report_nbr": nbr,
            "report_nbr2": nbr2,
            "resolved_date": resolved_date,
            "insert_date": insert_date,
            "status": insp.get("status"),
            "report_link": report_link,
        },
        "deficiencies": [],
    }


def build_bundle(
    findings: list[dict],
    alrc_fac_by_key: dict[str, dict],
    *,
    since_months: int = 48,
) -> dict:
    """Build format_version:1 bundle for all matched MN ALFs."""
    from datetime import date  # noqa: PLC0415

    cutoff = date.fromisoformat(
        f"{date.today().year - since_months // 12}-"
        f"{date.today().month:02d}-01"
    )

    matched = 0
    skipped = 0
    facilities = []

    for fac in findings:
        name_key = slugify_name(fac.get("providerName", ""))
        city_key = slugify_name(fac.get("city", ""))
        lookup_key = f"{name_key}|{city_key}"

        alrc = alrc_fac_by_key.get(lookup_key)
        if alrc is None:
            skipped += 1
            continue

        alrc_id = alrc.get("alrc_id")
        license_number = f"ALRC:{alrc_id}" if alrc_id else "ALRC:0"

        inspections = []
        for insp in fac.get("inspections", []):
            entry = build_inspection_entry(insp, "survey")
            if entry["inspection_date"] and entry["inspection_date"] >= str(cutoff):
                inspections.append(entry)

        for compl in fac.get("complaints", []):
            entry = build_inspection_entry(compl, "complaint")
            if entry["inspection_date"] and entry["inspection_date"] >= str(cutoff):
                inspections.append(entry)

        inspections.sort(key=lambda x: x["inspection_date"])

        facilities.append({
            "license_number": license_number,
            "mn_hfid": str(fac.get("id", "")),
            "name": fac.get("providerName", "").title(),
            "city": fac.get("city", "").title(),
            "state_code": "MN",
            "inspections": inspections,
        })
        matched += 1

    print(f"  Matched {matched} ALFs from {len(findings)} MDH findings")
    print(f"  Skipped {skipped} MDH records (no ALRC name+city match)")
    total_events = sum(len(f["inspections"]) for f in facilities)
    print(f"  Total inspection/complaint events (since {cutoff}): {total_events}")

    return {
        "format_version": 1,
        "state_code": "MN",
        "generated": date.today().isoformat(),
        "since_months": since_months,
        "facilities": facilities,
    }


def main() -> int:
    today = date.today().isoformat()
    out_dir = REPO_ROOT / ".firecrawl" / "mn-scrape"

    ap = argparse.ArgumentParser(description="MN MDH findings → bundle")
    ap.add_argument("--findings", type=Path,
                    default=out_dir / f"mn-findings-{today}.json")
    ap.add_argument("--alrc-facilities", type=Path,
                    default=out_dir / f"mn-alrc-facilities-{today}.json")
    ap.add_argument("--output", type=Path,
                    default=out_dir / f"bundle-{today}.json")
    ap.add_argument("--since-months", type=int, default=48,
                    help="Only include events within this many months (default: 48)")
    ap.add_argument("--aldc-only", action="store_true",
                    help="Keep legacy behaviour and only emit ALDC facilities")
    args = ap.parse_args()

    if not args.findings.is_file():
        print(f"ERROR: findings JSON not found: {args.findings}", file=sys.stderr)
        print("Run: python3 scrapers/mn_mdh_inspections_scrape.py", file=sys.stderr)
        return 1

    if not args.alrc_facilities.is_file():
        print(f"ERROR: ALRC facilities JSON not found: {args.alrc_facilities}",
              file=sys.stderr)
        print("Run: python3 scrapers/mn_alrc_scrape.py", file=sys.stderr)
        return 1

    print(f"Loading findings from {args.findings}…")
    findings = json.loads(args.findings.read_text())
    print(f"  {len(findings)} facility records")

    print(f"Loading ALRC facilities from {args.alrc_facilities}…")
    alrc_facs = json.loads(args.alrc_facilities.read_text())
    if args.aldc_only:
        eligible = [f for f in alrc_facs if f.get("is_aldc")]
        print(f"  {len(eligible)} ALDC facilities (legacy --aldc-only mode)")
    else:
        eligible = alrc_facs
        aldc_n = sum(1 for f in alrc_facs if f.get("is_aldc"))
        print(f"  {len(eligible)} total ALFs ({aldc_n} ALDC + {len(eligible) - aldc_n} standard AL)")

    alrc_by_key: dict[str, dict] = {}
    for f in eligible:
        key = f"{slugify_name(f['name'])}|{slugify_name(f['city'])}"
        alrc_by_key[key] = f

    print("Building bundle…")
    bundle = build_bundle(findings, alrc_by_key, since_months=args.since_months)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(bundle, indent=2))
    print(f"  Saved → {args.output} ({args.output.stat().st_size:,} bytes)")

    print("\nNext step:")
    print(f"  python3 scrapers/mn_inspections_ingest.py --import-json {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
