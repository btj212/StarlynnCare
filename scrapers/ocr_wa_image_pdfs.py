#!/usr/bin/env python3
"""
ocr_wa_image_pdfs.py — OCR the WA "image_pdf" bucket using pytesseract + pdf2image.

Reads every PDF from scrapers/wa-skipped-pdfs/image_pdf/, OCRs each page,
matches the result to an inspection row in the DB (by facility name slug + date),
and writes the extracted text back to inspections.raw_data->'narrative'.

Filename convention (set by fetch_wa_pdf_narratives.py):
    {FacilityName_slug}_{YYYY-MM-DD}_p1.pdf

Usage:
    python3 scrapers/ocr_wa_image_pdfs.py
    python3 scrapers/ocr_wa_image_pdfs.py --dry-run
    python3 scrapers/ocr_wa_image_pdfs.py --limit 3

Requires:
    brew install tesseract poppler
    pip install pytesseract pdf2image psycopg python-dotenv
    DATABASE_URL in .env.local
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env.local")

DATABASE_URL = os.environ.get("DATABASE_URL", "")
IMAGE_PDF_DIR = Path(__file__).resolve().parent / "wa-skipped-pdfs" / "image_pdf"

# Tesseract is installed by Homebrew at this path; set it explicitly so pytesseract
# finds it regardless of shell PATH.
TESSERACT_CMD = "/opt/homebrew/bin/tesseract"

# ---------------------------------------------------------------------------
# Text cleaning (mirrors fetch_wa_pdf_narratives.py)
# ---------------------------------------------------------------------------

_WA_HEADER_NOISE_RE = re.compile(
    r"(?m)^"
    r"(?:"
    r"Washington State Department of Social.*?$|"
    r"Aging and Long.Term Support Administration.*?$|"
    r"Residential Care Services.*?$|"
    r"P\.?O\.? Box.*?$|"
    r"\d{3}[-.\s]\d{3}[-.\s]\d{4}.*?$|"
    r"Fax:.*?$|"
    r"TTY:.*?$|"
    r"www\.dshs\.wa\.gov.*?$|"
    r"fortress\.wa\.gov.*?$|"
    r"Page \d+ of \d+.*?$|"
    r"RCS \d+.*?$"
    r")"
)

_PLACEHOLDER_RE = re.compile(
    r"This\s+document\s+was\s+prepared\s+by\s+Residential\s+Care\s+Services\s+"
    r"for\s+the\s+Locator\s+website",
    re.IGNORECASE,
)

_EXCESS_WHITESPACE_RE = re.compile(r"\n{3,}")

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


def _clean_text(raw: str) -> str:
    text = raw.replace("\x00", "")
    text = _PLACEHOLDER_RE.sub("", text)
    text = _WA_HEADER_NOISE_RE.sub("", text)
    text = _EXCESS_WHITESPACE_RE.sub("\n\n", text)
    return text.strip()


def _extract_sections(text: str, section_names: list[str]) -> str:
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


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------

def ocr_pdf(pdf_path: Path) -> str:
    """Convert each PDF page to an image and OCR it. Returns concatenated text."""
    import pytesseract
    from pdf2image import convert_from_path

    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

    try:
        images = convert_from_path(str(pdf_path), dpi=300)
    except Exception as e:
        print(f"    pdf2image error: {e}")
        return ""

    if not images:
        print("    No pages found in PDF")
        return ""

    pages: list[str] = []
    for i, img in enumerate(images, start=1):
        try:
            text = pytesseract.image_to_string(img, lang="eng")
            if text and text.strip():
                pages.append(text.strip())
                print(f"    page {i}: {len(text)} chars")
            else:
                print(f"    page {i}: 0 chars (blank/image)")
        except Exception as e:
            print(f"    page {i} OCR error: {e}")

    return "\n\n".join(pages)


def process_narrative(raw_text: str, filename: str) -> str:
    """Clean, section-trim, and word-budget the raw OCR output."""
    cleaned = _clean_text(raw_text)
    is_investigation = "investigation" in filename.lower() or "complaint" in filename.lower()
    sections = _INVESTIGATION_SECTIONS if is_investigation else _INSPECTION_SECTIONS
    narrative = _extract_sections(cleaned, sections)
    narrative = _trim_to_word_budget(narrative)
    return narrative.strip()


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

# Convert the filename slug back to a fuzzy facility name for matching.
# Filenames look like: Brookdale_Puyallup_South_2025-07-01_p1.pdf
# We strip trailing _pN and the date to get: Brookdale Puyallup South
_FILENAME_RE = re.compile(
    r"^(?P<name>.+?)_(?P<date>\d{4}-\d{2}-\d{2})_p\d+\.pdf$",
    re.IGNORECASE,
)


def parse_filename(pdf_path: Path) -> tuple[str, str] | None:
    """Return (facility_name_slug, inspection_date) or None if unparseable."""
    m = _FILENAME_RE.match(pdf_path.name)
    if not m:
        return None
    slug = m.group("name")          # e.g. "Brookdale_Puyallup_South"
    date = m.group("date")          # e.g. "2025-07-01"
    return slug, date


def slug_to_name(slug: str) -> str:
    """Turn filename slug into a human-readable name for ILIKE matching."""
    return slug.replace("_", " ").replace("  ", " ").strip()


FIND_INSPECTION_SQL = """
SELECT i.id::text, f.name AS facility_name, i.inspection_date,
       i.raw_data->>'narrative' AS current_narrative
