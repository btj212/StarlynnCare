#!/usr/bin/env python3
"""Fill Washington adult-family-home inspections from DSHS reports.

A live page fails the inspection gate when it has no row with a date, a
source URL, and a citation count. DSHS posts those reports on the forms
page. This script reads the PDF, keeps the row only when the license on
the report matches the roster, and stores the cited-WAC count. A scanned
file with no text is skipped. It is not stored as zero.

Dry-run is the default. It does not write the database.

    python3 scrapers/backfill_wa_inspection_gate.py
    python3 scrapers/backfill_wa_inspection_gate.py --apply

--apply is the write. Blake runs that after reading the dry-run.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS = Path(__file__).resolve().parent
if str(SCRAPERS) not in sys.path:
    sys.path.insert(0, str(SCRAPERS))

from wa_report_parse import (  # noqa: E402
    license_in_pdf_url,
    parse_wa_report,
    posted_month_date,
    same_license,
)

CACHE = Path("/tmp/wa-gate-pdfs")
AGENCY = "WA DSHS ADSA"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"


def load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            return


def database_url() -> str | None:
    return os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")


def load_reports_from_db() -> tuple[list[dict[str, Any]], int]:
    import psycopg
    from psycopg.rows import dict_row

    url = database_url()
    if not url:
        sys.exit("DATABASE_URL is not set. Dry-run reads the database and does not write it.")
    with psycopg.connect(url, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH missing AS (
                    SELECT f.id, f.license_number
                    FROM facilities f
                    WHERE f.publishable
                      AND f.state_code = 'WA'
                      AND f.facility_type = 'AFH'
                      AND NOT EXISTS (
                          SELECT 1 FROM inspections i WHERE i.facility_id = f.id
                      )
                )
                SELECT
                    (SELECT count(*) FROM missing) AS failing,
                    m.license_number,
                    w.source_url,
                    w.posted_month,
                    w.doc_type
                FROM wa_pdf_inventory w
                JOIN missing m ON m.id = w.facility_id
                WHERE w.doc_type IN ('inspection', 'investigation')
                  AND w.posted_month ~ '^[0-9]{4}-[0-9]{2}$'
                  AND w.source_url ILIKE '%.pdf'
                ORDER BY m.license_number, w.posted_month DESC
                """
            )
            rows = list(cur.fetchall())
    failing = int(rows[0]["failing"]) if rows else 0
    if not rows:
        with psycopg.connect(url, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT count(*) AS failing
                    FROM facilities f
                    WHERE f.publishable AND f.state_code = 'WA' AND f.facility_type = 'AFH'
                      AND NOT EXISTS (SELECT 1 FROM inspections i WHERE i.facility_id = f.id)
                    """
                )
                failing = int(cur.fetchone()["failing"])
    reports = [
        {
            "license_number": row["license_number"],
            "source_url": row["source_url"],
            "posted_month": row["posted_month"],
            "doc_type": row["doc_type"],
        }
        for row in rows
    ]
    return reports, failing


def pdf_text(path: Path) -> str:
    import pdfplumber

    with pdfplumber.open(str(path)) as pdf:
        return "\n".join((page.extract_text() or "") for page in pdf.pages)


def cache_path(url: str) -> Path:
    digest = hashlib.sha256(url.encode()).hexdigest()[:24]
    return CACHE / f"{digest}.pdf"


def download(url: str) -> Path | None:
    dest = cache_path(url)
    if dest.is_file() and dest.stat().st_size > 0:
        return dest
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error: Exception | None = None
    for _attempt in range(2):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                dest.write_bytes(response.read())
            last_error = None
            break
        except Exception as exc:
            last_error = exc
    if last_error is not None:
        print(f"  fetch failed {url[:80]}: {last_error}", file=sys.stderr)
        return None
    if not dest.is_file() or dest.stat().st_size == 0:
        return None
    return dest


def read_report(row: dict[str, Any]) -> dict[str, Any] | None:
    """One posted PDF. None when the license disagrees or the text has no count."""
    path = download(row["source_url"])
    if path is None:
        return None
    try:
        text = pdf_text(path)
    except Exception as exc:
        print(f"  unreadable {row['source_url'][:80]}: {exc}", file=sys.stderr)
        return None
    parsed = parse_wa_report(text)
    folder = license_in_pdf_url(row["source_url"])
    if folder and not same_license(row["license_number"], folder):
        return None
    if parsed.license_digits and not same_license(row["license_number"], parsed.license_digits):
        return None
    if parsed.citation_count is None:
        return None
    when = parsed.inspection_date or posted_month_date(row.get("posted_month"))
    if when is None:
        return None
    return {
        "license_number": row["license_number"],
        "inspection_date": when.isoformat(),
        "citation_count": parsed.citation_count,
        "source_url": row["source_url"],
        "doc_type": row["doc_type"],
        "citations": [{"code": code, "description": title} for code, title in parsed.citations],
        "date_source": "report" if parsed.inspection_date else "posted_month",
    }


def group_reports(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[row["license_number"]].append(row)
    for license_number in grouped:
        grouped[license_number].sort(key=lambda item: item.get("posted_month") or "", reverse=True)
    return grouped


def passing_for_license(license_number: str, reports: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The newest posted report whose text yields a date, URL, and count."""
    for report in reports[:3]:
        found = read_report({**report, "license_number": license_number})
        if found:
            return found
    return None


def plan(rows: list[dict[str, Any]], workers: int) -> list[dict[str, Any]]:
    grouped = group_reports(rows)
    found: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(passing_for_license, license_number, reports): license_number
            for license_number, reports in grouped.items()
        }
        done = 0
        for future in as_completed(futures):
            done += 1
            result = future.result()
            if result:
                found.append(result)
            if done % 25 == 0:
                print(f"  read {done} of {len(futures)} homes", file=sys.stderr)
    found.sort(key=lambda item: item["license_number"])
    return found


