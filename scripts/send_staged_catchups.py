#!/usr/bin/env python3
"""List staged catch-up work. Sends nothing unless --approve is passed.

Catch-up email is a second, explicit step. The default run only prints counts.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parents[1]


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            break


def main() -> int:
    parser = argparse.ArgumentParser(description="Stage or send approved catch-up email")
    parser.add_argument(
        "--approve",
        action="store_true",
        help="Send overdue library-magnet catch-ups. Manual notes and area digests stay unsent.",
    )
    args = parser.parse_args()
    load_env()
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        print("DATABASE_URL / POSTGRES_URL not set", file=sys.stderr)
        return 1

    with psycopg.connect(url, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select c.product, d.kind, d.status, count(*)::int as n
                from public.customer_deliveries d
                join public.customer_commitments c on c.id = d.commitment_id
                where d.status = 'pending'
                group by 1, 2, 3
                order by 1, 2
                """
            )
            print(json.dumps([dict(row) for row in cur.fetchall()]))

        if not args.approve:
            print("Dry run. Pass --approve to send overdue guide catch-ups only.")
            return 0

        api_key = os.environ.get("LOOPS_API_KEY", "").strip()
        template_id = os.environ.get("LOOPS_MAGNET_ALW_ID", "").strip()
        if not api_key or not template_id:
            print("Refusing to send without LOOPS_API_KEY and LOOPS_MAGNET_ALW_ID", file=sys.stderr)
            return 1

        with conn.cursor() as cur:
            cur.execute(
                """
                select d.id, d.idempotency_key, c.email
                from public.customer_deliveries d
                join public.customer_commitments c on c.id = d.commitment_id
                where d.kind = 'catchup'
                  and d.status = 'pending'
                  and c.product = 'library_magnet'
                  and c.subject_key = 'alw_checklist'
                  and c.status = 'overdue'
                """
            )
            due = [dict(row) for row in cur.fetchall()]

        sent = 0
        for row in due:
            body = json.dumps(
                {
                    "email": row["email"],
                    "transactionalId": template_id,
                    "dataVariables": {},
                }
            ).encode()
            request = urllib.request.Request(
                "https://app.loops.so/api/v1/transactional",
                data=body,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "Idempotency-Key": str(row["idempotency_key"])[:100],
                },
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=20) as response:
                response.read()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    update public.customer_deliveries
                    set status = 'sent', sent_at = now(), attempted_at = now()
                    where id = %s
                    """,
                    (row["id"],),
                )
                cur.execute(
                    """
                    update public.customer_commitments
                    set status = 'fulfilled', stage = 'asset_sent',
                        last_fulfilled_at = now(), updated_at = now()
                    where email = %s and product = 'library_magnet' and subject_key = 'alw_checklist'
                    """,
                    (row["email"],),
                )
            conn.commit()
            sent += 1
        print(json.dumps({"sent": sent}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
