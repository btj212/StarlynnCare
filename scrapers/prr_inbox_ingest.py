#!/usr/bin/env python3
"""
PRR Inbox Ingest — Wave 4.

Watches the /prr-imports/{prr_id}/ directory tree for PDFs that have been
manually placed there after a PRR is fulfilled.

For each new PDF found:
  1. Copies it into the standard wa-pdfs cache (via wa_pdf_download logic).
  2. Upserts a wa_pdf_inventory row tagged with the prr_request_id.
  3. Runs wa_pdf_parse.py to extract text.
  4. Runs wa_pdf_backfill.py to write deficiencies.
  5. Updates prr_requests.received_pdf_count.

Directory structure expected:
  prr-imports/
    {prr_id}/                    ← UUID from prr_requests.id
      {license}_{date}_{desc}.pdf
      {license}_{date}_{desc}.pdf
      ...

Usage:
  python3 scrapers/prr_inbox_ingest.py               # scan all PRR import dirs
  python3 scrapers/prr_inbox_ingest.py --prr-id UUID # one PRR only
  python3 scrapers/prr_inbox_ingest.py --dry-run
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
PRR_IMPORTS_DIR = REPO_ROOT / "prr-imports"
PDF_CACHE_DIR = REPO_ROOT / ".firecrawl" / "wa-pdfs"


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


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def cache_path_for(sha: str) -> Path:
    return PDF_CACHE_DIR / sha[:2] / f"{sha}.pdf"


def _extract_license_from_filename(name: str) -> str | None:
    """Try to extract a WA license number from a PDF filename."""
    m = re.search(r"\b(\d{4,10})\b", name)
    if m:
        digits = re.sub(r"\D", "", m.group(1))
        return digits.zfill(10)
    return None


def find_facility_for_license(
    conn: psycopg.Connection, license_number: str
) -> tuple[str | None, str | None]:
    """Return (facility_id, facility_name) for a WA license number."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id::text, name FROM facilities WHERE state_code='WA' AND license_number=%s LIMIT 1",
            (license_number,),
        )
        row = cur.fetchone()
    if row:
        return str(row[0]), str(row[1])
    return None, None


def validate_prr_id(conn: psycopg.Connection, prr_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM prr_requests WHERE id=%s::uuid", (prr_id,))
        return cur.fetchone() is not None


def ingest_pdf(
    conn: psycopg.Connection,
    pdf_path: Path,
    prr_id: str,
    *,
    dry_run: bool = False,
) -> bool:
    """Process one PRR-supplied PDF. Returns True on success."""
    sha = sha256_of_file(pdf_path)
    dest = cache_path_for(sha)
    license_number = _extract_license_from_filename(pdf_path.name) or "0000000000"
    facility_id, facility_name = find_facility_for_license(conn, license_number)

    print(f"  {pdf_path.name} → sha={sha[:12]} lic={license_number} facility={facility_name or 'UNKNOWN'}")

    if dry_run:
        print(f"    DRY-RUN: would copy to {dest}")
        return True

    # Copy to cache
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        shutil.copy2(pdf_path, dest)

    # Upsert inventory row
    source_url = f"prr://{prr_id}/{pdf_path.name}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO wa_pdf_inventory
              (facility_id, license_number, source_url, doc_type,
               download_status, sha256, size_bytes, local_path, downloaded_at)
            VALUES
              (%s, %s, %s, 'inspection',
               'done', %s, %s, %s, now())
            ON CONFLICT (source_url) DO UPDATE
            SET sha256 = EXCLUDED.sha256,
                local_path = EXCLUDED.local_path,
                download_status = 'done'
            """,
            (
                facility_id,
                license_number,
                source_url,
                sha,
                pdf_path.stat().st_size,
                str(dest),
            ),
        )
    conn.commit()
    return True


def update_prr_count(conn: psycopg.Connection, prr_id: str, count: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE prr_requests
            SET received_pdf_count = received_pdf_count + %s,
                status = CASE
                  WHEN status = 'submitted' THEN 'partial'
                  ELSE status
                END,
                updated_at = now()
            WHERE id = %s::uuid
            """,
            (count, prr_id),
        )
    conn.commit()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="PRR inbox ingest — Wave 4")
    parser.add_argument("--prr-id", help="Process one PRR import directory by UUID")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--no-parse",
        action="store_true",
        help="Ingest PDFs into inventory but skip parsing (useful for bulk staging)",
    )
    args = parser.parse_args(argv)

    load_env()
    print("=== PRR Inbox Ingest ===")

    if not PRR_IMPORTS_DIR.exists():
        print(f"  PRR imports directory not found: {PRR_IMPORTS_DIR}")
        print("  Create it and place PRR-fulfilled PDFs under prr-imports/{prr_id}/")
        return

    conn = get_conn()

    # Find which PRR dirs to process
    if args.prr_id:
        prr_dirs = [PRR_IMPORTS_DIR / args.prr_id]
    else:
        prr_dirs = [d for d in PRR_IMPORTS_DIR.iterdir() if d.is_dir()]

    print(f"  {len(prr_dirs)} PRR import director(ies) to scan")

    total_ingested = 0
    for prr_dir in prr_dirs:
        prr_id = prr_dir.name
        if not prr_dir.exists():
            print(f"  SKIP {prr_id}: directory not found")
            continue

        if not validate_prr_id(conn, prr_id):
            print(f"  SKIP {prr_id}: not found in prr_requests table")
            continue

        pdfs = list(prr_dir.glob("*.pdf"))
        print(f"\n  PRR {prr_id}: {len(pdfs)} PDFs")

        ingested = 0
        for pdf in pdfs:
            ok = ingest_pdf(conn, pdf, prr_id, dry_run=args.dry_run)
            if ok:
                ingested += 1

        if not args.dry_run:
            update_prr_count(conn, prr_id, ingested)
        total_ingested += ingested

    print(f"\nTotal PDFs ingested into inventory: {total_ingested}")

    if not args.no_parse and total_ingested > 0 and not args.dry_run:
        print("\nRunning PDF parse pipeline…")
        parse_script = SCRAPERS_DIR / "wa_pdf_parse.py"
        backfill_script = SCRAPERS_DIR / "wa_pdf_backfill.py"
        if parse_script.exists():
            subprocess.run([sys.executable, str(parse_script)], check=False)
        if backfill_script.exists():
            subprocess.run([sys.executable, str(backfill_script), "--rescore"], check=False)

    conn.close()


if __name__ == "__main__":
    main()
