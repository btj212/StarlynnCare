"""
test_db_reads.py — Comprehensive read-only verification of the real Supabase database.

These tests verify the ENTIRE state of the database pipeline output:
  - Schema integrity (all columns exist with correct types)
  - Data quality invariants (publishable ↔ signal consistency)
  - Foreign key relationships (all inspections link to valid facilities)
  - State-specific signal consistency (WA, OR, MN, TX, CA)
  - No null violations on required fields
  - Inspection/deficiency counts are plausible

Requires DATABASE_URL. Marked @pytest.mark.db.
All tests are SELECT-only — never mutate production data.
"""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.db


# ─────────────────────────────────────────────────────────────────────────────
# Schema existence
# ─────────────────────────────────────────────────────────────────────────────


class TestTableAndColumnExistence:
    """Verify every table and critical column from all 38 migrations exists."""

    EXPECTED_TABLES = [
        "states",
        "facilities",
        "inspections",
        "deficiencies",
        "scrape_runs",
        "content_runs",
        "mc_listing_reports",
        "mc_review_audit",
        "facility_watchers",
        "submission_events",
    ]

    def test_all_expected_tables_exist(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public'
                """
            )
            existing = {r["tablename"] for r in cur.fetchall()}
        for table in self.EXPECTED_TABLES:
            assert table in existing, f"Table '{table}' missing from public schema"

    def test_facilities_has_core_columns(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'facilities'
                """
            )
            cols = {r["column_name"] for r in cur.fetchall()}
        required = {
            "id", "state_code", "name", "license_number", "street", "city", "zip",
            "slug", "city_slug", "beds", "phone", "facility_type", "license_status",
            "publishable", "serves_memory_care", "care_category",
            "mc_signal_explicit_name", "mc_signal_chain_name", "mc_signal_chain_curated",
            "mc_review_status", "mc_reviewed_by", "mc_reviewed_at", "mc_review_notes",
            "memory_care_disclosure_filed", "latitude", "longitude",
            "cms_ccn", "cms_star_rating", "last_inspection_date",
            "source_url", "created_at", "updated_at",
            # CA-specific
            "memory_care_designation",
            # WA-specific
            "wa_dementia_care_contract", "wa_memory_care_certified", "wa_facility_type",
            # OR-specific
            "mce_endorsed", "enhanced_oversight",
            # MN-specific
            "mn_dementia_care_licensed",
            # TX-specific
            "tx_alzheimer_certified", "tx_alzheimer_cert_no",
        }
        missing = required - cols
        assert not missing, f"facilities table missing columns: {missing}"

    def test_inspections_has_core_columns(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'inspections'
                """
            )
            cols = {r["column_name"] for r in cur.fetchall()}
        required = {
            "id", "facility_id", "inspection_date", "inspection_type",
            "is_complaint", "complaint_id", "total_deficiency_count",
            "civil_money_penalty_total", "special_focus", "source_url",
            "source_agency", "raw_data", "scrape_run_id", "created_at",
        }
        missing = required - cols
        assert not missing, f"inspections table missing columns: {missing}"

    def test_deficiencies_has_core_columns(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'deficiencies'
                """
            )
            cols = {r["column_name"] for r in cur.fetchall()}
        required = {
            "id", "inspection_id", "code", "category", "severity", "scope",
            "scope_severity_code", "class", "immediate_jeopardy",
            "substandard_quality_of_care", "is_repeat", "description",
            "inspector_narrative", "harm_description", "residents_affected",
            "plan_of_correction", "poc_deadline", "cited_date",
            "corrected_date", "status", "civil_money_penalty", "state_severity_raw",
        }
        missing = required - cols
        assert not missing, f"deficiencies table missing columns: {missing}"

    def test_facility_watchers_has_core_columns(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'facility_watchers'
                """
            )
            cols = {r["column_name"] for r in cur.fetchall()}
        required = {
            "id", "facility_id", "email", "created_at", "confirmed_at",
            "confirmation_token", "unsubscribe_token", "source",
        }
        missing = required - cols
        assert not missing, f"facility_watchers missing columns: {missing}"

    def test_submission_events_has_core_columns(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'submission_events'
                """
            )
            cols = {r["column_name"] for r in cur.fetchall()}
        required = {
            "id", "event_type", "email", "source", "facility_id",
            "summary", "payload", "alert_status", "alert_error", "created_at",
        }
        missing = required - cols
        assert not missing, f"submission_events missing columns: {missing}"


