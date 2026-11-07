#!/usr/bin/env python3
"""Enroll past records requesters in free Facility Watch.

Dry run by default. Nothing is written unless --approve is passed.
Does not send email and does not call Loops. baseline_at is set to now,
so nobody receives inspections that were already on file.

Texas, Missouri, and Colorado stay out: those scans are not dependable
enough to promise an update. Tour-pack rows stay one-time.

Pass --exclude for anyone who must stay off the list. Repeat the flag
for more than one address. Comparison is case-insensitive.
"""

from __future__ import annotations

import argparse
import os
import secrets
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parents[1]
# Keep aligned with PAID_WATCH_EXCLUDED_STATE_CODES in src/lib/facility-watch/paidConfig.ts.
EXCLUDED_STATES = ("TX", "MO", "CO")
RECORDS_SOURCES = ("offer_records", "records_pull_interest")

CANDIDATES_SQL = """
SELECT w.id::text AS id,
       w.email,
       w.facility_id::text AS facility_id,
       w.source,
       f.state_code,
       f.name AS facility_name,
       p.email AS preference_email
FROM facility_watchers w
JOIN facilities f ON f.id = w.facility_id
LEFT JOIN customer_preferences p ON p.email = w.email
WHERE w.alerts_eligible = false
  AND w.confirmed_at IS NOT NULL
  AND w.source = ANY(%s)
  AND NOT (f.state_code = ANY(%s))
  AND NOT COALESCE(p.unsubscribed_all, false)
  AND NOT ('facility_watch' = ANY(COALESCE(p.unsubscribed_products, '{}'::text[])))
ORDER BY f.state_code, f.name, w.email
"""


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            break


def get_conn() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    return psycopg.connect(url)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--approve",
        action="store_true",
        help="Write the enrollment. Without this flag the script only prints.",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        metavar="EMAIL",
        help="Email address to leave out. Repeat for more than one.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    excluded = {email.strip().lower() for email in args.exclude if email.strip()}
    load_env()

    with get_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(CANDIDATES_SQL, (list(RECORDS_SOURCES), list(EXCLUDED_STATES)))
            rows = [dict(row) for row in cur.fetchall()]

        chosen = [row for row in rows if row["email"].lower() not in excluded]
        held = [row for row in rows if row["email"].lower() in excluded]

        print(
            f"{'Enrolling' if args.approve else 'Would enroll'} "
            f"{len(chosen)} row(s) across {len({row['email'] for row in chosen})} email(s)."
        )
        print("Texas, Missouri, and Colorado are excluded. Tour-pack rows are excluded.")
        for row in chosen:
            print(
                f"  {row['state_code']}  {row['email']}  {row['facility_name']}  ({row['source']})"
            )
        if held:
            print(f"Held back by --exclude: {len(held)}")
            for row in held:
                print(f"  {row['state_code']}  {row['email']}  {row['facility_name']}")

        if not args.approve:
            print("Dry run. Pass --approve to write.")
            return 0

        if not chosen:
            print("Nothing to write.")
            return 0

        with conn.transaction():
            with conn.cursor() as cur:
                for row in chosen:
                    if not row["preference_email"]:
                        cur.execute(
                            """
                            INSERT INTO customer_preferences (email, token)
                            VALUES (%s, %s)
                            ON CONFLICT (email) DO NOTHING
                            """,
                            (row["email"], secrets.token_hex(32)),
                        )
                    cur.execute(
                        """
                        UPDATE facility_watchers
                        SET alerts_eligible = true,
                            baseline_at = now()
                        WHERE id = %s
                          AND alerts_eligible = false
                        """,
                        (row["id"],),
                    )
                    cur.execute(
                        """
                        INSERT INTO customer_commitments (
                          email, product, subject_key, source, status,
                          facility_id, metadata, consent_at
                        )
                        VALUES (
                          %s, 'facility_watch', %s, 'records_watch_backfill', 'active',
                          %s, '{"backfill": true}'::jsonb, now()
                        )
                        ON CONFLICT (email, product, subject_key) DO NOTHING
                        """,
                        (row["email"], row["facility_id"], row["facility_id"]),
                    )
        print(f"Enrolled {len(chosen)} row(s). No email was sent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
