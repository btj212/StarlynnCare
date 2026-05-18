#!/usr/bin/env python3
"""
Utah CCL Inspection Scraper — Direct public API

cclapi.dlbc.utah.gov/api/public is fully unauthenticated for read-only
facility data. No Playwright or OAuth required.

Endpoint: GET https://cclapi.dlbc.utah.gov/api/public/facilities/{id}
Join key: ArcGIS ID_NUMBER "F23-106982" → numeric part 106982 = CCL id.

Returns per-facility: inspections[], findings[], dcount, idNumber, status.

findings shape:
  ruleId, ruleNumber (e.g. "R432-270-24(5)(a)-(b)"), ruleDescription,
  findingCategory ("CITED" | "REPEAT_CITED" | "COMPLAINT_CITED"),
  noncomplianceLevel ("Low" | "Moderate" | "High" | "Critical"),
  correctionVerificationStatus, correctionDate, complaintDates

Usage:
    python3 -u ut_ccl_inspections_scraper.py --smoke-test  # 5 facilities
    python3 -u ut_ccl_inspections_scraper.py               # full run
    python3 -u ut_ccl_inspections_scraper.py --dry-run     # no DB writes
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
CCL_BASE = "https://cclapi.dlbc.utah.gov/api/public"
REQUEST_DELAY = 0.4  # polite; avoid Cloudflare throttle


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ---------------------------------------------------------------------------
# ID join: ArcGIS external_id → CCL numeric id
# ---------------------------------------------------------------------------


def external_id_to_ccl_id(external_id: str) -> int | None:
    """
    ArcGIS ID_NUMBER format: "F23-106982" → numeric part → 106982 (CCL id).
    Returns None if the format doesn't match.
    """
    m = re.match(r"[A-Z]\d+-(\d+)", external_id or "")
    return int(m.group(1)) if m else None


# ---------------------------------------------------------------------------
# CCL API
# ---------------------------------------------------------------------------

_SESSION = requests.Session()
_SESSION.headers.update({"User-Agent": "Mozilla/5.0", "Accept": "application/json"})


def fetch_facility_detail(ccl_id: int) -> dict | None:
    """GET /api/public/facilities/{ccl_id} — returns full detail + inspections."""
    url = f"{CCL_BASE}/facilities/{ccl_id}"
    try:
        r = _SESSION.get(url, timeout=20)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()
    except requests.RequestException as exc:
        print(f"  API ERROR {ccl_id}: {exc}", flush=True)
        return None


# ---------------------------------------------------------------------------
# Severity mapping: noncomplianceLevel → severity_int
# ---------------------------------------------------------------------------

_NONCOMPLIANCE_MAP = {
    "Low": 1,
    "Moderate": 2,
    "High": 3,
    "Critical": 4,
    "Immediate Jeopardy": 4,
}


def _map_finding_severity(finding: dict) -> tuple[int, bool]:
    level = (finding.get("noncomplianceLevel") or "").strip()
    is_ij = "Immediate Jeopardy" in level or level == "Critical"
    return _NONCOMPLIANCE_MAP.get(level, 1), is_ij


def _parse_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except (ValueError, TypeError):
        return None


def _insp_type(types_str: str | None) -> tuple[str, bool]:
    """Return (inspection_type, is_complaint) from the CCL inspectionTypes string.

    CCL types seen in production:
      "Unannounced, Annual Inspection"
      "Follow-Up Inspection"
      "Complaint, Investigation Inspection"
      "Conditional, Monitoring Inspection"
      "Conditional, Monitoring Inspection, Follow-Up Inspection"
      "CMS Federal Survey Inspection"
      "Focus Inspection"
      "Initial Licensing Inspection"
    """
    raw = (types_str or "").lower()
    is_complaint = "complaint" in raw or "investigation" in raw

    if "annual" in raw or "federal survey" in raw or "licensure" in raw or "recertification" in raw:
        itype = "annual"
    elif "follow-up" in raw or "follow up" in raw:
        itype = "follow-up"
    elif "monitoring" in raw:
        itype = "monitoring"
    elif "focus" in raw:
        itype = "focused"
    elif "initial" in raw:
        itype = "initial"
    elif is_complaint:
        itype = "complaint"
    else:
        itype = "inspection"

    return itype, is_complaint


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


def load_target_facilities(conn: psycopg.Connection) -> list[dict]:
    """Return UT facilities with SECURE_BEDS > 0 that have a valid external_id."""
    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(
            """
            SELECT id, external_id, name, city
            FROM facilities
            WHERE state_code = 'UT'
              AND serves_memory_care = true
              AND license_status = 'LICENSED'
              AND external_id IS NOT NULL
            ORDER BY name
            """
        )
        return cur.fetchall()


INSPECTION_SQL = """
    INSERT INTO inspections (
        facility_id, inspection_date, inspection_type,
        total_deficiency_count, source_url, source_agency
    ) VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT DO NOTHING
    RETURNING id
