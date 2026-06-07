#!/usr/bin/env python3
"""
Ingest Minnesota DHS Assisted Living Report Card (ALRC) Excel + address JSON
→ facilities table.

Only ingests ALDC (Assisted Living with Dementia Care) facilities, identified
by "dementia" appearing in the License column of the ALRC Excel download.

Unique key: (state_code, city_slug, slug) via ON CONFLICT UPSERT.
mn_hfid is set to "ALRC:{alrc_id}" until the MDH bulk download (HFID) becomes
available for cross-referencing.

Usage:
  python3 scrapers/mn_alrc_ingest.py \\
      --xlsx .firecrawl/mn-scrape/mn-alrc-2026-05-08.xlsx \\
      --addresses .firecrawl/mn-scrape/mn-alrc-addresses-2026-05-08.json

  # Or run mn_alrc_scrape.py first, which prints the --xlsx path.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "MN"
SOURCE_PAGE = "https://alreportcard.dhs.mn.gov/Search"


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


def facility_slug(name: str, alrc_id: int) -> str:
    return f"{slugify(name)}-mn{alrc_id}"


def load_excel_all_alfs(xlsx_path: Path) -> list[dict[str, Any]]:
    """
    Load ALL ALF rows from ALRC Excel — both ALDC (Assisted Living with Dementia Care)
    and standard AL (Assisted Living without dementia care designation).

    ALDC rows are identified by "dementia" in the license column.
    All other non-empty rows are standard ALF entries.
    """
    try:
        import openpyxl  # noqa: PLC0415
    except ImportError:
        print("ERROR: openpyxl required — pip install openpyxl", file=sys.stderr)
        sys.exit(1)

    wb = openpyxl.load_workbook(xlsx_path)
    ws = wb.active
    records: list[dict[str, Any]] = []

    for row in ws.iter_rows(min_row=4, values_only=True):
        name = str(row[0] or "").strip()
        city = str(row[1] or "").strip()
        county = str(row[2] or "").strip()
        capacity = row[3]
        license_text = str(row[4] or "").strip()

        if not name:
            continue

        # Map ALRC license status to canonical DB value
        lic_lower = license_text.lower()
        if "approved" in lic_lower:
            db_license_status = "LICENSED"
        elif "new" in lic_lower:
            db_license_status = "PENDING"
        else:
            db_license_status = None

        is_aldc = "dementia" in lic_lower

        records.append({
            "name": titleize(name),
            "city": city,
            "county": county,
            "capacity": int(capacity) if capacity else None,
            "license_status": license_text,
            "db_license_status": db_license_status,
            "is_aldc": is_aldc,
        })

    aldc = sum(1 for r in records if r["is_aldc"])
    print(f"  ALDC (with dementia care): {aldc}, standard AL: {len(records)-aldc}, total: {len(records)}")
    return records


def load_address_map(json_path: Path) -> dict[str, dict[str, str]]:
    """Return {(name_lower, city_lower): address_record} lookup."""
    raw = json.loads(json_path.read_text())
    result: dict[str, dict[str, str]] = {}
    for r in raw:
        key = (r["name"].strip().lower(), r["city"].strip().lower())
        result[key] = r
    return result


def load_facilities_json(json_path: Path) -> dict[int, dict[str, Any]]:
    """Return {alrc_id: record} from the parsed facility/ALRC-id JSON."""
    raw = json.loads(json_path.read_text())
    return {r["alrc_id"]: r for r in raw}


def upsert_facility(
    conn: psycopg.Connection,
    record: dict[str, Any],
    *,
    dry_run: bool = False,
) -> str:
    if dry_run:
        print(f"  [dry] Would upsert: {record['name']} — {record['city']}, MN")
        return "dry"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO facilities (
                state_code, license_number, license_type, license_status,
                name, street, city, zip,
                city_slug, slug,
                beds, facility_type,
                mn_dementia_care_licensed, mn_hfid, mn_all_capacity, mn_lic_type,
                serves_memory_care, publishable,
                care_category, mc_review_status
            ) VALUES (
                %(state_code)s, %(license_number)s, %(license_type)s, %(db_license_status)s,
                %(name)s, %(street)s, %(city)s, %(zip)s,
                %(city_slug)s, %(slug)s,
                %(beds)s, %(facility_type)s,
                %(mn_dementia_care_licensed)s, %(mn_hfid)s, %(mn_all_capacity)s, %(mn_lic_type)s,
                false, false,
                %(care_category)s, %(mc_review_status)s
            )
            ON CONFLICT (state_code, city_slug, slug) DO UPDATE SET
                name                     = EXCLUDED.name,
                license_number           = EXCLUDED.license_number,
                license_status           = COALESCE(EXCLUDED.license_status, facilities.license_status),
                street                   = COALESCE(EXCLUDED.street, facilities.street),
                zip                      = COALESCE(EXCLUDED.zip, facilities.zip),
                beds                     = COALESCE(EXCLUDED.beds, facilities.beds),
                mn_dementia_care_licensed = EXCLUDED.mn_dementia_care_licensed,
                mn_hfid                  = COALESCE(EXCLUDED.mn_hfid, facilities.mn_hfid),
                mn_all_capacity          = COALESCE(EXCLUDED.mn_all_capacity, facilities.mn_all_capacity),
                mn_lic_type              = COALESCE(EXCLUDED.mn_lic_type, facilities.mn_lic_type),
                care_category            = EXCLUDED.care_category,
                mc_review_status         = CASE
                    WHEN facilities.mc_review_status IN ('reviewed_publish','reviewed_reject')
                    THEN facilities.mc_review_status
                    ELSE EXCLUDED.mc_review_status
                END
            RETURNING id::text
            """,
            record,
        )
        row = cur.fetchone()
        return str(row[0]) if row else "conflict"


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Ingest MN ALRC ALDC facilities into DB"
    )
    ap.add_argument("--xlsx", type=Path,
                    default=REPO_ROOT / ".firecrawl/mn-scrape/mn-alrc-2026-05-08.xlsx")
    ap.add_argument("--addresses", type=Path,
                    default=REPO_ROOT / ".firecrawl/mn-scrape/mn-alrc-addresses-2026-05-08.json")
    ap.add_argument("--facilities-json", type=Path,
                    default=REPO_ROOT / ".firecrawl/mn-scrape/mn-alrc-facilities-2026-05-08.json",
                    help="JSON with alrc_id → name/city/is_aldc (from scraper)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    load_env()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
        return 1

    # Load all ALF rows (both ALDC and standard AL)
    if not args.xlsx.is_file():
        print(f"ERROR: xlsx not found: {args.xlsx}", file=sys.stderr)
        return 1
    excel_rows = load_excel_all_alfs(args.xlsx)
    print(f"Loaded {len(excel_rows)} total ALF rows from Excel")

    # Load address map (name+city → street/zip/alrc_id)
    addr_map: dict[tuple[str, str], dict[str, Any]] = {}
    alrc_id_map: dict[tuple[str, str], int] = {}
    if args.addresses.is_file():
        raw_addrs = json.loads(args.addresses.read_text())
        for r in raw_addrs:
            key = (r["name"].strip().lower(), r["city"].strip().lower())
            addr_map[key] = r
        print(f"Loaded {len(addr_map)} address records")
    else:
        print(f"WARNING: addresses JSON not found: {args.addresses}")

    # Load ALRC ID map from facilities JSON (all ALFs, not just ALDC)
    fac_alrc_map: dict[tuple[str, str], int] = {}
    if args.facilities_json.is_file():
        raw_facs = json.loads(args.facilities_json.read_text())
        for r in raw_facs:
            key = (r["name"].strip().lower(), r["city"].strip().lower())
            fac_alrc_map[key] = r["alrc_id"]
        print(f"Loaded {len(fac_alrc_map)} facility IDs from ALRC JSON")
    else:
        print(f"WARNING: facilities JSON not found: {args.facilities_json}")

    stats = {"upserted": 0, "skipped": 0, "no_addr": 0}

    conn_ctx = psycopg.connect(db_url) if not args.dry_run else None

    try:
        for row in excel_rows:
            name_key = row["name"].strip().lower()
            # Excel titleizes; try both original and titleized
            city_key = row["city"].strip().lower()
            key = (name_key, city_key)

            addr = addr_map.get(key)
            if addr is None:
                # Try matching by city only (some name truncation in ALRC)
                stats["no_addr"] += 1
                street = None
                zip_code = None
                alrc_id = None
            else:
                street = addr.get("street")
                zip_code = addr.get("zip")
                alrc_id = addr.get("alrc_id")

            # Also try fac_alrc_map for ALRC ID
            if alrc_id is None:
                alrc_id = fac_alrc_map.get(key)

            mn_hfid = f"ALRC:{alrc_id}" if alrc_id else None
            license_number = mn_hfid or f"MN-ALDC-{slugify(row['name'])[:20]}"

            city_slug = slugify(row["city"])
            slug = facility_slug(row["name"], alrc_id or 0)

            is_aldc = row.get("is_aldc", False)
            record = {
                "state_code": STATE_CODE,
                "license_number": license_number,
                "license_type": "ALDC" if is_aldc else "AL",
                "db_license_status": row.get("db_license_status"),
                "name": row["name"],
                "street": street,
                "city": row["city"],
                "zip": zip_code,
                "city_slug": city_slug,
                "slug": slug,
                "beds": row["capacity"],
                "facility_type": "Assisted Living with Dementia Care" if is_aldc else "Assisted Living",
                "mn_dementia_care_licensed": is_aldc,
                "mn_hfid": mn_hfid,
                "mn_all_capacity": row["capacity"],
                "mn_lic_type": "ALDC" if is_aldc else "AL",
                "care_category": "alf_memory_care" if is_aldc else "alf_general",
                "mc_review_status": "auto_published" if is_aldc else "needs_review",
            }

            if args.dry_run:
                print(f"  [dry] {row['name']} — {row['city']}, MN (ALRC:{alrc_id}) street={street}")
                stats["upserted"] += 1
                continue

            result = upsert_facility(conn_ctx, record)
            if result == "conflict":
                stats["skipped"] += 1
            else:
                stats["upserted"] += 1

        if conn_ctx:
            conn_ctx.commit()
    finally:
        if conn_ctx:
            conn_ctx.close()

    print(f"\nDone: upserted={stats['upserted']}, "
          f"skipped={stats['skipped']}, "
          f"no_addr={stats['no_addr']}")
    print("\nNext step:")
    print("  python3 scrapers/recompute_publishable.py --state MN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
