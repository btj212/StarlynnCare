#!/usr/bin/env python3
"""
Washington DSHS — inspection / deficiency ingest.

Loads format_version: 1 bundles from `wa_dshs_to_bundle.py` into `inspections`
+ `deficiencies` for all LICENSED Washington facilities.

Pass `--dementia-only` to keep the legacy scope (`wa_dementia_care_contract = true`).

Usage:
  python3 scrapers/wa_inspections_ingest.py --import-json path/to/bundle.json
  python3 scrapers/wa_inspections_ingest.py --import-json path/to/bundle.json --dementia-only
  python3 scrapers/wa_inspections_ingest.py --smoke
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent


def pad_license_wa(raw: Any) -> str:
    if raw is None or str(raw).strip() == "":
        return "0000000000"
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return "0000000000"
    return digits.zfill(10)


STATE_CODE = "WA"
SCRAPER_NAME = "wa_dshs_inspections"
SOURCE_AGENCY = "WA DSHS ADSA"
SMOKE_FIXTURE = SCRAPERS_DIR / "fixtures" / "wa_inspections_smoke.json"
# Bundle ingest is DB-only — no external API in the per-facility loop — so
# this delay can be near-zero for the broader ~557-facility universe.
REQUEST_DELAY_SECS = 0.1

_SEVERITY_HINTS: list[tuple[tuple[str, ...], int]] = [
    (("immediate jeopardy", "ij", "priority 1", "i/j"), 4),
    (("type a", "pattern a", "class a", "serious", "actual harm"), 3),
    (("type b", "pattern b", "class b", "potential", "lesser"), 2),
    (("type c", "class c", "no harm", "administrative"), 1),
]


def infer_severity(
    state_severity_raw: str | None,
    explicit: int | None,
    immediate_jeopardy: bool,
) -> int | None:
    if explicit is not None and 1 <= explicit <= 4:
        s = explicit
    else:
        s = None
        if state_severity_raw:
            low = state_severity_raw.lower().strip()
            for keys, val in _SEVERITY_HINTS:
                if any(k in low for k in keys):
                    s = val
                    break
    if immediate_jeopardy and (s is None or s < 4):
        s = 4
    if s is not None and (s < 1 or s > 4):
        return None
    return s


_WA_PLACEHOLDER_PREFIX = "WA DSHS report:"


def _is_wa_placeholder(desc: str) -> bool:
    """Return True when desc is the bundle-builder's PDF-link placeholder."""
    return desc.startswith(_WA_PLACEHOLDER_PREFIX)


def _narrative_from_deficiencies(deficiencies: list[dict[str, Any]]) -> str:
    """
    Concatenate real deficiency text into a narrative string for summarisation.

    Returns empty string when every deficiency is a WA PDF-link placeholder
    (description == "WA DSHS report: ..."). This prevents summarize_inspections.py
    from asking Claude to summarise a URL and fabricating findings.
    """
    parts: list[str] = []
    for d in deficiencies:
        code = (d.get("code") or "—")[:32]
        desc = (d.get("description") or d.get("inspector_narrative") or "").strip()
        if not desc or _is_wa_placeholder(desc):
            continue
        parts.append(f"{code}: {desc}")
    return "\n\n".join(parts)[:12000]


def _deficiency_dedupe_key(inspection_id: str, d: dict[str, Any]) -> str:
    code = (d.get("code") or "")[:64]
    desc = (d.get("description") or d.get("inspector_narrative") or "")[:240]
    h = hashlib.sha256(f"{inspection_id}|{code}|{desc}".encode()).hexdigest()[:32]
    return h


def final_deficiency_code(d: dict[str, Any], dedupe_key: str) -> str:
    raw = d.get("code")
    if raw is not None and str(raw).strip():
        return str(raw).strip()[:200]
    return f"__wa_{dedupe_key}"


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def fetch_target_facilities(
    conn: psycopg.Connection,
    *,
    license_filter: str | None,
    dementia_only: bool = False,
    limit: int | None,
) -> list[dict[str, Any]]:
    q = """
        SELECT id::text, name, license_number
        FROM facilities
        WHERE state_code = 'WA'
          AND license_status = 'LICENSED'
    """
    if dementia_only:
        q += " AND wa_dementia_care_contract = true"
    params: list[Any] = []
    if license_filter:
        q += " AND license_number = %s"
        params.append(pad_license_wa(license_filter))
    q += " ORDER BY license_number, name"
    if limit is not None:
        q += f" LIMIT {int(limit)}"
    with conn.cursor() as cur:
        cur.execute(q, params)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def inspection_exists(
    cur: psycopg.Cursor,
    facility_id: str,
    source_url: str,
    inspection_date: date,
) -> str | None:
    cur.execute(
        """
        SELECT id::text FROM inspections
        WHERE facility_id = %s::uuid
          AND source_url = %s
          AND inspection_date = %s
        """,
        (facility_id, source_url, inspection_date),
    )
    row = cur.fetchone()
    return str(row[0]) if row else None


