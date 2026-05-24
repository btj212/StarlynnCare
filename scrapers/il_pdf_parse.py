#!/usr/bin/env python3
"""
IL PDF Parse — extract deficiency data from IDPH inspection/complaint PDFs.

Mirrors wa_pdf_parse.py but targets il_inspection_inventory and uses an
IL-specific extractor prompt (77 Ill. Adm. Code pt. 295, T1/T2/T3 violations,
no F-tags).

For each downloaded PDF in il_inspection_inventory (parse_status='pending'):
  1. Triage: does the PDF have a text layer? (pdfplumber)
  2. If not → run OCRmyPDF (Tesseract) to add a text layer.
  3. Extract text with pdfplumber.
  4. Call Claude Haiku to normalize extracted text into structured deficiency JSON.
  5. Write normalized deficiencies to a JSON sidecar file next to the PDF.
  6. Update il_inspection_inventory: parse_status='done', parse_method.

il_pdf_backfill.py then writes deficiencies into the DB.

Usage:
  python3 scrapers/il_pdf_parse.py                # all pending
  python3 scrapers/il_pdf_parse.py --limit 10
  python3 scrapers/il_pdf_parse.py --sha256 abc123
  python3 scrapers/il_pdf_parse.py --dry-run      # triage only, no LLM
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
PDF_CACHE_DIR = REPO_ROOT / ".firecrawl" / "il-pdfs"

_MIN_TEXT_CHARS = 50
_MAX_CHARS_TO_LLM = 12_000
_HAIKU_MODEL = "claude-haiku-4-5"

_SYSTEM_PROMPT = """You are a structured data extractor for Illinois IDPH Division of Assisted Living
inspection and complaint reports for Assisted Living Establishments (ALEs) and Shared Housing
Establishments (SHEs).

Illinois violations are cited under 77 Ill. Adm. Code Part 295.
Violation types are Type 1 (most severe), Type 2, and Type 3.
There are NO federal F-tags in Illinois ALE inspections.

Given raw PDF text from an IDPH inspection report, extract each violation or finding cited and
return a JSON array.

Each element must have:
- "date": YYYY-MM-DD or null (inspection exit date or citation date)
- "code": regulation code string (e.g. "295.6010" or "295.4010(a)(1)") or null
- "description": 1–3 sentence plain-language description of the violation or finding
- "severity": "Type 1" | "Type 2" | "Type 3" | null
- "is_repeat": true | false
- "fine_dollars": number or null (dollar amount of any fine cited)
- "corrected": true | false | null

Return ONLY valid JSON. If there are no violations (clean inspection), return [].
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


def load_pending(
    conn: psycopg.Connection,
    limit: int | None,
    sha256_filter: str | None,
) -> list[dict[str, Any]]:
    where = "download_status = 'done' AND parse_status = 'pending' AND local_path IS NOT NULL"
    params: list[Any] = []
    if sha256_filter:
        where += " AND sha256 LIKE %s"
        params.append(f"{sha256_filter}%")
    lim = f"LIMIT {int(limit)}" if limit else ""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id::text, inspection_id::text, facility_id::text,
                   license_number, local_path, sha256
            FROM il_inspection_inventory
            WHERE {where}
            ORDER BY created_at
            {lim}
            """,
            params,
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def has_text_layer(pdf_path: Path) -> bool:
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages[:3]:
                text = page.extract_text() or ""
                if len(text.strip()) >= _MIN_TEXT_CHARS:
                    return True
    except Exception:
        pass
    return False


def ocr_pdf(pdf_path: Path) -> Path:
    """Run OCRmyPDF to add a text layer. Returns path to OCR'd PDF."""
    ocr_path = pdf_path.with_suffix(".ocr.pdf")
    subprocess.run(
        ["ocrmypdf", "--force-ocr", "--quiet", str(pdf_path), str(ocr_path)],
        check=True,
        timeout=120,
    )
    return ocr_path


def extract_text(pdf_path: Path) -> str:
    parts: list[str] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            if t.strip():
                parts.append(t)
    return "\n\n".join(parts)[:_MAX_CHARS_TO_LLM]


def call_claude(text: str, api_key: str) -> list[dict[str, Any]]:
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    resp = client.messages.create(
        model=_HAIKU_MODEL,
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Extract violations from this PDF text:\n\n{text}"}],
    )
    raw = resp.content[0].text.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


def write_sidecar(pdf_path: Path, deficiencies: list[dict[str, Any]]) -> Path:
    sidecar = pdf_path.with_suffix(".deficiencies.json")
    sidecar.write_text(json.dumps(deficiencies, indent=2, default=str))
    return sidecar


def update_parse_done(
    conn: psycopg.Connection,
    inv_id: str,
    method: str,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE il_inspection_inventory SET
                parse_status = 'done',
                parse_method = %s,
                parsed_at    = now(),
                updated_at   = now()
            WHERE id = %s::uuid
            """,
            (method, inv_id),
        )


def update_parse_error(conn: psycopg.Connection, inv_id: str, msg: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE il_inspection_inventory SET
                parse_status = 'error',
                parse_error  = %s,
                updated_at   = now()
            WHERE id = %s::uuid
            """,
            (msg[:500], inv_id),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="IL PDF parse — pdfplumber + OCR + Claude Haiku")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--sha256", help="Process only rows matching this sha256 prefix")
    parser.add_argument("--dry-run", action="store_true", help="Triage only, no LLM calls")
    args = parser.parse_args()

    load_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not args.dry_run and not api_key:
        print("ANTHROPIC_API_KEY not set.", file=sys.stderr)
        sys.exit(1)
    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    conn = get_conn()
    rows = load_pending(conn, args.limit, args.sha256)
    print(f"  {len(rows)} PDFs pending parse.", flush=True)

    done = err = ocr_count = 0

    for row in rows:
        inv_id    = row["id"]
        local_path = Path(row["local_path"])
        sha256    = row.get("sha256", "")[:12]
        lic       = row["license_number"]

        print(f"  → {lic} sha={sha256}… {local_path.name}", flush=True)

        if not local_path.is_file():
            msg = f"local file not found: {local_path}"
            print(f"    SKIP: {msg}", file=sys.stderr, flush=True)
            if not args.dry_run:
                update_parse_error(conn, inv_id, msg)
                conn.commit()
            err += 1
            continue

        try:
            method = "pdfplumber"
            work_path = local_path

            if not has_text_layer(local_path):
                print(f"    → OCR needed", flush=True)
                if args.dry_run:
                    print(f"    [dry-run] would OCR", flush=True)
                    done += 1
                    continue
                work_path = ocr_pdf(local_path)
                method = "ocrmypdf+pdfplumber"
                ocr_count += 1

            text = extract_text(work_path)
            print(f"    → {len(text):,} chars extracted", flush=True)

            if args.dry_run:
                print(f"    [dry-run] would call Claude Haiku", flush=True)
                done += 1
                continue

            deficiencies = call_claude(text, api_key)
            sidecar = write_sidecar(local_path, deficiencies)
            print(f"    → {len(deficiencies)} deficiencies → {sidecar.name}", flush=True)

            update_parse_done(conn, inv_id, method)
            conn.commit()
            done += 1

        except Exception as exc:
            print(f"    ERROR: {exc}", file=sys.stderr, flush=True)
            if not args.dry_run:
                update_parse_error(conn, inv_id, str(exc))
                conn.commit()
            err += 1

    conn.close()
    print(f"\nDone. {done} parsed ({ocr_count} OCR'd), {err} errors.", flush=True)


if __name__ == "__main__":
    main()