# ─────────────────────────────────────────────────────────────────────────────
# Row counts and basic data presence
# ─────────────────────────────────────────────────────────────────────────────


class TestDataPresence:
    def test_states_table_has_50_rows(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM states")
            n = cur.fetchone()["n"]
        assert n == 50, f"Expected 50 states, found {n}"

    def test_facilities_has_rows(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM facilities")
            n = cur.fetchone()["n"]
        assert n > 100, f"Expected > 100 facilities, found {n} — ingest may not have run"

    def test_publishable_facilities_exist(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM facilities WHERE publishable = true")
            n = cur.fetchone()["n"]
        assert n > 10, f"Expected > 10 publishable facilities, found {n}"

    def test_inspections_has_rows(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM inspections")
            n = cur.fetchone()["n"]
        assert n > 0, "inspections table is empty — ingest may not have run"

    def test_deficiencies_has_rows(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM deficiencies")
            n = cur.fetchone()["n"]
        assert n > 0, "deficiencies table is empty — ingest may not have run"


# ─────────────────────────────────────────────────────────────────────────────
# Data quality invariants
# ─────────────────────────────────────────────────────────────────────────────


class TestDataQualityInvariants:
    """Business rules that MUST hold across all states in the pipeline output."""

    def test_publishable_facilities_have_license_number(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, state_code
                FROM facilities
                WHERE publishable = true AND (license_number IS NULL OR license_number = '')
                LIMIT 5
                """
            )
            rows = cur.fetchall()
        assert len(rows) == 0, (
            f"Publishable facilities with missing license_number: "
            + ", ".join(f"{r['name']} ({r['state_code']})" for r in rows)
        )

    def test_publishable_facilities_have_name(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, state_code FROM facilities
                WHERE publishable = true AND (name IS NULL OR name = '')
                LIMIT 5
                """
            )
            rows = cur.fetchall()
        assert len(rows) == 0, (
            f"Publishable facilities with empty name: {[r['id'] for r in rows]}"
        )

    def test_publishable_facilities_have_city_slug(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, state_code FROM facilities
                WHERE publishable = true AND (city_slug IS NULL OR city_slug = '')
                LIMIT 5
                """
            )
            rows = cur.fetchall()
        assert len(rows) == 0, (
            f"Publishable facilities missing city_slug: "
            + ", ".join(f"{r['name']} ({r['state_code']})" for r in rows)
        )

    def test_publishable_facilities_have_slug(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, state_code FROM facilities
                WHERE publishable = true AND (slug IS NULL OR slug = '')
                LIMIT 5
                """
            )
            rows = cur.fetchall()
        assert len(rows) == 0, (
            f"Publishable facilities missing slug: "
            + ", ".join(f"{r['name']} ({r['state_code']})" for r in rows)
        )

    def test_memory_care_publishable_serves_memory_care(self, db_conn):
        """Facilities with care_category=rcfe_memory_care must have serves_memory_care=true."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, state_code FROM facilities
                WHERE care_category IN ('rcfe_memory_care', 'alf_memory_care', 'snf_dementia_scu')
                  AND publishable = true
                  AND serves_memory_care = false
                LIMIT 5
                """
            )
            rows = cur.fetchall()
        assert len(rows) == 0, (
            f"Memory-care category facilities with serves_memory_care=false: "
            + ", ".join(f"{r['name']} ({r['state_code']})" for r in rows)
        )

    def test_auto_published_has_explicit_or_strong_signal(self, db_conn):
        """
        Facilities with mc_review_status='auto_published' must have at least one Tier-1 signal.
        Tier-1 signals: explicit_name, chain_curated, disclosure_filed, wa_dementia_care_contract,
        or_memory_care_endorsed (via mce_endorsed), mn_dementia_care_licensed, tx_alzheimer_certified.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, state_code,
                       mc_signal_explicit_name, mc_signal_chain_curated,
                       memory_care_disclosure_filed,
                       wa_dementia_care_contract, mce_endorsed,
                       mn_dementia_care_licensed, tx_alzheimer_certified
                FROM facilities
                WHERE mc_review_status = 'auto_published'
                  AND mc_signal_explicit_name = false
                  AND mc_signal_chain_curated = false
                  AND memory_care_disclosure_filed = false
                  AND wa_dementia_care_contract = false
                  AND mce_endorsed = false
                  AND mn_dementia_care_licensed = false
                  AND tx_alzheimer_certified = false
                LIMIT 10
                """
            )
            rows = cur.fetchall()
        assert len(rows) == 0, (
            f"{len(rows)} auto_published facilities with no Tier-1 signal: "
            + ", ".join(f"{r['name']} ({r['state_code']})" for r in rows[:3])
        )

    def test_no_orphan_inspections(self, db_conn):
        """Every inspection must reference a valid facility."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM inspections i
                WHERE NOT EXISTS (
                    SELECT 1 FROM facilities f WHERE f.id = i.facility_id
                )
                """
            )
            orphans = cur.fetchone()["n"]
        assert orphans == 0, (
            f"{orphans} inspection rows have no matching facility — foreign key violation"
        )

    def test_no_orphan_deficiencies(self, db_conn):
        """Every deficiency must reference a valid inspection."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM deficiencies d
                WHERE NOT EXISTS (
                    SELECT 1 FROM inspections i WHERE i.id = d.inspection_id
                )
                """
            )
            orphans = cur.fetchone()["n"]
        assert orphans == 0, (
            f"{orphans} deficiency rows have no matching inspection"
        )

    def test_inspection_dates_are_not_in_future(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM inspections
                WHERE inspection_date > CURRENT_DATE
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, f"{n} inspections have future dates — data integrity issue"

    def test_severity_values_in_range(self, db_conn):
        """Deficiency severity must be 1-4 when non-null."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM deficiencies
                WHERE severity IS NOT NULL AND severity NOT IN (1, 2, 3, 4)
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, f"{n} deficiency rows have severity outside [1,4]"

    def test_immediate_jeopardy_is_boolean(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM deficiencies
                WHERE immediate_jeopardy IS NOT NULL
                  AND immediate_jeopardy NOT IN (true, false)
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, f"{n} deficiency rows have non-boolean immediate_jeopardy"

    def test_facility_slugs_are_unique_within_state(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, city_slug, slug, COUNT(*) AS n
                FROM facilities
                WHERE publishable = true
                GROUP BY state_code, city_slug, slug
                HAVING COUNT(*) > 1
                LIMIT 5
                """
            )
            dupes = cur.fetchall()
        assert len(dupes) == 0, (
            f"Duplicate (state, city_slug, slug) combos found: "
            + ", ".join(
                f"{r['state_code']}/{r['city_slug']}/{r['slug']} (x{r['n']})"
                for r in dupes
            )
        )

    def test_inspection_total_deficiency_count_matches_deficiencies(self, db_conn):
        """
        Sample check: inspections with total_deficiency_count > 0 should actually
        have deficiency rows. This catches ingest bugs where header is written
        but deficiency rows are dropped.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT i.id, i.total_deficiency_count, COUNT(d.id) AS actual_count,
                       f.state_code
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                LEFT JOIN deficiencies d ON d.inspection_id = i.id
                WHERE i.total_deficiency_count > 0
                GROUP BY i.id, i.total_deficiency_count, f.state_code
                HAVING COUNT(d.id) = 0
                LIMIT 10
                """
            )
            mismatch = cur.fetchall()
        # Allow up to 5% mismatch (some states import counts before deficiencies)
        if mismatch:
            with db_conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) AS n FROM inspections WHERE total_deficiency_count > 0"
                )
                total = cur.fetchone()["n"]
            ratio = len(mismatch) / max(total, 1)
            assert ratio < 0.05, (
                f"{len(mismatch)}/{total} ({ratio:.1%}) inspections have "
                f"total_deficiency_count > 0 but no deficiency rows — ingest bug"
            )


