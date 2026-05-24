#!/usr/bin/env python3
"""
IL LLCS event scrape — seed il_inspection_inventory with per-event SOD/complaint PDF URLs.

For each IL inspection row in the DB (inserted by il_foia_visits_ingest.py),
attempts to find the corresponding downloadable Statement of Deficiencies (SOD)
or complaint report PDF on llcs.dph.illinois.gov.

LLCS is a Salesforce Experience Cloud app (JavaScript-heavy). This script uses
requests to probe known URL patterns and falls back with guidance for Playwright
if the simple HTTP approach doesn't resolve PDFs.

Known URL patterns to attempt per facility + event date:
  1. Facility detail page: https://llcs.dph.illinois.gov/s/facility?id=<SF_ID>
  2. Survey/inspection document listing (if Salesforce REST is queryable)

Since the portal is JS-rendered, this script also provides a --mark-manual flag
to register already-discovered PDF URLs directly into il_inspection_inventory
from a CSV (useful when PDFs were found through the browser).

Usage:
  python3 -u scrapers/il_llcs_event_scrape.py              # full run
  python3 -u scrapers/il_llcs_event_scrape.py --dry-run    # no DB writes
  python3 -u scrapers/il_llcs_event_scrape.py --limit 50   # first 50 inspections
  python3 -u scrapers/il_llcs_event_scrape.py --smoke      # first 5 facilities

  # Register PDFs discovered manually via browser:
  python3 -u scrapers/il_llcs_event_scrape.py \\
      --mark-manual path/to/urls.csv
  # CSV columns: license_number, inspection_date (YYYY-MM-DD), pdf_url, doc_type (inspection|complaint)

Notes on the Salesforce portal:
  - Public Experience Cloud sites expose data via the Aura framework at
    POST /s/sfsites/aura.  Parameters vary per community and are not
    documented; reverse-engineer via browser DevTools Network tab.
  - An accessible pattern (seen on some IL DPH Salesforce communities):
    GET /services/apexrest/SurveyDocuments?licenseId=<ID>&date=<DATE>
  - If HTTP probes return 401/403, the PDFs require the Salesforce session
    cookie. Use Playwright or the cursor-ide-browser MCP to authenticate
    and extract URLs, then feed them with --mark-manual.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import time
import random
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "IL"
LLCS_BASE = "https://llcs.dph.illinois.gov"
REQUEST_DELAY = 1.0


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


def polite_sleep() -> None:
    time.sleep(REQUEST_DELAY + random.random() * 0.5)


def make_session() -> requests.Session:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    sess = requests.Session()
    sess.verify = False
    sess.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
    })
    return sess


# ---------------------------------------------------------------------------
# Load target inspections
# ---------------------------------------------------------------------------


def load_pending_inspections(
    conn: psycopg.Connection,
    limit: int | None = None,
    smoke: bool = False,
) -> list[dict[str, Any]]:
    """
    Return IL inspections not yet in il_inspection_inventory.
    Groups by facility so we can batch per-facility requests.
    """
    lim = 5 if smoke else limit
    limit_clause = f"LIMIT {int(lim)}" if lim else ""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT i.id::text, i.facility_id::text,
                   f.license_number, f.name,
                   i.inspection_date, i.inspection_type,
                   i.source_url
            FROM inspections i
            JOIN facilities f ON f.id = i.facility_id
            WHERE f.state_code = 'IL'
              AND NOT EXISTS (
                SELECT 1 FROM il_inspection_inventory inv
                WHERE inv.inspection_id = i.id
              )
            ORDER BY f.license_number, i.inspection_date DESC
            {limit_clause}
            """,
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


# ---------------------------------------------------------------------------
# Probe for PDF URL
# ---------------------------------------------------------------------------


def _probe_survey_doc(
    sess: requests.Session,
    license_number: str,
    insp_date: date,
) -> str | None:
    """
    Try known LLCS URL patterns to find a downloadable PDF for this event.
    Returns the URL if found (HTTP 200 with Content-Type: application/pdf),
    or None if no PDF is publicly accessible via simple HTTP.
    """
    patterns = [
        # Pattern 1: Salesforce Apex REST (may require auth)
        (
            f"{LLCS_BASE}/services/apexrest/SurveyDocuments"
            f"?licenseId={license_number}&date={insp_date.isoformat()}"
        ),
        # Pattern 2: Direct document endpoint (Visualforce / Community File)
        (
            f"{LLCS_BASE}/s/survey-document"
            f"?license={license_number}&date={insp_date.isoformat()}"
        ),
        # Pattern 3: Generic "files" endpoint
        (
            f"{LLCS_BASE}/s/contentdocument?license={license_number}"
        ),
    ]

    for url in patterns:
        try:
            r = sess.head(url, timeout=10, allow_redirects=True)
            ct = r.headers.get("Content-Type", "")
            if r.status_code == 200 and "pdf" in ct.lower():
                return url
        except requests.RequestException:
            pass
        polite_sleep()

    return None


