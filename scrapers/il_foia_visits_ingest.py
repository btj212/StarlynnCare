#!/usr/bin/env python3
"""
Illinois IDPH FOIA workbook ingest.

Reads "FOIA AL Visits-2024 to present.xlsx" (received 2026-05-19) and inserts
inspections + deficiencies into the DB for IL MC-candidate facilities.

Column map (verbatim from workbook):
  col 0: "Facility: Facility/Establishment Name"  → facility name (string)
  col 1: "Name"                                   → IDPH license number (8-digit)
  col 2: "Survey-Sub Type"                        → compound event type string
  col 3: "Survey Exit Date"                       → inspection_date (MM/DD/YYYY)
  col 4: "Tags/Findings Cited"                    → multi-line citation blob
  col 5: "Fine Amount"                            → civil_money_penalty_total (numeric)

Survey-Sub Type normalization:
  The field may contain multiple `; `-joined tokens, e.g.:
    "7D COI = Complaint Original Investigation; 7D FRI  = Facility Reported Incident"
  We split on "; ", map each token's prefix code, pick the most material single type
  for inspections.inspection_type, and store the full raw string in raw_data.

Tags/Findings Cited normalization:
  Lines split on `_x000D_` + newlines. Each line parsed for:
    - 295.XXXX code(s)
    - Type (T1/T2/T3) or GV (General Violation)
    - Dollar amount or K-shorthand fine
    - "Repeat" prefix
    - "REMOVED PER SOD" → status = 'removed_per_sod'
    - "No Violations" / empty → no deficiency rows for this inspection
  Lines that don't match the pattern are kept verbatim in a fallback deficiency row.

Usage:
  python3 -u scrapers/il_foia_visits_ingest.py \\
      --input "$HOME/Downloads/FOIA AL Visits-2024 to present.xlsx"

  python3 -u scrapers/il_foia_visits_ingest.py \\
      --input ... --dry-run

  python3 -u scrapers/il_foia_visits_ingest.py \\
      --input ... --smoke     # first 20 rows only

  python3 -u scrapers/il_foia_visits_ingest.py \\
      --input ... --license 00174877  # single facility
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg
import psycopg.types.json
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "IL"
SOURCE_AGENCY = "IDPH-DAL"
# Placeholder source URL format — Phase 3 (il_llcs_event_scrape.py) fills real URLs.
_SOURCE_URL_TMPL = "https://llcs.dph.illinois.gov/s/?language=en_US#license={license}"

# ---------------------------------------------------------------------------
# Survey-Sub Type priority order for picking the single canonical type
# Higher index = higher priority when multiple types appear in one event.
# ---------------------------------------------------------------------------
_TYPE_PRIORITY: dict[str, int] = {
    "FRI": 1,           # Facility Reported Incident — lowest
    "desk_audit": 2,
    "initial": 3,
    "follow-up": 4,
    "focused": 5,
    "special": 6,
    "COI": 7,           # Complaint Original Investigation — highest
}

_TYPE_MAP: dict[str, tuple[str, bool]] = {
    # (inspection_type, is_complaint)
    "COI":        ("complaint", True),
    "FRI":        ("facility_reported_incident", False),
    "L/IN":       ("initial", False),
    "L/P1":       ("initial", False),
    "L/SP":       ("special", False),
    "L/desk":     ("desk_audit", False),
    "FIC":        ("focused", False),
    "C/F1":       ("follow-up", False),
    "M/F1":       ("follow-up", False),
    "24HR":       ("complaint", True),
    "30D":        ("complaint", True),
    "7D":         ("complaint", True),
}

# Regex to extract the SHORT key from a token like "7D COI = Complaint …"
_SUBTYPE_KEY_RE = re.compile(
    r"(?:24HR|30D|7D)?\s*"
    r"(COI|FRI|L/IN|L/P1|L/SP|L/desk|FIC|C/F1|M/F1)",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Citation parsing
# ---------------------------------------------------------------------------

# Matches lines like:
#   "295.6010 a)1)2), T2, $500"
#   "Repeat 295.4010 d)g), T2, $1K"
#   "295.4010 a)_x000D_295.5000 a)d)j)..."  ← handled by prior line-split
_CITATION_RE = re.compile(
    r"(?P<repeat>(?:repeat)\s+)?"
    r"(?P<code>295\.\d{4}(?:\s*[a-zA-Z0-9\(\)\)\s-]*)?)?"
    r"(?:,\s*(?P<sev>T[123]|GV))?"
    r"(?:[,\s]*\$?(?P<fine>[\d,]+[kK]?))?"
    r"(?:\s*\*{0,2}(?P<note>[A-Z][A-Z ]+)\*{0,2})?",
    re.IGNORECASE,
)

# Normalize fine strings like "$500", "1K", "1,000" → float
_FINE_RE = re.compile(r"^[\$,\s]*(?P<num>\d[\d,]*)(?P<k>[kK])?$")

_SEVERITY_MAP: dict[str, tuple[int, str]] = {
    "T1": (3, "Type 1"),
    "T2": (2, "Type 2"),
    "T3": (1, "Type 3"),
    "GV": (1, "General Violation"),
}

_NO_VIOLATION_PATTERNS = re.compile(
    r"\bno\s+violations?\b|\bnone\b|^none$|^no violation|no\s+violation\s+found",
    re.IGNORECASE,
)
_REMOVED_SOD_RE = re.compile(r"removed\s+per\s+sod", re.IGNORECASE)


def _parse_fine(raw: str) -> float | None:
    if not raw:
        return None
    m = _FINE_RE.match(raw.strip())
    if not m:
        return None
    n = float(m.group("num").replace(",", ""))
    if m.group("k"):
        n *= 1000
    return n


def _split_citation_lines(raw: str) -> list[str]:
    """Split the Tags/Findings field into one line per citation."""
    if not raw:
        return []
    # openpyxl returns carriage-returns as literal \r (chr 13) or as _x000D_ in older files
    text = str(raw).replace("_x000D_", "\n").replace("\r", "\n")
    lines = [ln.strip() for ln in text.splitlines()]
    return [ln for ln in lines if ln]


def _parse_citation_line(line: str) -> dict[str, Any] | None:
    """
    Parse one line from Tags/Findings Cited into a deficiency-like dict.
    Returns None if the line is a no-violation marker (still insert the inspection).
    Returns a dict with keys: code, state_severity_raw, severity, is_repeat,
                              civil_money_penalty, status, raw_line
    """
    if _NO_VIOLATION_PATTERNS.search(line):
        return None  # clean inspection

    removed_sod = bool(_REMOVED_SOD_RE.search(line))
    if removed_sod and not re.search(r"295\.", line):
        # Pure removal note, no code visible
        return {
            "code": None,
            "state_severity_raw": None,
            "severity": None,
            "is_repeat": False,
            "civil_money_penalty": None,
            "status": "removed_per_sod",
            "raw_line": line,
        }

    m = _CITATION_RE.match(line)
    if not m or not m.group("code"):
        # Keep as raw fallback so we don't silently drop data
        return {
            "code": None,
            "state_severity_raw": None,
            "severity": None,
            "is_repeat": False,
            "civil_money_penalty": None,
            "status": "open",
            "raw_line": line,
        }

    raw_code = re.sub(r"\s+", " ", (m.group("code") or "").strip().rstrip(",").rstrip())
    # Strip trailing severity token the greedy code group consumed (e.g. "295.9040 T2")
    raw_code = re.sub(r"\s+(?:T[123]|GV)\s*$", "", raw_code, flags=re.IGNORECASE).strip()
    # Strip trailing "repeat" word embedded in the code field (e.g. "295.4010 a) repeat")
    _had_inline_repeat = bool(re.search(r"\brepeat\b\s*$", raw_code, re.IGNORECASE))
    raw_code = re.sub(r"\s+repeat\s*$", "", raw_code, flags=re.IGNORECASE).strip()

    sev_token = (m.group("sev") or "").upper().strip()
    # Capture severity from "Repeat T2" style (sev follows "repeat" without comma separator)
    if not sev_token:
        _sev_anywhere = re.search(r"\b(T[123]|GV)\b", line, re.IGNORECASE)
        if _sev_anywhere:
            sev_token = _sev_anywhere.group(1).upper()

    sev_int, sev_raw = _SEVERITY_MAP.get(sev_token, (None, None))
    is_repeat = bool(m.group("repeat")) or _had_inline_repeat
    # Also detect "Repeat" appearing anywhere in the line that isn't the leading group
    if not is_repeat and re.search(r"\brepeat\b", line, re.IGNORECASE):
        is_repeat = True

    fine = _parse_fine(m.group("fine") or "")
    # Fallback: scan for dollar amount anywhere in the line if regex didn't capture it
    if fine is None:
        _fine_anywhere = re.search(r"\$\s*(\d[\d,]*[kK]?)", line, re.IGNORECASE)
        if _fine_anywhere:
            fine = _parse_fine(_fine_anywhere.group(1))
    note = (m.group("note") or "").strip()
    status = "removed_per_sod" if (removed_sod or "REMOVED PER SOD" in note.upper()) else "open"

    # Severity null when removed per SOD
    if status == "removed_per_sod":
        sev_int = None
        sev_raw = None

    return {
        "code": raw_code[:200] if raw_code else None,
        "state_severity_raw": sev_raw,
        "severity": sev_int,
        "is_repeat": is_repeat,
        "civil_money_penalty": fine,
        "status": status,
        "raw_line": line,
    }


def parse_citations(raw: str) -> list[dict[str, Any]] | None:
    """
    Parse Tags/Findings Cited field.
    Returns:
      None  — field indicates no violations (don't insert any deficiency rows)
      []    — field is empty / unparseable
      [...]  — list of deficiency dicts
    """
    lines = _split_citation_lines(raw)
    if not lines:
        return []

    results: list[dict[str, Any]] = []
    for line in lines:
        parsed = _parse_citation_line(line)
        if parsed is None:
            return None  # no violations marker found — stop and return None
        results.append(parsed)
    return results


# ---------------------------------------------------------------------------
# Survey-Sub Type parsing
# ---------------------------------------------------------------------------


def _parse_subtype_token(token: str) -> str | None:
    """Return the SHORT key (COI, FRI, L/IN …) for a single token."""
    token = token.strip()
    for key in _TYPE_MAP:
        if key.lower() in token.lower():
            return key
    m = _SUBTYPE_KEY_RE.search(token)
    return m.group(1).upper() if m else None


def parse_survey_subtype(raw: str) -> tuple[str, bool, str]:
    """
    Parse the compound "Survey-Sub Type" field.
    Returns (inspection_type, is_complaint, canonical_key).
    """
    tokens = [t.strip() for t in raw.split(";") if t.strip()]
    if not tokens:
        return "inspection", False, "UNK"

    best_key: str | None = None
    best_priority = -1
    is_complaint = False

    for token in tokens:
        key = _parse_subtype_token(token)
        if key is None:
            continue
        itype, ic = _TYPE_MAP.get(key, ("inspection", False))
        if ic:
            is_complaint = True
        p = _TYPE_PRIORITY.get(key, 0)
        if p > best_priority:
            best_priority = p
            best_key = key

    if best_key is None:
        return "inspection", is_complaint, "UNK"

    itype, ic = _TYPE_MAP.get(best_key, ("inspection", False))
    if ic:
        is_complaint = True
    return itype, is_complaint, best_key


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def _parse_date(raw: Any) -> date | None:
    if raw is None:
        return None
    if isinstance(raw, (date, datetime)):
        return raw.date() if isinstance(raw, datetime) else raw
    s = str(raw).strip()
    if not s:
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


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


def load_facility_map(conn: psycopg.Connection) -> dict[str, str]:
    """Return {license_number: facility_id} for all IL facilities."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT license_number, id::text FROM facilities "
            "WHERE state_code = 'IL' AND license_number IS NOT NULL"
        )
        return {row[0]: row[1] for row in cur.fetchall()}


