#!/usr/bin/env python3
"""
Layer 5b — Post-ingest hub-content drift audit (self-healing).

For every city hub_content row, recompute the region's grounded stats from the
LIVE DB (reusing `compute_stats` from the generator — single source of truth,
no duplicated SQL) and compare each numeric STAT_KEY against the row's stored
`stats_snapshot`.

When a number has moved, the audit REPAIRS the row in place instead of
suppressing it (2026-07 change; see MEMORY.md):
  * Every <span data-stat="KEY"> in the body is rewritten with the live value
    (deterministic string surgery — no model, no re-generation).
  * The patched body is re-verified with the generator's own `verify_stats`
    gate against the live snapshot; only a passing body is written.
  * `stats_snapshot` is refreshed to the live values, so the admin editor's
    save/publish gates keep working against current numbers.
  * Status / approval provenance are untouched — approved prose stays live.

Repair is REFUSED — the row is flagged `drift_detected = true` and hidden by
the public read policy, exactly like the old behavior — when the change could
invalidate the prose *around* the number, not just the number itself:
  * any metric crossing zero (prose like "none have a serious citation"),
  * pct_with_serious crossing the 50% majority line, or moving > 25 points
    (prose like "most", "about a third"),
  * any count more than doubling or halving (prose scale words),
  * a stored snapshot missing a metric, nested markup inside a stat span, or
    a patched body that fails the numeric gate (fail-safe: never write a body
    we cannot verify).
Flagged rows still require regenerating the draft (generate_hub_content.py
resets snapshot + flag) and human re-approval.

Accuracy model (no human checks the numbers):
  * Comparison is EXACT, not thresholded. The prose renders these exact
    numbers, so on a YMYL directory any change is a wrong number — repair or
    suppress, never leave stale.
  * Covers ALL statuses (draft / in_review / published): the admin approval
    gate refuses to publish a drift-flagged row, so drafts must be audited
    (and repaired) too for that guard to mean anything.
  * Non-numeric context (last_inspection_date) is not audited, but the
    refreshed snapshot carries the live value for future edits.

County rows are skipped: compute_stats keys by city_slug, and Phase 1 only
generates city hubs. Revisit when county hub content ships.

NOTE: like every scraper here this uses psycopg over DATABASE_URL (raw
Postgres), so it runs from GitHub Actions or Cursor, NOT from Claude Code on
the web (the web sandbox proxies HTTP/HTTPS only).

Usage
-----
  python hub_content_drift_check.py                 # audit all states, repair/flag
  python hub_content_drift_check.py --state CA      # one state only
  python hub_content_drift_check.py --dry-run       # report only, no DB writes

Exit code is 0 on a successful audit (repairing or flagging IS the success
path). Non-zero only on an operational error (no DATABASE_URL, DB failure),
so a normal post-ingest run does not fail the job.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

# Reuse the generator's snapshot computation and numeric gate verbatim
# (single source of truth). scrapers/ is an implicit namespace package once
# REPO_ROOT is on sys.path.
REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))
from scrapers.generate_hub_content import (  # noqa: E402
    STAT_KEYS,
    compute_stats,
    verify_stats,
)

COUNT_KEYS = ("facility_count", "facilities_with_serious", "total_beds")

# Same span shape the TS gate (hubGate.ts) and verify_stats match.
SPAN_RE = re.compile(
    r"(<span\b[^>]*\bdata-stat\s*=\s*[\"'](?P<key>[^\"']+)[\"'][^>]*>)"
    r"(?P<inner>.*?)"
    r"(</span>)",
    re.IGNORECASE | re.DOTALL,
)


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
        SELECT id, state_code, region_slug, status, drift_detected,
               stats_snapshot, body_html
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


def repair_guard(stored: dict[str, Any], live: dict[str, Any]) -> list[str]:
    """
    Decide whether an in-place numeric patch is safe, or whether the change
    could invalidate the qualitative prose around the number. Returns a list
    of human-readable reasons repair is blocked; empty list means safe.
    """
    reasons: list[str] = []
    for key in STAT_KEYS:
        stored_val = stored.get(key)
        if stored_val is None:
            reasons.append(f"{key} missing from stored snapshot — regenerate.")
            continue
        s, lv = int(stored_val), int(live.get(key))
        if s == lv:
            continue
        if (s == 0) != (lv == 0):
            reasons.append(
                f"{key} crosses zero ({s} → {lv}); prose like 'none on record' may now be wrong."
            )
            continue
        if key == "pct_with_serious":
            if (s > 50) != (lv > 50) or (s < 50) != (lv < 50):
                reasons.append(
                    f"pct_with_serious crosses the 50% majority line ({s}% → {lv}%); 'most/fewer than half' prose may flip."
                )
            elif abs(lv - s) > 25:
                reasons.append(
                    f"pct_with_serious moved {abs(lv - s)} points ({s}% → {lv}%); scale prose may be stale."
                )
        elif key in COUNT_KEYS and (lv > 2 * s or 2 * lv < s):
            reasons.append(
                f"{key} more than doubled/halved ({s} → {lv}); scale prose may be stale."
            )
    return reasons


def format_stat(original_inner: str, value: int) -> str:
    """Format the live value in the style of the original span text (keep %, en-US commas)."""
    if "%" in original_inner:
        return f"{value}%"
    return f"{value:,}"


def patch_spans(
    body_html: str, live: dict[str, Any]
) -> tuple[str, list[str], list[str]]:
    """
    Rewrite every known data-stat span's inner text with the live value.
    Returns (patched_html, changes, problems). Any problem means the caller
    must fall back to flagging instead of writing.
    """
    changes: list[str] = []
    problems: list[str] = []

    def repl(m: re.Match[str]) -> str:
        key = m.group("key")
        inner = m.group("inner")
        if key not in STAT_KEYS:
            problems.append(f"Unknown data-stat key '{key}' — regenerate.")
            return m.group(0)
        if "<" in inner:
            problems.append(
                f"data-stat '{key}' contains nested markup; cannot patch safely — regenerate."
            )
            return m.group(0)
        new_text = format_stat(inner, int(live[key]))
        if inner.strip() != new_text:
            changes.append(f"{key}: '{inner.strip()}' → '{new_text}'")
        return m.group(1) + new_text + m.group(4)

    patched = SPAN_RE.sub(repl, body_html)
    return patched, changes, problems


def repair_row(
    conn: psycopg.Connection,
    *,
    row_id: str,
    body_html: str,
    snapshot: dict[str, Any],
) -> None:
    """Write the patched body + refreshed snapshot; clear any drift flag. Status/approval untouched."""
    with conn.cursor() as cur:
        cur.execute("SAVEPOINT sp")
        try:
            cur.execute(
                """
                UPDATE hub_content
                   SET body_html      = %(body)s,
                       stats_snapshot = %(snap)s,
                       drift_detected = false,
                       drift_details  = NULL,
                       last_audit_at  = now(),
                       updated_at     = now()
                 WHERE id = %(id)s
                """,
                {
                    "id": row_id,
                    "body": body_html,
                    "snap": psycopg.types.json.Jsonb(snapshot),
                },
            )
            cur.execute("RELEASE SAVEPOINT sp")
        except Exception:
            cur.execute("ROLLBACK TO SAVEPOINT sp")
            raise
    conn.commit()


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
    """Refresh last_audit_at on a clean row. Never clears an existing drift flag here — a clean diff on a flagged row means the stored snapshot caught up, but the body was never repaired; regeneration is still required."""
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
        description="StarlynnCare Layer 5b — hub content drift audit (self-healing)"
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
    repaired = 0
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

            if not drift:
                if not args.dry_run:
                    mark_audited(conn, row_id=row["id"])
                continue

            deltas = ", ".join(
                f"{k}: {v['stored']}→{v['live']}" for k, v in drift.items()
            )

            # Try to self-heal: guard first, then patch, then re-verify with
            # the generator's own gate. Any failure falls through to flagging.
            block_reasons = repair_guard(stored, live)
            patched_body: str | None = None
            changes: list[str] = []
            if not block_reasons and row["body_html"]:
                patched_body, changes, problems = patch_spans(
                    row["body_html"], live
                )
                block_reasons.extend(problems)
                if not block_reasons:
                    gate_issues = verify_stats(patched_body, live)
                    if gate_issues:
                        block_reasons.extend(
                            f"Patched body failed numeric gate: {iss}"
                            for iss in gate_issues
                        )
            elif not row["body_html"]:
                block_reasons.append("Row has no body_html — regenerate.")

            if not block_reasons and patched_body is not None:
                repaired += 1
                print(
                    f"  ✚ REPAIR {slug} ({row['state_code']}, {row['status']}): {deltas}",
                    flush=True,
                )
                for c in changes:
                    print(f"      {c}", flush=True)
                if not args.dry_run:
                    repair_row(
                        conn, row_id=row["id"], body_html=patched_body, snapshot=live
                    )
            else:
                flagged += 1
                print(
                    f"  ⚠ DRIFT  {slug} ({row['state_code']}, {row['status']}): {deltas}",
                    flush=True,
                )
                for reason in block_reasons:
                    print(f"      blocked: {reason}", flush=True)
                if not args.dry_run:
                    details = dict(drift)
                    details["repair_blocked"] = block_reasons
                    flag_drift(conn, row_id=row["id"], details=details)

    print("=" * 60, flush=True)
    print(f"  Rows audited : {audited}", flush=True)
    print(f"  Repaired     : {repaired}", flush=True)
    print(f"  Drift flagged: {flagged}", flush=True)
    if flagged and not args.dry_run:
        print(
            f"  → {flagged} page(s) auto-suppressed until regenerated + re-approved.",
            flush=True,
        )
    print("=" * 60, flush=True)
    # Exit 0 even with drift: repairing/flagging is the success path, not a failure.


if __name__ == "__main__":
    main()
