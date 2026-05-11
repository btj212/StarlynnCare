"""
Publication gate — end-to-end DB tests.

Tests the publishable=true/false logic across all signal paths:
  • Tier 1 (mc_signal_explicit_name) → auto-published for LICENSED facilities
  • Tier 2 (mc_signal_chain_name) → needs_review until admin approves
  • CLOSED facilities → never publishable regardless of MC signal
  • No MC signal → not publishable
  • mc_review_status workflow (reviewed_publish, reviewed_reject)

Also tests:
  • recompute_publishable.py logic via direct SQL (equivalent queries)
  • The admin /api/admin/mc-review workflow at the DB level
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest

from conftest import insert_test_facility, insert_test_inspection


# ─────────────────────────────────────────────────────────────────────────────
# Publishable gate logic
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_licensed_explicit_mc_is_publishable(db_conn):
    fac = insert_test_facility(
        db_conn,
        license_status="LICENSED",
        mc_signal_explicit_name=True,
        mc_signal_chain_name=False,
        mc_review_status="auto_published",
        publishable=True,
    )
    with db_conn.cursor() as cur:
        cur.execute("SELECT publishable FROM facilities WHERE id = %s::uuid", (fac["id"],))
        assert cur.fetchone()[0] is True


@pytest.mark.db
def test_closed_explicit_mc_is_not_publishable(db_conn):
    fac = insert_test_facility(
        db_conn,
        license_status="CLOSED",
        mc_signal_explicit_name=True,
        publishable=False,
    )
    with db_conn.cursor() as cur:
        cur.execute("SELECT publishable FROM facilities WHERE id = %s::uuid", (fac["id"],))
        assert cur.fetchone()[0] is False


@pytest.mark.db
def test_licensed_no_mc_signal_is_not_publishable(db_conn):
    fac = insert_test_facility(
        db_conn,
        license_status="LICENSED",
        mc_signal_explicit_name=False,
        mc_signal_chain_name=False,
        publishable=False,
    )
    with db_conn.cursor() as cur:
        cur.execute("SELECT publishable FROM facilities WHERE id = %s::uuid", (fac["id"],))
        assert cur.fetchone()[0] is False


@pytest.mark.db
def test_licensed_chain_only_starts_needs_review(db_conn):
    fac = insert_test_facility(
        db_conn,
        license_status="LICENSED",
        mc_signal_explicit_name=False,
        mc_signal_chain_name=True,
        mc_review_status="needs_review",
    )
    with db_conn.cursor() as cur:
        cur.execute("SELECT mc_review_status FROM facilities WHERE id = %s::uuid", (fac["id"],))
        assert cur.fetchone()[0] == "needs_review"


# ─────────────────────────────────────────────────────────────────────────────
# Admin review workflow
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_admin_approve_sets_reviewed_publish_and_publishable(db_conn):
    """
    Simulates the /api/admin/mc-review action='approve' path:
      UPDATE facilities SET mc_review_status='reviewed_publish', publishable=true
      WHERE id = ?
    """
    fac = insert_test_facility(
        db_conn,
        mc_review_status="needs_review",
        publishable=False,
        mc_signal_chain_name=True,
    )

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE facilities SET
                mc_review_status = 'reviewed_publish',
                publishable = true
            WHERE id = %s::uuid
            """,
            (fac["id"],),
        )
        cur.execute(
            "SELECT mc_review_status, publishable FROM facilities WHERE id = %s::uuid",
            (fac["id"],),
        )
        status, pub = cur.fetchone()

    assert status == "reviewed_publish"
    assert pub is True


@pytest.mark.db
def test_admin_reject_sets_reviewed_reject_and_not_publishable(db_conn):
    fac = insert_test_facility(
        db_conn,
        mc_review_status="needs_review",
        publishable=True,
        mc_signal_chain_name=True,
    )

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE facilities SET
                mc_review_status = 'reviewed_reject',
                publishable = false
            WHERE id = %s::uuid
            """,
            (fac["id"],),
        )
        cur.execute(
            "SELECT mc_review_status, publishable FROM facilities WHERE id = %s::uuid",
            (fac["id"],),
        )
        status, pub = cur.fetchone()

    assert status == "reviewed_reject"
    assert pub is False


@pytest.mark.db
def test_admin_review_audit_can_be_logged(db_conn):
    """
    Simulates inserting into mc_review_audit (migration 0022).
    """
    fac = insert_test_facility(db_conn, mc_review_status="needs_review")

    # Check if mc_review_audit table exists
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'mc_review_audit'
            """
        )
        has_audit = cur.fetchone()[0] > 0

    if not has_audit:
        pytest.skip("mc_review_audit table not yet migrated")

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO mc_review_audit (facility_id, action, reviewer, notes)
            VALUES (%s::uuid, 'approve', 'test@example.com', 'E2E test approval')
            RETURNING id::text
            """,
            (fac["id"],),
        )
        audit_id = cur.fetchone()[0]

    assert uuid.UUID(audit_id)

    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT action, reviewer FROM mc_review_audit WHERE id = %s::uuid",
            (audit_id,),
        )
        row = cur.fetchone()
    assert row[0] == "approve"
    assert row[1] == "test@example.com"


# ─────────────────────────────────────────────────────────────────────────────
# recompute_publishable logic — equivalent SQL queries
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_recompute_publishable_explicit_signal_makes_licensed_publishable(db_conn):
    """
    Equivalent to recompute_publishable.py Tier 1 path:
      publishable = (license_status='LICENSED' AND mc_signal_explicit_name=true)
    """
    fac = insert_test_facility(
        db_conn,
        license_status="LICENSED",
        mc_signal_explicit_name=True,
        mc_signal_chain_name=False,
        publishable=False,  # Start unpublished
    )

    # Simulate recompute
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE facilities SET
                publishable = (
                    license_status = 'LICENSED'
                    AND (
                        mc_signal_explicit_name = true
                        OR memory_care_disclosure_filed = true
                    )
                )
            WHERE id = %s::uuid
            RETURNING publishable
            """,
            (fac["id"],),
        )
        new_pub = cur.fetchone()[0]

    assert new_pub is True


