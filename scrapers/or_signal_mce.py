#!/usr/bin/env python3
"""
Oregon MCE Signal — cross-reference and upgrade mce_endorsed + mce_evidence.

IMPORTANT: The Providers CSV (ingested by or_providers_ingest.py) has a
"Memory Care" boolean that already sets mce_endorsed + mce_evidence='providers_csv'
for all 251 open MCE-endorsed facilities.  This script is a supplemental pass.

Sources (in strength order):
  1. CSS portal — cross-reference the Consumer Summary Statements page to upgrade
     mce_evidence from 'providers_csv' → 'CSS portal' when matched.
  2. Name pattern — catches facilities where mce_endorsed is NULL (newly opened,
     not yet in CSV export) but name contains "Memory Care Endorsed".
  3. Hint-only — facilities with MC-like names but no endorsement signal;
     sets mce_evidence='name hint', does NOT set mce_endorsed=true.

Run AFTER or_providers_ingest.py to enrich provenance, not as the primary signal.

Usage:
  python3 scrapers/or_signal_mce.py --dry-run
  python3 scrapers/or_signal_mce.py
  python3 scrapers/or_signal_mce.py --input mce_list.csv   # optional PRA CSV
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "OR"

CSS_PORTAL_URL = (
    "https://www.oregon.gov/odhs/licensing/community-based-care/Pages/css.aspx"
)

# Name patterns that reliably indicate OR MCE endorsement
_MCE_NAME_PATTERNS = [
    re.compile(r"\bmemory care endorsed\b", re.IGNORECASE),
    re.compile(r"\bORS 443\.886\b", re.IGNORECASE),
]

# Name patterns that suggest (but don't confirm) memory care
_MC_NAME_HINTS = [
    re.compile(r"\bmemory care\b", re.IGNORECASE),
    re.compile(r"\balzheimer\b", re.IGNORECASE),
    re.compile(r"\bdementia\b", re.IGNORECASE),
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


def scrape_css_portal(session: requests.Session) -> list[dict[str, str]]:
    """
    Scrape the CSS portal for endorsed facility names.
    Returns list of dicts with keys: name, city.
    Falls back to empty list on error (non-fatal — name-pattern pass still runs).
    """
    results: list[dict[str, str]] = []
    try:
        resp = session.get(CSS_PORTAL_URL, timeout=30)
        resp.raise_for_status()
        html = resp.text

        # Parse table rows — the portal renders an HTML table of endorsed communities.
        # Column order: Facility Name | City | County | Type
        row_re = re.compile(
            r"<tr[^>]*>.*?</tr>",
            re.IGNORECASE | re.DOTALL,
        )
        td_re = re.compile(r"<td[^>]*>(.*?)</td>", re.IGNORECASE | re.DOTALL)
        tag_re = re.compile(r"<[^>]+>")

        for match in row_re.finditer(html):
            cells = [tag_re.sub("", m.group(1)).strip() for m in td_re.finditer(match.group(0))]
            if len(cells) >= 2 and cells[0].lower() not in ("facility name", "name", "provider"):
                results.append({"name": cells[0], "city": cells[1] if len(cells) > 1 else ""})

        print(f"  CSS portal: found {len(results)} endorsed facilities")
    except Exception as exc:
        print(f"  WARN: CSS portal scrape failed ({exc}); falling back to name-pattern only", file=sys.stderr)

    return results


def normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().strip())


def names_match(portal_name: str, db_name: str) -> bool:
    """Fuzzy name match — portal names may be shorter or use abbreviations."""
    pn = normalize(portal_name)
    dn = normalize(db_name)
    return pn == dn or pn in dn or dn in pn


def load_pra_csv(path: Path) -> list[dict[str, str]]:
    """Load an optional PRA-exported CSV of endorsed facilities (name, city columns)."""
    results: list[dict[str, str]] = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            keys = {k.lower().strip(): v for k, v in row.items()}
            name = keys.get("name") or keys.get("facility name") or ""
            city = keys.get("city") or ""
            if name:
                results.append({"name": name.strip(), "city": city.strip()})
    print(f"  PRA CSV: loaded {len(results)} entries from {path.name}")
    return results


def run(dry_run: bool, pra_csv: Path | None) -> None:
    session = requests.Session()
    session.headers["User-Agent"] = "StarlynnCare-bot/1.0 (+https://starlynn.care)"

    endorsed_from_portal = scrape_css_portal(session)

    endorsed_from_pra: list[dict[str, str]] = []
    if pra_csv and pra_csv.exists():
        endorsed_from_pra = load_pra_csv(pra_csv)

    conn = get_conn()

    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, city FROM facilities WHERE state_code = 'OR'",
        )
        facilities = cur.fetchall()

    print(f"  Checking {len(facilities)} OR facilities")

    updates: list[tuple[str, bool, str]] = []  # (facility_id, mce_endorsed, mce_evidence)

    for fac_id, fac_name, fac_city in facilities:
        fac_name_s = fac_name or ""
        fac_city_s = fac_city or ""

        # Source 1: CSS portal
        for entry in endorsed_from_portal:
            if names_match(entry["name"], fac_name_s):
                updates.append((str(fac_id), True, "CSS portal"))
                break
        else:
            # Source 1 from PRA
            for entry in endorsed_from_pra:
                if names_match(entry["name"], fac_name_s):
                    updates.append((str(fac_id), True, "PRA list"))
                    break
            else:
                # Source 2: MCE name pattern
                if any(p.search(fac_name_s) for p in _MCE_NAME_PATTERNS):
                    updates.append((str(fac_id), True, "name match"))
                else:
                    # Source 3: hint-only (not endorsed, just flagged)
                    if any(p.search(fac_name_s) for p in _MC_NAME_HINTS):
                        updates.append((str(fac_id), False, "name hint"))

    endorsed_count = sum(1 for _, e, _ in updates if e)
    hint_count = sum(1 for _, e, _ in updates if not e)
    print(f"  mce_endorsed=true: {endorsed_count}, hints (not endorsed): {hint_count}")

    if dry_run:
        for fac_id, endorsed, evidence in updates[:10]:
            print(f"    {fac_id}  endorsed={endorsed}  evidence={evidence}")
        print("  ... (dry-run, no DB writes)")
        return

    with conn:
        for fac_id, endorsed, evidence in updates:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE facilities
                    SET mce_endorsed = %s, mce_evidence = %s
                    WHERE id = %s
                    """,
                    (endorsed, evidence, fac_id),
                )
        conn.commit()

    print(f"  Updated {len(updates)} facilities with MCE signal")


def main() -> None:
    parser = argparse.ArgumentParser(description="Populate OR mce_endorsed + mce_evidence signals.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--input", help="Optional: path to PRA CSV of endorsed facilities")
    args = parser.parse_args()

    load_env()
    pra_csv = Path(args.input) if args.input else None
    run(args.dry_run, pra_csv)


if __name__ == "__main__":
    main()
