"""
Layer C — Signal computation correctness tests.

Verifies that the serves_memory_care and publishable signals are correctly
computed for every state. Tests run the EXACT SQL from recompute_publishable.py
as a SELECT (read-only) and compare to the actual column values in the DB.

A mismatch means either:
  (a) recompute_publishable.py has not been run since the last ingest, or
  (b) the SQL in this test has drifted from the script.

Both conditions are bugs that would silently produce wrong publish decisions.

No mocks. No fake data. Real DB only.

Run:
    pytest tests/test_signal_computation.py -m db -v
"""
from __future__ import annotations

import pytest

from conftest import ALL_INGESTED_STATES

pytestmark = pytest.mark.db

# ---------------------------------------------------------------------------
# serves_memory_care formula (copied verbatim from recompute_publishable.py)
# Changes here MUST be mirrored in that script, and vice versa.
# ---------------------------------------------------------------------------

_SERVES_MC_FORMULA = """
COALESCE(mc_signal_explicit_name, false)
OR COALESCE(memory_care_disclosure_filed, false)
OR COALESCE(mc_signal_chain_curated, false)
OR (COALESCE(mc_signal_apfm_listed, false) AND COALESCE(mc_signal_caring_listed, false))
OR (mc_review_status = 'reviewed_publish')
OR (state_code = 'WA' AND COALESCE(wa_dementia_care_contract, false))
OR (state_code = 'WA' AND COALESCE(wa_memory_care_certified, false))
OR (state_code = 'WA' AND COALESCE(wa_earc_sdc_contracted, false))
OR (state_code = 'WA' AND COALESCE(wa_dementia_specialty, false))
OR (state_code = 'OR' AND COALESCE(mce_endorsed, false))
OR (state_code = 'MN' AND COALESCE(mn_dementia_care_licensed, false))
OR (state_code = 'TX' AND COALESCE(tx_alzheimer_certified, false))
OR (state_code = 'UT' AND COALESCE(secure_beds, 0) > 0)
OR (state_code = 'IL' AND COALESCE(il_dementia_program_flag, false))
OR (state_code = 'IL' AND COALESCE(il_mc_name_match, false))
OR (state_code = 'PA' AND mc_designation_type IS NOT NULL)
OR (state_code = 'PA' AND license_type = 'ASSISTED LIVING - SPECIAL CARE')
"""

# Freshness gates per state — mirrors _FRESHNESS_MONTHS in recompute_publishable.py
_FRESHNESS_MONTHS = {
    "CA": None,
    "TX": 48,
    "OR": 36,
    "MN": 48,
    "WA": 48,
    "UT": 36,
    "IL": 36,
    "PA": 36,
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestServesMCComputation:
    """serves_memory_care column must match the recompute_publishable.py formula."""

    @pytest.mark.parametrize("state_code", list(ALL_INGESTED_STATES))
    def test_serves_mc_matches_formula(self, db_conn, state_code):
        """
        The serves_memory_care column must equal what the recompute formula produces.
        Any mismatch means either the script hasn't been run or the formula drifted.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT COUNT(*) AS mismatches
                FROM facilities
                WHERE state_code = %s
                  AND license_status = 'LICENSED'
                  AND serves_memory_care IS DISTINCT FROM (
                      {_SERVES_MC_FORMULA}
                  )
                """,
                (state_code,),
            )
            mismatches = cur.fetchone()["mismatches"]

        assert mismatches == 0, (
            f"{state_code}: {mismatches} facilities where serves_memory_care "
            f"doesn't match the recompute_publishable.py formula. "
            "Run: python3 scrapers/recompute_publishable.py --state {state_code}"
        )

    @pytest.mark.parametrize("state_code", list(ALL_INGESTED_STATES))
    def test_no_serves_mc_false_is_publishable(self, db_conn, state_code):
        """
        No facility with serves_memory_care=false may be publishable.
        This is the fundamental gate in recompute_publishable.py.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE state_code = %s
                  AND serves_memory_care = false
                  AND publishable = true
                """,
                (state_code,),
            )
            n = cur.fetchone()["n"]

        assert n == 0, (
            f"{state_code}: {n} facilities are publishable but serves_memory_care=false. "
            "This should be impossible — publishable requires serves_memory_care=true."
        )

    @pytest.mark.parametrize("state_code", list(ALL_INGESTED_STATES))
    def test_no_unlicensed_facility_is_publishable(self, db_conn, state_code):
        """No non-LICENSED facility may be publishable."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE state_code = %s
                  AND license_status != 'LICENSED'
                  AND publishable = true
                """,
                (state_code,),
            )
            n = cur.fetchone()["n"]

        assert n == 0, (
            f"{state_code}: {n} non-LICENSED facilities are publishable. "
            "publishable=true requires license_status='LICENSED'."
        )

    @pytest.mark.parametrize("state_code", list(ALL_INGESTED_STATES))
    def test_no_reviewed_reject_is_publishable(self, db_conn, state_code):
        """No facility with mc_review_status='reviewed_reject' may be publishable."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE state_code = %s
                  AND mc_review_status = 'reviewed_reject'
                  AND publishable = true
                """,
                (state_code,),
            )
            n = cur.fetchone()["n"]

        assert n == 0, (
            f"{state_code}: {n} facilities with mc_review_status='reviewed_reject' are publishable. "
            "reviewed_reject must block publication."
        )


