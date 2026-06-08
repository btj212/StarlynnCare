#!/usr/bin/env python3
"""
Download Oregon DHS LTC Licensing CSV exports (inspections + violations).

Revives the export logic from the retired or_dhs_ltc_inspections_scrape.py without
the zero-padded Provider ID bug — this script only downloads files; ingest is
handled by or_inspections_ingest.py / or_violations_ingest.py.

Usage:
  python3 scrapers/or_csv_export.py
  python3 scrapers/or_csv_export.py --out-dir .firecrawl/or-scrape
  python3 scrapers/or_csv_export.py --providers   # also export memory-care roster
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import extract_csrf_token, make_session, polite_sleep, session_get, session_post

BASE = "https://ltclicensing.oregon.gov"
INSPECTIONS_PAGE = f"{BASE}/Inspections"
INSPECTIONS_EXPORT = f"{BASE}/Inspections/Export"
VIOLATIONS_PAGE = f"{BASE}/Violations"
VIOLATIONS_EXPORT = f"{BASE}/Violations/Export"
PROVIDERS_PAGE = f"{BASE}/Providers"
PROVIDERS_EXPORT = f"{BASE}/Providers/Export"


def _export_csv(
    sess: object,
    page_url: str,
    export_url: str,
    filters: str,
    sorts: str,
    out_path: Path,
    extra_body: dict[str, str] | None = None,
) -> None:
    r = session_get(sess, page_url)  # type: ignore[arg-type]
    r.raise_for_status()
    token = extract_csrf_token(r.text)
    if not token:
        raise RuntimeError(f"CSRF not found: {page_url}")
    polite_sleep(1.0)
    body: dict[str, str] = {
        "PageNumber": "1",
        "PageSize": "99999",
        "Sorts": sorts,
        "Filters": filters,
        "type": "csv",
        "__RequestVerificationToken": token,
    }
    if extra_body:
        body.update(extra_body)

    r2 = session_post(sess, export_url, data=body, headers={"Referer": page_url})  # type: ignore[arg-type]
    r2.raise_for_status()
    out_path.write_bytes(r2.content)
    print(f"Wrote {out_path} ({len(r2.content):,} bytes)")


def export_all(out_dir: Path, include_providers: bool) -> tuple[Path, Path, Path | None]:
    out_dir.mkdir(parents=True, exist_ok=True)
    d = date.today().isoformat()
    insp_out = out_dir / f"inspections-{d}.csv"
    viol_out = out_dir / f"violations-{d}.csv"
    prov_out: Path | None = None

    sess = make_session()
    _export_csv(
        sess,
        INSPECTIONS_PAGE,
        INSPECTIONS_EXPORT,
        "",
        "InspectionDate_desc",
        insp_out,
    )
    polite_sleep(1.0)
    _export_csv(
        sess,
        VIOLATIONS_PAGE,
        VIOLATIONS_EXPORT,
        "",
        "IncidentDate_desc",
        viol_out,
    )
    if include_providers:
        prov_out = out_dir / f"providers-{d}.csv"
        polite_sleep(1.0)
        _export_csv(
            sess,
            PROVIDERS_PAGE,
            PROVIDERS_EXPORT,
            "MemoryCare=Yes",
            "Name",
            prov_out,
            extra_body={"initialLoad": "false"},
        )
    return insp_out, viol_out, prov_out


def main() -> int:
    ap = argparse.ArgumentParser(description="Oregon LTC inspections + violations CSV export")
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=REPO_ROOT / ".firecrawl" / "or-scrape",
        help="Output directory",
    )
    ap.add_argument(
        "--providers",
        action="store_true",
        help="Also export memory-care provider roster CSV",
    )
    args = ap.parse_args()
    try:
        export_all(args.out_dir, args.providers)
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
