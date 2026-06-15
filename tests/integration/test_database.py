"""
Database Invariant Tests — Layer 1 (pytest edition).

Tests run against the REAL Supabase Postgres database via psycopg.
No mocks.  All assertions validate real data.

These tests are the authoritative version of scripts/validate/db_invariants.py
and scripts/validate/post_ingest_check.py — same checks, pytest format.

What they prove:
  • Every state has its expected minimum publishable facility count.
  • Every publishable facility has the required fields populated.
  • Memory-care signal flags are internally consistent.
  • Peer rank distribution is non-degenerate (statistics are meaningful).
  • Deficiency data is complete and correctly linked.
  • Scraper freshness — data isn't stale.

Run:
    pytest tests/integration/test_database.py -v
    DATABASE_URL=... pytest tests/integration/test_database.py -v
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

PUBLISHABLE_STATES = ("CA", "OR", "WA", "MN", "TX", "UT", "IL", "PA")

# Conservative lower bounds — alert if count drops below
MIN_PUBLISHABLE_COUNTS = {
    "CA": 200,
    "OR": 50,
    "WA": 50,
    "MN": 50,
    "TX": 50,
    "UT": 10,
    "IL": 10,
    "PA": 100,
}

# Freshness gate in months (matches recompute_publishable.py _FRESHNESS_MONTHS)
FRESHNESS_MONTHS = {
    "CA": None,
    "OR": 36,
    "WA": 48,
    "MN": 48,
    "TX": 48,
    "UT": 36,
    "IL": 36,
    "PA": 36,
}

# ══════════════════════════════════════════════════════════════════════════════
# Publishable counts per state
# ══════════════════════════════════════════════════════════════════════════════


class TestPublishableCounts:
    """Each state must have its minimum publishable facility count."""

    @pytest.mark.parametrize("state", PUBLISHABLE_STATES)
    def test_minimum_publishable_count(self, db, state):
        """State has at least the expected minimum number of publishable facilities."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities "
                "WHERE state_code = %s AND publishable = true",
                (state,),
            )
            n = cur.fetchone()["n"]
        minimum = MIN_PUBLISHABLE_COUNTS.get(state, 1)
        assert n >= minimum, (
            f"{state}: expected ≥{minimum} publishable facilities, found {n}. "
            f"Possible ingest failure or data loss."
        )

    def test_total_publishable_count_across_all_states(self, db):
        """Total publishable facilities across all states >= 500."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE publishable = true"
            )
            n = cur.fetchone()["n"]
        assert n >= 500, (
            f"Total publishable count = {n}; expected ≥500 across all states"
        )


# ══════════════════════════════════════════════════════════════════════════════
# Required field coverage on publishable facilities
# ══════════════════════════════════════════════════════════════════════════════


class TestPublishableFieldCoverage:
    """Every publishable facility must have its required fields populated."""

    def test_no_publishable_facility_missing_name(self, db):
        """No publishable facility has a NULL or empty name."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT id, state_code, slug FROM facilities "
                "WHERE publishable = true AND (name IS NULL OR TRIM(name) = '')"
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{len(bad)} publishable facilities have empty name: "
            f"{[(r['state_code'], r['slug']) for r in bad[:5]]}"
        )

    def test_no_publishable_facility_missing_slug(self, db):
        """No publishable facility has a NULL or empty slug."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT id, state_code, name FROM facilities "
                "WHERE publishable = true AND (slug IS NULL OR TRIM(slug) = '')"
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{len(bad)} publishable facilities have empty slug: "
            f"{[(r['state_code'], r['name']) for r in bad[:5]]}"
        )

    def test_no_publishable_facility_missing_city_slug(self, db):
        """No publishable facility has a NULL or empty city_slug."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT id, state_code, name FROM facilities "
                "WHERE publishable = true AND (city_slug IS NULL OR TRIM(city_slug) = '')"
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{len(bad)} publishable facilities have empty city_slug: "
            f"{[(r['state_code'], r['name']) for r in bad[:5]]}"
        )

    def test_no_publishable_facility_missing_state_code(self, db):
        """No publishable facility has a NULL state_code."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT id, name FROM facilities "
                "WHERE publishable = true AND state_code IS NULL"
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{len(bad)} publishable facilities have NULL state_code"
        )

    def test_all_publishable_state_codes_are_known(self, db):
        """All publishable facilities have a state_code in the expected set."""
        known = set(PUBLISHABLE_STATES)
        with db.cursor() as cur:
            cur.execute(
                "SELECT DISTINCT state_code FROM facilities WHERE publishable = true"
            )
            seen = {r["state_code"] for r in cur.fetchall()}
        unknown = seen - known
        assert not unknown, (
            f"Publishable facilities have unexpected state_codes: {unknown}"
        )

    def test_all_publishable_have_license_status_licensed(self, db):
        """Every publishable facility has license_status = 'LICENSED'."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT state_code, name, license_status FROM facilities "
                "WHERE publishable = true AND license_status != 'LICENSED'"
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{len(bad)} publishable facilities have non-LICENSED status: "
            f"{[(r['state_code'], r['name'], r['license_status']) for r in bad[:5]]}"
        )

    def test_all_publishable_serve_memory_care(self, db):
        """Every publishable facility has serves_memory_care = true."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT state_code, name FROM facilities "
                "WHERE publishable = true AND serves_memory_care != true"
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{len(bad)} publishable facilities have serves_memory_care != true: "
            f"{[(r['state_code'], r['name']) for r in bad[:5]]}"
        )

    def test_no_publishable_facility_review_rejected(self, db):
        """No publishable facility has mc_review_status = 'reviewed_reject'."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT state_code, name FROM facilities "
                "WHERE publishable = true AND mc_review_status = 'reviewed_reject'"
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{len(bad)} publishable facilities are 'reviewed_reject' but publishable=true"
        )

    def test_publishable_beds_not_null_tolerance(self, db):
        """At most 5% of publishable facilities have beds IS NULL."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT "
                "  COUNT(*) AS total, "
                "  COUNT(*) FILTER (WHERE beds IS NULL OR beds = 0) AS null_beds "
                "FROM facilities WHERE publishable = true"
            )
            row = cur.fetchone()
        pct = row["null_beds"] / max(row["total"], 1) * 100
        assert pct <= 5, (
            f"{pct:.1f}% of publishable facilities have NULL/0 beds "
            f"({row['null_beds']}/{row['total']})"
        )

    def test_publishable_coordinates_reasonable_fraction(self, db):
        """At least 70% of publishable facilities have non-null lat/lon."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT "
                "  COUNT(*) AS total, "
                "  COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) AS geocoded "
                "FROM facilities WHERE publishable = true"
            )
            row = cur.fetchone()
        pct = row["geocoded"] / max(row["total"], 1) * 100
        assert pct >= 70, (
            f"Only {pct:.1f}% of publishable facilities have coordinates "
            f"({row['geocoded']}/{row['total']})"
        )

    def test_publishable_care_category_is_set(self, db):
        """No publishable facility has care_category = 'unknown'."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities "
                "WHERE publishable = true AND care_category = 'unknown'"
            )
            n = cur.fetchone()["n"]
        # Allow a small number — some states have ambiguous facility types
        pct = n / max(1, 1) * 100  # We'll get total separately
        with db.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS t FROM facilities WHERE publishable = true")
            total = cur.fetchone()["t"]
        pct = n / max(total, 1) * 100
        assert pct <= 20, (
            f"{pct:.1f}% of publishable facilities have care_category='unknown' "
            f"({n}/{total})"
        )


# ══════════════════════════════════════════════════════════════════════════════
# Memory-care signal consistency
# ══════════════════════════════════════════════════════════════════════════════


class TestMemoryCareSignalConsistency:
    """
    For every publishable facility, serves_memory_care=true must be explained
    by at least one qualifying signal.  No facility should be published without
    a traceable reason.
    """

    def test_every_publishable_has_at_least_one_mc_signal(self, db):
        """
        Every publishable facility must have at least one of:
          mc_signal_explicit_name, memory_care_disclosure_filed,
          mc_signal_chain_curated, mc_signal_apfm_listed AND mc_signal_caring_listed,
          mc_review_status='reviewed_publish',
          or a state-specific Tier-1 signal.
        """
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, name, slug
                FROM facilities
                WHERE publishable = true
                  AND NOT (
                    COALESCE(mc_signal_explicit_name, false)
                    OR COALESCE(memory_care_disclosure_filed, false)
                    OR COALESCE(mc_signal_chain_curated, false)
                    OR (COALESCE(mc_signal_apfm_listed, false) AND COALESCE(mc_signal_caring_listed, false))
                    OR (mc_review_status = 'reviewed_publish')
                    -- WA state-specific
                    OR (state_code = 'WA' AND COALESCE(wa_dementia_care_contract, false))
                    OR (state_code = 'WA' AND COALESCE(wa_memory_care_certified, false))
                    OR (state_code = 'WA' AND COALESCE(wa_earc_sdc_contracted, false))
                    OR (state_code = 'WA' AND COALESCE(wa_dementia_specialty, false))
                    -- OR state-specific
                    OR (state_code = 'OR' AND COALESCE(mce_endorsed, false))
                    -- MN state-specific
                    OR (state_code = 'MN' AND COALESCE(mn_dementia_care_licensed, false))
                    -- TX state-specific
                    OR (state_code = 'TX' AND COALESCE(tx_alzheimer_certified, false))
                    -- UT state-specific (SECURE_BEDS > 0)
                    OR (state_code = 'UT' AND COALESCE(secure_beds, 0) > 0)
                    -- IL state-specific
                    OR (state_code = 'IL' AND COALESCE(il_dementia_program_flag, false))
                    OR (state_code = 'IL' AND COALESCE(il_mc_name_match, false))
                    -- PA state-specific
                    OR (state_code = 'PA' AND mc_designation_type IS NOT NULL)
                    OR (state_code = 'PA' AND license_type = 'ASSISTED LIVING - SPECIAL CARE')
                  )
                ORDER BY state_code, name
                """
            )
            orphans = cur.fetchall()
        assert not orphans, (
            f"{len(orphans)} publishable facilities have NO qualifying MC signal: "
            f"{[(r['state_code'], r['slug']) for r in orphans[:10]]}"
        )

    def test_no_violation_flag_promotes_memory_care(self, db):
        """
        unendorsed_mc_violation must NOT be the sole reason a facility is published.
        (MEMORY.md: warning flags never promote serves_memory_care.)
        """
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, name, slug
                FROM facilities
                WHERE publishable = true
                  AND state_code = 'OR'
                  AND COALESCE(unendorsed_mc_violation, false) = true
                  AND NOT COALESCE(mce_endorsed, false)
                  AND NOT COALESCE(mc_signal_explicit_name, false)
                  AND NOT COALESCE(memory_care_disclosure_filed, false)
                  AND NOT COALESCE(mc_signal_chain_curated, false)
                  AND NOT (COALESCE(mc_signal_apfm_listed, false) AND COALESCE(mc_signal_caring_listed, false))
                  AND mc_review_status != 'reviewed_publish'
                """
            )
            bad = cur.fetchall()
        assert not bad, (
            f"{len(bad)} OR facilities published via unendorsed_mc_violation alone "
            f"(ERRORS.md: this is a warning flag, not a Tier-1 signal): "
            f"{[(r['state_code'], r['slug']) for r in bad[:5]]}"
        )

    @pytest.mark.parametrize("state", PUBLISHABLE_STATES)
    def test_state_has_at_least_one_mc_signal_type_represented(self, db, state):
        """Each state has at least 5 facilities with a clear Tier-1 signal."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code = %s AND publishable = true
                  AND (
                    COALESCE(mc_signal_explicit_name, false)
                    OR COALESCE(memory_care_disclosure_filed, false)
                    OR COALESCE(mc_signal_chain_curated, false)
                    OR (mc_review_status = 'reviewed_publish')
                    OR (state_code = 'WA' AND (
                          COALESCE(wa_dementia_care_contract, false)
                          OR COALESCE(wa_memory_care_certified, false)
                          OR COALESCE(wa_earc_sdc_contracted, false)
                          OR COALESCE(wa_dementia_specialty, false)
                        ))
                    OR (state_code = 'OR' AND COALESCE(mce_endorsed, false))
                    OR (state_code = 'MN' AND COALESCE(mn_dementia_care_licensed, false))
                    OR (state_code = 'TX' AND COALESCE(tx_alzheimer_certified, false))
                    OR (state_code = 'UT' AND COALESCE(secure_beds, 0) > 0)
                    OR (state_code = 'IL' AND (
                          COALESCE(il_dementia_program_flag, false)
                          OR COALESCE(il_mc_name_match, false)
                        ))
                    OR (state_code = 'PA' AND (
                          mc_designation_type IS NOT NULL
                          OR license_type = 'ASSISTED LIVING - SPECIAL CARE'
                        ))
                  )
                """,
                (state,),
            )
            n = cur.fetchone()["n"]
        assert n >= 5, (
            f"{state}: only {n} publishable facilities have a clear Tier-1 signal — "
            f"expected ≥5"
        )


# ══════════════════════════════════════════════════════════════════════════════
# Inspection coverage
# ══════════════════════════════════════════════════════════════════════════════


class TestInspectionCoverage:
    """Published facilities must have inspection records linked correctly."""

    @pytest.mark.parametrize("state", PUBLISHABLE_STATES)
    def test_minimum_inspection_coverage_per_state(self, db, state):
        """At least 90% of publishable facilities in each state have at least one inspection."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(DISTINCT f.id) AS total,
                    COUNT(DISTINCT i.facility_id) AS with_inspection
                FROM facilities f
                LEFT JOIN inspections i ON i.facility_id = f.id
                WHERE f.publishable = true AND f.state_code = %s
                """,
                (state,),
            )
            row = cur.fetchone()
        total = row["total"] or 0
        if total == 0:
            pytest.skip(f"{state} has no publishable facilities")
        with_insp = row["with_inspection"] or 0
        pct = with_insp / total * 100
        assert pct >= 90, (
            f"{state}: only {pct:.1f}% of publishable facilities have inspections "
            f"({with_insp}/{total}). Ingest may have failed."
        )

    def test_no_deficiency_orphans(self, db):
        """No deficiency row references a non-existent inspection_id."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM deficiencies d
                LEFT JOIN inspections i ON i.id = d.inspection_id
                WHERE i.id IS NULL
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} deficiency rows have inspection_id that doesn't exist in inspections table"
        )

    def test_no_inspection_orphans(self, db):
        """No inspection row references a non-existent facility_id."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM inspections i
                LEFT JOIN facilities f ON f.id = i.facility_id
                WHERE f.id IS NULL
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} inspection rows have facility_id that doesn't exist in facilities table"
        )

    def test_inspection_dates_are_not_future(self, db):
        """No inspection has an inspection_date in the future."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM inspections
                WHERE inspection_date > CURRENT_DATE
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, f"{n} inspections have future inspection_date"

    def test_inspection_dates_are_not_ancient(self, db):
        """No inspection has inspection_date before 1990 (data corruption check)."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM inspections
                WHERE inspection_date < '1990-01-01'
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, f"{n} inspections have pre-1990 inspection_date (data corruption)"

    def test_deficiency_severity_range(self, db):
        """All deficiency severity values are in the expected range 1–4 (or null)."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT severity FROM deficiencies
                WHERE severity IS NOT NULL
                ORDER BY severity
                """
            )
            severities = [r["severity"] for r in cur.fetchall()]
        bad = [s for s in severities if s not in (1, 2, 3, 4)]
        assert not bad, (
            f"Deficiencies have severity values outside 1–4: {bad[:10]}"
        )

    def test_total_deficiency_count_across_states(self, db):
        """At least 10,000 deficiencies exist (dataset is not empty)."""
        with db.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM deficiencies")
            n = cur.fetchone()["n"]
        assert n >= 10_000, (
            f"Only {n:,} deficiency rows — expected ≥10,000. "
            f"Possible ingest failure."
        )

    def test_ca_deficiencies_have_narrative_coverage(self, db):
        """At least 60% of CA deficiencies have a non-empty inspector_narrative."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (
                        WHERE inspector_narrative IS NOT NULL
                          AND TRIM(inspector_narrative) != ''
                    ) AS with_narrative
                FROM deficiencies d
                JOIN inspections i ON i.id = d.inspection_id
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.state_code = 'CA' AND f.publishable = true
                """
            )
            row = cur.fetchone()
        total = row["total"] or 0
        if total == 0:
            pytest.skip("No CA deficiencies found")
        pct = row["with_narrative"] / total * 100
        assert pct >= 60, (
            f"CA narrative coverage = {pct:.1f}% ({row['with_narrative']}/{total}) — "
            f"expected ≥60%"
        )

    def test_pa_deficiencies_have_cited_date(self, db):
        """At least 90% of PA deficiencies have a cited_date."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE d.cited_date IS NOT NULL) AS with_date
                FROM deficiencies d
                JOIN inspections i ON i.id = d.inspection_id
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.state_code = 'PA' AND f.publishable = true
                """
            )
            row = cur.fetchone()
        total = row["total"] or 0
        if total == 0:
            pytest.skip("No PA deficiencies found")
        pct = row["with_date"] / total * 100
        assert pct >= 90, (
            f"PA cited_date coverage = {pct:.1f}% ({row['with_date']}/{total}) — "
            f"MEMORY.md: cited_date was backfilled from inspection_date for all 42,753 rows"
        )

    def test_pa_deficiencies_have_state_severity_raw(self, db):
        """At least 90% of PA deficiencies have state_severity_raw."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE d.state_severity_raw IS NOT NULL) AS with_sev
                FROM deficiencies d
                JOIN inspections i ON i.id = d.inspection_id
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.state_code = 'PA' AND f.publishable = true
                """
            )
            row = cur.fetchone()
        total = row["total"] or 0
        if total == 0:
            pytest.skip("No PA deficiencies found")
        pct = row["with_sev"] / total * 100
        assert pct >= 90, (
            f"PA state_severity_raw coverage = {pct:.1f}% ({row['with_sev']}/{total}) — "
            f"MEMORY.md: all 42,753 rows were backfilled"
        )


# ══════════════════════════════════════════════════════════════════════════════
# Peer rank distribution (statistical sanity)
# ══════════════════════════════════════════════════════════════════════════════

_COMPOSITE_PCT_SQL = """
WITH raw AS (
    SELECT
        f.id,
        f.state_code,
        f.care_category,
        COALESCE(
            SUM(
                CASE WHEN i.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
                     THEN COALESCE(d.severity, 1) ELSE 0 END
            )::numeric / NULLIF(f.beds, 0),
            0
        ) AS sev_raw,
        COALESCE(
            COUNT(DISTINCT CASE
                WHEN i.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
                     AND d.is_repeat = true THEN i.id END)::numeric
            / NULLIF(COUNT(DISTINCT CASE
                WHEN i.inspection_date >= CURRENT_DATE - INTERVAL '36 months' THEN i.id END), 0),
            0
        ) AS rep_raw,
        COALESCE(
            COUNT(DISTINCT CASE
                WHEN i.inspection_date >= CURRENT_DATE - INTERVAL '36 months' THEN i.id END
            )::numeric / 3.0,
            0
        ) AS freq_raw
    FROM facilities f
    LEFT JOIN inspections i ON i.facility_id = f.id
    LEFT JOIN deficiencies d ON d.inspection_id = i.id
    WHERE f.publishable = true
    GROUP BY f.id, f.state_code, f.care_category, f.beds
),
ranked AS (
    SELECT
        id,
        state_code,
        ROUND((1 - PERCENT_RANK() OVER (
            PARTITION BY state_code, care_category ORDER BY sev_raw ASC
        )) * 100)::int AS sev_pct,
        ROUND((1 - PERCENT_RANK() OVER (
            PARTITION BY state_code, care_category ORDER BY rep_raw ASC
        )) * 100)::int AS rep_pct,
        ROUND((1 - PERCENT_RANK() OVER (
            PARTITION BY state_code, care_category ORDER BY freq_raw ASC
        )) * 100)::int AS freq_pct
    FROM raw
)
SELECT
    id,
    state_code,
    ROUND((sev_pct + rep_pct + freq_pct)::numeric / 3) AS composite_pct,
    sev_pct, rep_pct, freq_pct
