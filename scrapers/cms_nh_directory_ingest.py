#!/usr/bin/env python3
"""
CMS Nursing Home Directory Ingest — Wave 1b.

Pulls CMS Provider Information for skilled nursing facilities (SNFs) in a given
state from data.cms.gov and upserts into `facilities`.

CMS dataset: Provider Information
UUID: 4pq5-n9py
URL: https://data.cms.gov/provider-data/dataset/4pq5-n9py

API pattern (no key, paginate 2000/page):
  GET https://data.cms.gov/data-api/v1/dataset/4pq5-n9py/data
      ?filter[condition][path]=STATE&filter[condition][operator]==&filter[condition][value]=WA

New facilities are inserted with:
  - wa_facility_type = 'NH'
  - care_category = 'nursing_home_memory_care' (if memory care unit present)
  - serves_memory_care = true (if CMS reports a memory care unit)
  - publishable = false  (pending review)

Existing facilities matched by cms_ccn are updated (star ratings, address, etc.).

Usage:
  python3 scrapers/cms_nh_directory_ingest.py --state WA
  python3 scrapers/cms_nh_directory_ingest.py --state WA --dry-run
  python3 scrapers/cms_nh_directory_ingest.py --state WA --limit 10
"""

from __future__ import annotations

import argparse
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
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import make_session, polite_sleep

# CMS uses a DKAN metadata endpoint to get the real CSV download URL.
# The "/data-api/v1/" pattern no longer works; use the DKAN API instead.
CMS_DKAN_META = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items"
PROVIDER_INFO_UUID = "4pq5-n9py"
PAGE_SIZE = 2000

