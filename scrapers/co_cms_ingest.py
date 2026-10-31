#!/usr/bin/env python3
"""Load Colorado CMS nursing homes as their own care setting.

This does not call the shared CMS upsert. That upsert matches any CCN and
overwrites the facility name and city. Here a nursing home stays a nursing
home, and an assisted living residence is never updated from a CMS row.

Usage:
    python3 -u scrapers/co_cms_ingest.py directory --dry-run
    python3 -u scrapers/co_cms_ingest.py directory
    python3 -u scrapers/co_cms_ingest.py deficiencies --dry-run
    python3 -u scrapers/co_cms_ingest.py deficiencies
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.types.json import Json

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scrapers.cms_nh_deficiencies_ingest import _parse_cms_date, fetch_cms_deficiencies
from scrapers.cms_nh_directory_ingest import fetch_cms_providers
from scrapers._mc_signals import score_name
from scrapers.co_cms_parse import (
    CMS_AGENCY,
    SOURCE_DEFICIENCIES,
    SOURCE_DIRECTORY,
    classify_cms_deficiency,
    classify_cms_provider,
    match_key,
)
from scrapers.co_hfq_parse import json_safe
from scrapers._http_helpers import make_session

UPSERT_SQL = """
    INSERT INTO facilities (
        state_code, external_id, cms_ccn, name, slug, city, city_slug,
        street, zip, county, phone, beds, latitude, longitude,
        facility_type, license_status, care_category,
        serves_memory_care, publishable, mc_review_status,
        mc_signal_explicit_name, mc_signal_chain_name,
        memory_care_disclosure_filed, memory_care_disclosure_source,
        cms_overall_rating, source_url,
        co_care_setting, co_operating_status
    ) VALUES (
        %(state_code)s, %(external_id)s, %(cms_ccn)s, %(name)s, %(slug)s,
        %(city)s, %(city_slug)s, %(street)s, %(zip)s, %(county)s, %(phone)s,
        %(beds)s, %(latitude)s, %(longitude)s, %(facility_type)s, %(license_status)s,
        %(care_category)s, %(serves_memory_care)s, %(publishable)s, %(mc_review_status)s,
        %(mc_signal_explicit_name)s, %(mc_signal_chain_name)s,
        %(memory_care_disclosure_filed)s, %(memory_care_disclosure_source)s,
        %(cms_overall_rating)s, %(source_url)s, %(co_care_setting)s, %(co_operating_status)s
    )
    ON CONFLICT (state_code, external_id) WHERE state_code = 'CO' AND external_id IS NOT NULL
    DO UPDATE SET
        cms_ccn = EXCLUDED.cms_ccn,
        beds = COALESCE(EXCLUDED.beds, facilities.beds),
        street = COALESCE(EXCLUDED.street, facilities.street),
        zip = COALESCE(EXCLUDED.zip, facilities.zip),
        county = COALESCE(EXCLUDED.county, facilities.county),
        phone = COALESCE(EXCLUDED.phone, facilities.phone),
        latitude = COALESCE(EXCLUDED.latitude, facilities.latitude),
        longitude = COALESCE(EXCLUDED.longitude, facilities.longitude),
        cms_overall_rating = EXCLUDED.cms_overall_rating,
        source_url = EXCLUDED.source_url,
        co_care_setting = EXCLUDED.co_care_setting,
        co_operating_status = EXCLUDED.co_operating_status,
        updated_at = now()
"""

SOURCE_SQL = """
    INSERT INTO co_source_rows (
        source, source_key, disposition, reason, facility_external_id, raw
    ) VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT (source, source_key) DO UPDATE SET
        disposition = EXCLUDED.disposition,
        reason = EXCLUDED.reason,
        facility_external_id = EXCLUDED.facility_external_id,
        raw = EXCLUDED.raw,
        ingested_at = now()
"""


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            return


def connect() -> psycopg.Connection:
    load_env()
    dsn = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(dsn)


def alr_address_index(conn: psycopg.Connection) -> dict[tuple[str, str], list[str]]:
    index: dict[tuple[str, str], list[str]] = defaultdict(list)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT external_id, name, street
              FROM facilities
             WHERE state_code = 'CO'
               AND co_care_setting = 'ALR'
               AND external_id IS NOT NULL
            """
        )
        for external_id, name, street in cur.fetchall():
            if not name or not street:
                continue
            index[match_key(name, street)].append(str(external_id))
    return index


