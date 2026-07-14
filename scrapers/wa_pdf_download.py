#!/usr/bin/env python3
"""
WA PDF Download — Wave 1a, Step 1.

Walks the `deficiencies` table for WA facilities looking for `inspector_narrative`
values that are PDF URLs (patterns from BHForms.aspx and AFHForms.aspx).

For each URL found:
  1. Upserts a row into `wa_pdf_inventory` (pending by default).
  2. Downloads the PDF to a local cache directory (.firecrawl/wa-pdfs/<sha256[:2]>/<sha256>.pdf).
  3. Computes sha256, records size_bytes, marks download_status='done'.

Rate limit: 1 req/sec + jitter against fortress.wa.gov.

Usage:
  python3 scrapers/wa_pdf_download.py                   # all pending
  python3 scrapers/wa_pdf_download.py --limit 20        # first 20
  python3 scrapers/wa_pdf_download.py --facility-id ID  # one facility
  python3 scrapers/wa_pdf_download.py --dry-run         # discover URLs, no download
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
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import make_session, polite_sleep

PDF_CACHE_DIR = REPO_ROOT / ".firecrawl" / "wa-pdfs"

# WA DSHS PDF URLs — actual format is RCSForms/BH/<lic>/inspections/<year>/<filename>.pdf
# Filenames contain spaces, so we match up to .pdf (case-insensitive)
_PDF_URL_RE = __import__("re").compile(
    r"https?://fortress\.wa\.gov/dshs/adsaapps/lookup/RCSForms/[^\r\n\"'<>]*?\.pdf",
    __import__("re").IGNORECASE,
)

# Broad fallback: any fortress.wa.gov URL ending in .pdf (allows spaces in path)
_PDF_URL_BROAD_RE = __import__("re").compile(
    r"https?://fortress\.wa\.gov/[^\r\n\"'<>]*?\.pdf",
    __import__("re").IGNORECASE,
)

# The literal placeholder prefix written by wa_inspections_ingest.py
_WA_PLACEHOLDER_PREFIX = "WA DSHS report:"


def _extract_pdf_url(text: str | None) -> str | None:
    """Pull the first PDF URL out of a deficiency narrative/description field."""
    if not text:
        return None
    for pattern in (_PDF_URL_RE, _PDF_URL_BROAD_RE):
        m = pattern.search(text)
        if m:
            return m.group(0).strip()
    # Also handle bare URLs in placeholder-style text
    if text.startswith(_WA_PLACEHOLDER_PREFIX):
        url_part = text[len(_WA_PLACEHOLDER_PREFIX):].strip()
        if url_part.lower().startswith("http"):
            return url_part.split()[0]
    return None


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


def discover_pdf_urls(
    conn: psycopg.Connection,
    facility_id: str | None = None,
) -> list[dict[str, Any]]:
    """
    Query deficiencies for WA facilities and extract PDF URLs from
    inspector_narrative and description fields.

    Returns list of dicts with keys: facility_id, license_number, source_url,
    inspection_date, deficiency_id.
    """
    sql = """
        SELECT DISTINCT ON (
            COALESCE(d.inspector_narrative, d.description)
        )
            f.id         AS facility_id,
            f.license_number,
            i.inspection_date,
            d.id         AS deficiency_id,
            d.inspector_narrative,
            d.description
        FROM deficiencies d
        JOIN inspections i   ON i.id = d.inspection_id
        JOIN facilities  f   ON f.id = i.facility_id
        WHERE f.state_code = 'WA'
          AND (
            d.inspector_narrative ~ '^https?://'
            OR d.description       ~ '^WA DSHS report:'
            OR d.description       ~ '^https?://'
          )
          {facility_filter}
        ORDER BY COALESCE(d.inspector_narrative, d.description)
    """
    facility_filter = "AND f.id = %s" if facility_id else ""
    params: list[Any] = []
    if facility_id:
        params.append(facility_id)

    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(sql.format(facility_filter=facility_filter), params)
        rows = cur.fetchall()

    results: list[dict[str, Any]] = []
    for row in rows:
        url = _extract_pdf_url(row["inspector_narrative"]) or _extract_pdf_url(
            row["description"]
        )
        if url:
            results.append(
                {
                    "facility_id": str(row["facility_id"]),
                    "license_number": row["license_number"] or "",
                    "source_url": url,
                    "inspection_date": row["inspection_date"],
                    "deficiency_id": str(row["deficiency_id"]),
                }
            )
    return results


def upsert_inventory_rows(
    conn: psycopg.Connection,
    rows: list[dict[str, Any]],
) -> int:
    """Insert discovered URLs into wa_pdf_inventory (skip if url already present)."""
    if not rows:
        return 0
    params = [
        (row["facility_id"], row["license_number"], row["source_url"], row["inspection_date"])
        for row in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO wa_pdf_inventory
              (facility_id, license_number, source_url, inspection_date)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (source_url) DO NOTHING
            """,
            params,
        )
        count = cur.rowcount
    conn.commit()
    return max(count, 0)


