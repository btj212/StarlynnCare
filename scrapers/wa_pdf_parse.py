#!/usr/bin/env python3
"""
WA PDF Parse — Wave 1a, Step 2.

For each downloaded PDF in wa_pdf_inventory (parse_status='pending'):
  1. Triage: does the PDF have a text layer? (pdfplumber)
  2. If not → run OCRmyPDF (Tesseract) to add a text layer.
  3. Extract text with pdfplumber.
  4. Call Claude Haiku to normalize extracted text into structured deficiency JSON.
  5. Write normalized deficiencies to a JSON sidecar file next to the PDF.
  6. Update wa_pdf_inventory: parse_status='done', parse_method.

Callers then run wa_pdf_backfill.py to write deficiencies into the DB.

Usage:
  python3 scrapers/wa_pdf_parse.py                # all pending
  python3 scrapers/wa_pdf_parse.py --limit 10
  python3 scrapers/wa_pdf_parse.py --sha256 abc123
  python3 scrapers/wa_pdf_parse.py --dry-run      # triage only, no LLM
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import psycopg
import pdfplumber
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

PDF_CACHE_DIR = REPO_ROOT / ".firecrawl" / "wa-pdfs"

# Minimum characters of text before we consider a page "has text"
_MIN_TEXT_CHARS = 50

# Max characters sent to Claude per PDF (avoid context overflow)
_MAX_CHARS_TO_LLM = 12_000

_HAIKU_MODEL = "claude-haiku-4-5"

_SYSTEM_PROMPT = """You are a structured data extractor for Washington state DSHS long-term care inspection reports.

Given raw PDF text from a DSHS inspection report, extract each deficiency/violation cited and return a JSON array.

Each element must have:
- "date": YYYY-MM-DD or null (date of violation / inspection)
- "code": regulation code string (e.g. "WAC 388-78A-2050") or null
- "description": 1–3 sentence plain-language description of the violation
- "severity": "IJ" | "Type A" | "Type B" | "Type C" | "Class 1" | "Class 2" | "Class 3" | null
- "corrected": true | false | null