def dementia_headers(rows: list[dict[str, Any]]) -> list[str]:
    if not rows:
        return []
    return [
        key
        for key in rows[0]
        if any(word in key.lower() for word in ("alzheimer", "dementia", "memory"))
    ]


def _chunks(items: list[Any], size: int) -> list[list[Any]]:
    return [items[index:index + size] for index in range(0, len(items), size)]


def write_directory(decisions: list[Any]) -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cms_ccn, co_care_setting, state_code
                  FROM facilities
                 WHERE cms_ccn IS NOT NULL
                """
            )
            owners = {str(ccn): (setting, str(state).strip()) for ccn, setting, state in cur.fetchall()}
            for decision in decisions:
                owner = owners.get(decision.ccn)
                if owner and (owner[1] != "CO" or owner[0] != "NH"):
                    decision.disposition = "quarantined"
                    decision.reason = "ccn_already_used"
                    decision.facility = None
            print(f"Writing {sum(1 for row in decisions if row.facility)} nursing homes", flush=True)
            with conn.pipeline():
                for decision in decisions:
                    if decision.facility is not None:
                        cur.execute(UPSERT_SQL, decision.facility)
                    raw = {
                        "candidate_alr_ids": decision.candidate_alr_ids,
                        "ccn": decision.ccn,
                    }
                    cur.execute(
                        SOURCE_SQL,
                        (
                            SOURCE_DIRECTORY,
                            decision.source_key,
                            decision.disposition,
                            decision.reason,
                            decision.ccn or None,
                            Json(raw),
                        ),
                    )
        conn.commit()


def run_directory(dry_run: bool) -> None:
    session = make_session()
    print("Downloading CMS provider information…", flush=True)
    rows = fetch_cms_providers(session, "CO")
    print(f"Colorado CMS provider rows: {len(rows)}", flush=True)
    headers = dementia_headers(rows)
    print(f"Dementia-like columns: {headers or 'none'}", flush=True)
    with connect() as conn:
        addresses = alr_address_index(conn)
    decisions = [classify_cms_provider(row, alr_by_address=addresses) for row in rows]
    seen_ccns: set[str] = set()
    for decision in decisions:
        if decision.disposition != "normalized":
            continue
        if decision.ccn in seen_ccns:
            decision.disposition = "quarantined"
            decision.reason = "duplicate_ccn"
            decision.facility = None
            decision.source_key = f"duplicate-{decision.ccn}"
            continue
        seen_ccns.add(decision.ccn)
    normalized = [row for row in decisions if row.disposition == "normalized"]
    candidates = [row for row in normalized if row.candidate_alr_ids]
    print(
        f"Classified {len(decisions)}: {len(normalized)} nursing homes, "
        f"{len(decisions) - len(normalized)} quarantined, "
        f"{len(candidates)} name-and-address candidates left unmerged",
        flush=True,
    )
    for decision in candidates:
        facility = decision.facility or {}
        print(
            f"  candidate {facility.get('cms_ccn')} {facility.get('name')} "
            f"-> assisted living {', '.join(decision.candidate_alr_ids)}",
            flush=True,
        )
    for decision in normalized[:5]:
        facility = decision.facility or {}
        print(
            f"  {facility.get('cms_ccn')}  {facility.get('name')}  {facility.get('city')}  "
            f"beds={facility.get('beds')}  review={facility.get('mc_review_status')}",
            flush=True,
        )
    if dry_run:
        print("Dry run complete. No database writes.", flush=True)
        return
    write_directory(decisions)
    print("CMS directory ingest committed.", flush=True)


def _survey_parts(row: dict[str, Any]) -> tuple[str, date | None, str, str]:
    ccn = str(row.get("CMS Certification Number (CCN)") or "").strip()
    survey_date = _parse_cms_date(row.get("Survey Date") or row.get("Inspection Date"))
    survey_id = str(row.get("Survey ID") or row.get("Standard Survey ID") or "").strip()
    survey_type = str(row.get("Survey Type") or row.get("Type of Survey") or "Health survey").strip()
    return ccn, survey_date, survey_id, survey_type or "Health survey"


def run_deficiencies(dry_run: bool) -> None:
    session = make_session()
    print("Downloading CMS health deficiencies…", flush=True)
    rows = fetch_cms_deficiencies(session, "CO")
    print(f"Colorado CMS deficiency rows: {len(rows)}", flush=True)
    if rows:
        print(f"Columns: {', '.join(list(rows[0])[:12])}", flush=True)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cms_ccn, id::text
                  FROM facilities
                 WHERE state_code = 'CO'
                   AND co_care_setting = 'NH'
                   AND cms_ccn IS NOT NULL
                """
            )
            homes = {str(ccn): str(facility_id) for ccn, facility_id in cur.fetchall()}
    print(f"Colorado nursing homes available to attach: {len(homes)}", flush=True)

    grouped: dict[tuple[str, date, str], list[dict[str, Any]]] = defaultdict(list)
    quarantines: list[tuple[str, str, str, dict[str, Any]]] = []
    for index, row in enumerate(rows, start=1):
        ccn, survey_date, survey_id, survey_type = _survey_parts(row)
        source_key = f"{index}"
        if not ccn:
            quarantines.append((source_key, "missing_ccn", "", row))
            continue
        if survey_date is None:
            quarantines.append((source_key, "undated", ccn, row))
            continue
        if ccn not in homes:
            quarantines.append((source_key, "unmatched_facility", ccn, row))
            continue
        if classify_cms_deficiency(row) is None:
            quarantines.append((source_key, "missing_citation_code", ccn, row))
            continue
        grouped[(ccn, survey_date, survey_id)].append(row)

    deficiency_count = sum(len(items) for items in grouped.values())
    print(
        f"Surveys: {len(grouped)}  deficiencies: {deficiency_count}  "
        f"quarantined: {len(quarantines)}",
        flush=True,
    )
    reasons = Counter(item[1] for item in quarantines)
    for reason, count in sorted(reasons.items()):
        print(f"  {reason}: {count}", flush=True)
    if dry_run:
        print("Dry run complete. No database writes.", flush=True)
        return
    if not homes:
        raise SystemExit("Load the CMS directory before the deficiencies.")

    _write_deficiencies(grouped, quarantines, homes)
    print("CMS deficiency ingest committed.", flush=True)