FROM inspections i
JOIN facilities f ON f.id = i.facility_id
WHERE f.state_code = 'WA'
  AND f.name ILIKE %(name_pattern)s
  AND i.inspection_date::date = %(date)s::date
ORDER BY i.inspection_date DESC
LIMIT 1
"""

UPDATE_SQL = """
UPDATE inspections
SET raw_data = raw_data || jsonb_build_object('narrative', %(narrative)s::text)
WHERE id = %(id)s::uuid
"""


def find_inspection(
    conn: psycopg.Connection,
    facility_name_slug: str,
    date: str,
) -> dict | None:
    human_name = slug_to_name(facility_name_slug)
    # Allow prefix matching: "Brookdale%" catches "Brookdale Puyallup South"
    # Use the full slug words joined as ILIKE pattern with % between them
    # for robustness against minor name differences.
    words = [w for w in human_name.split() if w]
    if not words:
        return None
    # Try exact-ish match first (replace spaces with %)
    name_pattern = "%" + "%".join(words) + "%"
    with conn.cursor() as cur:
        cur.execute(FIND_INSPECTION_SQL, {"name_pattern": name_pattern, "date": date})
        row = cur.fetchone()
        if row:
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
    # Fallback: match just on first 2 words
    if len(words) >= 2:
        fallback_pattern = "%" + words[0] + "%" + words[1] + "%"
        with conn.cursor() as cur:
            cur.execute(FIND_INSPECTION_SQL, {"name_pattern": fallback_pattern, "date": date})
            row = cur.fetchone()
            if row:
                cols = [d[0] for d in cur.description]
                return dict(zip(cols, row))
    return None


def update_narrative(
    conn: psycopg.Connection,
    insp_id: str,
    narrative: str,
) -> None:
    with conn.cursor() as cur:
        cur.execute(UPDATE_SQL, {"narrative": narrative, "id": insp_id})
    conn.commit()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="OCR WA image PDFs and write narratives to DB"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="OCR and match but do NOT write to DB")
    parser.add_argument("--limit", type=int, default=None,
                        help="Process only the first N PDF files")
    args = parser.parse_args()

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    pdf_files = sorted(IMAGE_PDF_DIR.glob("*.pdf"))
    if args.limit:
        pdf_files = pdf_files[: args.limit]

    total = len(pdf_files)
    print(f"Image PDFs to OCR: {total}")
    print(f"Tesseract path:    {TESSERACT_CMD}")
    print(f"Dry run:           {args.dry_run}")
    print()

    succeeded = 0
    no_db_match = 0
    short_text = 0
    errors = 0

    with psycopg.connect(DATABASE_URL) as conn:
        for idx, pdf_path in enumerate(pdf_files, start=1):
            print(f"[{idx}/{total}] {pdf_path.name}")

            parsed = parse_filename(pdf_path)
            if not parsed:
                print(f"  Filename does not match expected pattern — skipping")
                errors += 1
                continue

            slug, date = parsed
            print(f"  Facility slug: {slug_to_name(slug)}")
            print(f"  Date:          {date}")

            # OCR
            raw_text = ocr_pdf(pdf_path)
            if not raw_text or len(raw_text.strip()) < 50:
                print(f"  OCR yielded < 50 chars — skipping")
                short_text += 1
                continue

            narrative = process_narrative(raw_text, pdf_path.name)
            print(f"  Narrative:     {len(narrative)} chars after cleaning")

            if len(narrative) < 50:
                print(f"  Cleaned narrative too short — skipping")
                short_text += 1
                continue

            # DB match
            insp = find_inspection(conn, slug, date)
            if not insp:
                print(f"  No DB match found — skipping (check facility name / date)")
                no_db_match += 1
                continue

            insp_id = insp["id"]
            fac_name = insp["facility_name"]
            current = insp["current_narrative"] or ""
            print(f"  Matched:       {fac_name} (id={insp_id[:8]}…)")
            print(f"  Existing narrative: {len(current)} chars")

            if args.dry_run:
                print(f"  [DRY RUN] would write {len(narrative)} chars — skipping DB write")
                succeeded += 1
                continue

            update_narrative(conn, insp_id, narrative)
            print(f"  Written to DB ✓")
            succeeded += 1

    print()
    print("Done.")
    print(f"  Succeeded:       {succeeded}")
    print(f"  No DB match:     {no_db_match}")
    print(f"  Too short:       {short_text}")
    print(f"  Parse errors:    {errors}")
    print(f"  Total PDFs:      {total}")


if __name__ == "__main__":
    main()
