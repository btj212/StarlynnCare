#!/usr/bin/env python3
"""
WA Signal: EARC-SDC Contract (DSHS SDCP List) — Wave 2b.

Writes wa_earc_sdc_contracted = true for ALFs that hold an EARC Specialized
Dementia Care (SDC) contract — the Specialized Dementia Care Program (SDCP).

Source: DSHS SDCP-ALF list
  https://www.dshs.wa.gov/altsa/home-and-community-services/
          specialized-dementia-care-program-assisted-living-facilities

The page contains a table or downloadable list of SDCP-contracted ALFs.
This script scrapes the HTML table OR reads a manually exported CSV.

Usage:
  python3 scrapers/wa_signal_sdcp.py                  # scrape live page
  python3 scrapers/wa_signal_sdcp.py --file list.csv  # from local CSV
  python3 scrapers/wa_signal_sdcp.py --dry-run
"""

from __future__ import annotations

import argparse
import csv
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

from _http_helpers import make_session, polite_sleep

SDCP_URL = (
    "https://www.dshs.wa.gov/altsa/home-and-community-services/"
    "specialized-dementia-care-program-assisted-living-facilities"
)


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


def scrape_sdcp_page() -> list[str]:
    """
    Scrape the DSHS SDCP page for license numbers.

    The page lists contracted ALFs. We extract license numbers from the table
    or from text patterns matching WA license format.
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        print(
            "  beautifulsoup4 not installed — run: pip install beautifulsoup4",
            file=sys.stderr,
        )
        return []

    # DSHS blocks non-browser UAs; use a browser UA for this request
    session = make_session(
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )
    )
    print(f"  Fetching SDCP page: {SDCP_URL}")
    resp = session.get(SDCP_URL, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    licenses: list[str] = []

    # Try to find table rows with license numbers
    for table in soup.find_all("table"):
        headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
        lic_col_idx = None
        for i, h in enumerate(headers):
            if "licens" in h or h in ("lic", "lic #", "lic#"):
                lic_col_idx = i
                break

        for tr in table.find_all("tr"):
            cells = tr.find_all("td")
            if not cells:
                continue
            if lic_col_idx is not None and lic_col_idx < len(cells):
                raw = cells[lic_col_idx].get_text(strip=True)
            else:
                # Heuristic: try all cells for a numeric-looking value
                raw = ""
                for cell in cells:
                    txt = cell.get_text(strip=True)
                    if re.match(r"^\d{4,10}$", txt):
                        raw = txt
                        break
            lic = pad_wa_license(raw)
            if lic:
                licenses.append(lic)

    # Also extract any inline license-number patterns (e.g. "License #: 1234567890")
    text = soup.get_text()
    for m in re.finditer(r"(?:licens(?:e|ed)\s*(?:#|num(?:ber)?)?:?\s*)(\d{4,10})", text, re.I):
        lic = pad_wa_license(m.group(1))
        if lic:
            licenses.append(lic)

    return list(set(licenses))


def load_from_csv(path: Path) -> list[str]:
    licenses: list[str] = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        headers = list(reader.fieldnames or [])
        col = None
        for h in headers:
            nk = re.sub(r"[^a-z0-9]", "", (h or "").lower())
            if "licens" in nk or nk in ("lic", "licnum"):
                col = h
                break
        if not col and headers:
            col = headers[0]
        for row in reader:
            raw = row.get(col or "", "")
            lic = pad_wa_license(raw)
            if lic:
                licenses.append(lic)
    return licenses


def stamp_sdcp(
    conn: psycopg.Connection,
    licenses: list[str],
    *,
    dry_run: bool = False,
) -> int:
    if not licenses:
        return 0
    if dry_run:
        print(f"  DRY-RUN: would stamp {len(licenses)} SDCP licenses")
        return 0
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE facilities
            SET wa_earc_sdc_contracted = true,
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
    parser = argparse.ArgumentParser(description="WA signal: EARC-SDC / SDCP contract")
    parser.add_argument("--file", type=Path, help="Local CSV with license numbers")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    load_env()
    conn = get_conn()
    print("=== WA Signal: EARC-SDC Contract (SDCP) ===")

    if args.file:
        licenses = load_from_csv(args.file)
        print(f"  Loaded {len(licenses)} licenses from {args.file.name}")
    else:
        licenses = scrape_sdcp_page()
        print(f"  Scraped {len(licenses)} licenses from DSHS page")

    if not licenses:
        print("  No licenses found — nothing to update.")
        conn.close()
        return

    n = stamp_sdcp(conn, licenses, dry_run=args.dry_run)
    print(f"  Updated: {n}")
    conn.close()


if __name__ == "__main__":
    main()
