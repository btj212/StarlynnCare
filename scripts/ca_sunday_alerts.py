#!/usr/bin/env python3
"""Hold California watch notes until Sunday.

The morning crawl does not email. On Sunday this sends notes only from scans
that finished completely, and only after the California data check passes.
A partial or failed crawl stays silent. One confirmed note to a single
recipient has to succeed before a later Sunday may email every watcher.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parents[1]
PACIFIC = ZoneInfo("America/Los_Angeles")
PROOF_PATH = Path.home() / "Library/Application Support/StarlynnCare/ca-sunday-alerts-proven"
HOLD_DAYS = 8


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            break


def pacific_is_sunday(moment: datetime) -> bool:
    if moment.tzinfo is None:
        raise ValueError("Sunday is decided in Pacific time, so the clock needs a timezone.")
    return moment.astimezone(PACIFIC).weekday() == 6


def held_scan_is_sendable(
    *,
    status: str,
    already_sent: bool,
    layer5_passed: bool,
    is_sunday: bool,
) -> bool:
    """A finished scan can email on Sunday, after the data check, once."""
    return bool(is_sunday and layer5_passed and status == "completed" and not already_sent)


def proof_exists(path: Path = PROOF_PATH) -> bool:
    return path.is_file()


def may_email_every_watcher(*, send: bool, recipient_only: str | None, proof_present: bool) -> bool:
    """Everyone waits until one named recipient has already received a note."""
    if not send or recipient_only:
        return False
    return proof_present


def window_start(moment: datetime) -> datetime:
    """The week ending this Sunday. Older California scans stay unsent."""
    local = moment.astimezone(PACIFIC)
    start = (local - timedelta(days=HOLD_DAYS)).replace(hour=0, minute=0, second=0, microsecond=0)
    return start


def layer5_passes() -> bool:
    script = REPO_ROOT / "scripts" / "validate" / "post_ingest_check.py"
    result = subprocess.run(
        [sys.executable, "-u", str(script), "--state", "CA"],
        cwd=REPO_ROOT,
        env=os.environ.copy(),
        check=False,
    )
    return result.returncode == 0


def dispatch_scan(scan_id: str, *, dry_run: bool, recipient_only: str | None) -> tuple[int, str]:
    cmd = [
        sys.executable,
        "-u",
        str(REPO_ROOT / "scripts" / "dispatch_watch_alerts.py"),
        "--scan-run-id",
        scan_id,
    ]
    if dry_run:
        cmd.append("--dry-run")
    if recipient_only:
        cmd.extend(["--recipient-only", recipient_only])
    result = subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        env=os.environ.copy(),
        check=False,
        capture_output=True,
        text=True,
    )
    if result.stdout:
        sys.stdout.write(result.stdout)
    if result.stderr:
        sys.stderr.write(result.stderr)
    return result.returncode, result.stdout


def parse_sent_counts(output: str) -> tuple[int, int, int]:
    """Return area sent, facility sent, and failed from the dispatch summary."""

    def value(line: str, label: str) -> int:
        marker = f"{label}="
        start = line.find(marker)
        if start < 0:
            return 0
        digits = []
        for char in line[start + len(marker):]:
            if not char.isdigit():
                break
            digits.append(char)
        return int("".join(digits) or "0")

    for line in output.splitlines():
        if line.startswith("Alerts:"):
            return value(line, "area sent"), value(line, "facility sent"), value(line, "failed")
    return 0, 0, 0


def load_recent_scans(conn: psycopg.Connection, start: datetime) -> list[dict[str, object]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id::text AS id,
                   status,
                   started_at,
                   changes_detected,
                   COALESCE(metadata->>'alerts_dispatched_at', '') <> '' AS already_sent
            FROM state_scan_runs
            WHERE state_code = 'CA'
              AND started_at >= %s
            ORDER BY started_at
            """,
            (start,),
        )
        return [dict(row) for row in cur.fetchall()]


def mark_dispatched(conn: psycopg.Connection, scan_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE state_scan_runs
            SET metadata = metadata || jsonb_build_object(
              'alerts_dispatched_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            )
            WHERE id = %s::uuid
              AND status = 'completed'
              AND COALESCE(metadata->>'alerts_dispatched_at', '') = ''
            """,
            (scan_id,),
        )
    conn.commit()


def write_proof(path: Path = PROOF_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("one California recipient confirmed\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Send held California watch notes on Sunday")
    parser.add_argument("--send", action="store_true", help="Send mail. Without this, only print.")
    parser.add_argument("--recipient-only", metavar="EMAIL")
    parser.add_argument("--now", help="ISO timestamp. Defaults to the current Pacific time.")
    args = parser.parse_args()

    moment = datetime.fromisoformat(args.now) if args.now else datetime.now(PACIFIC)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=PACIFIC)
    if not pacific_is_sunday(moment):
        print("California alerts are held until Sunday. No subscriber alerts were sent.")
        return 0

    load_env()
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        print("DATABASE_URL is not set. No subscriber alerts were sent.", file=sys.stderr)
        return 1

    print("California Sunday check: running the data check before any mail.")
    if not layer5_passes():
        print("California data check failed. No subscriber alerts were sent.")
        return 0

    recipient = args.recipient_only.strip().lower() if args.recipient_only else None
    email_everyone = may_email_every_watcher(
        send=args.send,
        recipient_only=recipient,
        proof_present=proof_exists(),
    )
    dry_run = not (email_everyone or (args.send and recipient))
    if args.send and dry_run:
        print(
            "A single-recipient California note has not been confirmed yet. "
            "Printing who would be emailed. No subscriber alerts were sent."
        )

    conn = psycopg.connect(url)
    failures = 0
    confirmed_sends = 0
    try:
        scans = load_recent_scans(conn, window_start(moment))
        sendable = [
            scan
            for scan in scans
            if held_scan_is_sendable(
                status=str(scan["status"]),
                already_sent=bool(scan["already_sent"]),
                layer5_passed=True,
                is_sunday=True,
            )
        ]
        print(f"Finished California scans waiting: {len(sendable)}")
        if not sendable:
            print("No finished California scan is waiting. Partial scans stay silent.")
            return 0
        for scan in sendable:
            scan_id = str(scan["id"])
            print(f"Scan {scan_id} changes={scan['changes_detected']} {'dry-run' if dry_run else 'send'}")
            code, output = dispatch_scan(scan_id, dry_run=dry_run, recipient_only=recipient)
            area_sent, facility_sent, failed = parse_sent_counts(output)
            if code != 0 or failed:
                failures += 1
                print(f"Scan {scan_id} did not finish sending.", file=sys.stderr)
                continue
            confirmed_sends += area_sent + facility_sent
            if not dry_run:
                mark_dispatched(conn, scan_id)
        if not dry_run and recipient and failures == 0 and confirmed_sends > 0:
            write_proof()
            print("One recipient was confirmed. Later Sundays can email every matching watcher.")
    finally:
        conn.close()
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
