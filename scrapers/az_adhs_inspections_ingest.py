#!/usr/bin/env python3
"""
Arizona ADHS Inspections Ingest — Phase 3 (BLOCKED — see note below)

INVESTIGATION OUTCOME (2026-06-15):
  ADHS does NOT have a publicly accessible inspection report portal for
  Assisted Living Homes (ALH) or Assisted Living Centers (ALC).

  - azcarecheck.azdhs.gov: covers Health Care Facilities (hospitals, SNFs, etc.)
    ONLY — ALH/ALC are NOT in the AZ Care Check database.
    Dropdown: Behavioral Group Home, Child Care, Community Health Workers,
    Funeral, Group Home DD, Health Care Facilities, Laser Tech, Marijuana,
    Memory Care Training Programs, Sober Living — NO Assisted Living.
  - hsapps.azdhs.gov/ls/sod/SearchProv.aspx?type=AL: decommissioned, redirects
    to azdhs.gov/licensing/index.php#azcarecheck (same for LTC type).
  - facility-licensing.azdhs.gov/s/: fully auth-walled (login required).
  - data.azdhs.gov: no ALF inspection dataset available via Socrata.

NEXT STEPS TO UNBLOCK:
  Option A — Public Records Request (recommended):
    Submit an Arizona public records request to ADHS BRL for all ALH/ALC
    inspection reports (Statement of Deficiencies) in the past 36 months.
    URL: https://app.azdhs.gov/ls/online_complaint/onlinecomplaint.aspx
    Contact: (602) 542-1025

  Option B — AHCCCS/ALTCS data:
    AZ Medicaid (ALTCS) contracts with some ALFs. AHCCCS may have published
    quality/inspection data for ALTCS-contracted facilities. Limited coverage.

  Option C — Periodic recheck:
    HB2764 (Memory Care subclass, eff. 2025-07-01) may trigger new public
    reporting. Recheck azcarecheck.azdhs.gov in Q3 2026 for ALF category.

Until inspection data is available, AZ facilities will remain publishable=False.
This complies with the YMYL mandate: do not publish facility profiles without
inspection data from the regulator.

--- original docstring preserved below for reference ---

AZ Care Check (azcarecheck.azdhs.gov) is a Salesforce Experience Cloud portal.
The REST API requires auth, but individual facility pages are accessible to the public
via a browser and the Salesforce document download endpoint is open:
  https://azcarecheck.azdhs.gov/sfc/servlet.shepherd/document/download/{SFDocumentId}

This script has two modes:

  MODE 1 — discover (Playwright required):
    Drives a headless browser through AZ Care Check facility search pages to
    collect Salesforce ContentDocument IDs for each FACID's inspection reports.
    Writes records to az_pdf_inventory (download_status='pending').

  MODE 2 — download (no browser required):
    Reads az_pdf_inventory rows with download_status='pending', downloads each
    PDF via the open Salesforce document endpoint, and updates the inventory.

  MODE 3 — parse + backfill:
    Reads downloaded PDFs (download_status='done', parse_status='pending'),
    extracts inspection date / deficiency counts / narrative using pdfplumber,
    and upserts into the inspections + deficiencies tables.

Usage:
    pip install playwright psycopg python-dotenv pdfplumber
    playwright install chromium

    # Phase 3a: collect document IDs for all AZ ALFs
    python3 -u scrapers/az_adhs_inspections_ingest.py --mode discover --state AZ --dry-run
    python3 -u scrapers/az_adhs_inspections_ingest.py --mode discover --state AZ

    # Phase 3b: download PDFs
    python3 -u scrapers/az_adhs_inspections_ingest.py --mode download --limit 100

    # Phase 3c: parse + backfill into inspections table
    python3 -u scrapers/az_adhs_inspections_ingest.py --mode parse --limit 50

PREREQUISITES:
  - Migration 0053_az_universe.sql must be applied (az_pdf_inventory table).
  - az_adhs_directory_ingest.py must have been run (facilities rows exist).
  - playwright install chromium
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import psycopg
import requests
import urllib3
from dotenv import load_dotenv

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

REPO_ROOT = Path(__file__).resolve().parent.parent
DOWNLOAD_DIR = REPO_ROOT / "data" / "az_pdfs"
AZCARECHECK_BASE = "https://azcarecheck.azdhs.gov"
DOC_DOWNLOAD_URL = f"{AZCARECHECK_BASE}/sfc/servlet.shepherd/document/download/"
SOURCE_AGENCY = "AZ-ADHS"


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def get_dsn() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    return url


# ---------------------------------------------------------------------------
# MODE 1: Discover — Playwright-based document ID collection
# ---------------------------------------------------------------------------


def discover_facility_documents(
    conn: psycopg.Connection,
    limit: int | None = None,
    dry_run: bool = False,
) -> None:
    """
    Use Playwright to visit each AZ Care Check facility page and collect
    Salesforce ContentDocument IDs for inspection reports.

    The AZ Care Check URL pattern for a facility detail page is:
      https://azcarecheck.azdhs.gov/s/facility-search?facilityId={ADHS_FacilityId}

    This function discovers that URL pattern, navigates to each facility's
    "Inspection History" section, and records all visible document download links.

    Requires: pip install playwright && playwright install chromium
    """
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
    except ImportError:
        print("ERROR: playwright not installed. Run: pip install playwright && playwright install chromium", file=sys.stderr)
        sys.exit(1)

    # Get facilities without any pending/done inventory entries
    with conn.cursor() as cur:
        cur.execute("""
            SELECT f.id, f.external_id, f.name, f.city
            FROM facilities f
            WHERE f.state_code = 'AZ'
              AND f.external_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM az_pdf_inventory p WHERE p.facility_id = f.id
              )
            ORDER BY f.city, f.name
            LIMIT %s
        """, (limit,))
        facilities = cur.fetchall()

    print(f"Discovering inspection documents for {len(facilities)} AZ facilities …", flush=True)
    if dry_run:
        print("DRY RUN — would navigate to AZ Care Check for each facility. No DB writes.")
        for row in facilities[:5]:
            print(f"  {row[1]:12s} {row[2][:40]:40s} {row[3]}")
        return

    total_docs = 0
    errors = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            ),
            ignore_https_errors=True,
        )
        page = ctx.new_page()

        for fac_id, facid, name, city in facilities:
            try:
                docs = _scrape_facility_docs(page, fac_id, facid, name)
                if docs:
                    _insert_inventory_rows(conn, fac_id, facid, docs, dry_run=False)
                    total_docs += len(docs)
                    print(f"  {facid:12s} {name[:35]:35s} → {len(docs)} docs", flush=True)
                else:
                    print(f"  {facid:12s} {name[:35]:35s} → 0 docs (no inspections found)", flush=True)
                time.sleep(1.5)
            except PWTimeout:
                print(f"  {facid:12s} TIMEOUT — skipping", flush=True)
                errors += 1
            except Exception as exc:
                print(f"  {facid:12s} ERROR: {exc}", flush=True)
                errors += 1

        browser.close()

    conn.commit()
    print(f"\nDiscovery done. {total_docs} documents inventoried, {errors} errors.", flush=True)


def _scrape_facility_docs(
    page: Any,
    facility_id: UUID,
    facid: str,
    name: str,
) -> list[dict[str, Any]]:
    """
    Navigate to a facility's AZ Care Check page and extract document IDs.

    Returns a list of dicts: {sf_document_id, source_url, doc_type, inspection_date}
    """
    # AZ Care Check search URL — navigate and search by facility ID / name
    search_url = f"{AZCARECHECK_BASE}/s/"
    page.goto(search_url, wait_until="networkidle", timeout=30000)

    # Wait for the search input to appear
    # AZ Care Check uses a Salesforce LWC search component — selector may vary
    try:
        page.wait_for_selector("input[placeholder*='search' i], input[placeholder*='facility' i]",
                               timeout=8000)
    except Exception:
        pass  # Continue even if search box not found — try direct URL

    # Try to navigate to the facility's detail page using their search
    # First try to find a URL pattern by inspecting network requests
    docs: list[dict] = []

    # Intercept network responses to capture Salesforce document requests
    captured_doc_ids: set[str] = set()

    def _handle_response(response: Any) -> None:
        url = response.url
        # Capture any Salesforce document references in network traffic
        m = re.search(r'/sfc/servlet\.shepherd/document/download/([A-Za-z0-9]{15,18})', url)
        if m:
            captured_doc_ids.add(m.group(1))
        # Also check API responses for document IDs
        if "aura" in url and response.status == 200:
            try:
                body = response.text()
                # Find 18-char Salesforce IDs that look like ContentDocument IDs
                # ContentDocument IDs typically start with '069' (ContentDocument) or '068' (ContentVersion)
                sf_ids = re.findall(r'\b(069[A-Za-z0-9]{15}|068[A-Za-z0-9]{15})\b', body)
                captured_doc_ids.update(sf_ids)
            except Exception:
                pass

    page.on("response", _handle_response)

    # Try direct facility URL patterns
    # The facility's AZ Care Check page may use the FACID or a Salesforce record ID
    # Common pattern: /s/provider-details?id={recordId} or /s/search-results?facilityId=AL12963
    direct_urls = [
        f"{AZCARECHECK_BASE}/s/provider-details?facilityid={facid}",
        f"{AZCARECHECK_BASE}/s/facility-search?query={facid}",
        f"{AZCARECHECK_BASE}/s/search?q={facid}",
    ]
    for url in direct_urls:
        page.goto(url, wait_until="networkidle", timeout=20000)
        time.sleep(2)
        # Look for visible PDF download links or inspection table rows
        pdf_links = page.query_selector_all("a[href*='document/download']")
        for link in pdf_links:
            href = link.get_attribute("href") or ""
            m = re.search(r'/document/download/([A-Za-z0-9]{15,18})', href)
            if m:
                captured_doc_ids.add(m.group(1))

    # Convert captured IDs to inventory rows
    for doc_id in captured_doc_ids:
        docs.append({
            "sf_document_id": doc_id,
            "source_url": f"{DOC_DOWNLOAD_URL}{doc_id}",
            "doc_type": "inspection",
            "inspection_date": None,
        })

    return docs


def _insert_inventory_rows(
    conn: psycopg.Connection,
    facility_id: UUID,
    facid: str,
    docs: list[dict[str, Any]],
    dry_run: bool,
) -> None:
    if dry_run or not docs:
        return
    with conn.cursor() as cur:
        for doc in docs:
            sp = f"sp_{re.sub(r'[^a-z0-9]', '_', doc['sf_document_id'].lower())}"
            try:
                cur.execute(f"SAVEPOINT {sp}")
                cur.execute("""
                    INSERT INTO az_pdf_inventory
                      (facility_id, facid, sf_document_id, source_url, doc_type, inspection_date)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (source_url) DO NOTHING
                """, (
                    facility_id, facid, doc["sf_document_id"], doc["source_url"],
                    doc["doc_type"], doc["inspection_date"],
                ))
                cur.execute(f"RELEASE SAVEPOINT {sp}")
            except Exception as exc:
                cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                print(f"  INSERT error {doc['sf_document_id']}: {exc}", flush=True)


# ---------------------------------------------------------------------------
# MODE 2: Download PDFs
# ---------------------------------------------------------------------------


def download_pdfs(
    conn: psycopg.Connection,
    limit: int = 50,
    dry_run: bool = False,
) -> None:
    """Download pending PDFs from az_pdf_inventory."""
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, facility_id, facid, sf_document_id, source_url
            FROM az_pdf_inventory
            WHERE download_status = 'pending'
            ORDER BY created_at
            LIMIT %s
        """, (limit,))
        rows = cur.fetchall()

    print(f"Downloading {len(rows)} pending PDFs …", flush=True)
    if dry_run:
        print(f"DRY RUN — would download {len(rows)} files. No writes.")
        return

    sess = requests.Session()
    sess.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh) Chrome/124",
        "Accept": "application/pdf,application/octet-stream,*/*",
        "Referer": f"{AZCARECHECK_BASE}/s/",
    })

    done = 0
    errors = 0
    for inv_id, facility_id, facid, sf_doc_id, source_url in rows:
        local_path = DOWNLOAD_DIR / f"{facid}_{sf_doc_id}.pdf"
        try:
            r = sess.get(source_url, timeout=30, verify=False, stream=True)
            if r.status_code == 200:
                ct = r.headers.get("Content-Type", "")
                if "pdf" not in ct.lower() and "octet" not in ct.lower():
                    # Not a PDF — likely an HTML auth redirect
                    _update_inventory(conn, inv_id, "error",
                                      error=f"Unexpected content-type: {ct[:80]}")
                    errors += 1
                    continue
                content = b"".join(r.iter_content(65536))
                local_path.write_bytes(content)
                sha = hashlib.sha256(content).hexdigest()
                _update_inventory(conn, inv_id, "done",
                                  local_path=str(local_path),
                                  sha256=sha,
                                  size_bytes=len(content))
                print(f"  ✓ {facid} {sf_doc_id} → {len(content)//1024}KB", flush=True)
                done += 1
            elif r.status_code in (401, 403):
                _update_inventory(conn, inv_id, "error",
                                  error=f"Auth required: {r.status_code}")
                print(f"  ✗ {facid} {sf_doc_id} — AUTH WALL ({r.status_code})", flush=True)
                errors += 1
            else:
                _update_inventory(conn, inv_id, "error",
                                  error=f"HTTP {r.status_code}")
                errors += 1
        except Exception as exc:
            _update_inventory(conn, inv_id, "error", error=str(exc)[:200])
            print(f"  ERROR {facid} {sf_doc_id}: {exc}", flush=True)
            errors += 1
        time.sleep(0.5)

    conn.commit()
    print(f"\nDownload done. done={done} errors={errors}", flush=True)


