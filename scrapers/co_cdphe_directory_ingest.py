#!/usr/bin/env python3
"""Load the CDPHE assisted-living universe from ArcGIS.

The pull is every current SA1, SA2, and SA5 row. It does not prefilter memory
care. A second run updates license, beds, phone, and coordinates. It does not
change the stored name, slug, or city, and it does not undo a memory-care
review.

Usage:
    python3 -u scrapers/co_cdphe_directory_ingest.py --dry-run
    python3 -u scrapers/co_cdphe_directory_ingest.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv
from psycopg.types.json import Json

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scrapers.co_directory_parse import SOURCE_ARCGIS, classify_directory_feature
from scrapers.co_hfq_parse import json_safe

ARCGIS_URL = (
    "https://services3.arcgis.com/66aUo8zsujfVXRIT/arcgis/rest/services/"
    "CDPHE_Health_Facilities/FeatureServer/0/query"
)
ALR_WHERE = "Facility_Type_Code IN ('SA1','SA2','SA5')"
EXPECTED_UNIVERSE = 685

UPSERT_SQL = """
    INSERT INTO facilities (
        state_code, external_id, license_number, name, slug, city, city_slug,
        street, zip, county, phone, beds, latitude, longitude,
        facility_type, license_type, license_subtype, license_status, care_category,
        serves_memory_care, publishable, mc_review_status,
        mc_signal_explicit_name, mc_signal_chain_name, memory_care_disclosure_filed,
        source_url,
        co_facility_type_code, co_facility_type_detail, co_facility_type_abbreviation,
        co_operating_status, co_hfems_status, co_care_setting, co_directory_updated_on
    ) VALUES (
        %(state_code)s, %(external_id)s, %(license_number)s, %(name)s, %(slug)s,
        %(city)s, %(city_slug)s, %(street)s, %(zip)s, %(county)s, %(phone)s, %(beds)s,
        %(latitude)s, %(longitude)s, %(facility_type)s, %(license_type)s,
        %(license_subtype)s, %(license_status)s, %(care_category)s,
        %(serves_memory_care)s, %(publishable)s, %(mc_review_status)s,
        %(mc_signal_explicit_name)s, %(mc_signal_chain_name)s,
        %(memory_care_disclosure_filed)s, %(source_url)s,
        %(co_facility_type_code)s, %(co_facility_type_detail)s,
        %(co_facility_type_abbreviation)s, %(co_operating_status)s, %(co_hfems_status)s,
        %(co_care_setting)s, %(co_directory_updated_on)s
    )
    ON CONFLICT (state_code, external_id) WHERE state_code = 'CO' AND external_id IS NOT NULL
    DO UPDATE SET
        license_number = EXCLUDED.license_number,
        license_type = EXCLUDED.license_type,
        license_subtype = EXCLUDED.license_subtype,
        license_status = EXCLUDED.license_status,
        beds = COALESCE(EXCLUDED.beds, facilities.beds),
        street = COALESCE(EXCLUDED.street, facilities.street),
        zip = COALESCE(EXCLUDED.zip, facilities.zip),
        county = COALESCE(EXCLUDED.county, facilities.county),
        phone = COALESCE(EXCLUDED.phone, facilities.phone),
        latitude = COALESCE(EXCLUDED.latitude, facilities.latitude),
        longitude = COALESCE(EXCLUDED.longitude, facilities.longitude),
        facility_type = EXCLUDED.facility_type,
        source_url = EXCLUDED.source_url,
        co_facility_type_code = EXCLUDED.co_facility_type_code,
        co_facility_type_detail = EXCLUDED.co_facility_type_detail,
        co_facility_type_abbreviation = EXCLUDED.co_facility_type_abbreviation,
        co_operating_status = EXCLUDED.co_operating_status,
        co_hfems_status = EXCLUDED.co_hfems_status,
        co_care_setting = EXCLUDED.co_care_setting,
        co_directory_updated_on = EXCLUDED.co_directory_updated_on,
        updated_at = now()
"""

SOURCE_SQL = """
    INSERT INTO co_source_rows (
        source, source_key, disposition, reason, facility_external_id, raw
    ) VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT (source, source_key) DO UPDATE SET
        disposition = EXCLUDED.disposition,
        reason = EXCLUDED.reason,
        facility_external_id = EXCLUDED.facility_external_id,
        raw = EXCLUDED.raw,
        ingested_at = now()
