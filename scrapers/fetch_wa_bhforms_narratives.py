#!/usr/bin/env python3
"""
fetch_wa_bhforms_narratives.py — Resolve DSHS BHForms.aspx lookup pages to
actual inspection/investigation PDF links, download them, extract text, and
write narratives back to the inspections table.

Targets the 372 WA publishable inspections whose source_url is a DSHS facility
lookup page (fortress.wa.gov/dshs/adsaapps/lookup/BHForms.aspx?Lic=XXXXX)
rather than a direct PDF link.

Steps per facility:
  1. Fetch BHForms.aspx page (plain HTML, no JS required)
  2. Extract all .pdf hrefs, skip fire-inspection and generic-form PDFs
  3. For each relevant PDF, parse the date from the filename
  4. Match to a DB inspection row within ±60 days of that date
  5. Download PDF, extract text with pdfplumber
  6. Write narrative to raw_data->'narrative'

Usage:
    python3 scrapers/fetch_wa_bhforms_narratives.py
    python3 scrapers/fetch_wa_bhforms_narratives.py --limit 10
    python3 scrapers/fetch_wa_bhforms_narratives.py --dry-run
    python3 scrapers/fetch_wa_bhforms_narratives.py --smoke   (first 5 facilities)
"""

from __future__ import annotations

import argparse
import io
import os
import re
import time
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urljoin, unquote

import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env.local")

DATABASE_URL = os.environ["DATABASE_URL"]

BASE_URL = "https://fortress.wa.gov"

# Skip these PDF path segments — fire inspections and generic DSHS forms
SKIP_PATH_FRAGMENTS = [
    "fire inspection",
    "fire%20inspection",
    "dshs.wa.gov/sites/default/files",  # generic DSH forms
]

# Regex patterns to extract a date from PDF filenames
# Matches: 01-29-2024, 12-17-2025, 6-24-2025 etc.
DATE_PATTERNS = [
    re.compile(r"(\d{1,2})-(\d{1,2})-(\d{4})"),   # M-D-YYYY
    re.compile(r"(\d{4})-(\d{1,2})-(\d{1,2})"),   # YYYY-M-D
]

MATCH_WINDOW_DAYS = 180  # match inspection within ±180 days of PDF date (wider for case-number-only filenames)


# ── PDF extraction ─────────────────────────────────────────────────────────────

def _ensure_pdfplumber() -> None:
    try:
        import pdfplumber  # noqa: F401
    except ImportError:
        import subprocess, sys
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pdfplumber", "--quiet"])


def extract_text(pdf_bytes: bytes) -> str:
    import pdfplumber
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        pages = []
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                pages.append(t)
    text = "\n\n".join(pages)
    # Strip NUL bytes (PostgreSQL rejects them)
    text = text.replace("\x00", "")
    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── HTTP helpers ───────────────────────────────────────────────────────────────

def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": "https://fortress.wa.gov/dshs/adsaapps/lookup/BHPubResults.aspx",
    })
    return s


def fetch_html(session: requests.Session, url: str) -> str | None:
    try:
        r = session.get(url, timeout=20)
        if r.status_code != 200:
            print(f"    HTTP {r.status_code} fetching {url}")
            return None
        return r.text
    except Exception as e:
        print(f"    Error fetching {url}: {e}")
        return None


def download_pdf(session: requests.Session, url: str) -> bytes | None:
    try:
        r = session.get(url, timeout=30)
        if r.status_code != 200:
            return None
        ct = r.headers.get("Content-Type", "")
        if "pdf" not in ct.lower() and len(r.content) < 1000:
            return None
        return r.content
    except Exception as e:
        print(f"      PDF download error: {e}")
        return None


# ── PDF link extraction ────────────────────────────────────────────────────────

