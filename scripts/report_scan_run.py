#!/usr/bin/env python3
"""Email the operator what a scan checked, what it found, and which notes went out.

This does not email families. Family notes stay on their own Sunday path.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = REPO_ROOT / "scripts"
SCRAPERS_DIR = REPO_ROOT / "scrapers"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _watch_alert import send_operator_scan_report  # noqa: E402
from dispatch_watch_alerts import facility_delta_has_new_record  # noqa: E402

PACIFIC = ZoneInfo("America/Los_Angeles")
CA_SNAPSHOT_SOURCE = "ca_ccld_bulk_compliance_v1"
DETAIL_LIMIT = 1700
LIST_CAP = 12
STATE_NAMES = {
    "AZ": "Arizona",
    "CA": "California",
    "IL": "Illinois",
    "MN": "Minnesota",
    "MO": "Missouri",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "TX": "Texas",
    "UT": "Utah",
    "WA": "Washington",
}
STATE_SLUGS = {
    "AZ": "arizona",
    "CA": "california",
    "IL": "illinois",
    "MN": "minnesota",
    "MO": "missouri",
    "OR": "oregon",
    "PA": "pennsylvania",
    "TX": "texas",
    "UT": "utah",
    "WA": "washington",
}


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            break
    for env_name, service in (
        ("LOOPS_API_KEY", "starlynncare-loops-api-key"),
        ("LOOPS_ADMIN_ALERT_ID", "starlynncare-loops-admin-alert-id"),
    ):
        if secret_is_usable(os.environ.get(env_name, "")):
            continue
        stored = keychain_secret(service)
        if stored:
            os.environ[env_name] = stored


def secret_is_usable(value: str) -> bool:
    """A real Loops key or template id is a long token. A short placeholder is not."""
    text = value.strip()
    return len(text) >= 20 and text[0].isalnum()


def operator_mail_is_configured() -> bool:
    """The operator address can be a normal email. The Loops values cannot be placeholders."""
    email = os.environ.get("ADMIN_ALERT_EMAIL", "")
    return (
        "@" in email
        and secret_is_usable(os.environ.get("LOOPS_API_KEY", ""))
        and secret_is_usable(os.environ.get("LOOPS_ADMIN_ALERT_ID", ""))
    )


def keychain_secret(service: str) -> str:
    """Read one local secret. Never print it."""
    try:
        result = subprocess.run(
            [
                "security",
                "find-generic-password",
                "-s",
                service,
                "-a",
                "starlynncare",
                "-w",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ""
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def data_check_from_sunday_output(text: str) -> str:
    """Read the California Sunday script's own words. Do not guess."""
    if "California alerts are held until Sunday" in text:
        return "not-sunday"
    if "California data check failed" in text:
        return "failed"
    if "running the data check" in text:
        return "passed"
    return "not-run"


def data_check_from_outcome(outcome: str) -> str:
    """Map a GitHub step result onto the same three words the note uses."""
    if outcome == "success":
        return "passed"
    if outcome == "failure":
        return "failed"
    return "not-run"


def inbox_line(state_code: str, status: str, inspection_delta: int | None, family_sent: int) -> str:
    """The inbox line has to say whether the run finished and whether anyone was emailed."""
    found = "inspections not recorded" if inspection_delta is None else f"inspections {inspection_delta:+d}"
    mail = "1 family email" if family_sent == 1 else f"{family_sent} family emails"
    return f"{state_code} {status} — {found}, {mail}"


def family_mail_line(
    *,
    facility_sent: int,
    facility_failed: int,
    area_sent: int,
    area_failed: int,
    data_check: str,
) -> str:
    """Say what was actually sent. A quiet weekday is not a failed send."""
    sent = facility_sent + area_sent
    failed = facility_failed + area_failed
    if sent or failed:
        line = (
            f"Family email: {facility_sent} facility note(s) sent, "
            f"{area_sent} area note(s) sent."
        )
        if failed:
            line += f" {failed} note(s) failed to send."
        return line
    if data_check == "failed":
        return "Family email: none. The data check did not pass. No subscriber alerts were sent."
    if data_check == "not-sunday":
        return "Family email: none. These notes wait until Sunday."
    return "Family email: none."


def _when(moment: datetime | None) -> str:
    if moment is None:
        return "not recorded"
    local = moment.astimezone(PACIFIC)
    clock = local.strftime("%I:%M %p").lstrip("0")
    return f"{local.strftime('%a %b')} {local.day}, {clock} PT"


