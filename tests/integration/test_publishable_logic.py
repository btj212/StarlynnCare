"""
Publishable Logic Tests — validate recompute_publishable.py SQL logic.

These tests verify that the publishable gate logic (Option C tiered signal model)
is correctly applied in the actual database.  They test the OUTCOMES of
recompute_publishable.py, not the script itself.

No mocks.  Real DB queries.

What they prove:
  • Every publishable facility satisfies the gate conditions.
  • No facility passes the gate via a signal combination that the logic prohibits.
  • The freshness gate is correctly applied per state.
  • Facilities that should be in 'needs_review' are actually there.

Run:
    pytest tests/integration/test_publishable_logic.py -v
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

# Freshness gates per state in months (mirrors recompute_publishable.py)
FRESHNESS_MONTHS: dict[str, int | None] = {
    "CA": None,
    "TX": 48,
    "OR": 36,
    "MN": 48,
    "WA": 48,
    "UT": 36,
    "IL": 36,
    "PA": 36,
}

PUBLISHABLE_STATES = ("CA", "OR", "WA", "MN", "TX", "UT", "IL", "PA")


class TestPublishableGateConditions:
    """
    Verify that the three-part publishable gate
    (license + serves_mc + review_status + freshness) is correctly enforced.
    """

    def test_no_unlicensed_facility_is_publishable(self, db):
        """HARD RULE: license_status != 'LICENSED' → publishable must be False."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, name, slug, license_status
                FROM facilities
                WHERE publishable = true AND license_status != 'LICENSED'
                """
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{len(bad)} publishable facilities have license_status != 'LICENSED': "
            f"{[(r['state_code'], r['slug'], r['license_status']) for r in bad[:5]]}"
        )

    def test_no_non_mc_facility_is_publishable(self, db):
        """HARD RULE: serves_memory_care != True → publishable must be False."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, name, slug
                FROM facilities
                WHERE publishable = true AND serves_memory_care != true
                """
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{len(bad)} publishable facilities have serves_memory_care != True: "
            f"{[(r['state_code'], r['slug']) for r in bad[:5]]}"
        )

    def test_no_rejected_facility_is_publishable(self, db):
        """HARD RULE: mc_review_status = 'reviewed_reject' → publishable must be False."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, name, slug
                FROM facilities
                WHERE publishable = true AND mc_review_status = 'reviewed_reject'
                """
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{len(bad)} facilities are 'reviewed_reject' but publishable=True: "
            f"{[(r['state_code'], r['slug']) for r in bad[:5]]}"
        )

    @pytest.mark.parametrize("state", [
        s for s, months in FRESHNESS_MONTHS.items() if months is not None
    ])
    def test_no_stale_facility_is_publishable(self, db, state):
        """
        For states with a freshness gate: no publishable facility's most recent
        inspection can be older than the freshness window.
        """
        months = FRESHNESS_MONTHS[state]
        with db.cursor() as cur:
            cur.execute(
                f"""
                SELECT f.state_code, f.name, f.slug,
                       MAX(i.inspection_date) AS last_insp
                FROM facilities f
                LEFT JOIN inspections i ON i.facility_id = f.id
                WHERE f.publishable = true AND f.state_code = %s
                GROUP BY f.id, f.state_code, f.name, f.slug
                HAVING MAX(i.inspection_date) < CURRENT_DATE - INTERVAL '{months} months'
                    OR MAX(i.inspection_date) IS NULL
                """,
                (state,),
            )
            stale = cur.fetchall()
        assert not stale, (
            f"{state}: {len(stale)} publishable facilities have last inspection "
            f"older than {months} months (freshness gate not applied): "
            f"{[(r['slug'], str(r['last_insp'])) for r in stale[:5]]}"
        )

    def test_ca_has_no_freshness_gate_applied(self, db):
        """CA has no freshness gate — facilities with old inspections can still be publishable."""
        # Verify that there ARE some CA publishable facilities with inspections older than 48 months
        # (this would be blocked in other states but is fine for CA)
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(DISTINCT f.id) AS n
                FROM facilities f
                JOIN inspections i ON i.facility_id = f.id
                WHERE f.state_code = 'CA' AND f.publishable = true
                  AND i.inspection_date < CURRENT_DATE - INTERVAL '48 months'
                """
            )
            n = cur.fetchone()["n"]
        # CA should have many facilities with inspections older than 4 years
        assert n >= 10, (
            f"CA has only {n} publishable facilities with inspections >48 months old — "
            f"expected many (CA has no freshness gate, data goes back years)"
        )


