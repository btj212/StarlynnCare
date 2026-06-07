#!/usr/bin/env python3
"""
fetch_wa_pdf_narratives.py — Download WA DSHS inspection PDFs and extract narrative text.

WA inspection records have placeholder narratives ("—: WA DSHS report: Inspections (MM/YYYY)").
PDF URLs are stored in deficiencies.inspector_narrative. This script:
  1. Finds WA inspections whose raw_data->>'narrative' is still a placeholder
  2. Collects all PDF URLs from that inspection's deficiency rows
  3. Downloads each PDF and extracts text with pdfplumber
  4. Concatenates the text and writes it back to raw_data->'narrative'

Usage:
    python3 scrapers/fetch_wa_pdf_narratives.py
    python3 scrapers/fetch_wa_pdf_narratives.py --limit 5

Requires:
    DATABASE_URL in .env.local
    pdfplumber — installed automatically if missing
"""

from __future__ import annotations

import argparse
import io
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env.local")

DATABASE_URL = os.environ.get("DATABASE_URL", "")

WA_BASE = "https://fortress.wa.gov"

# ---------------------------------------------------------------------------
# PDF library bootstrap
# ---------------------------------------------------------------------------

def _ensure_pdf_lib() -> str:
    """Return 'pdfplumber' or 'pypdf', installing pdfplumber if neither present."""
    try:
        import pdfplumber  # noqa: F401
        return "pdfplumber"
    except ImportError:
        pass
    try:
        import pypdf  # noqa: F401
        return "pypdf"
    except ImportError:
        pass
    print("Neither pdfplumber nor pypdf found — installing pdfplumber…")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "pdfplumber", "--quiet"],
        stdout=subprocess.DEVNULL,
    )
    try:
        import pdfplumber  # noqa: F401
        print("pdfplumber installed OK.")
        return "pdfplumber"
    except ImportError:
        print("ERROR: pdfplumber install failed. Run: pip3 install pdfplumber requests")
        sys.exit(1)


def extract_text_pdfplumber(data: bytes) -> str:
    import pdfplumber
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        pages = []
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                pages.append(t)
        return "\n\n".join(pages)


def extract_text_pypdf(data: bytes) -> str:
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(data))
    pages = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            pages.append(t)
    return "\n\n".join(pages)


# ---------------------------------------------------------------------------
# Text cleaning
# ---------------------------------------------------------------------------

_WA_HEADER_NOISE_RE = re.compile(
    r"(?m)^"
    r"(?:"
    r"Washington State Department of Social.*?$|"
    r"Aging and Long.Term Support Administration.*?$|"
    r"Residential Care Services.*?$|"
    r"P\.?O\.? Box.*?$|"
    r"\d{3}[-.\s]\d{3}[-.\s]\d{4}.*?$|"  # phone numbers
    r"Fax:.*?$|"
    r"TTY:.*?$|"
    r"www\.dshs\.wa\.gov.*?$|"
    r"fortress\.wa\.gov.*?$|"
    r"Page \d+ of \d+.*?$|"
    r"RCS \d+.*?$"
    r")"
)

# Boilerplate placeholder text used for PDFs with no findings yet published
_PLACEHOLDER_RE = re.compile(
    r"This\s+document\s+was\s+prepared\s+by\s+Residential\s+Care\s+Services\s+"
    r"for\s+the\s+Locator\s+website",
    re.IGNORECASE,
)

_EXCESS_WHITESPACE_RE = re.compile(r"\n{3,}")


