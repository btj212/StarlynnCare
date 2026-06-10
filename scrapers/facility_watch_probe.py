#!/usr/bin/env python3
"""
Facility Watch PROBE — read-only reconnaissance. No DB writes, no ingest, no alerts.

Downloads fresh regulator exports (filesystem only), compares against the current
DB snapshot for a watched facility, optionally hits the OR portal + news search,
and prints a JSON report to stdout.

Use this to decide what belongs in the real pipeline before applying migration
0049 or wiring CI.

Usage:
  python3 scrapers/facility_watch_probe.py --facility-id 3d1adb64-06f8-4d5f-aa87-c33f2ad038bc
  python3 scrapers/facility_watch_probe.py --facility-id UUID --skip-export --skip-news
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

OR_SCRAPE_DIR = REPO_ROOT / ".firecrawl" / "or-scrape"
OR_PROVIDER_ID_COL = "Provider ID"
OR_PROVIDERS_ID_COL = "ID"

_STATE_SLUG = {
    "CA": "california", "OR": "oregon", "WA": "washington",
    "MN": "minnesota", "TX": "texas", "UT": "utah", "IL": "illinois", "PA": "pennsylvania",
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
        raise RuntimeError("DATABASE_URL not set")
    return psycopg.connect(url)


def filter_csv_by_id(csv_path: Path, id_col: str, external_id: str) -> list[dict[str, str]]:
    if not csv_path.is_file():
        return []
    out: list[dict[str, str]] = []
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            raw = (row.get(id_col) or "").strip()
            if raw.upper() == external_id.upper():
                out.append({k: (v or "").strip() for k, v in row.items()})
    return out


def latest_csv(prefix: str) -> Path | None:
    if not OR_SCRAPE_DIR.is_dir():
        return None
    matches = sorted(OR_SCRAPE_DIR.glob(f"{prefix}-*.csv"), reverse=True)
    return matches[0] if matches else None


def load_facility(conn: psycopg.Connection, facility_id: str) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::text, name, slug, city, city_slug, state_code, external_id,
                   license_status, mce_endorsed, mce_evidence, enhanced_oversight,
                   has_inspection_text, publishable, updated_at
            FROM facilities WHERE id = %s
            """,
            (facility_id,),
        )
        row = cur.fetchone()
        if not row:
            raise SystemExit(f"Facility not found: {facility_id}")
        cols = [
            "id", "name", "slug", "city", "city_slug", "state_code", "external_id",
            "license_status", "mce_endorsed", "mce_evidence", "enhanced_oversight",
            "has_inspection_text", "publishable", "updated_at",
        ]
        return dict(zip(cols, row, strict=True))