class TestFreshnessGate:
    """Publishable facilities must have an inspection within the per-state freshness window."""

    @pytest.mark.parametrize("state_code,months", [
        ("OR", 36),
        ("TX", 48),
        ("MN", 48),
        ("WA", 48),
        ("UT", 36),
        ("IL", 36),
        ("PA", 36),
    ])
    def test_publishable_has_inspection_within_freshness_window(self, db_conn, state_code, months):
        """
        Every publishable non-CA facility must have ≥1 inspection within the
        freshness window. This mirrors the EXISTS subquery in recompute_publishable.py.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT COUNT(*) AS stale_count
                FROM facilities f
                WHERE f.state_code = %s
                  AND f.publishable = true
                  AND NOT EXISTS (
                      SELECT 1 FROM inspections i
                      WHERE i.facility_id = f.id
                        AND i.inspection_date >= (CURRENT_DATE - INTERVAL '{months} months')
                  )
                """,
                (state_code,),
            )
            stale = cur.fetchone()["stale_count"]

        assert stale == 0, (
            f"{state_code}: {stale} publishable facilities have no inspection "
            f"within {months}-month freshness window. "
            f"recompute_publishable.py freshness gate is not working."
        )

    def test_ca_has_no_freshness_gate(self, db_conn):
        """CA has no freshness gate — every CA publishable facility should be allowed
        regardless of inspection recency (MEMORY.md: 'CA has no freshness gate')."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE state_code = 'CA' AND publishable = true
                """
            )
            n = cur.fetchone()["n"]
        assert n >= 1, "CA must have publishable facilities (no freshness gate applied)"


class TestSignalConsistency:
    """Cross-signal consistency checks that should never be violated."""

    def test_reviewed_publish_overrides_all_signals(self, db_conn):
        """
        A facility with mc_review_status='reviewed_publish' must have
        serves_memory_care=true regardless of other signals.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE mc_review_status = 'reviewed_publish'
                  AND serves_memory_care = false
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} facilities with mc_review_status='reviewed_publish' have "
            "serves_memory_care=false. 'reviewed_publish' must force serves_memory_care=true."
        )

    def test_memory_care_disclosure_implies_serves_mc(self, db_conn):
        """
        memory_care_disclosure_filed=true is a Tier-1 signal and must imply
        serves_memory_care=true. If not, recompute_publishable.py didn't run.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE memory_care_disclosure_filed = true
                  AND serves_memory_care = false
                  AND license_status = 'LICENSED'
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} LICENSED facilities with memory_care_disclosure_filed=true "
            "have serves_memory_care=false. This Tier-1 signal must promote serves_memory_care."
        )

    def test_explicit_name_implies_serves_mc(self, db_conn):
        """mc_signal_explicit_name=true must imply serves_memory_care=true."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE mc_signal_explicit_name = true
                  AND serves_memory_care = false
                  AND license_status = 'LICENSED'
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} LICENSED facilities with mc_signal_explicit_name=true "
            "have serves_memory_care=false. Name keyword is a Tier-1 signal."
        )

    def test_pa_designation_type_implies_disclosure_filed(self, db_conn):
        """
        PA: mc_designation_type IS NOT NULL must imply memory_care_disclosure_filed=true.
        pa_hsd_directory_ingest.py mirrors the designation into the unified column.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE state_code = 'PA'
                  AND mc_designation_type IS NOT NULL
                  AND memory_care_disclosure_filed = false
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} PA facilities with mc_designation_type set have "
            "memory_care_disclosure_filed=false. "
            "pa_hsd_directory_ingest.py must mirror mc_designation_type → memory_care_disclosure_filed."
        )

    def test_wa_any_signal_implies_disclosure_filed(self, db_conn):
        """
        WA: wa_dementia_care_contract=true must imply memory_care_disclosure_filed=true
        (wa_dshs_directory_ingest.py mirrors this per MEMORY.md).
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE state_code = 'WA'
                  AND wa_dementia_care_contract = true
                  AND memory_care_disclosure_filed = false
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} WA facilities with wa_dementia_care_contract=true but "
            "memory_care_disclosure_filed=false. "
            "wa_dshs_directory_ingest.py must mirror the WA contract flag."
        )

    def test_no_needs_review_with_tier1_signal(self, db_conn):
        """
        Facilities with a Tier-1 signal (explicit name, disclosure, curated, APFM∩Caring)
        must NOT be stuck at mc_review_status='needs_review'. They should be promoted
        by recompute_publishable.py step 4.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE license_status = 'LICENSED'
                  AND mc_review_status = 'needs_review'
                  AND (
                      COALESCE(mc_signal_explicit_name, false)
                   OR COALESCE(memory_care_disclosure_filed, false)
                   OR COALESCE(mc_signal_chain_curated, false)
                   OR (COALESCE(mc_signal_apfm_listed, false) AND COALESCE(mc_signal_caring_listed, false))
                  )
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} LICENSED facilities have a Tier-1 MC signal but are still 'needs_review'. "
            "Step 4 of recompute_publishable.py (promote_queue_with_tier1_signals) should clear these."
        )

    @pytest.mark.parametrize("state_code", ["CA", "OR", "WA", "MN", "TX", "UT", "IL", "PA"])
    def test_all_publishable_have_nonnull_mc_review_status(self, db_conn, state_code):
        """mc_review_status must be NOT NULL for every row (default: 'auto_published')."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE state_code = %s AND mc_review_status IS NULL
                """,
                (state_code,),
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{state_code}: {n} facilities have mc_review_status IS NULL. "
            "This column is NOT NULL per MEMORY.md — every row gets 'auto_published' at ingest."
        )
