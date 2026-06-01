"""
Layer E — Per-state ingest completeness tests.

Verifies that each ingested state has the minimum expected number of:
  - Publishable facilities
  - Total inspection records
  - Total deficiency records
  - Coverage of key signal columns

Thresholds are derived from MEMORY.md documented counts and conservative
estimates based on the scraper runs. A test below threshold means an ingest
step was skipped, truncated, or the freshness gate eliminated too many rows.

No mocks. No fake data. Real DB only.

Run:
    pytest tests/test_ingest_completeness.py -m db -v
"""
from __future__ import annotations

import pytest

from conftest import ALL_INGESTED_STATES, MIN_DEFICIENCIES, MIN_INSPECTIONS, MIN_PUBLISHABLE

pytestmark = pytest.mark.db


class TestPublishableCounts:
    """Minimum publishable facility counts per state."""

    @pytest.mark.parametrize("state_code,minimum", sorted(MIN_PUBLISHABLE.items()))
    def test_minimum_publishable_facilities(self, db_conn, state_code, minimum):
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE state_code = %s AND publishable = true",
                (state_code,),
            )
            n = cur.fetchone()["n"]
        assert n >= minimum, (
            f"{state_code}: only {n} publishable facilities (expected ≥{minimum}). "
            f"Run the full ingest pipeline for {state_code} then recompute_publishable.py."
        )

    @pytest.mark.parametrize("state_code", list(ALL_INGESTED_STATES))
    def test_publishable_count_is_nonzero(self, db_conn, state_code):
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE state_code = %s AND publishable = true",
                (state_code,),
            )
            n = cur.fetchone()["n"]
        assert n >= 1, (
            f"{state_code}: zero publishable facilities. "
            "Ingest has not run or all facilities failed the publish gate."
        )

    @pytest.mark.parametrize("state_code,minimum", sorted(MIN_PUBLISHABLE.items()))
    def test_minimum_total_licensed_facilities(self, db_conn, state_code, minimum):
        """Total LICENSED count (publishable + review queue) must exceed publishable minimum."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE state_code = %s AND license_status = 'LICENSED'",
                (state_code,),
            )
            n = cur.fetchone()["n"]
        # Total licensed should exceed publishable (the latter is a subset)
        assert n >= minimum, (
            f"{state_code}: only {n} LICENSED facilities total (expected ≥{minimum}). "
            "Base directory ingest may not have run."
        )


class TestInspectionCounts:
    """Minimum inspection record counts per state."""

    @pytest.mark.parametrize("state_code,minimum", sorted(MIN_INSPECTIONS.items()))
    def test_minimum_inspections(self, db_conn, state_code, minimum):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.state_code = %s
                """,
                (state_code,),
            )
            n = cur.fetchone()["n"]
        assert n >= minimum, (
            f"{state_code}: only {n} inspection records (expected ≥{minimum}). "
            "Run the inspections ingest script for this state."
        )

    @pytest.mark.parametrize("state_code", list(ALL_INGESTED_STATES))
    def test_inspection_count_is_nonzero(self, db_conn, state_code):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM inspections i
                JOIN facilities f ON f.id = i.facility_id WHERE f.state_code = %s
                """,
                (state_code,),
            )
            n = cur.fetchone()["n"]
        assert n >= 1, f"{state_code}: zero inspection records"

    def test_pa_inspection_count_from_memory_md(self, db_conn):
        """
        MEMORY.md 2026-05 documents 12,774 PA inspections.
        This test holds the pipeline accountable to that documented result.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM inspections i
                JOIN facilities f ON f.id = i.facility_id WHERE f.state_code = 'PA'
                """
            )
            n = cur.fetchone()["n"]
        assert n >= 12_000, (
            f"PA: {n} inspections found (expected ≥12,000 per MEMORY.md 2026-05 which "
            f"documented 12,774). If PA was re-ingested, update this threshold."
        )


class TestDeficiencyCounts:
    """Minimum deficiency record counts per state."""

    @pytest.mark.parametrize("state_code,minimum", sorted(MIN_DEFICIENCIES.items()))
    def test_minimum_deficiencies(self, db_conn, state_code, minimum):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM deficiencies d
                JOIN inspections i ON i.id = d.inspection_id
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.state_code = %s
                """,
                (state_code,),
            )
            n = cur.fetchone()["n"]
        assert n >= minimum, (
            f"{state_code}: only {n} deficiency records (expected ≥{minimum}). "
            "Run the deficiency/violations ingest script for this state."
        )

    @pytest.mark.parametrize("state_code", ["CA", "OR", "PA"])
    def test_deficiency_ingest_is_nonzero(self, db_conn, state_code):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM deficiencies d
                JOIN inspections i ON i.id = d.inspection_id
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.state_code = %s
                """,
                (state_code,),
            )
            n = cur.fetchone()["n"]
        assert n >= 1, f"{state_code}: zero deficiency records — deficiency ingest never ran"


class TestSignalCoverage:
    """State-specific signal columns must be populated with minimum coverage."""

    def test_ca_memory_care_disclosure_coverage(self, db_conn):
        """CA: ≥100 publishable facilities must have memory_care_disclosure_filed=true."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code='CA' AND publishable=true AND memory_care_disclosure_filed=true
                """
            )
            n = cur.fetchone()["n"]
        assert n >= 100, (
            f"CA: only {n} publishable facilities with memory_care_disclosure_filed=true. "
            "Expected ≥100. Run mc_disclosure_ingest.py or mc_disclosure_filings_import.py."
        )

    def test_pa_mc_designation_type_coverage(self, db_conn):
        """PA: ≥50 publishable facilities must have mc_designation_type IS NOT NULL."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code='PA' AND publishable=true AND mc_designation_type IS NOT NULL
                """
            )
            n = cur.fetchone()["n"]
        assert n >= 50, (
            f"PA: only {n} publishable facilities with mc_designation_type set. "
            "Expected ≥50. Run pa_hsd_directory_ingest.py."
        )

    def test_pa_publishable_count_from_memory_md(self, db_conn):
        """MEMORY.md documents 355 publishable PA facilities (2026-05-24)."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE state_code='PA' AND publishable=true"
            )
            n = cur.fetchone()["n"]
        assert n >= 300, (
            f"PA: {n} publishable facilities (MEMORY.md documents 355). "
            "If threshold seems wrong, check pa_hsd_directory_ingest.py + recompute."
        )

    def test_or_mce_endorsed_coverage(self, db_conn):
        """OR: ≥20 publishable facilities must have mce_endorsed=true."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code='OR' AND publishable=true AND mce_endorsed=true
                """
            )
            n = cur.fetchone()["n"]
        assert n >= 20, (
            f"OR: only {n} publishable MCE-endorsed facilities. Expected ≥20. "
            "Run or_signal_mce.py."
        )

    def test_wa_mc_signal_coverage(self, db_conn):
        """WA: ≥20 publishable facilities must have at least one WA MC signal."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code='WA' AND publishable=true
                  AND (wa_memory_care_certified OR wa_earc_sdc_contracted OR wa_dementia_specialty)
                """
            )
            n = cur.fetchone()["n"]
        assert n >= 20, (
            f"WA: only {n} publishable facilities with a WA MC signal. Expected ≥20."
        )

    def test_mn_dementia_care_licensed_coverage(self, db_conn):
        """MN: ≥10 publishable facilities must have mn_dementia_care_licensed=true."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code='MN' AND publishable=true AND mn_dementia_care_licensed=true
                """
            )
            n = cur.fetchone()["n"]
        assert n >= 10, (
            f"MN: only {n} publishable facilities with mn_dementia_care_licensed=true. "
            "Expected ≥10."
        )

    def test_tx_alzheimer_certified_coverage(self, db_conn):
        """TX: ≥5 publishable facilities must have tx_alzheimer_certified=true."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code='TX' AND publishable=true AND tx_alzheimer_certified=true
                """
            )
            n = cur.fetchone()["n"]
        assert n >= 5, (
            f"TX: only {n} publishable facilities with tx_alzheimer_certified=true. Expected ≥5."
        )

    def test_ut_secure_beds_coverage(self, db_conn):
        """UT: ≥5 publishable facilities must have secure_beds > 0."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code='UT' AND publishable=true AND secure_beds > 0
                """
            )
            n = cur.fetchone()["n"]
        assert n >= 5, (
            f"UT: only {n} publishable facilities with secure_beds>0. Expected ≥5."
        )


