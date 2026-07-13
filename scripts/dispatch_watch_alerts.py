#!/usr/bin/env python3
"""Dispatch deduplicated area and facility alerts for a completed state scan."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRAPERS_DIR = REPO_ROOT / "scrapers"
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _watch_alert import send_area_change_alert, send_watch_change_alert  # noqa: E402

SITE_URL = os.environ.get("NEXT_PUBLIC_SITE_URL", "https://www.starlynncare.com").rstrip("/")
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


def get_conn() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    return psycopg.connect(url)


def _delivery_fingerprint(prefix: str, fingerprints: list[str]) -> str:
    joined = "|".join([prefix, *sorted(fingerprints)])
    return hashlib.sha256(joined.encode()).hexdigest()


def scan_is_dispatchable(status: str) -> bool:
    return status == "completed"


def _create_delivery(
    conn: psycopg.Connection,
    *,
    watcher_type: str,
    watcher_id: str,
    scan_run_id: str,
    recipient: str,
    change_fingerprint: str,
    payload: dict[str, Any],
) -> str | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO watch_alert_deliveries (
              watcher_type,
              watcher_id,
              scan_run_id,
              recipient,
              change_fingerprint,
              payload
            )
            VALUES (%s, %s, %s, %s, %s, %s::jsonb)
            ON CONFLICT (watcher_type, watcher_id, change_fingerprint) DO UPDATE SET
              status = 'pending',
              error = NULL,
              payload = EXCLUDED.payload
            WHERE watch_alert_deliveries.status = 'failed'
            RETURNING id::text
            """,
            (
                watcher_type,
                watcher_id,
                scan_run_id,
                recipient,
                change_fingerprint,
                json.dumps(payload, default=str),
            ),
        )
        row = cur.fetchone()
    conn.commit()
    return row[0] if row else None


def _finish_delivery(
    conn: psycopg.Connection,
    delivery_id: str,
    *,
    status: str,
    error: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE watch_alert_deliveries
            SET status = %s,
                attempted_at = now(),
                sent_at = CASE WHEN %s = 'sent' THEN now() ELSE sent_at END,
                error = %s
            WHERE id = %s
            """,
            (status, status, error[:1000] if error else None, delivery_id),
        )
    conn.commit()


def _load_run(conn: psycopg.Connection, scan_run_id: str | None, state: str | None) -> dict[str, Any]:
    with conn.cursor(row_factory=dict_row) as cur:
        if scan_run_id:
            cur.execute("SELECT * FROM state_scan_runs WHERE id = %s", (scan_run_id,))
        else:
            cur.execute(
                """
                SELECT *
                FROM state_scan_runs
                WHERE state_code = %s
                ORDER BY started_at DESC
                LIMIT 1
                """,
                (state,),
            )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("No matching state scan run found")
    return dict(row)


def _load_deltas(conn: psycopg.Connection, scan_run_id: str) -> list[dict[str, Any]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT d.*, f.slug, f.city_slug
            FROM state_scan_facility_deltas d
            LEFT JOIN facilities f ON f.id = d.facility_id
            WHERE d.scan_run_id = %s
            ORDER BY d.created_at, d.id
            """,
            (scan_run_id,),
        )
        return [dict(row) for row in cur.fetchall()]


def _area_url(watcher: dict[str, Any]) -> str:
    state_slug = STATE_SLUGS[watcher["state_code"]]
    if watcher.get("source") == "state_modal":
        return f"{SITE_URL}/{state_slug}"
    return f"{SITE_URL}/{state_slug}/{watcher['area_slug']}"


def _facility_url(state_code: str, city_slug: str, facility_slug: str) -> str:
    return f"{SITE_URL}/{STATE_SLUGS[state_code]}/{city_slug}/{facility_slug}"