def _count_line(label: str, before: int | None, after: int | None) -> str:
    if before is None or after is None:
        return f"{label}: not recorded"
    return f"{label}: {before} → {after} ({after - before:+d})"


def _cap(lines: list[str], noun: str) -> list[str]:
    if len(lines) <= LIST_CAP:
        return lines
    hidden = len(lines) - LIST_CAP
    return lines[:LIST_CAP] + [f"and {hidden} more {noun}"]


def format_missing_note(state_code: str, data_check: str) -> tuple[str, str]:
    """A crawl that never wrote a scan row still has to tell the operator."""
    name = STATE_NAMES.get(state_code, state_code)
    summary = inbox_line(state_code, "did not record a run", None, 0)
    details = "\n".join(
        [
            f"{name} did not record a scan.",
            "The job started, but no scan row was written, so nothing was checked and nothing was found.",
            family_mail_line(
                facility_sent=0,
                facility_failed=0,
                area_sent=0,
                area_failed=0,
                data_check=data_check,
            ),
        ]
    )
    return summary, details


def format_scan_note(scan: dict[str, Any]) -> tuple[str, str]:
    """One operator note. A checksum flicker is not reported as a new inspection."""
    state_code = str(scan["state_code"])
    name = STATE_NAMES.get(state_code, state_code)
    before_i = scan.get("inspections_before")
    after_i = scan.get("inspections_after")
    inspection_delta = None if before_i is None or after_i is None else int(after_i) - int(before_i)
    family_sent = int(scan.get("facility_sent") or 0) + int(scan.get("area_sent") or 0)
    summary = inbox_line(state_code, str(scan.get("status") or "unknown"), inspection_delta, family_sent)

    lines = [
        f"{name} scan is {scan.get('status') or 'unknown'}.",
        f"Started {_when(scan.get('started_at'))}. Finished {_when(scan.get('completed_at'))}.",
        _count_line("Inspections", _as_int(before_i), _as_int(after_i)),
        _count_line(
            "Citations",
            _as_int(scan.get("deficiencies_before")),
            _as_int(scan.get("deficiencies_after")),
        ),
    ]
    if scan.get("error"):
        lines.append(f"Scan note: {str(scan['error'])[:300]}")

    sources = list(scan.get("sources") or [])
    if sources:
        lines.append("")
        lines.append("What ran")
        for source in sources:
            suffix = f" — {source['error']}" if source.get("error") else ""
            lines.append(f"- {source.get('source')}: {source.get('status')}{suffix}")

    if scan.get("reports_seen") is not None or scan.get("not_opened"):
        lines.append("")
        lines.append("Report index")
        if scan.get("reports_seen") is not None:
            lines.append(
                f"Reports seen: {scan.get('reports_seen')}. New reports stored: {scan.get('reports_new') or 0}."
            )
        not_opened = [str(item) for item in scan.get("not_opened") or []]
        if not_opened:
            lines.append("Not opened:")
            lines.extend(f"- {item}" for item in _cap(not_opened, "homes"))

    real = [str(item) for item in scan.get("real_findings") or []]
    lines.append("")
    lines.append("Found")
    if real:
        lines.extend(f"- {item}" for item in _cap(real, "homes"))
    else:
        lines.append("No home gained an inspection or a citation.")
    other = int(scan.get("other_changes") or 0)
    if other:
        lines.append(
            f"{other} other change(s) were a license update or a checksum flicker, not a new inspection."
        )

    watched = list(scan.get("watched") or [])
    if watched:
        lines.append("")
        lines.append("Watched homes")
        watched_lines = []
        for home in watched:
            label = str(home["name"])
            if home.get("finding"):
                watched_lines.append(f"- {label}: {home['finding']}")
            elif home.get("opened") is True:
                watched_lines.append(f"- {label}: report index opened, no new inspection")
            elif home.get("opened") is False:
                watched_lines.append(f"- {label}: report index not opened")
            else:
                watched_lines.append(f"- {label}: no new inspection stored")
        lines.extend(_cap(watched_lines, "homes"))

    lines.append("")
    lines.append(
        family_mail_line(
            facility_sent=int(scan.get("facility_sent") or 0),
            facility_failed=int(scan.get("facility_failed") or 0),
            area_sent=int(scan.get("area_sent") or 0),
            area_failed=int(scan.get("area_failed") or 0),
            data_check=str(scan.get("data_check") or "not-run"),
        )
    )
    details = "\n".join(lines)
    if len(details) > DETAIL_LIMIT:
        details = details[: DETAIL_LIMIT - 40].rstrip() + "\nThe rest is in the scan log."
    return summary, details


