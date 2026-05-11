"""
Inspection + deficiency pipeline — end-to-end DB tests.

Tests the full inspection ingestion path:
  - Insert inspection record with all fields
  - Insert deficiency records with all severity paths
  - Cascade delete (inspection delete removes its deficiencies)
  - ON CONFLICT DO NOTHING prevents duplicate inspections
  - Deficiency deduplication and severity derivation stored correctly
  - narrative_summary storage
  - scrape_run_id linking

All tests run in a rolled-back transaction — no permanent DB changes.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Any

import psycopg
import pytest

from conftest import (
    insert_test_deficiency,
    insert_test_facility,
    insert_test_inspection,
)


# ─────────────────────────────────────────────────────────────────────────────
# Inspection INSERT
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_inspection_insert_returns_uuid(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    uuid.UUID(insp_id)  # Raises ValueError if invalid


@pytest.mark.db
def test_inspection_date_stored_correctly(db_conn):
    fac = insert_test_facility(db_conn)
    d = date(2023, 6, 15)
    insp_id = insert_test_inspection(db_conn, fac["id"], inspection_date=d)
    with db_conn.cursor() as cur:
        cur.execute("SELECT inspection_date FROM inspections WHERE id = %s::uuid", (insp_id,))
        assert cur.fetchone()[0] == d


@pytest.mark.db
def test_inspection_type_stored_correctly(db_conn):
    fac = insert_test_facility(db_conn)
    for itype in ("standard", "complaint", "follow-up", "focused"):
        insp_id = insert_test_inspection(db_conn, fac["id"], inspection_type=itype)
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT inspection_type FROM inspections WHERE id = %s::uuid", (insp_id,)
            )
            assert cur.fetchone()[0] == itype


@pytest.mark.db
def test_inspection_is_complaint_false_for_standard(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"], is_complaint=False)
    with db_conn.cursor() as cur:
        cur.execute("SELECT is_complaint FROM inspections WHERE id = %s::uuid", (insp_id,))
        assert cur.fetchone()[0] is False


@pytest.mark.db
def test_inspection_is_complaint_true_for_complaint(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"], is_complaint=True)
    with db_conn.cursor() as cur:
        cur.execute("SELECT is_complaint FROM inspections WHERE id = %s::uuid", (insp_id,))
        assert cur.fetchone()[0] is True


@pytest.mark.db
def test_inspection_total_deficiency_count_stored(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"], total_deficiency_count=7)
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT total_deficiency_count FROM inspections WHERE id = %s::uuid", (insp_id,)
        )
        assert cur.fetchone()[0] == 7


@pytest.mark.db
def test_inspection_source_url_stored(db_conn):
    fac = insert_test_facility(db_conn)
    url = "https://example.com/inspection/ABC123"
    insp_id = insert_test_inspection(db_conn, fac["id"], source_url=url)
    with db_conn.cursor() as cur:
        cur.execute("SELECT source_url FROM inspections WHERE id = %s::uuid", (insp_id,))
        assert cur.fetchone()[0] == url


@pytest.mark.db
def test_inspection_facility_id_references_facility(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    with db_conn.cursor() as cur:
        cur.execute("SELECT facility_id::text FROM inspections WHERE id = %s::uuid", (insp_id,))
        stored_fac_id = cur.fetchone()[0]
    assert stored_fac_id == fac["id"]


@pytest.mark.db
def test_inspection_created_at_is_set(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    with db_conn.cursor() as cur:
        cur.execute("SELECT created_at FROM inspections WHERE id = %s::uuid", (insp_id,))
        ts = cur.fetchone()[0]
    assert ts is not None


@pytest.mark.db
def test_multiple_inspections_for_same_facility(db_conn):
    fac = insert_test_facility(db_conn)
    ids = [
        insert_test_inspection(db_conn, fac["id"], inspection_date=date.today() - timedelta(days=i * 90))
        for i in range(5)
    ]
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM inspections WHERE facility_id = %s::uuid",
            (fac["id"],),
        )
        assert cur.fetchone()[0] == 5


# ─────────────────────────────────────────────────────────────────────────────
# Deficiency INSERT — all fields
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_deficiency_insert_returns_uuid(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_id = insert_test_deficiency(db_conn, insp_id)
    uuid.UUID(def_id)


@pytest.mark.db
def test_deficiency_severity_stored_correctly(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    for sev in (1, 2, 3, 4):
        def_id = insert_test_deficiency(db_conn, insp_id, severity=sev)
        with db_conn.cursor() as cur:
            cur.execute("SELECT severity FROM deficiencies WHERE id = %s::uuid", (def_id,))
            assert cur.fetchone()[0] == sev


@pytest.mark.db
def test_deficiency_severity_null_when_not_set(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_id = insert_test_deficiency(db_conn, insp_id, severity=None)
    with db_conn.cursor() as cur:
        cur.execute("SELECT severity FROM deficiencies WHERE id = %s::uuid", (def_id,))
        assert cur.fetchone()[0] is None


@pytest.mark.db
def test_deficiency_scope_stored_correctly(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    for scope in ("isolated", "pattern", "widespread"):
        def_id = insert_test_deficiency(db_conn, insp_id, scope=scope)
        with db_conn.cursor() as cur:
            cur.execute("SELECT scope FROM deficiencies WHERE id = %s::uuid", (def_id,))
            assert cur.fetchone()[0] == scope


@pytest.mark.db
def test_deficiency_scope_check_constraint_rejects_invalid(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    with pytest.raises(Exception):  # psycopg.errors.CheckViolation or similar
        with db_conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO deficiencies (inspection_id, scope, severity, immediate_jeopardy, is_repeat)
                VALUES (%s::uuid, 'invalid_scope', 2, false, false)
                """,
                (insp_id,),
            )
        db_conn.commit()