def insert_inspection(
    cur: psycopg.Cursor,
    facility_id: str,
    insp_date: date,
    inspection_type: str,
    is_complaint: bool,
    civil_penalty_total: float | None,
    raw_subtype: str,
    license_number: str,
    scrape_run_id: str,
) -> str | None:
    """Insert one inspection row. Returns inspection_id or None (duplicate)."""
    source_url = _SOURCE_URL_TMPL.format(license=license_number)
    raw_data = psycopg.types.json.Jsonb({"survey_subtype": raw_subtype})
    cur.execute(
        """
        INSERT INTO inspections (
            facility_id, inspection_date, inspection_type,
            is_complaint, civil_money_penalty_total,
            source_url, source_agency, scrape_run_id,
            raw_data
        ) VALUES (
            %s, %s, %s,
            %s, %s,
            %s, %s, %s::uuid,
            %s
        )
        ON CONFLICT (facility_id, inspection_date, inspection_type,
                     COALESCE(source_agency, ''))
        DO NOTHING
        RETURNING id::text
        """,
        (
            facility_id, insp_date, inspection_type,
            is_complaint, civil_penalty_total,
            source_url, SOURCE_AGENCY, scrape_run_id,
            raw_data,
        ),
    )
    row = cur.fetchone()
    return str(row[0]) if row else None