def extract_pdf_links(html: str, page_url: str) -> list[str]:
    """Return absolute PDF URLs from a BHForms page, skipping fire/generic PDFs."""
    raw_hrefs = re.findall(r'href=["\']([^"\']*\.pdf[^"\']*)["\']', html, re.IGNORECASE)
    results = []
    for href in raw_hrefs:
        decoded = unquote(href).lower()
        if any(frag in decoded for frag in SKIP_PATH_FRAGMENTS):
            continue
        abs_url = urljoin(BASE_URL, href) if not href.startswith("http") else href
        results.append(abs_url)
    return results


# ── Date extraction from filename ─────────────────────────────────────────────

def parse_date_from_url(url: str) -> date | None:
    """Try to extract a date from the PDF URL. Falls back to year-only from folder path."""
    decoded = unquote(url)
    filename = decoded.split("/")[-1]

    # Try exact date from filename first
    for pat in DATE_PATTERNS:
        m = pat.search(filename)
        if not m:
            continue
        g = m.groups()
        try:
            if len(g[0]) == 4:          # YYYY-M-D
                return date(int(g[0]), int(g[1]), int(g[2]))
            else:                        # M-D-YYYY
                return date(int(g[2]), int(g[0]), int(g[1]))
        except ValueError:
            continue

    # Fallback: extract year from folder path (e.g. .../investigations/2024/...)
    year_m = re.search(r"/(20\d{2})/", decoded)
    if year_m:
        try:
            return date(int(year_m.group(1)), 7, 1)  # mid-year placeholder
        except ValueError:
            pass

    return None


# ── DB helpers ─────────────────────────────────────────────────────────────────

FETCH_SQL = """
SELECT
    i.id::text,
    i.inspection_date,
    i.inspection_type,
    f.name AS facility_name,
    f.id::text AS facility_id
FROM inspections i
JOIN facilities f ON f.id = i.facility_id
WHERE f.state_code = 'WA'
  AND f.publishable = true
  AND i.source_url = %(lookup_url)s
  AND (i.raw_data->>'narrative' IS NULL OR char_length(i.raw_data->>'narrative') < 100)
ORDER BY i.inspection_date DESC
"""

UPDATE_SQL = """
UPDATE inspections
SET
    raw_data = raw_data || jsonb_build_object('narrative', %(narrative)s::text,
                                               'pdf_resolved_url', %(pdf_url)s::text),
    source_url = %(pdf_url)s
WHERE id = %(id)s::uuid
"""


def fetch_pending(conn: psycopg.Connection) -> list[dict]:
    """Return all distinct BHForms lookup URLs + their pending inspection rows."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT i.source_url
            FROM inspections i
            JOIN facilities f ON f.id = i.facility_id
            WHERE f.state_code = 'WA'
              AND f.publishable = true
              AND i.source_url LIKE '%BHForms%'
              AND (i.raw_data->>'narrative' IS NULL OR char_length(i.raw_data->>'narrative') < 100)
            ORDER BY i.source_url
        """)
        return [r[0] for r in cur.fetchall()]


def fetch_rows_for_url(conn: psycopg.Connection, lookup_url: str) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(FETCH_SQL, {"lookup_url": lookup_url})
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def update_narrative(conn: psycopg.Connection, insp_id: str, narrative: str, pdf_url: str) -> None:
    with conn.cursor() as cur:
        cur.execute(UPDATE_SQL, {"narrative": narrative, "id": insp_id, "pdf_url": pdf_url})
    conn.commit()


# ── Matching logic ─────────────────────────────────────────────────────────────

