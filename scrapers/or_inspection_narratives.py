#!/usr/bin/env python3
"""
or_inspection_narratives.py — Scrape full inspector narratives from the OR LTC portal.

For each OR inspection with a stored Event ID (complaint_id), fetches:
    https://ltclicensing.oregon.gov/Inspections/Details?eventID={event_id}

Parses citation blocks (e.g. C0231, C0260) from the HTML accordion, extracting:
  - Citation code (e.g. "C0231")
  - OAR description (regulation text above the "Based on..." line)
  - Inspector narrative ("Based on interview and record review, it was determined...")
  - Plan of correction (numbered list after the narrative)

Replaces the shallow CSV-derived deficiency rows with structured data.

Usage:
    python3 scrapers/or_inspection_narratives.py --smoke          # 3 facilities, recent 3 inspections each
    python3 scrapers/or_inspection_narratives.py --facility-id <uuid>
    python3 scrapers/or_inspection_narratives.py                   # all OR inspections with event IDs
    python3 scrapers/or_inspection_narratives.py --limit 50        # first N inspections
    python3 scrapers/or_inspection_narratives.py --dry-run         # fetch + parse, no DB writes
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
import random
from pathlib import Path
from typing import Any

import psycopg
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
BASE_URL = "https://ltclicensing.oregon.gov"
DETAILS_URL = f"{BASE_URL}/Inspections/Details"
REQUEST_DELAY = 1.2  # seconds between requests — polite to ltclicensing.oregon.gov


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
            return


def get_conn() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set")
    return psycopg.connect(url)


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = "StarlynnCare-bot/1.0 (+https://starlynn.care)"
    return s


def fetch_detail_html(session: requests.Session, event_id: str) -> str | None:
    params = {"eventID": event_id, "parentController": "Providers"}
    try:
        resp = session.get(DETAILS_URL, params=params, timeout=20)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"    HTTP error for {event_id}: {e}", file=sys.stderr)
        return None


def split_narrative_and_poc(text: str) -> tuple[str, str]:
    """
    Split citation body into inspector narrative vs plan of correction.
    The PoC typically starts with a numbered list ("1. ...") after the narrative.
    """
    # PoC often follows a blank line then "1. " or "1." at line start
    poc_match = re.search(r"\n\s*1\.\s", text)
    if poc_match:
        narrative = text[:poc_match.start()].strip()
        poc = text[poc_match.start():].strip()
    else:
        narrative = text.strip()
        poc = ""
    return narrative, poc


def split_description_and_narrative(body: str) -> tuple[str, str]:
    """
    Separate the OAR regulation boilerplate from the inspector's actual finding.
    The inspector narrative always starts with 'Based on'.
    """
    based_on_match = re.search(r"Based on\s", body, re.IGNORECASE)
    if based_on_match:
        description = body[:based_on_match.start()].strip()
        rest = body[based_on_match.start():].strip()
    else:
        description = ""
        rest = body.strip()
    return description, rest


def parse_citations(html: str) -> list[dict[str, Any]]:
    """
    Parse all citation accordion blocks from inspection detail HTML.
    Returns list of dicts with: code, description, inspector_narrative, plan_of_correction.
    """
    soup = BeautifulSoup(html, "html.parser")
    citations: list[dict[str, Any]] = []

    # Citation blocks are <div id="tagCXXXX" class="collapse" ...>
    for div in soup.find_all("div", id=re.compile(r"^tag[A-Z]\d+")):
        raw_id = div.get("id", "")
        # e.g. "tagC0231" → "C0231"
        code = raw_id.replace("tag", "", 1)

        # Get all text, preserving paragraph breaks
        paragraphs = [p.get_text(separator=" ", strip=True) for p in div.find_all("p")]
        if not paragraphs:
            # Fallback: raw text
            raw = div.get_text(separator="\n", strip=True)
        else:
            raw = "\n\n".join(paragraphs)

        description, rest = split_description_and_narrative(raw)
        narrative, poc = split_narrative_and_poc(rest)

        citations.append({
            "code": code,
            "description": description[:2000] if description else None,
            "inspector_narrative": narrative[:8000] if narrative else None,
            "plan_of_correction": poc[:4000] if poc else None,
        })

    return citations


def upsert_citations(
    conn: psycopg.Connection,
    inspection_id: str,
    citations: list[dict[str, Any]],
    dry_run: bool,
) -> int:
    """Delete existing CSV-derived deficiencies, insert parsed ones, and
    backfill inspections.raw_data.narrative so the summarizer can run.
    Returns count inserted."""
    import json as _json

    if not citations:
        return 0
    if dry_run:
        for c in citations:
            print(f"      [{c['code']}] narrative={repr(str(c['inspector_narrative'])[:80])}")
        return len(citations)

    # Concatenate all inspector narratives for the inspection-level summary.
    combined_narrative = "\n\n".join(
        c["inspector_narrative"] for c in citations if c.get("inspector_narrative")
    )

    with conn.cursor() as cur:
        cur.execute("SAVEPOINT sp_narr")
        try:
            # Remove shallow CSV-derived rows — they have no inspector_narrative
            cur.execute(
                "DELETE FROM deficiencies WHERE inspection_id = %s AND inspector_narrative IS NULL",
                (inspection_id,),
            )
            for c in citations:
                cur.execute("""
                    INSERT INTO deficiencies (
                        inspection_id, code, description,
                        inspector_narrative, plan_of_correction,
                        state_severity_raw
                    ) VALUES (
                        %s, %s, %s, %s, %s, 'OR-cited'
                    )
                """, (
                    inspection_id,
                    c["code"],
                    c["description"],
                    c["inspector_narrative"],
                    c["plan_of_correction"],
                ))
            # Backfill inspections.raw_data.narrative so summarize_inspections.py can run
            if combined_narrative:
                cur.execute(
                    """UPDATE inspections
                       SET raw_data = COALESCE(raw_data, '{}'::jsonb) || %s::jsonb
                       WHERE id = %s""",
                    (_json.dumps({"narrative": combined_narrative}), inspection_id),
                )
            cur.execute("RELEASE SAVEPOINT sp_narr")
        except Exception as exc:
            cur.execute("ROLLBACK TO SAVEPOINT sp_narr")
            cur.execute("RELEASE SAVEPOINT sp_narr")
            raise exc

    return len(citations)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="3 publishable facilities, 3 recent inspections each")
    parser.add_argument("--publishable-only", action="store_true", help="Only process inspections for publishable facilities")
    parser.add_argument("--facility-id", help="Single facility UUID")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true", help="Fetch + parse but no DB writes")
    args = parser.parse_args()

    load_env()
    conn = get_conn()
    session = make_session()

    # Build query for inspections that have Event IDs
    where = ["i.source_agency = 'OR-ODHS'", "i.complaint_id IS NOT NULL"]
    params: list[Any] = []

    if args.facility_id:
        where.append("f.id = %s")
        params.append(args.facility_id)
    elif args.smoke or args.publishable_only:
        where.append("f.publishable = true")

    order = "ORDER BY f.name, i.inspection_date DESC"
    limit_sql = ""
    if args.smoke:
        limit_sql = "LIMIT 9"  # 3 facilities × 3 inspections roughly
    elif args.limit:
        limit_sql = f"LIMIT {args.limit}"

    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT i.id, i.complaint_id, i.inspection_date, i.inspection_type,
                   f.name, f.external_id
            FROM inspections i
            JOIN facilities f ON f.id = i.facility_id
            WHERE {" AND ".join(where)}
            {order}
            {limit_sql}
        """, params)
        inspections = cur.fetchall()

    print(f"Inspections to process: {len(inspections)}")
    if not inspections:
        print("Nothing to do — run or_backfill_event_ids.py first.")
        return

    ok = empty = fail = 0

    for insp_id, event_id, insp_date, insp_type, fac_name, ext_id in inspections:
        print(f"\n→ {fac_name[:50]} | {event_id} | {insp_date} | {insp_type}")

        html = fetch_detail_html(session, event_id)
        if not html:
            fail += 1
            continue

        citations = parse_citations(html)
        print(f"  Found {len(citations)} citations")

        if not citations:
            empty += 1
            # Inspection with 0 deficiencies — that's valid (clean inspection)
            time.sleep(REQUEST_DELAY + random.random() * 0.3)
            continue

        try:
            n = upsert_citations(conn, str(insp_id), citations, args.dry_run)
            if not args.dry_run:
                conn.commit()
            print(f"  {'[dry-run] parsed' if args.dry_run else 'Stored'} {n} citations")
            ok += 1
        except Exception as exc:
            print(f"  DB error: {exc}", file=sys.stderr)
            fail += 1

        time.sleep(REQUEST_DELAY + random.random() * 0.3)

    print(f"\nDone — ok: {ok}, clean (0 citations): {empty}, failed: {fail}")


if __name__ == "__main__":
    main()