class TestIngestSequencing:
    """Verify that ingest steps ran in the correct order (ERRORS.md 2026-05 sequencing bugs)."""

    def test_deficiencies_not_ingested_before_inspections(self, db_conn):
        """
        ERRORS.md 2026-05: violations ingest before inspections ingest causes 0 deficiency inserts
        because deficiencies.inspection_id is NOT NULL.
        This test verifies there are no orphan deficiency attempts (proxy: check total counts).
        """
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM deficiencies")
            def_count = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(*) AS n FROM inspections")
            insp_count = cur.fetchone()["n"]

        if insp_count == 0:
            pytest.skip("No inspections yet — skipping sequencing check")

        # If deficiency ingest ran but inspections didn't first, deficiency count = 0
        assert def_count >= 1, (
            "0 deficiency records even though inspections exist. "
            "ERRORS.md 2026-05: deficiency ingest ran before inspections ingest."
        )

    def test_recompute_ran_after_ingest(self, db_conn):
        """
        serves_memory_care and publishable flags must be consistent (recompute ran).
        Proxy: count of publishable=true must be > 0 for every ingested state.
        If recompute_publishable.py never ran, publishable stays false even for valid MC facilities.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, COUNT(*) FILTER (WHERE publishable=true) AS pub_count
                FROM facilities
                WHERE state_code IN ('CA','OR','WA','MN','TX','UT','IL','PA')
                GROUP BY state_code
                """
            )
            rows = cur.fetchall()

        states_with_zero = [r["state_code"] for r in rows if (r["pub_count"] or 0) == 0]
        assert not states_with_zero, (
            f"States with 0 publishable facilities: {states_with_zero}. "
            "recompute_publishable.py has not run for these states."
        )

    def test_no_state_has_only_needs_review(self, db_conn):
        """
        If an entire state's facilities are stuck at 'needs_review', it means
        recompute_publishable.py ran but found no Tier-1 signals — indicating
        an upstream ingest failure (signal columns were never populated).
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT state_code,
                    COUNT(*) FILTER (WHERE mc_review_status = 'needs_review') AS nr,
                    COUNT(*) FILTER (WHERE mc_review_status = 'auto_published') AS ap,
                    COUNT(*) AS total
                FROM facilities
                WHERE state_code IN ('CA','OR','WA','MN','TX','UT','IL','PA')
                  AND license_status = 'LICENSED'
                GROUP BY state_code
                HAVING COUNT(*) FILTER (WHERE mc_review_status = 'auto_published') = 0
                """
            )
            all_needs_review = cur.fetchall()

        assert not all_needs_review, (
            f"States where ALL licensed facilities are 'needs_review' "
            f"(no 'auto_published' rows): "
            f"{[r['state_code'] for r in all_needs_review]}. "
            "Signal columns may not have been populated before recompute ran."
        )


