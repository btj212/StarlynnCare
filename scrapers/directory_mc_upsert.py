#!/usr/bin/env python3
"""
Match APFM + Caring.com directory smoke-test JSON to CDSS facilities.

For each scraped listing, fuzzy-match name within the same city
and stamp the appropriate `mc_signal_apfm_listed` /
`mc_signal_caring_listed` column on the matched facility row.

Reads:
  .firecrawl/directory-match/apfm-ca-mc.json
  .firecrawl/directory-match/caring-ca-mc.json

Writes (in DB):
  facilities.mc_signal_apfm_listed = true
  facilities.mc_signal_caring_listed = true

This script does NOT change `mc_review_status`, `serves_memory_care`,
or `publishable`. Run `scrapers/recompute_publishable.py` afterwards.

Usage
-----
    python directory_mc_upsert.py --dry-run
    python directory_mc_upsert.py
    python directory_mc_upsert.py --source apfm   # only APFM
    python directory_mc_upsert.py --threshold 88  # tighter fuzzy match
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Iterable

import psycopg
from dotenv import load_dotenv

try:
    from rapidfuzz import fuzz
except ImportError:
    print("rapidfuzz not installed. Install via: pip install rapidfuzz>=3.0.0", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / ".firecrawl" / "directory-match"
SOURCES = {
    "apfm": ("apfm-ca-mc.json", "mc_signal_apfm_listed"),
    "caring": ("caring-ca-mc.json", "mc_signal_caring_listed"),
}

STATE_CODE = "CA"
DEFAULT_FUZZY_THRESHOLD = 85


def load_env() -> None:
    for n in (".env.local", ".env"):
        p = REPO_ROOT / n
        if p.is_file():
            load_dotenv(p)


def _normalize_name(name: str) -> str:
    """Lowercase + drop non-alphanumeric chars + collapse whitespace."""
    if not name:
        return ""
    s = name.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def fuzzy_match(
    listing_name: str,
    candidates: Iterable[tuple[str, str]],  # (id, name)
    threshold: int,
) -> tuple[str, int] | None:
    """Return (best_id, best_score) above threshold, else None."""
    target = _normalize_name(listing_name)
    if not target:
        return None
    best_id = None
    best_score = 0
    for fid, fname in candidates:
        score = fuzz.token_set_ratio(target, _normalize_name(fname))
        if score > best_score:
            best_score = score
            best_id = fid
    if best_id and best_score >= threshold:
        return (best_id, best_score)
    return None


def upsert_directory(
    conn: psycopg.Connection,
    json_path: Path,
    column: str,
    threshold: int,
    dry_run: bool,
) -> tuple[int, int, int]:
    """Returns (listings, matched, updated)."""
    if not json_path.exists():
        print(f"  [skip] {json_path} not found")
        return (0, 0, 0)

    payload = json.loads(json_path.read_text())
    listings = payload.get("facilities", [])
    print(f"  loaded {len(listings)} listings from {json_path.name}")

    matched = 0
    updated = 0
    cur = conn.cursor()

    by_city: dict[str, list[tuple[str, str]]] = {}
    for listing in listings:
        city = (listing.get("city") or "").strip()
        if not city:
            continue
        if city not in by_city:
            cur.execute(
                "SELECT id, name FROM facilities WHERE state_code=%s AND license_status='LICENSED' AND city ILIKE %s",
                (STATE_CODE, city),
            )
            by_city[city] = list(cur.fetchall())

    for listing in listings:
        name = (listing.get("name") or "").strip()
        city = (listing.get("city") or "").strip()
        if not name or not city:
            continue

        candidates = by_city.get(city, [])
        if not candidates:
            continue

        result = fuzzy_match(name, candidates, threshold)
        if not result:
            continue
        facility_id, score = result
        matched += 1

        if dry_run:
            print(f"    {score:>3} {name!r} → facility_id={facility_id}")
            continue

        cur.execute(
            f"UPDATE facilities SET {column} = true WHERE id = %s AND {column} = false",
            (facility_id,),
        )
        if cur.rowcount > 0:
            updated += 1

    return (len(listings), matched, updated)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=list(SOURCES) + ["all"], default="all")
    parser.add_argument("--threshold", type=int, default=DEFAULT_FUZZY_THRESHOLD)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_env()
    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    sources = list(SOURCES) if args.source == "all" else [args.source]

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        totals = {"listings": 0, "matched": 0, "updated": 0}
        for src in sources:
            json_name, column = SOURCES[src]
            print(f"\n=== {src.upper()} ===")
            listings, matched, updated = upsert_directory(
                conn, DATA_DIR / json_name, column, args.threshold, args.dry_run
            )
            print(f"  listings={listings}  matched={matched}  updated={updated}")
            totals["listings"] += listings
            totals["matched"] += matched
            totals["updated"] += updated

        if not args.dry_run:
            conn.commit()

        print()
        print("=== Totals ===")
        for k, v in totals.items():
            print(f"  {k:<10} {v}")


if __name__ == "__main__":
    main()
