#!/usr/bin/env python3
"""Backfill Texas HHSC inspections from the public TULIP guest API.

Dry-run is the default. Nothing is written unless you pass ``--apply``.

Matches facilities by license number (``LIcense_Number__c``), not by the
Salesforce Account Id. Scope is licensed Texas homes with
``serves_memory_care = true`` — the 547-home set, not only the
Alzheimer-certified subset.

Each facility is three polite Aura calls: search, inspections, enforcement.
``--delay`` is the pause between calls (default 0.4s). The May notes asked
for about one request a second; pass ``--delay 1`` for that.

Usage
-----
    python3 scrapers/tx_inspections_backfill.py
    python3 scrapers/tx_inspections_backfill.py --limit 5
    python3 scrapers/tx_inspections_backfill.py --apply

``--apply`` requires DATABASE_URL and does not flip ``publishable``.
After a write Blake still runs ``recompute_publishable.py --state TX``
if he wants the 48-month gate to publish pages.
"""

from __future__ import annotations

import argparse
import calendar
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

from tx_inspections_ingest import (
    SOURCE_AGENCY,
    STATE_CODE,
    _deficiency_dedupe_key,
    insert_deficiency,
    insert_inspection,
    load_env,
    pad_license_tx,
)
from tx_tulip_public import (
    TulipClient,
    parse_enforcement_payload,
    parse_inspection_payload,
    pick_search_hit,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPER_NAME = "tx_hhsc_tulip_public"
# Same 48-month window as the Texas publish gate. This script does not publish.
TX_FRESHNESS_MONTHS = 48


def freshness_floor(today: date | None = None) -> date:
    """The oldest inspection date the Texas publish gate would still count."""
    today = today or date.today()
    month = today.month - TX_FRESHNESS_MONTHS
    year = today.year
    while month <= 0:
        month += 12
        year -= 1
    day = min(today.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


@dataclass
class FacilityOutcome:
    license_number: str
    name: str
    facility_id: str | None
    had_inspection: bool
    matched: bool = False
    account_id: str | None = None
    inspections: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None


def load_facilities_from_db(
    conn: psycopg.Connection,
    *,
    license_filter: str | None,
    limit: int | None,
) -> list[dict[str, Any]]:
    sql = """
        SELECT id::text AS id,
               name,
               license_number,
               EXISTS (
                   SELECT 1 FROM inspections i WHERE i.facility_id = facilities.id
               ) AS has_inspection
        FROM facilities
        WHERE state_code = 'TX'
          AND serves_memory_care = true
          AND license_status = 'LICENSED'
    """
    params: list[Any] = []
    if license_filter:
        sql += " AND license_number = %s"
        params.append(pad_license_tx(license_filter))
    sql += " ORDER BY license_number, name"
    if limit is not None:
        sql += " LIMIT %s"
        params.append(int(limit))
    with conn.cursor() as cur:
        cur.execute(sql, params)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def load_facilities_from_roster(
    path: Path,
    *,
    license_filter: str | None,
    limit: int | None,
) -> list[dict[str, Any]]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise RuntimeError(f"{path} must be a JSON list of facilities.")
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict) or not row.get("license_number"):
            continue
        if license_filter and pad_license_tx(row["license_number"]) != pad_license_tx(license_filter):
            continue
        out.append(
            {
                "id": row.get("id"),
                "name": row.get("name") or "",
                "license_number": pad_license_tx(row["license_number"]),
                "has_inspection": bool(row.get("has_inspection")),
            }
        )
    out.sort(key=lambda r: (r["license_number"], r["name"]))
    if limit is not None:
        out = out[: int(limit)]
    return out


def fetch_one(client: TulipClient, facility: dict[str, Any]) -> FacilityOutcome:
    outcome = FacilityOutcome(
        license_number=pad_license_tx(facility["license_number"]),
        name=str(facility.get("name") or ""),
        facility_id=facility.get("id"),
        had_inspection=bool(facility.get("has_inspection")),
    )
    try:
        hits = client.search_license(outcome.license_number)
        hit = pick_search_hit(hits, outcome.license_number)
        if not hit:
            return outcome
        account_id = str(hit.get("Id") or "").strip()
        if not account_id:
            outcome.error = "TULIP row had no Account Id"
            return outcome
        outcome.matched = True
        outcome.account_id = account_id
        visits = parse_inspection_payload(client.inspections(account_id), account_id)
        penalties = parse_enforcement_payload(client.enforcement(account_id), account_id)
        outcome.inspections = visits + penalties
    except Exception as exc:  # noqa: BLE001 — one home must not abort the roster
        outcome.error = str(exc)
    return outcome


def summarize(outcomes: list[FacilityOutcome]) -> dict[str, Any]:
    """Counts Blake asked for, plus the split between survey dates and penalties.

    "Would gain" is a home with nothing stored today and at least one dated
    record from this fetch. A home that already has the 2023 smoke rows is
    not in that gain count, but it is in "would have at least one".
    """
    inspections = [item for outcome in outcomes for item in outcome.inspections]
    dates = [item["inspection_date"] for item in inspections if item.get("inspection_date")]
    newest = max(dates) if dates else None
    survey = [
        item
        for item in inspections
        if (item.get("raw_data") or {}).get("method") == "retrieveInspectionsInfo"
    ]
    enforcement = [
        item
        for item in inspections
        if (item.get("raw_data") or {}).get("method") == "retrieveRSEventForEnfAction"
    ]
    gain = sum(1 for outcome in outcomes if outcome.inspections and not outcome.had_inspection)
    would_have = sum(1 for outcome in outcomes if outcome.had_inspection or outcome.inspections)
    fresh_homes = 0
    for outcome in outcomes:
        owned = [item["inspection_date"] for item in outcome.inspections if item.get("inspection_date")]
        newest_home = max(owned) if owned else None
        if newest_home and newest_home >= freshness_floor().isoformat():
            fresh_homes += 1
    return {
        "facilities_in_scope": len(outcomes),
        "facilities_matched": sum(1 for outcome in outcomes if outcome.matched),
        "facilities_unmatched": sum(1 for outcome in outcomes if not outcome.matched and not outcome.error),
        "fetch_errors": sum(1 for outcome in outcomes if outcome.error),
        "inspections_found": len(inspections),
        "survey_visits": len(survey),
        "enforcement_actions": len(enforcement),
        "citations_found": sum(int(item.get("total_deficiency_count") or 0) for item in inspections),
        "newest_date": newest,
        "facilities_that_would_gain_an_inspection": gain,
        "homes_that_would_have_at_least_one_inspection": would_have,
        "homes_whose_newest_fetched_date_is_inside_48_months": fresh_homes,
    }


def format_report(summary: dict[str, Any], *, apply: bool) -> str:
    mode = "APPLY" if apply else "dry-run"
    newest = summary["newest_date"] or "none"
    lines = [
        f"Texas HHSC inspection backfill — {mode}",
        f"Facilities in scope: {summary['facilities_in_scope']}",
        f"Facilities matched by license number: {summary['facilities_matched']}",
        f"Facilities with no TULIP account: {summary['facilities_unmatched']}",
        f"Fetch errors: {summary['fetch_errors']}",
        f"Inspections found: {summary['inspections_found']}",
        f"  survey visits: {summary['survey_visits']}",
        f"  enforcement actions: {summary['enforcement_actions']}",
        f"Citations found: {summary['citations_found']}",
        f"Newest date: {newest}",
        f"Facilities that would gain at least one inspection: {summary['facilities_that_would_gain_an_inspection']}",
        f"TX memory-care homes that would have at least one inspection: {summary['homes_that_would_have_at_least_one_inspection']}",
        (
            "Homes whose newest fetched date is on or after "
            f"{freshness_floor().isoformat()} (48-month gate, not applied here): "
            f"{summary['homes_whose_newest_fetched_date_is_inside_48_months']}"
        ),
    ]
    return "\n".join(lines)


def _already_stored(cur: psycopg.Cursor, facility_id: str, inspection: dict[str, Any]) -> bool:
    event_id = inspection.get("source_event_id")
    if event_id:
        cur.execute(
            """
            SELECT 1 FROM inspections
            WHERE source_agency = %s AND source_event_id = %s
            """,
            (SOURCE_AGENCY, event_id),
        )
        if cur.fetchone():
            return True
    cur.execute(
        """
        SELECT 1 FROM inspections
        WHERE facility_id = %s::uuid
          AND inspection_date = %s
          AND inspection_type = %s
          AND source_agency = %s
          AND source_event_id IS NULL
        """,
        (
            facility_id,
            inspection["inspection_date"],
            inspection.get("inspection_type") or "standard",
            SOURCE_AGENCY,
        ),
    )
    return cur.fetchone() is not None


def write_outcomes(
    conn: psycopg.Connection,
    outcomes: list[FacilityOutcome],
    scrape_run_id: str,
) -> dict[str, int]:
    """Insert new rows. A home that fails rolls back to its savepoint."""
    totals = {"inspections": 0, "deficiencies": 0, "skipped": 0}
    for outcome in outcomes:
        if not outcome.facility_id or not outcome.inspections:
            continue
        with conn.cursor() as cur:
            cur.execute("SAVEPOINT sp")
        try:
            for inspection in outcome.inspections:
                with conn.cursor() as cur:
                    if _already_stored(cur, outcome.facility_id, inspection):
                        totals["skipped"] += 1
                        continue
                inspection_id = insert_inspection(
                    conn, outcome.facility_id, inspection, scrape_run_id
                )
                totals["inspections"] += 1
                for deficiency in inspection.get("deficiencies") or []:
                    dedupe = _deficiency_dedupe_key(inspection_id, deficiency)
                    insert_deficiency(conn, inspection_id, deficiency, dedupe)
                    totals["deficiencies"] += 1
            with conn.cursor() as cur:
                cur.execute("RELEASE SAVEPOINT sp")
            conn.commit()
        except Exception as exc:  # noqa: BLE001
            with conn.cursor() as cur:
                cur.execute("ROLLBACK TO SAVEPOINT sp")
            conn.commit()
            outcome.error = f"write failed: {exc}"
            print(f"  write error {outcome.license_number}: {exc}", file=sys.stderr)
    return totals


def _start_scrape_run(conn: psycopg.Connection) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO scrape_runs (state_code, scraper_name, status, started_at)
            VALUES (%s, %s, 'running', %s)
            RETURNING id::text
            """,
            (STATE_CODE, SCRAPER_NAME, datetime.now(timezone.utc)),
        )
        run_id = str(cur.fetchone()[0])
    conn.commit()
    return run_id


def _finish_scrape_run(
    conn: psycopg.Connection,
    run_id: str,
    *,
    status: str,
    records: int,
    error_log: str | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE scrape_runs SET
                completed_at = now(),
                status = %s,
                records_found = %s,
                records_new = %s,
                error_log = %s
            WHERE id = %s::uuid
            """,
            (status, records, records, error_log, run_id),
        )
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill TX inspections from public TULIP (dry-run unless --apply)")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write inspections and citations. Default is a dry-run that only prints counts.",
    )
    parser.add_argument("--license", default=None, help="Only this license number")
    parser.add_argument("--limit", type=int, default=None, help="Max facilities")
    parser.add_argument("--delay", type=float, default=0.4, help="Seconds between TULIP calls")
    parser.add_argument(
        "--roster",
        type=Path,
        default=None,
        help="Dry-run only: JSON list of {license_number, name, has_inspection} instead of DATABASE_URL",
    )
    args = parser.parse_args()

    load_env()
    # Also accept a dotenv at repo root when this file is launched from elsewhere.
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)

    if args.apply and args.roster:
        print("Refusing --apply with --roster. --apply reads facilities from DATABASE_URL.", file=sys.stderr)
        sys.exit(2)
    if args.apply and not os.environ.get("DATABASE_URL"):
        print("Refusing --apply without DATABASE_URL.", file=sys.stderr)
        sys.exit(2)

    facilities: list[dict[str, Any]]
    if args.apply or (args.roster is None and os.environ.get("DATABASE_URL")):
        with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
            facilities = load_facilities_from_db(
                conn, license_filter=args.license, limit=args.limit
            )
    elif args.roster:
        facilities = load_facilities_from_roster(
            args.roster, license_filter=args.license, limit=args.limit
        )
    else:
        print(
            "DATABASE_URL is not set. Dry-run needs it, or pass --roster with a JSON license list.",
            file=sys.stderr,
        )
        sys.exit(2)

    if not facilities:
        print("No Texas memory-care facilities matched.")
        sys.exit(0)

    client = TulipClient(delay=max(0.0, args.delay))
    client.open()
    outcomes: list[FacilityOutcome] = []
    consecutive_errors = 0
    for index, facility in enumerate(facilities, start=1):
        outcome = fetch_one(client, facility)
        outcomes.append(outcome)
        if outcome.error:
            consecutive_errors += 1
            print(f"  error {outcome.license_number}: {outcome.error}", file=sys.stderr)
            if consecutive_errors >= 5:
                print("Stopping: five TULIP errors in a row.", file=sys.stderr)
                break
        else:
            consecutive_errors = 0
        if index % 25 == 0 or index == len(facilities):
            print(
                f"  … {index}/{len(facilities)}  matched {sum(1 for o in outcomes if o.matched)}",
                flush=True,
            )

    summary = summarize(outcomes)
    print(format_report(summary, apply=args.apply))
    if len(outcomes) < len(facilities):
        print(f"PARTIAL: stopped after {len(outcomes)} of {len(facilities)} facilities.")

    if not args.apply:
        return

    errors = [f"{o.license_number}: {o.error}" for o in outcomes if o.error]
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        run_id = _start_scrape_run(conn)
        totals = write_outcomes(conn, outcomes, run_id)
        status = "success" if not errors else "partial"
        _finish_scrape_run(
            conn,
            run_id,
            status=status,
            records=totals["inspections"],
            error_log="\n".join(errors) or None,
        )
    print(
        f"Wrote inspections={totals['inspections']} deficiencies={totals['deficiencies']} "
        f"skipped={totals['skipped']} scrape_run_id={run_id}"
    )


if __name__ == "__main__":
    main()
