#!/usr/bin/env python3
"""
Pilot 2 — State expansion via /extract.

Targets:
  ca  — Alameda County via CCLD (https://www.ccld.dss.ca.gov/carefacilitysearch/)
  or  — Oregon DHS LTC portal (https://ltclicensing.oregon.gov/Providers)

Usage:
  python3 scrapers/pilot_state_extract.py --smoke
  python3 scrapers/pilot_state_extract.py --target ca
  python3 scrapers/pilot_state_extract.py --target or
  python3 scrapers/pilot_state_extract.py --target both
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
sys.path.insert(0, str(Path(__file__).parent))
from _firecrawl import fc_extract, fc_scrape, current_spend_usd

DB_URL = os.environ["DATABASE_URL"]

FACILITY_SCHEMA = {
    "type": "object",
    "properties": {
        "facilities": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "license_number": {"type": "string"},
                    "address": {"type": "string"},
                    "city": {"type": "string"},
                    "zip": {"type": "string"},
                    "license_status": {"type": "string"},
                    "facility_type": {"type": "string"},
                    "beds": {"type": "integer"},
                    "memory_care_endorsement": {"type": "boolean"},
                },
            },
        }
    },
}

OR_FACILITY_SCHEMA = {
    "type": "object",
    "properties": {
        "facilities": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "license_number": {"type": "string"},
                    "address": {"type": "string"},
                    "city": {"type": "string"},
                    "zip": {"type": "string"},
                    "license_status": {"type": "string"},
                    "facility_type": {"type": "string"},
                    "beds": {"type": "integer"},
                    "memory_care_endorsement": {"type": "boolean"},
                    "last_inspection_date": {"type": "string"},
                },
            },
        }
    },
}

# Oregon: known facility pages for fallback scrape comparison
OR_KNOWN_FACILITIES = [
    "https://ltclicensing.oregon.gov/Providers/Details/1001",
    "https://ltclicensing.oregon.gov/Providers/Details/1002",
    "https://ltclicensing.oregon.gov/Providers/Details/1003",
    "https://ltclicensing.oregon.gov/Providers/Details/1004",
    "https://ltclicensing.oregon.gov/Providers/Details/1005",
]


def write_rows(
    conn: psycopg.Connection,
    run_id: str,
    state_code: str,
    source: str,
    facilities: list[dict],
    raw_response: dict | None = None,
) -> None:
    for f in facilities:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO pilot_extract_rows
                  (pilot_run_id, state_code, source, license_number, name,
                   address, city, beds, raw_json)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    run_id,
                    state_code,
                    source,
                    f.get("license_number"),
                    f.get("name"),
                    f.get("address"),
                    f.get("city"),
                    f.get("beds"),
                    json.dumps(f),
                ),
            )
    conn.commit()
    print(f"  Wrote {len(facilities)} rows to pilot_extract_rows (state={state_code})")


def compare_to_production(
    conn: psycopg.Connection,
    run_id: str,
    state_code: str,
) -> dict:
    """Compare extracted rows to production facilities table."""
    with conn.cursor() as cur:
        # Count production facilities for this state
        cur.execute(
            "SELECT COUNT(*) FROM facilities WHERE state_code=%s AND publishable=true",
            (state_code,),
        )
        prod_count = cur.fetchone()[0]

        # Count extracted rows
        cur.execute(
            "SELECT COUNT(*) FROM pilot_extract_rows WHERE pilot_run_id=%s AND state_code=%s",
            (run_id, state_code),
        )
        extracted_count = cur.fetchone()[0]

        # Match on license_number
        cur.execute(
            """
            SELECT COUNT(*) FROM pilot_extract_rows p
            JOIN facilities f ON f.state_code=p.state_code
              AND f.license_number=p.license_number
            WHERE p.pilot_run_id=%s AND p.state_code=%s
            """,
            (run_id, state_code),
        )
        matched_count = cur.fetchone()[0]

    coverage = matched_count / prod_count if prod_count > 0 else 0
    stats = {
        "state_code": state_code,
        "production_publishable": prod_count,
        "extracted": extracted_count,
        "matched_by_license": matched_count,
        "coverage_pct": round(coverage * 100, 1),
    }

    # Write stats back as a summary row
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE pilot_extract_rows
            SET raw_json = raw_json || %s::jsonb
            WHERE pilot_run_id=%s AND state_code=%s AND license_number IS NULL
            LIMIT 1
            """,
            (json.dumps({"comparison_stats": stats}), run_id, state_code),
        )
    conn.commit()

    return stats


