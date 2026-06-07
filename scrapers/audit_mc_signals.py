#!/usr/bin/env python3
"""
One-shot audit of the tiered MC signal model.

Reads only — no writes. Prints:

  1. Per-state-code totals (LICENSED + publishable + needs_review).
  2. Signal-source breakdown for currently-publishable rows.
  3. Tier-1 vs Tier-2 (directory) overlap matrix.
  4. Sanity warnings:
     - publishable=true but ZERO MC signals
     - needs_review with a Tier-1 signal already present (queue stale)
     - MC-only chain auto-confirm chains with mc_review_status='needs_review'

Usage:
  python3 scrapers/audit_mc_signals.py
  python3 scrapers/audit_mc_signals.py --state CA
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STATE = "CA"


def load_env() -> None:
    for n in (".env.local", ".env"):
        p = REPO_ROOT / n
        if p.is_file():
            load_dotenv(p)


def hr(title: str) -> None:
    print()
    print("=" * 72)
    print(title)
    print("=" * 72)


def fetchone(cur: psycopg.Cursor, sql: str, params: tuple = ()) -> tuple:
    cur.execute(sql, params)
    row = cur.fetchone()
    return row or ()


def fetchall(cur: psycopg.Cursor, sql: str, params: tuple = ()) -> list[tuple]:
    cur.execute(sql, params)
    return cur.fetchall()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", default=DEFAULT_STATE)
    args = parser.parse_args()

    load_env()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    state = args.state

    with psycopg.connect(dsn) as conn, conn.cursor() as cur:

        hr(f"1. Top-line counts ({state}, LICENSED only)")
        row = fetchone(
            cur,
            """
            SELECT
              COUNT(*)                                                AS licensed,
              COUNT(*) FILTER (WHERE serves_memory_care)              AS serves_mc,
              COUNT(*) FILTER (WHERE publishable)                     AS publishable,
              COUNT(*) FILTER (WHERE mc_review_status='needs_review') AS needs_review,
              COUNT(*) FILTER (WHERE mc_review_status='reviewed_publish') AS reviewed_publish,
              COUNT(*) FILTER (WHERE mc_review_status='reviewed_reject')  AS reviewed_reject
            FROM facilities
            WHERE state_code = %s AND license_status='LICENSED'
            """,
            (state,),
        )
        labels = (
            "LICENSED total",
            "serves_memory_care=true",
            "publishable=true",
            "queue: needs_review",
            "queue: reviewed_publish",
            "queue: reviewed_reject",
        )
        for label, value in zip(labels, row):
            print(f"  {label:<28} {value:>5}")

        hr("2. Per-county counts (LICENSED, publishable)")
        rows = fetchall(
            cur,
            """
            SELECT
              COALESCE(NULLIF(city_slug,''), '(none)') AS slug,
              COUNT(*) FILTER (WHERE license_status='LICENSED')                            AS licensed,
              COUNT(*) FILTER (WHERE license_status='LICENSED' AND publishable)            AS publishable,
              COUNT(*) FILTER (WHERE license_status='LICENSED' AND mc_review_status='needs_review') AS needs_review
            FROM facilities
            WHERE state_code = %s
            GROUP BY 1
            ORDER BY publishable DESC
            LIMIT 25
            """,
            (state,),
        )
        print(f"  {'city_slug':<32} {'licensed':>9} {'pub':>5} {'needs':>6}")
        for slug, lic, pub, nr in rows:
            print(f"  {slug:<32} {lic:>9} {pub:>5} {nr:>6}")

        hr("3. Signal-source breakdown for currently publishable=true rows")
        row = fetchone(
            cur,
            """
            SELECT
              COUNT(*) FILTER (WHERE mc_signal_explicit_name)            AS explicit_name,
              COUNT(*) FILTER (WHERE memory_care_disclosure_filed)       AS disclosure_filed,
              COUNT(*) FILTER (WHERE mc_signal_chain_curated)            AS chain_curated,
              COUNT(*) FILTER (WHERE mc_signal_chain_name)               AS chain_name_pattern,
              COUNT(*) FILTER (WHERE mc_signal_apfm_listed)              AS apfm_listed,
              COUNT(*) FILTER (WHERE mc_signal_caring_listed)            AS caring_listed,
              COUNT(*) FILTER (WHERE mc_signal_deficiency_keyword)       AS deficiency_keyword,
              COUNT(*) FILTER (WHERE mc_review_status='reviewed_publish') AS manual_publish
            FROM facilities
            WHERE state_code = %s AND license_status='LICENSED' AND publishable
            """,
            (state,),
        )
        labels = (
            "explicit name pattern",
            "memory_care_disclosure_filed",
            "chain_curated (operator confirmed)",
            "chain_name_pattern (chain only)",
            "APFM listed",
            "Caring.com listed",
            "deficiency §87705/87706",
            "manual reviewer publish",
        )
        for label, value in zip(labels, row):
            print(f"  {label:<38} {value:>5}")

        hr("4. Overlap: government-data-only vs needs-directory-help")
        row = fetchone(
            cur,
            """
            SELECT
              COUNT(*) FILTER (
                WHERE publishable
                  AND (mc_signal_explicit_name
                       OR memory_care_disclosure_filed
                       OR mc_signal_chain_curated
                       OR mc_signal_deficiency_keyword
                       OR mc_review_status='reviewed_publish')
              ) AS gov_or_chain_or_manual,
              COUNT(*) FILTER (
                WHERE publishable
                  AND NOT mc_signal_explicit_name
                  AND NOT memory_care_disclosure_filed
                  AND NOT mc_signal_chain_curated
                  AND NOT mc_signal_deficiency_keyword
                  AND mc_review_status <> 'reviewed_publish'
                  AND (mc_signal_apfm_listed OR mc_signal_caring_listed)
              ) AS only_directories
            FROM facilities
            WHERE state_code = %s AND license_status='LICENSED'
            """,
            (state,),
        )
        print(f"  publishable via gov data / chain / human reviewer : {row[0]:>5}")
        print(f"  publishable ONLY because of APFM/Caring listing   : {row[1]:>5}")
        print()
        print("  → If 'only_directories' is small, the directory scrape")
        print("    is mostly providing redundant evidence (cheap to drop).")

        hr("5. Sanity warnings")

        # publishable=true with NO MC signal at all (manual override only)
        rows = fetchall(
            cur,
            """
            SELECT id, name, city, mc_review_status
            FROM facilities
            WHERE state_code = %s
              AND license_status='LICENSED'
              AND publishable
              AND NOT mc_signal_explicit_name
              AND NOT memory_care_disclosure_filed
              AND NOT mc_signal_chain_curated
              AND NOT mc_signal_chain_name
              AND NOT mc_signal_deficiency_keyword
              AND NOT mc_signal_apfm_listed
              AND NOT mc_signal_caring_listed
              AND mc_review_status <> 'reviewed_publish'
            LIMIT 25
            """,
            (state,),
        )
        print(f"  [!] publishable=true with ZERO MC signals (manual override absent): {len(rows)}")
        for fid, name, city, status in rows[:5]:
            print(f"      {name} — {city} ({status})")

        # needs_review with a Tier-1 signal already present (recompute should have promoted)
        rows = fetchall(
            cur,
            """
            SELECT name, city
            FROM facilities
            WHERE state_code = %s
              AND license_status='LICENSED'
              AND mc_review_status='needs_review'
              AND (
                   mc_signal_explicit_name
                OR memory_care_disclosure_filed
                OR mc_signal_chain_curated
                OR mc_signal_apfm_listed
                OR mc_signal_caring_listed
              )
            LIMIT 25
            """,
            (state,),
        )
        print()
        print(f"  [!] needs_review BUT already has Tier-1 signal (recompute would auto-publish): {len(rows)}")
        for name, city in rows[:5]:
            print(f"      {name} — {city}")

        # MC-only chain names that are still needs_review (auto-confirm should cover)
        rows = fetchall(
            cur,
            """
            SELECT name, city
            FROM facilities
            WHERE state_code = %s
              AND license_status='LICENSED'
              AND mc_review_status='needs_review'
              AND (
                   name ILIKE %s
                OR name ILIKE %s
                OR name ILIKE %s
                OR name ILIKE %s
              )
            LIMIT 25
            """,
            (state, "silverado%", "belmont village%", "aegis%", "activcare%"),
        )
        print()
        print(f"  [!] MC-only chain (Silverado/Belmont/Aegis/ActivCare) still in needs_review: {len(rows)}")
        for name, city in rows[:10]:
            print(f"      {name} — {city}")

        hr("6. Citation evidence (Tier-1 government signal)")
        row = fetchone(
            cur,
            """
            SELECT COUNT(DISTINCT i.facility_id)
            FROM deficiencies d
            JOIN inspections  i ON i.id = d.inspection_id
            JOIN facilities   f ON f.id = i.facility_id
            WHERE f.state_code = %s
              AND (d.description ILIKE %s OR d.description ILIKE %s
                OR COALESCE(d.ftag,'') ILIKE %s OR COALESCE(d.ftag,'') ILIKE %s)
            """,
            (state, "%87705%", "%87706%", "%87705%", "%87706%"),
        )
        print(f"  facilities with §87705/§87706 citation in DB: {row[0] if row else 0}")

        hr("7. Queue auto-verification (if any rows in mc_queue_evidence)")
        try:
            row = fetchone(
                cur,
                """
                SELECT
                  COUNT(*),
                  COUNT(*) FILTER (WHERE verdict='mc_yes'),
                  COUNT(*) FILTER (WHERE verdict='mc_no'),
                  COUNT(*) FILTER (WHERE verdict='uncertain')
                FROM mc_queue_evidence
                """,
            )
            total, yes, no, unc = row
            print(f"  total evidence rows : {total}")
            print(f"    mc_yes            : {yes}")
            print(f"    mc_no             : {no}")
            print(f"    uncertain         : {unc}")
        except psycopg.errors.UndefinedTable:
            print("  (mc_queue_evidence table not present; migration 0012 not applied yet)")
            conn.rollback()


if __name__ == "__main__":
    main()
