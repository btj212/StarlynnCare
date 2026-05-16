#!/usr/bin/env python3
"""
WA Signal: Memory Care Certification (Wave 2b).

Writes wa_memory_care_certified = true for facilities that hold a Washington
state Memory Care unit certification.

Source (primary): DSHS online lookup (when publicly available)
  or PRR-supplied master list (CSV/XLSX exported from DSHS)

Until a stable public URL is confirmed, this script:
  1. Reads a local CSV/Excel file (--file) with license numbers of certified facilities.
  2. Upserts wa_memory_care_certified = true for matching WA facilities.
  3. Also accepts --license flags for one-off corrections.

Usage:
  python3 scrapers/wa_signal_memory_care_cert.py --file /path/to/mc_cert_list.csv
  python3 scrapers/wa_signal_memory_care_cert.py --license 1234567890 --license 0987654321
  python3 scrapers/wa_signal_memory_care_cert.py --file list.csv --dry-run
  python3 scrapers/wa_signal_memory_care_cert.py --clear-all   # reset all to false (use carefully)
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent


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


def pad_wa_license(raw: Any) -> str:
    if raw is None or str(raw).strip() == "":
        return ""
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return ""
    return digits.zfill(10)


def load_licenses_from_csv(path: Path) -> list[str]:
    """Read license numbers from a CSV file. Auto-detects the license column."""
    licenses: list[str] = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        headers = list(reader.fieldnames or [])
        col = None
        for h in headers:
            nk = re.sub(r"[^a-z0-9]", "", (h or "").lower())
            if "licens" in nk or nk in ("lic", "licnum", "licno"):
                col = h
                break
        if not col and headers:
            col = headers[0]
        for row in reader:
            raw = row.get(col or "", "")
            lic = pad_wa_license(raw)
            if lic:
                licenses.append(lic)
    return licenses


def stamp_certified(
    conn: psycopg.Connection,
    licenses: list[str],
    *,
    dry_run: bool = False,
) -> int:
    """Set wa_memory_care_certified=true for the given license numbers. Returns count updated."""
    if not licenses:
        return 0
    if dry_run:
        print(f"  DRY-RUN: would certify {len(licenses)} facilities")
        return 0
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE facilities
            SET wa_memory_care_certified = true,
                updated_at = now()
            WHERE state_code = 'WA'
              AND license_number = ANY(%s)
            """,
            (licenses,),
        )
        count = cur.rowcount
    conn.commit()
    return count


def clear_all_certified(conn: psycopg.Connection, *, dry_run: bool = False) -> int:
    if dry_run:
        print("  DRY-RUN: would clear all wa_memory_care_certified for WA")
        return 0
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE facilities SET wa_memory_care_certified = false WHERE state_code='WA'"
        )
        count = cur.rowcount
    conn.commit()
    return count


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="WA signal: memory care certification")
    parser.add_argument("--file", type=Path, help="CSV file with license numbers")
    parser.add_argument("--license", action="append", dest="licenses", default=[])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--clear-all",
        action="store_true",
        help="Reset all WA facilities to wa_memory_care_certified=false",
    )
    args = parser.parse_args(argv)

    load_env()
    conn = get_conn()
    print("=== WA Signal: Memory Care Certification ===")

    if args.clear_all:
        n = clear_all_certified(conn, dry_run=args.dry_run)
        print(f"  Cleared {n} WA facilities")
        conn.close()
        return

    licenses: list[str] = []
    if args.file:
        licenses.extend(load_licenses_from_csv(args.file))
        print(f"  Loaded {len(licenses)} licenses from {args.file.name}")
    for lic in args.licenses:
        padded = pad_wa_license(lic)
        if padded:
            licenses.append(padded)

    if not licenses:
        print("  Nothing to do. Pass --file or --license.")
        conn.close()
        return

    print(f"  Stamping {len(licenses)} licenses as Memory Care Certified…")
    n = stamp_certified(conn, licenses, dry_run=args.dry_run)
    print(f"  Updated: {n}")
    conn.close()


if __name__ == "__main__":
    main()