Return ONLY valid JSON. If there are no deficiencies (clean inspection), return [].
Do not include commentary outside the JSON array."""


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


def has_text_layer(pdf_path: Path) -> bool:
    """Return True if the PDF contains selectable text."""
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages[:3]:  # check first 3 pages
                text = page.extract_text() or ""
                if len(text.strip()) >= _MIN_TEXT_CHARS:
                    return True
        return False
    except Exception:
        return False


def extract_text_pdfplumber(pdf_path: Path) -> str:
    """Extract all text from a PDF with pdfplumber."""
    parts: list[str] = []
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                if text.strip():
                    parts.append(text.strip())
    except Exception as exc:
        print(f"  pdfplumber error: {exc}", file=sys.stderr)
    return "\n\n".join(parts)


def run_ocrmypdf(input_path: Path, output_path: Path) -> bool:
    """Run OCRmyPDF to add a text layer. Returns True on success."""
    try:
        result = subprocess.run(
            [
                "ocrmypdf",
                "--skip-text",       # don't re-OCR pages that already have text
                "--quiet",
                "--jobs", "2",
                str(input_path),
                str(output_path),
            ],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode not in (0, 6):  # 6 = already has text (ok)
            print(
                f"  ocrmypdf exit {result.returncode}: {result.stderr[:200]}",
                file=sys.stderr,
            )
            return False
        return True
    except Exception as exc:
        print(f"  ocrmypdf exception: {exc}", file=sys.stderr)
        return False


def call_claude_haiku(raw_text: str) -> list[dict[str, Any]]:
    """Call Claude Haiku to normalize extracted PDF text into structured deficiencies."""
    import anthropic  # local import — not installed at module level

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
    truncated = raw_text[:_MAX_CHARS_TO_LLM]

    message = client.messages.create(
        model=_HAIKU_MODEL,
        max_tokens=4096,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Extract deficiencies from this inspection report:\n\n{truncated}"}],
    )
    content = message.content[0].text.strip()

    # Strip markdown code fences if Claude wrapped the JSON
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    return json.loads(content)


def process_pdf(
    inv_id: str,
    pdf_path: Path,
    conn: psycopg.Connection,
    *,
    dry_run: bool = False,
) -> bool:
    """Parse one PDF and write sidecar JSON. Returns True on success."""
    print(f"  Processing: {pdf_path.name}")

    # Mark as parsing
    if not dry_run:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE wa_pdf_inventory SET parse_status='parsing' WHERE id=%s",
                (inv_id,),
            )
        conn.commit()

    # Triage
    if has_text_layer(pdf_path):
        text = extract_text_pdfplumber(pdf_path)
        method = "pdfplumber"
    else:
        print("    No text layer → running OCRmyPDF")
        if dry_run:
            print("    DRY-RUN: would OCR this file")
            return True
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            ocr_path = Path(tmp.name)
        if run_ocrmypdf(pdf_path, ocr_path):
            text = extract_text_pdfplumber(ocr_path)
            method = "ocrmypdf+pdfplumber"
            ocr_path.unlink(missing_ok=True)
        else:
            if not dry_run:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE wa_pdf_inventory SET parse_status='error', parse_error='OCR failed' WHERE id=%s",
                        (inv_id,),
                    )
                conn.commit()
            return False

    if not text.strip():
        print("    No extractable text")
        if not dry_run:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE wa_pdf_inventory SET parse_status='error', parse_error='no text extracted' WHERE id=%s",
                    (inv_id,),
                )
            conn.commit()
        return False

    print(f"    Extracted {len(text)} chars via {method}")

    if dry_run:
        print(f"    DRY-RUN: would call Claude Haiku on {len(text)} chars")
        return True

    # Call Claude
    try:
        deficiencies = call_claude_haiku(text)
    except Exception as exc:
        print(f"    Claude error: {exc}", file=sys.stderr)
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE wa_pdf_inventory SET parse_status='error', parse_error=%s WHERE id=%s",
                (str(exc)[:500], inv_id),
            )
        conn.commit()
        return False

    print(f"    Claude extracted {len(deficiencies)} deficiency/ies")

    # Write sidecar JSON
    sidecar = pdf_path.with_suffix(".parsed.json")
    sidecar.write_text(
        json.dumps(
            {
                "inv_id": inv_id,
                "parse_method": method,
                "raw_text_chars": len(text),
                "deficiencies": deficiencies,
            },
            indent=2,
        )
    )

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE wa_pdf_inventory
            SET parse_status='done',
                parse_method=%s,
                parsed_at=now()
            WHERE id=%s
            """,
            (method, inv_id),
        )
    conn.commit()
    return True


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="WA PDF parse — Wave 1a step 2")
    parser.add_argument("--sha256", help="Parse a specific PDF by sha256 prefix")
    parser.add_argument("--limit", type=int, help="Max PDFs to parse this run")
    parser.add_argument("--dry-run", action="store_true", help="Triage only, no LLM")
    args = parser.parse_args(argv)

    load_env()

    print("=== WA PDF Parse ===")
    conn = get_conn()

    sql = """
        SELECT id, sha256, local_path
        FROM wa_pdf_inventory
        WHERE download_status = 'done'
          AND parse_status IN ('pending', 'ocr_needed')
          {sha_filter}
          {created_after_filter}
        ORDER BY created_at
    """
    sha_filter = "AND sha256 LIKE %s" if args.sha256 else ""
    created_after = os.environ.get("STATE_SCAN_STARTED_AT")
    created_after_filter = "AND created_at >= %s::timestamptz" if created_after else ""
    params: list[Any] = []
    if args.sha256:
        params.append(args.sha256 + "%")
    if created_after:
        params.append(created_after)
    if args.limit:
        sql_with_limit = sql.format(
            sha_filter=sha_filter,
            created_after_filter=created_after_filter,
        ) + f" LIMIT {args.limit}"
    else:
        sql_with_limit = sql.format(
            sha_filter=sha_filter,
            created_after_filter=created_after_filter,
        )

    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(sql_with_limit, params)
        rows = cur.fetchall()

    print(f"  {len(rows)} PDFs to parse")
    done = 0
    errors = 0

    for row in rows:
        local_path = row["local_path"]
        if not local_path:
            print(f"  SKIP: no local_path for {row['id']}")
            errors += 1
            continue
        pdf_path = Path(local_path)
        if not pdf_path.exists():
            print(f"  SKIP: file not found: {pdf_path}", file=sys.stderr)
            errors += 1
            continue
        success = process_pdf(str(row["id"]), pdf_path, conn, dry_run=args.dry_run)
        if success:
            done += 1
        else:
            errors += 1

    print(f"\nDone: {done}  Errors: {errors}")
    conn.close()


if __name__ == "__main__":
    main()
