#!/usr/bin/env python3
"""Shared state-scan ledger and material-change fingerprinting."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

import psycopg
from psycopg.rows import dict_row, tuple_row


@dataclass(frozen=True)
class StateCounts:
    facilities: int
    inspections: int
    deficiencies: int


def _json_default(value: Any) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def fingerprint(payload: dict[str, Any]) -> str:
    normalized = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=_json_default)
    return hashlib.sha256(normalized.encode()).hexdigest()


def require_tables(conn: psycopg.Connection) -> None:
    with conn.cursor(row_factory=tuple_row) as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN (
                'state_scan_runs',
                'state_scan_sources',
                'state_scan_facility_deltas',
                'watch_alert_deliveries',
                'area_watchers'
              )
            """
        )
        if cur.fetchone()[0] != 5:
            raise RuntimeError(
                "State Watch tables are missing. Apply "
                "supabase/migrations/0060_state_watch_automation.sql first."
            )


def state_counts(conn: psycopg.Connection, state_code: str) -> StateCounts:
    with conn.cursor(row_factory=tuple_row) as cur:
        cur.execute(
            """
            SELECT
              COUNT(DISTINCT f.id),
              COUNT(DISTINCT i.id),
              COUNT(DISTINCT d.id)
            FROM facilities f
            LEFT JOIN inspections i ON i.facility_id = f.id
            LEFT JOIN deficiencies d ON d.inspection_id = i.id
            WHERE f.state_code = %s
            """,
            (state_code,),
        )
        row = cur.fetchone()
    return StateCounts(*(int(value or 0) for value in row))


def capture_facility_state(
    conn: psycopg.Connection,
    state_code: str,
) -> dict[str, dict[str, Any]]:
    """Return one stable, public-record fingerprint payload per facility."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            WITH inspection_rollup AS (
              SELECT
                i.facility_id,
                COUNT(DISTINCT i.id)::int AS inspection_count,
                COUNT(d.id)::int AS deficiency_count,
                MAX(i.inspection_date) AS latest_inspection_date,
                md5(
                  COALESCE(
                    string_agg(
                      concat_ws(
                        '|',
                        i.inspection_date,
                        i.inspection_type,
                        i.is_complaint,
                        i.source_url,
                        i.source_agency,
                        d.ftag,
                        d.code,
                        d.category,
                        d.scope,
                        d.severity,
                        d.class,
                        d.immediate_jeopardy,
                        d.is_repeat,
                        d.description,
                        d.inspector_narrative,
                        d.harm_description,
                        d.residents_affected,
                        d.corrected_date,
                        d.status
                      ),
                      E'\\n' ORDER BY
                        i.inspection_date,
                        i.source_url,
                        d.code,
                        d.ftag,
                        d.cited_date,
                        d.description
                    ),
                    ''
                  )
                ) AS record_fingerprint
              FROM inspections i
              LEFT JOIN deficiencies d ON d.inspection_id = i.id
              JOIN facilities f ON f.id = i.facility_id
              WHERE f.state_code = %s
              GROUP BY i.facility_id
            )
            SELECT
              f.id::text AS facility_id,
              f.name,
              f.slug,
              f.city,
              f.city_slug,
              f.license_number,
              f.license_status,
              f.publishable,
              f.serves_memory_care,
              f.memory_care_disclosure_filed,
              COALESCE(r.inspection_count, 0) AS inspection_count,
              COALESCE(r.deficiency_count, 0) AS deficiency_count,
              r.latest_inspection_date,
              COALESCE(r.record_fingerprint, md5('')) AS record_fingerprint
            FROM facilities f
            LEFT JOIN inspection_rollup r ON r.facility_id = f.id
            WHERE f.state_code = %s
            """,
            (state_code, state_code),
        )
        rows = cur.fetchall()

    snapshots: dict[str, dict[str, Any]] = {}
    for row in rows:
        payload = dict(row)
        facility_id = payload.pop("facility_id")
        facility_payload = {
            key: payload[key]
            for key in (
                "name",
                "slug",
                "city",
                "city_slug",
                "license_number",
                "license_status",
                "publishable",
                "serves_memory_care",
                "memory_care_disclosure_filed",
            )
        }
        snapshots[facility_id] = {
            **payload,
            "facility_fingerprint": fingerprint(facility_payload),
        }
    return snapshots


def begin_scan(
    conn: psycopg.Connection,
    state_code: str,
    counts: StateCounts,
    metadata: dict[str, Any] | None = None,
) -> str:
    with conn.cursor(row_factory=tuple_row) as cur:
        cur.execute(
            """
            INSERT INTO state_scan_runs (
              state_code,
              facilities_before,
              inspections_before,
              deficiencies_before,
              metadata
            )
            VALUES (%s, %s, %s, %s, %s::jsonb)
            RETURNING id::text
            """,
            (
                state_code,
                counts.facilities,
                counts.inspections,
                counts.deficiencies,
                json.dumps(metadata or {}),
            ),
        )
        scan_run_id = cur.fetchone()[0]
    conn.commit()
    return scan_run_id


