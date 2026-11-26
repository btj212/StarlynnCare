#!/usr/bin/env python3
"""Refresh California license status from the live CDSS file.

Reads every CA facility row, compares it with the CDSS statewide RCFE file
(see scrapers/_cdss_live.py), and:

* writes license_status, license_status_source, license_status_checked_at,
  license_closed_date when CDSS differs (only with --apply);
* stamps license_status_checked_at on rows that already match (--apply);
* unpublishes a home only when CDSS (bulk file AND FacilityDetail) confirms
  CLOSED or REVOKED -- Blake's rule of 2026-11-26. It never publishes
  anything: a reopened or new license is left for recompute/review, and
  nothing blocks it (the block is status-based, not sticky);
* writes a CSV of every field mismatch (status, name, street, city, zip,
  beds, licensee) and a CSV of published homes that are no longer LICENSED,
  for review.

Rows CDSS no longer lists are left alone and reported as not_in_cdss.
A status change to CLOSED / ON PROBATION / REVOKED / LICENSED-from-other is
confirmed against FacilityDetail first when --confirm-detail is set (default
on with --apply); a disagreement is held, not written.

Run (from the Mac; GitHub runners cannot reach CDSS reliably):
    python scrapers/ca_status_refresh.py                 # dry run, CSVs only
    python scrapers/ca_status_refresh.py --apply         # write status columns
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import _cdss_live as live  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = REPO_ROOT / "data" / "ca_status_refresh"
CACHE_DIR = REPO_ROOT / "data" / ".cache" / "cdss"
DETAIL_DELAY_SECS = 0.8
# A day where more than this share of rows flips status is treated as a bad
# file, not a real change, and nothing is written.
MAX_CHANGE_SHARE = 0.15

_ABBR = {
    "AVENUE": "AVE", "STREET": "ST", "DRIVE": "DR", "ROAD": "RD", "LANE": "LN",
    "BOULEVARD": "BLVD", "COURT": "CT", "PLACE": "PL", "CIRCLE": "CIR",
    "PARKWAY": "PKWY", "TERRACE": "TER", "HIGHWAY": "HWY", "NORTH": "N",
    "SOUTH": "S", "EAST": "E", "WEST": "W", "SUITE": "STE", "AND": "&",
}


def norm_text(value: Any) -> str:
    text = str(value or "").upper().replace("&", " AND ")
    text = re.sub(r"[^A-Z0-9 ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def norm_street(value: Any) -> str:
    words = re.sub(r"[^A-Z0-9 ]", " ", str(value or "").upper()).split()
    return " ".join(_ABBR.get(w, w) for w in words)


def compare_row(db: dict[str, Any], cdss: dict[str, str]) -> list[tuple[str, str, str]]:
    """Return (field, db_value, cdss_value) for every meaningful difference."""
    diffs: list[tuple[str, str, str]] = []
    checks = (
        ("license_status", db.get("license_status"), cdss.get("Facility Status"), lambda v: str(v or "").upper().strip()),
        ("name", db.get("name"), cdss.get("Facility Name"), norm_text),
        ("street", db.get("street"), cdss.get("Facility Address"), norm_street),
        ("city", db.get("city"), cdss.get("Facility City"), norm_text),
        ("zip", db.get("zip"), (cdss.get("Facility Zip") or "")[:5], norm_text),
        ("beds", "" if db.get("beds") is None else str(db.get("beds")), cdss.get("Facility Capacity"), norm_text),
        ("operator_name", db.get("operator_name"), cdss.get("Licensee"), norm_text),
    )
    for field, db_value, live_value, norm in checks:
        if norm(db_value) != norm(live_value):
            diffs.append((field, str(db_value or ""), str(live_value or "")))
    return diffs


def needs_detail_confirmation(old: str | None, new: str) -> bool:
    return new in {"CLOSED", "ON PROBATION", "REVOKED"} or (old or "") in {"CLOSED", "ON PROBATION", "REVOKED"}


def closes_listing(change: dict[str, Any]) -> bool:
    """Unpublish only on a CLOSED/REVOKED change that FacilityDetail also confirmed."""
    return change["new"] in {"CLOSED", "REVOKED"} and change.get("detail_status") == change["new"]


def load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="Write license-status columns; unpublish confirmed CLOSED/REVOKED homes (never publishes).")
    parser.add_argument("--no-confirm-detail", action="store_true", help="Skip the FacilityDetail second view.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--published-only", action="store_true")
    args = parser.parse_args()

    load_env()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 1
    import psycopg  # local import so unit tests need no driver

    snapshot = live.fetch_bulk_rcfe(cache_dir=CACHE_DIR)
    checked_at = snapshot.fetched_at
    print(
        f"CDSS bulk: {len(snapshot.rows)} RCFEs, newest visit {snapshot.newest_visit}, "
        f"newest closed {snapshot.newest_closed}, fetched {checked_at.isoformat()}"
    )

    with psycopg.connect(dsn, connect_timeout=30) as conn:
        cols = {
            r[0]
            for r in conn.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='facilities'"
            )
        }
        needed = {"license_status_source", "license_status_checked_at", "license_closed_date", "license_status_detail"}
        if args.apply and not needed <= cols:
            print(f"Apply migration 0082 first; missing columns {sorted(needed - cols)}", file=sys.stderr)
            return 1
        where = "state_code = 'CA'" + (" AND publishable" if args.published_only else "")
        cur = conn.execute(
            f"SELECT id::text, license_number, name, street, city, zip, beds, operator_name, "
            f"license_status, publishable FROM facilities WHERE {where}"
        )
        names = [d.name for d in cur.description]
        db_rows = [dict(zip(names, r)) for r in cur.fetchall()]

    args.out.mkdir(parents=True, exist_ok=True)
    stamp = checked_at.strftime("%Y%m%dT%H%MZ")
    diff_rows: list[dict[str, Any]] = []
    status_changes: list[dict[str, Any]] = []
    not_in_cdss: list[dict[str, Any]] = []
    matched_ids: list[str] = []
    for db in db_rows:
        cdss = snapshot.rows.get(live.pad_license(db["license_number"]))
        if cdss is None:
            not_in_cdss.append(db)
            continue
        changed_status = False
        for field, old, new in compare_row(db, cdss):
            diff_rows.append({"id": db["id"], "license_number": db["license_number"], "publishable": db["publishable"],
                              "field": field, "db_value": old, "cdss_value": new})
            if field == "license_status" and new in live.VALID_STATUSES:
                changed_status = True
                status_changes.append({"db": db, "cdss": cdss, "old": old, "new": new})
        if not changed_status:
            matched_ids.append(db["id"])

    if db_rows and len(status_changes) / len(db_rows) > MAX_CHANGE_SHARE and args.apply:
        print(f"{len(status_changes)} of {len(db_rows)} rows would change status; refusing (> {MAX_CHANGE_SHARE:.0%}). "
              "Inspect the CSVs and rerun with a reviewed file.", file=sys.stderr)
        args.apply = False

    confirmed: list[dict[str, Any]] = []
    held: list[dict[str, Any]] = []
    for change in status_changes:
        if args.no_confirm_detail or not needs_detail_confirmation(change["old"], change["new"]):
            confirmed.append(change)
            continue
        try:
            detail = live.fetch_facility_detail(change["db"]["license_number"])
            change["detail_status"] = live.detail_status(detail)
            change["detail_text"] = str(detail.get("STATUS") or "")
            (confirmed if change["detail_status"] == change["new"] else held).append(change)
        except Exception as exc:  # noqa: BLE001
            change["detail_error"] = str(exc)
            held.append(change)
        time.sleep(DETAIL_DELAY_SECS)

    with open(args.out / f"diff_{stamp}.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["id", "license_number", "publishable", "field", "db_value", "cdss_value"])
        w.writeheader()
        w.writerows(diff_rows)
    with open(args.out / f"published_not_licensed_{stamp}.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "license_number", "name", "db_status", "cdss_status", "closed_date", "detail_status", "state"])
        for c in confirmed + held:
            if c["db"]["publishable"] and c["new"] != "LICENSED":
                w.writerow([c["db"]["id"], c["db"]["license_number"], c["db"]["name"], c["old"], c["new"],
                            c["cdss"].get("Closed Date"), c.get("detail_text", ""), "confirmed" if c in confirmed else "held"])

    print(f"rows {len(db_rows)}; not in CDSS {len(not_in_cdss)}; field diffs {len(diff_rows)}; "
          f"status changes {len(status_changes)} (confirmed {len(confirmed)}, held {len(held)})")
    if not args.apply:
        print("Dry run: nothing written.")
        return 0

    with psycopg.connect(dsn, connect_timeout=30) as conn:
        with conn.cursor() as cur:
            for c in confirmed:
                cur.execute(
                    """
                    UPDATE facilities SET
                        license_status            = %s,
                        license_status_source     = %s,
                        license_status_checked_at = %s,
                        license_status_detail     = %s,
                        license_closed_date       = %s,
                        publishable               = CASE WHEN %s THEN false ELSE publishable END,
                        updated_at                = now()
                    WHERE id = %s::uuid AND state_code = 'CA'
                    """,
                    (c["new"], live.SOURCE_BULK, checked_at, c.get("detail_text") or None,
                     live.parse_mdy(c["cdss"].get("Closed Date")),
                     closes_listing(c), c["db"]["id"]),
                )
            if matched_ids:
                cur.execute(
                    """
                    UPDATE facilities SET
                        license_status_source     = %s,
                        license_status_checked_at = %s
                    WHERE id = ANY(%s::uuid[]) AND state_code = 'CA'
                    """,
                    (live.SOURCE_BULK, checked_at, matched_ids),
                )
        conn.commit()
    unpublished = [c for c in confirmed if closes_listing(c) and c["db"]["publishable"]]
    print(f"Wrote {len(confirmed)} status changes ({len(unpublished)} published homes unpublished as closed); "
          f"stamped {len(matched_ids)} unchanged rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
