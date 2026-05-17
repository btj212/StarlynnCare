#!/usr/bin/env python3
"""
Utah Facilities Ingest — UGRC ArcGIS Feature Service

Pulls all 891 licensed health facilities from the Utah UGRC ArcGIS service
and upserts them into the facilities table.

Memory care gate: SECURE_BEDS > 0 (serves_memory_care = true).
Primary key: (state_code='UT', external_id=ID_NUMBER).

Usage:
    python3 -u ut_arcgis_facilities_ingest.py
    python3 -u ut_arcgis_facilities_ingest.py --mc-only   # only load SECURE_BEDS > 0 rows
    python3 -u ut_arcgis_facilities_ingest.py --dry-run   # print rows, no DB writes
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ARCGIS_URL = (
    "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services"
    "/LicensedHealthCareFacilities/FeatureServer/0/query"
)

PUBLISHABLE_LICENSE_TYPES = {
    "Assisted Living Facility - Type I",
    "Assisted Living Facility - Type II",
    "Nursing Care Facility",
    "Small Health Care Facility",
}

REPO_ROOT = Path(__file__).resolve().parent.parent


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------


def fetch_all_facilities() -> list[dict[str, Any]]:
    """Single request — all 891 UT facilities fit within maxRecordCount=2000."""
    print("Fetching UGRC ArcGIS feature service …", flush=True)
    r = requests.post(
        ARCGIS_URL,
        data={
            "where": "1=1",
            "outFields": "*",
            "returnGeometry": "true",
            "resultRecordCount": 2000,
            "f": "json",
        },
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(f"ArcGIS error: {data['error']}")
    features = data.get("features", [])
    print(f"  Fetched {len(features)} features", flush=True)
    return features


# ---------------------------------------------------------------------------
# Transform
# ---------------------------------------------------------------------------


def epoch_ms_to_date(epoch_ms: int | None) -> datetime | None:
    """Convert ArcGIS epoch milliseconds to a Python date."""
    if epoch_ms is None:
        return None
    try:
        return datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc).date()
    except (OSError, OverflowError, ValueError):
        return None


def transform_feature(feature: dict[str, Any]) -> dict[str, Any]:
    """Map a single ArcGIS feature to our facilities columns."""
    attrs = feature.get("attributes", {})
    geom = feature.get("geometry") or {}

    external_id: str | None = attrs.get("ID_NUMBER")
    facility_name: str | None = attrs.get("FACILITY_NAME")
    license_type: str | None = attrs.get("LICENSE_TYPE")
    capacity: int | None = attrs.get("CAPACITY")
    secure_beds_raw = attrs.get("SECURE_BEDS")

    # SECURE_BEDS null vs 0: null = field doesn't apply; 0 = licensed but no unit
    secure_beds: int | None = None if secure_beds_raw is None else int(secure_beds_raw)

    # Derived ratio — only when both values are known and capacity > 0
    secure_bed_ratio: float | None = None
    if secure_beds is not None and capacity and capacity > 0:
        secure_bed_ratio = round(secure_beds / capacity, 4)

    # Memory care gate: SECURE_BEDS > 0 is the definitive UT signal
    serves_memory_care = bool(secure_beds and secure_beds > 0)

    # License status derived from expiration date
    expiration_date = epoch_ms_to_date(attrs.get("LICENSE_EXPIRATION_DATE"))
    today = datetime.now(tz=timezone.utc).date()
    license_status = "LICENSED" if (expiration_date and expiration_date >= today) else "CLOSED"

    # Address: concatenate UNIT if present
    address_raw: str = attrs.get("ADDRESS") or ""
    unit_raw: str = attrs.get("UNIT") or ""
    address_line1 = f"{address_raw}, {unit_raw}".strip(", ") if unit_raw else address_raw

    # City — UGRC is already title-case
    city_raw: str | None = attrs.get("CITY")
    city = city_raw.title() if city_raw else None

    # Geometry (WGS84 x=lon, y=lat)
    lat: float | None = geom.get("y")
    lon: float | None = geom.get("x")

    # Derive license_subtype from LICENSE_TYPE
    subtype: str | None = None
    if license_type and "Type II" in license_type:
        subtype = "Type II"
    elif license_type and "Type I" in license_type:
        subtype = "Type I"

    # Derive state_code slug for source_url
    id_number = external_id or "unknown"

    return {
        "state_code": "UT",
        "external_id": external_id,
        "state_internal_id": attrs.get("UT_NUMBER"),
        "cms_ccn": attrs.get("CMS_CERT_NUMBER") or None,
        "name": facility_name,
        "license_type": license_type,
        "license_subtype": subtype,
        "license_status": license_status,
        "license_expiration": expiration_date,
        "initial_license_date": epoch_ms_to_date(attrs.get("INITIAL_REGULATION_DATE")),
        "licensed_beds": capacity,
        "secure_beds": secure_beds,
        "secure_bed_ratio": secure_bed_ratio,
        "street": address_line1 or None,
        "city": city,
        "county": attrs.get("COUNTY"),
        "zip": str(attrs.get("ZIP")) if attrs.get("ZIP") else None,
        "phone": attrs.get("TELEPHONE"),
        "administrator_name": attrs.get("ADMINISTRATOR_NAME"),
        "latitude": lat,
        "longitude": lon,
        "serves_memory_care": serves_memory_care,
        "mc_review_status": "auto_published",
        "publishable": False,  # recompute_publishable.py will set this after inspections load
        "source_url": f"https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/LicensedHealthCareFacilities/FeatureServer/0/query?where=ID_NUMBER%3D%27{id_number}%27",
    }


# ---------------------------------------------------------------------------
# Upsert
# ---------------------------------------------------------------------------

UPSERT_SQL = """
    INSERT INTO facilities (
        state_code, external_id, state_internal_id, cms_ccn,
        name, license_type, license_subtype, license_status,
        license_expiration, initial_license_date,
        licensed_beds, secure_beds, secure_bed_ratio,
        street, city, county, zip, phone,
        administrator_name,
        latitude, longitude,
        serves_memory_care, mc_review_status, publishable,
        source_url
    ) VALUES (
        %(state_code)s, %(external_id)s, %(state_internal_id)s, %(cms_ccn)s,
        %(name)s, %(license_type)s, %(license_subtype)s, %(license_status)s,
        %(license_expiration)s, %(initial_license_date)s,
        %(licensed_beds)s, %(secure_beds)s, %(secure_bed_ratio)s,
        %(street)s, %(city)s, %(county)s, %(zip)s, %(phone)s,
        %(administrator_name)s,
        %(latitude)s, %(longitude)s,
        %(serves_memory_care)s, %(mc_review_status)s, %(publishable)s,
        %(source_url)s
    )
    ON CONFLICT (state_code, external_id) DO UPDATE SET
        state_internal_id  = EXCLUDED.state_internal_id,
        cms_ccn            = EXCLUDED.cms_ccn,
        name               = EXCLUDED.name,
        license_type       = EXCLUDED.license_type,
        license_subtype    = EXCLUDED.license_subtype,
        license_status     = EXCLUDED.license_status,
        license_expiration = EXCLUDED.license_expiration,
        initial_license_date = EXCLUDED.initial_license_date,
        licensed_beds      = EXCLUDED.licensed_beds,
        secure_beds        = EXCLUDED.secure_beds,
        secure_bed_ratio   = EXCLUDED.secure_bed_ratio,
        street             = EXCLUDED.street,
        city               = EXCLUDED.city,
        county             = EXCLUDED.county,
        zip                = EXCLUDED.zip,
        phone              = EXCLUDED.phone,
        administrator_name = EXCLUDED.administrator_name,
        latitude           = EXCLUDED.latitude,
        longitude          = EXCLUDED.longitude,
        serves_memory_care = EXCLUDED.serves_memory_care,
        mc_review_status   = EXCLUDED.mc_review_status,
        source_url         = EXCLUDED.source_url