def deficiency_row_exists(cur: psycopg.Cursor, inspection_id: str, code: str) -> bool:
    cur.execute(
        """
        SELECT 1 FROM deficiencies
        WHERE inspection_id = %s::uuid
          AND code = %s
        """,
        (inspection_id, code),
    )
    return cur.fetchone() is not None


def insert_inspection(
    conn: psycopg.Connection,
    facility_id: str,
    payload: dict[str, Any],
    scrape_run_id: str,
) -> str | None:
    raw = dict(payload.get("raw_data") or {})
    raw["narrative"] = payload.get("narrative") or raw.get("narrative")
    raw["outcome"] = payload.get("outcome") or raw.get("outcome")
    incident_date = _parse_date_loose(payload.get("incident_date"))
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO inspections (
                facility_id, inspection_date, incident_date, inspection_type,
                is_complaint, complaint_id,
                total_deficiency_count,
                source_url, source_agency, scrape_run_id,
                raw_data
            ) VALUES (
                %s::uuid, %s, %s, %s,
                %s, %s,
                %s,
                %s, %s, %s::uuid,
                %s
            )
            ON CONFLICT (facility_id, inspection_date, inspection_type, COALESCE(source_agency, ''))
            DO NOTHING
            RETURNING id::text
            """,
            (
                facility_id,
                payload["inspection_date"],
                incident_date,
                payload.get("inspection_type") or "standard",
                bool(payload.get("is_complaint")),
                payload.get("complaint_id"),
                int(payload.get("total_deficiency_count") or 0),
                payload["source_url"],
                SOURCE_AGENCY,
                scrape_run_id,
                psycopg.types.json.Jsonb(raw),
            ),
        )
        row = cur.fetchone()
        if row is None:
            return None  # duplicate — already exists
        return str(row[0])


def _parse_date_loose(value: Any) -> date | None:
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


def insert_deficiency(
    conn: psycopg.Connection,
    inspection_id: str,
    d: dict[str, Any],
    dedupe_key: str,
) -> None:
    state_raw = (d.get("state_severity_raw") or "").strip() or None
    ij = bool(d.get("immediate_jeopardy"))
    sev = infer_severity(state_raw, d.get("severity"), ij)
    code = final_deficiency_code(d, dedupe_key)
    desc = (d.get("description") or "")[:4000] or None
    narr = (d.get("inspector_narrative") or "")[:8000] or None
    cls = d.get("class") or state_raw
    cited = _parse_date_loose(d.get("cited_date"))
    corrected = _parse_date_loose(d.get("corrected_date"))
    status = d.get("status")
    if not status and corrected:
        status = "corrected"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO deficiencies (
                inspection_id,
                code, category,
                severity, class,
                immediate_jeopardy,
                description, inspector_narrative,
                state_severity_raw,
                cited_date, corrected_date, status
            ) VALUES (
                %s::uuid,
                %s, %s,
                %s, %s,
                %s,
                %s, %s,
                %s,
                %s, %s, %s
            )
            """,
            (
                inspection_id,
                code,
                (d.get("category") or "")[:500] or None,
                sev,
                cls,
                ij,
                desc,
                narr,
                state_raw,
                cited,
                corrected,
                status,
            ),
        )