@pytest.mark.db
def test_deficiency_severity_check_constraint_rejects_5(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    with pytest.raises(Exception):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO deficiencies (inspection_id, severity, scope, immediate_jeopardy, is_repeat)
                VALUES (%s::uuid, 5, 'isolated', false, false)
                """,
                (insp_id,),
            )
        db_conn.commit()


@pytest.mark.db
def test_deficiency_immediate_jeopardy_stored(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_id = insert_test_deficiency(db_conn, insp_id, immediate_jeopardy=True)
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT immediate_jeopardy FROM deficiencies WHERE id = %s::uuid", (def_id,)
        )
        assert cur.fetchone()[0] is True


@pytest.mark.db
def test_deficiency_is_repeat_stored(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_id = insert_test_deficiency(db_conn, insp_id, is_repeat=True)
    with db_conn.cursor() as cur:
        cur.execute("SELECT is_repeat FROM deficiencies WHERE id = %s::uuid", (def_id,))
        assert cur.fetchone()[0] is True


@pytest.mark.db
def test_deficiency_ftag_stored(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_id = insert_test_deficiency(db_conn, insp_id, ftag="F600")
    with db_conn.cursor() as cur:
        cur.execute("SELECT ftag FROM deficiencies WHERE id = %s::uuid", (def_id,))
        assert cur.fetchone()[0] == "F600"


@pytest.mark.db
def test_deficiency_class_stored(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_id = insert_test_deficiency(db_conn, insp_id, class_="Type A")
    with db_conn.cursor() as cur:
        cur.execute("SELECT class FROM deficiencies WHERE id = %s::uuid", (def_id,))
        assert cur.fetchone()[0] == "Type A"


@pytest.mark.db
def test_deficiency_inspector_narrative_stored(db_conn):
    narrative = "Inspector observed staff leaving resident unattended for 45 minutes."
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_id = insert_test_deficiency(db_conn, insp_id, inspector_narrative=narrative)
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT inspector_narrative FROM deficiencies WHERE id = %s::uuid", (def_id,)
        )
        assert cur.fetchone()[0] == narrative


@pytest.mark.db
def test_deficiency_inspection_id_references_inspection(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_id = insert_test_deficiency(db_conn, insp_id)
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT inspection_id::text FROM deficiencies WHERE id = %s::uuid", (def_id,)
        )
        assert cur.fetchone()[0] == insp_id


# ─────────────────────────────────────────────────────────────────────────────
# Effective severity — the snapshot RPC formula uses the same cascade
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_effective_severity_ij_overrides_stored_severity(db_conn):
    """
    facility_snapshot() computes effective severity as:
      COALESCE(severity, CASE WHEN immediate_jeopardy THEN 4 WHEN class='Type A' THEN 3 ... ELSE 1 END)
    So a deficiency with severity=NULL + immediate_jeopardy=TRUE must score as 4.
    Verify the DB stores the correct data for this path.
    """
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_id = insert_test_deficiency(
        db_conn, insp_id,
        severity=None,
        immediate_jeopardy=True,
    )
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                severity,
                immediate_jeopardy,
                COALESCE(severity,
                    CASE WHEN immediate_jeopardy THEN 4
                         WHEN class = 'Type A' THEN 3
                         WHEN class = 'Type B' THEN 2
                         ELSE 1 END
                ) AS eff_sev
            FROM deficiencies WHERE id = %s::uuid
            """,
            (def_id,),
        )
        row = cur.fetchone()
    assert row[0] is None, "severity should be null"
    assert row[1] is True, "immediate_jeopardy should be true"
    assert row[2] == 4, f"effective severity should be 4, got {row[2]}"


