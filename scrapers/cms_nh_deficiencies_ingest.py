#!/usr/bin/env python3
"""
CMS Nursing Home Health Deficiencies Ingest — Wave 1b.

Pulls CMS Health Deficiency records for SNFs in a given state from data.cms.gov
and upserts into `inspections` + `deficiencies`.

CMS dataset: Health Deficiencies
UUID: r5ix-sfxw
URL: https://data.cms.gov/provider-data/dataset/r5ix-sfxw

API pattern (no key, paginate 2000/page):
  GET https://data.cms.gov/data-api/v1/dataset/r5ix-sfxw/data
      ?filter[condition][path]=STATE&filter[condition][operator]==&filter[condition][value]=WA

Each CMS deficiency row becomes:
  - One `inspections` row (matched by facility_id + survey_date + survey_id)
  - One `deficiencies` row per F-tag deficiency cited

F-tag scope/severity matrix (SOM Appendix P):
  Scope: isolated (A-C), pattern (D-F), widespread (G-I, J-L for IJ)
  Severity: no actual harm (A-D), potential for harm (D-G), actual harm (G-I), IJ (J-L)

Usage:
  python3 scrapers/cms_nh_deficiencies_ingest.py --state WA
  python3 scrapers/cms_nh_deficiencies_ingest.py --state WA --dry-run
  python3 scrapers/cms_nh_deficiencies_ingest.py --state WA --ccn 505706
  python3 scrapers/cms_nh_deficiencies_ingest.py --state WA --limit 500
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
import uuid as uuid_lib
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import make_session, polite_sleep

CMS_DKAN_META = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items"
DEFICIENCIES_UUID = "r5ix-sfxw"
PAGE_SIZE = 2000

# CMS scope/severity letter → severity level (1-4)
_SCOPE_SEVERITY_MAP: dict[str, int] = {
    # No actual harm, potential for minimal harm
    "A": 1, "B": 1, "C": 1,
    # No actual harm, potential for more than minimal harm
    "D": 2, "E": 2, "F": 2,
    # Actual harm
    "G": 3, "H": 3, "I": 3,
    # Immediate Jeopardy
    "J": 4, "K": 4, "L": 4,
}

# Scope letter → plain label
_SCOPE_LABELS: dict[str, str] = {
    "A": "Isolated", "B": "Pattern", "C": "Widespread",
    "D": "Isolated", "E": "Pattern", "F": "Widespread",
    "G": "Isolated", "H": "Pattern", "I": "Widespread",
    "J": "Isolated", "K": "Pattern", "L": "Widespread",
}


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
            return


def get_conn() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    return psycopg.connect(url)


def _get_cms_csv_url(session: requests.Session, dataset_uuid: str) -> str:
    """Resolve the current CSV download URL via the CMS DKAN metadata API."""
    meta_url = f"{CMS_DKAN_META}/{dataset_uuid}"
    resp = session.get(meta_url, timeout=30)
    resp.raise_for_status()
    meta = resp.json()
    for dist in meta.get("distribution", []):
        url = dist.get("downloadURL", "")
        if url.endswith(".csv"):
            return url
    raise RuntimeError(f"No CSV distribution found for CMS dataset {dataset_uuid}")


def fetch_cms_deficiencies(
    session: requests.Session,
    state: str,
    ccn: str | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Fetch deficiency rows by downloading the full CMS CSV and filtering locally."""
    import csv
    import io

    print(f"  Resolving CSV URL for dataset {DEFICIENCIES_UUID}…")
    csv_url = _get_cms_csv_url(session, DEFICIENCIES_UUID)
    print(f"  Downloading: {csv_url}")
    resp = session.get(csv_url, timeout=300, stream=True)
    resp.raise_for_status()

    all_rows: list[dict[str, Any]] = []
    content = resp.content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    for row in reader:
        # CMS deficiencies CSV uses "State" (not "Provider State")
        row_state = (row.get("State", "") or row.get("Provider State", "")).strip().upper()
        if row_state != state.upper():
            continue
        if ccn and row.get("CMS Certification Number (CCN)", "").strip() != ccn:
            continue
        all_rows.append(row)
        if limit and len(all_rows) >= limit:
            break

    print(f"  Found {len(all_rows)} deficiency rows for state={state}")
    return all_rows[:limit] if limit else all_rows


