#!/usr/bin/env python3
"""
_state_signals_audit.py — Quick read-only diagnostic for cross-state signal coverage.

Prints a single table:

  state | facilities | has_insp | mc_explicit_name | mc_chain_curated |
        memory_care_disclosure_filed | apfm_listed | caring_listed |
        serves_memory_care | publishable | needs_review

Usage:
    python3 scrapers/_state_signals_audit.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


SQL = """
SELECT
  state_code,
  COUNT(*) AS facilities,
  COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM inspections i WHERE i.facility_id = f.id
    )
  ) AS has_insp,
  COUNT(*) FILTER (WHERE mc_signal_explicit_name) AS mc_explicit,
  COUNT(*) FILTER (WHERE mc_signal_chain_curated) AS mc_chain_curated,
  COUNT(*) FILTER (WHERE memory_care_disclosure_filed) AS disclosure_filed,
  COUNT(*) FILTER (WHERE mc_signal_apfm_listed) AS apfm,
  COUNT(*) FILTER (WHERE mc_signal_caring_listed) AS caring,
  COUNT(*) FILTER (WHERE serves_memory_care) AS serves_mc,
  COUNT(*) FILTER (WHERE publishable) AS publishable,
  COUNT(*) FILTER (WHERE mc_review_status = 'needs_review') AS needs_review
FROM facilities f
WHERE state_code IN ('CA','OR','WA','MN','TX')
  AND license_status = 'LICENSED'
GROUP BY state_code
ORDER BY state_code;
"""


def main() -> None:
    load_env()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    cols = [
        "state", "facilities", "has_insp", "mc_explicit", "mc_chain_curated",
        "disclosure", "apfm", "caring", "serves_mc", "publishable", "needs_review",
    ]
    print(" | ".join(f"{c:>14}" for c in cols))
    print("-" * (16 * len(cols)))

    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute(SQL)
        for row in cur.fetchall():
            print(" | ".join(f"{str(v):>14}" for v in row))


if __name__ == "__main__":
    main()
