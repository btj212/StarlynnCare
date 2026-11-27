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

SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import source_should_fail_job  # noqa: E402

REPO_ROOT = SCRAPERS_DIR.parent

DHS_BASE = "https://www.humanservices.dhs.pa.gov"
DHS_DIRECTORY_HOME = f"{DHS_BASE}/HUMAN_SERVICE_PROVIDER_DIRECTORY/"
SOURCE_AGENCY = "PA-DHS-OLTL"

# Polite — DHS portal is fronted by Azure; 0.5s + jitter ≈ 3 min for 365 facilities
REQUEST_DELAY = 0.5
REQUEST_JITTER = 0.4
# GitHub-hosted IPs get intermittent Azure WAF 403s. Three backoffs, then a
# second pass, recovers most of them. A bot User-Agent made the WAF worse.
FETCH_BACKOFF_SEC = (2, 5, 15)
BROWSER_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)


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
    # Browser-like headers. The previous "StarlynnCare-bot/…" UA made Azure
    # Front Door 403 a handful of facility pages on GitHub-hosted runners.
    s.headers["User-Agent"] = BROWSER_UA
    s.headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    s.headers["Accept-Language"] = "en-US,en;q=0.9"
    # Seed cookies
    try:
        s.get(DHS_DIRECTORY_HOME, timeout=30)
    except requests.RequestException as exc:
        print(f"  WARN: cookie seed failed: {exc}", file=sys.stderr, flush=True)
    return s


RETRYABLE_STATUS = {403, 429, 500, 502, 503, 504}


def status_is_retryable(status_code: int) -> bool:
    """A block or a gateway error can clear. A missing page cannot."""
    return status_code in RETRYABLE_STATUS


def fetch_inspection_page(session: requests.Session, url: str) -> tuple[str | None, bool]:
    """Return (html, blocked). A 404 is a missing page, not a block."""
    last_status = None
    for attempt, wait in enumerate(FETCH_BACKOFF_SEC, start=1):
        try:
            response = session.get(url, timeout=30)
        except requests.RequestException as exc:
            print(f"  HTTP ERROR {url}: {exc}", file=sys.stderr, flush=True)
            if attempt < len(FETCH_BACKOFF_SEC):
                time.sleep(wait)
                continue
            return None, True
        last_status = response.status_code
        if response.status_code == 404:
            return None, False
        if status_is_retryable(response.status_code):
            print(
                f"  HTTP {response.status_code} {url} (attempt {attempt}/{len(FETCH_BACKOFF_SEC)})",
                file=sys.stderr,
                flush=True,
            )
            if attempt < len(FETCH_BACKOFF_SEC):
                time.sleep(wait)
                continue
            return None, True
        try:
            response.raise_for_status()
        except requests.RequestException as exc:
            print(f"  HTTP ERROR {url}: {exc}", file=sys.stderr, flush=True)
            return None, True
        return response.text, False
    print(
        f"  HTTP {last_status or 'error'} {url} stayed blocked after {len(FETCH_BACKOFF_SEC)} tries",
        file=sys.stderr,
        flush=True,
    )
    return None, True


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

    When external_id is set, skip the serves_memory_care filter so a single facility
    can be targeted (e.g. Cumberland Crossing Manor on a custom report page).
    """
    where_extra = ""
    params: list[Any] = []
    if external_id:
        where_extra = " AND external_id = %s"
        params.append(external_id)

    mc_clause = "" if external_id else "AND serves_memory_care = true"

    sql = f"""
        SELECT id::text AS id,
               external_id,
               name,
               city,
               license_type,
               inspection_index_url
        FROM facilities
        WHERE state_code = 'PA'
          {mc_clause}
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
    blocked = 0
    blocked_facilities: list[dict[str, Any]] = []

    def persist_page(fac: dict[str, Any], url: str, html: str) -> None:
        nonlocal total_insp, total_pdf, no_table
        findings = parse_inspection_table(html)
        if not findings:
            if "Inspection/Violation Report" not in html:
                no_table += 1
            print("  0 inspections found", flush=True)
            return
        print(f"  {len(findings)} PDFs found", flush=True)
        if args.dry_run:
            for f in findings[:3]:
                print(
                    f"    {f['inspection_date']} → {f['pdf_url'][:90]}",
                    flush=True,
                )
            total_insp += len(findings)
            total_pdf += len(findings)
            return
        if conn is not None:
            insp_c, pdf_c = persist_findings(conn, fac, url, findings)
            conn.commit()
            total_insp += insp_c
            total_pdf += pdf_c

    try:
        for i, fac in enumerate(facilities, 1):
            url = fac.get("inspection_index_url") or inspection_index_url(
                fac["external_id"], fac["name"]
            )
            print(
                f"[{i}/{len(facilities)}] {fac['external_id']} {fac['name'][:50]}",
                flush=True,
            )
            html, page_blocked = fetch_inspection_page(session, url)
            if page_blocked:
                blocked_facilities.append(fac)
                polite_sleep()
                continue
            if html is None:
                no_data += 1
                polite_sleep()
                continue
            persist_page(fac, url, html)
            polite_sleep()

        if blocked_facilities:
            print(
                f"Retrying {len(blocked_facilities)} blocked pages after a pause…",
                flush=True,
            )
            time.sleep(15)
            still_blocked: list[dict[str, Any]] = []
            for fac in blocked_facilities:
                url = fac.get("inspection_index_url") or inspection_index_url(
                    fac["external_id"], fac["name"]
                )
                print(
                    f"  retry {fac['external_id']} {fac['name'][:50]}",
                    flush=True,
                )
                html, page_blocked = fetch_inspection_page(session, url)
                if page_blocked or html is None:
                    if html is None and not page_blocked:
                        no_data += 1
                    else:
                        still_blocked.append(fac)
                    polite_sleep()
                    continue
                persist_page(fac, url, html)
                polite_sleep()
            blocked = len(still_blocked)
        else:
            blocked = 0
    finally:
        if conn:
            conn.close()

    print(
        f"\nDone. {total_insp} inspections, {total_pdf} PDF inventory rows. "
        f"({no_data} pages 404, {no_table} pages had no table, {blocked} stayed blocked)",
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

    if source_should_fail_job(len(facilities), blocked, total_pdf):
        print(
            f"FAIL: {blocked}/{len(facilities)} facility pages stayed blocked.",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)
    if blocked:
        print(
            f"WARN: {blocked}/{len(facilities)} facility pages stayed blocked "
            "from this runner. The rest of the scrape is stored.",
            file=sys.stderr,
            flush=True,
        )


if __name__ == "__main__":
    main()
