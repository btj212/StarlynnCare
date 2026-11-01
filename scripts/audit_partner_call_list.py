#!/usr/bin/env python3
"""Run the full partner gate on the first-20 call list.

The public “top half” line is the grade only. This script prints every rule.
A community is eligible only when partner_gate returns pass and publishable.
Read-only.
"""

from __future__ import annotations

import os
import sys

import psycopg
from psycopg.rows import dict_row

DSN = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")

CALLS = [
    ("Aegis Living Pleasant Hill", "CA", "%Aegis%Pleasant Hill%"),
    ("Clearwater Newport Beach", "CA", "%Clearwater%Newport%"),
    ("Merrill Gardens at Huntington Beach", "CA", "%Merrill Gardens%Huntington%"),
    ("Oakmont of Huntington Beach", "CA", "%Oakmont%Huntington%"),
    ("Fredericka Manor", "CA", "%Fredericka Manor%"),
    ("Ivy Park at Bonita", "CA", "%Ivy Park%Bonita%"),
    ("Sunrise at La Costa", "CA", "%Sunrise%La Costa%"),
    ("Welcome Home Oak Harbor", "WA", "%Welcome Home%Oak Harbor%"),
    ("The Cottages at University Place", "WA", "%Cottages%University Place%"),
    ("Empress Senior Living at Laurelhurst", "WA", "%Empress%Laurelhurst%"),
    ("Cogir of Northgate Memory Care", "WA", "%Cogir%Northgate%"),
    ("Ida Culver House Broadview", "WA", "%Ida Culver%Broadview%"),
    ("Vineyard Park at Queen Anne Manor", "WA", "%Vineyard Park%Queen Anne%"),
    ("Urbana Place Senior Living", "MN", "%Urbana Place%"),
    ("Lexington Landing", "MN", "%Lexington Landing%"),
    ("Bethany on the Lake", "MN", "%Bethany%Lake%"),
    ("Elan Gardens", "PA", "%Elan Gardens%"),
    ("Country Lane Memory Care", "IL", "%Country Lane%"),
    ("Oasis at Norterra", "AZ", "%Oasis%Norterra%"),
    ("Sunrise Assisted Living of Fair Oaks", "CA", "%Sunrise%Fair Oaks%"),
]


def main() -> int:
    if not DSN:
        print("Set SUPABASE_DB_URL or DATABASE_URL", file=sys.stderr)
        return 1
    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            for label, state, pattern in CALLS:
                cur.execute(
                    """
                    select id, name, publishable, license_status
                    from facilities
                    where state_code = %s
                      and publishable = true
                      and name ilike %s
                    order by name
                    """,
                    (state, pattern),
                )
                rows = cur.fetchall()
                print(f"\n{label} ({state})")
                if not rows:
                    print("  NOT FOUND among publishable facilities")
                    continue
                if len(rows) > 1:
                    print(f"  {len(rows)} name matches; each gate is listed")
                for row in rows:
                    cur.execute("select partner_gate(%s) as gate", (row["id"],))
                    gate = cur.fetchone()["gate"]
                    eligible = bool(gate.get("pass")) and bool(gate.get("publishable"))
                    print(f"  {row['name']}  license={row['license_status']}  eligible={eligible}")
                    for rule in gate.get("rules") or []:
                        mark = "pass" if rule.get("pass") else "FAIL"
                        print(f"    {mark}  {rule.get('code')}: {rule.get('detail')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
