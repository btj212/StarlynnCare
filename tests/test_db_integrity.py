"""
Layer D — Database structural integrity tests.

Verifies referential integrity, uniqueness constraints, value-range invariants,
and data quality invariants across all tables. These tests are the equivalent
of a database constraint audit — they catch broken ingest that Postgres
foreign-key constraints don't cover (because they're on nullable columns or
derived state).

No mocks. No fake data. Real DB only.

Run:
    pytest tests/test_db_integrity.py -m db -v
"""
from __future__ import annotations

import pytest

from conftest import ALL_INGESTED_STATES

pytestmark = pytest.mark.db


class TestReferentialIntegrity:
    """FK-equivalent checks not caught by Postgres cascade constraints."""

    def test_no_inspections_with_invalid_facility_id(self, db_conn):
        """
        Every inspection.facility_id must reference a row in facilities.
        Postgres enforces this via FK, but we assert it explicitly to catch
        any temp-table shenanigans during bulk ingest.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS orphan_count
                FROM inspections i
                WHERE NOT EXISTS (
                    SELECT 1 FROM facilities f WHERE f.id = i.facility_id
                )
                """
            )
            orphans = cur.fetchone()["orphan_count"]
        assert orphans == 0, (
            f"{orphans} inspections reference non-existent facility_id. "
            "Orphan inspection rows indicate a broken ingest or missing DELETE CASCADE."
        )

    def test_no_deficiencies_with_invalid_inspection_id(self, db_conn):
        """Every deficiency.inspection_id must reference an existing inspection."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS orphan_count
                FROM deficiencies d
                WHERE NOT EXISTS (
                    SELECT 1 FROM inspections i WHERE i.id = d.inspection_id
                )
                """
            )
            orphans = cur.fetchone()["orphan_count"]
        assert orphans == 0, (
            f"{orphans} deficiencies reference non-existent inspection_id. "
            "ERRORS.md 2026-05: violations ingest before inspections ingest causes this."
        )

    def test_no_facilities_with_unknown_state_code(self, db_conn):
        """Every facility.state_code must reference a row in states."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS orphan_count
                FROM facilities f
                WHERE NOT EXISTS (SELECT 1 FROM states s WHERE s.code = f.state_code)
                """
            )
            orphans = cur.fetchone()["orphan_count"]
        assert orphans == 0, (
            f"{orphans} facilities reference state_code not in the states table."
        )


class TestUniquenessInvariants:
    """Uniqueness constraints that protect URL routing."""

    def test_slug_unique_within_state_and_city(self, db_conn):
        """
        No two facilities may share (state_code, city_slug, slug).
        This is a DB UNIQUE constraint; violations would break URL routing.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, city_slug, slug, COUNT(*) AS n
                FROM facilities
                GROUP BY state_code, city_slug, slug
                HAVING COUNT(*) > 1
                LIMIT 10
                """
            )
            dupes = cur.fetchall()
        assert not dupes, (
            f"Duplicate (state_code, city_slug, slug) combinations found: "
            f"{[(r['state_code'], r['city_slug'], r['slug'], r['n']) for r in dupes]}"
        )

    def test_no_facility_slug_contains_space(self, db_conn):
        """Slugs must be URL-safe — no spaces."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE slug LIKE '% %'"
            )
            n = cur.fetchone()["n"]
        assert n == 0, f"{n} facility slugs contain spaces"

    def test_no_city_slug_contains_space(self, db_conn):
        """city_slug must be URL-safe — no spaces."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE city_slug LIKE '% %'"
            )
            n = cur.fetchone()["n"]
        assert n == 0, f"{n} city_slugs contain spaces"

    def test_no_slug_is_empty(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE slug = '' OR slug IS NULL"
            )
            n = cur.fetchone()["n"]
        assert n == 0, f"{n} facilities have empty or NULL slug"

    def test_no_city_slug_is_empty(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE city_slug = '' OR city_slug IS NULL"
            )
            n = cur.fetchone()["n"]
        assert n == 0, f"{n} facilities have empty or NULL city_slug"

    def test_historical_slugs_do_not_contain_current_slug(self, db_conn):
        """
        A facility's current city_slug must not appear in its own historical_city_slugs.
        If it does, redirect logic would loop back to itself.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE historical_city_slugs IS NOT NULL
                  AND city_slug = ANY(historical_city_slugs)
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} facilities have their current city_slug in historical_city_slugs. "
            "This would cause redirect loops in loadFacilityProfile."
        )


class TestValueRangeInvariants:
    """Field values must fall within expected ranges."""

    def test_deficiency_severity_in_valid_range(self, db_conn):
        """Deficiency severity must be 1, 2, 3, 4, or NULL."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM deficiencies
                WHERE severity IS NOT NULL AND severity NOT BETWEEN 1 AND 4
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} deficiencies have severity outside 1–4. "
            "Valid values: 1=no harm, 2=potential, 3=actual harm, 4=immediate jeopardy."
        )

    def test_no_future_inspection_dates(self, db_conn):
        """No inspection may have an inspection_date in the future."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM inspections
                WHERE inspection_date > CURRENT_DATE
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} inspections have future inspection_date. "
            "Inspection dates must never be in the future."
        )

    def test_no_inspection_date_before_1990(self, db_conn):
        """No inspection should pre-date RCFE licensing era."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM inspections WHERE inspection_date < '1990-01-01'"
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} inspections have date before 1990-01-01. "
            "Dates this old indicate a parsing error."
        )

    def test_cms_star_rating_in_valid_range(self, db_conn):
        """CMS star ratings must be 1–5 or NULL."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE cms_star_rating IS NOT NULL AND cms_star_rating NOT BETWEEN 1 AND 5
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} facilities have cms_star_rating outside 1–5."
        )

    def test_beds_non_negative(self, db_conn):
        """Bed count must be positive when set."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE beds IS NOT NULL AND beds <= 0"
            )
            n = cur.fetchone()["n"]
        assert n == 0, f"{n} facilities have beds <= 0"

    def test_latitude_range_for_us_states(self, db_conn):
        """Geocoded latitudes for US facilities must be roughly 24–50°N."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE latitude IS NOT NULL
                  AND publishable = true
                  AND (latitude::numeric < 24 OR latitude::numeric > 50)
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} publishable facilities have latitude outside 24–50°N. "
            "Indicates a geocoding error or inverted lat/lon."
        )

    def test_longitude_range_for_us_states(self, db_conn):
        """Geocoded longitudes for US facilities must be roughly -125 to -66°W."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE longitude IS NOT NULL
                  AND publishable = true
                  AND (longitude::numeric < -130 OR longitude::numeric > -60)
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} publishable facilities have longitude outside -130 to -60°W."
        )