def _send_area_alerts(
    conn: psycopg.Connection,
    run: dict[str, Any],
    deltas: list[dict[str, Any]],
    *,
    no_change_email: str | None,
    dry_run: bool,
) -> tuple[int, int]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM area_watchers
            WHERE state_code = %s
              AND active
              AND baseline_at <= %s
            ORDER BY created_at
            """,
            (run["state_code"], run["started_at"]),
        )
        watchers = [dict(row) for row in cur.fetchall()]

    sent = 0
    failed = 0
    for watcher in watchers:
        relevant = deltas
        if watcher.get("source") != "state_modal":
            relevant = [
                delta
                for delta in deltas
                if (delta.get("after_payload") or {}).get("city_slug") == watcher["area_slug"]
            ]

        is_requested_no_change = (
            not relevant
            and no_change_email is not None
            and watcher["email"].lower() == no_change_email.lower()
        )
        if not relevant and not is_requested_no_change:
            continue

        fingerprints = [delta["fingerprint"] for delta in relevant]
        if is_requested_no_change:
            fingerprints = [f"{run['id']}:verified-no-change"]
        delivery_fp = _delivery_fingerprint(f"area:{watcher['id']}", fingerprints)
        details = "\n".join(f"• {delta['summary']}" for delta in relevant[:20])
        if relevant:
            summary = (
                f"We found {len(relevant)} public-record update"
                f"{'s' if len(relevant) != 1 else ''} in {watcher['area_name']}."
            )
        else:
            summary = (
                f"We checked the available public sources for {watcher['area_name']} "
                "and found no new family-facing records in this scan."
            )
            details = "The scan completed successfully across every configured source."

        payload = {
            "areaName": watcher["area_name"],
            "summary": summary,
            "details": details,
            "areaUrl": _area_url(watcher),
        }
        if dry_run:
            print(f"[dry-run] area alert → {watcher['email']}: {summary}")
            continue
        delivery_id = _create_delivery(
            conn,
            watcher_type="area",
            watcher_id=watcher["id"],
            scan_run_id=run["id"],
            recipient=watcher["email"],
            change_fingerprint=delivery_fp,
            payload=payload,
        )
        if not delivery_id:
            continue
        try:
            send_area_change_alert(
                to=watcher["email"],
                area_name=watcher["area_name"],
                area_url=payload["areaUrl"],
                summary=summary,
                details=details,
                unsubscribe_url=(
                    f"{SITE_URL}/watch/area/unsubscribe/{watcher['unsubscribe_token']}"
                ),
            )
            _finish_delivery(conn, delivery_id, status="sent")
            sent += 1
        except Exception as exc:  # noqa: BLE001
            _finish_delivery(conn, delivery_id, status="failed", error=str(exc))
            failed += 1
            print(f"Area alert failed for {watcher['email']}: {exc}", file=sys.stderr)
    return sent, failed


def _send_facility_alerts(
    conn: psycopg.Connection,
    run: dict[str, Any],
    deltas: list[dict[str, Any]],
    *,
    dry_run: bool,
) -> tuple[int, int]:
    sent = 0
    failed = 0
    for delta in deltas:
        if not delta.get("facility_id"):
            continue
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT *
                FROM facility_watchers
                WHERE facility_id = %s
                  AND confirmed_at IS NOT NULL
                  AND baseline_at <= %s
                """,
                (delta["facility_id"], run["started_at"]),
            )
            watchers = [dict(row) for row in cur.fetchall()]

        for watcher in watchers:
            delivery_fp = _delivery_fingerprint(
                f"facility:{watcher['id']}",
                [delta["fingerprint"]],
            )
            after = delta.get("after_payload") or {}
            payload = {
                "facilityName": after.get("name", "Watched facility"),
                "summary": delta["summary"],
                "details": delta["summary"],
                "facilityUrl": _facility_url(
                    run["state_code"],
                    delta["city_slug"],
                    delta["slug"],
                ),
            }
            if dry_run:
                print(f"[dry-run] facility alert → {watcher['email']}: {delta['summary']}")
                continue
            delivery_id = _create_delivery(
                conn,
                watcher_type="facility",
                watcher_id=watcher["id"],
                scan_run_id=run["id"],
                recipient=watcher["email"],
                change_fingerprint=delivery_fp,
                payload=payload,
            )
            if not delivery_id:
                continue
            try:
                send_watch_change_alert(
                    to=watcher["email"],
                    facility_name=payload["facilityName"],
                    facility_url=payload["facilityUrl"],
                    summary=payload["summary"],
                    details=payload["details"],
                    detected_at=str(run["completed_at"]),
                    unsubscribe_url=(
                        f"{SITE_URL}/watch/unsubscribe/{watcher['unsubscribe_token']}"
                    ),
                )
                _finish_delivery(conn, delivery_id, status="sent")
                sent += 1
            except Exception as exc:  # noqa: BLE001
                _finish_delivery(conn, delivery_id, status="failed", error=str(exc))
                failed += 1
                print(f"Facility alert failed for {watcher['email']}: {exc}", file=sys.stderr)
    return sent, failed


def main() -> int:
    parser = argparse.ArgumentParser(description="Dispatch State Watch alerts")
    selector = parser.add_mutually_exclusive_group(required=True)
    selector.add_argument("--scan-run-id")
    selector.add_argument("--state", choices=sorted(STATE_SLUGS))
    parser.add_argument("--send-no-change-to")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_env()
    conn = get_conn()
    run = _load_run(conn, args.scan_run_id, args.state)
    if not scan_is_dispatchable(run["status"]):
        print(
            f"Skipping alerts for {run['id']}: scan status is {run['status']}, not completed.",
            file=sys.stderr,
        )
        return 0

    deltas = _load_deltas(conn, run["id"])
    area_sent, area_failed = _send_area_alerts(
        conn,
        run,
        deltas,
        no_change_email=args.send_no_change_to,
        dry_run=args.dry_run,
    )
    facility_sent, facility_failed = _send_facility_alerts(
        conn,
        run,
        deltas,
        dry_run=args.dry_run,
    )

    if not args.dry_run:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE area_watchers
                SET last_successful_scan_at = %s
                WHERE state_code = %s AND active
                """,
                (run["completed_at"], run["state_code"]),
            )
            cur.execute(
                """
                UPDATE facility_watchers w
                SET last_successful_scan_at = %s
                FROM facilities f
                WHERE f.id = w.facility_id AND f.state_code = %s
                """,
                (run["completed_at"], run["state_code"]),
            )
        conn.commit()
    conn.close()

    print(
        f"Alerts: area sent={area_sent}, facility sent={facility_sent}, "
        f"failed={area_failed + facility_failed}"
    )
    return 1 if area_failed or facility_failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
