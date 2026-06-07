# RETIRED — do not run.
# Replaced by the OR Full Universe rebuild (migration 0033_or_universe.sql).
# New pipeline: or_providers_ingest.py, or_inspections_ingest.py, or_violations_ingest.py,
#               or_regulatory_actions_ingest.py, or_signal_mce.py, or_afh_detail.py, etc.
# Key reason: this script zero-pads Provider IDs, breaking alphanumeric IDs like '50M300'.
# See scripts/or_overnight_run.sh for the replacement orchestration.
#
# Original content preserved below for reference.
# ─────────────────────────────────────────────────────────────────────────────
import sys; print('ERROR: or_dhs_ltc_directory_scrape.py is retired. Run or_providers_ingest.py instead.', file=sys.stderr); sys.exit(1)

#!/usr/bin/env python3
"""
Download Oregon DHS LTC Licensing provider roster (Memory Care + Open + ALF/RCF) as CSV.

GET /Providers for CSRF, then POST /Providers/Export with application/x-www-form-urlencoded.

Saves to .firecrawl/or-scrape/providers-YYYY-MM-DD.csv (gitignored at scale).
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
PROVIDERS_PAGE = f"{BASE}/Providers"
EXPORT_URL = f"{BASE}/Providers/Export"

# MemoryCare=Yes alone returns data (~260 rows). Combining Status=Open with MemoryCare in one POST
# currently yields an empty grid from the server; filter to Open in ingest instead.
FILTERS_ROSTER = "MemoryCare=Yes"


def scrape_providers_csv(out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    sess = make_session()
    r = session_get(sess, PROVIDERS_PAGE)
    r.raise_for_status()
    token = extract_csrf_token(r.text)
    if not token:
        raise RuntimeError("Could not parse __RequestVerificationToken from /Providers")
    polite_sleep(1.0)

    body = {
        "PageNumber": "1",
        "PageSize": "9999",
        "Sorts": "Name",
        "Filters": FILTERS_ROSTER,
        "initialLoad": "false",
        "type": "csv",
        "__RequestVerificationToken": token,
    }
    r2 = session_post(sess, EXPORT_URL, data=body, headers={"Referer": PROVIDERS_PAGE})
    r2.raise_for_status()
    fn = out_dir / f"providers-{date.today().isoformat()}.csv"
    fn.write_bytes(r2.content)
    print(f"Wrote {fn} ({len(r2.content)} bytes)")
    return fn


def main() -> int:
    ap = argparse.ArgumentParser(description="Oregon LTC provider CSV export (memory care)")
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=REPO_ROOT / ".firecrawl" / "or-scrape",
        help="Output directory",
    )
    args = ap.parse_args()
    try:
        scrape_providers_csv(args.out_dir)
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
