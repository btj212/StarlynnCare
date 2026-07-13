#!/usr/bin/env python3
"""Export one state-scan ledger entry as JSON and a Markdown summary."""

from __future__ import annotations

import argparse
import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parents[1]


def _json_default(value: Any) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def main() -> int:
    parser = argparse.ArgumentParser(description="Export State Watch scan report")
    parser.add_argument("--scan-run-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    load_dotenv(REPO_ROOT / ".env.local")
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")

    with psycopg.connect(url, row_factory=dict_row) as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM state_scan_runs WHERE id = %s", (args.scan_run_id,))
        run = cur.fetchone()
        if not run:
            raise RuntimeError(f"State scan run not found: {args.scan_run_id}")
        cur.execute(
            """
            SELECT source, status, records_before, records_after, watermark, error
            FROM state_scan_sources
            WHERE scan_run_id = %s
            ORDER BY started_at, source
            """,
            (args.scan_run_id,),
        )
        sources = cur.fetchall()
        cur.execute(
            """
            SELECT change_type, summary, fingerprint
            FROM state_scan_facility_deltas
            WHERE scan_run_id = %s
            ORDER BY created_at
            """,
            (args.scan_run_id,),
        )
        changes = cur.fetchall()

    report = {
        "run": dict(run),
        "sources": [dict(row) for row in sources],
        "changes": [dict(row) for row in changes],
    }
    args.output.write_text(json.dumps(report, indent=2, default=_json_default))

    print(f"## {run['state_code']} State Watch scan")
    print()
    print(f"- Status: **{run['status']}**")
    print(f"- Material family-facing changes: **{run['changes_detected']}**")
    print(f"- Facilities: {run['facilities_before']} → {run['facilities_after']}")
    print(f"- Inspections: {run['inspections_before']} → {run['inspections_after']}")
    print(f"- Citations: {run['deficiencies_before']} → {run['deficiencies_after']}")
    print()
    print("### Sources")
    for source in sources:
        suffix = f" — {source['error']}" if source["error"] else ""
        print(f"- `{source['source']}`: **{source['status']}**{suffix}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