# CMS fields we care about
_CMS_FIELDS = [
    "CMS Certification Number (CCN)",
    "Provider Name",
    "Provider Address",
    "Provider City",
    "Provider State",
    "Provider Zip Code",
    "County/Parish",
    "Phone Number",
    "Overall Rating",
    "Health Inspection Rating",
    "QM Rating",
    "Staffing Rating",
    "RN Staffing Rating",
    "Number of Certified Beds",
    "Average Number of Residents per Day",
    "Special Focus Status",
    "Most Recent Health Inspection More Than 2 Years Ago",
    "With a Resident and Family Council",
    "Latitude",
    "Longitude",
    "Processing Date",
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


def _get_cms_csv_url(session: requests.Session, dataset_uuid: str) -> str:
    """Resolve the current CSV download URL via the CMS DKAN metadata API."""
    meta_url = f"{CMS_DKAN_META}/{dataset_uuid}"
    resp = session.get(meta_url, timeout=30)
    resp.raise_for_status()
    meta = resp.json()
    distributions = meta.get("distribution", [])
    for dist in distributions:
        url = dist.get("downloadURL", "")
        if url.endswith(".csv"):
            return url
    raise RuntimeError(f"No CSV distribution found for CMS dataset {dataset_uuid}")


def fetch_cms_providers(
    session: requests.Session,
    state: str,
    *,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Fetch all CMS provider rows for the given state by downloading the full CSV."""
    import csv
    import io

    print(f"  Resolving CSV URL for dataset {PROVIDER_INFO_UUID}…")
    csv_url = _get_cms_csv_url(session, PROVIDER_INFO_UUID)
    print(f"  Downloading: {csv_url}")
    resp = session.get(csv_url, timeout=120, stream=True)
    resp.raise_for_status()

    all_rows: list[dict[str, Any]] = []
    content = resp.content.decode("utf-8-sig")  # strip BOM if present
    reader = csv.DictReader(io.StringIO(content))
    for row in reader:
        # CMS CSV uses "State" (not "Provider State")
        if row.get("State", "").strip().upper() == state.upper():
            all_rows.append(row)
        if limit and len(all_rows) >= limit:
            break

    print(f"  Found {len(all_rows)} rows for state={state}")
    if limit:
        return all_rows[:limit]
    return all_rows


def _safe_int(val: Any) -> int | None:
    if val is None:
        return None
    try:
        return int(str(val).strip())
    except (ValueError, TypeError):
        return None


def _safe_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        return float(str(val).strip())
    except (ValueError, TypeError):
        return None


def _safe_rating(val: Any) -> int | None:
    v = _safe_int(val)
    if v is None or not (1 <= v <= 5):
        return None
    return v


def _normalize_phone(raw: Any) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return str(raw)[:20] if raw else None


def _slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-") or "facility"


def _slug_from_name(name: str, city: str, ccn: str) -> tuple[str, str]:
    """Returns (city_slug, facility_slug)."""
    city_slug = _slugify(city) if city else "unknown-city"
    base = _slugify(f"{name}-{city}")
    return city_slug, f"{base}-{ccn}"


def upsert_facility(
    conn: psycopg.Connection,
    row: dict[str, Any],
    state: str,
    *,
    dry_run: bool = False,
) -> str:
    """Upsert one CMS row into facilities. Returns 'inserted' | 'updated' | 'skipped'."""
    ccn = str(row.get("CMS Certification Number (CCN)", "") or "").strip()
    if not ccn:
        return "skipped"

    name = str(row.get("Provider Name", "") or "").strip()
    address = str(row.get("Provider Address", "") or "").strip()
    city = str(row.get("City/Town", "") or row.get("Provider City", "") or "").strip()
    zip_code = str(row.get("ZIP Code", "") or row.get("Provider Zip Code", "") or "").strip()
    county = str(row.get("County/Parish", "") or "").strip()
    phone = _normalize_phone(row.get("Telephone Number") or row.get("Phone Number"))
    lat = _safe_float(row.get("Latitude"))
    lng = _safe_float(row.get("Longitude"))

    overall_rating = _safe_rating(row.get("Overall Rating"))
    beds = _safe_int(row.get("Number of Certified Beds"))

    if not name or not city:
        return "skipped"

    city_slug, slug = _slug_from_name(name, city, ccn)

    if dry_run:
        print(f"  DRY-RUN: {name} ({ccn})")
        return "skipped"

    with conn.cursor() as cur:
        # Check if exists by CCN
        cur.execute(
            "SELECT id FROM facilities WHERE cms_ccn = %s",
            (ccn,),
        )
        existing = cur.fetchone()

        if existing:
            # Update existing
            cur.execute(
                """
                UPDATE facilities SET
                    name = %s,
                    street = %s,
                    city = %s,
                    state_code = %s,
                    zip = %s,
                    wa_county = %s,
                    phone = %s,
                    latitude = %s,
                    longitude = %s,
                    beds = %s,
                    cms_overall_rating = %s,
                    wa_facility_type = CASE WHEN state_code='WA' THEN 'NH' ELSE wa_facility_type END,
                    updated_at = now()
                WHERE cms_ccn = %s
                """,
                (
                    name, address, city, state.upper(), zip_code, county,
                    phone, lat, lng, beds, overall_rating, ccn,
                ),
            )
            conn.commit()
            return "updated"
        else:
            # Insert new
            cur.execute(
                """
                INSERT INTO facilities (
                    state_code, name, street, city, city_slug, zip, wa_county,
                    phone, latitude, longitude, beds,
                    cms_ccn, cms_overall_rating,
                    wa_facility_type,
                    facility_type, license_status,
                    serves_memory_care, publishable,
                    mc_review_status,
                    slug
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s,
                    %s,
                    %s, %s,
                    false, false,
                    'needs_review',
                    %s
                )
                ON CONFLICT (state_code, city_slug, slug) DO UPDATE
                SET cms_ccn = EXCLUDED.cms_ccn,
                    cms_overall_rating = EXCLUDED.cms_overall_rating,
                    updated_at = now()
                """,
                (
                    state.upper(), name, address, city, city_slug, zip_code, county,
                    phone, lat, lng, beds,
                    ccn, overall_rating,
                    "NH",
                    "Nursing Home", "LICENSED",
                    slug,
                ),
            )
            conn.commit()
            return "inserted"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="CMS NH directory ingest — Wave 1b")
    parser.add_argument("--state", default="WA", help="Two-letter state code")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, help="Max facilities to process")
    args = parser.parse_args(argv)

    load_env()

    print(f"=== CMS NH Directory Ingest — {args.state.upper()} ===")
    session = make_session()
    conn = get_conn()

    print("Step 1: Fetching CMS provider data…")
    rows = fetch_cms_providers(session, args.state.upper(), limit=args.limit)
    print(f"  {len(rows)} facilities from CMS")

    inserted = updated = skipped = 0
    for row in rows:
        result = upsert_facility(conn, row, args.state.upper(), dry_run=args.dry_run)
        if result == "inserted":
            inserted += 1
        elif result == "updated":
            updated += 1
        else:
            skipped += 1

    print(f"\nInserted: {inserted}  Updated: {updated}  Skipped: {skipped}")
    conn.close()


if __name__ == "__main__":
    main()
