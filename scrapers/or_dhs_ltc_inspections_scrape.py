# RETIRED — do not run.
# Replaced by the OR Full Universe rebuild (migration 0033_or_universe.sql).
# New pipeline: or_providers_ingest.py, or_inspections_ingest.py, or_violations_ingest.py,
#               or_regulatory_actions_ingest.py, or_signal_mce.py, or_afh_detail.py, etc.
# Key reason: this script zero-pads Provider IDs, breaking alphanumeric IDs like '50M300'.
# See scripts/or_overnight_run.sh for the replacement orchestration.
#
# Original content preserved below for reference.
# ─────────────────────────────────────────────────────────────────────────────
import sys; print('ERROR: or_dhs_ltc_inspections_scrape.py is retired. Run or_providers_ingest.py instead.', file=sys.stderr); sys.exit(1)

#!/usr/bin/env python3
"""
Download Oregon DHS LTC Licensing inspections + violations CSV exports (ALF/RCF).

POST /Inspections/Export and /Violations/Export after GET for CSRF.
Saves to .firecrawl/or-scrape/inspections-YYYY-MM-DD.csv and violations-YYYY-MM-DD.csv
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

from _http_helpers import extract_csrf_token, polite_sleep, session_get, session_post, make_session

BASE = "https://ltclicensing.oregon.gov"
INSPECTIONS_PAGE = f"{BASE}/Inspections"
INSPECTIONS_EXPORT = f"{BASE}/Inspections/Export"
VIOLATIONS_PAGE = f"{BASE}/Violations"
VIOLATIONS_EXPORT = f"{BASE}/Violations/Export"

# Full CSV export; portal returns an empty grid when Filters=ProviderType=ALF&ProviderType=RCF.
# ALF + RCF are kept in [`or_ltc_to_bundle.py`](./or_ltc_to_bundle.py).
FILTERS_INSPECTIONS = ""
FILTERS_VIOLATIONS = ""


def _export_csv(
    sess: object,
    page_url: str,
    export_url: str,
    filters: str,
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
        "Filters": filters,
        "type": "csv",
        "__RequestVerificationToken": token,
    }

    r2 = session_post(sess, export_url, data=body, headers={"Referer": page_url})  # type: ignore[arg-type]
    r2.raise_for_status()
    out_path.write_bytes(r2.content)
    print(f"Wrote {out_path} ({len(r2.content)} bytes)")


def main() -> int:
    ap = argparse.ArgumentParser(description="Oregon LTC inspections + violations CSV export")
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=REPO_ROOT / ".firecrawl" / "or-scrape",
        help="Output directory",
    )
    args = ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    d = date.today().isoformat()
    insp_out = args.out_dir / f"inspections-{d}.csv"
    viol_out = args.out_dir / f"violations-{d}.csv"

    try:
        sess = make_session()
        _export_csv(
            sess,
            INSPECTIONS_PAGE,
            INSPECTIONS_EXPORT,
            FILTERS_INSPECTIONS,
            "InspectionDate_desc",
            insp_out,
        )
        polite_sleep(1.0)
        _export_csv(
            sess,
            VIOLATIONS_PAGE,
            VIOLATIONS_EXPORT,
            FILTERS_VIOLATIONS,
            "IncidentDate_desc",
            viol_out,
        )
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