def _as_int(value: Any) -> int | None:
    if value is None:
        return None
    return int(value)


def _home_label(name: str, city: str | None) -> str:
    if city:
        return f"{name} — {city}"
    return name


def _not_opened_names(error_log: str | None) -> list[str]:
    names: list[str] = []
    for line in (error_log or "").splitlines():
        text = line.strip()
        if not text:
            continue
        marker = ": report index not checked"
        if text.endswith(marker):
            text = text[: -len(marker)]
        names.append(text)
    return names


def load_scan_note(conn: psycopg.Connection, scan_id: str, data_check: str) -> dict[str, Any]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM state_scan_runs WHERE id = %s::uuid", (scan_id,))
        run = cur.fetchone()
        if not run:
            raise RuntimeError(f"Scan {scan_id} was not found.")
        cur.execute(
            """
            SELECT source, status, error
            FROM state_scan_sources
            WHERE scan_run_id = %s::uuid
            ORDER BY started_at, source
            """,
            (scan_id,),
        )
        sources = [dict(row) for row in cur.fetchall()]
        cur.execute(
            """
            SELECT facility_id::text AS facility_id, summary, before_payload, after_payload
            FROM state_scan_facility_deltas
            WHERE scan_run_id = %s::uuid
            ORDER BY created_at
            """,
            (scan_id,),
        )
        deltas = [dict(row) for row in cur.fetchall()]
        cur.execute(
            """
            SELECT watcher_type, status, count(*)::int AS n
            FROM watch_alert_deliveries
            WHERE scan_run_id = %s::uuid
            GROUP BY watcher_type, status
            """,
            (scan_id,),
        )
        deliveries = [dict(row) for row in cur.fetchall()]
        cur.execute(
            """
            SELECT w.facility_id::text AS facility_id, f.name, f.city
            FROM facility_watchers w
            JOIN facilities f ON f.id = w.facility_id
            LEFT JOIN customer_preferences p ON p.email = w.email
            WHERE f.state_code = %s
              AND w.confirmed_at IS NOT NULL
              AND COALESCE(w.alerts_eligible, TRUE)
              AND NOT COALESCE(p.unsubscribed_all, FALSE)
              AND NOT ('facility_watch' = ANY(COALESCE(p.unsubscribed_products, '{}'::text[])))
            ORDER BY f.name, f.city
            """,
            (run["state_code"],),
        )
        watchers = [dict(row) for row in cur.fetchall()]
        opened_at: dict[str, datetime] = {}
        if run["state_code"] == "CA" and watchers:
            cur.execute(
                """
                SELECT facility_id::text AS facility_id, scanned_at
                FROM facility_watch_snapshots
                WHERE facility_id = ANY(%s::uuid[])
                  AND source = %s
                """,
                ([row["facility_id"] for row in watchers], CA_SNAPSHOT_SOURCE),
            )
            opened_at = {row["facility_id"]: row["scanned_at"] for row in cur.fetchall()}
        scrape = None
        if run["state_code"] == "CA" and run.get("started_at") is not None:
            cur.execute(
                """
                SELECT records_found, records_new, error_log
                FROM scrape_runs
                WHERE state_code = 'CA'
                  AND started_at >= %s
                ORDER BY started_at DESC
                LIMIT 1
                """,
                (run["started_at"],),
            )
            scrape = cur.fetchone()

    real_by_home: dict[str, str] = {}
    real_findings: list[str] = []
    other_changes = 0
    for delta in deltas:
        if facility_delta_has_new_record(delta):
            real_findings.append(str(delta["summary"]))
            if delta.get("facility_id"):
                real_by_home[str(delta["facility_id"])] = str(delta["summary"])
        else:
            other_changes += 1

    seen: set[str] = set()
    watched: list[dict[str, Any]] = []
    started = run.get("started_at")
    for row in watchers:
        facility_id = str(row["facility_id"])
        if facility_id in seen:
            continue
        seen.add(facility_id)
        opened: bool | None = None
        if run["state_code"] == "CA":
            scanned_at = opened_at.get(facility_id)
            opened = bool(started and scanned_at and scanned_at >= started)
        watched.append(
            {
                "name": _home_label(str(row["name"]), row.get("city")),
                "opened": opened,
                "finding": real_by_home.get(facility_id),
            }
        )

    counts = {
        ("facility", "sent"): 0,
        ("facility", "failed"): 0,
        ("area", "sent"): 0,
        ("area", "failed"): 0,
    }
    for row in deliveries:
        key = (str(row["watcher_type"]), str(row["status"]))
        if key in counts:
            counts[key] = int(row["n"])

    return {
        "state_code": run["state_code"],
        "status": run["status"],
        "started_at": run.get("started_at"),
        "completed_at": run.get("completed_at"),
        "inspections_before": run.get("inspections_before"),
        "inspections_after": run.get("inspections_after"),
        "deficiencies_before": run.get("deficiencies_before"),
        "deficiencies_after": run.get("deficiencies_after"),
        "error": run.get("error"),
        "sources": sources,
        "real_findings": real_findings,
        "other_changes": other_changes,
        "facility_sent": counts[("facility", "sent")],
        "facility_failed": counts[("facility", "failed")],
        "area_sent": counts[("area", "sent")],
        "area_failed": counts[("area", "failed")],
        "watched": watched,
        "reports_seen": None if scrape is None else scrape["records_found"],
        "reports_new": None if scrape is None else scrape["records_new"],
        "not_opened": [] if scrape is None else _not_opened_names(scrape["error_log"]),
        "data_check": data_check,
    }


