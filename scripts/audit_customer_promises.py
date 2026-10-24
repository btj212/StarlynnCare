#!/usr/bin/env python3
"""Mark overdue promises and alert the operator. Does not email customers."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]


def load_env() -> None:
    from dotenv import load_dotenv

    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            break


def add_business_days(start: datetime, days: int) -> datetime:
    cursor = start
    remaining = days
    while remaining > 0:
        cursor += timedelta(days=1)
        if cursor.weekday() < 5:
            remaining -= 1
    return cursor


def is_our_miss(status: str, stage: str | None, due_at: datetime | None, now: datetime) -> bool:
    """A promise we still owe. Waiting on a family to send a contract is not our miss."""
    if status == "overdue":
        return True
    if status != "open" or due_at is None or due_at > now:
        return False
    if stage == "requested":
        return False
    return True


def should_open_follow_up(
    status: str,
    follow_up_due_at: datetime | None,
    now: datetime,
    already_opened: bool,
) -> bool:
    if already_opened or follow_up_due_at is None or follow_up_due_at > now:
        return False
    return status not in {"unsubscribed", "canceled"}


def audit(conn: Any, now: datetime) -> dict[str, int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            update public.customer_commitments
            set status = 'overdue', updated_at = now()
            where status = 'open'
              and due_at is not null
              and due_at <= %s
              and coalesce(stage, '') <> 'requested'
            """,
            (now,),
        )
        newly_overdue = cur.rowcount

        cur.execute(
            """
            insert into public.customer_deliveries (
              commitment_id, idempotency_key, kind, status, payload
            )
            select
              c.id,
              'follow-up:' || c.id::text,
              'follow_up',
              'pending',
              jsonb_build_object(
                'instruction',
                'Follow-up is due. No customer template is sent by this job.'
              )
            from public.customer_commitments c
            where c.follow_up_due_at is not null
              and c.follow_up_due_at <= %s
              and c.status not in ('unsubscribed', 'canceled')
              and not exists (
                select 1 from public.customer_deliveries d
                where d.commitment_id = c.id and d.kind = 'follow_up'
              )
            on conflict (idempotency_key) do nothing
            """,
            (now,),
        )
        follow_ups = cur.rowcount

        cur.execute(
            """
            select
              count(*) filter (where status = 'overdue') as overdue,
              count(*) filter (where status = 'needs_review') as needs_review,
              count(*) filter (where status = 'open' and stage = 'requested' and due_at <= %s) as waiting_on_family
            from public.customer_commitments
            """,
            (now,),
        )
        overdue, needs_review, waiting = cur.fetchone()

        cur.execute(
            """
            select count(*) from public.customer_deliveries
            where status = 'failed'
            """
        )
        failed = cur.fetchone()[0]

        cur.execute(
            """
            select count(*) from public.customer_deliveries
            where status = 'pending' and kind in ('catchup', 'manual_followup', 'follow_up')
            """
        )
        staged = cur.fetchone()[0]

    conn.commit()
    return {
        "newly_overdue": newly_overdue,
        "follow_ups": follow_ups,
        "overdue": overdue,
        "needs_review": needs_review,
        "waiting_on_family": waiting,
        "failed": failed,
        "staged": staged,
    }


def _actionable(summary: dict[str, int]) -> bool:
    return any(summary[key] > 0 for key in ("overdue", "needs_review", "failed", "staged", "waiting_on_family"))


def _alert_admin(summary: dict[str, int], now: datetime) -> None:
    api_key = os.environ.get("LOOPS_API_KEY", "").strip()
    template_id = os.environ.get("LOOPS_ADMIN_ALERT_ID", "").strip()
    admin_email = os.environ.get("ADMIN_ALERT_EMAIL", "").strip()
    if not api_key or not template_id or not admin_email:
        raise RuntimeError("LOOPS_API_KEY, LOOPS_ADMIN_ALERT_ID, and ADMIN_ALERT_EMAIL must be set")

    details = (
        f"Overdue {summary['overdue']}. Needs review {summary['needs_review']}. "
        f"Failed deliveries {summary['failed']}. Staged and unsent {summary['staged']}. "
        f"Contracts waiting on the family {summary['waiting_on_family']}. "
        "No customer email was sent."
    )
    body = json.dumps(
        {
            "email": admin_email,
            "transactionalId": template_id,
            "dataVariables": {
                "submissionType": "Promise audit",
                "email": admin_email,
                "summary": f"{summary['overdue']} overdue promises",
                "details": details,
                "submittedAt": now.isoformat(),
                "adminUrl": "https://www.starlynncare.com/admin/promises",
            },
        }
    ).encode()
    request = urllib.request.Request(
        "https://app.loops.so/api/v1/transactional",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Idempotency-Key": f"sla-admin-{now.date().isoformat()}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            response.read()
    except urllib.error.HTTPError as exc:
        if exc.code == 409:
            return
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Admin alert failed {exc.code}: {detail}") from exc


def main() -> int:
    load_env()
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        print("DATABASE_URL / POSTGRES_URL not set", file=sys.stderr)
        return 1
    import psycopg

    now = datetime.now(timezone.utc)
    with psycopg.connect(url) as conn:
        summary = audit(conn, now)
    print(json.dumps(summary))
    if not _actionable(summary):
        return 0
    _alert_admin(summary, now)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