class TestDataFreshness:
    """Verify that facility data is not stale (within acceptable update windows)."""

    @pytest.mark.parametrize("state_code", ["CA", "OR", "WA", "MN", "TX", "UT", "IL"])
    def test_most_recently_updated_facility_within_90_days(self, db_conn, state_code):
        """
        The most-recently-updated publishable facility per state must be within 90 days.
        This matches the check in db_invariants.py.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    MAX(updated_at) AS most_recent,
                    EXTRACT(DAY FROM NOW() - MAX(updated_at)) AS days_ago
                FROM facilities
                WHERE state_code = %s AND publishable = true
                """,
                (state_code,),
            )
            row = cur.fetchone()

        if row["most_recent"] is None:
            pytest.skip(f"No publishable facilities for {state_code}")

        days_ago = float(row["days_ago"] or 999)
        assert days_ago <= 90, (
            f"{state_code}: most recent facility update was {days_ago:.0f} days ago "
            f"(threshold: 90 days). Scraper may not have run recently."
        )

    def test_pa_has_inspections_within_freshness_window(self, db_conn):
        """
        PA freshness gate = 36 months. Every publishable PA facility must have
        an inspection within 36 months (verified by recompute_publishable.py,
        confirmed here independently).
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities f
                WHERE f.state_code = 'PA' AND f.publishable = true
                  AND NOT EXISTS (
                      SELECT 1 FROM inspections i
                      WHERE i.facility_id = f.id
                        AND i.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
                  )
                """
            )
            stale = cur.fetchone()["n"]
        assert stale == 0, (
            f"PA: {stale} publishable facilities have no inspection in the 36-month window. "
            "The PA freshness gate in recompute_publishable.py is not working."
        )