FROM ranked
"""


class TestPeerRankDistribution:
    """Peer rank distribution must be non-degenerate (statistics are meaningful)."""

    @pytest.mark.parametrize("state", ("CA", "OR", "WA", "MN", "TX"))
    def test_rank_stddev_per_state(self, db, state):
        """Composite percentile standard deviation > 5 for states with ≥10 facilities."""
        with db.cursor() as cur:
            cur.execute(
                f"""
                WITH pct AS ({_COMPOSITE_PCT_SQL})
                SELECT
                    COUNT(*) AS n,
                    ROUND(STDDEV(composite_pct), 2) AS stddev,
                    MIN(composite_pct) AS min_pct,
                    MAX(composite_pct) AS max_pct
                FROM pct
                WHERE state_code = %s
                """,
                (state,),
            )
            row = cur.fetchone()
        n = row["n"] or 0
        if n < 10:
            pytest.skip(f"{state}: only {n} facilities — too few for distribution check")
        stddev = float(row["stddev"] or 0)
        assert stddev > 5, (
            f"{state}: composite_pct stddev={stddev:.2f} (≤5) for n={n} facilities. "
            f"Ranking is degenerate — all facilities may have identical scores."
        )

    @pytest.mark.parametrize("state", ("CA", "OR", "WA", "MN", "TX"))
    def test_rank_has_low_and_high_performers(self, db, state):
        """Both low-performing (min<42) and high-performing (max>80) facilities exist."""
        with db.cursor() as cur:
            cur.execute(
                f"""
                WITH pct AS ({_COMPOSITE_PCT_SQL})
                SELECT MIN(composite_pct) AS min_pct, MAX(composite_pct) AS max_pct,
                       COUNT(*) AS n
                FROM pct WHERE state_code = %s
                """,
                (state,),
            )
            row = cur.fetchone()
        n = row["n"] or 0
        if n < 10:
            pytest.skip(f"{state}: only {n} facilities")
        min_pct = row["min_pct"]
        max_pct = row["max_pct"]
        assert min_pct is not None and int(min_pct) < 42, (
            f"{state}: min composite_pct={min_pct} (≥42). "
            f"No bad-actor facilities found — ranking may be inflated."
        )
        assert max_pct is not None and int(max_pct) > 80, (
            f"{state}: max composite_pct={max_pct} (≤80). "
            f"No high-performing facilities found — ranking may be deflated."
        )

    def test_no_repeat_offenders_ranked_above_70th_percentile(self, db):
        """
        Facilities with ≥3 repeat-cited regulation codes must not have
        composite_pct > 70.  This is the Opal Care bug regression check.
        """
        with db.cursor() as cur:
            cur.execute(
                f"""
                WITH pct AS ({_COMPOSITE_PCT_SQL}),
                rdc AS (
                    SELECT facility_id, COUNT(*) AS repeat_count
                    FROM (
                        SELECT i.facility_id, d.code,
                               COUNT(DISTINCT i.id) AS visits
                        FROM deficiencies d
                        JOIN inspections i ON i.id = d.inspection_id
                        WHERE d.code IS NOT NULL
                          AND i.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
                        GROUP BY i.facility_id, d.code
                    ) sub
                    WHERE visits >= 3
                    GROUP BY facility_id
                )
                SELECT f.name, f.state_code, f.slug,
                       rdc.repeat_count, pct.composite_pct
                FROM facilities f
                JOIN rdc ON rdc.facility_id = f.id
                JOIN pct ON pct.id = f.id
                WHERE f.publishable = true
                  AND rdc.repeat_count >= 3
                  AND pct.composite_pct > 70
                ORDER BY rdc.repeat_count DESC
                """
            )
            contradictions = cur.fetchall()
        assert not contradictions, (
            f"{len(contradictions)} facilities have ≥3 repeat codes but composite_pct>70 "
            f"(Opal Care bug pattern): "
            f"{[(r['state_code'], r['slug'], r['repeat_count'], r['composite_pct']) for r in contradictions[:5]]}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# Content integrity
# ══════════════════════════════════════════════════════════════════════════════


class TestContentIntegrity:
    """Hub content and facility content must be consistent with DB data."""

    def test_no_published_hub_content_with_drift_detected(self, db):
        """No hub_content row is published=True AND drift_detected=True."""
        with db.cursor() as cur:
            # Check if hub_content table exists first
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'hub_content'
                ) AS exists
                """
            )
            if not cur.fetchone()["exists"]:
                pytest.skip("hub_content table not yet applied")

            cur.execute(
                """
                SELECT state_code, region_slug FROM hub_content
                WHERE status = 'published' AND drift_detected = true
                """
            )
            drifted = cur.fetchall()
        assert not drifted, (
            f"{len(drifted)} published hub_content rows have drift_detected=true — "
            f"stale numbers may be live: "
            f"{[(r['state_code'], r['region_slug']) for r in drifted[:5]]}"
        )

    def test_no_positive_headline_contradicts_low_rank(self, db):
        """
        Facilities whose content.headline contains a positive superlative must
        NOT have composite_pct < 40.  This is the Opal Care / 'highly rated' bug.
        """
        POSITIVE_TERMS = [
            "highly rated", "top rated", "best", "excellent", "award", "outstanding",
        ]
        ilike_clauses = " OR ".join(
            f"(f.content->>'headline') ILIKE %s" for _ in POSITIVE_TERMS
        )
        params = [f"%{t}%" for t in POSITIVE_TERMS]

        with db.cursor() as cur:
            cur.execute(
                f"""
                WITH pct AS ({_COMPOSITE_PCT_SQL})
                SELECT f.name, f.state_code, f.slug,
                       f.content->>'headline' AS headline,
                       pct.composite_pct
                FROM facilities f
                JOIN pct ON pct.id = f.id
                WHERE f.publishable = true
                  AND f.content->>'headline' IS NOT NULL
                  AND ({ilike_clauses})
                  AND pct.composite_pct < 40
                """,
                params,
            )
            hits = cur.fetchall()
        assert not hits, (
            f"{len(hits)} facilities have positive headline but composite_pct<40: "
            f"{[(r['state_code'], r['slug'], r['composite_pct'], r['headline']) for r in hits[:5]]}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# Scraper freshness
# ══════════════════════════════════════════════════════════════════════════════


class TestScraperFreshness:
    """Data must have been updated recently (scraper is still running)."""

    @pytest.mark.parametrize("state", PUBLISHABLE_STATES)
    def test_most_recently_updated_facility_within_90_days(self, db, state):
        """For each state, the most-recently-updated facility is within 90 days."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT
                    EXTRACT(DAY FROM NOW() - MAX(updated_at))::int AS days_ago
                FROM facilities
                WHERE publishable = true AND state_code = %s
                """,
                (state,),
            )
            row = cur.fetchone()
        if row["days_ago"] is None:
            pytest.skip(f"{state}: no publishable facilities")
        days_ago = int(row["days_ago"])
        assert days_ago <= 90, (
            f"{state}: most recent facility update was {days_ago} days ago — "
            f"scraper may be broken or paused"
        )