def _update_inventory(
    conn: psycopg.Connection,
    inv_id: str,
    status: str,
    error: str | None = None,
    local_path: str | None = None,
    sha256: str | None = None,
    size_bytes: int | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE az_pdf_inventory
            SET download_status = %s,
                download_error  = %s,
                local_path      = COALESCE(%s, local_path),
                sha256          = COALESCE(%s, sha256),
                size_bytes      = COALESCE(%s, size_bytes),
                downloaded_at   = CASE WHEN %s = 'done' THEN now() ELSE downloaded_at END,
                updated_at      = now()
            WHERE id = %s
        """, (status, error, local_path, sha256, size_bytes, status, inv_id))


# ---------------------------------------------------------------------------
# MODE 3: Parse PDFs → inspections table
# ---------------------------------------------------------------------------


def parse_and_backfill(
    conn: psycopg.Connection,
    limit: int = 20,
    dry_run: bool = False,
) -> None:
    """
    Parse downloaded AZ inspection PDFs and upsert into the inspections table.

    ADHS inspection reports follow a standard form. Key fields to extract:
    - Facility name, FACID, inspection date
    - Inspector name
    - Deficiency count and citations (A.A.C. rule references)
    - Plan of correction dates

    This is a scaffold — adapt the parse logic once PDF samples are available.
    """
    try:
        import pdfplumber
    except ImportError:
        print("ERROR: pdfplumber not installed. Run: pip install pdfplumber", file=sys.stderr)
        sys.exit(1)

    with conn.cursor() as cur:
        cur.execute("""
            SELECT p.id, p.facility_id, p.facid, p.local_path, p.sf_document_id
            FROM az_pdf_inventory p
            WHERE p.download_status = 'done'
              AND p.parse_status = 'pending'
              AND p.local_path IS NOT NULL
            ORDER BY p.created_at
            LIMIT %s
        """, (limit,))
        rows = cur.fetchall()

    print(f"Parsing {len(rows)} downloaded PDFs …", flush=True)
    if dry_run:
        print(f"DRY RUN — would parse {len(rows)} PDFs. No writes.")
        return

    done = 0
    errors = 0
    for inv_id, facility_id, facid, local_path, sf_doc_id in rows:
        path = Path(local_path)
        if not path.is_file():
            _update_parse_status(conn, inv_id, "error", f"File not found: {local_path}")
            errors += 1
            continue
        try:
            parsed = _parse_adhs_inspection_pdf(path)
            if parsed:
                _upsert_inspection(conn, facility_id, facid, inv_id, parsed)
                done += 1
                _update_parse_status(conn, inv_id, "done")
                print(f"  ✓ {facid} date={parsed.get('inspection_date')} deficiencies={parsed.get('deficiency_count')}", flush=True)
            else:
                _update_parse_status(conn, inv_id, "error", "Could not extract inspection date")
                errors += 1
        except Exception as exc:
            _update_parse_status(conn, inv_id, "error", str(exc)[:200])
            print(f"  ERROR {facid}: {exc}", flush=True)
            errors += 1

    conn.commit()
    print(f"\nParse done. done={done} errors={errors}", flush=True)


def _parse_adhs_inspection_pdf(path: Path) -> dict[str, Any] | None:
    """
    Extract structured data from an ADHS inspection report PDF.

    ADHS Standard Inspection Report structure (typical):
      - Header: facility name, license number, inspection date, inspector
      - Deficiency table: TAG (A.A.C. rule), severity, narrative
      - Plan of Correction section

    Returns None if inspection date cannot be extracted.
    """
    import pdfplumber

    with pdfplumber.open(path) as pdf:
        full_text = "\n".join(
            page.extract_text() or "" for page in pdf.pages[:5]
        )

    # Extract inspection date — common formats in ADHS reports
    insp_date: date | None = None
    for pattern in [
        r"Inspection\s+Date\s*[:\-]\s*(\d{1,2}/\d{1,2}/\d{4})",
        r"Date\s+of\s+Inspection\s*[:\-]\s*(\d{1,2}/\d{1,2}/\d{4})",
        r"Survey\s+Date\s*[:\-]\s*(\d{1,2}/\d{1,2}/\d{4})",
        r"(\d{1,2}/\d{1,2}/\d{4})",  # fallback: first date in document
    ]:
        m = re.search(pattern, full_text, re.IGNORECASE)
        if m:
            try:
                insp_date = datetime.strptime(m.group(1), "%m/%d/%Y").date()
                break
            except ValueError:
                continue

    if insp_date is None:
        return None

    # Count deficiencies — lines that start with a rule reference (e.g. "R9-10-814")
    # or contain "DEFICIENCY" header
    deficiency_count = len(re.findall(
        r'\bR\d+-\d+-\d+\b|\bA\.A\.C\.\s+§?\s*\d+-\d+-\d+',
        full_text,
        re.IGNORECASE,
    ))

    # Inspector name — "Inspector: John Doe" or "Surveyor: ..."
    inspector_match = re.search(
        r'(?:Inspector|Surveyor|Surveyed\s+by)\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        full_text,
    )
    inspector_name = inspector_match.group(1) if inspector_match else None

    # Inspection type
    is_complaint = bool(re.search(r'\bcomplaint\b', full_text, re.IGNORECASE))
    is_followup = bool(re.search(r'\b(follow.?up|revisit|correction)\b', full_text, re.IGNORECASE))
    is_annual = bool(re.search(r'\b(annual|standard|routine)\b', full_text, re.IGNORECASE))

    return {
        "inspection_date": insp_date,
        "deficiency_count": deficiency_count,
        "inspector_name": inspector_name,
        "is_complaint": is_complaint,
        "is_followup": is_followup,
        "is_annual": is_annual,
        "raw_text_excerpt": full_text[:500],
    }


def _upsert_inspection(
    conn: psycopg.Connection,
    facility_id: str,
    facid: str,
    inv_id: str,
    parsed: dict[str, Any],
) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO inspections (
                facility_id, inspection_date, source_agency,
                is_complaint, is_followup, is_annual,
                deficiency_count
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (facility_id, inspection_date, source_agency) DO UPDATE SET
                is_complaint     = EXCLUDED.is_complaint,
                is_followup      = EXCLUDED.is_followup,
                is_annual        = EXCLUDED.is_annual,
                deficiency_count = EXCLUDED.deficiency_count,
                updated_at       = now()
            RETURNING id
        """, (
            facility_id,
            parsed["inspection_date"],
            SOURCE_AGENCY,
            parsed["is_complaint"],
            parsed["is_followup"],
            parsed["is_annual"],
            parsed["deficiency_count"],
        ))
        insp_id = cur.fetchone()[0] if cur.rowcount else None

        if insp_id:
            cur.execute("""
                UPDATE az_pdf_inventory
                SET inspection_id   = %s,
                    inspection_date = %s,
                    backfill_status = 'done',
                    backfilled_at   = now(),
                    updated_at      = now()
                WHERE id = %s
            """, (insp_id, parsed["inspection_date"], inv_id))