def load_bundle(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def process_bundle_for_facility(
    conn: psycopg.Connection,
    facility: dict[str, Any],
    inspections: list[dict[str, Any]],
    scrape_run_id: str,
    dry_run: bool,
) -> dict[str, int]:
    stats = {"inspections": 0, "deficiencies": 0, "skipped": 0}
    fac_id = facility["id"]
    for insp in inspections:
        defs = insp.get("deficiencies") or []
        if not insp.get("inspection_date") or not insp.get("source_url"):
            stats["skipped"] += 1
            continue
        idate = insp["inspection_date"]
        if isinstance(idate, str):
            idate_p = date.fromisoformat(idate[:10])
        else:
            stats["skipped"] += 1
            continue

        narrative = _narrative_from_deficiencies(defs)
        payload = {
            "inspection_date": idate_p,
            "inspection_type": insp.get("inspection_type"),
            "is_complaint": insp.get("is_complaint"),
            "complaint_id": insp.get("complaint_id"),
            "source_url": insp["source_url"],
            "total_deficiency_count": len(defs),
            "raw_data": insp.get("raw_data") if isinstance(insp.get("raw_data"), dict) else {},
            "narrative": narrative or insp.get("narrative"),
            "outcome": insp.get("outcome"),
        }

        if dry_run:
            stats["inspections"] += 1
            stats["deficiencies"] += len(defs)
            continue

        assert conn is not None
        with conn.cursor() as cur:
            existing = inspection_exists(cur, fac_id, payload["source_url"], idate_p)
        if existing:
            stats["skipped"] += 1
            continue

        insp_id = insert_inspection(conn, fac_id, payload, scrape_run_id)
        if insp_id is None:
            stats["skipped"] += 1
            continue
        stats["inspections"] += 1

        for d in defs:
            dk = _deficiency_dedupe_key(insp_id, d)
            fcode = final_deficiency_code(d, dk)
            with conn.cursor() as cur:
                if deficiency_row_exists(cur, insp_id, fcode):
                    continue
            insert_deficiency(conn, insp_id, d, dk)
            stats["deficiencies"] += 1

        conn.commit()

    time.sleep(REQUEST_DELAY_SECS)
    return stats


def match_bundle_to_facilities(
    bundle: dict[str, Any],
    facilities: list[dict[str, Any]],
    *,
    dry_run: bool = False,
) -> list[tuple[dict[str, Any], list[dict[str, Any]]]]:
    if dry_run:
        out: list[tuple[dict[str, Any], list[dict[str, Any]]]] = []
        for block in bundle.get("facilities") or []:
            lic = pad_license_wa(block.get("license_number"))
            out.append(
                (
                    {
                        "id": "00000000-0000-0000-0000-000000000001",
                        "name": "(dry-run)",
                        "license_number": lic,
                    },
                    block.get("inspections") or [],
                )
            )
        return out

    by_lic = {pad_license_wa(f["license_number"]): f for f in facilities}
    out2: list[tuple[dict[str, Any], list[dict[str, Any]]]] = []
    for block in bundle.get("facilities") or []:
        lic = pad_license_wa(block.get("license_number"))
        fac = by_lic.get(lic)
        if not fac:
            print(f"  [skip] bundle license {lic} not in target facility list", file=sys.stderr)
            continue
        out2.append((fac, block.get("inspections") or []))
    return out2


def main() -> None:
    parser = argparse.ArgumentParser(description="WA DSHS inspection ingest")
    parser.add_argument("--import-json", type=str, default=None)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--license", type=str, default=None)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument(
        "--dementia-only",
        action="store_true",
        help="Limit to wa_dementia_care_contract facilities (legacy behaviour).",
    )
    args = parser.parse_args()

    load_env()
    json_path = Path(args.import_json) if args.import_json else None
    if args.smoke:
        json_path = SMOKE_FIXTURE

    if not json_path or not json_path.is_file():
        print("Provide --import-json or --smoke.", file=sys.stderr)
        sys.exit(1)

    bundle = load_bundle(json_path)
    if bundle.get("format_version") != 1:
        print("Warning: format_version != 1 — proceeding anyway.", file=sys.stderr)

    facilities: list[dict[str, Any]] = []
    if args.dry_run:
        print("(dry-run)")
    elif not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL is not set.", file=sys.stderr)
        sys.exit(1)
    else:
        with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
            facilities = fetch_target_facilities(
                conn,
                license_filter=args.license,
                limit=args.limit,
                dementia_only=args.dementia_only,
            )

    if not args.dry_run and not facilities:
        print("No WA dementia-contract LICENSED facilities matched.")
        sys.exit(0)

    paired = match_bundle_to_facilities(bundle, facilities, dry_run=args.dry_run)
    if not paired:
        print("No bundle facilities matched.", file=sys.stderr)
        sys.exit(1)

    scrape_run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    totals = {"inspections": 0, "deficiencies": 0, "skipped": 0}

    if args.dry_run:
        for fac, insp_list in paired:
            print(f"[dry-run] {fac['name']} ({fac['license_number']}): {len(insp_list)} blocks")
            st = process_bundle_for_facility(
                None, fac, insp_list, scrape_run_id, dry_run=True  # type: ignore[arg-type]
            )
            for k in totals:
                totals[k] += st[k]  # type: ignore[operator]
        print(json.dumps({"totals": totals}, indent=2))
        return

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO scrape_runs (state_code, scraper_name, status, started_at)
                VALUES (%s, %s, 'running', %s)
                RETURNING id::text
                """,
                (STATE_CODE, SCRAPER_NAME, started_at),
            )
            scrape_run_id = str(cur.fetchone()[0])
        conn.commit()

        err_parts: list[str] = []
        try:
            for fac, insp_list in paired:
                print(f"\n→ {fac['name']} | {fac['license_number']}")
                try:
                    st = process_bundle_for_facility(conn, fac, insp_list, scrape_run_id, dry_run=False)
                    for k in totals:
                        totals[k] += st[k]  # type: ignore[operator]
                    print(f"   +{st['inspections']} insp, +{st['deficiencies']} def, skipped {st['skipped']}")
                except Exception as e:  # noqa: BLE001
                    err_parts.append(f"{fac['license_number']}: {e}")
                    conn.rollback()
                    print(f"   ERROR: {e}", file=sys.stderr)
        finally:
            status = "success" if not err_parts else "partial"
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE scrape_runs SET
                        completed_at = now(),
                        status = %s,
                        records_found = %s,
                        records_new = %s,
                        error_log = %s
                    WHERE id = %s::uuid
                    """,
                    (
                        status,
                        totals["inspections"],
                        totals["inspections"],
                        "\n".join(err_parts) or None,
                        scrape_run_id,
                    ),
                )
            conn.commit()

    print(f"\nDone. scrape_run_id={scrape_run_id} totals={totals}")


if __name__ == "__main__":
    main()
