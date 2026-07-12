#!/usr/bin/env python3
"""Discover current ALF/ESF inspection PDFs from Washington BHForms."""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import psycopg
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import make_session, polite_sleep, session_get  # noqa: E402

BH_FORMS_TMPL = "https://fortress.wa.gov/dshs/adsaapps/lookup/BHForms.aspx?Lic={license}"

def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            return


def get_conn() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    return psycopg.connect(url)


def load_facilities(
    conn: psycopg.Connection,
    limit: int | None,
    after_license: str | None,
) -> list[dict[str, Any]]:
    limit_clause = "LIMIT %s" if limit else ""
    after_clause = "AND license_number > %s" if after_license else ""
    params = tuple(value for value in (after_license, limit) if value is not None)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT id::text, name, license_number, wa_facility_type
            FROM facilities
            WHERE state_code = 'WA'
              AND wa_facility_type IN ('ALF', 'ESF')
              AND license_status = 'LICENSED'
              AND license_number IS NOT NULL
              {after_clause}
            ORDER BY license_number
            {limit_clause}
            """,
            params,
        )
        return cur.fetchall()


def discover_facility(
    conn: psycopg.Connection,
    session: Any,
    facility: dict[str, Any],
    *,
    dry_run: bool,
) -> tuple[int, int]:
    license_number = re.sub(r"\D", "", facility["license_number"])
    response = session_get(
        session,
        BH_FORMS_TMPL.format(license=license_number),
        timeout=30,
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    urls = sorted(
        {
            urljoin(response.url, href)
            for anchor in soup.find_all("a", href=True)
            if (href := anchor.get("href")) and href.lower().endswith(".pdf")
        }
    )
    inserted = 0
    if not dry_run:
        with conn.cursor() as cur:
            for url in urls:
                lowered_url = url.lower()
                doc_type = (
                    "complaint"
                    if "complaint" in lowered_url
                    else "inspection"
                    if "/inspections/" in lowered_url
                    else "other"
                )
                cur.execute(
                    """
                    INSERT INTO wa_pdf_inventory (
                      facility_id,
                      license_number,
                      source_url,
                      doc_type
                    )
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (source_url) DO NOTHING
                    """,
                    (facility["id"], facility["license_number"], url, doc_type),
                )
                inserted += cur.rowcount
        conn.commit()
    print(
        f"  {facility['name']} ({facility['wa_facility_type']}): "
        f"{len(urls)} found, {inserted} new"
    )
    return len(urls), inserted


def main() -> int:
    parser = argparse.ArgumentParser(description="WA ALF/ESF BHForms PDF discovery")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--after-license", help="Resume after this license number")
    args = parser.parse_args()

    load_env()
    conn = get_conn()
    session = make_session()
    facilities = load_facilities(conn, args.limit, args.after_license)
    print(f"Scanning {len(facilities)} WA ALF/ESF facilities")

    found = 0
    inserted = 0
    failures = 0
    for facility in facilities:
        try:
            facility_found, facility_inserted = discover_facility(
                conn,
                session,
                facility,
                dry_run=args.dry_run,
            )
            found += facility_found
            inserted += facility_inserted
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"  ERROR {facility['name']}: {exc}", file=sys.stderr)
        polite_sleep(0.2, 0.1)

    conn.close()
    print(f"Done: {found} PDF links found, {inserted} new, {failures} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
