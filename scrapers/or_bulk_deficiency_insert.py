# RETIRED — do not run.
# Replaced by the OR Full Universe rebuild (migration 0033_or_universe.sql).
# New pipeline: or_providers_ingest.py, or_inspections_ingest.py, or_violations_ingest.py,
#               or_regulatory_actions_ingest.py, or_signal_mce.py, or_afh_detail.py, etc.
# Key reason: this script zero-pads Provider IDs, breaking alphanumeric IDs like '50M300'.
# See scripts/or_overnight_run.sh for the replacement orchestration.
#
# Original content preserved below for reference.
# ─────────────────────────────────────────────────────────────────────────────
import sys; print('ERROR: or_bulk_deficiency_insert.py is retired. Run or_providers_ingest.py instead.', file=sys.stderr); sys.exit(1)

#!/usr/bin/env python3
"""
Fast bulk re-ingest of OR deficiency rows from a format_version:1 bundle.

Used after deleting all OR deficiency rows to re-insert with corrected
state_severity_raw / severity / violation_type data.

Does NOT touch existing inspection rows (preserves narrative_summary).
Commits once per facility (not per inspection/deficiency).
Inserts new inspection records for any that are in the bundle but not in DB.

Usage:
  python3 scrapers/or_bulk_deficiency_insert.py \
    --bundle .firecrawl/or-scrape/bundle-v2-2026-05-08.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg
import psycopg.types.json
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent

_SEVERITY_HINTS: list[tuple[tuple[str, ...], int]] = [
    (("immediate jeopardy", "ij", "priority 1", "i/j"), 4),
    (("type a", "pattern a", "class a", "serious", "actual harm"), 3),
    (("abuse:", "physical abuse", "sexual abuse", "financial abuse", "financial exploitation",
      "wrongful restraint", "involuntary seclusion"), 3),
    (("type b", "pattern b", "class b", "potential", "lesser", "neglect"), 2),
    (("type c", "class c", "no harm", "administrative", "licensing violation"), 1),
]


def infer_severity(state_severity_raw: str | None, immediate_jeopardy: bool) -> int | None:
    s: int | None = None
    if state_severity_raw:
        low = state_severity_raw.lower().strip()
        for keys, val in _SEVERITY_HINTS:
            if any(k in low for k in keys):
                s = val
                break
    if immediate_jeopardy and (s is None or s < 4):
        s = 4
    return s if s is not None and 1 <= s <= 4 else None


def pad_license_or(raw: Any) -> str:
    if raw is None or str(raw).strip() == "":
        return "0000000000"
    digits = re.sub(r"\D", "", str(raw))
    return digits.zfill(10) if digits else "0000000000"


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def _dedupe_key(inspection_id: str, d: dict[str, Any]) -> str:
    code = (d.get("code") or "")[:64]
    desc = (d.get("description") or d.get("inspector_narrative") or "")[:240]
    return hashlib.sha256(f"{inspection_id}|{code}|{desc}".encode()).hexdigest()[:32]


def _final_code(d: dict[str, Any], dk: str) -> str:
    raw = d.get("code")
    if raw is not None and str(raw).strip():
        return str(raw).strip()[:200]
    return f"__or_{dk}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", type=Path, required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    bundle = json.loads(args.bundle.read_text(encoding="utf-8"))
    if bundle.get("format_version") != 1:
        print("Warning: format_version != 1", file=sys.stderr)

    with psycopg.connect(db_url) as conn:
        # Load all OR target facilities (padded license_number → facility uuid)
        fac_rows = conn.execute("""
            SELECT license_number, id::text
            FROM facilities
            WHERE state_code = 'OR'
              AND or_memory_care_endorsed = true
              AND license_status = 'LICENSED'
        """).fetchall()
        fac_by_lic: dict[str, str] = {r[0]: r[1] for r in fac_rows}
        print(f"Loaded {len(fac_by_lic)} OR target facilities")

        # Load all existing inspection records for target facilities
        # key: (facility_id, source_url) → inspection_id
        all_fac_ids = list(fac_by_lic.values())
        insp_rows = conn.execute("""
            SELECT facility_id::text, source_url, id::text, inspection_date
            FROM inspections
            WHERE facility_id = ANY(%s::uuid[])
        """, (all_fac_ids,)).fetchall()
        insp_by_key: dict[tuple[str, str], str] = {
            (r[0], r[1]): r[2] for r in insp_rows
        }
        print(f"Loaded {len(insp_by_key)} existing OR inspection index entries")

        SOURCE_AGENCY = "OR DHS LTC Licensing"
        total_defs = 0
        total_new_insp = 0
        skipped_fac = 0

        for fac_block in bundle.get("facilities") or []:
            lic = pad_license_or(fac_block.get("license_number"))
            fac_id = fac_by_lic.get(lic)
            if not fac_id:
                skipped_fac += 1
                continue

            # Collect all deficiency rows for this facility in memory
            # Schema: (inspection_id, code, category, severity, class,
            #          immediate_jeopardy, description, inspector_narrative,
            #          state_severity_raw, cited_date, corrected_date, status)
            def_rows: list[tuple[Any, ...]] = []
            new_insp_count = 0

            for insp in fac_block.get("inspections") or []:
                defs = insp.get("deficiencies") or []
                if not defs:
                    continue  # inspection-side records have no deficiency detail

                surl = insp.get("source_url") or ""
                idate_s = insp.get("inspection_date") or ""
                idate = _parse_date(idate_s)
                if not idate or not surl:
                    continue

                insp_id = insp_by_key.get((fac_id, surl))

                if insp_id is None and not args.dry_run:
                    # Insert new inspection
                    raw = insp.get("raw_data") if isinstance(insp.get("raw_data"), dict) else {}
                    with conn.cursor() as cur:
                        cur.execute("""
                            INSERT INTO inspections (
                                facility_id, inspection_date, inspection_type,
                                is_complaint, complaint_id, total_deficiency_count,
                                source_url, source_agency, raw_data
                            ) VALUES (
                                %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s
                            )
                            ON CONFLICT (facility_id, inspection_date, inspection_type,
                                         COALESCE(source_agency, ''))
                            DO NOTHING
                            RETURNING id::text
                        """, (
                            fac_id, idate,
                            insp.get("inspection_type") or "standard",
                            bool(insp.get("is_complaint")),
                            insp.get("complaint_id"),
                            len(defs),
                            surl,
                            SOURCE_AGENCY,
                            psycopg.types.json.Jsonb(raw),
                        ))
                        row = cur.fetchone()
                        if row is None:
                            # Conflict — look up by source_url + date
                            cur.execute("""
                                SELECT id::text FROM inspections
                                WHERE facility_id = %s::uuid
                                  AND source_url = %s
                                  AND inspection_date = %s
                            """, (fac_id, surl, idate))
                            r2 = cur.fetchone()
                            insp_id = r2[0] if r2 else None
                        else:
                            insp_id = row[0]
                            insp_by_key[(fac_id, surl)] = insp_id
                            new_insp_count += 1

                if insp_id is None:
                    continue

                for d in defs:
                    dk = _dedupe_key(insp_id, d)
                    code = _final_code(d, dk)
                    state_raw = (d.get("state_severity_raw") or "").strip() or None
                    ij = bool(d.get("immediate_jeopardy"))
                    sev = infer_severity(state_raw, ij)
                    cls = d.get("class") or state_raw
                    desc = (d.get("description") or "")[:4000] or None
                    narr = (d.get("inspector_narrative") or "")[:8000] or None
                    cat = (d.get("category") or "")[:500] or None
                    cited = _parse_date(d.get("cited_date"))
                    corrected = _parse_date(d.get("corrected_date"))
                    status = d.get("status")
                    if not status and corrected:
                        status = "corrected"
                    def_rows.append((
                        insp_id, code, cat, sev, cls,
                        ij, desc, narr,
                        state_raw, cited, corrected, status,
                    ))

            if not args.dry_run and def_rows:
                with conn.cursor() as cur:
                    cur.executemany("""
                        INSERT INTO deficiencies (
                            inspection_id, code, category, severity, class,
                            immediate_jeopardy, description, inspector_narrative,
                            state_severity_raw, cited_date, corrected_date, status
                        ) VALUES (
                            %s::uuid, %s, %s, %s, %s,
                            %s, %s, %s,
                            %s, %s, %s, %s
                        )
                    """, def_rows)
                conn.commit()

            total_defs += len(def_rows)
            total_new_insp += new_insp_count
            if def_rows or new_insp_count:
                print(f"  lic={lic} +{len(def_rows)} defs, +{new_insp_count} new insp")

        print(f"
Done. deficiencies={total_defs}, new_inspections={total_new_insp}, skipped_facilities={skipped_fac}")


if __name__ == "__main__":
    main()
