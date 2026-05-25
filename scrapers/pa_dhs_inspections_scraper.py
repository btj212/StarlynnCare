#!/usr/bin/env python3
"""
Pennsylvania DHS Inspection Portal Scraper.

For each PA facility with serves_memory_care=true AND license_status='LICENSED',
GET the per-facility Azure inspection summary page and parse the HTML table of
inspection PDFs. Each (file_date, pdf_url) pair becomes:

  1. An `inspections` row (one per inspection event, source_agency='PA-DHS-OLTL').
  2. A `pa_pdf_inventory` row with download_status='pending' so the OR-style PDF
     pipeline (pa_pdf_download → pa_pdf_parse → pa_pdf_backfill) can take over.

The portal page returns the standard DHS table:

    <table class="table">
        <thead><tr>
            <th>Facility License Number</th>
            <th>Inspection/Violation File Date</th>
            <th>Inspection/Violation Report</th>
        </tr></thead>
        <tbody>
            <tr>
                <td>22301</td>
                <td>11/19/2025</td>
                <td><a href="/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/GetAzureFile?...">View Report</a></td>
            </tr>
            …
        </tbody>
    </table>

URL is constructed via the PA helper (license_number[:-1]).

Usage:
    python3 -u pa_dhs_inspections_scraper.py
    python3 -u pa_dhs_inspections_scraper.py --smoke-test       # first 5 publishable facilities
    python3 -u pa_dhs_inspections_scraper.py --dry-run          # fetch + parse, no DB writes
    python3 -u pa_dhs_inspections_scraper.py --external-id 223010 --dry-run
"""

from __future__ import annotations

import argparse
import os
import random
import re
import sys
import time
import urllib.parse
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent

DHS_BASE = "https://www.humanservices.dhs.pa.gov"
DHS_DIRECTORY_HOME = f"{DHS_BASE}/HUMAN_SERVICE_PROVIDER_DIRECTORY/"
SOURCE_AGENCY = "PA-DHS-OLTL"

# Polite — DHS portal is fronted by Azure; 0.5s + jitter ≈ 3 min for 365 facilities
REQUEST_DELAY = 0.5
REQUEST_JITTER = 0.4


# ---------------------------------------------------------------------------
# Env
# ---------------------------------------------------------------------------


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def derive_url_id(license_number: str) -> str:
    """PA gotcha: strip last (check) digit. 223010 → 22301. See methodology Section 4."""
    return str(license_number).strip()[:-1]


def inspection_index_url(license_number: str, facility_name: str | None) -> str:
    url_id = derive_url_id(license_number)
    name_param = urllib.parse.quote(facility_name or "", safe=" ")
    return (
        f"{DHS_BASE}/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/"
        f"AzureInspVioltnReprtSearchResults?id={url_id}&facilityName={name_param}"
    )


def polite_sleep() -> None:
    time.sleep(REQUEST_DELAY + random.random() * REQUEST_JITTER)


def parse_table_date(raw: str) -> date | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            pass
    return None


def absolute_pdf_url(href: str) -> str:
    """DHS hrefs are root-relative — normalize to absolute."""
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return f"{DHS_BASE}{href}"
    return f"{DHS_BASE}/{href}"


def parse_inspection_table(html: str) -> list[dict[str, Any]]:
    """
    Return [{inspection_date: date, pdf_url: str, license_url_id: str}, ...].
    Skips rows that don't have a valid date or a PDF link.
    """
    soup = BeautifulSoup(html, "html.parser")
    out: list[dict[str, Any]] = []
    for table in soup.find_all("table"):
        thead = table.find("thead")
        if not thead:
            continue
        headers = " ".join(th.get_text(" ", strip=True).lower() for th in thead.find_all("th"))
        if "inspection" not in headers or "report" not in headers:
            continue
        tbody = table.find("tbody")
        if not tbody:
            continue
        for tr in tbody.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) < 3:
                continue
            url_id_cell = tds[0].get_text(" ", strip=True)
            date_cell = tds[1].get_text(" ", strip=True)
            link = tds[2].find("a", href=True)
            if not link:
                continue
            inspection_date = parse_table_date(date_cell)
            if inspection_date is None:
                continue
            pdf_url = absolute_pdf_url(link["href"])
            out.append(
                {
                    "inspection_date": inspection_date,
                    "pdf_url": pdf_url,
                    "license_url_id": url_id_cell,
                }
            )
    return out


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = "StarlynnCare-bot/1.0 (+https://starlynn.care)"
    s.headers["Accept"] = "text/html,application/xhtml+xml"
    # Seed cookies
    try:
        s.get(DHS_DIRECTORY_HOME, timeout=30)
    except requests.RequestException as exc:
        print(f"  WARN: cookie seed failed: {exc}", file=sys.stderr, flush=True)
    return s


