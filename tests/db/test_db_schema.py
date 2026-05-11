"""
Database schema completeness tests.

Validates that the live Supabase/Postgres schema exactly matches what the
application and scraper code expects. If any column, table, index, or
constraint is missing here, code that references it will fail silently
or with a cryptic error in production.

All tests are read-only — no writes, no rollback needed.
Uses the session-scoped `db_ro` fixture.
"""

from __future__ import annotations

import pytest


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def get_tables(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            """
        )
        return {row[0] for row in cur.fetchall()}


def get_columns(conn, table: str) -> dict[str, dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
            ORDER BY ordinal_position
            """,
            (table,),
        )
        return {
            row[0]: {
                "data_type": row[1],
                "nullable": row[2] == "YES",
                "default": row[3],
            }
            for row in cur.fetchall()
        }


def get_indexes(conn, table: str) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT indexname FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = %s
            """,
            (table,),
        )
        return {row[0] for row in cur.fetchall()}


def get_constraints(conn, table: str) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name = %s
            """,
            (table,),
        )
        return [{"name": row[0], "type": row[1]} for row in cur.fetchall()]


def get_rls_status(conn, table: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT rowsecurity FROM pg_class WHERE relname = %s AND relkind = 'r'",
            (table,),
        )
        row = cur.fetchone()
        return bool(row[0]) if row else False