def _clean_text(raw: str) -> str:
    """Strip boilerplate lines, NUL bytes, and normalize whitespace."""
    text = raw.replace("\x00", "")  # PostgreSQL rejects NUL bytes
    text = _PLACEHOLDER_RE.sub("", text)
    text = _WA_HEADER_NOISE_RE.sub("", text)
    text = _EXCESS_WHITESPACE_RE.sub("\n\n", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Section-aware extraction
# ---------------------------------------------------------------------------

_INVESTIGATION_SECTIONS = [
    "Nature of Investigation",
    "Summary of Investigation",
    "Initial Investigation Allegation",
    "Allegations",
    "Finding",
    "Findings",
    "Conclusion",
    "Maltreatment Determination",
    "Licensing Violation",
    "Corrective Action",
]

_INSPECTION_SECTIONS = [
    "Statement of Deficiencies",
    "Deficiency",
    "Citation",
    "Plan of Correction",
    "Summary of Findings",
    "Correction Order",
    "Survey Date",
    "Inspection Findings",
]


def _extract_sections(text: str, section_names: list[str]) -> str:
    """Pull text from the first recognized section header. Falls back to full text."""
    pattern = "|".join(re.escape(s) for s in section_names)
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        return text[m.start():]
    return text


def _trim_to_word_budget(text: str, max_words: int = 1400) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    cut = " ".join(words[:max_words])
    last_end = max(cut.rfind("."), cut.rfind("!"), cut.rfind("?"))
    if last_end > len(cut) * 0.6:
        return cut[: last_end + 1].strip()
    return cut.strip()


def process_pdf(data: bytes, report_url: str, lib: str) -> str:
    """Extract and clean narrative text from PDF bytes."""
    if lib == "pdfplumber":
        raw = extract_text_pdfplumber(data)
    else:
        raw = extract_text_pypdf(data)

    if not raw or len(raw.strip()) < 50:
        return ""

    cleaned = _clean_text(raw)

    url_lower = report_url.lower()
    is_investigation = "investigation" in url_lower or "complaint" in url_lower
    sections = _INVESTIGATION_SECTIONS if is_investigation else _INSPECTION_SECTIONS
    narrative = _extract_sections(cleaned, sections)
    narrative = _trim_to_word_budget(narrative)
    return narrative.strip()


# ---------------------------------------------------------------------------
# DB queries
# ---------------------------------------------------------------------------

# Fetch WA inspections that still have a placeholder narrative,
# plus all their PDF URLs from associated deficiency rows.
FETCH_SQL = """
SELECT
    i.id::text                   AS id,
    i.inspection_date,
    i.inspection_type,
    f.name                       AS facility_name,
    array_agg(
        d.inspector_narrative
        ORDER BY d.inspector_narrative
    ) FILTER (
        WHERE d.inspector_narrative ILIKE %s
    )                            AS pdf_urls
FROM inspections i
JOIN facilities f ON f.id = i.facility_id
JOIN deficiencies d ON d.inspection_id = i.id
WHERE f.state_code = 'WA'
  AND (
      i.raw_data->>'narrative' IS NULL
      OR i.raw_data->>'narrative' = ''
      OR i.raw_data->>'narrative' ILIKE '—:%%'
  )
GROUP BY i.id, i.inspection_date, i.inspection_type, f.name
HAVING array_length(
    array_agg(d.inspector_narrative) FILTER (
        WHERE d.inspector_narrative ILIKE %s
    ),
    1
) > 0
ORDER BY i.inspection_date DESC
"""

UPDATE_SQL = """
UPDATE inspections
SET raw_data = raw_data || jsonb_build_object('narrative', %(narrative)s::text)
WHERE id = %(id)s::uuid
"""


def fetch_rows(
    conn: psycopg.Connection,
    limit: int | None,
) -> list[dict[str, Any]]:
    sql = FETCH_SQL
    if limit:
        sql += f" LIMIT {int(limit)}"
    with conn.cursor() as cur:
        cur.execute(sql, ("%.pdf%", "%.pdf%"))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def update_narrative(
    conn: psycopg.Connection,
    insp_id: str,
    narrative: str,
) -> None:
    with conn.cursor() as cur:
        cur.execute(UPDATE_SQL, {"narrative": narrative, "id": insp_id})
    conn.commit()


# ---------------------------------------------------------------------------
# HTTP download
# ---------------------------------------------------------------------------

def make_session() -> Any:
    import requests
    s = requests.Session()
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "application/pdf,application/octet-stream,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://fortress.wa.gov/dshs/adsaapps/lookup/",
    })
    return s