def latest_scan_id(conn: psycopg.Connection, state_code: str) -> str | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::text
            FROM state_scan_runs
            WHERE state_code = %s
              AND started_at >= now() - interval '6 hours'
            ORDER BY started_at DESC
            LIMIT 1
            """,
            (state_code,),
        )
        row = cur.fetchone()
    return row[0] if row else None


def default_admin_url(state_code: str) -> str:
    slug = STATE_SLUGS.get(state_code, "")
    if not slug:
        return "https://www.starlynncare.com"
    return f"https://www.starlynncare.com/{slug}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Email the operator a scan report")
    parser.add_argument("--scan-run-id")
    parser.add_argument("--state")
    parser.add_argument(
        "--missing",
        action="store_true",
        help="The job finished without writing a scan row.",
    )
    parser.add_argument(
        "--data-check",
        default="not-run",
        choices=("passed", "failed", "not-sunday", "not-run", "success", "failure", "skipped", "cancelled"),
    )
    parser.add_argument("--admin-url")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    state_code = args.state.strip().upper() if args.state else ""
    data_check = args.data_check
    if data_check in {"success", "failure", "skipped", "cancelled"}:
        data_check = data_check_from_outcome(data_check)

    if args.missing:
        if not state_code:
            print("--missing needs --state", file=sys.stderr)
            return 1
        summary, details = format_missing_note(state_code, data_check)
        admin_url = args.admin_url or default_admin_url(state_code)
    else:
        load_env()
        url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
        if not url:
            print("DATABASE_URL is not set. No operator note was sent.", file=sys.stderr)
            return 1
        conn = psycopg.connect(url)
        try:
            scan_id = args.scan_run_id
            if not scan_id:
                if not state_code:
                    print("Pass --scan-run-id or --state.", file=sys.stderr)
                    return 1
                scan_id = latest_scan_id(conn, state_code)
            if not scan_id:
                summary, details = format_missing_note(state_code, data_check)
                admin_url = args.admin_url or default_admin_url(state_code)
            else:
                scan = load_scan_note(conn, scan_id, data_check)
                summary, details = format_scan_note(scan)
                admin_url = args.admin_url or default_admin_url(str(scan["state_code"]))
        finally:
            conn.close()

    print(summary)
    print(details)
    if args.dry_run:
        print("Dry run. No operator note was sent.")
        return 0
    load_env()
    if not operator_mail_is_configured():
        print(
            "The operator note was not sent. The Loops key or template id on this Mac "
            "is missing. Store them in Keychain: service starlynncare-loops-api-key "
            "and service starlynncare-loops-admin-alert-id, account starlynncare.",
            file=sys.stderr,
        )
        return 1
    try:
        send_operator_scan_report(summary=summary, details=details, admin_url=admin_url)
    except Exception as exc:  # noqa: BLE001
        print(f"Could not send the operator scan note: {exc}", file=sys.stderr)
        return 1
    print("Operator scan note sent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
