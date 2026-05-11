#!/usr/bin/env python3
"""
Washington DSHS Advanced ALF Lookup — full licensed ALF roster as CSV.

Pulls ALL licensed Assisted Living Facilities from BHAdvLookup.aspx by default.
Use --contract to restrict to a specific contract type (e.g. "Dementia Care").

The search form on BHAdvLookup.aspx posts to BHAdvResults.aspx (no classic __VIEWSTATE).

Writes `.firecrawl/wa-scrape/adv-lookup-YYYY-MM-DD.csv` (full universe)
     or `.firecrawl/wa-scrape/adv-lookup-dementia-YYYY-MM-DD.csv` (targeted pull)

Usage:
    python3 scrapers/wa_dshs_directory_scrape.py
    python3 scrapers/wa_dshs_directory_scrape.py --contract "Dementia Care"
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

from _http_helpers import make_session, polite_sleep, session_get, session_post

BASE = "https://fortress.wa.gov/dshs/adsaapps/Lookup"
LOOKUP_PAGE = f"{BASE}/BHAdvLookup.aspx"
RESULTS_PAGE = f"{BASE}/BHAdvResults.aspx"

WA_COUNTIES = (
    "Adams",
    "Asotin",
    "Benton",
    "Chelan",
    "Clallam",
    "Clark",
    "Columbia",
    "Cowlitz",
    "Douglas",
    "Ferry",
    "Franklin",
    "Garfield",
    "Grant",
    "Grays Harbor",
    "Island",
    "Jefferson",
    "King",
    "Kitsap",
    "Kittitas",
    "Klickitat",
    "Lewis",
    "Lincoln",
    "Mason",
    "Okanogan",
    "Pacific",
    "Pend Oreille",
    "Pierce",
    "San Juan",
    "Skagit",
    "Skamania",
    "Snohomish",
    "Spokane",
    "Stevens",
    "Thurston",
    "Wahkiakum",
    "Walla Walla",
    "Whatcom",
    "Whitman",
    "Yakima",
)


def fetch_alf_csv(out_path: Path, contract: str | None = None) -> None:
    """Download the ALF roster CSV. Pass contract="Dementia Care" for a targeted pull."""
    sess = make_session()
    r = session_get(sess, LOOKUP_PAGE)
    r.raise_for_status()

    polite_sleep(1.0)

    # Core form fields — no contract filter by default (returns full ALF universe)
    data: list[tuple[str, str]] = [
        ("searchOpt", "county"),
        ("LicensedBedCount", "0"),
        ("opt_output", "csv"),
        ("submit1", "Search"),
    ]

    # Optionally restrict to a specific DSHS contract type
    if contract:
        data.append(("contract", contract))

    for c in WA_COUNTIES:
        data.append(("county", c))

    r2 = session_post(
        sess,
        RESULTS_PAGE,
        data=data,
        headers={"Referer": LOOKUP_PAGE, "Origin": "https://fortress.wa.gov"},
    )
    r2.raise_for_status()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(r2.content)
    print(f"Wrote {out_path} ({len(r2.content)} bytes)")


def main() -> int:
    ap = argparse.ArgumentParser(description="WA ADSA ALF roster CSV export")
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=REPO_ROOT / ".firecrawl" / "wa-scrape",
    )
    ap.add_argument(
        "--contract",
        type=str,
        default=None,
        help=(
            "Optional DSHS contract type to filter by (e.g. 'Dementia Care'). "
            "Omit to pull the full licensed ALF universe."
        ),
    )
    args = ap.parse_args()

    today = date.today().isoformat()
    if args.contract:
        slug = args.contract.lower().replace(" ", "-")
        out = args.out_dir / f"adv-lookup-{slug}-{today}.csv"
    else:
        out = args.out_dir / f"adv-lookup-{today}.csv"

    try:
        fetch_alf_csv(out, contract=args.contract)
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