def sha256_of_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def cache_path_for(sha: str) -> Path:
    return PDF_CACHE_DIR / sha[:2] / f"{sha}.pdf"


def download_pending(
    conn: psycopg.Connection,
    session: requests.Session,
    *,
    limit: int | None = None,
    dry_run: bool = False,
) -> tuple[int, int]:
    """Download all pending inventory rows. Returns (done, error) counts."""
    created_after = os.environ.get("STATE_SCAN_STARTED_AT")
    sql = """
        SELECT id, source_url, facility_id, license_number
        FROM wa_pdf_inventory
        WHERE download_status = 'pending'
          {created_after_filter}
        ORDER BY created_at
    """
    created_after_filter = "AND created_at >= %s::timestamptz" if created_after else ""
    params: list[Any] = [created_after] if created_after else []
    if limit:
        sql += f" LIMIT {limit}"

    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(sql.format(created_after_filter=created_after_filter), params)
        pending = cur.fetchall()

    print(f"  {len(pending)} pending PDFs to download")
    done = 0
    errors = 0

    for row in pending:
        inv_id = str(row["id"])
        url = row["source_url"]

        if dry_run:
            print(f"  DRY-RUN  {url}")
            continue

        # Mark downloading
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE wa_pdf_inventory SET download_status='downloading' WHERE id=%s",
                (inv_id,),
            )
        conn.commit()

        try:
            resp = session.get(url, timeout=60)
            resp.raise_for_status()
            data = resp.content

            sha = sha256_of_bytes(data)
            dest = cache_path_for(sha)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE wa_pdf_inventory
                    SET download_status='done',
                        sha256=%s,
                        size_bytes=%s,
                        local_path=%s,
                        downloaded_at=now()
                    WHERE id=%s
                    """,
                    (sha, len(data), str(dest), inv_id),
                )
            conn.commit()
            done += 1
            print(f"  OK  {sha[:12]}…  {len(data)//1024}KB  {url[:80]}")

        except Exception as exc:
            errors += 1
            err_msg = str(exc)[:500]
            print(f"  ERR  {url[:80]}  → {err_msg[:80]}", file=sys.stderr)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE wa_pdf_inventory
                    SET download_status='error', download_error=%s
                    WHERE id=%s
                    """,
                    (err_msg, inv_id),
                )
            conn.commit()

        polite_sleep(1.0, 0.3)

    return done, errors


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="WA PDF download — Wave 1a step 1")
    parser.add_argument("--facility-id", help="Process one facility UUID only")
    parser.add_argument("--limit", type=int, help="Max PDFs to download this run")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Discover and upsert inventory rows but do not download",
    )
    args = parser.parse_args(argv)

    load_env()
    PDF_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    print("=== WA PDF Download ===")
    conn = get_conn()
    session = make_session()

    # Step 1: discover URLs from deficiencies
    print("Step 1: Discovering PDF URLs from deficiencies…")
    discovered = discover_pdf_urls(conn, facility_id=args.facility_id)
    print(f"  Found {len(discovered)} unique PDF URLs")

    # Step 2: upsert into inventory
    print("Step 2: Upserting into wa_pdf_inventory…")
    inserted = upsert_inventory_rows(conn, discovered)
    print(f"  Inserted {inserted} new rows (duplicates skipped)")

    # Step 3: download pending
    print("Step 3: Downloading PDFs…")
    done, errors = download_pending(
        conn,
        session,
        limit=args.limit,
        dry_run=args.dry_run,
    )
    print(f"\nDone: {done}  Errors: {errors}")
    conn.close()


if __name__ == "__main__":
    main()
