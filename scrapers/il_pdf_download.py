#!/usr/bin/env python3
"""
IL PDF Download — walk il_inspection_inventory and download pending PDFs.

Mirrors or_pdf_download.py but targets il_inspection_inventory and the LLCS portal.

For each row with download_status='pending':
  1. Download the PDF to .firecrawl/il-pdfs/<sha256[:2]>/<sha256>.pdf.
  2. Compute sha256, record size_bytes.
  3. Update download_status='done'.

Rate limit: 1 req/sec + jitter against llcs.dph.illinois.gov.

Usage:
  python3 scrapers/il_pdf_download.py              # all pending
  python3 scrapers/il_pdf_download.py --limit 20
  python3 scrapers/il_pdf_download.py --facility-id <uuid>
  python3 scrapers/il_pdf_download.py --dry-run
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
PDF_CACHE_DIR = REPO_ROOT / ".firecrawl" / "il-pdfs"


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
    tmp_path = cache_dir / f"tmp_{inv_id}.pdf"
    cache_dir.mkdir(parents=True, exist_ok=True)

    with session.get(pdf_url, stream=True, timeout=60) as r:
        r.raise_for_status()
        ct = r.headers.get("Content-Type", "")
        if "pdf" not in ct.lower() and "octet-stream" not in ct.lower():
            raise ValueError(f"Unexpected Content-Type: {ct}")
        with open(tmp_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)

    digest = sha256_of(tmp_path)
    size = tmp_path.stat().st_size

    # Move to sha-bucketed path
    final_dir = cache_dir / digest[:2]
    final_dir.mkdir(parents=True, exist_ok=True)
    final_path = final_dir / f"{digest}.pdf"
    if not final_path.exists():
        tmp_path.rename(final_path)
    else:
        tmp_path.unlink()

    return final_path, digest, size


def load_pending(
    conn: psycopg.Connection,
    limit: int | None,
    facility_id: str | None,
) -> list[dict[str, Any]]:
    where = "download_status = 'pending'"
    params: list[Any] = []
    if facility_id:
        where += " AND facility_id = %s::uuid"
        params.append(facility_id)
    lim = f"LIMIT {int(limit)}" if limit else ""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id::text, facility_id::text, inspection_id::text,
                   license_number, source_url, inspection_date
            FROM il_inspection_inventory
            WHERE {where}
            ORDER BY created_at
            {lim}
            """,
            params,
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def mark_done(
    conn: psycopg.Connection,
    inv_id: str,
    local_path: Path,
    digest: str,
    size: int,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE il_inspection_inventory SET
                download_status = 'done',
                local_path      = %s,
                sha256          = %s,
                size_bytes      = %s,
                downloaded_at   = now(),
                updated_at      = now()
            WHERE id = %s::uuid
            """,
            (str(local_path), digest, size, inv_id),
        )


def mark_error(conn: psycopg.Connection, inv_id: str, msg: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE il_inspection_inventory SET
                download_status = 'error',
                download_error  = %s,
                updated_at      = now()
            WHERE id = %s::uuid
            """,
            (msg[:500], inv_id),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="IL PDF download from il_inspection_inventory")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--facility-id", help="Only download PDFs for this facility UUID")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_env()
    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    conn = get_conn()
    rows = load_pending(conn, args.limit, args.facility_id)
    print(f"  {len(rows)} PDFs pending download.", flush=True)

    if args.dry_run:
        for r in rows[:10]:
            print(f"  [dry-run] {r['license_number']} {r['inspection_date']} → {r['source_url'][:80]}")
        print(f"  ({len(rows)} total)")
        conn.close()
        return

    sess = make_session()
    done = err = 0
    try:
        for row in rows:
            inv_id  = row["id"]
            url     = row["source_url"]
            lic     = row["license_number"]
            idate   = row.get("inspection_date")
            print(f"  Downloading {lic} {idate} → {url[:80]}", flush=True)
            try:
                local_path, digest, size = download_pdf(sess, url, PDF_CACHE_DIR, inv_id)
                mark_done(conn, inv_id, local_path, digest, size)
                conn.commit()
                print(f"    → {size:,} bytes  sha256={digest[:12]}…", flush=True)
                done += 1
            except Exception as exc:
                mark_error(conn, inv_id, str(exc))
                conn.commit()
                print(f"    ERROR: {exc}", file=sys.stderr, flush=True)
                err += 1
            polite_sleep()
    finally:
        conn.close()

    print(f"\nDone. {done} downloaded, {err} errors.", flush=True)


if __name__ == "__main__":
    main()
