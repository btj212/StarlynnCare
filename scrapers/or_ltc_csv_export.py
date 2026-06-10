#!/usr/bin/env python3
"""
Download Oregon DHS LTC Licensing bulk CSV exports (Providers, Inspections,
Violations, Regulatory Actions) from ltclicensing.oregon.gov.

Used by facility_watch_scan.py for daily delta detection. Full-universe exports
are filtered per-facility by Provider ID after download.

Usage:
  python3 scrapers/or_ltc_csv_export.py
  python3 scrapers/or_ltc_csv_export.py --out-dir .firecrawl/or-scrape
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

SCRAPERS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRAPERS_DIR.parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import extract_csrf_token, polite_sleep, session_get, session_post, make_session

BASE = "https://ltclicensing.oregon.gov"

EXPORTS: list[tuple[str, str, str, str]] = [
    ("providers", f"{BASE}/Providers", f"{BASE}/Providers/Export", "Name_asc"),
    ("inspections", f"{BASE}/Inspections", f"{BASE}/Inspections/Export", "InspectionDate_desc"),
    ("violations", f"{BASE}/Violations", f"{BASE}/Violations/Export", "IncidentDate_desc"),
    (
        "regulatory_actions",
        f"{BASE}/RegulatoryActions",
        f"{BASE}/RegulatoryActions/Export",
        "ActionDate_desc",
    ),
]


def _export_csv(
    sess: object,
    page_url: str,
    export_url: str,
    sorts: str,
    out_path: Path,
) -> None:
    r = session_get(sess, page_url)  # type: ignore[arg-type]
    r.raise_for_status()
    token = extract_csrf_token(r.text)
    if not token:
        raise RuntimeError(f"CSRF not found: {page_url}")
    polite_sleep(1.0)
    body = {
        "PageNumber": "1",
        "PageSize": "99999",
        "Sorts": sorts,
        "Filters": "",
        "type": "csv",
        "__RequestVerificationToken": token,
    }
    r2 = session_post(sess, export_url, data=body, headers={"Referer": page_url})  # type: ignore[arg-type]
    r2.raise_for_status()
    out_path.write_bytes(r2.content)
    print(f"Wrote {out_path} ({len(r2.content)} bytes)")


def _fallback_copy(name: str, out_path: Path) -> bool:
    """Copy committed data/or_*.csv when the portal export is down (500s are common)."""
    src = REPO_ROOT / "data" / f"or_{name}.csv"
    if name == "regulatory_actions":
        src = REPO_ROOT / "data" / "or_regulatory_actions.csv"
    if not src.is_file():
        return False
    out_path.write_bytes(src.read_bytes())
    print(f"Fallback copy {src} → {out_path}")
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description="Oregon LTC bulk CSV exports")
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=REPO_ROOT / ".firecrawl" / "or-scrape",
    )
    args = ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    d = date.today().isoformat()

    sess = make_session()
    failures = 0
    for name, page_url, export_url, sorts in EXPORTS:
        out_path = args.out_dir / f"{name}-{d}.csv"
        try:
            _export_csv(sess, page_url, export_url, sorts, out_path)
        except Exception as e:  # noqa: BLE001
            print(f"WARN: {name} export failed: {e}", file=sys.stderr)
            if not _fallback_copy(name, out_path):
                failures += 1
        polite_sleep(1.0)

    if failures:
        print(f"ERROR: {failures} export(s) failed with no fallback", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
