"""
recompute_publishable.py logic tests — run against the REAL database.

Uses transactional fixtures (db_conn) so all inserts are rolled back after
each test — no pollution of production data.

Tests verify that each state's signal model correctly sets serves_memory_care
and publishable when the relevant signal flags are flipped.

Requirements: DATABASE_URL (direct psycopg write access, service-role equivalent)
"""

from __future__ import annotations

import sys
import uuid
from datetime import date
from pathlib import Path

import pytest

# Add scrapers to path (done in conftest.py, but be explicit for clarity)
SCRAPERS_DIR = Path(__file__).resolve().parent.parent.parent / "scrapers"
sys.path.insert(0, str(SCRAPERS_DIR))

recompute = pytest.importorskip(
    "recompute_publishable",
    reason="recompute_publishable deps unavailable",
)


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _insert_test_facility(
    cur,
    *,
    state_code: str,
    external_id: str | None = None,
    license_status: str = "LICENSED",
    mce_endorsed: bool = False,
    memory_care_disclosure_filed: bool = False,
    mc_signal_explicit_name: bool = False,
    mc_signal_chain_curated: bool = False,
    mc_signal_apfm_listed: bool = False,
    mc_signal_caring_listed: bool = False,
    mc_review_status: str = "auto_published",
    wa_memory_care_certified: bool | None = None,
    wa_earc_sdc_contracted: bool | None = None,
    wa_dementia_specialty: bool | None = None,
    wa_dementia_care_contract: bool | None = None,
    tx_alzheimer_certified: bool | None = None,
    mn_dementia_care_licensed: bool | None = None,
    unendorsed_mc_violation: bool = False,
    beds: int = 50,
) -> str:
    """
    Insert a minimal test facility row and return its uuid.
    All columns default to non-triggering values. Set signal flags as needed.
    """
    fac_id = str(uuid.uuid4())
    suffix = fac_id[:8]
    ext_id = external_id or f"TEST-{suffix}"

    cur.execute(
        """
        INSERT INTO facilities (
            id, state_code, name, city_slug, slug, beds,
            license_status, license_number, publishable, serves_memory_care,
            mce_endorsed, memory_care_disclosure_filed,
            mc_signal_explicit_name, mc_signal_chain_curated,
            mc_signal_apfm_listed, mc_signal_caring_listed,
            mc_review_status,
            wa_memory_care_certified, wa_earc_sdc_contracted,
            wa_dementia_specialty, wa_dementia_care_contract,
            tx_alzheimer_certified, mn_dementia_care_licensed,
            unendorsed_mc_violation,
            care_category, source_url, external_id
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s, false, false,
            %s, %s,
            %s, %s,
            %s, %s,
            %s,
            %s, %s,
            %s, %s,
            %s, %s,
            %s,
            'rcfe_memory_care', 'https://test.example.com', %s
        )
        """,
        (
            fac_id, state_code, f"Test Facility {suffix}", "test-city", f"test-facility-{suffix}", beds,
            license_status, ext_id, False,
            mce_endorsed, memory_care_disclosure_filed,
            mc_signal_explicit_name, mc_signal_chain_curated,
            mc_signal_apfm_listed, mc_signal_caring_listed,
            mc_review_status,
            wa_memory_care_certified, wa_earc_sdc_contracted,
            wa_dementia_specialty, wa_dementia_care_contract,
            tx_alzheimer_certified, mn_dementia_care_licensed,
            unendorsed_mc_violation,
            ext_id,
        ),
    )
    return fac_id


def _get_facility(cur, fac_id: str) -> dict:
    cur.execute(
        "SELECT serves_memory_care, publishable, mc_review_status FROM facilities WHERE id = %s",
        (fac_id,),
    )
    row = cur.fetchone()
    assert row is not None, f"Facility {fac_id} not found after insert"
    return {
        "serves_memory_care": row[0],
        "publishable": row[1],
        "mc_review_status": row[2],
    }


def _insert_inspection(cur, fac_id: str, *, months_ago: int = 12) -> str:
    insp_id = str(uuid.uuid4())
    insp_date = date.today().replace(month=date.today().month - (months_ago % 12) or 12)
    # Simple date arithmetic — just need any valid date within the window
    from datetime import timedelta
    insp_date = date.today() - timedelta(days=months_ago * 30)
    cur.execute(
        """
        INSERT INTO inspections (
            id, facility_id, inspection_date, is_complaint,
            source_url, source_agency
        ) VALUES (%s, %s, %s, false, 'https://test.example.com', 'TEST')
        """,
        (insp_id, fac_id, insp_date.isoformat()),
    )
    return insp_id


# ═══════════════════════════════════════════════════════════════════════════════
# Core recompute logic: serves_memory_care
# ═══════════════════════════════════════════════════════════════════════════════