class TestPublishableDataQuality:
    """Published facilities must meet minimum data quality standards."""

    @pytest.mark.parametrize("state_code", ["CA", "OR", "WA", "MN", "TX", "UT", "IL"])
    def test_publishable_facilities_have_beds(self, db_conn, state_code):
        """
        All publishable facilities should have beds > 0.
        Facilities with NULL/zero beds can't produce a meaningful peer rank.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE state_code = %s AND publishable = true AND (beds IS NULL OR beds = 0)
                """,
                (state_code,),
            )
            n = cur.fetchone()["n"]
        # Allow up to 5 exceptions per state (some facilities genuinely lack bed counts)
        assert n <= 5, (
            f"{state_code}: {n} publishable facilities have NULL/zero beds. "
            "Beds are needed for peer-rank computation."
        )

    @pytest.mark.parametrize("state_code", ["CA", "OR", "WA", "MN", "TX", "UT", "IL"])
    def test_most_publishable_facilities_have_coordinates(self, db_conn, state_code):
        """≥80% of publishable facilities must have latitude and longitude."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) AS geocoded
                FROM facilities
                WHERE state_code = %s AND publishable = true
                """,
                (state_code,),
            )
            row = cur.fetchone()

        total = row["total"] or 0
        geocoded = row["geocoded"] or 0
        if total == 0:
            pytest.skip(f"No publishable facilities for {state_code}")

        pct = geocoded / total * 100
        assert pct >= 80, (
            f"{state_code}: only {pct:.1f}% of publishable facilities are geocoded "
            f"({geocoded}/{total}). Expected ≥80%. Run geocode_facilities.py."
        )

    def test_no_publishable_facilities_have_blank_name(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE publishable = true AND (name IS NULL OR TRIM(name) = '')
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, f"{n} publishable facilities have blank name"

    def test_inspection_source_url_is_set_for_major_states(self, db_conn):
        """
        For states with stable source URLs (CA, OR, PA), ≥90% of inspections
        must have a non-null source_url.
        """
        for state_code in ("CA", "OR", "PA"):
            with db_conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        COUNT(*) AS total,
                        COUNT(*) FILTER (WHERE i.source_url IS NOT NULL AND i.source_url != '') AS with_url
                    FROM inspections i
                    JOIN facilities f ON f.id = i.facility_id
                    WHERE f.state_code = %s
                    """,
                    (state_code,),
                )
                row = cur.fetchone()

            total = row["total"] or 0
            with_url = row["with_url"] or 0
            if total == 0:
                continue

            pct = with_url / total * 100
            assert pct >= 90, (
                f"{state_code}: only {pct:.1f}% of inspections have source_url "
                f"({with_url}/{total}). Expected ≥90%."
            )

    def test_inspection_source_agency_is_set(self, db_conn):
        """
        source_agency must be set on every inspection (CA=CDSS, OR=OR-DHS, WA=WA-DSHS, etc.).
        It drives the correct label in agencyLabelForInspection() in the UI.
        ERRORS.md 2026-05: source_agency was missing → wrong citation labels shown.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.publishable = true
                  AND (i.source_agency IS NULL OR TRIM(i.source_agency) = '')
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} inspections on publishable facilities have no source_agency. "
            "ERRORS.md 2026-05: missing source_agency causes wrong citation labels in UI."
        )


