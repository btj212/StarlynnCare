#!/usr/bin/env python3
"""
OR PDF Parse — extract deficiencies from downloaded OR inspection PDFs.

Mirrors wa_pdf_parse.py but targets or_pdf_inventory and uses an OR-specific
Claude Haiku prompt that understands OR severity vocabulary (Level 1/2/3/4,
Immediate Jeopardy, OAR section references).

For each row in or_pdf_inventory with parse_status='pending' and
download_status='done':
  1. Triage: does the PDF have a text layer? (pdfplumber)
  2. If not → run OCRmyPDF to add text.
  3. Extract text with pdfplumber.
  4. Call Claude Haiku to normalize into structured deficiency JSON.
  5. Write a JSON sidecar next to the PDF.
  6. Update parse_status='done'.

Usage:
  python3 scrapers/or_pdf_parse.py            # all pending
  python3 scrapers/or_pdf_parse.py --limit 10
  python3 scrapers/or_pdf_parse.py --dry-run  # triage only, no LLM
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
PDF_CACHE_DIR = REPO_ROOT / ".firecrawl" / "or-pdfs"

_MIN_TEXT_CHARS = 50
_MAX_CHARS_TO_LLM = 12_000
_HAIKU_MODEL = "claude-haiku-4-5"

# OR-specific prompt — uses Level 1/2/3/4 + OAR section vocabulary
_SYSTEM_PROMPT = """You are a structured data extractor for Oregon DHS/APD long-term care inspection reports.

Given raw PDF text from an Oregon inspection report, extract each deficiency/violation cited and return a JSON array.

Each element must have:
- "date": YYYY-MM-DD or null (date of violation / inspection)
- "code": OAR regulation citation (e.g. "OAR 411-054-0120") or null
- "description": 1–3 sentence plain-language description of the violation
- "severity": "Level 1" | "Level 2" | "Level 3" | "Level 4" | "Immediate Jeopardy" | null
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
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages[:3]:
                text = page.extract_text() or ""
                if len(text.strip()) >= _MIN_TEXT_CHARS:
                    return True
    except Exception:
        pass
    return False


def extract_text(pdf_path: Path) -> str:
    parts: list[str] = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    parts.append(t)
    except Exception as exc:
        print(f"  WARN extract_text: {exc}", file=sys.stderr)
    return "\n".join(parts)


def ocr_pdf(pdf_path: Path) -> Path:
    """Run OCRmyPDF on pdf_path; return path to OCR'd file."""
    out = pdf_path.parent / f"{pdf_path.stem}_ocr.pdf"
    subprocess.run(
        ["ocrmypdf", "--skip-text", "--deskew", str(pdf_path), str(out)],
        check=True,
        capture_output=True,
    )
    return out


def call_claude(text: str) -> list[dict[str, Any]]:
    try:
        import anthropic
    except ImportError:
        raise RuntimeError("anthropic package not installed. Run: pip install anthropic")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    client = anthropic.Anthropic(api_key=api_key)
    truncated = text[:_MAX_CHARS_TO_LLM]

    msg = client.messages.create(
        model=_HAIKU_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": truncated}],
        system=_SYSTEM_PROMPT,
    )

    raw = msg.content[0].text if msg.content else "[]"
    # Strip markdown fences if model wraps in them
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    return json.loads(raw)


def parse_pdf(inv_id: str, local_path: str, dry_run: bool) -> tuple[str, list[dict[str, Any]] | None]:
    """
    Returns (parse_method, deficiencies_list) or (parse_method, None) on error.
    parse_method: 'pdfplumber' | 'ocrmypdf+pdfplumber' | 'dry_run'
    """
    pdf_path = Path(local_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not on disk: {local_path}")

    if has_text_layer(pdf_path):
        parse_method = "pdfplumber"
        active_pdf = pdf_path
    else:
        if dry_run:
            return "ocr_needed", None
        try:
            active_pdf = ocr_pdf(pdf_path)
            parse_method = "ocrmypdf+pdfplumber"
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(f"OCR failed: {exc.stderr.decode()[:200]}") from exc

    text = extract_text(active_pdf)

    if dry_run:
        print(f"    text_len={len(text)} parse_method={parse_method}")
        return parse_method, None

    deficiencies = call_claude(text)

    # Write JSON sidecar next to the PDF
    sidecar = pdf_path.parent / f"{pdf_path.stem}.deficiencies.json"
    sidecar.write_text(json.dumps(deficiencies, indent=2))

    return parse_method, deficiencies


def run(dry_run: bool, limit: int | None) -> None:
    conn = get_conn()
    limit_sql = f"LIMIT {limit}" if limit else ""

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, local_path, facility_id, inspection_id
            FROM or_pdf_inventory
            WHERE parse_status = 'pending'
              AND download_status = 'done'
              AND local_path IS NOT NULL
            ORDER BY created_at
            {limit_sql}
            """
        )
        rows = cur.fetchall()

    print(f"  {len(rows)} PDFs to parse")

    ok = err = skipped = 0
    for inv_id, local_path, facility_id, inspection_id in rows:
        try:
            parse_method, deficiencies = parse_pdf(str(inv_id), local_path, dry_run)
            if dry_run:
                skipped += 1
                continue

            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE or_pdf_inventory
                        SET parse_status = 'done', parse_method = %s, parsed_at = now()
                        WHERE id = %s
                        """,
                        (parse_method, inv_id),
                    )
            ok += 1
            print(f"  OK  {str(inv_id)[:8]}  {parse_method}  {len(deficiencies or [])} deficiencies")

        except Exception as exc:
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE or_pdf_inventory
                        SET parse_status = 'error', parse_error = %s
                        WHERE id = %s
                        """,
                        (str(exc)[:500], inv_id),
                    )
            err += 1
            print(f"  ERR {str(inv_id)[:8]}: {exc}", file=sys.stderr)

    print(f"  Done — ok: {ok}, errors: {err}, dry-run skipped: {skipped}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse OR inspection PDFs with Claude Haiku.")
    parser.add_argument("--dry-run", action="store_true", help="Triage only, no LLM calls")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    load_env()
    run(args.dry_run, args.limit)


if __name__ == "__main__":
    main()
