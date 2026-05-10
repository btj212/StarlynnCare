#!/usr/bin/env python3
"""
fetch_mn_pdf_narratives.py — Download MDH inspection PDFs and extract narrative text.

Minnesota inspection records have metadata (dates, status, PDF links) but the
raw_data->>'narrative' field is NULL. This script downloads each PDF, extracts
the substantive narrative text, and writes it back into raw_data->'narrative'.

Sources:
  OHFC complaint findings: http://www.health.state.mn.us/…/ohfcfindings/hl….pdf
  Survey findings:         http://www.health.state.mn.us/…/surveyfindings/….pdf

Usage:
    python3 scrapers/fetch_mn_pdf_narratives.py
    python3 scrapers/fetch_mn_pdf_narratives.py --limit 5 --substantiated-only
    python3 scrapers/fetch_mn_pdf_narratives.py --state MN --substantiated-only

Requires:
    DATABASE_URL in .env.local
    pdfplumber (or pypdf) — installed automatically if missing
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

# Boilerplate header patterns to strip from MDH PDFs
_HEADER_NOISE_RE = re.compile(
    r"(?m)^"
    r"(?:"
    r"Minnesota Department of Health.*?$|"
    r"Health Regulation Division.*?$|"
    r"P\.?O\.? Box.*?$|"
    r"\d{3}[-.\s]\d{3}[-.\s]\d{4}.*?$|"  # phone numbers
    r"Fax:.*?$|"
    r"TTY:.*?$|"
    r"www\.health\.state\.mn\.us.*?$|"
    r"Report Number:.*?$|"
    r"Provider Number:.*?$|"
    r"Evaluator:.*?$|"
    r"Page \d+ of \d+.*?$"
    r")"
)

_EXCESS_WHITESPACE_RE = re.compile(r"\n{3,}")


def _clean_text(raw: str) -> str:
    """Strip boilerplate lines, NUL bytes, and normalize whitespace."""
    text = raw.replace("\x00", "")  # PostgreSQL rejects NUL bytes
    text = _HEADER_NOISE_RE.sub("", text)
    text = _EXCESS_WHITESPACE_RE.sub("\n\n", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Section-aware extraction
# ---------------------------------------------------------------------------

# OHFC complaint PDF section headers
OHFC_SECTIONS = [
    "Nature of Investigation",
    "Initial Investigation Allegation",
    "Summary of Investigation",
    "Finding",
    "Conclusion",
    "Maltreatment Determination",
    "Licensing Violation",
]

# Survey findings PDF section headers
SURVEY_SECTIONS = [
    "Survey Date",
    "Deficiency",
    "Citation",
    "Plan of Correction",
    "Summary of Findings",
    "Correction Order",
    "Statement of Deficiencies",
]


def _extract_sections(text: str, section_names: list[str]) -> str:
    """
    Pull text starting from the first recognized section header.
    Falls back to the full text if no section found.
    """
    pattern = "|".join(re.escape(s) for s in section_names)
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        return text[m.start():]
    return text


def _trim_to_word_budget(text: str, min_words: int = 80, max_words: int = 1400) -> str:
    """
    Trim extracted text to roughly max_words words while keeping full sentences.
    Returns the text if it's below min_words (caller will reject it anyway).
    """
    words = text.split()
    if len(words) <= max_words:
        return text
    # Cut at max_words words, then extend to the end of the nearest sentence
    cut = " ".join(words[:max_words])
    # Find last sentence-ending punctuation
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

    is_survey = "surveyfindings" in report_url.lower()
    sections = SURVEY_SECTIONS if is_survey else OHFC_SECTIONS
    narrative = _extract_sections(cleaned, sections)
    narrative = _trim_to_word_budget(narrative)
    return narrative.strip()


# ---------------------------------------------------------------------------
# DB queries
# ---------------------------------------------------------------------------

FETCH_SQL = """
SELECT
    i.id::text,
    i.inspection_date,
    i.raw_data->>'status'      AS status,
    i.raw_data->>'report_link' AS report_link,
    f.name                     AS facility_name
FROM inspections i
JOIN facilities f ON f.id = i.facility_id
WHERE f.state_code = %(state)s
  AND i.raw_data->>'report_link' IS NOT NULL
  AND (i.raw_data->>'narrative' IS NULL OR i.raw_data->>'narrative' = '')
ORDER BY
    CASE WHEN i.raw_data->>'status' = 'SUBSTANTIATED' THEN 0 ELSE 1 END,
    i.inspection_date DESC