def insert_deficiency(
    cur: psycopg.Cursor,
    inspection_id: str,
    d: dict[str, Any],
) -> None:
    # Use raw_line as description for traceability when we have no structured code
    code = d["code"] or f"__il_{uuid.uuid4().hex[:16]}"
    desc = d["raw_line"][:2000] if d.get("raw_line") else None
    cur.execute(
        """
        INSERT INTO deficiencies (
            inspection_id,
            code, description,
            severity, state_severity_raw,
            is_repeat, civil_money_penalty, status
        ) VALUES (
            %s::uuid,
            %s, %s,
            %s, %s,
            %s, %s, %s
        )
        """,
        (
            inspection_id,
            code[:200], desc,
            d.get("severity"), d.get("state_severity_raw"),
            bool(d.get("is_repeat")), d.get("civil_money_penalty"), d.get("status", "open"),
        ),
    )


def deficiency_exists(cur: psycopg.Cursor, inspection_id: str, code: str) -> bool:
    cur.execute(
        "SELECT 1 FROM deficiencies WHERE inspection_id = %s::uuid AND code = %s LIMIT 1",
        (inspection_id, code),
    )
    return cur.fetchone() is not None


# ---------------------------------------------------------------------------
# Row processing
# ---------------------------------------------------------------------------


