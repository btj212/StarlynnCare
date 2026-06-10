#!/usr/bin/env python3
"""
Layer 5b — Post-ingest hub-content drift audit.

For every city hub_content row, recompute the region's grounded stats from the
LIVE DB (reusing `compute_stats` from the generator — single source of truth,
no duplicated SQL) and compare each numeric STAT_KEY against the row's stored
`stats_snapshot`. Any mismatch means a number the page renders would now be
wrong, so the row is flagged `drift_detected = true`. The public read policy
then hides it and the city page falls back to live dynamic stats until a human
regenerates the draft and re-approves it.

Accuracy model (no human checks the numbers):
  * Comparison is EXACT, not thresholded. The prose renders these exact numbers,
    so on a YMYL directory any change is a wrong number — a one-facility move
    (93 -> 94) is drift.
  * Covers ALL statuses (draft / in_review / published), not just published: the
    admin approval gate refuses to publish a drift-flagged row, so drafts must
    be audited too for that guard to mean anything.
  * Set-only: the audit flips drift_detected to true but NEVER clears it. Drift
    is cleared by regenerating the draft (generate_hub_content.py resets the
    snapshot + the flag) and re-approving — per migration 0047's design.
  * Non-numeric context (last_inspection_date) is not audited.

County rows are skipped: compute_stats keys by city_slug, and Phase 1 only
generates city hubs. Revisit when county hub content ships.

NOTE: like every scraper here this uses psycopg over DATABASE_URL (raw
Postgres), so it runs from GitHub Actions or Cursor, NOT from Claude Code on the
web (the web sandbox proxies HTTP/HTTPS only).

Usage
-----
  python hub_content_drift_check.py                 # audit all states, write flags
  python hub_content_drift_check.py --state CA      # one state only
  python hub_content_drift_check.py --dry-run       # report only, no DB writes

Exit code is 0 on a successful audit (flagging drift IS the success path — the
pages auto-suppress). Non-zero only on an operational error (no DATABASE_URL, DB
failure), so a normal post-ingest run with drift does not fail the job.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

# Reuse the generator's snapshot computation verbatim (single source of truth).
# scrapers/ is an implicit namespace package once REPO_ROOT is on sys.path.
REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))
from scrapers.generate_hub_content import compute_stats, STAT_KEYS  # noqa: E402


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def load_rows(
    conn: psycopg.Connection, *, state_code: str | None
) -> list[dict[str, Any]]:
    """All city hub_content rows (optionally one state), newest first."""
    query = """
        SELECT id, state_code, region_slug, status, drift_detected, stats_snapshot
        FROM hub_content
        WHERE region_kind = 'city'
    """
    params: dict[str, Any] = {}
    if state_code:
        query += " AND state_code = %(state)s"
        params["state"] = state_code.upper()
    query += " ORDER BY updated_at DESC"
    with conn.cursor() as cur:
        cur.execute(query, params)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def diff_snapshot(
    stored: dict[str, Any], live: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    """Per-key exact comparison of the numeric STAT_KEYS. Returns {key: {stored, live}} for mismatches."""
    drift: dict[str, dict[str, Any]] = {}
    for key in STAT_KEYS:
        stored_val = stored.get(key)
        live_val = live.get(key)
        if stored_val is None or int(stored_val) != int(live_val):
            drift[key] = {"stored": stored_val, "live": live_val}
    return drift


def flag_drift(
    conn: psycopg.Connection, *, row_id: str, details: dict[str, Any]
) -> None:
    with conn.cursor() as cur:
        cur.execute("SAVEPOINT sp")
        try:
            cur.execute(
                """
                UPDATE hub_content
                   SET drift_detected = true,
                       drift_details = %(details)s,
                       last_audit_at = now()
                 WHERE id = %(id)s
                """,
                {"id": row_id, "details": psycopg.types.json.Jsonb(details)},
            )
            cur.execute("RELEASE SAVEPOINT sp")
        except Exception:
            cur.execute("ROLLBACK TO SAVEPOINT sp")
            raise
    conn.commit()


def mark_audited(conn: psycopg.Connection, *, row_id: str) -> None:
    """Refresh last_audit_at on a clean row. Never clears an existing drift flag (see module docstring)."""
    with conn.cursor() as cur:
        cur.execute("SAVEPOINT sp")
        try:
            cur.execute(
                "UPDATE hub_content SET last_audit_at = now() WHERE id = %(id)s",
                {"id": row_id},
            )
            cur.execute("RELEASE SAVEPOINT sp")
        except Exception:
            cur.execute("ROLLBACK TO SAVEPOINT sp")
            raise
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="StarlynnCare Layer 5b — hub content drift audit"
    )
    parser.add_argument(
        "--state", default=None, help="Audit one state only (e.g. CA). Default: all states."
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Report findings only; no DB writes."
    )
    args = parser.parse_args()

    load_env()
    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    dsn = os.environ["DATABASE_URL"]
    print("=" * 60, flush=True)
    print("StarlynnCare — Layer 5b: hub content drift audit", flush=True)
    if args.dry_run:
        print("(DRY RUN — no DB writes)", flush=True)
    print("=" * 60, flush=True)

    audited = 0
    flagged = 0

    with psycopg.connect(dsn) as conn:
        rows = load_rows(conn, state_code=args.state)
        for row in rows:
            audited += 1
            slug = row["region_slug"]
            live = compute_stats(
                conn, state_code=row["state_code"], city_slug=slug
            )
            stored = row["stats_snapshot"] or {}
            drift = diff_snapshot(stored, live)

            if drift:
                flagged += 1
                deltas = ", ".join(
                    f"{k}: {v['stored']}→{v['live']}" for k, v in drift.items()
                )
                print(
                    f"  ⚠ DRIFT  {slug} ({row['state_code']}, {row['status']}): {deltas}",
                    flush=True,
                )
                if not args.dry_run:
                    flag_drift(conn, row_id=row["id"], details=drift)
            else:
                if not args.dry_run:
                    mark_audited(conn, row_id=row["id"])

    print("=" * 60, flush=True)
    print(f"  Rows audited : {audited}", flush=True)
    print(f"  Drift flagged: {flagged}", flush=True)
    if flagged and not args.dry_run:
        print(
            f"  → {flagged} page(s) auto-suppressed until regenerated + re-approved.",
            flush=True,
        )
    print("=" * 60, flush=True)
    # Exit 0 even with drift: flagging is the success path, not a failure.


if __name__ == "__main__":
    main()
