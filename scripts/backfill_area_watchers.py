#!/usr/bin/env python3
"""Backfill state-level Area Watch signups captured before migration 0060."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
STATE_CODES = {
    "arizona": "AZ",
    "california": "CA",
    "illinois": "IL",
    "minnesota": "MN",
    "missouri": "MO",
    "oregon": "OR",
    "pennsylvania": "PA",
    "texas": "TX",
    "utah": "UT",
    "washington": "WA",
}


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            break


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill historical state Area Watch signups")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    load_env()
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")

    inserted = 0
    skipped_city = 0
    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT email, source, payload, created_at
            FROM submission_events
            WHERE event_type = 'area_watch'
            ORDER BY created_at
            """
        )
        for email, source, payload, created_at in cur.fetchall():
            payload = payload if isinstance(payload, dict) else {}
            area_slug = str(payload.get("areaSlug") or "").lower()
            area_name = str(payload.get("areaName") or "").strip()
            state_code = STATE_CODES.get(area_slug)
            if source != "state_modal" or not state_code:
                skipped_city += 1
                continue
            print(f"{email} → {area_name} ({state_code}), baseline {created_at}")
            if args.dry_run:
                continue
            cur.execute(
                """
                INSERT INTO area_watchers (
                  email,
                  area_name,
                  area_slug,
                  state_code,
                  source,
                  created_at,
                  baseline_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (email, state_code, area_slug) DO UPDATE SET
                  area_name = EXCLUDED.area_name,
                  source = EXCLUDED.source,
                  active = true,
                  baseline_at = LEAST(area_watchers.baseline_at, EXCLUDED.baseline_at)
                """,
                (
                    email.strip().lower(),
                    area_name,
                    area_slug,
                    state_code,
                    source,
                    created_at,
                    created_at,
                ),
            )
            inserted += cur.rowcount
        if args.dry_run:
            conn.rollback()

    print(f"Backfill complete: {inserted} upserted, {skipped_city} city signups skipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
