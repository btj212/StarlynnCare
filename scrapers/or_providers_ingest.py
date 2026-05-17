#!/usr/bin/env python3
"""
Oregon Providers CSV Ingest — OR Universe, Phase 1.

Ingests the full Providers export from ltclicensing.oregon.gov and upserts
into `facilities`.  Replaces the old or_dhs_ltc_directory_ingest.py.

Actual CSV columns (as downloaded 2026-05-16):
  ID | Name | Type | Address | City | Zip | County | Licensed beds |
  Accepts Medicaid | Memory Care | Status

Key differences from the old script:
  - external_id stored VERBATIM (no zero-padding) — required for alphanumeric
    IDs like "50M300", "5MA238" that break the old 10-digit zero-pad scheme.
  - `Memory Care` column IS in the CSV — sets mce_endorsed directly, no portal
    scrape needed for the primary signal. or_signal_mce.py can cross-reference
    for additional provenance but is no longer the primary source.
  - Address, Zip, County captured from CSV (web UI hides these columns).
  - Status filter: ingest Open AND Closed (license_status tracks both).

Usage:
  python3 scrapers/or_providers_ingest.py --input data/or_providers.csv
  python3 scrapers/or_providers_ingest.py --input data/or_providers.csv --dry-run
  python3 scrapers/or_providers_ingest.py --input data/or_providers.csv --limit 50
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
STATE_CODE = "OR"
SOURCE_PAGE = "https://ltclicensing.oregon.gov/Providers"


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
    return " ".join(
        w if (i > 0 and w in stop) else w.capitalize()
        for i, w in enumerate(words)
    )


def facility_slug(name: str, external_id: str) -> str:
    base = slugify(name)
    # Prefer the raw external_id as suffix (alphanumeric IDs are already compact)
    tail = re.sub(r"^0+", "", external_id) or external_id[-4:]
    return f"{base}-{tail.lower()}"


def derive_care_category(type_raw: str, mce_endorsed: bool) -> str:
    t = type_raw.upper()
    if mce_endorsed:
        if t == "AFH":
            return "afh_memory_care"
        return "alf_memory_care"
    if t == "AFH":
        return "alf_general"
    if t in ("ALF", "RCF"):
        return "alf_general"
    if t == "NF":
        return "snf_general"
    return "alf_general"


def parse_bool(raw: str) -> bool:
    return raw.strip().lower() in ("yes", "y", "true", "1")


def parse_beds(raw: str) -> int | None:
    if not raw:
        return None
    try:
        return int(float(raw))
    except (ValueError, TypeError):
        return None


def row_to_record(row: dict[str, str]) -> dict[str, Any] | None:
    """Map a CSV row (column names verbatim from the export) to a facilities record."""
    external_id = row.get("ID", "").strip()
    raw_name    = row.get("Name", "").strip()
    if not external_id or not raw_name:
        return None

    type_raw    = row.get("Type", "").strip()
    address     = row.get("Address", "").strip()
    raw_city    = row.get("City", "").strip()
    zip_code    = row.get("Zip", "").strip()
    county      = row.get("County", "").strip()
    beds        = parse_beds(row.get("Licensed beds", ""))
    mce_endorsed = parse_bool(row.get("Memory Care", ""))
    status_raw  = row.get("Status", "").strip().lower()

    name       = titleize(raw_name) or f"Facility {external_id}"
    city       = titleize(raw_city) if raw_city else None
    city_slug  = slugify(raw_city) if raw_city else "unknown-city"
    slug       = facility_slug(name, external_id)

    license_status = "LICENSED" if status_raw == "open" else "CLOSED"

    return {
        "state_code": STATE_CODE,
        "name": name,
        "external_id": external_id,
        "license_number": external_id,
        "license_type": type_raw or None,
        "street": titleize(address) if address else None,
        "city": city,
        "city_slug": city_slug,
        "zip": zip_code[:10] if zip_code else None,
        "slug": slug,
        "beds": beds,
        "care_category": derive_care_category(type_raw, mce_endorsed),
        "license_status": license_status,
        "publishable": False,          # set by recompute_publishable.py
        "serves_memory_care": mce_endorsed,
        # MCE=Yes → trust state signal, auto-publish. MCE=No → auto_published too but
        # serves_memory_care=false means the publishable gate blocks them anyway.
        "mc_review_status": "auto_published",
        "source_url": SOURCE_PAGE,
        # OR MCE signal — directly from CSV (the state's own flag)
        "mce_endorsed": mce_endorsed,
        "mce_evidence": "providers_csv" if mce_endorsed else None,
        "enhanced_oversight": False,
        "unendorsed_mc_violation": False,
        # Advisory fields — not surfaced in UI yet, kept for analytics
        "_county": county,
        "_accepts_medicaid": parse_bool(row.get("Accepts Medicaid", "")),
    }


UPSERT_SQL = """
INSERT INTO facilities (
    state_code, name, external_id, license_number, license_type,
    street, city, city_slug, zip, slug, beds, care_category,
    license_status, publishable, serves_memory_care, mc_review_status, source_url,
    mce_endorsed, mce_evidence, enhanced_oversight, unendorsed_mc_violation
)
VALUES (
    %(state_code)s, %(name)s, %(external_id)s, %(license_number)s, %(license_type)s,
    %(street)s, %(city)s, %(city_slug)s, %(zip)s, %(slug)s, %(beds)s, %(care_category)s,
    %(license_status)s, %(publishable)s, %(serves_memory_care)s, %(mc_review_status)s, %(source_url)s,
    %(mce_endorsed)s, %(mce_evidence)s, %(enhanced_oversight)s, %(unendorsed_mc_violation)s
)
ON CONFLICT (state_code, city_slug, slug) DO UPDATE SET
    name               = EXCLUDED.name,
    external_id        = EXCLUDED.external_id,
    license_number     = EXCLUDED.license_number,
    license_type       = EXCLUDED.license_type,
    street             = COALESCE(EXCLUDED.street, facilities.street),
    city               = COALESCE(EXCLUDED.city, facilities.city),
    zip                = COALESCE(EXCLUDED.zip, facilities.zip),
    beds               = COALESCE(EXCLUDED.beds, facilities.beds),
    care_category      = EXCLUDED.care_category,
    license_status     = EXCLUDED.license_status,
    serves_memory_care = EXCLUDED.serves_memory_care,
    mc_review_status   = COALESCE(EXCLUDED.mc_review_status, facilities.mc_review_status),
    source_url         = EXCLUDED.source_url,
    mce_endorsed       = EXCLUDED.mce_endorsed,
    mce_evidence       = COALESCE(EXCLUDED.mce_evidence, facilities.mce_evidence)
