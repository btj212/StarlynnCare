#!/usr/bin/env python3
"""
Missouri DHSS Directory Ingest — Socrata data.mo.gov fenu-sipv

Pulls all ALF/RCF licensed facilities from the Missouri DHSS LTC Directory
and upserts them into the facilities table.

Memory care gate (Tier-1, YMYL-safe):
  - PRIMARY:   alzheimer_s_scu=true (Alzheimer's Special Care Disclosure, §198.510 RSMo)
  - SECONDARY: level_of_care='ALF**' (licensed for non-self-evacuating residents, §198.073.6)
  - Name-keyword match is NOT used as a standalone signal (too weak for YMYL)

Scope: ALF, ALF**, RCF, RCF* only (exclude SNF/ICF nursing lines)
Primary key: (state_code='MO', external_id=facility_number)

Usage:
    python3 scrapers/mo_dhss_directory_ingest.py
    python3 scrapers/mo_dhss_directory_ingest.py --dry-run
    python3 scrapers/mo_dhss_directory_ingest.py --mc-only   # only ALF**/scu rows
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from typing import Any

import psycopg
from psycopg.rows import dict_row

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SOCRATA_BASE = "https://data.mo.gov/resource/fenu-sipv.json"
SOCRATA_LIMIT = 5000  # well above 1,101 rows

# Scope: ALF/RCF license types (exclude SNF/ICF)
ALF_RCF_TYPES = {"ALF", "ALF**", "RCF", "RCF*"}

# MC keyword fallback — not used as standalone gate, only to flag for review
_MC_KEYWORDS = re.compile(
    r"\b(memory.?care|dementia|alzheimer|reminiscence|cognitive|secured)\b",
    re.IGNORECASE,
)

DSN = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")

# ---------------------------------------------------------------------------
# Upsert SQL
# ---------------------------------------------------------------------------

_UPSERT = """
INSERT INTO facilities (
    state_code, external_id, slug, name, street, city, city_slug, zip,
    county, phone, beds, operator_name, ownership_type,
    serves_memory_care, memory_care_disclosure_filed, memory_care_disclosure_source,
    mo_level_of_care, mo_alzheimer_scu, mo_scu_capacity,
    publishable, license_status
)
VALUES (
    'MO', %(external_id)s, %(slug)s, %(name)s, %(street)s, %(city)s, %(city_slug)s, %(zip)s,
    %(county)s, %(phone)s, %(beds)s, %(operator_name)s, %(ownership_type)s,
    %(serves_memory_care)s, %(memory_care_disclosure_filed)s, %(disclosure_source)s,
    %(mo_level_of_care)s, %(mo_alzheimer_scu)s, %(mo_scu_capacity)s,
    false, %(license_status)s
)
ON CONFLICT (state_code, external_id) WHERE state_code = 'MO'
DO UPDATE SET
    name                             = excluded.name,
    street                           = excluded.street,
    city                             = excluded.city,
    zip                              = excluded.zip,
    county                           = excluded.county,
    phone                            = excluded.phone,
    beds                             = excluded.beds,
    operator_name                    = excluded.operator_name,
    ownership_type                   = excluded.ownership_type,
    serves_memory_care               = excluded.serves_memory_care,
    memory_care_disclosure_filed     = excluded.memory_care_disclosure_filed,
    memory_care_disclosure_source    = excluded.memory_care_disclosure_source,
    mo_level_of_care                 = excluded.mo_level_of_care,
    mo_alzheimer_scu                 = excluded.mo_alzheimer_scu,
    mo_scu_capacity                  = excluded.mo_scu_capacity,
    license_status                   = excluded.license_status,
    updated_at                       = now()