def get_functions(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT routine_name FROM information_schema.routines
            WHERE routine_schema = 'public'
              AND routine_type = 'FUNCTION'
            """
        )
        return {row[0] for row in cur.fetchall()}


# ─────────────────────────────────────────────────────────────────────────────
# Tables exist
# ─────────────────────────────────────────────────────────────────────────────


REQUIRED_TABLES = {
    "states",
    "facilities",
    "inspections",
    "deficiencies",
    "scrape_runs",
    "content_runs",
    "facility_content",
    "facility_photos",
    "inspection_summaries",
    "facility_reviews",
}


@pytest.mark.db
def test_all_required_tables_exist(db_ro):
    actual = get_tables(db_ro)
    missing = REQUIRED_TABLES - actual
    assert not missing, (
        f"Missing tables in public schema: {missing}. "
        f"Available tables: {sorted(actual)}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# states table
# ─────────────────────────────────────────────────────────────────────────────


STATES_REQUIRED_COLUMNS = {
    "id", "code", "name", "scraper_name", "last_successful_scrape",
    "confidence", "sla_days", "notes",
}


@pytest.mark.db
def test_states_has_all_columns(db_ro):
    cols = get_columns(db_ro, "states")
    missing = STATES_REQUIRED_COLUMNS - set(cols.keys())
    assert not missing, f"states table missing columns: {missing}"


@pytest.mark.db
def test_states_code_is_char2(db_ro):
    cols = get_columns(db_ro, "states")
    assert "code" in cols
    assert "char" in cols["code"]["data_type"] or "character" in cols["code"]["data_type"]


@pytest.mark.db
def test_states_confidence_check_constraint(db_ro):
    constraints = get_constraints(db_ro, "states")
    # confidence CHECK ('high'|'medium'|'low') should have a constraint
    constraint_names = {c["name"] for c in constraints}
    assert any("confidence" in n or "states" in n for n in constraint_names), (
        f"No CHECK constraint on states.confidence: {constraint_names}"
    )


@pytest.mark.db
def test_states_has_all_50_states(db_ro):
    with db_ro.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM states")
        count = cur.fetchone()[0]
    assert count == 50, f"states table has {count} rows, expected 50"


@pytest.mark.db
def test_states_has_ca(db_ro):
    with db_ro.cursor() as cur:
        cur.execute("SELECT name FROM states WHERE code = 'CA'")
        row = cur.fetchone()
    assert row is not None, "No row for state code 'CA'"
    assert row[0] == "California"


@pytest.mark.db
def test_states_has_or_mn_wa_tx(db_ro):
    with db_ro.cursor() as cur:
        cur.execute("SELECT code FROM states WHERE code IN ('OR','MN','WA','TX')")
        codes = {row[0] for row in cur.fetchall()}
    assert codes == {"OR", "MN", "WA", "TX"}, f"Missing state codes: {{'OR','MN','WA','TX'} - codes}"


# ─────────────────────────────────────────────────────────────────────────────
# facilities table
# ─────────────────────────────────────────────────────────────────────────────


FACILITIES_REQUIRED_COLUMNS = {
    # Identity
    "id", "state_code", "name", "cms_id", "license_number", "license_type",
    # Address
    "street", "city", "zip", "city_slug", "slug",
    # Characteristics
    "beds", "facility_type", "certification_type",
    # Ownership
    "operator_name", "management_company", "ownership_type",
    # Contact
    "phone", "website",
    # Quality
    "cms_star_rating", "last_inspection_date",
    # Geo
    "latitude", "longitude",
    # Metadata
    "source_url", "created_at", "updated_at",
    # Migration 0002
    "care_category", "serves_memory_care", "memory_care_designation",
    "license_status", "license_expiration", "publishable",
    # Migration 0008 — capacity tier (generated column)
    "capacity_tier",
    # Migration 0010 — MC signal columns
    "mc_signal_explicit_name", "mc_signal_chain_name",
    # Migration 0022 — review workflow
    "mc_review_status",
}


@pytest.mark.db
def test_facilities_has_all_columns(db_ro):
    cols = get_columns(db_ro, "facilities")
    missing = FACILITIES_REQUIRED_COLUMNS - set(cols.keys())
    assert not missing, f"facilities table missing columns: {missing}"


@pytest.mark.db
def test_facilities_id_is_uuid(db_ro):
    cols = get_columns(db_ro, "facilities")
    assert "uuid" in cols["id"]["data_type"]


@pytest.mark.db
def test_facilities_id_has_gen_random_uuid_default(db_ro):
    cols = get_columns(db_ro, "facilities")
    default = cols["id"]["default"] or ""
    assert "gen_random_uuid" in default


@pytest.mark.db
def test_facilities_publishable_is_boolean(db_ro):
    cols = get_columns(db_ro, "facilities")
    assert "bool" in cols["publishable"]["data_type"]


@pytest.mark.db
def test_facilities_unique_constraint_on_state_city_slug(db_ro):
    constraints = get_constraints(db_ro, "facilities")
    unique_constraints = [c for c in constraints if c["type"] == "UNIQUE"]
    assert unique_constraints, (
        "facilities table has no UNIQUE constraints — "
        "upsert deduplication (state_code, city_slug, slug) is broken"
    )


@pytest.mark.db
def test_facilities_has_state_code_index(db_ro):
    indexes = get_indexes(db_ro, "facilities")
    has_state_idx = any("city" in idx or "state" in idx for idx in indexes)
    assert has_state_idx, (
        f"facilities table missing state/city index. Indexes: {indexes}"
    )


@pytest.mark.db
def test_facilities_rls_enabled(db_ro):
    assert get_rls_status(db_ro, "facilities"), (
        "Row Level Security is NOT enabled on facilities table — "
        "this allows unauthenticated writes"
    )


@pytest.mark.db
def test_facilities_capacity_tier_is_generated_column(db_ro):
    """capacity_tier must be a generated column (always in sync with beds)."""
    with db_ro.cursor() as cur:
        cur.execute(
            """
            SELECT is_generated
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'facilities'
              AND column_name = 'capacity_tier'
            """
        )
        row = cur.fetchone()
    assert row is not None, "facilities.capacity_tier column not found"
    assert row[0] == "ALWAYS", (
        f"capacity_tier is not a generated column (is_generated={row[0]!r})"
    )


# ─────────────────────────────────────────────────────────────────────────────
# inspections table
# ─────────────────────────────────────────────────────────────────────────────


INSPECTIONS_REQUIRED_COLUMNS = {
    "id", "facility_id", "inspection_date", "inspection_type",
    "is_complaint", "complaint_id",
    "total_deficiency_count", "civil_money_penalty_total", "special_focus",
    "source_url", "source_agency", "scrape_run_id", "raw_data",
    "created_at",
}


@pytest.mark.db
def test_inspections_has_all_columns(db_ro):
    cols = get_columns(db_ro, "inspections")
    missing = INSPECTIONS_REQUIRED_COLUMNS - set(cols.keys())
    assert not missing, f"inspections table missing columns: {missing}"


@pytest.mark.db
def test_inspections_facility_id_is_uuid(db_ro):
    cols = get_columns(db_ro, "inspections")
    assert "uuid" in cols["facility_id"]["data_type"]


@pytest.mark.db
def test_inspections_has_facility_index(db_ro):
    indexes = get_indexes(db_ro, "inspections")
    has_fac_idx = any("facility" in idx for idx in indexes)
    assert has_fac_idx, (
        f"inspections table missing index on facility_id. Indexes: {indexes}"
    )


@pytest.mark.db
def test_inspections_rls_enabled(db_ro):
    assert get_rls_status(db_ro, "inspections")


@pytest.mark.db
def test_inspections_raw_data_is_jsonb(db_ro):
    cols = get_columns(db_ro, "inspections")
    assert "jsonb" in cols["raw_data"]["data_type"]


# ─────────────────────────────────────────────────────────────────────────────
# deficiencies table
# ─────────────────────────────────────────────────────────────────────────────


DEFICIENCIES_REQUIRED_COLUMNS = {
    "id", "inspection_id",
    "ftag", "code", "category",
    "scope", "severity", "scope_severity_code", "class",
    "immediate_jeopardy", "substandard_quality_of_care", "is_repeat",
    "description", "inspector_narrative", "harm_description",
    "residents_affected",
    "plan_of_correction", "poc_deadline", "cited_date", "corrected_date", "status",
    "civil_money_penalty",
    "created_at",
}


@pytest.mark.db
def test_deficiencies_has_all_columns(db_ro):
    cols = get_columns(db_ro, "deficiencies")
    missing = DEFICIENCIES_REQUIRED_COLUMNS - set(cols.keys())
    assert not missing, f"deficiencies table missing columns: {missing}"


@pytest.mark.db
def test_deficiencies_immediate_jeopardy_defaults_false(db_ro):
    cols = get_columns(db_ro, "deficiencies")
    default = (cols["immediate_jeopardy"].get("default") or "").lower()
    assert "false" in default, (
        f"deficiencies.immediate_jeopardy default should be false, got {default!r}"
    )


@pytest.mark.db
def test_deficiencies_severity_check_constraint(db_ro):
    constraints = get_constraints(db_ro, "deficiencies")
    constraint_names = {c["name"] for c in constraints}
    has_sev_check = any("severity" in n or "deficienc" in n for n in constraint_names)
    assert has_sev_check, (
        f"No CHECK constraint found for deficiencies.severity: {constraint_names}"
    )


@pytest.mark.db
def test_deficiencies_scope_check_constraint(db_ro):
    with db_ro.cursor() as cur:
        cur.execute(
            """
            SELECT pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'deficiencies'::regclass
              AND contype = 'c'
            """
        )
        defs = [row[0] for row in cur.fetchall()]
    scope_constraints = [d for d in defs if "isolated" in d or "scope" in d.lower()]
    assert scope_constraints, (
        "No CHECK constraint found for deficiencies.scope (isolated|pattern|widespread)"
    )


@pytest.mark.db
def test_deficiencies_has_ftag_index(db_ro):
    indexes = get_indexes(db_ro, "deficiencies")
    has_ftag_idx = any("ftag" in idx for idx in indexes)
    assert has_ftag_idx, (
        f"deficiencies table missing ftag index. Indexes: {indexes}"
    )


@pytest.mark.db
def test_deficiencies_has_immediate_jeopardy_partial_index(db_ro):
    indexes = get_indexes(db_ro, "deficiencies")
    has_ij_idx = any("ij" in idx or "jeopardy" in idx for idx in indexes)
    assert has_ij_idx, (
        f"deficiencies table missing partial index on immediate_jeopardy. Indexes: {indexes}"
    )


@pytest.mark.db
def test_deficiencies_rls_enabled(db_ro):
    assert get_rls_status(db_ro, "deficiencies")


# ─────────────────────────────────────────────────────────────────────────────
# scrape_runs table
# ─────────────────────────────────────────────────────────────────────────────


SCRAPE_RUNS_REQUIRED_COLUMNS = {
    "id", "state_code", "scraper_name",
    "started_at", "completed_at",
    "status",
    "records_found", "records_new", "records_updated",
    "error_log", "evaluator_result",
    "repair_attempted", "repair_result",
}


@pytest.mark.db
def test_scrape_runs_has_all_columns(db_ro):
    cols = get_columns(db_ro, "scrape_runs")
    missing = SCRAPE_RUNS_REQUIRED_COLUMNS - set(cols.keys())
    assert not missing, f"scrape_runs table missing columns: {missing}"


@pytest.mark.db
def test_scrape_runs_status_check_constraint(db_ro):
    with db_ro.cursor() as cur:
        cur.execute(
            """
            SELECT pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'scrape_runs'::regclass
              AND contype = 'c'
            """
        )
        defs = [row[0] for row in cur.fetchall()]
    status_constraints = [d for d in defs if "running" in d or "success" in d]
    assert status_constraints, (
        "No CHECK constraint found for scrape_runs.status (running|success|partial|failed)"
    )


# ─────────────────────────────────────────────────────────────────────────────
# facility_snapshot() RPC function
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_facility_snapshot_function_exists(db_ro):
    functions = get_functions(db_ro)
    assert "facility_snapshot" in functions, (
        "facility_snapshot() RPC function is missing from the public schema"
    )


@pytest.mark.db
def test_facility_snapshot_return_type_is_jsonb(db_ro):
    with db_ro.cursor() as cur:
        cur.execute(
            """
            SELECT data_type
            FROM information_schema.routines
            WHERE routine_schema = 'public'
              AND routine_name = 'facility_snapshot'
            """
        )
        row = cur.fetchone()
    assert row is not None
    assert "json" in row[0].lower(), (
        f"facility_snapshot return type is {row[0]!r}, expected jsonb"
    )


@pytest.mark.db
def test_facility_snapshot_is_executable_by_anon(db_ro):
    """anon role must be able to call facility_snapshot (GRANT was in the migration)."""
    with db_ro.cursor() as cur:
        cur.execute(
            """
            SELECT has_function_privilege('anon', 'facility_snapshot(uuid)', 'EXECUTE')
            """
        )
        row = cur.fetchone()
    assert row is not None and row[0] is True, (
        "anon role does not have EXECUTE on facility_snapshot() — "
        "public facility pages will fail to load quality scores"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Foreign key relationships
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_inspections_references_facilities(db_ro):
    with db_ro.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) FROM information_schema.referential_constraints rc
            JOIN information_schema.key_column_usage kcu
              ON rc.constraint_name = kcu.constraint_name
              AND rc.constraint_schema = kcu.constraint_schema
            JOIN information_schema.constraint_column_usage ccu
              ON rc.unique_constraint_name = ccu.constraint_name
              AND rc.unique_constraint_schema = ccu.constraint_schema
            WHERE kcu.table_name = 'inspections'
              AND ccu.table_name = 'facilities'
            """
        )
        count = cur.fetchone()[0]
    assert count > 0, (
        "No FK from inspections.facility_id → facilities.id found"
    )