"""

DEFICIENCY_SQL = """
    INSERT INTO deficiencies (
        inspection_id,
        code, description, inspector_narrative, plan_of_correction,
        category,
        severity, immediate_jeopardy,
        is_repeat, state_severity_raw
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT DO NOTHING
"""


def store_detail(
    conn: psycopg.Connection,
    facility_id: str,
    ccl_id: int,
    detail: dict,
    dry_run: bool,
) -> tuple[int, int]:
    """Upsert inspections + findings from a facility detail response."""
    inspections = detail.get("inspections") or []
    source_url = f"https://ccl.utah.gov/facility/{ccl_id}"

    insp_count = 0
    def_count = 0

    with conn.cursor() as cur:
        for insp in inspections:
            insp_date = _parse_date(insp.get("inspectionDate"))
            if not insp_date:
                continue
            insp_type, is_complaint = _insp_type(insp.get("inspectionTypes"))
            findings = insp.get("findings") or []
            def_count_raw = len(findings)

            if dry_run:
                insp_count += 1
                def_count += def_count_raw
                continue

            sp = f"sp_{ccl_id}_{insp_date.isoformat().replace('-', '')}"
            try:
                cur.execute(f"SAVEPOINT {sp}")
                cur.execute(INSPECTION_SQL, (facility_id, insp_date, insp_type, def_count_raw, source_url, "UT-CCL"))
                row = cur.fetchone()
                inspection_id = row[0] if row else None
                cur.execute(f"RELEASE SAVEPOINT {sp}")
                insp_count += 1
            except Exception as exc:
                cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                print(f"  INSP ERROR {ccl_id} {insp_date}: {exc}", flush=True)
                continue

            if inspection_id is None:
                cur.execute(
                    "SELECT id FROM inspections WHERE facility_id=%s AND inspection_date=%s AND inspection_type=%s",
                    (facility_id, insp_date, insp_type),
                )
                row2 = cur.fetchone()
                inspection_id = row2[0] if row2 else None

            if not inspection_id or not findings:
                continue

            for finding in findings:
                code = str(finding.get("ruleNumber") or f"UT-{finding.get('ruleId', 'UNK')}")
                desc = finding.get("ruleDescription") or ""
                # findingText is the full inspector narrative ("During the inspection...")
                narrative = finding.get("findingText") or None
                # correctionAction is the licensor's plan-of-correction follow-up
                poc = finding.get("correctionAction") or None
                sev_int, is_ij = _map_finding_severity(finding)
                category = finding.get("findingCategory") or None
                is_repeat = category in ("REPEAT_CITED",) if category else False
                # state_severity_raw stores the CCL noncomplianceLevel for traceability
                state_severity_raw = finding.get("noncomplianceLevel") or None

                sp2 = f"sp_d_{code[:30].replace('-', '_').replace('(', '').replace(')', '')}"
                try:
                    cur.execute(f"SAVEPOINT {sp2}")
                    cur.execute(DEFICIENCY_SQL, (inspection_id, code, desc, narrative, poc, category, sev_int, is_ij, is_repeat, state_severity_raw))
                    cur.execute(f"RELEASE SAVEPOINT {sp2}")
                    def_count += 1
                except Exception as exc:
                    cur.execute(f"ROLLBACK TO SAVEPOINT {sp2}")
                    print(f"  DEF ERROR {code}: {exc}", flush=True)

    return insp_count, def_count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="UT CCL inspection scraper — direct public API")
    parser.add_argument("--smoke-test", action="store_true", help="Process first 5 facilities only")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't write to DB")
    args = parser.parse_args()

    load_env()
    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    if not args.dry_run:
        dsn = os.environ["DATABASE_URL"]
        conn = psycopg.connect(dsn)
        facilities = load_target_facilities(conn)
    else:
        conn = None
        # Smoke test: use a known memory care facility
        facilities = [{"id": "stub", "external_id": "F23-106982", "name": "Abbington Manor Memory Care", "city": "Sandy"}]

    if args.smoke_test:
        facilities = facilities[:5]

    print(f"Processing {len(facilities)} UT facilities via cclapi.dlbc.utah.gov …", flush=True)

    total_insp = 0
    total_def = 0
    no_match = 0
    no_data = 0

    try:
        for i, fac in enumerate(facilities, 1):
            ext_id = fac["external_id"]
            name = fac["name"]
            ccl_id = external_id_to_ccl_id(ext_id)

            if ccl_id is None:
                print(f"[{i}] SKIP {ext_id} — can't parse numeric CCL id", flush=True)
                no_match += 1
                continue

            print(f"[{i}/{len(facilities)}] {ext_id} ({ccl_id}) — {name}", flush=True)
            detail = fetch_facility_detail(ccl_id)
            if detail is None:
                print(f"  404 — no CCL record found", flush=True)
                no_data += 1
                time.sleep(REQUEST_DELAY)
                continue

            inspections = detail.get("inspections") or []
            print(f"  {len(inspections)} inspections, dcount={detail.get('dcount', 0)}", flush=True)

            if args.smoke_test:
                for insp in inspections[:2]:
                    findings = insp.get("findings") or []
                    print(f"    {insp['inspectionDate']} {insp.get('inspectionTypes')} — {len(findings)} findings", flush=True)
                    for f in findings[:2]:
                        print(f"      {f.get('ruleNumber')} [{f.get('noncomplianceLevel')}] {f.get('ruleDescription', '')[:60]}", flush=True)

            if conn:
                insp_c, def_c = store_detail(conn, fac["id"], ccl_id, detail, dry_run=False)
                conn.commit()
            else:
                insp_c = len(inspections)
                def_c = sum(len(i.get("findings") or []) for i in inspections)

            total_insp += insp_c
            total_def += def_c
            time.sleep(REQUEST_DELAY)

    finally:
        if conn:
            conn.close()

    print(
        f"\nDone. {total_insp} inspections, {total_def} deficiency records. "
        f"({no_match} skipped — bad external_id format, {no_data} not found in CCL API)",
        flush=True,
    )


if __name__ == "__main__":
    main()
