#!/usr/bin/env python3
"""
Fetch CDSS Transparency API inspection and complaint reports for Alameda County
RCFE facilities, parse deficiencies, and populate `inspections` + `deficiencies`.

Secondary function: promote additional facilities to serves_memory_care = true
if they have citations under California Title 22 §87705 (dementia care) or
§87706 (dementia advertising), which are definitive proof of a memory-care program.

Data source
-----------
    CDSS Transparency API
    https://www.ccld.dss.ca.gov/transparencyapi/api/FacilityReports/{facNum}
      → JSON index: {COUNT, REPORTARRAY: [{REPORTTYPE, REPORTDATE, CONTROLNUMBER}]}
    https://www.ccld.dss.ca.gov/transparencyapi/api/FacilityReports?facNum=X&inx=N
      → HTML of one inspection or complaint report

Report types
------------
    Inspection (FACILITY EVALUATION REPORT)  — routine annual visit
    Complaint  (COMPLAINT INVESTIGATION REPORT) — complaint-driven
    Other      (various: re-inspection, follow-up, LIC9099) — also ingested

Deficiency severity mapping
---------------------------
    CDSS Type A → severity 3  (actual harm / significant risk)
    CDSS Type B → severity 2  (potential for harm)
    Type A + "immediate" in narrative → severity 4 (immediate jeopardy)

Run modes
---------
    python ccld_citations_ingest.py                   # all CA facilities in DB
    python ccld_citations_ingest.py --publishable     # only publishable=true
    python ccld_citations_ingest.py --smoke           # first 3 facilities
    python ccld_citations_ingest.py --dry-run         # parse only, no DB writes
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "CA"
SCRAPER_NAME = "cdss_ccld_citations_alameda"

TRANSPARENCY_BASE = "https://www.ccld.dss.ca.gov/transparencyapi/api"
SOURCE_AGENCY = "California CDSS / Community Care Licensing Division"

REQUEST_DELAY_SECS = 0.6

# Regex that detects dementia-care regulation citations in section numbers
DEMENTIA_SECTION_RE = re.compile(r"8770[56]")
IMMEDIATE_JEOPARDY_RE = re.compile(
    r"\bimmediate\s+(danger|jeopardy|threat|risk)\b", re.IGNORECASE
)


# ---------------------------------------------------------------------------
# Env
# ---------------------------------------------------------------------------


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def parse_date_cdss(val: str | None) -> date | None:
    if not val or str(val).strip() in ("", "None"):
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(str(val).strip(), fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# HTML parsing helpers
# ---------------------------------------------------------------------------


def table_text(tbl: Any) -> str:
    """Flatten a BeautifulSoup table to a single stripped string."""
    return tbl.get_text(" ", strip=True)


def cells(tbl: Any) -> list[str]:
    """Return a list of stripped cell texts from a table."""
    return [td.get_text(" ", strip=True) for td in tbl.find_all(["td", "th"])]


def find_cell_after(tbl_cells: list[str], label: str) -> str | None:
    """Return the cell immediately following the one containing label."""
    lower = [c.lower() for c in tbl_cells]
    for i, c in enumerate(lower):
        if label.lower() in c and i + 2 < len(tbl_cells):
            # Skip the ':' separator cell if present
            nxt = tbl_cells[i + 1].strip(":")
            return nxt if nxt and nxt != ":" else (tbl_cells[i + 2] if i + 2 < len(tbl_cells) else None)
    return None


# ---------------------------------------------------------------------------
# Report index
# ---------------------------------------------------------------------------


def fetch_report_index(fac_num: str) -> dict[str, Any]:
    """Return {COUNT, REPORTARRAY} for a facility."""
    url = f"{TRANSPARENCY_BASE}/FacilityReports/{fac_num}"
    r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()
    return r.json()


# ---------------------------------------------------------------------------
# Individual report HTML fetch + parse
# ---------------------------------------------------------------------------


def fetch_report_html(fac_num: str, inx: int) -> str | None:
    """Fetch HTML for report at position inx. Returns None on 4xx."""
    url = f"{TRANSPARENCY_BASE}/FacilityReports?facNum={fac_num}&inx={inx}"
    r = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
    if r.status_code == 400:
        return None
    r.raise_for_status()
    return r.text


def parse_report(
    html: str,
    report_meta: dict[str, Any],
    fac_num: str,
    source_url: str,
) -> dict[str, Any] | None:
    """
    Parse a CDSS report HTML into a structured dict:
    {
        inspection_date, inspection_type, is_complaint, complaint_id,
        outcome, inspector_name, narrative_text,
        deficiencies: [{type, section, regulatory_text, deficiency_statement, severity, immediate_jeopardy}],
        has_dementia_citation, source_url, raw_html_len
    }
    Returns None if the HTML is clearly not a valid report.
    """
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    if not tables:
        return None

    report_type = report_meta.get("REPORTTYPE", "Other")
    report_date_str = report_meta.get("REPORTDATE", "")
    inspection_date = parse_date_cdss(report_date_str)
    is_complaint = report_type == "Complaint"
    complaint_id = report_meta.get("CONTROLNUMBER") or None
    if complaint_id == "":
        complaint_id = None

    outcome: str | None = None
    inspector_name: str | None = None
    narrative_parts: list[str] = []
    deficiencies: list[dict[str, Any]] = []

    for i, tbl in enumerate(tables):
        txt = table_text(tbl)
        c = cells(tbl)

        # ── Outcome (complaints) ─────────────────────────────────────────
        if txt.strip() in ("Substantiated", "Unsubstantiated", "Inconclusive"):
            outcome = txt.strip()

        # ── Outcome embedded in cell (e.g. "Unsubstantiated | Est...") ──
        if c and c[0].strip() in ("Substantiated", "Unsubstantiated", "Inconclusive"):
            outcome = c[0].strip()

        # ── Inspector name ───────────────────────────────────────────────
        if "LICENSING EVALUATOR NAME" in txt and inspector_name is None:
            for cell in c:
                m = re.search(
                    r"LICENSING EVALUATOR NAME\s*[:\|]?\s*(.+?)(?:\s+LICENSING EVALUATOR SIGNATURE|$)",
                    cell, re.IGNORECASE
                )
                if m:
                    candidate = m.group(1).strip().strip(":")
                    if candidate and "SIGNATURE" not in candidate.upper():
                        inspector_name = candidate
                        break

        # ── Narrative blocks ─────────────────────────────────────────────
        # NARRATIVE tables start with "NARRATIVE" followed by page numbers
        if c and c[0] == "NARRATIVE":
            # Collect all text that isn't just numbers (the page-number columns)
            for cell_txt in c[1:]:
                if not re.match(r"^\d+$", cell_txt):
                    narrative_parts.append(cell_txt)

        # ── Deficiency tables (Type A / Type B) ─────────────────────────
        # Each deficiency table has a blank spacer cell first (Lotus Domino img),
        # so "Type A" / "Type B" may appear at index 0 or 1.
        type_cell = c[0] if c and c[0] in ("Type A", "Type B") else (
            c[1] if len(c) > 1 and c[1] in ("Type A", "Type B") else None
        )
        if type_cell is not None:
            deficiency_type = type_cell  # "Type A" or "Type B"

            # Section cited: look for "CCR" then the section number
            section: str | None = None
            for j, cell in enumerate(c):
                if cell == "CCR" and j + 1 < len(c):
                    section = c[j + 1].strip()
                    break

            # Next table holds the regulatory text and deficiency statement
            regulatory_text = ""
            deficiency_statement = ""
            if i + 1 < len(tables):
                desc_cells = [
                    x for x in cells(tables[i + 1])
                    if not re.match(r"^\d+$", x)  # strip Lotus row numbers
                ]
                desc_full = " ".join(desc_cells)

                # Split on the standard CDSS divider phrase
                split_marker = "This requirement is not met as evidenced by:"
                if split_marker in desc_full:
                    parts = desc_full.split(split_marker, 1)
                    regulatory_text = parts[0].strip()
                    remainder = parts[1]
                    # Strip leading spaces, "Deficient Practice Statement", and row numbers
                    remainder = re.sub(
                        r"^\s*Deficient Practice Statement(\s+\d+)*\s*", "", remainder
                    ).strip()
                    deficiency_statement = remainder
                else:
                    # No standard split marker — strip statement header if present, then store all
                    deficiency_statement = re.sub(
                        r"^\s*Deficient Practice Statement(\s+\d+)*\s*", "", desc_full
                    ).strip()

            # Severity mapping
            immediate = bool(
                IMMEDIATE_JEOPARDY_RE.search(regulatory_text)
                or IMMEDIATE_JEOPARDY_RE.search(deficiency_statement)
            )
            if deficiency_type == "Type A":
                severity = 4 if immediate else 3
            else:
                severity = 2  # Type B = potential for harm

            deficiencies.append(
                {
                    "type": deficiency_type,        # "Type A" or "Type B"
                    "section": section,              # e.g. "87705(c)(5)"
                    "regulatory_text": regulatory_text,
                    "deficiency_statement": deficiency_statement,
                    "severity": severity,
                    "immediate_jeopardy": immediate,
                    "class": deficiency_type,        # stored in class column
                }
            )

    narrative_text = " ".join(narrative_parts).strip()

    # §87705/87706 detection
    has_dementia_citation = any(
        DEMENTIA_SECTION_RE.search(d.get("section") or "")
        for d in deficiencies
    )

    return {
        "inspection_date": inspection_date,
        "inspection_type": report_type.lower(),  # 'inspection', 'complaint', 'other'
        "is_complaint": is_complaint,
        "complaint_id": complaint_id,
        "outcome": outcome,
        "inspector_name": inspector_name,
        "narrative_text": narrative_text,
        "deficiencies": deficiencies,
        "has_dementia_citation": has_dementia_citation,
        "source_url": source_url,
        "raw_html_len": len(html),
    }


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


def get_already_ingested_urls(
    conn: psycopg.Connection, facility_id: str
) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT source_url FROM inspections WHERE facility_id = %s",
            (facility_id,),
        )
        return {row[0] for row in cur.fetchall()}


def insert_inspection(
    conn: psycopg.Connection,
    facility_id: str,
    parsed: dict[str, Any],
    scrape_run_id: str,
) -> str:
    """Insert one inspection row, return its uuid."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO inspections (
                facility_id, inspection_date, inspection_type,
                is_complaint, complaint_id,
                total_deficiency_count,
                source_url, source_agency, scrape_run_id,
                raw_data
            ) VALUES (
                %s, %s, %s,
                %s, %s,
                %s,
                %s, %s, %s::uuid,
                %s
            )
            RETURNING id::text
            """,
            (
                facility_id,
                parsed["inspection_date"],
                parsed["inspection_type"],
                parsed["is_complaint"],
                parsed["complaint_id"],
                len(parsed["deficiencies"]),
                parsed["source_url"],
                SOURCE_AGENCY,
                scrape_run_id,
                psycopg.types.json.Jsonb({
                    "outcome": parsed["outcome"],
                    "inspector_name": parsed["inspector_name"],
                    "narrative": parsed["narrative_text"][:4000],
                    "raw_html_len": parsed["raw_html_len"],
                }),
            ),
        )
        return cur.fetchone()[0]


def insert_deficiencies(
    conn: psycopg.Connection,
    inspection_id: str,
    deficiencies: list[dict[str, Any]],
) -> None:
    with conn.cursor() as cur:
        for d in deficiencies:
            cur.execute(
                """
                INSERT INTO deficiencies (
                    inspection_id,
                    code, category,
                    severity, class,
                    immediate_jeopardy,
                    description, inspector_narrative,
                    cited_date
                ) VALUES (
                    %s,
                    %s, %s,
                    %s, %s,
                    %s,
                    %s, %s,
                    %s
                )
                """,
                (
                    inspection_id,
                    d["section"],          # code = regulation section
                    d["section"],          # category = same (will enrich later)
                    d["severity"],
                    d["class"],            # "Type A" or "Type B"
                    d["immediate_jeopardy"],
                    d["regulatory_text"][:4000] or None,
                    d["deficiency_statement"][:8000] or None,
                    None,                  # cited_date — set from report date in update below
                ),
            )


def promote_memory_care(
    conn: psycopg.Connection, facility_id: str, fac_name: str
) -> None:
    """Mark a facility as memory-care based on §87705/87706 citation evidence."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE facilities SET
                serves_memory_care      = true,
                care_category           = CASE
                    WHEN care_category IN ('ccrc') THEN care_category
                    ELSE 'rcfe_memory_care'
                END,
                memory_care_designation = COALESCE(
                    memory_care_designation,
                    ''
                ) || ' | Cited under §87705/§87706 (dementia care)',
                publishable             = CASE
                    WHEN license_status = 'LICENSED' THEN true
                    ELSE publishable
                END,
                updated_at              = now()
            WHERE id = %s
            AND (serves_memory_care = false OR serves_memory_care IS NULL)
            """,
            (facility_id,),
        )
    print(f"    ⇧ Promoted to memory-care: {fac_name}")


# ---------------------------------------------------------------------------
# Per-facility processing
# ---------------------------------------------------------------------------


def process_facility(
    facility: dict[str, Any],
    conn: psycopg.Connection,
    scrape_run_id: str,
    dry_run: bool = False,
) -> dict[str, int]:
    fac_id = facility["id"]
    fac_name = facility["name"]
    lic_num = facility["license_number"] or ""
    fac_num = lic_num.zfill(9)

    stats = {
        "reports_seen": 0,
        "reports_ingested": 0,
        "reports_skipped": 0,
        "deficiencies": 0,
        "dementia_citations": 0,
        "errors": 0,
    }

    if not fac_num or fac_num == "000000000":
        print(f"  Skipping — no license number: {fac_name}")
        return stats

    # Fetch report index
    try:
        index_data = fetch_report_index(fac_num)
    except Exception as e:
        print(f"  ERROR fetching report index for {fac_name}: {e}")
        stats["errors"] += 1
        return stats

    count = index_data.get("COUNT", 0)
    report_array = index_data.get("REPORTARRAY", [])
    stats["reports_seen"] = count

    if count == 0:
        print(f"  {fac_name}: no reports")
        return stats

    print(f"  {fac_name}: {count} reports")

    already_ingested: set[str] = set()
    if not dry_run:
        already_ingested = get_already_ingested_urls(conn, fac_id)

    promoted = False
    for inx in range(1, count + 1):
        meta = report_array[inx - 1] if inx <= len(report_array) else {}
        source_url = (
            f"{TRANSPARENCY_BASE}/FacilityReports?facNum={fac_num}&inx={inx}"
        )

        if source_url in already_ingested:
            stats["reports_skipped"] += 1
            continue

        time.sleep(REQUEST_DELAY_SECS)

        try:
            html = fetch_report_html(fac_num, inx)
        except Exception as e:
            print(f"    inx={inx} fetch error: {e}")
            stats["errors"] += 1
            continue

        if html is None:
            # 400 = no report at this index
            continue

        parsed = parse_report(html, meta, fac_num, source_url)
        if not parsed:
            continue

        n_def = len(parsed["deficiencies"])
        rtype = parsed["inspection_type"]
        rdate = parsed["inspection_date"]

        if dry_run:
            print(
                f"    [{inx:2d}] {rtype:<12} {rdate}  "
                f"{n_def} deficiencies"
                + (" §87705/6!" if parsed["has_dementia_citation"] else "")
            )
            stats["reports_ingested"] += 1
            stats["deficiencies"] += n_def
            if parsed["has_dementia_citation"]:
                stats["dementia_citations"] += 1
            continue

        # Write to DB
        try:
            inspection_id = insert_inspection(conn, fac_id, parsed, scrape_run_id)
            insert_deficiencies(conn, inspection_id, parsed["deficiencies"])
            conn.commit()
            stats["reports_ingested"] += 1
            stats["deficiencies"] += n_def

            if parsed["has_dementia_citation"]:
                stats["dementia_citations"] += 1
                if not promoted and not facility.get("serves_memory_care"):
                    promote_memory_care(conn, fac_id, fac_name)
                    conn.commit()
                    promoted = True

        except Exception as e:
            conn.rollback()
            print(f"    inx={inx} DB error: {e}")
            stats["errors"] += 1

    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CDSS CCLD citation scraper → inspections + deficiencies"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Parse reports but do not write to DB.",
    )
    parser.add_argument(
        "--publishable", action="store_true",
        help="Only process facilities where publishable = true.",
    )
    parser.add_argument(
        "--smoke", action="store_true",
        help="Process only the first 3 facilities.",
    )
    args = parser.parse_args()

    load_env()

    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print(
            "DATABASE_URL is not set. Add your Supabase Postgres URI to .env.local.",
            file=sys.stderr,
        )
        sys.exit(1)

    dsn = os.environ.get("DATABASE_URL", "")

    # ── Load facilities ──────────────────────────────────────────────────
    with psycopg.connect(dsn) as conn:
        query = """
            SELECT id::text, name, license_number, city,
                   serves_memory_care, publishable, license_status
            FROM facilities
            WHERE state_code = 'CA'
            AND license_number IS NOT NULL
        """
        if args.publishable:
            query += " AND publishable = true"
        query += " ORDER BY city, name"

        with conn.cursor() as cur:
            cur.execute(query)
            cols = [d[0] for d in cur.description]
            facilities = [dict(zip(cols, row)) for row in cur.fetchall()]

    if args.smoke:
        facilities = facilities[:3]

    print(f"Facilities to process: {len(facilities)}")
    if args.dry_run:
        print("(DRY RUN — no DB writes)\n")

    # ── Open scrape_run ──────────────────────────────────────────────────
    scrape_run_id = "00000000-0000-0000-0000-000000000000"
    started_at = datetime.now(timezone.utc)

    if not args.dry_run:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO scrape_runs
                        (state_code, scraper_name, status, started_at)
                    VALUES (%s, %s, 'running', %s)
                    RETURNING id::text
                    """,
                    (STATE_CODE, SCRAPER_NAME, started_at),
                )
                scrape_run_id = cur.fetchone()[0]
            conn.commit()

    # ── Process each facility ────────────────────────────────────────────
    totals: dict[str, int] = {
        "reports_seen": 0,
        "reports_ingested": 0,
        "reports_skipped": 0,
        "deficiencies": 0,
        "dementia_citations": 0,
        "errors": 0,
        "facilities_processed": 0,
    }

    error_log_parts: list[str] = []

    for fac in facilities:
        print(f"\n[{totals['facilities_processed']+1}/{len(facilities)}] "
              f"{fac['name']} ({fac['city']})")

        if args.dry_run:
            stats = process_facility(fac, None, scrape_run_id, dry_run=True)
        else:
            with psycopg.connect(dsn) as conn:
                stats = process_facility(fac, conn, scrape_run_id, dry_run=False)

        for k in totals:
            if k in stats:
                totals[k] += stats[k]
        totals["facilities_processed"] += 1

        if stats["errors"]:
            error_log_parts.append(
                f"{fac['name']}: {stats['errors']} errors"
            )

    # ── Close scrape_run ─────────────────────────────────────────────────
    run_status = "success" if not error_log_parts else "partial"
    if not args.dry_run:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE scrape_runs SET
                        completed_at    = now(),
                        status          = %s,
                        records_found   = %s,
                        records_new     = %s,
                        error_log       = %s
                    WHERE id = %s::uuid
                    """,
                    (
                        run_status,
                        totals["reports_seen"],
                        totals["reports_ingested"],
                        "\n".join(error_log_parts) or None,
                        scrape_run_id,
                    ),
                )
            conn.commit()

    # ── Summary ──────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"Phase D citations ingest — {'DRY RUN' if args.dry_run else 'COMPLETE'}")
    print(f"{'='*60}")
    print(f"  Facilities processed  : {totals['facilities_processed']}")
    print(f"  Reports seen          : {totals['reports_seen']}")
    print(f"  Reports ingested      : {totals['reports_ingested']}")
    print(f"  Reports skipped       : {totals['reports_skipped']} (already in DB)")
    print(f"  Deficiencies stored   : {totals['deficiencies']}")
    print(f"  §87705/87706 citations: {totals['dementia_citations']}")
    print(f"  Errors                : {totals['errors']}")
    if not args.dry_run:
        print(f"  scrape_run id         : {scrape_run_id}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
