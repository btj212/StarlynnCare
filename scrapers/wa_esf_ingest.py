#!/usr/bin/env python3
"""
WA Enhanced Services Facility (ESF) Ingest — Wave 3b.

ESFs serve complex behavioral residents. There are ~30 in WA. This script:
  1. Pulls ESF records from WA Geo Open Data (ArcGIS REST, type=ESF).
  2. Upserts into facilities with wa_facility_type='ESF'.
  3. Scrapes ESF inspection PDF links from BHForms.aspx (ESFs use same form as ALFs).
  4. Seeds wa_pdf_inventory for Wave-1 PDF parse pipeline.

Editorial note (from plan): ESFs are a separate audience from ALFs/AFHs —
they serve complex behavioral/psychiatric residents with intensive support needs.
They are included in the WA universe but should be surfaced with appropriate copy
that distinguishes them from "memory care" facilities. The default
serves_memory_care = false for ESFs until manually reviewed.

Usage:
  python3 scrapers/wa_esf_ingest.py --dry-run
  python3 scrapers/wa_esf_ingest.py
  python3 scrapers/wa_esf_ingest.py --limit 10
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import make_session, polite_sleep, session_get
from wa_geo_directory_ingest import main as geo_main, get_conn

# ESFs use the BHForms.aspx endpoint (same as ALFs)
BH_FORMS_TMPL = "https://fortress.wa.gov/dshs/adsaapps/lookup/BHForms.aspx?Lic={lic}"

_PDF_URL_RE = re.compile(
    r"https?://fortress\.wa\.gov/[^\s\"'<>]+\.pdf",
    re.IGNORECASE,
)


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
            return


def fetch_esf_facilities(
    conn: psycopg.Connection,
    limit: int | None,
) -> list[dict[str, Any]]:
    sql = """
        SELECT id::text, name, license_number
        FROM facilities
        WHERE state_code = 'WA'
          AND wa_facility_type = 'ESF'
          AND license_status = 'LICENSED'
        ORDER BY license_number
        {limit_clause}
    """
    limit_clause = f"LIMIT {limit}" if limit else ""
    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(sql.format(limit_clause=limit_clause))
        return cur.fetchall()


def upsert_pdf_inventory(
    conn: psycopg.Connection,
    facility_id: str,
    license_number: str,
    urls: list[str],
) -> int:
    if not urls:
        return 0
    inserted = 0
    with conn.cursor() as cur:
        for url in urls:
            cur.execute(
                """
                INSERT INTO wa_pdf_inventory
                  (facility_id, license_number, source_url, doc_type)
                VALUES (%s, %s, %s, 'inspection')
                ON CONFLICT (source_url) DO NOTHING
                """,
                (facility_id, license_number, url),
            )
            inserted += cur.rowcount
    conn.commit()
    return inserted


def scrape_esf_pdfs(
    session: Any,
    fac: dict[str, Any],
    conn: psycopg.Connection,
    *,
    dry_run: bool = False,
) -> int:
    lic = fac["license_number"]
    url = BH_FORMS_TMPL.format(lic=lic)
    try:
        resp = session_get(session, url, timeout=30)
        resp.raise_for_status()
    except Exception as exc:
        print(f"  ERR {fac['name']}: {exc}", file=sys.stderr)
        return 0
    pdf_urls = list(set(_PDF_URL_RE.findall(resp.text)))
    print(f"  {fac['name']} ({lic}): {len(pdf_urls)} PDF(s)")
    if dry_run:
        return len(pdf_urls)
    return upsert_pdf_inventory(conn, fac["id"], lic, pdf_urls)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="WA ESF ingest — Wave 3b")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--skip-geo", action="store_true")
    args = parser.parse_args(argv)

    load_env()
    print("=== WA ESF Ingest ===")

    # Step 1: Pull ESF universe from Geo
    if not args.skip_geo:
        print("\nStep 1: Pulling ESFs from WA Geo Open Data…")
        geo_argv = ["--type", "ESF"]
        if args.dry_run:
            geo_argv.append("--dry-run")
        if args.limit:
            geo_argv += ["--limit", str(args.limit)]
        geo_main(geo_argv)
    else:
        print("\nStep 1: Skipped (--skip-geo)")

    # Step 2: Scrape PDF links
    print("\nStep 2: Scraping ESF inspection PDF links…")
    conn = get_conn()
    session = make_session()

    facilities = fetch_esf_facilities(conn, args.limit)
    print(f"  {len(facilities)} ESFs in DB")

    total = 0
    for fac in facilities:
        n = scrape_esf_pdfs(session, fac, conn, dry_run=args.dry_run)
        total += n
        polite_sleep(1.0, 0.3)

    print(f"\nTotal PDF inventory rows: {total}")
    print("Run wa_pdf_download.py → wa_pdf_parse.py → wa_pdf_backfill.py to process.")

    # Editorial note
    print(
        "\nEditorial note: ESFs serve complex behavioral residents, distinct from"
        " ALF/AFH memory care. Set serves_memory_care=true manually only after"
        " confirming a dementia/memory-care unit via DSHS records."
    )
    conn.close()


if __name__ == "__main__":
    main()