def fetch_inspection_page(session: requests.Session, url: str) -> str | None:
    try:
        r = session.get(url, timeout=30)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.text
    except requests.RequestException as exc:
        print(f"  HTTP ERROR {url}: {exc}", file=sys.stderr, flush=True)
        return None


# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------


def load_target_facilities(
    conn: psycopg.Connection,
    *,
    external_id: str | None,
) -> list[dict[str, Any]]:
    """
    Return PA facilities that should be scraped: serves_memory_care + LICENSED +
    have an external_id. Returns dicts with id, external_id, name, city, license_type.
    """
    where_extra = ""
    params: list[Any] = []
    if external_id:
        where_extra = " AND external_id = %s"
        params.append(external_id)

    sql = f"""
        SELECT id::text AS id,
               external_id,
               name,
               city,
               license_type,
               inspection_index_url
        FROM facilities
        WHERE state_code = 'PA'
          AND serves_memory_care = true
          AND license_status = 'LICENSED'
          AND external_id IS NOT NULL
          {where_extra}
        ORDER BY name
    """
    with conn.cursor() as cur:
        cur.execute(sql, params)
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


# Inspection upsert: dedupe by (facility_id, inspection_date, source_agency).
# Returns the id whether inserted or pre-existing.
INSPECTION_INSERT_SQL = """
    INSERT INTO inspections (
        facility_id, inspection_date, inspection_type,
        source_url, source_agency
    ) VALUES (
        %(facility_id)s, %(inspection_date)s, 'inspection',
        %(source_url)s, %(source_agency)s
    )
    ON CONFLICT DO NOTHING
    RETURNING id
"""

INSPECTION_SELECT_SQL = """
    SELECT id::text
    FROM inspections
    WHERE facility_id = %s
      AND inspection_date = %s
      AND source_agency = %s
    LIMIT 1
"""

PDF_INVENTORY_INSERT_SQL = """
    INSERT INTO pa_pdf_inventory (
        facility_id, inspection_id, pdf_url, inspection_date
    ) VALUES (
        %(facility_id)s, %(inspection_id)s, %(pdf_url)s, %(inspection_date)s
    )
    ON CONFLICT (pdf_url) DO UPDATE SET
        inspection_id = COALESCE(pa_pdf_inventory.inspection_id, EXCLUDED.inspection_id),
        inspection_date = COALESCE(pa_pdf_inventory.inspection_date, EXCLUDED.inspection_date),
        updated_at = now()
"""


