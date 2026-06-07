#!/usr/bin/env python3
"""
WA AFH Inspections Scrape — Wave 3a.

For each WA AFH facility in the DB, fetches its inspection PDF list from
  https://fortress.wa.gov/dshs/adsaapps/lookup/AFHForms.aspx?Lic=<LICENSE>

Then seeds wa_pdf_inventory so the Wave-1 parse pipeline (wa_pdf_download.py,
wa_pdf_parse.py, wa_pdf_backfill.py) can process them.

This is the AFH equivalent of wa_dshs_inspections_scrape.py (which handles ALFs
via BHForms.aspx). The parse pipeline is shared.

Usage:
  python3 scrapers/wa_afh_inspections_scrape.py                  # all AFHs in DB
  python3 scrapers/wa_afh_inspections_scrape.py --limit 50
  python3 scrapers/wa_afh_inspections_scrape.py --license 1234
  python3 scrapers/wa_afh_inspections_scrape.py --dry-run
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

AFH_FORMS_TMPL = "https://fortress.wa.gov/dshs/adsaapps/lookup/AFHForms.aspx?Lic={lic}"

_PDF_URL_RE = re.compile(
    r"https?://fortress\.wa\.gov/[^\s\"'<>]+\.pdf",
    re.IGNORECASE,
)

_DATE_RE = re.compile(r"(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})")


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
    return digits.zfill(10) if digits else "0000000000"


def fetch_afh_facilities(
    conn: psycopg.Connection,
    license_filter: str | None,
    limit: int | None,
) -> list[dict[str, Any]]:
    sql = """
        SELECT id::text, name, license_number
        FROM facilities
        WHERE state_code = 'WA'
          AND wa_facility_type = 'AFH'
          AND license_status = 'LICENSED'
          {lic_filter}
        ORDER BY license_number
        {limit_clause}
    """
    lic_filter = "AND license_number = %s" if license_filter else ""
    limit_clause = f"LIMIT {limit}" if limit else ""
    params = [pad_wa_license(license_filter)] if license_filter else []
    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(sql.format(lic_filter=lic_filter, limit_clause=limit_clause), params)
        return cur.fetchall()


def parse_pdf_links_from_html(html: str) -> list[str]:
    """Extract direct PDF URLs from the AFHForms page HTML."""
    return list(set(_PDF_URL_RE.findall(html)))


def _parse_date_loose(raw: str | None):
    """Parse inspection date from various formats, returns date or None."""
    if not raw:
        return None
    from datetime import datetime, date
    for fmt in ("%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d", "%m/%d/%y"):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    return None


def upsert_pdf_inventory(
    conn: psycopg.Connection,
    facility_id: str,
    license_number: str,
    urls: list[str],
    *,
    dry_run: bool = False,
) -> int:
    if dry_run or not urls:
        return len(urls) if dry_run else 0
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


def scrape_facility_pdfs(
    session: Any,
    facility: dict[str, Any],
    conn: psycopg.Connection,
    *,
    dry_run: bool = False,
) -> int:
    lic = facility["license_number"]
    url = AFH_FORMS_TMPL.format(lic=lic)

    try:
        resp = session_get(session, url, timeout=30)
        resp.raise_for_status()
    except Exception as exc:
        print(f"  ERR {facility['name']}: {exc}", file=sys.stderr)
        return 0

    pdf_urls = parse_pdf_links_from_html(resp.text)
    if not pdf_urls:
        print(f"  {facility['name']} ({lic}): no PDFs found")
        return 0

    print(f"  {facility['name']} ({lic}): {len(pdf_urls)} PDF(s)")
    n = upsert_pdf_inventory(
        conn,
        facility["id"],
        lic,
        pdf_urls,
        dry_run=dry_run,
    )
    return n


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="WA AFH inspections scrape — Wave 3a")
    parser.add_argument("--license", help="Single license number")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    load_env()
    print("=== WA AFH Inspections Scrape ===")

    conn = get_conn()
    session = make_session()

    facilities = fetch_afh_facilities(conn, args.license, args.limit)
    print(f"  {len(facilities)} AFHs to scrape")

    total_pdfs = 0
    for fac in facilities:
        n = scrape_facility_pdfs(session, fac, conn, dry_run=args.dry_run)
        total_pdfs += n
        polite_sleep(1.0, 0.3)

    print(f"\nTotal PDF inventory rows inserted: {total_pdfs}")
    print("Run wa_pdf_download.py → wa_pdf_parse.py → wa_pdf_backfill.py to process.")
    conn.close()


if __name__ == "__main__":
    main()