def upsert_inventory(
    conn: psycopg.Connection,
    inspection_id: str,
    facility_id: str,
    license_number: str,
    source_url: str,
    inspection_date: date | None,
    doc_type: str = "inspection",
    dry_run: bool = False,
) -> None:
    if dry_run:
        print(f"    [dry-run] would add {source_url[:80]}", flush=True)
        return

    sp = f"sp_il_inv_{inspection_id[:8]}"
    with conn.cursor() as cur:
        try:
            cur.execute(f"SAVEPOINT {sp}")
            cur.execute(
                """
                INSERT INTO il_inspection_inventory (
                    facility_id, inspection_id, license_number,
                    source_url, doc_type, inspection_date
                ) VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s)
                ON CONFLICT (source_url) DO NOTHING
                """,
                (
                    facility_id, inspection_id, license_number,
                    source_url, doc_type, inspection_date,
                ),
            )
            cur.execute(f"RELEASE SAVEPOINT {sp}")
        except Exception as exc:
            cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
            print(f"  INV ERROR {inspection_id}: {exc}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# Mode: --mark-manual
# ---------------------------------------------------------------------------


def run_mark_manual(csv_path: Path, dry_run: bool) -> None:
    """
    Register PDF URLs from a manually assembled CSV into il_inspection_inventory.
    CSV columns: license_number, inspection_date, pdf_url[, doc_type]
    """
    conn = None if dry_run else get_conn()
    ok = err = 0
    try:
        with open(csv_path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        if not conn and not dry_run:
            conn = get_conn()

        # Pre-load inspection IDs for IL
        if conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT i.id::text, f.license_number, i.inspection_date
                    FROM inspections i
                    JOIN facilities f ON f.id = i.facility_id
                    WHERE f.state_code = 'IL'
                    """
                )
                insp_index: dict[tuple[str, date], dict[str, Any]] = {}
                for iid, lic, idate in cur.fetchall():
                    insp_index[(lic, idate)] = {"id": iid, "facility_id": ""}
                # Also get facility_id
                cur.execute(
                    "SELECT id::text, license_number FROM facilities WHERE state_code='IL'"
                )
                fac_by_lic = {lic: fid for fid, lic in cur.fetchall()}
        else:
            insp_index = {}
            fac_by_lic = {}

        for row in rows:
            lic = re.sub(r"\D", "", str(row.get("license_number", ""))).zfill(8)
            raw_date = row.get("inspection_date", "").strip()
            pdf_url = row.get("pdf_url", "").strip()
            doc_type = row.get("doc_type", "inspection").strip() or "inspection"

            if not lic or not pdf_url:
                continue

            try:
                idate = date.fromisoformat(raw_date) if raw_date else None
            except ValueError:
                idate = None

            insp_id = None
            fac_id = fac_by_lic.get(lic)
            if idate:
                entry = insp_index.get((lic, idate))
                if entry:
                    insp_id = entry["id"]

            if not fac_id:
                print(f"  SKIP {lic} — not in DB", flush=True)
                err += 1
                continue

            if dry_run:
                print(f"  [dry-run] {lic} {idate} → {pdf_url[:80]}", flush=True)
                ok += 1
                continue

            upsert_inventory(
                conn, insp_id or "", fac_id, lic, pdf_url, idate, doc_type,
            )
            ok += 1

        if conn:
            conn.commit()

    finally:
        if conn:
            conn.close()

    print(f"\nDone. {ok} URLs registered, {err} skipped.", flush=True)


# ---------------------------------------------------------------------------
# Main scrape loop
# ---------------------------------------------------------------------------


def run_scrape(
    limit: int | None,
    smoke: bool,
    dry_run: bool,
) -> None:
    conn = None if dry_run else get_conn()
    try:
        if conn:
            inspections = load_pending_inspections(conn, limit=limit, smoke=smoke)
        else:
            print("  [dry-run] cannot load inspections without DB — showing probe output only")
            inspections = []

        print(f"  {len(inspections)} inspections to probe for PDFs.", flush=True)

        sess = make_session()
        found = not_found = 0

        for insp in inspections:
            lic = insp["license_number"]
            idate = insp["inspection_date"]
            if isinstance(idate, str):
                try:
                    idate = date.fromisoformat(idate[:10])
                except ValueError:
                    idate = None

            print(
                f"  → {lic} | {insp['name'][:40]:40s} | {idate} | {insp['inspection_type']}",
                flush=True,
            )

            if idate is None:
                not_found += 1
                continue

            pdf_url = _probe_survey_doc(sess, lic, idate)

            if pdf_url:
                print(f"    ✓ found: {pdf_url[:80]}", flush=True)
                if conn:
                    upsert_inventory(
                        conn,
                        insp["id"],
                        insp["facility_id"],
                        lic,
                        pdf_url,
                        idate,
                        doc_type="inspection",
                    )
                found += 1
            else:
                not_found += 1

            polite_sleep()

        if conn:
            conn.commit()

    finally:
        if conn:
            conn.close()

    print(
        f"\nDone. PDFs found: {found}, not found via HTTP: {not_found}.\n"
        "\nIf most PDFs were not found:\n"
        "  1. Open https://llcs.dph.illinois.gov/s/?language=en_US in a browser.\n"
        "  2. Navigate to a known facility + survey date and copy the PDF URL.\n"
        "  3. Build a CSV (license_number, inspection_date, pdf_url) and run:\n"
        "     python3 -u scrapers/il_llcs_event_scrape.py --mark-manual <path>",
        flush=True,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="IL LLCS event scrape — seed il_inspection_inventory")
    parser.add_argument("--dry-run", action="store_true", help="No DB writes")
    parser.add_argument("--limit", type=int, help="Max inspections to probe")
    parser.add_argument("--smoke", action="store_true", help="First 5 facilities only")
    parser.add_argument(
        "--mark-manual",
        metavar="CSV_PATH",
        help="Register manually discovered PDF URLs from CSV",
    )
    args = parser.parse_args()

    load_env()

    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    if args.mark_manual:
        p = Path(args.mark_manual)
        if not p.is_file():
            print(f"File not found: {p}", file=sys.stderr)
            sys.exit(1)
        run_mark_manual(p, dry_run=args.dry_run)
        return

    run_scrape(limit=args.limit, smoke=args.smoke, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