def print_plan(found: list[dict[str, Any]], failing: int | None, candidates: int) -> None:
    newest = max((item["inspection_date"] for item in found), default=None)
    print(f"WA live pages failing before: {failing if failing is not None else 'unknown'}")
    print(f"WA facilities with a posted inspection or investigation PDF: {candidates}")
    print(f"WA facilities that would gain a passing inspection: {len(found)}")
    print(f"WA newest date among those inspections: {newest or 'none'}")
    if failing is not None:
        print(f"WA live pages still failing after: {failing - len(found)}")
    for item in found:
        print(
            f"  {item['license_number']}  {item['inspection_date']}  "
            f"citations={item['citation_count']}  {item['doc_type']}  {item['source_url']}"
        )


def apply_plan(found: list[dict[str, Any]]) -> None:
    import psycopg

    url = database_url()
    if not url:
        sys.exit("DATABASE_URL is not set. Refusing to write.")
    written = 0
    with psycopg.connect(url, autocommit=False) as conn:
        with conn.cursor() as cur:
            for item in found:
                cur.execute(
                    """
                    SELECT id::text FROM facilities
                    WHERE state_code = 'WA' AND license_number = %s
                    """,
                    (item["license_number"],),
                )
                facility = cur.fetchone()
                if not facility:
                    print(f"  skip {item['license_number']}: license is not on a facility row")
                    continue
                event_id = "wa-pdf-" + hashlib.sha256(item["source_url"].encode()).hexdigest()[:24]
                inspection_type = "complaint" if item["doc_type"] == "investigation" else "standard"
                cur.execute(
                    """
                    SELECT id::text FROM inspections
                    WHERE source_agency = %s AND source_event_id = %s
                    """,
                    (AGENCY, event_id),
                )
                existing = cur.fetchone()
                raw = {
                    "washington": True,
                    "date_source": item["date_source"],
                    "doc_type": item["doc_type"],
                    "pdf_url": item["source_url"],
                }
                if existing:
                    cur.execute(
                        """
                        UPDATE inspections
                        SET inspection_date = %s,
                            total_deficiency_count = %s,
                            source_url = %s,
                            raw_data = coalesce(raw_data, '{}'::jsonb) || %s::jsonb
                        WHERE id = %s::uuid
                        """,
                        (
                            item["inspection_date"],
                            item["citation_count"],
                            item["source_url"],
                            json.dumps(raw),
                            existing[0],
                        ),
                    )
                    inspection_id = existing[0]
                else:
                    cur.execute(
                        """
                        INSERT INTO inspections (
                            facility_id, inspection_date, inspection_type, is_complaint,
                            total_deficiency_count, source_url, source_agency,
                            source_event_id, raw_data
                        ) VALUES (
                            %s::uuid, %s, %s, %s,
                            %s, %s, %s,
                            %s, %s::jsonb
                        )
                        RETURNING id::text
                        """,
                        (
                            facility[0],
                            item["inspection_date"],
                            inspection_type,
                            inspection_type == "complaint",
                            item["citation_count"],
                            item["source_url"],
                            AGENCY,
                            event_id,
                            json.dumps(raw),
                        ),
                    )
                    inspection_id = cur.fetchone()[0]
                for citation in item["citations"]:
                    cur.execute(
                        """
                        INSERT INTO deficiencies (inspection_id, code, description)
                        SELECT %s::uuid, %s, %s
                        WHERE NOT EXISTS (
                            SELECT 1 FROM deficiencies
                            WHERE inspection_id = %s::uuid AND code = %s
                        )
                        """,
                        (
                            inspection_id,
                            citation["code"],
                            citation["description"] or None,
                            inspection_id,
                            citation["code"],
                        ),
                    )
                written += 1
        conn.commit()
    print(f"WA wrote {written} inspections. This did not publish or unpublish any page.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Washington inspection-gate backfill")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write inspections. Omit this flag to dry-run.",
    )
    parser.add_argument("--inventory", help="JSON list of posted reports, instead of the database")
    parser.add_argument(
        "--failing",
        type=int,
        help="Live pages already known to fail, when --inventory is used instead of the database",
    )
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    load_env()
    CACHE.mkdir(parents=True, exist_ok=True)

    failing: int | None
    if args.inventory:
        rows = json.loads(Path(args.inventory).read_text())
        failing = args.failing
    else:
        rows, failing = load_reports_from_db()
    candidates = len({row["license_number"] for row in rows})
    found = plan(rows, max(1, args.workers))
    print_plan(found, failing, candidates)
    if args.apply:
        apply_plan(found)
    else:
        print("Dry-run only. No database writes. Re-run with --apply to store these rows.")


if __name__ == "__main__":
    main()