def _parse_cms_date(val: Any) -> date | None:
    if not val:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y%m%d"):
        try:
            return datetime.strptime(str(val).strip(), fmt).date()
        except ValueError:
            continue
    return None


def _scope_severity_label(letter: str | None) -> str | None:
    if not letter:
        return None
    u = letter.strip().upper()
    sev_level = _SCOPE_SEVERITY_MAP.get(u)
    scope_label = _SCOPE_LABELS.get(u)
    if sev_level == 4:
        return f"IJ ({scope_label})"
    if sev_level == 3:
        return f"Actual Harm ({scope_label})"
    if sev_level == 2:
        return f"Potential Harm ({scope_label})"
    if sev_level == 1:
        return f"No Harm ({scope_label})"
    return None


def _is_ij(letter: str | None) -> bool:
    if not letter:
        return False
    return letter.strip().upper() in ("J", "K", "L")


def _survey_key(ccn: str, survey_date: str, survey_id: str | None) -> str:
    raw = f"{ccn}|{survey_date}|{survey_id or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def get_facility_id_by_ccn(
    conn: psycopg.Connection, ccn: str
) -> str | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id::text FROM facilities WHERE cms_ccn = %s LIMIT 1",
            (ccn,),
        )
        row = cur.fetchone()
    return str(row[0]) if row else None