def best_match(pdf_date: date | None, rows: list[dict]) -> dict | None:
    """Match a PDF to the closest inspection row within MATCH_WINDOW_DAYS."""
    if pdf_date is None or not rows:
        return None
    window = timedelta(days=MATCH_WINDOW_DAYS)
    candidates = [
        (abs((r["inspection_date"] - pdf_date).days), r)
        for r in rows
        if abs((r["inspection_date"] - pdf_date).days) <= MATCH_WINDOW_DAYS
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0])
    return candidates[0][1]


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Resolve WA BHForms lookup pages → PDFs → narratives")
    parser.add_argument("--dry-run", action="store_true", help="Extract but do NOT write to DB")
    parser.add_argument("--limit", type=int, default=None, help="Max number of lookup pages to process")
    parser.add_argument("--smoke", action="store_true", help="Process first 5 lookup pages only")
    args = parser.parse_args()

    if args.smoke:
        args.limit = 5

    _ensure_pdfplumber()
    session = make_session()

    with psycopg.connect(DATABASE_URL) as conn:
        lookup_urls = fetch_pending(conn)

    total_urls = len(lookup_urls)
    if args.limit:
        lookup_urls = lookup_urls[: args.limit]

    print(f"Lookup pages to process: {len(lookup_urls)} of {total_urls} pending")
    if not lookup_urls:
        print("Nothing to do.")
        return

    stats = {"pdfs_found": 0, "matched": 0, "extracted": 0, "updated": 0, "skipped_short": 0, "no_match": 0}

    with psycopg.connect(DATABASE_URL) as conn:
        for idx, lookup_url in enumerate(lookup_urls, start=1):
            lic = lookup_url.split("Lic=")[-1]
            print(f"\n[{idx}/{len(lookup_urls)}] Lic={lic}")

            # Step 1: fetch lookup page
            html = fetch_html(session, lookup_url)
            if not html:
                print("  → SKIP (fetch failed)")
                time.sleep(1.0)
                continue
            time.sleep(0.5)

            # Step 2: get pending DB rows for this lookup URL
            rows = fetch_rows_for_url(conn, lookup_url)
            if not rows:
                print("  → SKIP (no pending rows)")
                continue

            fac_name = rows[0]["facility_name"]
            print(f"  Facility: {fac_name}  ({len(rows)} pending inspection rows)")

            # Step 3: extract PDF links (skip fire/generic)
            pdf_links = extract_pdf_links(html, lookup_url)
            stats["pdfs_found"] += len(pdf_links)
            print(f"  PDFs found (non-fire): {len(pdf_links)}")

            if not pdf_links:
                print("  → No relevant PDFs on page")
                continue

            # Step 4: for each PDF, match to a DB row and extract
            matched_ids: set[str] = set()
            for pdf_url in pdf_links:
                pdf_date = parse_date_from_url(pdf_url)
                filename = unquote(pdf_url.split("/")[-1])[:60]
                print(f"    PDF: {filename}  date={pdf_date}")

                row = best_match(pdf_date, [r for r in rows if r["id"] not in matched_ids])
                if row is None:
                    print(f"      → No DB match within {MATCH_WINDOW_DAYS}d")
                    stats["no_match"] += 1
                    continue

                stats["matched"] += 1
                matched_ids.add(row["id"])
                print(f"      → Matched: {row['inspection_date']} {row['inspection_type']}")

                # Download PDF
                pdf_bytes = download_pdf(session, pdf_url)
                time.sleep(0.5)
                if not pdf_bytes:
                    print(f"      → Download failed")
                    continue

                # Extract text
                try:
                    text = extract_text(pdf_bytes)
                except Exception as e:
                    print(f"      → Extraction error: {e}")
                    continue

                stats["extracted"] += 1
                if len(text) < 50:
                    print(f"      → Too short ({len(text)} chars) — likely image PDF")
                    stats["skipped_short"] += 1
                    continue

                print(f"      → {len(text):,} chars extracted")

                if not args.dry_run:
                    update_narrative(conn, row["id"], text, pdf_url)
                    stats["updated"] += 1
                    print(f"      → DB updated")
                else:
                    print(f"      → DRY RUN — not writing")

            time.sleep(1.0)

    print()
    print("=== Done ===")
    print(f"  Lookup pages:    {len(lookup_urls)}")
    print(f"  PDFs found:      {stats['pdfs_found']}")
    print(f"  DB matches:      {stats['matched']}")
    print(f"  Text extracted:  {stats['extracted']}")
    print(f"  DB updated:      {stats['updated']}")
    print(f"  Too short (OCR?): {stats['skipped_short']}")
    print(f"  No date match:   {stats['no_match']}")


if __name__ == "__main__":
    main()