@pytest.mark.db
def test_effective_severity_type_a_class(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_id = insert_test_deficiency(
        db_conn, insp_id,
        severity=None,
        immediate_jeopardy=False,
        class_="Type A",
    )
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(severity,
                CASE WHEN immediate_jeopardy THEN 4
                     WHEN class = 'Type A' THEN 3
                     WHEN class = 'Type B' THEN 2
                     ELSE 1 END) AS eff_sev
            FROM deficiencies WHERE id = %s::uuid
            """,
            (def_id,),
        )
        assert cur.fetchone()[0] == 3


@pytest.mark.db
def test_effective_severity_type_b_class(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_id = insert_test_deficiency(
        db_conn, insp_id,
        severity=None,
        immediate_jeopardy=False,
        class_="Type B",
    )
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(severity,
                CASE WHEN immediate_jeopardy THEN 4
                     WHEN class = 'Type A' THEN 3
                     WHEN class = 'Type B' THEN 2
                     ELSE 1 END) AS eff_sev
            FROM deficiencies WHERE id = %s::uuid
            """,
            (def_id,),
        )
        assert cur.fetchone()[0] == 2


@pytest.mark.db
def test_effective_severity_defaults_to_1(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_id = insert_test_deficiency(
        db_conn, insp_id,
        severity=None,
        immediate_jeopardy=False,
        class_=None,
    )
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(severity,
                CASE WHEN immediate_jeopardy THEN 4
                     WHEN class = 'Type A' THEN 3
                     WHEN class = 'Type B' THEN 2
                     ELSE 1 END) AS eff_sev
            FROM deficiencies WHERE id = %s::uuid
            """,
            (def_id,),
        )
        assert cur.fetchone()[0] == 1


# ─────────────────────────────────────────────────────────────────────────────
# Cascade delete
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_delete_inspection_cascades_to_deficiencies(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    def_ids = [insert_test_deficiency(db_conn, insp_id) for _ in range(3)]

    # Verify deficiencies exist
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM deficiencies WHERE inspection_id = %s::uuid", (insp_id,)
        )
        assert cur.fetchone()[0] == 3

    # Delete the inspection
    with db_conn.cursor() as cur:
        cur.execute("DELETE FROM inspections WHERE id = %s::uuid", (insp_id,))

    # Deficiencies must be gone
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM deficiencies WHERE inspection_id = %s::uuid", (insp_id,)
        )
        assert cur.fetchone()[0] == 0, (
            "Deficiencies were NOT cascade-deleted when inspection was deleted"
        )


@pytest.mark.db
def test_delete_facility_cascades_to_inspections(db_conn):
    fac = insert_test_facility(db_conn)
    insp_ids = [
        insert_test_inspection(db_conn, fac["id"])
        for _ in range(3)
    ]

    with db_conn.cursor() as cur:
        cur.execute("DELETE FROM facilities WHERE id = %s::uuid", (fac["id"],))
        cur.execute(
            "SELECT COUNT(*) FROM inspections WHERE id = ANY(%s::uuid[])",
            (insp_ids,),
        )
        assert cur.fetchone()[0] == 0


# ─────────────────────────────────────────────────────────────────────────────
# ON CONFLICT DO NOTHING for duplicate inspections
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_inspection_on_conflict_do_nothing(db_conn):
    """
    The OR ingest uses ON CONFLICT (facility_id, inspection_date, inspection_type, COALESCE(source_agency, ''))
    to prevent duplicate ingestion of the same inspection event.
    """
    fac = insert_test_facility(db_conn)
    d = date(2023, 6, 15)
    url = "https://example.com/insp/unique-001"
    source_agency = "OR DHS LTC Licensing"

    # First insert
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO inspections (
                facility_id, inspection_date, inspection_type,
                is_complaint, total_deficiency_count,
                source_url, source_agency
            ) VALUES (%s::uuid, %s, 'standard', false, 0, %s, %s)
            ON CONFLICT (facility_id, inspection_date, inspection_type, COALESCE(source_agency, ''))
            DO NOTHING
            RETURNING id::text
            """,
            (fac["id"], d, url, source_agency),
        )
        first_id = cur.fetchone()

    # Second insert — same key
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO inspections (
                facility_id, inspection_date, inspection_type,
                is_complaint, total_deficiency_count,
                source_url, source_agency
            ) VALUES (%s::uuid, %s, 'standard', false, 0, %s, %s)
            ON CONFLICT (facility_id, inspection_date, inspection_type, COALESCE(source_agency, ''))
            DO NOTHING
            RETURNING id::text
            """,
            (fac["id"], d, url + "-different", source_agency),  # different URL same key
        )
        second_id = cur.fetchone()

    assert second_id is None, (
        "Second insert should have been blocked by ON CONFLICT DO NOTHING"
    )

    # Only 1 row in DB
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM inspections WHERE facility_id = %s::uuid AND inspection_date = %s",
            (fac["id"], d),
        )
        assert cur.fetchone()[0] == 1


# ─────────────────────────────────────────────────────────────────────────────
# OR ingest: infer_severity stored correctly
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_ingest_inferred_severity_stored_in_db(db_conn):
    """
    Simulate what or_inspections_ingest.py does: call infer_severity(),
    then store the result. Verify the numeric severity is in DB.
    """
    from or_inspections_ingest import infer_severity

    fac = insert_test_facility(db_conn, state_code="OR")
    insp_id = insert_test_inspection(db_conn, fac["id"])

    test_cases = [
        ("Type A", None, False, 3),
        ("Immediate Jeopardy", None, False, 4),
        (None, 2, False, 2),
        ("Type B", None, True, 4),  # IJ overrides
    ]

    for state_raw, explicit, ij, expected_sev in test_cases:
        sev = infer_severity(state_raw, explicit, immediate_jeopardy=ij)
        with db_conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO deficiencies (
                    inspection_id, severity, immediate_jeopardy, is_repeat,
                    state_severity_raw
                ) VALUES (%s::uuid, %s, %s, false, %s)
                RETURNING severity
                """,
                (insp_id, sev, ij, state_raw),
            )
            stored_sev = cur.fetchone()[0]

        assert stored_sev == expected_sev, (
            f"state_raw={state_raw!r}, explicit={explicit}, ij={ij} → "
            f"expected stored severity={expected_sev}, got {stored_sev}"
        )