def run_ca(
    conn: psycopg.Connection,
    run_id: str,
    smoke: bool,
) -> None:
    print("\n--- Target 1: California (CCLD Alameda County) ---")
    urls_to_try = [
        "https://www.ccld.dss.ca.gov/carefacilitysearch/",
        "https://www.ccld.dss.ca.gov/carefacilitysearch/?county=Alameda&fac_type=ARF",
        "https://www.ccld.dss.ca.gov/carefacilitysearch/?county=Alameda&fac_type=RCF",
    ]

    all_facilities: list[dict] = []
    for url in urls_to_try[:1]:  # Start with main URL
        print(f"  Extracting from: {url}")
        try:
            result = fc_extract(
                url,
                FACILITY_SCHEMA,
                prompt=(
                    "Extract all assisted living, memory care, and residential care "
                    "facilities listed on this page, especially those in Alameda County, CA."
                ),
            )
            extracted = result.get("extract", {}) or {}
            if isinstance(extracted, dict):
                facilities = extracted.get("facilities", []) or []
            else:
                facilities = []

            if facilities:
                all_facilities.extend(facilities)
                print(f"  Extracted {len(facilities)} facilities from {url}")
                break
            else:
                print(f"  No facilities extracted from {url}, trying fallback...")
        except Exception as e:
            print(f"  Extract error on {url}: {e}")

    if not all_facilities:
        # Fallback: scrape the search results page for structure
        print("  Fallback: scraping search page markdown...")
        try:
            page = fc_scrape("https://www.ccld.dss.ca.gov/carefacilitysearch/")
            md = page.get("markdown", "")
            print(f"  Got {len(md)} chars of markdown (no structured extraction)")
            # No facilities to save, record the attempt
            all_facilities = []
        except Exception as e:
            print(f"  Fallback scrape error: {e}")

    if smoke and all_facilities:
        all_facilities = all_facilities[:5]
        print(f"  Smoke mode: trimmed to {len(all_facilities)} facilities")

    if all_facilities:
        write_rows(conn, run_id, "CA", "ccld.dss.ca.gov", all_facilities)

    stats = compare_to_production(conn, run_id, "CA")
    print(f"\n  CA Coverage: {stats['matched_by_license']}/{stats['production_publishable']} "
          f"({stats['coverage_pct']}%)")
    print(f"  CA Extracted: {stats['extracted']} rows")
    return stats


def run_or(
    conn: psycopg.Connection,
    run_id: str,
    smoke: bool,
) -> None:
    print("\n--- Target 2: Oregon DHS LTC Portal ---")
    main_url = "https://ltclicensing.oregon.gov/Providers"

    all_facilities: list[dict] = []
    extract_succeeded = False

    print(f"  Trying /extract on: {main_url}")
    try:
        result = fc_extract(
            main_url,
            OR_FACILITY_SCHEMA,
            prompt=(
                "Extract all licensed long-term care facilities listed on this page, "
                "including assisted living, memory care, and adult foster homes in Oregon."
            ),
        )
        extracted = result.get("extract", {}) or {}
        if isinstance(extracted, dict):
            facilities = extracted.get("facilities", []) or []
        else:
            facilities = []

        if facilities:
            all_facilities.extend(facilities)
            extract_succeeded = True
            print(f"  /extract succeeded: {len(facilities)} facilities")
        else:
            print("  /extract returned no facilities (likely CSRF-protected form)")
    except Exception as e:
        print(f"  /extract failed: {e}")
        print("  NOTE: Oregon LTC portal likely requires form submission (CSRF). "
              "Falling back to scraping known facility detail pages.")

    if not extract_succeeded:
        # Fallback: scrape known facility detail pages
        print(f"  Fallback: scraping {len(OR_KNOWN_FACILITIES)} known facility pages")
        fallback_facilities = []
        pages_to_try = OR_KNOWN_FACILITIES[:3] if smoke else OR_KNOWN_FACILITIES
        for url in pages_to_try:
            try:
                result = fc_extract(url, OR_FACILITY_SCHEMA)
                extracted = result.get("extract", {}) or {}
                if isinstance(extracted, dict):
                    page_facilities = extracted.get("facilities", []) or []
                    fallback_facilities.extend(page_facilities)
                    print(f"    Got {len(page_facilities)} from {url}")
            except Exception as e:
                print(f"    Error on {url}: {e}")

        if fallback_facilities:
            all_facilities.extend(fallback_facilities)
            print(f"  Fallback extracted {len(fallback_facilities)} facilities from detail pages")
        else:
            print("  Fallback also returned 0 facilities. "
                  "Oregon portal is fully dynamic/CSRF-protected.")

    if smoke and all_facilities:
        all_facilities = all_facilities[:5]

    if all_facilities:
        write_rows(conn, run_id, "OR", "ltclicensing.oregon.gov", all_facilities)

    stats = compare_to_production(conn, run_id, "OR")
    print(f"\n  OR Coverage: {stats['matched_by_license']}/{stats['production_publishable']} "
          f"({stats['coverage_pct']}%)")
    print(f"  OR Extracted: {stats['extracted']} rows")
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Pilot 2: State extraction via /extract")
    parser.add_argument("--target", choices=["ca", "or", "both"], default="both")
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--run-id", default=None)
    args = parser.parse_args()

    run_id = args.run_id or f"p2_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"

    print(f"=== Pilot 2: State Extract ===")
    print(f"Run ID: {run_id}")
    print(f"Target: {args.target}")
    print(f"Mode: {'smoke' if args.smoke else 'full'}")
    print(f"Spend so far: ${current_spend_usd():.3f}")

    with psycopg.connect(DB_URL) as conn:
        results = {}
        if args.target in ("ca", "both"):
            try:
                results["ca"] = run_ca(conn, run_id, args.smoke)
            except RuntimeError as e:
                if "BUDGET" in str(e):
                    print(f"STOPPING: {e}")
                    return
                print(f"CA error: {e}")

        if args.target in ("or", "both"):
            try:
                results["or"] = run_or(conn, run_id, args.smoke)
            except RuntimeError as e:
                if "BUDGET" in str(e):
                    print(f"STOPPING: {e}")
                    return
                print(f"OR error: {e}")

    print(f"\n=== Pilot 2 Complete ===")
    print(f"Total spend: ${current_spend_usd():.3f}")

    for state, stats in results.items():
        print(f"  {state.upper()}: {stats['coverage_pct']}% coverage "
              f"({stats['matched_by_license']}/{stats['production_publishable']})")


if __name__ == "__main__":
    main()
