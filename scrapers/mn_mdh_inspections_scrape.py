#!/usr/bin/env python3
"""
Minnesota MDH Assisted Living — inspection/complaint scraper.

Source: MDH Health Care Provider Evaluation and Investigation Results
API:    POST https://providerdata-api.web.health.state.mn.us/search
Docs:   https://www.health.state.mn.us/facilities/regulation/directory/providerfindings.html

Queries for all "ALL_" (Assisted Living Facilities) across all MN counties,
saves the raw JSON, and writes a format_version:1 bundle limited to
ALDC-identified facilities (cross-referenced by name+city against our
facilities table or the ALRC CSV).

This single API call returns all 2100+ ALF facilities with their inspection
and complaint histories without pagination — no per-facility scraping needed.

Usage:
  python3 scrapers/mn_mdh_inspections_scrape.py
  # Writes: .firecrawl/mn-scrape/mn-findings-YYYY-MM-DD.json (raw API response)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import make_session, polite_sleep

FINDINGS_API = "https://providerdata-api.web.health.state.mn.us/search"
FINDINGS_PAGE = "https://www.health.state.mn.us/facilities/regulation/directory/providerfindings.html"


def fetch_all_alf_findings(out_dir: Path) -> Path:
    """POST to MDH findings API to get all ALF evaluation/complaint data."""
    sess = make_session()

    payload = {
        "providerType": "ALL_",
        "county": None,
        "city": None,
        "zipCode": None,
        "providerName": None,
        "providerId": None,
        "nameCriteria": "STARTS",
        "postedStartDate": None,
        "postedEndDate": None,
        "concludedStartDate": None,
        "concludedEndDate": None,
    }

    print(f"  POST {FINDINGS_API} (all MN ALFs)…")
    r = sess.post(
        FINDINGS_API,
        json=payload,
        headers={
            "Origin": "https://www.health.state.mn.us",
            "Referer": FINDINGS_PAGE,
            "Content-Type": "application/json",
        },
        timeout=60,
    )
    r.raise_for_status()
    data = r.json()
    print(f"  Got {len(data)} facility records")

    total_insp = sum(len(f.get("inspections", [])) for f in data)
    total_compl = sum(len(f.get("complaints", [])) for f in data)
    print(f"  Inspections: {total_insp}  Complaints: {total_compl}")

    out_path = out_dir / f"mn-findings-{date.today().isoformat()}.json"
    out_path.write_text(json.dumps(data, indent=2))
    print(f"  Saved → {out_path} ({out_path.stat().st_size:,} bytes)")
    return out_path


def main() -> int:
    ap = argparse.ArgumentParser(
        description="MN MDH: fetch all ALF evaluation + complaint records"
    )
    ap.add_argument("--out-dir", type=Path,
                    default=REPO_ROOT / ".firecrawl" / "mn-scrape")
    args = ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    try:
        out = fetch_all_alf_findings(args.out_dir)
        print(f"\nDone. Next step:")
        print(f"  python3 scrapers/mn_mdh_to_bundle.py --findings {out}")
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