class TestServesMemoryCareLogic:
    """
    Validate serves_memory_care computation against the actual signal columns.
    This mirrors the SQL in recompute_publishable.py exactly.
    """

    def test_serves_mc_true_always_has_at_least_one_signal(self, db):
        """Any facility with serves_memory_care=True has at least one qualifying signal."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, name, slug
                FROM facilities
                WHERE serves_memory_care = true
                  AND license_status = 'LICENSED'
                  AND NOT (
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
                  )
                ORDER BY state_code, name
                """
            )
            orphans = cur.fetchall()
        assert not orphans, (
            f"{len(orphans)} licensed facilities have serves_memory_care=True with no signal: "
            f"{[(r['state_code'], r['slug']) for r in orphans[:10]]}"
        )

    def test_or_unendorsed_violation_does_not_set_serves_mc(self, db):
        """
        OR facilities with ONLY unendorsed_mc_violation=True must NOT have
        serves_memory_care=True.  This is the key ERRORS.md rule (item: 2026-05 OR).
        """
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT slug, serves_memory_care, mce_endorsed
                FROM facilities
                WHERE state_code = 'OR'
                  AND COALESCE(unendorsed_mc_violation, false) = true
                  AND NOT COALESCE(mce_endorsed, false)
                  AND NOT COALESCE(mc_signal_explicit_name, false)
                  AND NOT COALESCE(memory_care_disclosure_filed, false)
                  AND NOT COALESCE(mc_signal_chain_curated, false)
                  AND NOT (COALESCE(mc_signal_apfm_listed, false) AND COALESCE(mc_signal_caring_listed, false))
                  AND mc_review_status != 'reviewed_publish'
                  AND serves_memory_care = true
                """
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{len(bad)} OR facilities have serves_memory_care=True solely via "
            f"unendorsed_mc_violation (ERRORS.md: this must NOT happen): "
            f"{[r['slug'] for r in bad[:5]]}"
        )

    def test_needs_review_count_is_bounded(self, db):
        """
        mc_review_status='needs_review' count is < 20% of total licensed facilities.
        A large needs_review backlog suggests a signal ingest failure.
        """
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE mc_review_status = 'needs_review') AS needs_review
                FROM facilities
                WHERE license_status = 'LICENSED'
                """
            )
            row = cur.fetchone()
        total = row["total"] or 1
        needs_review = row["needs_review"] or 0
        pct = needs_review / total * 100
        assert pct <= 20, (
            f"{pct:.1f}% of LICENSED facilities are in 'needs_review' ({needs_review}/{total}). "
            f"Large backlog suggests signal ingest hasn't run recently."
        )

    @pytest.mark.parametrize("state", PUBLISHABLE_STATES)
    def test_chain_only_facilities_are_in_review_not_auto_published(self, db, state):
        """
        Facilities whose only signal is chain-name (not chain-curated) must be in
        'needs_review', not 'auto_published'.  This is step 3a of recompute_publishable.
        """
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT name, slug, mc_review_status
                FROM facilities
                WHERE state_code = %s
                  AND license_status = 'LICENSED'
                  AND COALESCE(mc_signal_chain_name, false) = true
                  AND NOT COALESCE(mc_signal_explicit_name, false)
                  AND NOT COALESCE(memory_care_disclosure_filed, false)
                  AND NOT COALESCE(mc_signal_chain_curated, false)
                  AND NOT (COALESCE(mc_signal_apfm_listed, false) AND COALESCE(mc_signal_caring_listed, false))
                  AND mc_review_status = 'auto_published'
                """,
                (state,),
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{state}: {len(bad)} chain-name-only facilities are 'auto_published' "
            f"(should be 'needs_review' per step 3a): "
            f"{[r['slug'] for r in bad[:5]]}"
        )


class TestFreshnessGateByState:
    """
    For each state with a freshness gate, verify the gate is correctly applied:
    • Publishable facilities all have a recent inspection.
    • Non-publishable facilities without recent inspections are correctly excluded.
    """

    @pytest.mark.parametrize("state,months", [
        (s, m) for s, m in FRESHNESS_MONTHS.items() if m is not None
    ])
    def test_all_publishable_have_recent_inspection(self, db, state, months):
        """All publishable facilities for this state have an inspection within the freshness window."""
        with db.cursor() as cur:
            cur.execute(
                f"""
                SELECT f.slug, MAX(i.inspection_date) AS last_insp
                FROM facilities f
                LEFT JOIN inspections i ON i.facility_id = f.id
                WHERE f.state_code = %s AND f.publishable = true
                GROUP BY f.id, f.slug
                HAVING MAX(i.inspection_date) IS NULL
                    OR MAX(i.inspection_date) < CURRENT_DATE - INTERVAL '{months} months'
                """,
                (state,),
            )
            stale = cur.fetchall()
        assert not stale, (
            f"{state}: {len(stale)} publishable facilities have no inspection within "
            f"{months} months (freshness gate broken): "
            f"{[(r['slug'], str(r['last_insp'])) for r in stale[:5]]}"
        )

    @pytest.mark.parametrize("state,months", [
        (s, m) for s, m in FRESHNESS_MONTHS.items() if m is not None
    ])
    def test_freshness_window_has_real_inspections(self, db, state, months):
        """The freshness window for this state is non-empty (data hasn't dried up)."""
        with db.cursor() as cur:
            cur.execute(
                f"""
                SELECT COUNT(DISTINCT i.facility_id) AS n
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.state_code = %s
                  AND i.inspection_date >= CURRENT_DATE - INTERVAL '{months} months'
                """,
                (state,),
            )
            n = cur.fetchone()["n"]
        assert n >= 5, (
            f"{state}: only {n} facilities have inspections within {months}-month window — "
            f"freshness window may be too narrow or ingest has stalled"
        )


class TestHasInspectionTextFlag:
    """
    has_inspection_text flag must correctly reflect whether the facility has real
    parsed narrative text.  This controls whether grade/percentile is shown on the
    profile page.
    """

    def test_ca_facilities_mostly_have_inspection_text(self, db):
        """At least 80% of CA publishable facilities have has_inspection_text=True."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE has_inspection_text = true) AS with_text
                FROM facilities
                WHERE state_code = 'CA' AND publishable = true
                  AND has_inspection_text IS NOT NULL
                """
            )
            row = cur.fetchone()
        total = row["total"] or 0
        if total == 0:
            pytest.skip("No CA publishable facilities with has_inspection_text set")
        pct = row["with_text"] / total * 100
        assert pct >= 80, (
            f"Only {pct:.1f}% of CA publishable facilities have has_inspection_text=True "
            f"({row['with_text']}/{total}). CA should have high narrative coverage."
        )

    def test_wa_facilities_with_text_have_real_narrative(self, db):
        """
        WA facilities marked has_inspection_text=True actually have inspections
        with non-placeholder narrative text in raw_data.
        """
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT f.slug, i.id AS insp_id, i.raw_data->>'narrative' AS narrative
                FROM facilities f
                JOIN inspections i ON i.facility_id = f.id
                WHERE f.state_code = 'WA' AND f.publishable = true
                  AND f.has_inspection_text = true
                  AND i.inspection_date >= CURRENT_DATE - INTERVAL '48 months'
                ORDER BY f.slug, i.inspection_date DESC
                LIMIT 20
                """
            )
            rows = cur.fetchall()

        if not rows:
            pytest.skip("No WA publishable facilities with has_inspection_text=True and inspections")

        placeholder_re_pattern = "WA DSHS report:"
        bad = []
        for row in rows:
            narrative = row["narrative"] or ""
            if narrative and placeholder_re_pattern in narrative and len(narrative) < 200:
                bad.append(row["slug"])

        assert not bad, (
            f"{len(bad)} WA facilities are marked has_inspection_text=True but their "
            f"narratives are WA placeholder strings: {bad[:5]}"
        )