def record_source(
    conn: psycopg.Connection,
    scan_run_id: str,
    source: str,
    *,
    status: str,
    records_before: int | None = None,
    records_after: int | None = None,
    watermark: str | None = None,
    error: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO state_scan_sources (
              scan_run_id,
              source,
              completed_at,
              status,
              records_before,
              records_after,
              watermark,
              error,
              metadata
            )
            VALUES (%s, %s, now(), %s, %s, %s, %s, %s, %s::jsonb)
            ON CONFLICT (scan_run_id, source) DO UPDATE SET
              completed_at = EXCLUDED.completed_at,
              status = EXCLUDED.status,
              records_before = EXCLUDED.records_before,
              records_after = EXCLUDED.records_after,
              watermark = EXCLUDED.watermark,
              error = EXCLUDED.error,
              metadata = EXCLUDED.metadata
            """,
            (
                scan_run_id,
                source,
                status,
                records_before,
                records_after,
                watermark,
                error[:1000] if error else None,
                json.dumps(metadata or {}),
            ),
        )
    conn.commit()


def _delta_summary(before: dict[str, Any] | None, after: dict[str, Any]) -> tuple[str, str]:
    if before is None:
        return "facility_added", f"New facility record: {after['name']} in {after['city']}"
    if before["record_fingerprint"] != after["record_fingerprint"]:
        inspection_delta = after["inspection_count"] - before["inspection_count"]
        deficiency_delta = after["deficiency_count"] - before["deficiency_count"]
        return (
            "inspection_record_changed",
            f"{after['name']}: inspection record changed "
            f"({inspection_delta:+d} inspections, {deficiency_delta:+d} citations)",
        )
    return "facility_updated", f"{after['name']}: license or publication record changed"


def is_family_facing_delta(
    before: dict[str, Any] | None,
    after: dict[str, Any],
) -> bool:
    return bool(after.get("publishable")) or bool(before and before.get("publishable"))


def complete_scan(
    conn: psycopg.Connection,
    scan_run_id: str,
    before: dict[str, dict[str, Any]],
    after: dict[str, dict[str, Any]],
    counts: StateCounts,
    *,
    source_failures: list[str],
) -> int:
    changes = 0
    with conn.cursor() as cur:
        for facility_id, after_payload in after.items():
            before_payload = before.get(facility_id)
            if not is_family_facing_delta(before_payload, after_payload):
                continue
            facility_changed = (
                before_payload is None
                or before_payload["facility_fingerprint"]
                != after_payload["facility_fingerprint"]
            )
            record_changed = (
                before_payload is None
                or before_payload["record_fingerprint"]
                != after_payload["record_fingerprint"]
            )
            if not facility_changed and not record_changed:
                continue

            change_type, summary = _delta_summary(before_payload, after_payload)
            delta_fp = fingerprint(
                {
                    "facility_id": facility_id,
                    "change_type": change_type,
                    "after": after_payload,
                }
            )
            cur.execute(
                """
                INSERT INTO state_scan_facility_deltas (
                  scan_run_id,
                  facility_id,
                  change_type,
                  summary,
                  before_payload,
                  after_payload,
                  fingerprint
                )
                VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
                ON CONFLICT (scan_run_id, fingerprint) DO NOTHING
                """,
                (
                    scan_run_id,
                    facility_id,
                    change_type,
                    summary,
                    json.dumps(before_payload, default=_json_default) if before_payload else None,
                    json.dumps(after_payload, default=_json_default),
                    delta_fp,
                ),
            )
            changes += cur.rowcount

        status = "partial" if source_failures else "completed"
        cur.execute(
            """
            UPDATE state_scan_runs
            SET completed_at = now(),
                status = %s,
                facilities_after = %s,
                inspections_after = %s,
                deficiencies_after = %s,
                changes_detected = %s,
                error = %s
            WHERE id = %s
            """,
            (
                status,
                counts.facilities,
                counts.inspections,
                counts.deficiencies,
                changes,
                "; ".join(source_failures)[:2000] if source_failures else None,
                scan_run_id,
            ),
        )
    conn.commit()
    return changes


def fail_scan(conn: psycopg.Connection, scan_run_id: str, error: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE state_scan_runs
            SET completed_at = now(), status = 'failed', error = %s
            WHERE id = %s
            """,
            (error[:2000], scan_run_id),
        )
    conn.commit()
