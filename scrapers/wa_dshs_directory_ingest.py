#!/usr/bin/env python3
"""
Ingest Washington DSHS Advanced Lookup CSV (dementia care contract export) → facilities.

Upsert conflict target: (state_code, city_slug, slug)

Usage:
  python3 scrapers/wa_dshs_directory_ingest.py --input .firecrawl/wa-scrape/adv-lookup.csv
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
STATE_CODE = "WA"
SOURCE_PAGE = "https://fortress.wa.gov/dshs/adsaapps/Lookup/BHAdvLookup.aspx"


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
    words = text.lower().split()
    stop = {"and", "or", "of", "in", "the", "a", "at", "by", "for", "to"}
    out = []
    for i, w in enumerate(words):
        out.append(w if i > 0 and w in stop else w.capitalize())
    return " ".join(out)


def pad_wa_license(raw: Any) -> str:
    if raw is None or str(raw).strip() == "":
        return "0000000000"
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return re.sub(r"\s+", "", str(raw).strip())[:32] or "0000000000"
    return digits.zfill(10)


def facility_slug(name: str, lic: str) -> str:
    base = slugify(name)
    suf = lic[-8:].lstrip("0") or lic[-4:]
    return f"{base}-{suf}"


def norm_header(h: Any) -> str:
    return re.sub(r"\s+", " ", str(h or "").strip().lower())


def detect_col(headers: list[str], *keywords: str) -> str | None:
    for h in headers:
        nk = re.sub(r"[^a-z0-9]", "", h.lower())
        for kw in keywords:
            if kw.replace(" ", "") in nk:
                return h
    return None


WA_UPSERT_SQL = """
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
    wa_dementia_care_contract, wa_contract_types, wa_county, wa_facility_type,
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
    %(wa_dementia_care_contract)s, %(wa_contract_types)s, %(wa_county)s, %(wa_facility_type)s,
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
    source_url                   = EXCLUDED.source_url,
    care_category                = EXCLUDED.care_category,
    serves_memory_care           = EXCLUDED.serves_memory_care,
    memory_care_designation      = EXCLUDED.memory_care_designation,
    license_status               = EXCLUDED.license_status,
    publishable                  = EXCLUDED.publishable,
    mc_review_status             = CASE
        WHEN facilities.mc_review_status IN ('reviewed_publish','reviewed_reject')
        THEN facilities.mc_review_status
        ELSE EXCLUDED.mc_review_status
    END,
    wa_dementia_care_contract    = EXCLUDED.wa_dementia_care_contract,
    wa_contract_types            = EXCLUDED.wa_contract_types,
    wa_county                    = EXCLUDED.wa_county,
    wa_facility_type             = EXCLUDED.wa_facility_type,
    updated_at                   = now()
"""


def parse_row(headers: list[str], row: dict[str, str]) -> dict[str, Any] | None:
    # Use explicit column names to avoid ambiguous prefix matches (e.g. FacilityType vs FacilityName)
    col_lic = detect_col(headers, "licensenumber")
    col_name = next((h for h in headers if re.sub(r"[^a-z0-9]", "", h.lower()) == "facilityname"), None)
    col_status = next((h for h in headers if re.sub(r"[^a-z0-9]", "", h.lower()) == "facilitystatus"), None)
    if not col_lic or not col_name:
        return None
    lic_raw = (row.get(col_lic) or "").strip()
    name_raw = (row.get(col_name) or "").strip()
    if not lic_raw or not name_raw:
        return None

    # Skip non-open facilities
    if col_status:
        status_val = (row.get(col_status) or "").strip().upper()
        if status_val and status_val not in ("OP", "OPEN", "OP    "):
            return None

    lic = pad_wa_license(lic_raw)
    name = titleize(name_raw) or f"Facility {lic}"

    col_city = next((h for h in headers if re.sub(r"[^a-z0-9]", "", h.lower()) == "locationcity"), None)
    col_county = detect_col(headers, "county")
    col_addr = next((h for h in headers if re.sub(r"[^a-z0-9]", "", h.lower()) == "locationaddress"), None)
    col_zip = next((h for h in headers if re.sub(r"[^a-z0-9]", "", h.lower()) == "locationzipcode"), None)
    col_phone = detect_col(headers, "telephone", "phone")
    col_beds = detect_col(headers, "bed", "capacity")
    col_ftype = next((h for h in headers if re.sub(r"[^a-z0-9]", "", h.lower()) == "facilitytype"), None)
    col_contract = detect_col(headers, "contract")

    raw_city = (row.get(col_city) or "").strip() if col_city else ""
    city_slug = slugify(raw_city) if raw_city else "unknown-city"
    city = titleize(raw_city) if raw_city else None

    county = (row.get(col_county) or "").strip() if col_county else None
    street = titleize((row.get(col_addr) or "").strip()) if col_addr else None
    zip_str = (row.get(col_zip) or "").strip()[:10] if col_zip else None

    beds: int | None = None
    if col_beds and row.get(col_beds):
        try:
            beds = int(float(str(row[col_beds])))
        except (ValueError, TypeError):
            beds = None

    contracts_raw = (row.get(col_contract) or "").strip() if col_contract else "Dementia Care"
    contracts = [c.strip() for c in contracts_raw.split(",") if c.strip()]
    if not contracts:
        contracts = ["Dementia Care"]

    wa_ftype = (row.get(col_ftype) or "").strip() if col_ftype else None

    slug = facility_slug(name, lic)

    return {
        "state_code": STATE_CODE,
        "name": name,
        "cms_id": None,
        "license_number": lic,
        "license_type": wa_ftype,
        "street": street,
        "city": city,
        "zip": zip_str,
        "city_slug": city_slug,
        "slug": slug,
        "beds": beds,
        "facility_type": "alf",
        "certification_type": "state",
        "operator_name": None,
        "management_company": None,
        "ownership_type": None,
        "phone": (row.get(col_phone) or "").strip() if col_phone else None,
        "website": None,
        "cms_star_rating": None,
        "last_inspection_date": None,
        "latitude": None,
        "longitude": None,
        "source_url": SOURCE_PAGE,
        "care_category": "alf_memory_care",
        "serves_memory_care": True,
        "memory_care_designation": "Washington DSHS Dementia Care Contract",
        "license_status": "LICENSED",
        "license_expiration": None,
        "publishable": False,
        "mc_signal_explicit_name": False,
        "mc_signal_chain_name": False,
        "mc_review_status": "auto_published",
        "memory_care_disclosure_filed": False,
        "memory_care_disclosure_source": None,
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
        "wa_dementia_care_contract": True,
        "wa_contract_types": contracts,
        "wa_county": county,
        "wa_facility_type": wa_ftype,
    }


def upsert_facilities(conn: psycopg.Connection, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    with conn.cursor() as cur:
        cur.executemany(WA_UPSERT_SQL, rows)


def read_csv(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        headers = list(reader.fieldnames or [])
        out: list[dict[str, Any]] = []
        for raw in reader:
            row = {k: v or "" for k, v in raw.items()}
            rec = parse_row(headers, row)
            if rec:
                out.append(rec)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="WA ADSA roster CSV → facilities")
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    load_env()

    rows = read_csv(args.input)
    print(f"Parsed {len(rows)} rows")

    if args.dry_run:
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
