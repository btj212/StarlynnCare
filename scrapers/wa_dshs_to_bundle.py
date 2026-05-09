#!/usr/bin/env python3
"""
Build format_version: 1 bundle from cached WA DSHS BHForms HTML files.

Each BHForms page lists document links in the pattern:
  "MM/YYYY - <Type>"  e.g. "02/2025 - Inspections", "04/2025 - Investigations"

One inspection record is created per unique (license, date) pair, aggregating
all document types. Deficiencies are links to DSHS report PDFs.

Usage:
  python3 scrapers/wa_dshs_to_bundle.py \\
    --details-dir .firecrawl/wa-scrape/details \\
    --output .firecrawl/wa-scrape/bundle.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent

# Link text pattern: "MM/YYYY - Type description"
_LINK_RE = re.compile(
    r"^(\d{1,2})/(\d{4})\s*[-–]\s*(.+)$",
    re.IGNORECASE,
)

INSPECTION_TYPES = frozenset({
    "inspection", "inspections", "survey", "surveys",
    "investigation", "investigations", "complaint",
})
SKIP_TYPES = frozenset({
    "fire inspection", "fire inspections",
    "informal dispute resolution", "informal dispute resolution letters",
    "enforcement letter", "enforcement letters",
})


def pad_wa_license(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return raw.zfill(10)[:32]
    return digits.zfill(10)


def type_is_inspection(label: str) -> bool:
    low = label.strip().lower()
    for s in SKIP_TYPES:
        if low.startswith(s):
            return False
    for t in INSPECTION_TYPES:
        if t in low:
            return True
    return False


def parse_detail_html(path: Path, lic_from_name: str) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8", errors="replace")
    lic = pad_wa_license(lic_from_name)
    raw_digits = re.sub(r"\D", "", lic_from_name) or lic_from_name
    base_url = f"https://fortress.wa.gov/dshs/adsaapps/lookup/BHForms.aspx?Lic={raw_digits}"

    try:
        from bs4 import BeautifulSoup  # type: ignore[import-untyped]
        soup = BeautifulSoup(text, "html.parser")
        links = soup.find_all("a", href=True)
    except ImportError:
        print("[warn] BeautifulSoup not installed — skipping HTML parse", file=sys.stderr)
        return {
            "license_number": lic,
            "inspections": [],
        }

    # Group report links by (month, year) → list of (type_label, href)
    by_date: dict[tuple[int, int], list[tuple[str, str]]] = defaultdict(list)
    for a in links:
        label = (a.get_text() or "").strip()
        if not label:
            continue
        m = _LINK_RE.match(label)
        if not m:
            continue
        month, year, type_label = int(m.group(1)), int(m.group(2)), m.group(3).strip()
        if type_is_inspection(type_label):
            href = a["href"]
            if not href.startswith("http"):
                href = "https://fortress.wa.gov" + href
            by_date[(year, month)].append((type_label, href))

    inspections: list[dict[str, Any]] = []
    for (year, month), entries in sorted(by_date.items(), reverse=True):
        iso_date = f"{year}-{month:02d}-01"
        first_label = entries[0][0].lower()
        is_complaint = "investigation" in first_label or "complaint" in first_label
        insp_type = "complaint" if is_complaint else "standard"

        deficiencies = [
            {
                "code": None,
                "category": type_label,
                "description": f"WA DSHS report: {type_label} ({month:02d}/{year})",
                "inspector_narrative": href,
                "state_severity_raw": type_label,
                "cited_date": iso_date,
                "immediate_jeopardy": False,
            }
            for type_label, href in entries
        ]

        inspections.append(
            {
                "inspection_date": iso_date,
                "inspection_type": insp_type,
                "is_complaint": is_complaint,
                "complaint_id": None,
                "source_url": base_url,
                "raw_data": {
                    "washington": True,
                    "cached_file": str(path.name),
                    "report_count": len(entries),
                },
                "deficiencies": deficiencies,
            }
        )

    return {"license_number": lic, "inspections": inspections}


def main() -> int:
    ap = argparse.ArgumentParser(description="WA cached BHForms HTML → bundle JSON")
    ap.add_argument("--details-dir", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    if not args.details_dir.is_dir():
        print(f"Not a directory: {args.details_dir}", file=sys.stderr)
        return 1

    facilities: list[dict[str, Any]] = []
    total_inspections = 0
    for p in sorted(args.details_dir.glob("*.html")):
        rec = parse_detail_html(p, p.stem)
        facilities.append(rec)
        total_inspections += len(rec["inspections"])

    bundle = {"format_version": 1, "facilities": facilities}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(bundle, indent=2), encoding="utf-8")
    print(f"Wrote {args.output} — {len(facilities)} facilities, {total_inspections} inspection events")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