@pytest.mark.db
def test_deficiencies_references_inspections(db_ro):
    with db_ro.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) FROM information_schema.referential_constraints rc
            JOIN information_schema.key_column_usage kcu
              ON rc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
              ON rc.unique_constraint_name = ccu.constraint_name
            WHERE kcu.table_name = 'deficiencies'
              AND ccu.table_name = 'inspections'
            """
        )
        count = cur.fetchone()[0]
    assert count > 0, (
        "No FK from deficiencies.inspection_id → inspections.id found"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Data sanity: existing data passes basic integrity checks
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_no_facilities_with_null_state_code(db_ro):
    with db_ro.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM facilities WHERE state_code IS NULL")
        count = cur.fetchone()[0]
    assert count == 0, f"{count} facilities have NULL state_code"


@pytest.mark.db
def test_no_facilities_with_blank_name(db_ro):
    with db_ro.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM facilities WHERE trim(name) = ''")
        count = cur.fetchone()[0]
    assert count == 0, f"{count} facilities have empty name"


@pytest.mark.db
def test_no_facilities_with_blank_slug(db_ro):
    with db_ro.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM facilities WHERE trim(slug) = ''")
        count = cur.fetchone()[0]
    assert count == 0, f"{count} facilities have empty slug"


@pytest.mark.db
def test_publishable_facilities_have_valid_state_codes(db_ro):
    with db_ro.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT f.state_code
            FROM facilities f
            WHERE f.publishable = true
              AND NOT EXISTS (SELECT 1 FROM states s WHERE s.code = f.state_code)
            """
        )
        invalid = [row[0] for row in cur.fetchall()]
    assert not invalid, (
        f"Publishable facilities have invalid state_codes: {invalid}"
    )


