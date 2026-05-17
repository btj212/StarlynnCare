#!/usr/bin/env python3
"""
Utah CMS Nursing Home Overlay

Pulls CMS Provider Data Catalog health-deficiency and provider-info records
for Utah nursing facilities and writes them to the inspections/deficiencies tables.

Scope: 21 UT nursing facilities with SECURE_BEDS > 0 (memory care wings in SNFs).
Join key: facilities.cms_ccn ↔ CMS PROVNUM (6-digit CCN).

Sources:
  CMS Health Deficiencies:  https://data.cms.gov/provider-data/dataset/r5ix-sfxw
  CMS Provider Information: https://data.cms.gov/provider-data/dataset/4pq5-n9py

Usage:
    python3 -u ut_cms_nh_overlay.py
    python3 -u ut_cms_nh_overlay.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date
from pathlib import Path

import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent

# CMS Socrata API — public, no key needed (rate-limited to ~1000 rows/req)
CMS_BASE = "https://data.cms.gov/resource"
DEFICIENCY_DATASET = "r5ix-sfxw"  # Health Deficiencies
PROVIDER_DATASET = "4pq5-n9py"    # Provider Information

STATE_FILTER = "STATE=UT"
PAGE_SIZE = 5000


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ---------------------------------------------------------------------------
# CMS fetch helpers
# ---------------------------------------------------------------------------


def fetch_cms_pages(dataset: str, where_clause: str) -> list[dict]:
    """Paginate through CMS Socrata API and return all rows."""
    rows = []
    offset = 0
    while True:
        url = (
            f"{CMS_BASE}/{dataset}.json"
            f"?$where={where_clause}&$limit={PAGE_SIZE}&$offset={offset}"
        )
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        page = r.json()
        if not page:
            break
        rows.extend(page)
        print(f"  … {len(rows)} rows fetched", flush=True)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def fetch_deficiencies() -> list[dict]:
    print("Fetching CMS Health Deficiencies for UT …", flush=True)
    return fetch_cms_pages(DEFICIENCY_DATASET, f"statecode='UT'")


def fetch_provider_info() -> list[dict]:
    print("Fetching CMS Provider Information for UT …", flush=True)
    return fetch_cms_pages(PROVIDER_DATASET, f"state='UT'")


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


def load_facility_map(conn: psycopg.Connection) -> dict[str, str]:
    """Return {cms_ccn: facility_id} for UT facilities with a CCN."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT cms_ccn, id FROM facilities WHERE state_code = 'UT' AND cms_ccn IS NOT NULL"
        )
        return {row[0]: row[1] for row in cur.fetchall()}


def update_provider_info(
    conn: psycopg.Connection,
    providers: list[dict],
    facility_map: dict[str, str],
    dry_run: bool,
) -> None:
    """Update facilities with CMS overall rating and bed counts."""
    updated = 0
    for p in providers:
        ccn = p.get("provnum") or p.get("cms_certification_number_ccn_")
        if not ccn or ccn not in facility_map:
            continue
        fid = facility_map[ccn]
        overall_rating = p.get("overall_rating")
        try:
            overall_rating = int(overall_rating) if overall_rating else None
        except (ValueError, TypeError):
            overall_rating = None
        if not dry_run:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE facilities
                    SET cms_overall_rating = %s
                    WHERE id = %s
                    """,
                    (overall_rating, fid),
                )
        updated += 1
    print(f"  CMS provider info: {updated} facilities updated", flush=True)


INSPECTION_UPSERT_SQL = """
    INSERT INTO inspections (
        facility_id, inspection_date, inspection_type,
        deficiency_count, complaint_id, source_url
    ) VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT (facility_id, inspection_date, inspection_type)
    DO UPDATE SET
        deficiency_count = EXCLUDED.deficiency_count,
        source_url       = EXCLUDED.source_url
    RETURNING id
