#!/usr/bin/env python3
"""
OR PDF Download — walk or_pdf_inventory and download pending PDFs.

Mirrors wa_pdf_download.py but targets or_pdf_inventory and the Oregon
ltclicensing.oregon.gov portal for PDF hosting.

For each row with download_status='pending':
  1. Download the PDF to .firecrawl/or-pdfs/<sha256[:2]>/<sha256>.pdf.
  2. Compute sha256, record size_bytes.
  3. Update download_status='done'.

Rate limit: 1 req/sec + jitter against ltclicensing.oregon.gov.

Usage:
  python3 scrapers/or_pdf_download.py              # all pending
  python3 scrapers/or_pdf_download.py --limit 20
  python3 scrapers/or_pdf_download.py --facility-id <uuid>
  python3 scrapers/or_pdf_download.py --dry-run
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
import time
import random
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
PDF_CACHE_DIR = REPO_ROOT / ".firecrawl" / "or-pdfs"


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


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = "StarlynnCare-bot/1.0 (+https://starlynn.care)"
    return s


def polite_sleep() -> None:
    time.sleep(1.0 + random.random() * 0.5)


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def download_pdf(
    session: requests.Session,
    pdf_url: str,
    cache_dir: Path,
    inv_id: str,
) -> tuple[Path, str, int]:
    """Download PDF; return (local_path, sha256, size_bytes). Raises on failure."""
    resp = session.get(pdf_url, timeout=60, stream=True)
    resp.raise_for_status()

    # Write to a temp file first so we can compute sha256
    tmp = cache_dir / f"{inv_id}.tmp"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    with open(tmp, "wb") as f:
        for chunk in resp.iter_content(65536):
            f.write(chunk)

    digest = sha256_of(tmp)
    dest = cache_dir / digest[:2] / f"{digest}.pdf"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp.rename(dest)
    size = dest.stat().st_size
    return dest, digest, size


def run(dry_run: bool, limit: int | None, facility_id_filter: str | None) -> None:
    conn = get_conn()
    session = make_session()

    where_clauses = ["p.download_status = 'pending'"]
    params: list[Any] = []
    if facility_id_filter:
        where_clauses.append("p.facility_id = %s")
        params.append(facility_id_filter)

    where_sql = " AND ".join(where_clauses)
    limit_sql = f"LIMIT {limit}" if limit else ""

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT p.id, p.pdf_url, p.facility_id
            FROM or_pdf_inventory p
            WHERE {where_sql}
            ORDER BY p.created_at
            {limit_sql}
            """,
            params,
        )
        rows = cur.fetchall()

    print(f"  {len(rows)} PDFs to download")

    if dry_run:
        for inv_id, pdf_url, _ in rows[:5]:
            print(f"    {inv_id}  {pdf_url[:70]}")
        print("  ... (dry-run, no downloads)")
        return

    PDF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    ok = err = 0

    for inv_id, pdf_url, facility_id in rows:
        try:
            local_path, digest, size = download_pdf(session, pdf_url, PDF_CACHE_DIR, str(inv_id))
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE or_pdf_inventory
                        SET download_status = 'done', local_path = %s,
                            sha256 = %s, size_bytes = %s, downloaded_at = now()
                        WHERE id = %s
                        """,
                        (str(local_path), digest, size, inv_id),
                    )
            ok += 1
            print(f"  OK  {pdf_url[-50:]}  {size//1024}KB")
        except Exception as exc:
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE or_pdf_inventory
                        SET download_status = 'error', download_error = %s
                        WHERE id = %s
                        """,
                        (str(exc)[:500], inv_id),
                    )
            err += 1
            print(f"  ERR {pdf_url[-50:]}: {exc}", file=sys.stderr)
        polite_sleep()

    print(f"  Done — ok: {ok}, errors: {err}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download OR inspection PDFs into local cache.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--facility-id", help="Process one facility UUID")
    args = parser.parse_args()

    load_env()
    run(args.dry_run, args.limit, getattr(args, "facility_id", None))


if __name__ == "__main__":
    main()