def persist_findings(
    conn: psycopg.Connection,
    facility: dict[str, Any],
    page_url: str,
    findings: list[dict[str, Any]],
) -> tuple[int, int]:
    """Insert inspections + pa_pdf_inventory for one facility. Returns (insp_count, pdf_count)."""
    insp_added = 0
    pdf_added = 0
    with conn.cursor() as cur:
        for f in findings:
            sp = (
                f"sp_pa_insp_{facility['external_id']}_"
                f"{f['inspection_date'].isoformat().replace('-', '')}"
            )
            try:
                cur.execute(f"SAVEPOINT {sp}")
                # Insert inspection (deduplicated by ON CONFLICT)
                cur.execute(
                    INSPECTION_INSERT_SQL,
                    {
                        "facility_id": facility["id"],
                        "inspection_date": f["inspection_date"],
                        "source_url": page_url,
                        "source_agency": SOURCE_AGENCY,
                    },
                )
                row = cur.fetchone()
                inspection_id = row[0] if row else None
                if inspection_id:
                    insp_added += 1
                else:
                    # Already existed — look it up so we can link the PDF inventory row
                    cur.execute(
                        INSPECTION_SELECT_SQL,
                        (facility["id"], f["inspection_date"], SOURCE_AGENCY),
                    )
                    existing = cur.fetchone()
                    inspection_id = existing[0] if existing else None

                # Insert / update PDF inventory row
                cur.execute(
                    PDF_INVENTORY_INSERT_SQL,
                    {
                        "facility_id": facility["id"],
                        "inspection_id": inspection_id,
                        "pdf_url": f["pdf_url"],
                        "inspection_date": f["inspection_date"],
                    },
                )
                pdf_added += 1
                cur.execute(f"RELEASE SAVEPOINT {sp}")
            except Exception as exc:
                cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                print(
                    f"  DB ERROR {facility['external_id']} {f['inspection_date']}: {exc}",
                    file=sys.stderr,
                    flush=True,
                )
    return insp_added, pdf_added


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape PA DHS inspection portal")
    parser.add_argument("--smoke-test", action="store_true", help="First 5 facilities only")
    parser.add_argument("--dry-run", action="store_true", help="Fetch + parse, no DB writes")
    parser.add_argument(
        "--external-id",
        help="Limit to a single facility by external_id (license number)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process at most N facilities",
    )
    args = parser.parse_args()

    load_env()
    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    conn: psycopg.Connection | None = None
    if not args.dry_run:
        conn = psycopg.connect(os.environ["DATABASE_URL"])
        facilities = load_target_facilities(conn, external_id=args.external_id)
    else:
        # Smoke-test stub fixture
        facilities = [
            {
                "id": "stub-rittenhouse",
                "external_id": "223010",
                "name": "RITTENHOUSE VILLAGE AT LEHIGH VALLEY",
                "city": "ALLENTOWN",
                "license_type": "PERSONAL CARE HOMES",
                "inspection_index_url": None,
            }
        ]
        if args.external_id:
            # Allow probing a single facility live without DB
            facilities = [
                {
                    "id": f"stub-{args.external_id}",
                    "external_id": args.external_id,
                    "name": "(probe)",
                    "city": None,
                    "license_type": None,
                    "inspection_index_url": None,
                }
            ]

    if args.smoke_test:
        facilities = facilities[:5]
    if args.limit:
        facilities = facilities[: args.limit]

    print(f"Scraping {len(facilities)} PA facilities …", flush=True)

    session = make_session()
    total_insp = 0
    total_pdf = 0
    no_data = 0
    no_table = 0

    try:
        for i, fac in enumerate(facilities, 1):
            url = fac.get("inspection_index_url") or inspection_index_url(
                fac["external_id"], fac["name"]
            )
            print(
                f"[{i}/{len(facilities)}] {fac['external_id']} {fac['name'][:50]}",
                flush=True,
            )
            html = fetch_inspection_page(session, url)
            if html is None:
                no_data += 1
                polite_sleep()
                continue
            findings = parse_inspection_table(html)
            if not findings:
                # Page returned 200 but had no inspection table (rare — newly licensed facility?)
                if "Inspection/Violation Report" not in html:
                    no_table += 1
                else:
                    # The header exists but tbody was empty — facility has never been inspected
                    pass
                print(f"  0 inspections found", flush=True)
                polite_sleep()
                continue

            print(f"  {len(findings)} PDFs found", flush=True)
            if args.dry_run:
                for f in findings[:3]:
                    print(
                        f"    {f['inspection_date']} → {f['pdf_url'][:90]}",
                        flush=True,
                    )
                total_insp += len(findings)
                total_pdf += len(findings)
            elif conn is not None:
                insp_c, pdf_c = persist_findings(conn, fac, url, findings)
                conn.commit()
                total_insp += insp_c
                total_pdf += pdf_c

            polite_sleep()
    finally:
        if conn:
            conn.close()

    print(
        f"\nDone. {total_insp} inspections, {total_pdf} PDF inventory rows. "
        f"({no_data} pages 404, {no_table} pages had no table)",
        flush=True,
    )

    # Fail loud: if NO inspections were found across a non-trivial sample,
    # something probably broke (URL pattern change, table layout shift, etc.).
    if not args.dry_run and len(facilities) >= 10 and total_pdf == 0:
        print(
            "FAIL: 0 PDF inventory rows across 10+ facilities — DHS portal may have changed.",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
