#!/usr/bin/env python3
"""Read state enforcement letters and write compliance flags.

Washington adult family homes are the first source. A home is marked checked
only after its document list was read. An unreviewed Tier 1 flag keeps that
home unpublished. Families are not emailed.

  python3 scrapers/compliance_flags_run.py --state WA --approved-only
  python3 scrapers/compliance_flags_run.py --state WA --license 0000756400
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import make_session, polite_sleep  # noqa: E402
from _watch_alert import send_admin_notice  # noqa: E402
from compliance.classify import (  # noqa: E402
    SourceDoc,
    build_diff,
    classify_documents,
)
from compliance.sources import require_state  # noqa: E402
from compliance.wa_dshs import cache_path, read_home  # noqa: E402

ADMIN_URL = "https://www.starlynncare.com/admin/compliance"


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            return


def get_conn() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    return psycopg.connect(url)


def load_homes(
    conn: psycopg.Connection,
    *,
    approved_only: bool,
    license_number: str | None,
    limit: int | None,
) -> list[dict[str, Any]]:
    clauses = ["state_code = 'WA'", "license_number IS NOT NULL"]
    params: list[Any] = []
    if license_number:
        clauses.append(
            "ltrim(regexp_replace(license_number, '\\D', '', 'g'), '0') = ltrim(%s, '0')"
        )
        params.append("".join(ch for ch in license_number if ch.isdigit()))
    if approved_only:
        clauses.append("(mc_review_status = 'reviewed_publish' OR publishable = true)")
    limit_sql = ""
    if limit:
        limit_sql = "LIMIT %s"
        params.append(limit)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT id::text, name, license_number, wa_facility_type, city
            FROM facilities
            WHERE {' AND '.join(clauses)}
            ORDER BY license_number
            {limit_sql}
            """,
            params,
        )
        return list(cur.fetchall())


def load_previous(conn: psycopg.Connection, facility_ids: list[str]) -> dict[str, dict]:
    if not facility_ids:
        return {}
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT facility_id::text, tier, docs, review_status, banner_text
            FROM facility_compliance_flags
            WHERE facility_id = ANY(%s::uuid[])
            """,
            (facility_ids,),
        )
        return {row["facility_id"]: row for row in cur.fetchall()}


def upsert_inventory(conn: psycopg.Connection, facility: dict, links: list) -> None:
    with conn.cursor() as cur:
        for link in links:
            cur.execute(
                """
                INSERT INTO wa_pdf_inventory
                  (facility_id, license_number, source_url, doc_type, posted_month)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (source_url) DO UPDATE
                  SET doc_type = EXCLUDED.doc_type,
                      posted_month = EXCLUDED.posted_month,
                      facility_id = EXCLUDED.facility_id
                """,
                (
                    facility["id"],
                    facility["license_number"],
                    link.url,
                    link.doc_type,
                    link.posted_month,
                ),
            )


def mark_downloaded(conn: psycopg.Connection, links: list) -> None:
    """Point the existing PDF parser at files this run already saved."""
    with conn.cursor() as cur:
        for link in links:
            path = cache_path(link.url)
            if not path.is_file():
                continue
            payload = path.read_bytes()
            cur.execute(
                """
                UPDATE wa_pdf_inventory
                SET download_status = 'done',
                    local_path = %s,
                    sha256 = %s,
                    size_bytes = %s,
                    downloaded_at = now(),
                    download_error = NULL
                WHERE source_url = %s
                  AND download_status IS DISTINCT FROM 'done'
                """,
                (str(path), hashlib.sha256(payload).hexdigest(), len(payload), link.url),
            )


def review_status_for(previous: dict | None, tier: int, docs: list[dict]) -> str | None:
    if tier != 1:
        return None
    if not previous or previous.get("tier") != 1:
        return "pending"
    same_docs = json.dumps(previous.get("docs") or [], sort_keys=True) == json.dumps(docs, sort_keys=True)
    if same_docs and previous.get("review_status") in ("approved", "held"):
        return previous["review_status"]
    if same_docs and previous.get("review_status") == "pending":
        return "pending"
    return "pending"


def save_flag(
    conn: psycopg.Connection,
    facility: dict,
    result,
    review_status: str | None,
    checked_at: datetime,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO facility_compliance_flags (
              facility_id, state_code, license_number, tier, banner_text,
              docs, unread_docs, checked_at, review_status
            )
            VALUES (%s, 'WA', %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s)
            ON CONFLICT (facility_id) DO UPDATE SET
              license_number = EXCLUDED.license_number,
              tier = EXCLUDED.tier,
              banner_text = EXCLUDED.banner_text,
              docs = EXCLUDED.docs,
              unread_docs = EXCLUDED.unread_docs,
              checked_at = EXCLUDED.checked_at,
              review_status = EXCLUDED.review_status,
              reviewed_by = CASE
                WHEN EXCLUDED.review_status IS DISTINCT FROM facility_compliance_flags.review_status
                  THEN NULL
                ELSE facility_compliance_flags.reviewed_by
              END,
              reviewed_at = CASE
                WHEN EXCLUDED.review_status IS DISTINCT FROM facility_compliance_flags.review_status
                  THEN NULL
                ELSE facility_compliance_flags.reviewed_at
              END
            """,
            (
                facility["id"],
                facility["license_number"],
                result.tier,
                result.banner_text,
                json.dumps(result.docs),
                json.dumps(result.unread_docs),
                checked_at,
                review_status,
            ),
        )
        if facility.get("wa_facility_type") == "AFH":
            cur.execute(
                """
                UPDATE facilities
                SET state_records_checked_at = %s,
                    publishable = (
                      license_status = 'LICENSED'
                      AND serves_memory_care = true
                      AND mc_review_status <> 'reviewed_reject'
                      AND NOT EXISTS (
                        SELECT 1 FROM facility_compliance_flags c
                        WHERE c.facility_id = facilities.id
                          AND c.tier = 1
                          AND c.review_status IS DISTINCT FROM 'approved'
                      )
                    )
                WHERE id = %s
                """,
                (checked_at, facility["id"]),
            )
        else:
            cur.execute(
                """
                UPDATE facilities
                SET state_records_checked_at = %s
                WHERE id = %s
                """,
                (checked_at, facility["id"]),
            )


