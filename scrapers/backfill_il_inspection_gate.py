#!/usr/bin/env python3
"""Set Illinois citation counts from the FOIA visit file.

The guest LLCS lookup returns the roster and the license. It does not
return a survey PDF or a per-visit URL. This script stores the citation
count (zero when the cell says there was no violation) and leaves
source_url empty. A page still fails the gate until a real document URL
exists. Do not copy the facility-lookup shell onto the inspection.

Dry-run is the default.

    python3 scrapers/backfill_il_inspection_gate.py
    python3 scrapers/backfill_il_inspection_gate.py --apply
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS = Path(__file__).resolve().parent
if str(SCRAPERS) not in sys.path:
    sys.path.insert(0, str(SCRAPERS))

from il_foia_parse import citation_count_from_tags  # noqa: E402

AGENCY = "IDPH-DAL"


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


def database_url() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        sys.exit("DATABASE_URL is not set. Dry-run reads the database and does not write it.")
    return url


def load_rows() -> list[dict]:
    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    f.id::text AS facility_id,
                    f.license_number,
                    i.id::text AS inspection_id,
                    i.inspection_date,
                    i.source_event_id,
                    i.total_deficiency_count,
                    btrim(coalesce(i.source_url, '')) AS source_url,
                    coalesce(s.raw->>'tags', '') AS tags,
                    (SELECT count(*) FROM deficiencies d WHERE d.inspection_id = i.id) AS stored_defs
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                LEFT JOIN il_source_rows s
                  ON s.source = 'foia_visits'
                 AND s.raw->>'visit_id' = i.source_event_id
                WHERE f.publishable
                  AND f.state_code = 'IL'
                  AND i.source_agency = %s
                """,
                (AGENCY,),
            )
            return list(cur.fetchall())


def is_document_url(url: str) -> bool:
    """A survey document. The LLCS lookup shell is not one.

    Guest FacilitySearchLookupHomePage.getFaciliyResult and
    LLCS_LicensePageUnauth.getLicenseResult return the roster and licId.
    They do not return a PDF. il_llcs_documents refuses the same shell.
    """
    lowered = (url or "").strip().lower()
    if not lowered.startswith(("https://", "http://")):
        return False
    return "/s/?" not in lowered and not lowered.rstrip("/").endswith("/s")


def count_for_row(row: dict) -> int | None:
    """Stored deficiency rows win. Otherwise read the FOIA cell. Blank stays unknown."""
    stored = int(row["stored_defs"] or 0)
    if stored:
        return stored
    return citation_count_from_tags(row.get("tags") or "", row.get("source_event_id") or "visit")


def _iso(value: object) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        return value[:10]
    iso = getattr(value, "isoformat", None)
    if callable(iso):
        return str(iso())[:10]
    return str(value)[:10]


def summarize(rows: list[dict]) -> dict[str, dict]:
    """One entry per live facility. A shell URL does not count as a document."""
    homes: dict[str, dict] = {}
    for row in rows:
        key = str(row.get("facility_id") or row.get("license_number") or "")
        count = count_for_row(row)
        known_now = row.get("total_deficiency_count") is not None
        known_after = known_now or count is not None
        url = (row.get("source_url") or "").strip()
        dated = _iso(row.get("inspection_date")) is not None
        current = homes.setdefault(
            key,
            {
                "license_number": row.get("license_number"),
                "passes_now": False,
                "would_pass_literal": False,
                "would_pass_document": False,
                "with_count": False,
                "would_pass_visit": False,
                "shell_only": False,
                "newest": None,
            },
        )
        visit = str(row.get("source_event_id") or "").strip()
        if dated and known_after and visit:
            current["would_pass_visit"] = True
        if dated and known_now and url:
            current["passes_now"] = True
        if dated and known_after and url:
            current["would_pass_literal"] = True
            if is_document_url(url):
                current["would_pass_document"] = True
            else:
                current["shell_only"] = True
        if known_after:
            current["with_count"] = True
        iso = _iso(row.get("inspection_date"))
        if iso and (current["newest"] is None or iso > current["newest"]):
            current["newest"] = iso
    return homes


def main() -> None:
    parser = argparse.ArgumentParser(description="Illinois inspection-gate backfill")
    parser.add_argument("--apply", action="store_true", help="Write citation counts. Omit to dry-run.")
    parser.add_argument("--rows", help="JSON export of the dry-run query, instead of the database")
    args = parser.parse_args()
    load_env()
    if args.rows:
        rows = json.loads(Path(args.rows).read_text())
    else:
        rows = load_rows()
    homes = summarize(rows)
    before = sum(1 for item in homes.values() if item["passes_now"])
    literal = sum(1 for item in homes.values() if item["would_pass_literal"])
    document = sum(1 for item in homes.values() if item["would_pass_document"])
    counted = sum(1 for item in homes.values() if item["with_count"])
    shells = sum(1 for item in homes.values() if item["shell_only"] and not item["would_pass_document"])
    newest = max((item["newest"] for item in homes.values() if item["newest"]), default=None)
    print(f"IL live pages: {len(homes)}")
    print(f"IL passing before: {before}")
    print(f"IL that would pass the current gate after storing the citation count: {literal}")
    print(f"IL of those whose only URL is the LLCS lookup shell: {shells}")
    print(f"IL that would pass with a survey document URL: {document}")
    print(f"IL live pages that would have a known citation count: {counted}")
    visit_pass = sum(1 for item in homes.values() if item["would_pass_visit"])
    print(f"IL live pages that would pass with a date, a citation count, and a visit id: {visit_pass}")
    print(f"IL newest inspection date: {newest}")
    missing_visit = sum(1 for row in rows if not str(row.get("source_event_id") or "").strip())
    print(f"IL inspections missing a visit id: {missing_visit}")
    print(
        "IL source URL: not stored. "
        "The guest lookup returns the roster and licId, not a survey document. "
        "The FOIA visit id is already stored in source_event_id. "
        "The gate accepts an Illinois inspection when the date, the citation count "
        "(zero allowed), and that visit id are present."
    )
    gained = [item for item in homes.values() if item["would_pass_literal"] and not item["passes_now"]]
    for item in sorted(gained, key=lambda row: str(row["license_number"] or "")):
        print(f"  {item['license_number']}  newest={item['newest']}  url=llcs-lookup-shell")
    if args.apply and args.rows:
        sys.exit("Refusing --apply with --rows. Writing uses the database, not a snapshot file.")
    if not args.apply:
        print("Dry-run only. No database writes. Re-run with --apply to store the counts.")
        return

    import psycopg

    updates = []
    for row in rows:
        if row["total_deficiency_count"] is not None:
            continue
        count = count_for_row(row)
        if count is None:
            continue
        updates.append((count, row["inspection_id"]))
    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.executemany(
                """
                UPDATE inspections
                SET total_deficiency_count = %s
                WHERE id = %s::uuid
                  AND total_deficiency_count IS NULL
                """,
                updates,
            )
        conn.commit()
    print(
        f"IL updated {len(updates)} inspection counts. "
        "Visit ids already in source_event_id were left unchanged. No source URL was written."
    )


if __name__ == "__main__":
    main()