"""

# The (state_code, external_id) unique constraint must exist. Verify before running.
CHECK_CONSTRAINT_SQL = """
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_name = 'facilities'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%state_code%external_id%'
"""


def check_unique_constraint(conn: psycopg.Connection) -> None:
    """Warn if the (state_code, external_id) unique constraint is missing."""
    with conn.cursor() as cur:
        cur.execute(CHECK_CONSTRAINT_SQL)
        row = cur.fetchone()
        if not row or row[0] == 0:
            print(
                "WARNING: No (state_code, external_id) unique constraint found on facilities. "
                "The ON CONFLICT clause requires it. Check migration 0033 and 0034.",
                flush=True,
            )


def upsert_batch(
    conn: psycopg.Connection,
    records: list[dict[str, Any]],
    dry_run: bool,
) -> tuple[int, int]:
    """Upsert records; return (success_count, error_count)."""
    success = 0
    errors = 0
    with conn.cursor() as cur:
        for rec in records:
            sp = f"sp_{rec.get('external_id', 'unknown').replace('-', '_').replace('.', '_')}"
            try:
                cur.execute(f"SAVEPOINT {sp}")
                cur.execute(UPSERT_SQL, rec)
                cur.execute(f"RELEASE SAVEPOINT {sp}")
                success += 1
            except Exception as exc:
                cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                errors += 1
                print(f"  ERROR {rec.get('external_id')}: {exc}", flush=True)
    return success, errors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest UT facilities from UGRC ArcGIS")
    parser.add_argument("--mc-only", action="store_true", help="Only load SECURE_BEDS > 0 rows")
    parser.add_argument("--dry-run", action="store_true", help="Print rows, no DB writes")
    args = parser.parse_args()

    load_env()

    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set. Add to .env.local.", file=sys.stderr)
        sys.exit(1)

    features = fetch_all_facilities()
    records = [transform_feature(f) for f in features]

    if args.mc_only:
        records = [r for r in records if r["serves_memory_care"]]
        print(f"  Filtered to {len(records)} SECURE_BEDS > 0 facilities", flush=True)

    # Summary counts
    total = len(records)
    licensed = sum(1 for r in records if r["license_status"] == "LICENSED")
    mc = sum(1 for r in records if r["serves_memory_care"])
    mc_licensed = sum(1 for r in records if r["serves_memory_care"] and r["license_status"] == "LICENSED")
    with_lat = sum(1 for r in records if r["latitude"])
    print(
        f"\nRecords to upsert: {total} total | {licensed} LICENSED | "
        f"{mc} serves_memory_care=true | {mc_licensed} MC+LICENSED | {with_lat} geocoded",
        flush=True,
    )

    if args.dry_run:
        print("\n--- DRY RUN: sample records ---")
        for r in records[:5]:
            print(
                f"  {r['external_id']:15s} {r['name'][:40]:40s} "
                f"secure={r['secure_beds']} ratio={r['secure_bed_ratio']} "
                f"mc={r['serves_memory_care']} {r['license_status']}",
                flush=True,
            )
        print("Dry run complete. No DB writes.")
        return

    dsn = os.environ["DATABASE_URL"]
    with psycopg.connect(dsn) as conn:
        check_unique_constraint(conn)
        print(f"\nUpserting {total} records …", flush=True)
        success, errors = upsert_batch(conn, records, dry_run=False)
        conn.commit()

    print(f"\nDone. success={success} errors={errors}", flush=True)
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