def download_pdf(session: Any, url: str, timeout: int = 30) -> bytes | None:
    """Download a PDF. Returns bytes on success, None on error."""
    import requests
    # URLs may have unencoded spaces — requests handles this via PreparedRequest
    try:
        r = session.get(url, timeout=timeout, allow_redirects=True)
        if r.status_code == 404:
            print(f"      404 — {url}")
            return None
        if r.status_code != 200:
            print(f"      HTTP {r.status_code} — {url}")
            return None
        ct = r.headers.get("Content-Type", "")
        if "pdf" not in ct.lower() and len(r.content) < 100:
            print(f"      Unexpected content-type '{ct}' or empty body — {url}")
            return None
        return r.content
    except requests.exceptions.SSLError as e:
        print(f"      SSL error: {e}")
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"      Connection error: {e}")
        return None
    except requests.exceptions.Timeout:
        print(f"      Timeout — {url}")
        return None
    except Exception as e:
        print(f"      Download error: {e}")
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch WA DSHS inspection PDF narratives"
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Process only the first N inspection records"
    )
    args = parser.parse_args()

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    lib = _ensure_pdf_lib()
    print(f"PDF library: {lib}")

    import requests  # noqa: F401 — ensure requests is available

    session = make_session()

    with psycopg.connect(DATABASE_URL) as conn:
        rows = fetch_rows(conn, args.limit)

    total = len(rows)
    print(f"Inspections to process: {total}")
    if not total:
        print("Nothing to do.")
        return

    succeeded = 0
    skipped_all_failed = 0
    skipped_short = 0
    total_chars = 0

    with psycopg.connect(DATABASE_URL) as conn:
        for idx, row in enumerate(rows, start=1):
            insp_id = row["id"]
            fac_name = (row["facility_name"] or "Unknown")[:40]
            insp_date = row["inspection_date"]
            insp_type = row["inspection_type"] or "standard"
            pdf_urls: list[str] = [u for u in (row["pdf_urls"] or []) if u]

            print(f"[{idx}/{total}] {fac_name} — {insp_date} ({insp_type}, {len(pdf_urls)} PDFs)")

            all_parts: list[str] = []
            for url in pdf_urls:
                print(f"    ↳ {url.split('/')[-1][:60]}", end=" ", flush=True)
                pdf_bytes = download_pdf(session, url)
                if pdf_bytes is None:
                    print("FAILED")
                    time.sleep(1.0)
                    continue

                try:
                    text = process_pdf(pdf_bytes, url, lib)
                except Exception as e:
                    print(f"EXTRACT ERROR: {e}")
                    time.sleep(1.0)
                    continue

                if len(text) < 50:
                    print(f"SHORT ({len(text)} chars, likely image PDF)")
                    time.sleep(1.0)
                    continue

                all_parts.append(text)
                print(f"{len(text)} chars")
                time.sleep(1.0)

            if not all_parts:
                print(f"  → all PDFs failed/short — skipping")
                skipped_all_failed += 1
                continue

            combined = "\n\n---\n\n".join(all_parts)
            combined = combined[:12000]  # DB-friendly cap

            if len(combined) < 50:
                print(f"  → combined too short ({len(combined)} chars) — skipping")
                skipped_short += 1
                continue

            update_narrative(conn, insp_id, combined)
            total_chars += len(combined)
            succeeded += 1
            print(f"  → updated ({len(combined)} chars total)")

    print()
    print("Done.")
    print(f"  Succeeded:          {succeeded}")
    print(f"  Total chars:        {total_chars:,}")
    print(f"  Avg chars:          {total_chars // succeeded if succeeded else 0:,}")
    print(f"  All PDFs failed:    {skipped_all_failed}")
    print(f"  Too short:          {skipped_short}")
    print(f"  Total processed:    {total}")


if __name__ == "__main__":
    main()