# ─────────────────────────────────────────────────────────────────────────────
# State-specific signal consistency
# ─────────────────────────────────────────────────────────────────────────────


class TestStateSpecificSignals:
    def test_wa_dementia_care_contract_implies_serves_memory_care(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code = 'WA'
                  AND wa_dementia_care_contract = true
                  AND serves_memory_care = false
                  AND publishable = true
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} WA facilities have wa_dementia_care_contract=true but serves_memory_care=false"
        )

    def test_or_mce_endorsed_implies_serves_memory_care(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code = 'OR'
                  AND mce_endorsed = true
                  AND serves_memory_care = false
                  AND publishable = true
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} OR facilities have mce_endorsed=true but serves_memory_care=false"
        )

    def test_mn_dementia_licensed_implies_serves_memory_care(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code = 'MN'
                  AND mn_dementia_care_licensed = true
                  AND serves_memory_care = false
                  AND publishable = true
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} MN facilities have mn_dementia_care_licensed=true but serves_memory_care=false"
        )

    def test_tx_alzheimer_certified_implies_serves_memory_care(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code = 'TX'
                  AND tx_alzheimer_certified = true
                  AND serves_memory_care = false
                  AND publishable = true
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} TX facilities have tx_alzheimer_certified=true but serves_memory_care=false"
        )

    def test_ca_memory_care_disclosure_implies_serves_memory_care(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code = 'CA'
                  AND memory_care_disclosure_filed = true
                  AND serves_memory_care = false
                  AND publishable = true
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} CA facilities have memory_care_disclosure_filed=true but serves_memory_care=false"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Inspection + deficiency shape
# ─────────────────────────────────────────────────────────────────────────────


