#!/usr/bin/env python3
"""
Layer 0 — Source API Contract Checks.

Layers 1/2/3/5 (see docs/VALIDATION.md) all check things *downstream* of
ingest: DB-internal invariants, DB-vs-content-file reconciliation, DB-vs-
live-page rendering. None of them re-fetch the original upstream source, so
none would catch: an upstream API silently renaming/dropping a field we
depend on, or a stored value drifting from what the live source now says.

This layer closes that gap for the two ingest sources that are stable public
HTTP APIs (safe to re-hit repeatedly and automatically): the CMS Nursing
Home Provider Information feed and the Census Geocoder. Every check here
makes a REAL network call to the REAL upstream service and compares it
against REAL rows already in the DB — no mocks, no fixtures, no recorded
cassettes.

State sources that are NOT covered here on purpose: portal scrapers driven
by Playwright/OCR against government sites not built for automated traffic
(AZ Salesforce, MO ShowMeLTC, WA BHForms, IL LLCS, TX TULIP). Re-running
those on a schedule risks rate-limiting/blocking a real regulator's site and
several are already logged as manual/semi-manual by design (see MEMORY.md,
"State Watch alerts are scan-ledger driven"). Their correctness is instead
covered by Layer 5 post-ingest checks run once, right after each manual
ingest. See docs/VALIDATION.md for the full scope note.

Usage:
  python3 scripts/validate/source_contract_checks.py
  python3 scripts/validate/source_contract_checks.py --sample 10
  python3 scripts/validate/source_contract_checks.py --skip-census
"""
from __future__ import annotations

import argparse
import csv
import io
import sys
import time
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS_DIR.parent
SCRAPERS_DIR = REPO_ROOT / "scrapers"
for p in (str(SCRIPTS_DIR), str(SCRAPERS_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from validate._lib import check, get_conn, run_all_checks  # noqa: E402
from _http_helpers import make_session  # noqa: E402
from cms_nh_directory_ingest import (  # noqa: E402
    _CMS_FIELDS,
    _get_cms_csv_url,
    _safe_float,
    _safe_int,
    _safe_rating,
)
from recompute_physical_city import _fetch_census_place  # noqa: E402

CMS_DATASET_UUID = "4pq5-n9py"


def _fetch_cms_csv_rows(session) -> list[dict]:
    csv_url = _get_cms_csv_url(session, CMS_DATASET_UUID)
    resp = session.get(csv_url, timeout=120, stream=True)
    resp.raise_for_status()
    content = resp.content.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(content)))


def check_cms_nh_directory_contract(conn, session, sample: int) -> None:
    print("\n=== CMS NH Provider Directory — live source contract ===")
    with conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT state_code FROM facilities "
            "WHERE cms_ccn IS NOT NULL ORDER BY state_code"
        )
        states = [r["state_code"] for r in cur.fetchall()]

    if not check(
        "CMS: at least one state has cms_ccn-linked facilities",
        bool(states),
        f"{len(states)} states",
    ):
        return

    print("  Downloading live CMS provider CSV (all states)…")
    all_rows = _fetch_cms_csv_rows(session)
    if not check("CMS: live CSV returned rows", len(all_rows) > 0, f"{len(all_rows)} rows"):
        return

    # Schema-drift guard: every field the ingest script names must still be a
    # real column in the live feed. This is the check that would have caught
    # CMS's past rename of the data-api endpoint before it broke ingest.
    header = set(all_rows[0].keys())
    missing_fields = [f for f in _CMS_FIELDS if f not in header]
    check(
        "CMS: every field the ingest script depends on is still in the live CSV header",
        not missing_fields,
        f"missing: {missing_fields}" if missing_fields else f"{len(_CMS_FIELDS)} fields confirmed present",
    )

    by_ccn = {str(r.get("CMS Certification Number (CCN)", "")).strip(): r for r in all_rows}

    for state in states:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cms_ccn, name, beds, cms_overall_rating, latitude, longitude
                FROM facilities
                WHERE state_code = %s AND cms_ccn IS NOT NULL
                ORDER BY random() LIMIT %s
                """,
                (state, sample),
            )
            db_rows = cur.fetchall()

        matched = 0
        for row in db_rows:
            ccn, name = row["cms_ccn"], row["name"]
            raw = by_ccn.get(str(ccn).strip())
            if not check(f"CMS {state}/{ccn}: still present in live feed ({name})", raw is not None):
                continue
            matched += 1

            raw_beds = _safe_int(raw.get("Number of Certified Beds"))
            raw_rating = _safe_rating(raw.get("Overall Rating"))
            raw_lat = _safe_float(raw.get("Latitude"))
            raw_lng = _safe_float(raw.get("Longitude"))

            check(
                f"CMS {state}/{ccn}: beds matches live source ({name})",
                row["beds"] == raw_beds,
                f"db={row['beds']} live={raw_beds}",
            )
            check(
                f"CMS {state}/{ccn}: overall_rating matches live source ({name})",
                row["cms_overall_rating"] == raw_rating,
                f"db={row['cms_overall_rating']} live={raw_rating}",
            )
            if row["latitude"] is not None and raw_lat is not None:
                check(
                    f"CMS {state}/{ccn}: latitude within 0.01° of live source ({name})",
                    abs(float(row["latitude"]) - raw_lat) < 0.01,
                    f"db={row['latitude']} live={raw_lat}",
                )

        check(
            f"CMS {state}: all sampled facilities matched a live CSV row",
            matched == len(db_rows),
            f"{matched}/{len(db_rows)} matched",
        )


def check_census_geocoder_contract(conn, sample: int) -> None:
    print("\n=== Census Geocoder — live source contract ===")
    with conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT state_code FROM facilities "
            "WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY state_code"
        )
        states = [r["state_code"] for r in cur.fetchall()]

    for state in states:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, city, latitude, longitude
                FROM facilities
                WHERE state_code = %s AND latitude IS NOT NULL AND longitude IS NOT NULL
                ORDER BY random() LIMIT %s
                """,
                (state, sample),
            )
            db_rows = cur.fetchall()

        for row in db_rows:
            fid, name = row["id"], row["name"]
            time.sleep(0.15)  # polite pacing — Census Geocoder has no published hard limit
            try:
                live_place = _fetch_census_place(float(row["latitude"]), float(row["longitude"]))
            except Exception as exc:
                check(f"Census {state}/{fid}: geocoder responded ({name})", False, str(exc))
                continue
            if live_place == "__NO_PLACE__":
                # Unincorporated area — Census has no place name to compare against.
                continue
            check(
                f"Census {state}/{fid}: stored city matches live Census place ({name})",
                live_place.strip().lower() == (row["city"] or "").strip().lower(),
                f"db_city={row['city']!r} live_place={live_place!r} "
                "— if this legitimately drifted, re-run recompute_physical_city.py",
            )


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Layer 0 — source API contract checks")
    parser.add_argument("--sample", type=int, default=5, help="Facilities sampled per state per source")
    parser.add_argument("--skip-cms", action="store_true")
    parser.add_argument("--skip-census", action="store_true")
    args = parser.parse_args(argv)

    conn = get_conn()
    session = make_session()

    if not args.skip_cms:
        check_cms_nh_directory_contract(conn, session, args.sample)
    if not args.skip_census:
        check_census_geocoder_contract(conn, args.sample)

    conn.close()
    run_all_checks("Layer 0 — Source Contract")


if __name__ == "__main__":
    main()