def notify_new_tier1(new_flags: list[dict]) -> None:
    if not new_flags:
        return
    lines = [
        f"{row.get('name') or 'Home'} ({row.get('license_number') or 'no license'})"
        for row in new_flags[:40]
    ]
    extra = ""
    if len(new_flags) > 40:
        extra = f"\n…and {len(new_flags) - 40} more."
    try:
        send_admin_notice(
            summary=f"Washington has {len(new_flags)} new Tier 1 compliance flag(s)",
            details="These homes stay unpublished until the banner is approved at the compliance queue.\n"
            + "\n".join(lines)
            + extra,
            admin_url=ADMIN_URL,
        )
        print(f"  Notified operator about {len(new_flags)} new Tier 1 flag(s).")
    except Exception as exc:  # noqa: BLE001
        print(f"  Could not notify the operator: {exc}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write state compliance flags")
    parser.add_argument("--state", default="WA")
    parser.add_argument("--approved-only", action="store_true")
    parser.add_argument("--license")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--as-of", help="YYYY-MM-DD. Defaults to today.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    state = require_state(args.state)
    as_of = date.fromisoformat(args.as_of) if args.as_of else date.today()
    load_env()
    started = datetime.now(timezone.utc)

    conn = get_conn()
    homes = load_homes(
        conn,
        approved_only=args.approved_only,
        license_number=args.license,
        limit=args.limit,
    )
    print(f"{state}: {len(homes)} homes as of {as_of.isoformat()}")
    previous = load_previous(conn, [home["id"] for home in homes])
    session = make_session()

    current: dict[str, dict] = {}
    counts = {"0": 0, "1": 0, "2": 0, "3": 0}
    failures = 0

    for home in homes:
        try:
            _page, links, readable, unread = read_home(
                session,
                home["license_number"],
                home.get("wa_facility_type"),
            )
            documents = [
                SourceDoc(
                    filename=link.filename,
                    text=text,
                    url=link.url,
                    doc_type=link.doc_type,
                    posted_month=link.posted_month,
                )
                for link, text, _method in readable
            ]
            result = classify_documents(documents, as_of=as_of, unread_docs=unread)
            counts[str(result.tier)] += 1
            current[home["id"]] = {
                "tier": result.tier,
                "docs": result.docs,
                "name": home["name"],
                "license_number": home["license_number"],
            }
            print(
                f"  {home['name']}: tier {result.tier}"
                f" ({len(links)} docs, {len(unread)} unread)"
            )
            if args.dry_run:
                if result.banner_text:
                    print(f"    {result.banner_text[:240]}")
                continue
            upsert_inventory(conn, home, links)
            mark_downloaded(conn, links)
            status = review_status_for(previous.get(home["id"]), result.tier, result.docs)
            save_flag(conn, home, result, status, started)
            conn.commit()
        except Exception as exc:  # noqa: BLE001
            failures += 1
            conn.rollback()
            print(f"  ERROR {home['name']}: {exc}", file=sys.stderr)
        polite_sleep(0.25, 0.1)

    previous_for_diff = {
        facility_id: {
            "tier": row["tier"],
            "docs": row["docs"] if isinstance(row["docs"], list) else row["docs"],
            "name": "",
        }
        for facility_id, row in previous.items()
    }
    # Only compare homes this run actually read. A failure is not a lift.
    previous_for_diff = {
        facility_id: row
        for facility_id, row in previous_for_diff.items()
        if facility_id in current
    }
    diff = build_diff(previous_for_diff, current)
    print(
        "Counts:",
        ", ".join(f"tier {tier}={counts[tier]}" for tier in ("1", "2", "3", "0")),
    )
    print(
        f"Changes: {len(diff['new_flags'])} new Tier 1, "
        f"{len(diff['lifted_flags'])} lowered, {len(diff['tier_changes'])} tier changes"
    )

    if not args.dry_run:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO compliance_flag_runs
                  (state_code, started_at, finished_at, counts, diff)
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb)
                """,
                (
                    state,
                    started,
                    datetime.now(timezone.utc),
                    json.dumps({**counts, "failures": failures, "homes": len(homes)}),
                    json.dumps(diff),
                ),
            )
        conn.commit()
        notify_new_tier1(diff["new_flags"])

    conn.close()
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