class TestInspectionDeficiencyShape:
    def test_all_inspections_have_facility_id(self, sample_inspections):
        if not sample_inspections:
            pytest.skip("No inspections in DB")
        for r in sample_inspections:
            assert r["facility_id"] is not None

    def test_all_inspections_have_inspection_date(self, sample_inspections):
        if not sample_inspections:
            pytest.skip("No inspections in DB")
        for r in sample_inspections:
            assert r["inspection_date"] is not None, (
                f"Inspection {r['id']} has null inspection_date"
            )

    def test_all_inspections_have_source_url(self, sample_inspections):
        if not sample_inspections:
            pytest.skip("No inspections in DB")
        for r in sample_inspections:
            assert r["source_url"] is not None, (
                f"Inspection {r['id']} for '{r['facility_name']}' has no source_url"
            )
            assert r["source_url"].startswith("https://"), (
                f"source_url '{r['source_url']}' is not HTTPS"
            )

    def test_deficiency_severity_type(self, sample_deficiencies):
        if not sample_deficiencies:
            pytest.skip("No deficiencies in DB")
        for d in sample_deficiencies:
            if d["severity"] is not None:
                assert isinstance(d["severity"], int), (
                    f"severity is {type(d['severity'])}, expected int"
                )
                assert 1 <= d["severity"] <= 4

    def test_deficiency_immediate_jeopardy_type(self, sample_deficiencies):
        if not sample_deficiencies:
            pytest.skip("No deficiencies in DB")
        for d in sample_deficiencies:
            if d["immediate_jeopardy"] is not None:
                assert isinstance(d["immediate_jeopardy"], bool), (
                    f"immediate_jeopardy is {type(d['immediate_jeopardy'])}, expected bool"
                )

    def test_deficiency_description_has_content(self, sample_deficiencies):
        if not sample_deficiencies:
            pytest.skip("No deficiencies in DB")
        has_description = sum(
            1 for d in sample_deficiencies
            if d["description"] and len(d["description"].strip()) > 5
        )
        # At least 50% of deficiencies should have real description text
        assert has_description >= len(sample_deficiencies) * 0.5, (
            f"Only {has_description}/{len(sample_deficiencies)} deficiencies have real descriptions"
        )


# ─────────────────────────────────────────────────────────────────────────────
# States table
# ─────────────────────────────────────────────────────────────────────────────


class TestStatesTable:
    COVERED_STATE_CODES = {"CA", "OR", "WA", "MN", "TX", "UT"}

    def test_all_50_states_have_name(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM states WHERE name IS NOT NULL AND name != ''")
            n = cur.fetchone()["n"]
        assert n == 50, f"Only {n}/50 states have a non-null name"

    def test_covered_states_are_present(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute("SELECT code FROM states")
            codes = {r["code"] for r in cur.fetchall()}
        for state in self.COVERED_STATE_CODES:
            assert state in codes, f"State '{state}' missing from states table"

    def test_state_codes_are_two_char_uppercase(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute("SELECT code FROM states")
            codes = [r["code"] for r in cur.fetchall()]
        for code in codes:
            assert len(code) == 2, f"State code '{code}' is not 2 chars"
            assert code.isupper(), f"State code '{code}' is not uppercase"