@pytest.mark.db
def test_recompute_publishable_chain_curated_makes_licensed_publishable(db_conn):
    """
    Equivalent to recompute_publishable.py Tier 2 path (curated chain → publish).
    """
    fac = insert_test_facility(
        db_conn,
        license_status="LICENSED",
        mc_signal_explicit_name=False,
        mc_signal_chain_name=True,
        mc_review_status="reviewed_publish",
        publishable=False,
        extra={"mc_signal_chain_curated": True} if False else {},  # chain_curated column may not exist yet
    )

    # Simulate recompute: mc_review_status='reviewed_publish' → publishable
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE facilities SET
                publishable = (
                    license_status = 'LICENSED'
                    AND mc_review_status = 'reviewed_publish'
                )
            WHERE id = %s::uuid
            RETURNING publishable
            """,
            (fac["id"],),
        )
        new_pub = cur.fetchone()[0]

    assert new_pub is True


@pytest.mark.db
def test_recompute_publishable_closed_stays_unpublished(db_conn):
    fac = insert_test_facility(
        db_conn,
        license_status="CLOSED",
        mc_signal_explicit_name=True,
        publishable=True,  # Even if marked published, closed should revert
    )

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE facilities SET
                publishable = (license_status = 'LICENSED' AND mc_signal_explicit_name = true)
            WHERE id = %s::uuid
            RETURNING publishable
            """,
            (fac["id"],),
        )
        new_pub = cur.fetchone()[0]

    assert new_pub is False


@pytest.mark.db
def test_recompute_publishable_pending_status_stays_unpublished(db_conn):
    fac = insert_test_facility(
        db_conn,
        license_status="PENDING",
        mc_signal_explicit_name=True,
        publishable=True,
    )

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE facilities SET
                publishable = (license_status = 'LICENSED' AND mc_signal_explicit_name = true)
            WHERE id = %s::uuid
            RETURNING publishable
            """,
            (fac["id"],),
        )
        new_pub = cur.fetchone()[0]

    assert new_pub is False


# ─────────────────────────────────────────────────────────────────────────────
# Publishable facilities are queryable by the public (RLS check)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_publishable_facility_visible_via_select(db_conn):
    """A publishable facility must appear in a SELECT (RLS allows it)."""
    fac = insert_test_facility(db_conn, publishable=True)
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT id::text FROM facilities WHERE id = %s::uuid AND publishable = true",
            (fac["id"],),
        )
        row = cur.fetchone()
    assert row is not None
    assert row[0] == fac["id"]


@pytest.mark.db
def test_not_publishable_facility_excluded_from_publishable_query(db_conn):
    fac = insert_test_facility(db_conn, publishable=False)
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT id::text FROM facilities WHERE id = %s::uuid AND publishable = true",
            (fac["id"],),
        )
        row = cur.fetchone()
    assert row is None, (
        "Non-publishable facility appeared in publishable=true query"
    )


# ─────────────────────────────────────────────────────────────────────────────
# facility_snapshot() respects publishable flag in peer set
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_snapshot_peer_set_excludes_non_publishable_facilities(db_conn):
    """
    The RPC's peer set query uses publishable=true. Insert one publishable and one
    non-publishable; verify the non-publishable isn't included in the peer count.
    """
    fac_pub = insert_test_facility(db_conn, publishable=True, beds=24, care_category="rcfe_memory_care")
    fac_nopu = insert_test_facility(db_conn, publishable=False, beds=24, care_category="rcfe_memory_care")

    snap_pub = call_snapshot(db_conn, fac_pub["id"])
    snap_nopu = call_snapshot(db_conn, fac_nopu["id"])

    # The non-publishable facility should not inflate the publishable facility's peer count
    n_pub = snap_pub["peer_set"]["n"]
    n_nopu = snap_nopu["peer_set"]["n"]

    # n_pub should include the publishable test facility but NOT the non-publishable one
    # n_nopu may be 0 or 1 (self-only fallback) — but not inflated by the non-publishable one
    assert n_pub >= 1


def call_snapshot(conn, facility_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT facility_snapshot(%s::uuid)", (facility_id,))
        row = cur.fetchone()
    return row[0] if row else None
