#!/usr/bin/env python3
"""
Oregon AFH Detail Page Ingest — populate afh_class and detail_url_id.

The ltclicensing.oregon.gov portal renders AFH detail pages at:
  /Facilities/Details/{detail_url_id}

The detail_url_id is NOT the same as the Provider ID in every case.
This script:
  1. Resolves detail_url_id for AFH facilities by fetching the list page
     and parsing the "Details" href for each row.
  2. Fetches each detail page and calls the AJAX endpoint that returns the
     facility type string (e.g. "Adult Foster Home - 3"), then parses the class.

AJAX endpoint pattern (from browser network tab — YMMV if portal updates):
  GET /Facilities/Details/{id}/GetFacilityDetails
  Accept: application/json
  Returns JSON with a field like {"facilityType": "Adult Foster Home - 3"}

NOTE: The detail page is a .NET MVC app with JS-rendered tabs. The main HTML
shell does not contain the class — we call the AJAX endpoint directly.

Usage:
  python3 scrapers/or_afh_detail.py --dry-run
  python3 scrapers/or_afh_detail.py
  python3 scrapers/or_afh_detail.py --limit 50
  python3 scrapers/or_afh_detail.py --facility-id <uuid>
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
import random
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "OR"

BASE_URL = "https://ltclicensing.oregon.gov"
LIST_URL = f"{BASE_URL}/Providers?type=AFH&status=Open"

# AJAX endpoint template — populate with detail_url_id
AJAX_TMPL = "{base}/Facilities/Details/{id}/GetFacilityDetails"

# Pattern to extract class number from "Adult Foster Home - {N}"
_AFH_CLASS_RE = re.compile(r"adult foster home\s*-\s*([123])", re.IGNORECASE)
# Pattern to parse the Details href from list page HTML
_DETAILS_HREF_RE = re.compile(r"/Facilities/Details/(\d+)", re.IGNORECASE)


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


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": "StarlynnCare-bot/1.0 (+https://starlynn.care)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    })
    return s


def polite_sleep() -> None:
    time.sleep(1.0 + random.random())


def fetch_detail_url_ids(session: requests.Session) -> dict[str, str]:
    """
    Fetch the AFH provider list page and extract (external_id -> detail_url_id) pairs
    from the Details href for each row.
    Returns dict mapping external_id -> detail_url_id string.
    """
    id_map: dict[str, str] = {}
    try:
        resp = session.get(LIST_URL, timeout=30)
        resp.raise_for_status()
        html = resp.text

        # Parse table rows: look for href="/Facilities/Details/{id}" adjacent to
        # an ID column. Strategy: find all <tr> blocks and extract both the
        # Provider ID text and the Details href.
        row_re = re.compile(r"<tr[^>]*>.*?</tr>", re.IGNORECASE | re.DOTALL)
        td_re  = re.compile(r"<td[^>]*>(.*?)</td>", re.IGNORECASE | re.DOTALL)
        a_re   = re.compile(r'href="(/Facilities/Details/(\d+)[^"]*)"', re.IGNORECASE)
        tag_re = re.compile(r"<[^>]+>")

        for row_m in row_re.finditer(html):
            row_html = row_m.group(0)
            cells = [tag_re.sub("", m.group(1)).strip() for m in td_re.finditer(row_html)]
            detail_m = a_re.search(row_html)
            if not detail_m or not cells:
                continue
            detail_id = detail_m.group(2)
            # First non-empty cell that looks like a provider ID
            ext_id = next((c for c in cells if re.match(r"[\dA-Z]{4,}", c, re.IGNORECASE)), None)
            if ext_id and detail_id:
                id_map[ext_id] = detail_id

        print(f"  List page: extracted {len(id_map)} (external_id → detail_url_id) pairs")
    except Exception as exc:
        print(f"  WARN: list page fetch failed ({exc}); detail_url_id will not be populated", file=sys.stderr)

    return id_map


def fetch_afh_class(session: requests.Session, detail_url_id: str) -> int | None:
    """
    Fetch the AJAX endpoint for a given detail_url_id and return the AFH class (1/2/3).
    Returns None if the call fails or the class isn't found.
    """
    url = AJAX_TMPL.format(base=BASE_URL, id=detail_url_id)
    try:
        resp = session.get(url, timeout=20, headers={"Accept": "application/json"})
        if resp.status_code == 404:
            return None
        resp.raise_for_status()

        try:
            data = resp.json()
        except Exception:
            data = {}

        # Try common JSON field names
        for field in ("facilityType", "FacilityType", "type", "Type", "licenseType"):
            val = data.get(field, "")
            if isinstance(val, str):
                m = _AFH_CLASS_RE.search(val)
                if m:
                    return int(m.group(1))

        # Fallback: search raw JSON text
        m = _AFH_CLASS_RE.search(resp.text)
        if m:
            return int(m.group(1))

    except Exception as exc:
        print(f"  WARN: AJAX call failed for detail_url_id={detail_url_id}: {exc}", file=sys.stderr)

    return None


def run(dry_run: bool, limit: int | None, facility_id_filter: str | None) -> None:
    session = make_session()

    # Step 1: resolve detail_url_id from list page
    detail_id_map = fetch_detail_url_ids(session)

    conn = get_conn()

    # Get AFH facilities that need detail enrichment
    with conn.cursor() as cur:
        if facility_id_filter:
            cur.execute(
                """
                SELECT id, external_id, detail_url_id
                FROM facilities
                WHERE state_code = 'OR' AND id = %s
                """,
                (facility_id_filter,),
            )
        else:
            cur.execute(
                """
                SELECT id, external_id, detail_url_id
                FROM facilities
                WHERE state_code = 'OR'
                  AND (license_type ILIKE '%AFH%' OR license_type ILIKE '%adult foster%')
                  AND afh_class IS NULL
                ORDER BY id
                """
                + (f" LIMIT {limit}" if limit else "")
            )
        afh_facilities = cur.fetchall()

    print(f"  AFH facilities to process: {len(afh_facilities)}")

    if dry_run:
        for fac_id, ext_id, det_id in afh_facilities[:5]:
            resolved = detail_id_map.get(ext_id or "", "?")
            print(f"    {fac_id}  ext={ext_id}  det_url={det_id or resolved}")
        print("  ... (dry-run, no DB writes)")
        return

    ok = err = no_class = 0
    with conn:
        for fac_id, ext_id, current_det_id in afh_facilities:
            # Resolve detail_url_id
            det_id = current_det_id or detail_id_map.get(ext_id or "")
            if not det_id:
                no_class += 1
                continue

            afh_class = fetch_afh_class(session, det_id)
            polite_sleep()

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE facilities
                    SET detail_url_id = %s, afh_class = %s
                    WHERE id = %s
                    """,
                    (det_id, afh_class, fac_id),
                )
            if afh_class is not None:
                ok += 1
            else:
                no_class += 1

        conn.commit()

    print(f"  Done — class found: {ok}, class not found: {no_class}, errors: {err}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch AFH detail pages + populate afh_class.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--facility-id", help="Process a single facility UUID")
    args = parser.parse_args()

    load_env()
    run(args.dry_run, args.limit, args.facility_id)


if __name__ == "__main__":
    main()
