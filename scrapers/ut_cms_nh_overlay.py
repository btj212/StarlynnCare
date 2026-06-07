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
import csv
import io
import os
import sys
from datetime import date
from pathlib import Path

import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent

# CMS Provider Data Catalog — metastore API for discovering current CSV URLs
CMS_METASTORE = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items"
DEFICIENCY_DATASET = "r5ix-sfxw"  # Health Deficiencies
PROVIDER_DATASET = "4pq5-n9py"    # Provider Information


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ---------------------------------------------------------------------------
# CMS fetch helpers — CSV download approach (faster than DKAN pagination)
# ---------------------------------------------------------------------------


def _get_csv_url(dataset_id: str) -> str:
    """Discover the current CSV download URL from the CMS metastore."""
    r = requests.get(f"{CMS_METASTORE}/{dataset_id}", timeout=15)
    r.raise_for_status()
    dist = r.json().get("distribution", [])
    for item in dist:
        if item.get("mediaType") == "text/csv":
            return item["downloadURL"]
    raise RuntimeError(f"No CSV distribution found for dataset {dataset_id}")


def _normalize_key(k: str) -> str:
    """Convert 'CMS Certification Number (CCN)' → 'cms_certification_number_ccn'."""
    import re
    k = k.lower().strip()
    k = re.sub(r"[^a-z0-9]+", "_", k)
    k = k.strip("_")
    return k


def fetch_cms_csv(dataset_id: str, state_col: str, state_value: str = "UT") -> list[dict]:
    """Download full CMS CSV and filter to a single state in memory.

    Column headers are normalized to snake_case so downstream code can use
    keys like 'cms_certification_number_ccn' and 'scope_severity_code'.
    """
    url = _get_csv_url(dataset_id)
    print(f"  Downloading {url.split('/')[-1]} …", flush=True)
    r = requests.get(url, timeout=180, stream=True)
    r.raise_for_status()
    content = r.content.decode("utf-8-sig")  # strip BOM if present
    reader = csv.DictReader(io.StringIO(content))
    # Normalize headers once
    normalized_state_col = _normalize_key(state_col)
    rows = []
    for raw_row in reader:
        norm_row = {_normalize_key(k): v for k, v in raw_row.items()}
        if norm_row.get(normalized_state_col, "").strip() == state_value:
            rows.append(norm_row)
    print(f"  … {len(rows)} {state_value} rows (of {reader.line_num} total)", flush=True)
    return rows


def fetch_deficiencies() -> list[dict]:
    print("Fetching CMS Health Deficiencies for UT …", flush=True)
    # state_col matches header "State" → normalized key "state"
    return fetch_cms_csv(DEFICIENCY_DATASET, "state", "UT")


def fetch_provider_info() -> list[dict]:
    print("Fetching CMS Provider Information for UT …", flush=True)
    return fetch_cms_csv(PROVIDER_DATASET, "state", "UT")


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
    """Update facilities with CMS overall rating — single batched UPDATE."""
    batch: list[tuple] = []
    for p in providers:
        ccn = p.get("provnum") or p.get("cms_certification_number_ccn")
        if not ccn or ccn not in facility_map:
            continue
        fid = facility_map[ccn]
        raw = p.get("overall_rating")
        try:
            overall_rating = int(raw) if raw else None
        except (ValueError, TypeError):
            overall_rating = None
        batch.append((overall_rating, fid))

    if batch and not dry_run:
        with conn.cursor() as cur:
            cur.executemany(
                "UPDATE facilities SET cms_overall_rating = %s WHERE id = %s",
                batch,
            )
    print(f"  CMS provider info: {len(batch)} facilities updated", flush=True)


INSPECTION_UPSERT_SQL = """
    INSERT INTO inspections (
        facility_id, inspection_date, inspection_type,
        total_deficiency_count, complaint_id, source_url, source_agency
    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT DO NOTHING
    RETURNING id
"""

DEFICIENCY_UPSERT_SQL = """
    INSERT INTO deficiencies (
        inspection_id,
        ftag, code, category, description,
        scope_severity_code, immediate_jeopardy,
        scope, severity
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT DO NOTHING
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
        ccn = row.get("provnum") or row.get("cms_certification_number_ccn") or ""
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

            try:
                cur.execute(
                    INSPECTION_UPSERT_SQL,
                    (fid, insp_date, insp_type, len(rows), None, source_url, "CMS"),
                )
                insp_id_row = cur.fetchone()
                inspection_id = insp_id_row[0] if insp_id_row else None
                inspection_count += 1
            except Exception as exc:
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

            _SCOPE_TEXT = {
                "A": "isolated", "B": "isolated", "C": "isolated",
                "D": "pattern",  "E": "pattern",  "F": "pattern",
                "G": "widespread","H": "widespread","I": "widespread",
                "J": "widespread","K": "widespread","L": "widespread",
            }
            batch: list[tuple] = []
            for def_row in rows:
                tag_num = def_row.get("deficiency_tag_number") or def_row.get("tag_number") or "000"
                prefix = (def_row.get("deficiency_prefix") or "F").strip()
                ftag = f"{prefix}{int(tag_num):04d}" if str(tag_num).isdigit() else str(tag_num)
                category = def_row.get("deficiency_category") or ""
                description = def_row.get("deficiency_description") or def_row.get("description") or ""
                sev_int, is_ij = _cms_scope_severity(def_row)
                scope_sev = (def_row.get("scope_severity_code") or "").strip().upper()
                scope_letter = scope_sev[-1] if scope_sev else None
                scope_text = _SCOPE_TEXT.get(scope_letter) if scope_letter else None
                batch.append((inspection_id, ftag, ftag, category, description,
                               scope_sev or None, is_ij, scope_text, sev_int))

            if batch:
                try:
                    cur.executemany(DEFICIENCY_UPSERT_SQL, batch)
                    deficiency_count += len(batch)
                except Exception as exc:
                    print(f"  DEFICIENCY BATCH ERROR {ccn}: {exc}", flush=True)

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
        ccns = {r.get("provnum") or r.get("cms_certification_number_ccn") for r in deficiencies}
        print(f"\nUnique CCNs in deficiency data: {len(ccns)}")
        print("Dry run — no DB writes.")
        return

    dsn = os.environ["DATABASE_URL"]
    with psycopg.connect(dsn, options="-c statement_timeout=120000") as conn:
        facility_map = load_facility_map(conn)
        print(f"\nUT facilities with CMS CCN in DB: {len(facility_map)}", flush=True)

        update_provider_info(conn, providers, facility_map, dry_run=False)
        load_deficiencies(conn, deficiencies, facility_map, dry_run=False)
        conn.commit()

    print("\nCMS overlay complete.", flush=True)


if __name__ == "__main__":
    main()