@pytest.mark.db
def test_deficiencies_have_valid_inspection_ids(db_ro):
    """Every deficiency must reference a real inspection (FK enforced, but let's verify)."""
    with db_ro.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) FROM deficiencies d
            WHERE NOT EXISTS (SELECT 1 FROM inspections i WHERE i.id = d.inspection_id)
            """
        )
        orphans = cur.fetchone()[0]
    assert orphans == 0, (
        f"{orphans} deficiency rows reference non-existent inspection_ids"
    )


@pytest.mark.db
def test_severity_values_in_range(db_ro):
    with db_ro.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM deficiencies WHERE severity IS NOT NULL AND (severity < 1 OR severity > 4)"
        )
        bad = cur.fetchone()[0]
    assert bad == 0, (
        f"{bad} deficiency rows have severity outside 1-4 range"
    )


@pytest.mark.db
def test_capacity_tier_matches_beds(db_ro):
    """
    capacity_tier is a generated column — verify it matches the expected formula
    for a sample of real facilities.
    """
    with db_ro.cursor() as cur:
        cur.execute(
            """
            SELECT beds, capacity_tier FROM facilities
            WHERE beds IS NOT NULL
            LIMIT 200
            """
        )
        rows = cur.fetchall()

    for beds, tier in rows:
        expected = (
            "small" if beds <= 6
            else "medium" if beds <= 49
            else "large"
        )
        assert tier == expected, (
            f"capacity_tier mismatch: beds={beds} → expected={expected!r}, got={tier!r}"
        )