def _write_deficiencies(
    grouped: dict[tuple[str, date, str], list[dict[str, Any]]],
    quarantines: list[tuple[str, str, str, dict[str, Any]]],
    homes: dict[str, str],
) -> None:
    import uuid

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT facility_id::text, inspection_date, inspection_type, id::text,
                       raw_data->>'co_event_key'
                  FROM inspections
                 WHERE source_agency = %s
                   AND facility_id = ANY(%s::uuid[])
                """,
                (CMS_AGENCY, list(homes.values())),
            )
            existing: dict[str, str] = {}
            used: set[tuple[str, date, str]] = set()
            for facility_id, inspection_date, inspection_type, inspection_id, event_key in cur.fetchall():
                if event_key:
                    existing[event_key] = inspection_id
                used.add((facility_id, inspection_date, inspection_type or ""))

            inserts = []
            updates = []
            deficiencies = []
            inspection_ids = []
            for (ccn, survey_date, survey_id), survey_rows in grouped.items():
                facility_id = homes[ccn]
                _, _, _, survey_type = _survey_parts(survey_rows[0])
                event_key = f"cms|{ccn}|{survey_date.isoformat()}|{survey_id}"
                inspection_id = existing.get(event_key) or str(uuid.uuid4())
                label = survey_type or "Health survey"
                identity = (facility_id, survey_date, label)
                if event_key not in existing and identity in used:
                    label = f"{label} · {survey_id or ccn}"
                    identity = (facility_id, survey_date, label)
                used.add(identity)
                complaint_rows = sum(
                    1 for row in survey_rows if str(row.get("Complaint Deficiency") or "").strip().upper() == "Y"
                )
                is_complaint = complaint_rows == len(survey_rows) and complaint_rows > 0
                payload = {
                    "id": inspection_id,
                    "facility_id": facility_id,
                    "inspection_date": survey_date,
                    "inspection_type": label,
                    "is_complaint": is_complaint,
                    "total_deficiency_count": len(survey_rows),
                    "source_url": (
                        "https://data.cms.gov/provider-data/dataset/r5ix-sfxw"
                        f"?ccn={ccn}&date={survey_date.isoformat()}&survey={survey_id}"
                    ),
                    "source_agency": CMS_AGENCY,
                    "raw_data": Json(
                        {
                            "co_event_key": event_key,
                            "ccn": ccn,
                            "survey_id": survey_id,
                            "survey_type": survey_type,
                            "care_setting": "NH",
                            "complaint_deficiency_count": complaint_rows,
                        }
                    ),
                }
                inspection_ids.append(inspection_id)
                if event_key in existing:
                    updates.append(payload)
                else:
                    inserts.append(payload)
                for row in survey_rows:
                    mapped = classify_cms_deficiency(row)
                    if mapped is None:
                        continue
                    mapped.pop("complaint_deficiency", None)
                    mapped["inspection_id"] = inspection_id
                    mapped["cited_date"] = survey_date
                    deficiencies.append(mapped)

            source_rows = [
                (
                    SOURCE_DEFICIENCIES,
                    f"{ccn}|{survey_date.isoformat()}|{survey_id}|{index}",
                    "normalized",
                    None,
                    ccn,
                    Json(json_safe(row)),
                )
                for (ccn, survey_date, survey_id), survey_rows in grouped.items()
                for index, row in enumerate(survey_rows, start=1)
            ]
            source_rows.extend(
                (
                    SOURCE_DEFICIENCIES,
                    f"quarantine|{source_key}",
                    "quarantined",
                    reason,
                    ccn or None,
                    Json(json_safe(row)),
                )
                for source_key, reason, ccn, row in quarantines
            )
            print(
                f"Writing {len(inserts)} new surveys, {len(updates)} updates, "
                f"{len(deficiencies)} deficiencies, {len(source_rows)} source rows",
                flush=True,
            )
            with conn.pipeline():
                for batch in _chunks(updates, 300):
                    cur.executemany(
                        """
                        UPDATE inspections
                           SET inspection_date = %(inspection_date)s,
                               inspection_type = %(inspection_type)s,
                               is_complaint = %(is_complaint)s,
                               total_deficiency_count = %(total_deficiency_count)s,
                               source_url = %(source_url)s,
                               raw_data = %(raw_data)s
                         WHERE id = %(id)s
                        """,
                        batch,
                    )
                if inspection_ids:
                    cur.execute(
                        "DELETE FROM deficiencies WHERE inspection_id = ANY(%s::uuid[])",
                        (inspection_ids,),
                    )
                for batch in _chunks(inserts, 300):
                    cur.executemany(
                        """
                        INSERT INTO inspections (
                            id, facility_id, inspection_date, inspection_type, is_complaint,
                            total_deficiency_count, source_url, source_agency, raw_data
                        ) VALUES (
                            %(id)s, %(facility_id)s, %(inspection_date)s, %(inspection_type)s,
                            %(is_complaint)s, %(total_deficiency_count)s, %(source_url)s,
                            %(source_agency)s, %(raw_data)s
                        )
                        """,
                        batch,
                    )
                for batch in _chunks(deficiencies, 300):
                    cur.executemany(
                        """
                        INSERT INTO deficiencies (
                            inspection_id, code, scope, severity, scope_severity_code,
                            state_severity_raw, immediate_jeopardy, description,
                            cited_date
                        ) VALUES (
                            %(inspection_id)s, %(code)s, %(scope)s, %(severity)s,
                            %(scope_severity_code)s, %(state_severity_raw)s,
                            %(immediate_jeopardy)s, %(description)s, %(cited_date)s
                        )
                        """,
                        batch,
                    )
                for batch in _chunks(source_rows, 300):
                    cur.executemany(SOURCE_SQL, batch)
        conn.commit()


def stamp_name_signals(dry_run: bool) -> None:
    """Record a memory-care name on nursing homes already loaded.

    A refresh does not clear a flag, and this does not publish the home.
    """
    load_env()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("DATABASE_URL is not set")
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name
                  FROM facilities
                 WHERE state_code = 'CO' AND co_care_setting = 'NH'
                """
            )
            rows = cur.fetchall()
            updated = 0
            for facility_id, name in rows:
                signals = score_name(name or "")
                if not signals.explicit_name and not signals.chain_name:
                    continue
                if dry_run:
                    print(f"  {name}: explicit={signals.explicit_name} chain={signals.chain_name}")
                    updated += 1
                    continue
                cur.execute(
                    """
                    UPDATE facilities
                       SET mc_signal_explicit_name = mc_signal_explicit_name OR %s,
                           mc_signal_chain_name = mc_signal_chain_name OR %s
                     WHERE id = %s
                    """,
                    (signals.explicit_name, signals.chain_name, facility_id),
                )
                updated += cur.rowcount
        if not dry_run:
            conn.commit()
    print(f"Name signals noted on {updated} nursing homes.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Colorado CMS nursing homes")
    parser.add_argument("step", choices=("directory", "deficiencies", "name-signals"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.step == "directory":
        run_directory(args.dry_run)
    elif args.step == "name-signals":
        stamp_name_signals(args.dry_run)
    else:
        run_deficiencies(args.dry_run)


if __name__ == "__main__":
    main()