class TestRecomputeServesMemoryCare:
    """
    Verifies that recompute_serves_memory_care() correctly sets serves_memory_care
    based on the unified Option C signal model.
    """

    def test_explicit_name_signal_sets_smc(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur, state_code="CA", mc_signal_explicit_name=True
            )
        recompute.recompute_serves_memory_care(db_conn, "CA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is True

    def test_disclosure_filed_sets_smc(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur, state_code="CA", memory_care_disclosure_filed=True
            )
        recompute.recompute_serves_memory_care(db_conn, "CA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is True

    def test_chain_curated_sets_smc(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur, state_code="CA", mc_signal_chain_curated=True
            )
        recompute.recompute_serves_memory_care(db_conn, "CA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is True

    def test_apfm_and_caring_intersection_sets_smc(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur,
                state_code="CA",
                mc_signal_apfm_listed=True,
                mc_signal_caring_listed=True,
            )
        recompute.recompute_serves_memory_care(db_conn, "CA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is True

    def test_apfm_only_does_not_set_smc(self, db_conn) -> None:
        """APFM alone is not sufficient — requires BOTH directories (Option C)."""
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur,
                state_code="CA",
                mc_signal_apfm_listed=True,
                mc_signal_caring_listed=False,
            )
        recompute.recompute_serves_memory_care(db_conn, "CA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is False

    def test_caring_only_does_not_set_smc(self, db_conn) -> None:
        """Caring.com alone is not sufficient."""
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur,
                state_code="CA",
                mc_signal_apfm_listed=False,
                mc_signal_caring_listed=True,
            )
        recompute.recompute_serves_memory_care(db_conn, "CA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is False

    def test_no_signals_clears_smc(self, db_conn) -> None:
        """Facility with no signals should have serves_memory_care=false."""
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(cur, state_code="CA")
        recompute.recompute_serves_memory_care(db_conn, "CA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is False


class TestRecomputeServesMemoryCareStateSpecific:
    """
    State-specific Tier-1 signals: OR (mce_endorsed), WA (wa_* columns),
    TX (tx_alzheimer_certified), MN (mn_dementia_care_licensed).
    """

    def test_or_mce_endorsed_sets_smc(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur, state_code="OR", mce_endorsed=True
            )
        recompute.recompute_serves_memory_care(db_conn, "OR")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is True

    def test_or_unendorsed_violation_does_not_set_smc(self, db_conn) -> None:
        """
        CRITICAL: unendorsed_mc_violation=true must NEVER promote serves_memory_care.
        (ERRORS.md #2, MEMORY.md: warning flags never promote)
        """
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur,
                state_code="OR",
                mce_endorsed=False,
                unendorsed_mc_violation=True,
                # No other signals set
                memory_care_disclosure_filed=False,
                mc_signal_explicit_name=False,
                mc_signal_chain_curated=False,
                mc_signal_apfm_listed=False,
                mc_signal_caring_listed=False,
            )
        recompute.recompute_serves_memory_care(db_conn, "OR")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is False, (
            "unendorsed_mc_violation=true must NOT promote serves_memory_care "
            "(this was the bug that caused 116 false positives — ERRORS.md #2)"
        )

    def test_wa_memory_care_certified_sets_smc(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur, state_code="WA", wa_memory_care_certified=True
            )
        recompute.recompute_serves_memory_care(db_conn, "WA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is True

    def test_wa_earc_sdc_contracted_sets_smc(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur, state_code="WA", wa_earc_sdc_contracted=True
            )
        recompute.recompute_serves_memory_care(db_conn, "WA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is True

    def test_wa_dementia_specialty_sets_smc(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur, state_code="WA", wa_dementia_specialty=True
            )
        recompute.recompute_serves_memory_care(db_conn, "WA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is True

    def test_wa_all_three_signals_false_clears_smc(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur,
                state_code="WA",
                wa_memory_care_certified=False,
                wa_earc_sdc_contracted=False,
                wa_dementia_specialty=False,
                wa_dementia_care_contract=False,
            )
        recompute.recompute_serves_memory_care(db_conn, "WA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is False

    def test_tx_alzheimer_certified_sets_smc(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur, state_code="TX", tx_alzheimer_certified=True
            )
        recompute.recompute_serves_memory_care(db_conn, "TX")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is True

    def test_mn_dementia_care_licensed_sets_smc(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur, state_code="MN", mn_dementia_care_licensed=True
            )
        recompute.recompute_serves_memory_care(db_conn, "MN")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["serves_memory_care"] is True


# ═══════════════════════════════════════════════════════════════════════════════
# Publishable gate: license_status + serves_memory_care + review status
# ═══════════════════════════════════════════════════════════════════════════════


class TestRecomputePublishable:
    """
    recompute_publishable() gates on serves_memory_care=true AND license_status='LICENSED'
    AND mc_review_status != 'reviewed_reject'.
    """

    def test_eligible_ca_facility_becomes_publishable(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur,
                state_code="CA",
                mc_signal_explicit_name=True,
                license_status="LICENSED",
            )
        recompute.recompute_serves_memory_care(db_conn, "CA")
        recompute.recompute_publishable(db_conn, "CA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["publishable"] is True

    def test_unlicensed_facility_not_publishable(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur,
                state_code="CA",
                mc_signal_explicit_name=True,
                license_status="CLOSED",
            )
        recompute.recompute_serves_memory_care(db_conn, "CA")
        recompute.recompute_publishable(db_conn, "CA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["publishable"] is False, "CLOSED facilities must not be publishable"

    def test_reviewed_reject_blocks_publication(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur,
                state_code="CA",
                mc_signal_explicit_name=True,
                license_status="LICENSED",
                mc_review_status="reviewed_reject",
            )
        recompute.recompute_serves_memory_care(db_conn, "CA")
        recompute.recompute_publishable(db_conn, "CA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["publishable"] is False, (
            "mc_review_status='reviewed_reject' must block publication"
        )

    def test_no_signals_not_publishable(self, db_conn) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur, state_code="CA", license_status="LICENSED"
            )
        recompute.recompute_serves_memory_care(db_conn, "CA")
        recompute.recompute_publishable(db_conn, "CA")
        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)
        assert row["publishable"] is False, (
            "Facility with no MC signals must not be publishable"
        )


class TestRecomputeFreshnessGates:
    """
    For OR, WA, TX, MN: publishable requires at least one inspection
    within the freshness window.
    """

    @pytest.mark.parametrize("state_code,months", [
        ("OR", 36),
        ("WA", 48),
        ("TX", 48),
        ("MN", 48),
    ])
    def test_facility_with_fresh_inspection_is_publishable(
        self, state_code: str, months: int, db_conn
    ) -> None:
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur,
                state_code=state_code,
                license_status="LICENSED",
                mce_endorsed=(state_code == "OR"),
                wa_memory_care_certified=(state_code == "WA") or None,
                tx_alzheimer_certified=(state_code == "TX") or None,
                mn_dementia_care_licensed=(state_code == "MN") or None,
            )
            _insert_inspection(cur, fac_id, months_ago=months // 2)  # within window

        recompute.recompute_serves_memory_care(db_conn, state_code)
        recompute.recompute_publishable(db_conn, state_code)

        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)

        assert row["serves_memory_care"] is True, (
            f"{state_code}: serves_memory_care should be True with appropriate signal"
        )
        assert row["publishable"] is True, (
            f"{state_code}: facility with fresh inspection should be publishable"
        )

    @pytest.mark.parametrize("state_code,months", [
        ("OR", 36),
        ("WA", 48),
        ("TX", 48),
        ("MN", 48),
    ])
    def test_facility_without_inspection_not_publishable(
        self, state_code: str, months: int, db_conn
    ) -> None:
        """Facilities with no inspection should not pass the freshness gate."""
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur,
                state_code=state_code,
                license_status="LICENSED",
                mce_endorsed=(state_code == "OR"),
                wa_memory_care_certified=(state_code == "WA") or None,
                tx_alzheimer_certified=(state_code == "TX") or None,
                mn_dementia_care_licensed=(state_code == "MN") or None,
            )
            # Insert NO inspection

        recompute.recompute_serves_memory_care(db_conn, state_code)
        recompute.recompute_publishable(db_conn, state_code)

        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)

        assert row["publishable"] is False, (
            f"{state_code}: facility with no inspection should not pass freshness gate"
        )

    @pytest.mark.parametrize("state_code,months", [
        ("OR", 36),
        ("WA", 48),
    ])
    def test_stale_inspection_blocks_publication(
        self, state_code: str, months: int, db_conn
    ) -> None:
        """Inspection outside the freshness window should NOT satisfy the gate."""
        stale_months = months + 6  # clearly outside window
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur,
                state_code=state_code,
                license_status="LICENSED",
                mce_endorsed=(state_code == "OR"),
                wa_memory_care_certified=(state_code == "WA") or None,
            )
            _insert_inspection(cur, fac_id, months_ago=stale_months)  # outside window

        recompute.recompute_serves_memory_care(db_conn, state_code)
        recompute.recompute_publishable(db_conn, state_code)

        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)

        assert row["publishable"] is False, (
            f"{state_code}: facility with only a {stale_months}-month-old inspection "
            f"should not pass the {months}-month freshness gate"
        )

    def test_ca_has_no_freshness_gate(self, db_conn) -> None:
        """CA has no freshness gate — facility is publishable without any inspection."""
        with db_conn.cursor() as cur:
            fac_id = _insert_test_facility(
                cur,
                state_code="CA",
                license_status="LICENSED",
                mc_signal_explicit_name=True,
            )
            # No inspection inserted

        recompute.recompute_serves_memory_care(db_conn, "CA")
        recompute.recompute_publishable(db_conn, "CA")

        with db_conn.cursor() as cur:
            row = _get_facility(cur, fac_id)

        assert row["publishable"] is True, (
            "CA has no freshness gate — MC facility should be publishable without inspections"
        )