"""


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            return


def fetch_alr_features() -> list[dict[str, Any]]:
    """Page through the official assisted-living layer. No memory-care filter."""
    features: list[dict[str, Any]] = []
    offset = 0
    page_size = 1000
    while True:
        response = requests.post(
            ARCGIS_URL,
            data={
                "where": ALR_WHERE,
                "outFields": "*",
                "returnGeometry": "false",
                "resultRecordCount": page_size,
                "resultOffset": offset,
                "f": "json",
            },
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
        if "error" in payload:
            raise RuntimeError(f"ArcGIS error: {payload['error']}")
        page = payload.get("features") or []
        features.extend(page)
        print(f"  offset={offset}: fetched {len(page)} (total {len(features)})", flush=True)
        if len(page) < page_size:
            break
        offset += page_size
    return features


def classify_features(features: list[dict[str, Any]]) -> list[Any]:
    decisions = []
    seen: set[str] = set()
    for feature in features:
        attrs = feature.get("attributes") or {}
        decision = classify_directory_feature(attrs)
        if decision.disposition == "normalized" and decision.external_id in seen:
            decision.disposition = "quarantined"
            decision.reason = "duplicate_facility_id"
            decision.facility = None
            decision.source_key = f"duplicate-{decision.external_id}-{attrs.get('OBJECTID')}"
        if decision.disposition == "normalized":
            seen.add(decision.external_id)
        decision.raw = json_safe(attrs)
        decisions.append(decision)
    return decisions


def write_decisions(decisions: list[Any]) -> tuple[int, int]:
    load_env()
    dsn = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    written = 0
    errors = 0
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            for index, decision in enumerate(decisions):
                cur.execute("SAVEPOINT sp")
                try:
                    if decision.facility is not None:
                        cur.execute(UPSERT_SQL, decision.facility)
                    cur.execute(
                        SOURCE_SQL,
                        (
                            SOURCE_ARCGIS,
                            decision.source_key,
                            decision.disposition,
                            decision.reason,
                            decision.external_id or None,
                            Json(decision.raw),
                        ),
                    )
                    cur.execute("RELEASE SAVEPOINT sp")
                    written += 1
                except Exception as exc:
                    cur.execute("ROLLBACK TO SAVEPOINT sp")
                    errors += 1
                    print(f"  ERROR {decision.source_key}: {exc}", flush=True)
                if index and index % 200 == 0:
                    print(f"  wrote {index} directory rows", flush=True)
            if errors:
                conn.rollback()
            else:
                cur.execute(
                    """
                    UPDATE states
                       SET last_successful_scrape = now(),
                           scraper_name = 'co_cdphe_directory_ingest'
                     WHERE code = 'CO'
                    """
                )
                conn.commit()
    return written, errors


def print_sample(decisions: list[Any]) -> None:
    normalized = [row for row in decisions if row.disposition == "normalized"]
    print("\nSample facilities:", flush=True)
    for decision in normalized[:5]:
        facility = decision.facility or {}
        print(
            f"  {facility.get('external_id')}  {facility.get('name')}  "
            f"{facility.get('city')}  status={facility.get('license_status')}  "
            f"beds={facility.get('beds')}  explicit={facility.get('mc_signal_explicit_name')}",
            flush=True,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest the CDPHE assisted-living directory")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and classify, but do not write")
    args = parser.parse_args()

    print("Fetching CDPHE assisted-living features…", flush=True)
    features = fetch_alr_features()
    if not features:
        raise SystemExit("ArcGIS returned no assisted-living rows")
    if len(features) != EXPECTED_UNIVERSE:
        print(
            f"WARNING: expected {EXPECTED_UNIVERSE} assisted-living rows, fetched {len(features)}. "
            "The full pull is still the universe.",
            flush=True,
        )
    decisions = classify_features(features)
    normalized = sum(1 for row in decisions if row.disposition == "normalized")
    quarantined = sum(1 for row in decisions if row.disposition == "quarantined")
    print(f"Classified {len(decisions)} rows: {normalized} normalized, {quarantined} quarantined", flush=True)
    print_sample(decisions)
    if args.dry_run:
        print("Dry run complete. No database writes.", flush=True)
        return
    written, errors = write_decisions(decisions)
    print(f"Done. written={written} errors={errors}", flush=True)
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
