#!/usr/bin/env python3
"""
Oregon Regulatory Actions CSV Ingest — OR Universe, Phase 1.

Ingests the full RegulatoryActions export from ltclicensing.oregon.gov.

Actual CSV columns (as downloaded 2026-05-16):
  Provider ID | Name | Type | Sanction | Allegation | Type | Effective date | End date

Column mapping:
  Provider ID   → facilities.external_id
  Type          → facility type (AFH, RCF, etc.) — FIRST "Type" column
  Sanction      → case/sanction reference number (e.g. "AFHCD26-00163")
  Allegation    → description of what the facility did
  Type          → action type (e.g. "License Condition") — SECOND "Type" column
  Effective date → action start date
  End date      → action end date (empty = still active)

NOTE: The CSV has two "Type" columns. csv.DictReader disambiguates them as
"Type" and "Type.1" (or similar) depending on how the download handles
duplicate headers. We handle both possibilities.

Facilities under active "Enhanced Oversight" / "Enhanced Oversight & Supervision"
type actions get enhanced_oversight=true stamped on the facilities row.

Usage:
  python3 scrapers/or_regulatory_actions_ingest.py --input data/or_regulatory_actions.csv
  python3 scrapers/or_regulatory_actions_ingest.py --input data/or_regulatory_actions.csv --dry-run
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "OR"

_ENHANCED_OVERSIGHT_KEYWORDS = frozenset([
    "enhanced oversight",
    "enhanced oversight & supervision",
    "enhanced oversight and supervision",
    "eop",
])

# Map action type → approximate severity integer (used when storing as deficiency)
_ACTION_SEVERITY: dict[str, int] = {
    "civil penalty": 3,
    "license revocation": 4,
    "license suspension": 4,
    "license condition": 2,
    "enhanced oversight": 2,
    "enhanced oversight & supervision": 2,
    "enhanced oversight and supervision": 2,
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


def parse_date(raw: str) -> date | None:
    raw = raw.strip()
    if not raw:
        return None
    from datetime import datetime
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            pass
    return None


def get_action_type(row: dict[str, str], headers: list[str]) -> str:
    """
    The CSV has two columns both named "Type". csv.DictReader deduplicates
    these as "Type" (facility type) and "Type" (action type), but the second
    occurrence may be keyed as "Type.1" or remain overwritten depending on the
    CSV reader version. We detect whichever pattern is present.
    """
    # If csv.DictReader made the duplicate visible as "Type.1" or similar
    for candidate in ("Type.1", "Action type", "Action Type", "Sanction type", "Sanction Type"):
        if candidate in row:
            return row[candidate].strip()

    # Fallback: count how many "Type"-keyed headers exist in the raw list
    # and return the second value if available
    type_count = sum(1 for h in headers if h.strip().lower() == "type")
    if type_count >= 2:
        # The DictReader will have overwritten — use the last "Type" value
        # which in practice is the action type column (appears after Sanction)
        return row.get("Type", "").strip()

    return row.get("Type", "").strip()


def ingest(input_path: Path, dry_run: bool, limit: int | None) -> None:
    with open(input_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        all_rows = list(reader)

    if limit:
        all_rows = all_rows[:limit]

    print(f"  Loaded {len(all_rows)} rows from {input_path.name}")
    print(f"  CSV headers: {headers}")

    if dry_run:
        for row in all_rows[:5]:
            pid  = row.get("Provider ID", "")
            sanc = row.get("Sanction", "")
            alg  = row.get("Allegation", "")
            eff  = row.get("Effective date", "")
            end  = row.get("End date", "")
            atype = get_action_type(row, headers)
            print(f"    pid={pid:12s}  type={atype:25s}  eff={eff}  end={end}  sanc={sanc[:20]}")
        print("  ... (dry-run, no DB writes)")
        return

    # Pre-load facility map to avoid per-row SELECTs
    conn = get_conn()
    ok = skip_fac = skip_insp = eo_updated = err = 0

    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT external_id, id FROM facilities WHERE state_code = 'OR' AND external_id IS NOT NULL"
            )
            fac_map: dict[str, str] = {r[0]: str(r[1]) for r in cur.fetchall()}

        for row in all_rows:
            external_id = row.get("Provider ID", "").strip()
            if not external_id:
                skip_fac += 1
                continue

            facility_id = fac_map.get(external_id)
            if not facility_id:
                skip_fac += 1
                continue

            action_type  = get_action_type(row, headers)
            allegation   = row.get("Allegation", "").strip() or None
            sanction_ref = row.get("Sanction", "").strip() or None
            eff_date     = parse_date(row.get("Effective date", ""))
            end_date     = parse_date(row.get("End date", ""))

            # Flag Enhanced Oversight on facility (UPDATE, safe with savepoint)
            if action_type.lower() in _ENHANCED_OVERSIGHT_KEYWORDS:
                is_active = end_date is None or end_date >= date.today()
                if is_active:
                    try:
                        with conn.cursor() as cur:
                            cur.execute("SAVEPOINT sp_eo")
                            cur.execute(
                                "UPDATE facilities SET enhanced_oversight = true WHERE id = %s",
                                (facility_id,),
                            )
                            cur.execute("RELEASE SAVEPOINT sp_eo")
                        eo_updated += 1
                    except Exception:
                        with conn.cursor() as cur:
                            cur.execute("ROLLBACK TO SAVEPOINT sp_eo")
                            cur.execute("RELEASE SAVEPOINT sp_eo")

            # Find nearest inspection to attach action to
            action_date = eff_date
            inspection_id = None
            if action_date:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT id FROM inspections
                        WHERE facility_id = %s
                          AND inspection_date BETWEEN %s::date - INTERVAL '120 days'
                                                 AND %s::date + INTERVAL '30 days'
                        ORDER BY ABS(EXTRACT(EPOCH FROM (inspection_date::timestamp - %s::timestamp)))
                        LIMIT 1
                        """,
                        (facility_id, action_date, action_date, action_date),
                    )
                    insp_row = cur.fetchone()
                    if insp_row:
                        inspection_id = str(insp_row[0])

            if not inspection_id:
                skip_insp += 1
                continue

            sev = _ACTION_SEVERITY.get(action_type.lower(), 2)
            description = allegation or action_type
            if sanction_ref:
                description = f"{action_type} ({sanction_ref}): {description}"

            try:
                with conn.cursor() as cur:
                    cur.execute("SAVEPOINT sp_action")
                    try:
                        cur.execute(
                            """
                            INSERT INTO deficiencies (
                                inspection_id, code, description,
                                severity, immediate_jeopardy, state_severity_raw
                            ) VALUES (
                                %(inspection_id)s, %(code)s, %(description)s,
                                %(severity)s, %(immediate_jeopardy)s, %(state_severity_raw)s
                            )
                            """,
                            {
                                "inspection_id": inspection_id,
                                "code": None,
                                "description": description[:1000] if description else None,
                                "severity": sev,
                                "immediate_jeopardy": sev >= 4,
                                "state_severity_raw": action_type,
                            },
                        )
                        cur.execute("RELEASE SAVEPOINT sp_action")
                        ok += 1
                    except Exception as exc:
                        cur.execute("ROLLBACK TO SAVEPOINT sp_action")
                        cur.execute("RELEASE SAVEPOINT sp_action")
                        print(f"  WARN: {external_id} {action_type} — {exc}", file=sys.stderr)
                        err += 1
            except Exception as exc_outer:
                print(f"  WARN outer: {external_id} — {exc_outer}", file=sys.stderr)
                err += 1

        conn.commit()

    print(
        f"  Actions: {ok} stored, {skip_fac} no-facility, {skip_insp} no-inspection, "
        f"{err} errors | EO flags set: {eo_updated}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest OR RegulatoryActions CSV.")
    parser.add_argument("--input", required=True, help="Path to RegulatoryActions CSV")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    load_env()
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    ingest(input_path, args.dry_run, args.limit)


if __name__ == "__main__":
    main()