"""

FETCH_SUBSTANTIATED_SQL = FETCH_SQL.replace(
    "ORDER BY",
    "AND i.raw_data->>'status' = 'SUBSTANTIATED'\nORDER BY",
)

UPDATE_SQL = """
UPDATE inspections
SET raw_data = raw_data || jsonb_build_object('narrative', %(narrative)s::text)
WHERE id = %(id)s::uuid
"""


def fetch_rows(conn: psycopg.Connection, state: str, substantiated_only: bool, limit: int | None) -> list[dict[str, Any]]:
    sql = FETCH_SUBSTANTIATED_SQL if substantiated_only else FETCH_SQL
    if limit:
        sql += f" LIMIT {int(limit)}"
    with conn.cursor() as cur:
        cur.execute(sql, {"state": state.upper()})
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def update_narrative(conn: psycopg.Connection, insp_id: str, narrative: str) -> None:
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
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/pdf,application/octet-stream,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.health.state.mn.us/facilities/regulation/directory/",
    })
    return s


def download_pdf(session: Any, url: str, timeout: int = 30) -> bytes | None:
    """Download a PDF. Returns bytes on success, None on 404/error."""
    import requests
    try:
        r = session.get(url, timeout=timeout, allow_redirects=True)
        if r.status_code == 404:
            print(f"    404 — skipping {url}")
            return None
        if r.status_code != 200:
            print(f"    HTTP {r.status_code} — skipping {url}")
            return None
        ct = r.headers.get("Content-Type", "")
        if "pdf" not in ct.lower() and len(r.content) < 100:
            print(f"    Unexpected content-type '{ct}' or empty body — skipping")
            return None
        return r.content
    except requests.exceptions.SSLError as e:
        print(f"    SSL error: {e} — skipping")
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"    Connection error: {e} — skipping")
        return None
    except requests.exceptions.Timeout:
        print(f"    Timeout — skipping {url}")
        return None
    except Exception as e:
        print(f"    Download error: {e} — skipping")
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch MN MDH inspection PDF narratives")
    parser.add_argument("--state", default="MN", help="State code (default: MN)")
    parser.add_argument("--limit", type=int, default=None, help="Process only first N records")
    parser.add_argument(
        "--substantiated-only", action="store_true",
        help="Only process SUBSTANTIATED records",
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
        rows = fetch_rows(conn, args.state, args.substantiated_only, args.limit)

    total = len(rows)
    print(f"Records to process: {total} (state={args.state}, substantiated_only={args.substantiated_only})")
    if not total:
        print("Nothing to do.")
        return

    succeeded = 0
    skipped_download = 0
    skipped_short = 0
    skipped_image_pdf = 0
    total_chars = 0

    with psycopg.connect(DATABASE_URL) as conn:
        for idx, row in enumerate(rows, start=1):
            insp_id = row["id"]
            fac_name = (row["facility_name"] or "Unknown")[:35]
            insp_date = row["inspection_date"]
            status = row["status"] or "UNKNOWN"
            url = row["report_link"]

            label = f"[{idx}/{total}] {fac_name} — {insp_date} {status}"
            print(label, end=" ", flush=True)

            pdf_bytes = download_pdf(session, url)
            if pdf_bytes is None:
                skipped_download += 1
                print("→ DOWNLOAD FAILED")
                time.sleep(1.5)
                continue

            try:
                narrative = process_pdf(pdf_bytes, url, lib)
            except Exception as e:
                print(f"→ EXTRACTION ERROR: {e}")
                skipped_short += 1
                time.sleep(1.5)
                continue

            if len(narrative) < 50:
                # Might be a scanned image PDF
                print(f"→ SHORT ({len(narrative)} chars) — skipping")
                skipped_image_pdf += 1
                time.sleep(1.5)
                continue

            update_narrative(conn, insp_id, narrative)
            char_count = len(narrative)
            total_chars += char_count
            succeeded += 1
            print(f"→ {char_count} chars extracted")

            time.sleep(1.5)

    print()
    print(f"Done.")
    print(f"  Succeeded:          {succeeded}")
    print(f"  Total chars:        {total_chars:,}")
    print(f"  Avg chars:          {total_chars // succeeded if succeeded else 0:,}")
    print(f"  Download failures:  {skipped_download}")
    print(f"  Too short (<50ch):  {skipped_short + skipped_image_pdf}")
    print(f"  Total processed:    {total}")


if __name__ == "__main__":
    main()