RETURNING id
"""


# ---------------------------------------------------------------------------
# Socrata fetch
# ---------------------------------------------------------------------------

def fetch_all_rows() -> list[dict[str, Any]]:
    params = {"$limit": SOCRATA_LIMIT}
    url = SOCRATA_BASE + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read())


# ---------------------------------------------------------------------------
# Row transform
# ---------------------------------------------------------------------------

def _parse_license_status(expiration_str: str | None) -> str:
    """Return 'LICENSED' if license expiration is in the future, else 'CLOSED'."""
    if not expiration_str:
        return "unknown"
    try:
        exp = datetime.fromisoformat(expiration_str.replace("Z", "+00:00"))
        return "LICENSED" if exp.date() >= date.today() else "CLOSED"
    except (ValueError, TypeError):
        return "unknown"


def _parse_beds(capacity: Any) -> int | None:
    try:
        return int(capacity)
    except (ValueError, TypeError):
        return None


def _parse_scu(scu_capacity: Any) -> int | None:
    try:
        v = int(scu_capacity)
        return v if v > 0 else None
    except (ValueError, TypeError):
        return None


def _parse_scu_flag(val: Any) -> bool:
    return str(val).lower() == "true"


def _ownership_from_definition(definition: str | None) -> str | None:
    if not definition:
        return None
    dl = definition.lower()
    if "non-profit" in dl or "nonprofit" in dl or "not for profit" in dl:
        return "non-profit"
    if "for profit" in dl or "for-profit" in dl or "profit" in dl:
        return "for-profit"
    if "government" in dl or "public" in dl:
        return "government"
    return None


def transform(row: dict[str, Any]) -> dict[str, Any] | None:
    """Return a params dict for the upsert, or None to skip."""
    level = (row.get("level_of_care") or "").strip().upper()
    if level not in ALF_RCF_TYPES:
        return None

    external_id = (row.get("facility_number") or "").strip()
    if not external_id:
        return None

    scu_flag = _parse_scu_flag(row.get("alzheimer_s_scu"))
    level_of_care = (row.get("level_of_care") or "").strip()
    is_alfstar = level_of_care.strip().upper() == "ALF**"

    # MC signal: alzheimer_s_scu=true OR ALF**
    serves_mc = scu_flag or is_alfstar
    disclosure_filed = scu_flag or is_alfstar
    disclosure_source = None
    if scu_flag:
        disclosure_source = "DHSS Alzheimer's SCU Disclosure §198.510"
    elif is_alfstar:
        disclosure_source = "DHSS ALF** license (§198.073.6 RSMo)"

    # Name: facility_name field (confirmed in probe)
    name = (row.get("facility_name") or "").strip()
    if not name:
        return None

    admin_first = (row.get("first_name_administrator") or "").strip()
    admin_last = (row.get("last_name_administrator") or "").strip()
    operator_name = (row.get("entity_name") or "").strip() or None

    phone_raw = (row.get("facility_phone_number") or "").strip()
    phone = phone_raw if phone_raw else None

    city_raw = (row.get("city") or "").strip() or None
    city_slug_tmp = re.sub(r"[^a-z0-9]+", "-", (city_raw or "").lower()).strip("-") or "unknown"
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") + "-mo" + external_id

    return {
        "external_id": external_id,
        "name": name,
        "slug": slug,
        "street": (row.get("address") or "").strip() or None,
        "city": city_raw,
        "city_slug": city_slug_tmp,
        "zip": (row.get("zip_code") or "").strip() or None,
        "county": (row.get("county") or "").strip() or None,
        "phone": phone,
        "beds": _parse_beds(row.get("capacity")),
        "operator_name": operator_name,
        "ownership_type": _ownership_from_definition(row.get("definition")),
        "serves_memory_care": serves_mc,
        "memory_care_disclosure_filed": disclosure_filed,
        "disclosure_source": disclosure_source,
        "mo_level_of_care": level_of_care,
        "mo_alzheimer_scu": scu_flag,
        "mo_scu_capacity": _parse_scu(_parse_beds(row.get("scucapacity")) if row.get("scucapacity") else None),
        "license_status": _parse_license_status(row.get("license_expiration")),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(dry_run: bool, mc_only: bool) -> None:
    if not DSN:
        sys.exit("Set SUPABASE_DB_URL or DATABASE_URL env var")

    print("Fetching MO DHSS LTC Directory from Socrata...", flush=True)
    raw_rows = fetch_all_rows()
    print(f"Fetched {len(raw_rows)} rows", flush=True)

    transformed: list[dict[str, Any]] = []
    skipped_type = 0
    for r in raw_rows:
        t = transform(r)
        if t is None:
            skipped_type += 1
            continue
        if mc_only and not t["serves_memory_care"]:
            continue
        transformed.append(t)

    print(f"Rows after scope filter: {len(transformed)} (skipped {skipped_type} SNF/ICF/other)", flush=True)
    mc_count = sum(1 for t in transformed if t["serves_memory_care"])
    print(f"  of which serves_memory_care=true: {mc_count}", flush=True)

    if dry_run:
        print("\nDry-run sample (first 3):")
        for t in transformed[:3]:
            print(f"  {t['external_id']} | {t['name']} | {t['city']} | MC={t['serves_memory_care']} | {t['mo_level_of_care']}")
        print(f"\nDry-run: would upsert {len(transformed)} rows. No changes written.")
        return

    print("Upserting to facilities...", flush=True)
    inserted = 0
    errors = 0
    with psycopg.connect(DSN, row_factory=dict_row, autocommit=True) as conn:
        with conn.cursor() as cur:
            for t in transformed:
                try:
                    cur.execute(_UPSERT, t)
                    inserted += 1
                except Exception as exc:
                    print(f"  ERROR {t.get('external_id')}: {exc}", flush=True)
                    errors += 1

    print(f"\nDone. upserted={inserted} errors={errors}", flush=True)
    print("Next steps: geocode_facilities.py --state MO", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Missouri DHSS LTC directory ingest")
    parser.add_argument("--dry-run", action="store_true", help="Print rows without writing to DB")
    parser.add_argument("--mc-only", action="store_true", help="Only ingest memory-care facilities")
    args = parser.parse_args()
    run(dry_run=args.dry_run, mc_only=args.mc_only)


if __name__ == "__main__":
    main()
