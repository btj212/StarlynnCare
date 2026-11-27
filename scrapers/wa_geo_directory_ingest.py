#!/usr/bin/env python3
"""
WA Geo Open Data — Universe Directory Ingest (Wave 2a).

Replaces wa_dshs_directory_scrape.py as the canonical universe source for
AFH / ALF / ESF facility inventory.

Source: WA Geo Open Data (ArcGIS REST)
  https://geo.wa.gov/datasets/WADSHS::long-term-care-residential-care/about
  Feature Service URL: https://services.arcgis.com/jsIt88o7Q1eBVvmn/arcgis/rest/services/
                       Long_Term_Care_Residential_Care/FeatureServer/0/query

Key join: license_number is the primary key across all WA facility types.
Active facilities: GDLArchiveDate IS NULL.

Facility types returned:
  AFH — Adult Family Home
  ALF — Assisted Living Facility (aka BH / Boarding Home)
  ESF — Enhanced Services Facility

Usage:
  python3 scrapers/wa_geo_directory_ingest.py --dry-run
  python3 scrapers/wa_geo_directory_ingest.py
  python3 scrapers/wa_geo_directory_ingest.py --limit 50
  python3 scrapers/wa_geo_directory_ingest.py --type AFH
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timezone
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
from _wa_directory import campus_key, dementia_specialty_from_attrs

# ArcGIS REST endpoint for WA DSHS Long-Term Care Residential Care
# Source: https://geo.wa.gov/datasets/WADSHS::long-term-care-residential-care/api
GEO_FEATURE_URL = (
    "https://services2.arcgis.com/WW3T8U6q5EkZ9U3n/arcgis/rest/services/"
    "Long_Term_Care_Residential_Care_view/FeatureServer/1/query"
)

PAGE_SIZE = 1000

# FacilityType codes returned by the ArcGIS layer
_FACILITY_TYPE_MAP: dict[str, str] = {
    "AF": "AFH",   # Adult Family Home
    "BH": "ALF",   # Assisted Living Facility (historic name: Boarding Home)
    "EF": "ESF",   # Enhanced Services Facility
    "SL": "ARC",   # Certified Residential Service and Supports Provider
}


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
        return "0000000000"
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return str(raw).strip()[:32]
    return digits.zfill(10)


SUCCESSOR_NOTE_PREFIX = "[WA license successor"


def successor_review_path() -> Path:
    out_dir = REPO_ROOT / "scrapers" / "out"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / "wa_license_successor_review.jsonl"


def find_predecessor_campus(
    cur: Any,
    new_license: str,
    street: str | None,
    phone: str | None,
    beds: int | None,
) -> dict[str, Any] | None:
    """Existing WA row at the same campus with a different license number."""
    key = campus_key(street, phone, beds)
    if key is None:
        return None
    street_n, phone_n, beds_n = key
    cur.execute(
        """
        SELECT id, license_number, name, street, phone, beds, slug, city_slug
        FROM facilities
        WHERE state_code = 'WA'
          AND license_number IS DISTINCT FROM %s
          AND beds IS NOT NULL
          AND beds = %s
          AND btrim(regexp_replace(upper(coalesce(street, '')), '[^A-Z0-9]+', ' ', 'g'))
              = %s
          AND CASE
                WHEN length(regexp_replace(coalesce(phone, ''), '\\D', '', 'g')) = 11
                     AND regexp_replace(coalesce(phone, ''), '\\D', '', 'g') LIKE '1%%'
                THEN substr(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 2)
                ELSE regexp_replace(coalesce(phone, ''), '\\D', '', 'g')
              END = %s
        ORDER BY publishable DESC, updated_at DESC NULLS LAST
        LIMIT 1
        """,
        (new_license, beds_n, street_n, phone_n),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "license_number": row[1],
        "name": row[2],
        "street": row[3],
        "phone": row[4],
        "beds": row[5],
        "slug": row[6],
        "city_slug": row[7],
    }


def flag_successor_license(
    cur: Any,
    *,
    predecessor: dict[str, Any],
    new_license: str,
    new_name: str,
    street: str | None,
    phone: str | None,
    beds: int | None,
) -> None:
    """Record a successor license for review. Do not insert or merge rows."""
    detected = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    payload = {
        "detected_on": detected,
        "old_facility_id": str(predecessor["id"]),
        "old_license": predecessor["license_number"],
        "old_name": predecessor["name"],
        "old_slug": predecessor["slug"],
        "old_city_slug": predecessor["city_slug"],
        "new_license": new_license,
        "new_name": new_name,
        "street": street,
        "phone": phone,
        "beds": beds,
    }
    line = json.dumps(payload, default=str)
    with successor_review_path().open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")
    print(
        f"  SUCCESSOR: license {new_license} ({new_name}) matches "
        f"{predecessor['license_number']} at {street} — skipped insert"
    )

    note = (
        f"{SUCCESSOR_NOTE_PREFIX} {detected}] DSHS listed new license {new_license} "
        f"at the same street/phone/beds as this row ({predecessor['license_number']}). "
        "Scan skipped the insert. Do not merge automatically."
    )
    cur.execute(
        """
        UPDATE facilities
        SET mc_review_notes = CASE
              WHEN mc_review_notes IS NULL OR btrim(mc_review_notes) = '' THEN %s
              WHEN mc_review_notes LIKE %s THEN mc_review_notes
              ELSE mc_review_notes || E'\\n' || %s
            END
        WHERE id = %s
        """,
        (note, f"%{SUCCESSOR_NOTE_PREFIX}%{new_license}%", note, predecessor["id"]),
    )
    cur.execute("SAVEPOINT wa_successor_flag")
    try:
        cur.execute(
            """
            INSERT INTO wa_license_successor_flags (
                old_facility_id, old_license_number, new_license_number,
                new_name, street, phone, beds
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (old_license_number, new_license_number) DO NOTHING
            """,
            (
                predecessor["id"],
                predecessor["license_number"],
                new_license,
                new_name,
                street,
                phone,
                beds,
            ),
        )
        cur.execute("RELEASE SAVEPOINT wa_successor_flag")
    except Exception as exc:
        cur.execute("ROLLBACK TO SAVEPOINT wa_successor_flag")
        # Table is migration 0086. Weekly scan still flags via JSONL + notes.
        if "wa_license_successor_flags" not in str(exc):
            raise


def _arcgis_date(epoch_ms: int | None) -> date | None:
    """Convert ArcGIS epoch-milliseconds timestamp to Python date."""
    if epoch_ms is None or epoch_ms == 0:
        return None
    try:
        return datetime.utcfromtimestamp(epoch_ms / 1000).date()
    except (OSError, ValueError):
        return None


def fetch_geo_features(
    session: requests.Session,
    *,
    facility_type_filter: str | None = None,
    active_only: bool = True,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Fetch all feature records from the ArcGIS REST endpoint."""
    all_features: list[dict[str, Any]] = []
    offset = 0

    where_parts = []
    if active_only:
        where_parts.append("GDLArchiveDate IS NULL")
    if facility_type_filter:
        # Resolve our short code (AFH→AF, ALF→BH, ESF→EF) or pass raw ArcGIS code
        reverse_map = {v: k for k, v in _FACILITY_TYPE_MAP.items()}
        arc_code = reverse_map.get(facility_type_filter.upper(), facility_type_filter)
        where_parts.append(f"FacilityType = '{arc_code}'")

    where_clause = " AND ".join(where_parts) if where_parts else "1=1"

    while True:
        params = {
            "f": "json",
            "where": where_clause,
            "outFields": "*",
            "returnGeometry": "true",
            "geometryType": "esriGeometryPoint",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": PAGE_SIZE,
        }
        print(f"  Fetching offset={offset}…")
        resp = session.get(GEO_FEATURE_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if "error" in data:
            raise RuntimeError(f"ArcGIS error: {data['error']}")

        features = data.get("features", [])
        all_features.extend(features)
        print(f"  Got {len(features)} features (total {len(all_features)})")

        if len(features) < PAGE_SIZE:
            break
        if limit and len(all_features) >= limit:
            break

        offset += PAGE_SIZE
        polite_sleep(0.5, 0.1)

    return all_features[:limit] if limit else all_features


def _slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-") or "facility"


def _slug_from(name: str, city: str, license_num: str) -> tuple[str, str]:
    """Returns (city_slug, facility_slug)."""
    city_slug = _slugify(city) if city else "unknown-city"
    base = _slugify(f"{name}-{city}")
    return city_slug, f"{base}-{license_num}"


def upsert_facility_from_geo(
    conn: psycopg.Connection,
    attrs: dict[str, Any],
    geometry: dict[str, Any] | None,
    *,
    dry_run: bool = False,
) -> str:
    """Upsert one ArcGIS feature into facilities. Returns 'inserted'|'updated'|'skipped'."""
    # ArcGIS field names (confirmed from live endpoint 2026-05)
    raw_license = str(attrs.get("LicenseNumber") or attrs.get("LicNum") or "")
    license_num = pad_wa_license(raw_license)
    if license_num == "0000000000":
        return "skipped"

    name = str(attrs.get("FacilityName") or attrs.get("Name") or "").strip()
    city = str(attrs.get("LocationCity") or attrs.get("City") or "").strip()
    address = str(attrs.get("LocationAddress") or attrs.get("Address") or "").strip()
    zip_code = str(attrs.get("LocationZipCode") or attrs.get("Zip") or "").strip()
    county = str(attrs.get("LocationCounty") or attrs.get("County") or "").strip()
    phone = str(attrs.get("TelephoneNmbr") or attrs.get("Phone") or "").strip() or None
    facility_type_raw = str(attrs.get("FacilityType") or "")
    wa_facility_type = _FACILITY_TYPE_MAP.get(facility_type_raw, "ALF")
    archive_date_ms = attrs.get("GDLArchiveDate")
    geo_archived_at = _arcgis_date(archive_date_ms)
    beds_raw = attrs.get("LicensedBedCount") or attrs.get("Capacity") or attrs.get("Beds")
    beds = int(beds_raw) if beds_raw and str(beds_raw).isdigit() else None
    dementia_specialty = dementia_specialty_from_attrs(attrs)

    # Prefer attributes-level lat/lng (already projected); fallback to geometry
    lat_raw = attrs.get("Latitude")
    lng_raw = attrs.get("Longitude")
    lat = float(lat_raw) if lat_raw else None
    lng = float(lng_raw) if lng_raw else None
    if not lat and geometry and geometry.get("x") and geometry.get("y"):
        lng = float(geometry["x"])
        lat = float(geometry["y"])

    if not name or not city:
        return "skipped"

    if dry_run:
        print(f"  DRY-RUN: {name} ({license_num}) [{wa_facility_type}]")
        return "skipped"

    city_slug, slug = _slug_from(name, city, license_num)

    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM facilities WHERE state_code='WA' AND license_number=%s",
            (license_num,),
        )
        existing = cur.fetchone()

        if existing:
            cur.execute(
                """
                UPDATE facilities SET
                    name = %s,
                    street = %s,
                    zip = %s,
                    wa_county = %s,
                    phone = COALESCE(%s, phone),
                    latitude = COALESCE(%s, latitude),
                    longitude = COALESCE(%s, longitude),
                    beds = COALESCE(%s, beds),
                    wa_facility_type = %s,
                    geo_archived_at = %s,
                    -- False clears a stale stamp. None keeps the stored value.
                    wa_dementia_specialty = CASE
                        WHEN %s IS NULL THEN wa_dementia_specialty
                        ELSE %s
                    END,
                    updated_at = now()
                WHERE state_code = 'WA' AND license_number = %s
                """,
                (
                    name, address, zip_code, county,
                    phone, lat, lng,
                    beds, wa_facility_type, geo_archived_at,
                    dementia_specialty, dementia_specialty,
                    license_num,
                ),
            )
            return "updated"

        predecessor = find_predecessor_campus(
            cur, license_num, address, phone, beds,
        )
        if predecessor:
            flag_successor_license(
                cur,
                predecessor=predecessor,
                new_license=license_num,
                new_name=name,
                street=address,
                phone=phone,
                beds=beds,
            )
            return "flagged"

        else:
            cur.execute(
                """
                INSERT INTO facilities (
                    state_code, name, street, city, city_slug, zip, wa_county,
                    phone, latitude, longitude, beds,
                    license_number, license_status,
                    wa_facility_type, geo_archived_at,
                    facility_type,
                    serves_memory_care, publishable,
                    mc_review_status,
                    wa_dementia_specialty,
                    slug
                ) VALUES (
                    'WA', %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, 'LICENSED',
                    %s, %s,
                    %s,
                    false, false,
                    'needs_review',
                    %s,
                    %s
                )
                ON CONFLICT (state_code, city_slug, slug) DO UPDATE
                SET wa_facility_type = EXCLUDED.wa_facility_type,
                    geo_archived_at = EXCLUDED.geo_archived_at,
                    updated_at = now()
                """,
                (
                    name, address, city, city_slug, zip_code, county,
                    phone, lat, lng,
                    beds,
                    license_num,
                    wa_facility_type, geo_archived_at,
                    wa_facility_type,  # facility_type = wa_facility_type
                    dementia_specialty,
                    slug,
                ),
            )
            return "inserted"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="WA Geo directory ingest — Wave 2a")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--type", dest="facility_type", help="Filter by type: AFH, ALF, ESF")
    parser.add_argument("--include-archived", action="store_true", help="Include archived facilities")
    args = parser.parse_args(argv)

    load_env()
    print("=== WA Geo Open Data Directory Ingest ===")

    session = make_session()
    conn = get_conn()

    print("Step 1: Fetching ArcGIS features…")
    features = fetch_geo_features(
        session,
        facility_type_filter=args.facility_type,
        active_only=not args.include_archived,
        limit=args.limit,
    )
    print(f"  {len(features)} features fetched")

    inserted = updated = skipped = flagged = 0
    for feat in features:
        attrs = feat.get("attributes", {})
        geometry = feat.get("geometry")
        result = upsert_facility_from_geo(conn, attrs, geometry, dry_run=args.dry_run)
        if result == "inserted":
            inserted += 1
        elif result == "updated":
            updated += 1
        elif result == "flagged":
            flagged += 1
        else:
            skipped += 1

    if not args.dry_run:
        conn.commit()
    print(
        f"\nInserted: {inserted}  Updated: {updated}  "
        f"Successor-flagged: {flagged}  Skipped: {skipped}"
    )
    if flagged:
        print(f"  Review list: {successor_review_path()}")
    conn.close()


if __name__ == "__main__":
    main()
