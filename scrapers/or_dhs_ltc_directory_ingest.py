# RETIRED — do not run.
# Replaced by the OR Full Universe rebuild (migration 0033_or_universe.sql).
# New pipeline: or_providers_ingest.py, or_inspections_ingest.py, or_violations_ingest.py,
#               or_regulatory_actions_ingest.py, or_signal_mce.py, or_afh_detail.py, etc.
# Key reason: this script zero-pads Provider IDs, breaking alphanumeric IDs like '50M300'.
# See scripts/or_overnight_run.sh for the replacement orchestration.
#
# Original content preserved below for reference.
# ─────────────────────────────────────────────────────────────────────────────
import sys; print('ERROR: or_dhs_ltc_directory_ingest.py is retired. Run or_providers_ingest.py instead.', file=sys.stderr); sys.exit(1)

#!/usr/bin/env python3
"""
Ingest Oregon DHS LTC Licensing provider CSV (memory-care export) into facilities.

Upsert conflict target: (state_code, city_slug, slug)
Join key for inspections: or_provider_id and license_number (padded numeric ID).

Usage:
  python3 scrapers/or_dhs_ltc_directory_ingest.py --input .firecrawl/or-scrape/providers-2026-05-08.csv
  python3 scrapers/or_dhs_ltc_directory_ingest.py --input providers.csv --dry-run
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
STATE_CODE = "OR"
SOURCE_PAGE = "https://ltclicensing.oregon.gov/Providers"


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "facility"


def titleize(text: str) -> str:
    if not text:
        return text
    stop = {"and", "or", "of", "in", "the", "a", "at", "by", "for", "to"}
    words = text.lower().split()
    result = []
    for i, w in enumerate(words):
        result.append(w if (i > 0 and w in stop) else w.capitalize())
    return " ".join(result)


def pad_license_or(raw: Any) -> str:
    """Normalize Oregon Provider ID for facilities.license_number + bundle matching."""
    if raw is None or str(raw).strip() == "":
        return "0000000000"
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return "0000000000"
    return digits.zfill(10)


def facility_slug(name: str, license_num: str) -> str:
    base = slugify(name)
    suffix = license_num[-8:].lstrip("0") or license_num[-4:]
    return f"{base}-{suffix}"


def norm_header(h: Any) -> str:
    return re.sub(r"\s+", " ", str(h or "").strip().lower())


def parse_bool_medicaid(raw: Any) -> bool | None:
    if raw is None or str(raw).strip() == "":
        return None
    s = str(raw).strip().lower()
    if s in ("yes", "y", "true", "1"):
        return True
    if s in ("no", "n", "false", "0"):
        return False
    return None


def row_to_record(headers: list[str], row: dict[str, str]) -> dict[str, Any] | None:
    """Map CSV row using normalized header keys."""
    idx = {norm_header(h): h for h in headers}

    def get(*candidates: str) -> str:
        for c in candidates:
            k = norm_header(c)
            if k in idx:
                v = row.get(idx[k])
                return str(v).strip() if v is not None else ""
        return ""

    pid = get("id", "provider id", "provider_id")
    raw_name = get("name")
    if not pid or not raw_name:
        return None

    lic = pad_license_or(pid)
    name = titleize(raw_name) or f"Facility {lic}"
    raw_city = get("city")
    city_slug = slugify(raw_city) if raw_city else "unknown-city"
    city = titleize(raw_city) if raw_city else None

    type_raw = get("type")
    beds_raw = get("licensed beds", "beds", "licensed capacity")
    beds: int | None = None
    if beds_raw:
        try:
            beds = int(float(beds_raw))
        except (ValueError, TypeError):
            beds = None

    status = (get("status") or "").strip()
    if status.lower() != "open":
        return None
    lic_status = "LICENSED"

    slug = facility_slug(name, lic)

    street_raw = get("address", "street", "location address")
    zip_raw = get("zip", "postal code", "zip code")
    phone_raw = get("phone", "telephone")

    return {
        "state_code": STATE_CODE,
        "name": name,
        "cms_id": None,
        "license_number": lic,
        "license_type": type_raw or None,
        "street": titleize(street_raw) if street_raw else None,
        "city": city,
        "zip": zip_raw[:10] if zip_raw else None,
        "city_slug": city_slug,
        "slug": slug,
        "beds": beds,
        "facility_type": "alf",
        "certification_type": "state",
        "operator_name": None,
        "management_company": None,
        "ownership_type": None,
        "phone": phone_raw or None,
        "website": None,
        "cms_star_rating": None,
        "last_inspection_date": None,
        "latitude": None,
        "longitude": None,
        "source_url": SOURCE_PAGE,
        "care_category": "alf_memory_care",
        "serves_memory_care": True,
        "memory_care_designation": "Oregon DHS Memory Care Endorsement",
        "license_status": lic_status,
        "license_expiration": None,
        "publishable": False,
        "mc_signal_explicit_name": False,
        "mc_signal_chain_name": False,
        "mc_review_status": "auto_published",
        # OHA Memory Care Endorsement is OR's Tier-1 government signal; map it
        # to the unified disclosure column so recompute_publishable.py treats
        # OR endorsed facilities the same as a CA §1569.627 disclosure filing.
        "memory_care_disclosure_filed": True,
        "memory_care_disclosure_source": "OR DHS Memory Care Endorsement",
        "mc_signal_apfm_listed": False,
        "mc_signal_caring_listed": False,
        "tx_license_class": None,
        "tx_alzheimer_certified": False,
        "tx_facility_id": None,
        "tx_alzheimer_capacity": None,
        "tx_alzheimer_cert_no": None,
        "tx_alzheimer_cert_effective": None,
        "tx_alzheimer_cert_expiration": None,
        "tx_license_effective": None,
        "tx_license_expiration": None,
        "tx_license_initial": None,
        "tx_state_region": None,
        "tx_hhsc_suboffice": None,
        "tx_county": None,
        "or_memory_care_endorsed": True,
        "or_provider_id": str(pid).strip(),
        "or_facility_type": type_raw or None,
        "or_accepts_medicaid": parse_bool_medicaid(get("accepts medicaid", "medicaid")),
        "or_status": status or None,
    }


OR_UPSERT_SQL = """
INSERT INTO facilities (
    state_code, name, cms_id,
    license_number, license_type,
    street, city, zip,
    city_slug, slug,
    beds, facility_type, certification_type,
    operator_name, management_company, ownership_type,
    phone, website,
    cms_star_rating, last_inspection_date,
    latitude, longitude,
    source_url,
    care_category, serves_memory_care, memory_care_designation,
    license_status, license_expiration, publishable,
    mc_signal_explicit_name, mc_signal_chain_name, mc_review_status,
    memory_care_disclosure_filed, memory_care_disclosure_source,
    mc_signal_apfm_listed, mc_signal_caring_listed,
    tx_license_class, tx_alzheimer_certified,
    tx_facility_id, tx_alzheimer_capacity, tx_alzheimer_cert_no,
    tx_alzheimer_cert_effective, tx_alzheimer_cert_expiration,
    tx_license_effective, tx_license_expiration, tx_license_initial,
    tx_state_region, tx_hhsc_suboffice, tx_county,
    or_memory_care_endorsed, or_provider_id, or_facility_type,
    or_accepts_medicaid, or_status,
    updated_at
) VALUES (
    %(state_code)s, %(name)s, %(cms_id)s,
    %(license_number)s, %(license_type)s,
    %(street)s, %(city)s, %(zip)s,
    %(city_slug)s, %(slug)s,
    %(beds)s, %(facility_type)s, %(certification_type)s,
    %(operator_name)s, %(management_company)s, %(ownership_type)s,
    %(phone)s, %(website)s,
    %(cms_star_rating)s, %(last_inspection_date)s,
    %(latitude)s, %(longitude)s,
    %(source_url)s,
    %(care_category)s, %(serves_memory_care)s, %(memory_care_designation)s,
    %(license_status)s, %(license_expiration)s, %(publishable)s,
    %(mc_signal_explicit_name)s, %(mc_signal_chain_name)s, %(mc_review_status)s,
    %(memory_care_disclosure_filed)s, %(memory_care_disclosure_source)s,
    %(mc_signal_apfm_listed)s, %(mc_signal_caring_listed)s,
    %(tx_license_class)s, %(tx_alzheimer_certified)s,
    %(tx_facility_id)s, %(tx_alzheimer_capacity)s, %(tx_alzheimer_cert_no)s,
    %(tx_alzheimer_cert_effective)s, %(tx_alzheimer_cert_expiration)s,
    %(tx_license_effective)s, %(tx_license_expiration)s, %(tx_license_initial)s,
    %(tx_state_region)s, %(tx_hhsc_suboffice)s, %(tx_county)s,
    %(or_memory_care_endorsed)s, %(or_provider_id)s, %(or_facility_type)s,
    %(or_accepts_medicaid)s, %(or_status)s,
    now()
)
ON CONFLICT (state_code, city_slug, slug) DO UPDATE SET
    name                         = EXCLUDED.name,
    license_number               = EXCLUDED.license_number,
    license_type                 = EXCLUDED.license_type,
    street                       = EXCLUDED.street,
    city                         = EXCLUDED.city,
    zip                          = EXCLUDED.zip,
    beds                         = EXCLUDED.beds,
    facility_type                = EXCLUDED.facility_type,
    certification_type           = EXCLUDED.certification_type,
    source_url                   = EXCLUDED.source_url,
    care_category                = EXCLUDED.care_category,
    serves_memory_care           = EXCLUDED.serves_memory_care,
    memory_care_designation      = EXCLUDED.memory_care_designation,
    license_status               = EXCLUDED.license_status,
    license_expiration           = EXCLUDED.license_expiration,
    publishable                  = EXCLUDED.publishable,
    mc_review_status             = CASE
        WHEN facilities.mc_review_status IN ('reviewed_publish','reviewed_reject')
        THEN facilities.mc_review_status
        ELSE EXCLUDED.mc_review_status
    END,
    or_memory_care_endorsed      = EXCLUDED.or_memory_care_endorsed,
    or_provider_id               = EXCLUDED.or_provider_id,
    or_facility_type             = EXCLUDED.or_facility_type,
    or_accepts_medicaid          = EXCLUDED.or_accepts_medicaid,
    or_status                    = EXCLUDED.or_status,
    updated_at                   = now()
"""


def upsert_facilities(conn: psycopg.Connection, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    with conn.cursor() as cur:
        cur.executemany(OR_UPSERT_SQL, rows)


def read_csv(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        headers = list(reader.fieldnames or [])
        out: list[dict[str, Any]] = []
        for raw in reader:
            rec = row_to_record(headers, {k: v or "" for k, v in raw.items()})
            if rec:
                out.append(rec)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Oregon DHS LTC provider CSV → facilities")
    ap.add_argument("--input", type=Path, required=True, help="Path to Providers export CSV")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    load_env()

    if not args.input.is_file():
        print(f"Not found: {args.input}", file=sys.stderr)
        return 1

    rows = read_csv(args.input)
    print(f"Parsed {len(rows)} facility rows")

    if args.dry_run:
        print("(dry-run — no DB)")
        return 0

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL not set", file=sys.stderr)
        return 1

    with psycopg.connect(dsn) as conn:
        upsert_facilities(conn, rows)
        conn.commit()
    print(f"Upserted {len(rows)} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