def process_row(
    conn: psycopg.Connection,
    row_idx: int,
    raw: tuple,
    fac_map: dict[str, str],
    scrape_run_id: str,
    dry_run: bool,
) -> dict[str, int]:
    """Process one workbook row. Returns stats dict."""
    stats: dict[str, int] = {
        "inserted_insp": 0,
        "inserted_def": 0,
        "skipped_non_mc": 0,
        "skipped_no_date": 0,
        "skipped_dup_insp": 0,
        "errors": 0,
    }

    raw_name    = str(raw[0]).strip() if raw[0] is not None else ""
    raw_lic     = str(raw[1]).strip() if raw[1] is not None else ""
    raw_subtype = str(raw[2]).strip() if raw[2] is not None else ""
    raw_date    = raw[3]
    raw_tags    = str(raw[4]).strip() if raw[4] is not None else ""
    raw_fine    = raw[5]

    license_number = re.sub(r"\D", "", raw_lic).zfill(8) if raw_lic else None
    if not license_number:
        stats["errors"] += 1
        return stats

    facility_id = fac_map.get(license_number)
    if facility_id is None:
        stats["skipped_non_mc"] += 1
        return stats

    insp_date = _parse_date(raw_date)
    if insp_date is None:
        stats["skipped_no_date"] += 1
        print(f"  [row {row_idx}] no date for {license_number} — skipping", flush=True)
        return stats

    inspection_type, is_complaint, _key = parse_survey_subtype(raw_subtype)

    civil_total: float | None = None
    if raw_fine is not None:
        try:
            civil_total = float(raw_fine)
        except (TypeError, ValueError):
            pass

    # Parse citations (may be None = no violations, [] = empty, [...] = deficiencies)
    citation_result = parse_citations(raw_tags)

    if dry_run:
        dcount = len(citation_result) if citation_result else 0
        print(
            f"  [row {row_idx}] {license_number} | {raw_name[:35]:35s} | "
            f"{insp_date} | {inspection_type:30s} | "
            f"defs={dcount} | fine={civil_total}"
        )
        stats["inserted_insp"] += 1
        stats["inserted_def"] += dcount
        return stats

    sp = f"sp_il_row_{row_idx}"
    with conn.cursor() as cur:
        try:
            cur.execute(f"SAVEPOINT {sp}")

            insp_id = insert_inspection(
                cur, facility_id, insp_date, inspection_type,
                is_complaint, civil_total, raw_subtype, license_number, scrape_run_id,
            )

            if insp_id is None:
                cur.execute(f"RELEASE SAVEPOINT {sp}")
                stats["skipped_dup_insp"] += 1
                return stats

            stats["inserted_insp"] += 1

            # citation_result = None means no violations; don't insert any deficiency rows
            if citation_result:
                for d in citation_result:
                    code = d["code"] or f"__il_{uuid.uuid4().hex[:16]}"
                    if not deficiency_exists(cur, insp_id, code):
                        d["code"] = code
                        sp2 = f"sp_il_def_{row_idx}_{stats['inserted_def']}"
                        try:
                            cur.execute(f"SAVEPOINT {sp2}")
                            insert_deficiency(cur, insp_id, d)
                            cur.execute(f"RELEASE SAVEPOINT {sp2}")
                            stats["inserted_def"] += 1
                        except Exception as de:
                            cur.execute(f"ROLLBACK TO SAVEPOINT {sp2}")
                            print(f"  DEF ERROR row {row_idx}: {de}", file=sys.stderr, flush=True)

            cur.execute(f"RELEASE SAVEPOINT {sp}")

        except Exception as exc:
            cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
            print(f"  ROW ERROR {row_idx} {license_number}: {exc}", file=sys.stderr, flush=True)
            stats["errors"] += 1

    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="IL IDPH FOIA workbook ingest")
    parser.add_argument("--input", required=True, help="Path to the FOIA .xlsx file")
    parser.add_argument("--dry-run", action="store_true", help="Print rows, no DB writes")
    parser.add_argument("--smoke", action="store_true", help="Process first 20 data rows only")
    parser.add_argument("--license", help="Process only rows matching this license number")
    args = parser.parse_args()

    load_env()

    xlsx_path = Path(args.input)
    if not xlsx_path.is_file():
        print(f"File not found: {xlsx_path}", file=sys.stderr)
        sys.exit(1)

    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    try:
        import openpyxl
    except ImportError:
        print("ERROR: openpyxl not installed. Run: pip install openpyxl", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {xlsx_path.name} …", flush=True)
    wb = openpyxl.load_workbook(str(xlsx_path), data_only=True, read_only=True)
    ws = wb.active

    all_rows: list[tuple] = []
    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
        if not row or row[0] is None:
            continue
        all_rows.append(tuple(row))

    wb.close()
    print(f"  {len(all_rows)} data rows loaded.", flush=True)

    if args.smoke:
        all_rows = all_rows[:20]
    if args.license:
        target_lic = re.sub(r"\D", "", args.license).zfill(8)
        all_rows = [r for r in all_rows if re.sub(r"\D", "", str(r[1] or "")).zfill(8) == target_lic]
        print(f"  Filtered to license {target_lic}: {len(all_rows)} rows.", flush=True)

    # Pre-load facility map (OR learning #5 — avoid per-row SELECT)
    if args.dry_run:
        fac_map: dict[str, str] = {}
        print("  [dry-run] skipping DB facility map load", flush=True)
    else:
        conn_temp = get_conn()
        fac_map = load_facility_map(conn_temp)
        conn_temp.close()
        print(f"  Facility map: {len(fac_map)} IL facilities in DB.", flush=True)

    totals: dict[str, int] = {
        "inserted_insp": 0, "inserted_def": 0,
        "skipped_non_mc": 0, "skipped_no_date": 0,
        "skipped_dup_insp": 0, "errors": 0,
    }

    scrape_run_id = str(uuid.uuid4())

    if args.dry_run:
        print("\n--- DRY RUN ---\n")
        for i, row in enumerate(all_rows, start=2):
            st = process_row(None, i, row, fac_map, scrape_run_id, dry_run=True)  # type: ignore[arg-type]
            for k in totals:
                totals[k] += st.get(k, 0)
        print(f"\nDry-run totals: {totals}")
        return

    conn = get_conn()
    try:
        for i, row in enumerate(all_rows, start=2):
            st = process_row(conn, i, row, fac_map, scrape_run_id, dry_run=False)
            for k in totals:
                totals[k] += st.get(k, 0)
        conn.commit()
    finally:
        conn.close()

    print(
        f"\nDone. scrape_run_id={scrape_run_id}\n"
        f"  Inspections inserted : {totals['inserted_insp']}\n"
        f"  Deficiencies inserted: {totals['inserted_def']}\n"
        f"  Skipped (non-MC)     : {totals['skipped_non_mc']}\n"
        f"  Skipped (no date)    : {totals['skipped_no_date']}\n"
        f"  Skipped (dup insp)   : {totals['skipped_dup_insp']}\n"
        f"  Errors               : {totals['errors']}",
        flush=True,
    )


if __name__ == "__main__":
    main()