"""

# Primary upsert target: (state_code, external_id) — fastest path for repeat runs
UPSERT_BY_EXT_ID_SQL = """
INSERT INTO facilities (
    state_code, name, external_id, license_number, license_type,
    street, city, city_slug, zip, slug, beds, care_category,
    license_status, publishable, serves_memory_care, mc_review_status, source_url,
    mce_endorsed, mce_evidence, enhanced_oversight, unendorsed_mc_violation
)
VALUES (
    %(state_code)s, %(name)s, %(external_id)s, %(license_number)s, %(license_type)s,
    %(street)s, %(city)s, %(city_slug)s, %(zip)s, %(slug)s, %(beds)s, %(care_category)s,
    %(license_status)s, %(publishable)s, %(serves_memory_care)s, %(mc_review_status)s, %(source_url)s,
    %(mce_endorsed)s, %(mce_evidence)s, %(enhanced_oversight)s, %(unendorsed_mc_violation)s
)
ON CONFLICT (state_code, external_id) WHERE state_code = 'OR' AND external_id IS NOT NULL
DO UPDATE SET
    name               = EXCLUDED.name,
    license_type       = EXCLUDED.license_type,
    street             = COALESCE(EXCLUDED.street, facilities.street),
    city               = COALESCE(EXCLUDED.city, facilities.city),
    city_slug          = EXCLUDED.city_slug,
    zip                = COALESCE(EXCLUDED.zip, facilities.zip),
    beds               = COALESCE(EXCLUDED.beds, facilities.beds),
    care_category      = EXCLUDED.care_category,
    license_status     = EXCLUDED.license_status,
    serves_memory_care = EXCLUDED.serves_memory_care,
    mc_review_status   = COALESCE(EXCLUDED.mc_review_status, facilities.mc_review_status),
    mce_endorsed       = EXCLUDED.mce_endorsed,
    mce_evidence       = COALESCE(EXCLUDED.mce_evidence, facilities.mce_evidence)
"""


def ingest(input_path: Path, dry_run: bool, limit: int | None) -> None:
    with open(input_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        all_rows = list(reader)

    records = [r for row in all_rows if (r := row_to_record(row)) is not None]
    if limit:
        records = records[:limit]

    open_count   = sum(1 for r in records if r["license_status"] == "LICENSED")
    mce_count    = sum(1 for r in records if r["mce_endorsed"])
    print(f"  Parsed {len(records)} facilities — Open: {open_count}, MCE=Yes: {mce_count}")

    if dry_run:
        for r in records[:8]:
            print(
                f"    {r['external_id']:12s}  {r['name'][:35]:35s}  "
                f"{r['license_status']:7s}  mce={r['mce_endorsed']}"
            )
        print("  ... (dry-run, no DB writes)")
        return

    conn = get_conn()
    ok = err = 0
    with conn:
        for rec in records:
            db_rec = {k: v for k, v in rec.items() if not k.startswith("_")}
            try:
                with conn.cursor() as cur:
                    # Savepoint: a failed execute rolls back only this row,
                    # not the whole transaction, so subsequent rows still commit.
                    cur.execute("SAVEPOINT sp_row")
                    try:
                        cur.execute(UPSERT_BY_EXT_ID_SQL, db_rec)
                        cur.execute("RELEASE SAVEPOINT sp_row")
                        ok += 1
                    except Exception:
                        cur.execute("ROLLBACK TO SAVEPOINT sp_row")
                        cur.execute("RELEASE SAVEPOINT sp_row")
                        # Fallback: conflict on (state_code, city_slug, slug)
                        cur.execute("SAVEPOINT sp_fallback")
                        try:
                            cur.execute(UPSERT_SQL, db_rec)
                            cur.execute("RELEASE SAVEPOINT sp_fallback")
                            ok += 1
                        except Exception as exc2:
                            cur.execute("ROLLBACK TO SAVEPOINT sp_fallback")
                            cur.execute("RELEASE SAVEPOINT sp_fallback")
                            print(f"  WARN: {rec['external_id']} {rec['name'][:30]} — {exc2}", file=sys.stderr)
                            err += 1
            except Exception as exc_outer:
                print(f"  WARN outer: {rec['external_id']} — {exc_outer}", file=sys.stderr)
                err += 1
        conn.commit()

    print(f"  Done — inserted/updated: {ok}, errors: {err}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest OR Providers CSV into facilities.")
    parser.add_argument("--input", required=True, help="Path to Providers CSV")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    load_env()
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    ingest(input_path, args.dry_run, args.limit)


if __name__ == "__main__":
    main()