def db_inspections(conn: psycopg.Connection, facility_id: str) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT inspection_date::text, inspection_type, complaint_id, total_deficiency_count,
                   LENGTH(COALESCE(raw_data->>'narrative', '')) AS narrative_len,
                   narrative_summary IS NOT NULL AS has_summary
            FROM inspections WHERE facility_id = %s ORDER BY inspection_date DESC
            """,
            (facility_id,),
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r, strict=True)) for r in cur.fetchall()]


def db_watchers(conn: psycopg.Connection, facility_id: str) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT email, confirmed_at, created_at, source FROM facility_watchers WHERE facility_id = %s",
            (facility_id,),
        )
        cols = [d[0] for d in cur.description]
        return [
            {
                **dict(zip(cols, r, strict=True)),
                "confirmed_at": r[1].isoformat() if r[1] else None,
                "created_at": r[2].isoformat() if r[2] else None,
            }
            for r in cur.fetchall()
        ]


def probe_or_portal(event_ids: list[str]) -> list[dict]:
    """Fetch inspection detail pages — read only, no DB."""
    import random
    import time

    import requests
    from bs4 import BeautifulSoup

    DETAILS = "https://ltclicensing.oregon.gov/Inspections/Details"
    session = requests.Session()
    session.headers["User-Agent"] = "StarlynnCare-bot/1.0 (+https://starlynn.care)"
    results = []
    for eid in event_ids[:10]:
        try:
            resp = session.get(DETAILS, params={"eventID": eid, "parentController": "Providers"}, timeout=20)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            citation_blocks = soup.select(".citation, .violation, [class*='citation']")
            results.append({
                "event_id": eid,
                "http_status": resp.status_code,
                "citation_blocks_found": len(citation_blocks),
                "page_chars": len(resp.text),
            })
        except Exception as exc:  # noqa: BLE001
            results.append({"event_id": eid, "error": str(exc)})
        time.sleep(1.2 + random.random() * 0.3)
    return results


def probe_news(facility: dict) -> dict:
    if not os.environ.get("FIRECRAWL_API_KEY"):
        return {"skipped": True, "reason": "FIRECRAWL_API_KEY not set"}
    try:
        from _firecrawl import fc_search
        query = (
            f'"{facility["name"]}" "{facility["city"]}" Oregon '
            "(lawsuit OR fined OR violation OR inspection OR complaint)"
        )
        hits = fc_search(query, num_results=5)
        return {"query": query, "hits": hits}
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}


def compare_csv_vs_db(csv_rows: list[dict], db_rows: list[dict], date_col: str, id_col: str) -> dict:
    csv_dates = sorted({r.get(date_col, "") for r in csv_rows if r.get(date_col)})
    db_dates = sorted({r["inspection_date"] for r in db_rows})
    csv_ids = {r.get(id_col, "") for r in csv_rows if r.get(id_col)}
    db_ids = {r["complaint_id"] for r in db_rows if r.get("complaint_id")}
    return {
        "csv_row_count": len(csv_rows),
        "db_row_count": len(db_rows),
        "csv_only_event_ids": sorted(csv_ids - db_ids),
        "db_only_event_ids": sorted(db_ids - csv_ids),
        "csv_dates": csv_dates,
        "db_dates": db_dates,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Facility Watch read-only probe")
    parser.add_argument("--facility-id", required=True)
    parser.add_argument("--skip-export", action="store_true", help="Use latest CSVs on disk")
    parser.add_argument("--skip-news", action="store_true")
    parser.add_argument("--skip-portal", action="store_true", help="Skip OR portal detail fetches")
    args = parser.parse_args()

    load_env()
    conn = get_conn()
    facility = load_facility(conn, args.facility_id)

    report: dict[str, Any] = {
        "probed_at": datetime.now(timezone.utc).isoformat(),
        "mode": "read_only",
        "facility": facility,
        "profile_url": (
            f"{os.environ.get('NEXT_PUBLIC_SITE_URL', 'https://www.starlynncare.com').rstrip('/')}"
            f"/{_STATE_SLUG.get(facility['state_code'], facility['state_code'].lower())}"
            f"/{facility['city_slug']}/{facility['slug']}"
        ),
        "watchers": db_watchers(conn, args.facility_id),
        "sources": {},
        "pipeline_notes": [],
    }

    if not args.skip_export and facility["state_code"] == "OR":
        print("Downloading OR CSV exports…", file=sys.stderr)
        subprocess.run(
            [sys.executable, "scrapers/or_ltc_csv_export.py"],
            cwd=REPO_ROOT,
            check=False,
        )

    db_insp = db_inspections(conn, args.facility_id)
    report["db_inspections"] = db_insp

    if facility["state_code"] == "OR":
        exports = {
            "providers": (latest_csv("providers"), OR_PROVIDERS_ID_COL),
            "inspections": (latest_csv("inspections"), OR_PROVIDER_ID_COL),
            "violations": (latest_csv("violations"), OR_PROVIDER_ID_COL),
            "regulatory_actions": (latest_csv("regulatory_actions"), OR_PROVIDER_ID_COL),
        }
        for name, (path, id_col) in exports.items():
            rows = filter_csv_by_id(path, id_col, facility["external_id"]) if path else []
            entry: dict[str, Any] = {
                "csv_file": str(path) if path else None,
                "row_count": len(rows),
                "rows": rows,
            }
            if name == "inspections":
                entry["diff_vs_db"] = compare_csv_vs_db(
                    rows, db_insp, "Date", "Event ID",
                )
            report["sources"][name] = entry

        report["sources"]["federal_cms_nh"] = {
            "applicable": False,
            "reason": "OR ALF/RCF — CMS NH Compare is for licensed nursing facilities only",
        }

        event_ids = [r.get("Event ID", "") for r in report["sources"].get("inspections", {}).get("rows", []) if r.get("Event ID")]
        if not args.skip_portal and event_ids:
            print(f"Probing {len(event_ids)} OR portal detail pages…", file=sys.stderr)
            report["sources"]["or_portal_details"] = probe_or_portal(event_ids)

        if not args.skip_news:
            print("Probing news search…", file=sys.stderr)
            report["sources"]["news"] = probe_news(facility)

        # Actionable deltas
        diff = report["sources"].get("inspections", {}).get("diff_vs_db", {})
        if diff.get("csv_only_event_ids"):
            report["pipeline_notes"].append(
                f"NEW inspections on regulator CSV not in DB: {diff['csv_only_event_ids']}"
            )
        if diff.get("db_only_event_ids"):
            report["pipeline_notes"].append(
                f"DB has event IDs absent from latest CSV (stale export or ID drift): {diff['db_only_event_ids']}"
            )
        if not facility.get("has_inspection_text"):
            report["pipeline_notes"].append("Page would show 'PDF links only' banner — narratives missing")
        for w in report["watchers"]:
            if not w.get("confirmed_at"):
                report["pipeline_notes"].append(
                    f"Watcher {w['email']} not confirmed — would not receive alerts until auto-confirm ships"
                )

    conn.close()
    print(json.dumps(report, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