def _update_parse_status(
    conn: psycopg.Connection,
    inv_id: str,
    status: str,
    error: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE az_pdf_inventory
            SET parse_status = %s,
                parse_error  = %s,
                parsed_at    = CASE WHEN %s = 'done' THEN now() ELSE parsed_at END,
                updated_at   = now()
            WHERE id = %s
        """, (status, error, status, inv_id))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="AZ ADHS inspection ingest — discover / download / parse PDF pipeline"
    )
    parser.add_argument("--mode", choices=["discover", "download", "parse"],
                        default="discover",
                        help="discover=collect doc IDs, download=pull PDFs, parse=extract+backfill")
    parser.add_argument("--limit", type=int, default=100,
                        help="Max facilities/PDFs to process (default: 100)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would happen, no DB or file writes")
    args = parser.parse_args()

    load_env()
    dsn = get_dsn()

    with psycopg.connect(dsn) as conn:
        if args.mode == "discover":
            print("MODE: discover (Playwright → az_pdf_inventory)", flush=True)
            discover_facility_documents(conn, limit=args.limit, dry_run=args.dry_run)
        elif args.mode == "download":
            print("MODE: download (az_pdf_inventory pending → local PDFs)", flush=True)
            download_pdfs(conn, limit=args.limit, dry_run=args.dry_run)
        elif args.mode == "parse":
            print("MODE: parse (local PDFs → inspections table)", flush=True)
            parse_and_backfill(conn, limit=args.limit, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
