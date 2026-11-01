#!/usr/bin/env python3
"""Record Illinois LLCS document attempts without inventing a PDF URL.

The public portal does not publish a document address we can guess. This
script writes a local attempt line for each stored visit and inserts
il_inspection_inventory only when a person supplies a real PDF URL.

Usage:
    python3 scrapers/il_llcs_documents.py
    python3 scrapers/il_llcs_documents.py --import-csv path.csv
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parent.parent
ATTEMPT_PATH = REPO_ROOT / "scrapers" / "data" / "il_llcs" / "attempts.jsonl"
AGENCY = "IDPH-DAL"


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            return


def database_url() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit("DATABASE_URL not set")
    return url


def record_attempts() -> int:
    """One line per stored visit. No inventory row, because there is no PDF URL."""
    ATTEMPT_PATH.parent.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    if ATTEMPT_PATH.is_file():
        for line in ATTEMPT_PATH.read_text().splitlines():
            if not line.strip():
                continue
            try:
                seen.add(json.loads(line)["inspection_id"])
            except (json.JSONDecodeError, KeyError):
                continue
    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT i.id::text AS inspection_id, i.inspection_date
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.state_code = 'IL' AND i.source_agency = %s
                ORDER BY i.inspection_date
                """,
                (AGENCY,),
            )
            rows = list(cur.fetchall())
    added = 0
    with ATTEMPT_PATH.open("a") as handle:
        for row in rows:
            if row["inspection_id"] in seen:
                continue
            handle.write(json.dumps({
                "inspection_id": row["inspection_id"],
                "inspection_date": row["inspection_date"].isoformat() if row["inspection_date"] else None,
                "result": "no_public_document_url",
                "reason": "needs_session",
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            }) + "\n")
            added += 1
    print(f"Recorded {added} new attempts. {len(rows) - added} were already on file.", flush=True)
    print("No inventory rows were inserted. A PDF URL has to be supplied with --import-csv.", flush=True)
    return added


def import_csv(path: Path, dry_run: bool) -> None:
    """CSV columns: facility_id, inspection_id, license_number, pdf_url, inspection_date, doc_type.

    pdf_url must be an http(s) URL. A blank or guessed portal hash is refused.
    """
    with path.open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    accepted: list[dict[str, Any]] = []
    for row in rows:
        url = (row.get("pdf_url") or "").strip()
        lowered = url.lower()
        portal_shell = "/s/?" in lowered or lowered.rstrip("/").endswith("/s")
        if not url.startswith(("https://", "http://")) or portal_shell:
            print(f"Refusing URL that is not a document: {url or '(blank)'}", flush=True)
            continue
        if not row.get("facility_id") or not row.get("license_number"):
            print("Refusing a row without a facility id and the directory license already on file.", flush=True)
            continue
        accepted.append(row)
    print(f"{len(accepted)} of {len(rows)} rows have a real document URL.", flush=True)
    if dry_run or not accepted:
        return
    with psycopg.connect(database_url(), autocommit=True) as conn:
        with conn.cursor() as cur:
            for row in accepted:
                cur.execute(
                    """
                    INSERT INTO il_inspection_inventory (
                        facility_id, inspection_id, license_number,
                        source_url, doc_type, inspection_date
                    ) VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s)
                    ON CONFLICT (source_url) DO NOTHING
                    """,
                    (
                        row["facility_id"],
                        row.get("inspection_id") or None,
                        row["license_number"],
                        row["pdf_url"].strip(),
                        (row.get("doc_type") or "inspection").strip() or "inspection",
                        row.get("inspection_date") or None,
                    ),
                )
    print("Inventory insert finished. Existing URLs were left in place.", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Illinois LLCS document attempts")
    parser.add_argument("--import-csv")
    parser.add_argument("--mark-manual", help="Same as --import-csv")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    load_env()
    csv_path = args.import_csv or args.mark_manual
    if csv_path:
        import_csv(Path(csv_path), args.dry_run)
        return
    record_attempts()


if __name__ == "__main__":
    main()
