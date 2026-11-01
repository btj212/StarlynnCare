#!/usr/bin/env python3
"""Re-check every current partner and pause Stripe when the gate fails.

Run after scrapers/refresh_snapshot_cache.py. The gate itself calls
facility_snapshot(), so this still runs when the cache refresh fails.
A stale price is not a reason to pause billing. A manual pause is left alone.
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import urllib.error
import urllib.parse
import urllib.request

import psycopg
from psycopg.rows import dict_row

from partner_gate_rules import next_partner_state

DSN = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
STRIPE_KEY = os.environ.get("STRIPE_SECRET_KEY", "").strip()


def stripe_form(subscription_id: str, fields: dict[str, str]) -> None:
    if not STRIPE_KEY:
        raise RuntimeError("STRIPE_SECRET_KEY is required to pause or resume partner billing")
    body = urllib.parse.urlencode(fields).encode()
    request = urllib.request.Request(
        f"https://api.stripe.com/v1/subscriptions/{subscription_id}",
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {STRIPE_KEY}"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        json.loads(response.read().decode())


def stripe_pause(subscription_id: str) -> None:
    stripe_form(subscription_id, {"pause_collection[behavior]": "void"})


def stripe_resume(subscription_id: str) -> None:
    stripe_form(subscription_id, {"pause_collection": ""})


def main() -> int:
    if not DSN:
        print("Set SUPABASE_DB_URL or DATABASE_URL", file=sys.stderr)
        return 1
    failures = 0
    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select id, facility_id, status, pause_reason, collection_paused, stripe_subscription_id
                from partners
                where status in ('active', 'paused', 'past_due')
                order by created_at
                """
            )
            rows = cur.fetchall()
        with conn.cursor() as cur:
            cur.execute(
                """
                update partners
                set status = 'canceled',
                    canceled_at = now(),
                    checkout_reserved_until = null,
                    updated_at = now()
                where status = 'pending'
                  and stripe_subscription_id is null
                  and checkout_reserved_until < now() - interval '24 hours'
                """
            )
        needs_stripe = any(row["stripe_subscription_id"] for row in rows)
        if needs_stripe and not STRIPE_KEY:
            print("STRIPE_SECRET_KEY is required while a partner has a Stripe subscription", file=sys.stderr)
            return 1
        for row in rows:
            with conn.cursor() as cur:
                cur.execute("select partner_gate(%s) as gate", (row["facility_id"],))
                gate = cur.fetchone()["gate"]
            passed = bool(gate.get("pass")) and bool(gate.get("publishable"))
            decision = next_partner_state(
                gate_pass=passed,
                status=row["status"],
                pause_reason=row["pause_reason"],
                collection_paused=row["collection_paused"],
            )
            subscription_id = row["stripe_subscription_id"]
            try:
                if decision.get("stripe") == "pause" and subscription_id:
                    stripe_pause(subscription_id)
                elif decision.get("stripe") == "resume" and subscription_id:
                    stripe_resume(subscription_id)
            except (urllib.error.URLError, RuntimeError, json.JSONDecodeError) as exc:
                print(f"{row['facility_id']}: stripe {decision.get('stripe')} failed: {exc}", file=sys.stderr)
                failures += 1
                continue
            with conn.cursor() as cur:
                if decision["change"]:
                    cur.execute(
                        """
                        update partners
                        set status = %s,
                            pause_reason = %s,
                            collection_paused = %s,
                            gate_last_checked_at = now(),
                            gate_last_pass = %s,
                            updated_at = now()
                        where id = %s
                        """,
                        (
                            decision["status"],
                            decision["pause_reason"],
                            decision["collection_paused"],
                            passed,
                            row["id"],
                        ),
                    )
                else:
                    cur.execute(
                        """
                        update partners
                        set gate_last_checked_at = now(),
                            gate_last_pass = %s,
                            updated_at = now()
                        where id = %s
                        """,
                        (passed, row["id"]),
                    )
        conn.commit()
    print(f"Checked {len(rows)} partner(s); stripe failures: {failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