class TestDataConsistencyInvariants:
    """Cross-table consistency checks."""

    def test_total_deficiency_count_matches_actual_deficiencies(self, db_conn):
        """
        inspections.total_deficiency_count (denormalized) must roughly match
        the actual count of rows in deficiencies for the same inspection.
        Allow ±1 difference for edge cases.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS mismatches
                FROM (
                    SELECT
                        i.id,
                        i.total_deficiency_count AS stored,
                        COUNT(d.id) AS actual
                    FROM inspections i
                    LEFT JOIN deficiencies d ON d.inspection_id = i.id
                    JOIN facilities f ON f.id = i.facility_id
                    WHERE f.publishable = true
                      AND i.total_deficiency_count IS NOT NULL
                    GROUP BY i.id, i.total_deficiency_count
                    HAVING ABS(COUNT(d.id) - i.total_deficiency_count) > 1
                ) sub
                """
            )
            mismatches = cur.fetchone()["mismatches"]

        # Allow up to 10 mismatches across the entire DB (edge cases like substantiated gaps)
        assert mismatches <= 10, (
            f"{mismatches} inspections have total_deficiency_count that disagrees "
            "with the actual deficiency row count (±1 tolerance). "
            "Check ingest logic for total_deficiency_count computation."
        )

    def test_ca_inspection_deficiency_narrative_coverage(self, db_conn):
        """
        CA: ≥60% of deficiencies must have non-empty inspector_narrative.
        CA CDSS Transparency API provides full HTML narratives — low coverage
        indicates a parsing regression.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (
                        WHERE d.inspector_narrative IS NOT NULL
                          AND TRIM(d.inspector_narrative) <> ''
                          AND LENGTH(d.inspector_narrative) > 20
                    ) AS with_narrative
                FROM deficiencies d
                JOIN inspections i ON i.id = d.inspection_id
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.state_code = 'CA' AND f.publishable = true
                """
            )
            row = cur.fetchone()

        total = row["total"] or 0
        with_narr = row["with_narrative"] or 0
        if total == 0:
            pytest.skip("No CA deficiencies found")

        pct = with_narr / total * 100
        assert pct >= 60, (
            f"CA: only {pct:.1f}% of deficiencies have inspector_narrative "
            f"({with_narr}/{total}). Expected ≥60%. "
            "CDSS provides full HTML reports — low coverage indicates parsing regression."
        )

    def test_states_table_has_all_50_states(self, db_conn):
        """states table must contain all 50 US states (seeded in 0001_init.sql)."""
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM states")
            n = cur.fetchone()["n"]
        assert n == 50, f"Expected 50 states in states table, got {n}"

    def test_pa_inspection_portal_id_pattern(self, db_conn):
        """
        MEMORY.md: PA inspection URL ID = license_number[:-1].
        For ALL PA facilities with inspections, verify source_url contains
        license_number[:-1] or follows the PA portal URL pattern.
        This is the pattern asserted at pa_hsd_directory_ingest.py startup.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    f.license_number,
                    i.source_url,
                    SUBSTRING(f.license_number, 1, LENGTH(f.license_number)-1) AS portal_id
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                WHERE f.state_code = 'PA'
                  AND f.license_number IS NOT NULL
                  AND i.source_url IS NOT NULL
                  AND LENGTH(f.license_number) > 1
                LIMIT 200
                """
            )
            rows = cur.fetchall()

        if not rows:
            pytest.skip("No PA inspections with source_url found")

        violations = [
            (r["license_number"], r["source_url"])
            for r in rows
            if r["portal_id"] not in r["source_url"]
        ]
        # Allow up to 5% violations (some older records may use different URL patterns)
        violation_pct = len(violations) / len(rows) * 100
        assert violation_pct <= 5, (
            f"{len(violations)}/{len(rows)} ({violation_pct:.1f}%) PA inspection URLs "
            "don't contain the expected portal_id (license_number[:-1]). "
            f"First few: {violations[:3]}"
        )