"""

DEFICIENCY_UPSERT_SQL = """
    INSERT INTO deficiencies (
        inspection_id, facility_id,
        code, description,
        severity_int, is_ij,
        scope, citation_count
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (inspection_id, code)
    DO UPDATE SET
        description  = EXCLUDED.description,
        severity_int = EXCLUDED.severity_int,
        is_ij        = EXCLUDED.is_ij,
        scope        = EXCLUDED.scope
"""

# CMS scope-severity matrix → our severity_int
# F/G/H/I = widespread; D/E = pattern; A/B/C = isolated
# I/J/K/L = immediate jeopardy
_CMS_SEVERITY_MAP = {
    "A": 1, "B": 1, "C": 1,
    "D": 2, "E": 2, "F": 2,
    "G": 3, "H": 3, "I": 3,
    "J": 4, "K": 4, "L": 4,
}


def _cms_scope_severity(deficiency_row: dict) -> tuple[int, bool]:
    """Return (severity_int, is_ij) from CMS scope/severity columns."""
    scope_sev = (deficiency_row.get("scope_severity_code") or "").strip().upper()
    if not scope_sev:
        return 1, False
    last = scope_sev[-1] if scope_sev else "A"
    is_ij = last in ("J", "K", "L")
    return _CMS_SEVERITY_MAP.get(last, 1), is_ij


def load_deficiencies(
    conn: psycopg.Connection,
    deficiencies: list[dict],
    facility_map: dict[str, str],
    dry_run: bool,
) -> None:
    """Group CMS deficiency rows by survey event, create inspection records, insert deficiencies."""
    # Group by (provnum, survey_date, survey_type)
    from collections import defaultdict
    groups: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for row in deficiencies:
        ccn = row.get("provnum") or row.get("cms_certification_number_ccn_") or ""
        survey_date = row.get("survey_date") or row.get("surv_date") or ""
        survey_type = row.get("survey_type") or "ANNUAL"
        groups[(ccn, survey_date, survey_type)].append(row)

    inspection_count = 0
    deficiency_count = 0
    skip_count = 0

    with conn.cursor() as cur:
        for (ccn, survey_date_raw, survey_type), rows in groups.items():
            if ccn not in facility_map:
                skip_count += 1
                continue
            fid = facility_map[ccn]

            try:
                insp_date = date.fromisoformat(survey_date_raw[:10])
            except (ValueError, TypeError):
                skip_count += 1
                continue

            insp_type = "annual" if "ANNUAL" in survey_type.upper() else "complaint"
            source_url = f"https://www.medicare.gov/care-compare/results?searchType=NursingHome&page=1&state=UT&ccn={ccn}"

            if dry_run:
                inspection_count += 1
                deficiency_count += len(rows)
                continue

            sp = f"sp_insp_{ccn}_{insp_date.isoformat().replace('-', '')}"
            try:
                cur.execute(f"SAVEPOINT {sp}")
                cur.execute(
                    INSPECTION_UPSERT_SQL,
                    (fid, insp_date, insp_type, len(rows), None, source_url),
                )
                insp_id_row = cur.fetchone()
                inspection_id = insp_id_row[0] if insp_id_row else None
                cur.execute(f"RELEASE SAVEPOINT {sp}")
                inspection_count += 1
            except Exception as exc:
                cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                print(f"  INSPECTION ERROR {ccn} {insp_date}: {exc}", flush=True)
                continue

            if inspection_id is None:
                # Conflict updated, need to fetch existing id
                cur.execute(
                    "SELECT id FROM inspections WHERE facility_id=%s AND inspection_date=%s AND inspection_type=%s",
                    (fid, insp_date, insp_type),
                )
                row_id = cur.fetchone()
                inspection_id = row_id[0] if row_id else None

            if inspection_id is None:
                continue

            for def_row in rows:
                tag = def_row.get("tag_number") or def_row.get("deficiency_tag_number") or "F000"
                description = def_row.get("deficiency_description") or def_row.get("description") or ""
                sev_int, is_ij = _cms_scope_severity(def_row)
                scope = def_row.get("scope_severity_code") or None
                sp2 = f"sp_def_{ccn}_{tag}"
                try:
                    cur.execute(f"SAVEPOINT {sp2}")
                    cur.execute(
                        DEFICIENCY_UPSERT_SQL,
                        (inspection_id, fid, tag, description, sev_int, is_ij, scope, 1),
                    )
                    cur.execute(f"RELEASE SAVEPOINT {sp2}")
                    deficiency_count += 1
                except Exception as exc:
                    cur.execute(f"ROLLBACK TO SAVEPOINT {sp2}")
                    print(f"  DEFICIENCY ERROR {ccn}/{tag}: {exc}", flush=True)

    print(
        f"  CMS deficiencies: {inspection_count} inspections, {deficiency_count} deficiency records "
        f"({skip_count} rows skipped — no facility match or bad date)",
        flush=True,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="UT CMS NF overlay — pull deficiencies for UT NFs")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_env()
    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    deficiencies = fetch_deficiencies()
    print(f"  Total CMS deficiency rows for UT: {len(deficiencies)}", flush=True)

    providers = fetch_provider_info()
    print(f"  Total CMS provider rows for UT: {len(providers)}", flush=True)

    if args.dry_run:
        # Show stats without connecting to DB
        ccns = {r.get("provnum") or r.get("cms_certification_number_ccn_") for r in deficiencies}
        print(f"\nUnique CCNs in deficiency data: {len(ccns)}")
        print("Dry run — no DB writes.")
        return

    dsn = os.environ["DATABASE_URL"]
    with psycopg.connect(dsn) as conn:
        facility_map = load_facility_map(conn)
        print(f"\nUT facilities with CMS CCN in DB: {len(facility_map)}", flush=True)

        update_provider_info(conn, providers, facility_map, dry_run=False)
        load_deficiencies(conn, deficiencies, facility_map, dry_run=False)
        conn.commit()

    print("\nCMS overlay complete.", flush=True)


if __name__ == "__main__":
    main()
