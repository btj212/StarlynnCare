#!/usr/bin/env python3
"""
Oregon Enhanced Oversight Signal — populate enhanced_oversight on facilities.

Scrapes the APD Updates page (or the Enhanced Oversight program list) at:
  https://www.oregon.gov/odhs/licensing/community-based-care/Pages/eo.aspx
  (and related pages where OR-DHS publishes Enhanced Oversight & Supervision lists)

Any facility named on the current EO list has enhanced_oversight set to true.
Facilities NOT on the list are NOT set to false (use --reset to clear old flags).

Usage:
  python3 scrapers/or_signal_enhanced_oversight.py --dry-run
  python3 scrapers/or_signal_enhanced_oversight.py
  python3 scrapers/or_signal_enhanced_oversight.py --reset   # also clears stale true flags
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "OR"

# Primary EO list URL — may need updating if ODHS changes the page slug
_EO_URLS = [
    "https://www.oregon.gov/odhs/licensing/community-based-care/Pages/eo.aspx",
    "https://www.oregon.gov/dhs/SENIORS-DISABILITIES/APD/Pages/enhanced-oversight.aspx",
]


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


def normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().strip())


def scrape_eo_names(session: requests.Session) -> list[str]:
    """
    Returns a list of facility names currently under Enhanced Oversight.
    Tries each URL in _EO_URLS until one yields non-empty results.
    """
    tag_re = re.compile(r"<[^>]+>")
    td_re  = re.compile(r"<td[^>]*>(.*?)</td>", re.IGNORECASE | re.DOTALL)
    li_re  = re.compile(r"<li[^>]*>(.*?)</li>", re.IGNORECASE | re.DOTALL)

    for url in _EO_URLS:
        try:
            resp = session.get(url, timeout=30)
            resp.raise_for_status()
            html = resp.text

            names: list[str] = []
            # Try table cells first
            for m in td_re.finditer(html):
                text = tag_re.sub("", m.group(1)).strip()
                if len(text) > 5 and not re.match(r"^(facility|name|provider|address)$", text, re.IGNORECASE):
                    names.append(text)

            # Fallback: list items
            if not names:
                for m in li_re.finditer(html):
                    text = tag_re.sub("", m.group(1)).strip()
                    if len(text) > 5:
                        names.append(text)

            if names:
                print(f"  EO page: found {len(names)} candidate names from {url}")
                return names

        except Exception as exc:
            print(f"  WARN: could not fetch {url}: {exc}", file=sys.stderr)

    print("  WARN: no EO names found — no enhanced_oversight flags will be set", file=sys.stderr)
    return []


def names_match(eo_name: str, db_name: str) -> bool:
    pn = normalize(eo_name)
    dn = normalize(db_name)
    return pn == dn or pn in dn or dn in pn


def run(dry_run: bool, reset: bool) -> None:
    session = requests.Session()
    session.headers["User-Agent"] = "StarlynnCare-bot/1.0 (+https://starlynn.care)"

    eo_names = scrape_eo_names(session)

    conn = get_conn()

    with conn.cursor() as cur:
        cur.execute("SELECT id, name FROM facilities WHERE state_code = 'OR'")
        facilities = cur.fetchall()

    to_set: list[str] = []
    to_clear: list[str] = []

    for fac_id, fac_name in facilities:
        fac_name_s = fac_name or ""
        matched = any(names_match(eo, fac_name_s) for eo in eo_names)
        if matched:
            to_set.append(str(fac_id))
        elif reset:
            to_clear.append(str(fac_id))

    print(f"  EO: set={len(to_set)}, clear={len(to_clear)} (reset={reset})")

    if dry_run:
        print("  ... (dry-run, no DB writes)")
        return

    with conn:
        for fac_id in to_set:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE facilities SET enhanced_oversight = true WHERE id = %s",
                    (fac_id,),
                )
        if reset:
            for fac_id in to_clear:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE facilities SET enhanced_oversight = false WHERE id = %s",
                        (fac_id,),
                    )
        conn.commit()

    print(f"  Done — {len(to_set)} facilities flagged as Enhanced Oversight")


def main() -> None:
    parser = argparse.ArgumentParser(description="Set OR enhanced_oversight signal from APD page.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Also clear enhanced_oversight=true for facilities not on current EO list",
    )
    args = parser.parse_args()

    load_env()
    run(args.dry_run, args.reset)


if __name__ == "__main__":
    main()