def ensure_inspection(
    conn: psycopg.Connection,
    facility_id: str,
    survey_date: date,
    survey_id: str,
    ccn: str,
) -> str:
    """Get or create an inspection row. Returns inspection_id (str)."""
    source_url = f"https://data.cms.gov/provider-data/dataset/{DEFICIENCIES_UUID}?ccn={ccn}&date={survey_date}"
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::text FROM inspections
            WHERE facility_id = %s::uuid
              AND source_url = %s
            """,
            (facility_id, source_url),
        )
        row = cur.fetchone()
        if row:
            return str(row[0])

        cur.execute(
            """
            INSERT INTO inspections
              (id, facility_id, inspection_date, source_url,
               source_agency, raw_data)
            VALUES
              (gen_random_uuid(), %s::uuid, %s, %s,
               'CMS', %s::jsonb)
            RETURNING id::text
            """,
            (
                facility_id,
                survey_date,
                source_url,
                '{"source": "CMS Health Deficiencies"}',
            ),
        )
        row = cur.fetchone()
    conn.commit()
    return str(row[0])


def upsert_deficiency(
    conn: psycopg.Connection,
    inspection_id: str,
    d: dict[str, Any],
) -> bool:
    """Insert one deficiency. Returns True if inserted."""
    # CMS CSV column names (confirmed Apr 2026)
    ftag = str(d.get("Deficiency Tag Number") or d.get("F-Tag Number") or d.get("Tag Number") or "").strip()
    scope_sev_letter = str(d.get("Scope Severity Code") or d.get("Scope/Severity Code") or "").strip()
    narrative = str(d.get("Deficiency Description") or d.get("Narrative") or "").strip()
    corrected_date_raw = d.get("Correction Date") or d.get("Corrected Date")
    corrected_date = _parse_cms_date(corrected_date_raw)

    if not ftag:
        return False

    code = f"F{ftag}" if not ftag.startswith("F") else ftag
    sev_level = _SCOPE_SEVERITY_MAP.get(scope_sev_letter.upper())
    is_ij = _is_ij(scope_sev_letter)
    sev_label = _scope_severity_label(scope_sev_letter)

    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM deficiencies WHERE inspection_id=%s::uuid AND code=%s",
            (inspection_id, code),
        )
        if cur.fetchone():
            return False

        cur.execute(
            """
            INSERT INTO deficiencies
              (id, inspection_id, code, description, inspector_narrative,
               scope_severity_code, severity, immediate_jeopardy,
               corrected_date)
            VALUES
              (gen_random_uuid(), %s::uuid, %s, %s, null,
               %s, %s, %s,
               %s)
            """,
            (
                inspection_id,
                code,
                narrative[:4000] if narrative else None,
                scope_sev_letter or None,
                sev_level,
                is_ij,
                corrected_date,
            ),
        )
        inserted = cur.rowcount > 0
    conn.commit()
    return inserted


def ingest_state(
    conn: psycopg.Connection,
    deficiency_rows: list[dict[str, Any]],
    *,
    dry_run: bool = False,
) -> dict[str, int]:
    counts: dict[str, int] = {
        "facilities_missing": 0,
        "inspections_created": 0,
        "deficiencies_inserted": 0,
        "deficiencies_skipped": 0,
    }

    # Group by CCN + survey date
    by_survey: dict[str, list[dict[str, Any]]] = {}
    for row in deficiency_rows:
        ccn = str(row.get("CMS Certification Number (CCN)", "") or "").strip()
        survey_date_raw = row.get("Survey Date", row.get("Inspection Date"))
        if not ccn or not survey_date_raw:
            continue
        key = f"{ccn}|{survey_date_raw}"
        by_survey.setdefault(key, []).append(row)

    print(f"  Processing {len(by_survey)} unique surveys across deficiency rows")

    for survey_key, rows in by_survey.items():
        ccn, survey_date_raw = survey_key.split("|", 1)
        survey_date = _parse_cms_date(survey_date_raw)
        if not survey_date:
            continue

        facility_id = get_facility_id_by_ccn(conn, ccn)
        if not facility_id:
            counts["facilities_missing"] += 1
            continue

        survey_id = str(rows[0].get("Survey ID", rows[0].get("Standard Survey ID", "")))

        if dry_run:
            print(f"  DRY-RUN: {ccn} {survey_date} — {len(rows)} deficiencies")
            counts["deficiencies_inserted"] += len(rows)
            continue

        inspection_id = ensure_inspection(conn, facility_id, survey_date, survey_id, ccn)
        counts["inspections_created"] += 1

        for d in rows:
            ok = upsert_deficiency(conn, inspection_id, d)
            if ok:
                counts["deficiencies_inserted"] += 1
            else:
                counts["deficiencies_skipped"] += 1

        # Build narrative from deficiencies for this inspection
        narrative_parts = [
            f"{str(d.get('Deficiency Tag Number') or d.get('F-Tag Number') or '').strip()}: {str(d.get('Deficiency Description', '') or '').strip()}"
            for d in rows
            if d.get("Deficiency Description")
        ]
        if narrative_parts:
            narrative = "\n\n".join(narrative_parts)[:12000]
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE inspections
                    SET raw_data = jsonb_set(
                            coalesce(raw_data, '{}'::jsonb),
                            '{narrative}',
                            %s::jsonb
                        )
                    WHERE id = %s::uuid
                    """,
                    (psycopg.types.json.Jsonb(narrative), inspection_id),
                )
            conn.commit()

    return counts


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="CMS NH deficiencies ingest — Wave 1b")
    parser.add_argument("--state", default="WA")
    parser.add_argument("--ccn", help="Process one facility by CCN")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    load_env()
    state = args.state.upper()
    print(f"=== CMS NH Deficiencies Ingest — {state} ===")

    session = make_session()
    conn = get_conn()

    print("Step 1: Fetching CMS deficiency data…")
    rows = fetch_cms_deficiencies(
        session, state, ccn=args.ccn, limit=args.limit
    )
    print(f"  {len(rows)} deficiency rows from CMS")

    print("Step 2: Ingesting…")
    counts = ingest_state(conn, rows, dry_run=args.dry_run)

    print(f"\nResults:")
    for k, v in counts.items():
        print(f"  {k}: {v}")

    conn.close()


if __name__ == "__main__":
    main()
