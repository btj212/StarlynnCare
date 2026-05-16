#!/usr/bin/env python3
"""
WA Signal: Dementia Specialty Designation — Wave 2b.

Writes wa_dementia_specialty = true for AFHs and ALFs that carry the
"dementia specialty" designation from DSHS (training-based, not a contract).

Source: BHAdvLookup + AFHAdvLookup with specialty/dementia filter
  ALF: https://fortress.wa.gov/dshs/adsaapps/lookup/BHAdvLookup.aspx
       (filter: Special Focus = Dementia)
  AFH: https://fortress.wa.gov/dshs/adsaapps/lookup/AFHAdvLookup.aspx
       (filter: Special Focus = Dementia)

Usage:
  python3 scrapers/wa_signal_dementia_specialty.py           # scrape both sources
  python3 scrapers/wa_signal_dementia_specialty.py --type BH # ALFs only
  python3 scrapers/wa_signal_dementia_specialty.py --type AFH # AFHs only
  python3 scrapers/wa_signal_dementia_specialty.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import make_session, polite_sleep, extract_aspnet_state

BH_BASE = "https://fortress.wa.gov/dshs/adsaapps/lookup/BHAdvLookup.aspx"
AFH_BASE = "https://fortress.wa.gov/dshs/adsaapps/lookup/AFHAdvLookup.aspx"


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
            return


def get_conn() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    return psycopg.connect(url)


def pad_wa_license(raw: Any) -> str:
    if raw is None or str(raw).strip() == "":
        return ""
    digits = re.sub(r"\D", "", str(raw))
    return digits.zfill(10) if digits else ""


def _extract_licenses_from_html(html: str) -> list[str]:
    """Extract license numbers from an ASP.NET lookup results page."""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return []

    soup = BeautifulSoup(html, "html.parser")
    licenses: list[str] = []

    for table in soup.find_all("table"):
        headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
        lic_col_idx = None
        for i, h in enumerate(headers):
            if "licens" in h or h in ("lic", "lic #", "lic#"):
                lic_col_idx = i
                break
        if lic_col_idx is None:
            continue
        for tr in table.find_all("tr"):
            cells = tr.find_all("td")
            if lic_col_idx < len(cells):
                raw = cells[lic_col_idx].get_text(strip=True)
                lic = pad_wa_license(raw)
                if lic:
                    licenses.append(lic)

    # Also catch inline license numbers
    for m in re.finditer(r"\b(\d{4,10})\b", html):
        lic = pad_wa_license(m.group(1))
        if lic and len(lic) == 10:
            licenses.append(lic)

    return list(set(licenses))


def scrape_adv_lookup(base_url: str, lookup_type: str) -> list[str]:
    """
    POST to the ASP.NET lookup form with a dementia specialty filter.

    Returns list of license numbers.
    """
    session = make_session()
    print(f"  Fetching {lookup_type} lookup form…")

    # GET to collect ASP.NET form state
    resp = session.get(base_url, timeout=30)
    resp.raise_for_status()
    aspnet_state = extract_aspnet_state(resp.text)

    # Build POST payload — specialty filter varies by form
    # BHAdvLookup: ddlSpecialPop or ddlContract may include dementia option
    # AFHAdvLookup: similar dropdown
    payload: dict[str, str] = {
        "__VIEWSTATE": aspnet_state.get("__VIEWSTATE", ""),
        "__EVENTVALIDATION": aspnet_state.get("__EVENTVALIDATION", ""),
        "__VIEWSTATEGENERATOR": aspnet_state.get("__VIEWSTATEGENERATOR", ""),
        "btnSearch": "Search",
    }

    # Try to set dementia/specialty filter
    if lookup_type == "BH":
        payload["ddlSpecialPop"] = "Dementia"
        payload["ddlStatus"] = "LICENSED"
    else:
        payload["ddlSpecFocus"] = "Dementia"
        payload["ddlStatus"] = "LICENSED"

    polite_sleep(1.0, 0.3)
    print(f"  POSTing search…")
    resp = session.post(base_url, data=payload, timeout=60)
    resp.raise_for_status()

    licenses = _extract_licenses_from_html(resp.text)
    print(f"  Extracted {len(licenses)} licenses from {lookup_type} form")
    return licenses


def stamp_dementia_specialty(
    conn: psycopg.Connection,
    licenses: list[str],
    *,
    dry_run: bool = False,
) -> int:
    if not licenses:
        return 0
    if dry_run:
        print(f"  DRY-RUN: would stamp {len(licenses)} dementia-specialty licenses")
        return 0
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE facilities
            SET wa_dementia_specialty = true,
                updated_at = now()
            WHERE state_code = 'WA'
              AND license_number = ANY(%s)
            """,
            (licenses,),
        )
        count = cur.rowcount
    conn.commit()
    return count


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="WA signal: dementia specialty designation")
    parser.add_argument(
        "--type",
        choices=["BH", "AFH", "both"],
        default="both",
        help="Which lookup form to scrape",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    load_env()
    conn = get_conn()
    print("=== WA Signal: Dementia Specialty Designation ===")

    licenses: list[str] = []
    if args.type in ("BH", "both"):
        licenses.extend(scrape_adv_lookup(BH_BASE, "BH"))
        polite_sleep(1.0)
    if args.type in ("AFH", "both"):
        licenses.extend(scrape_adv_lookup(AFH_BASE, "AFH"))

    licenses = list(set(licenses))
    print(f"\n  Total unique licenses: {len(licenses)}")

    if not licenses:
        print("  Nothing to update.")
        conn.close()
        return

    n = stamp_dementia_specialty(conn, licenses, dry_run=args.dry_run)
    print(f"  Updated: {n}")
    conn.close()


if __name__ == "__main__":
    main()
