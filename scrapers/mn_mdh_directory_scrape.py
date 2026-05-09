#!/usr/bin/env python3
"""
Download Minnesota MDH facility directory extract (Excel).

GET https://mdhprovidercontent.web.health.state.mn.us/facilityDirectoryExtract.cfm
No auth. Saves to .firecrawl/mn-scrape/facility-directory-YYYY-MM-DD.xlsx
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

from _http_helpers import make_session, session_get, polite_sleep

URL = "https://mdhprovidercontent.web.health.state.mn.us/facilityDirectoryExtract.cfm"


def main() -> int:
    ap = argparse.ArgumentParser(description="MDH facility directory Excel download")
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=REPO_ROOT / ".firecrawl" / "mn-scrape",
    )
    args = ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    out = args.out_dir / f"facility-directory-{date.today().isoformat()}.xlsx"

    try:
        sess = make_session()
        polite_sleep(0.5)
        r = session_get(sess, URL)
        r.raise_for_status()
        out.write_bytes(r.content)
        print(f"Wrote {out} ({len(r.content)} bytes)")
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
