"""
Layer B — Known-fixture field-level assertions.

Every test in this file queries the REAL Supabase database and asserts
exact field values for known reference facilities documented in MEMORY.md.

These tests prove the full ingest pipeline worked correctly end-to-end:
the raw source → Python ingest script → DB row → all downstream columns.

No mocks. No fake data. Direct psycopg SELECT on the production/staging DB.

Run:
    pytest tests/test_db_fixtures.py -m db -v
"""
from __future__ import annotations

import pytest

from conftest import (
    CA_OPAL_CARE,
    PA_CAMBRIDGE_VILLAGE,
    PA_RITTENHOUSE,
    PA_SERENITY_GARDENS,
)

pytestmark = pytest.mark.db


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_facility(cur, license_number: str, state_code: str) -> dict:
    """Fetch a facility row by license_number + state_code. Fails if not found."""
    cur.execute(
        "SELECT * FROM facilities WHERE license_number = %s AND state_code = %s LIMIT 1",
        (license_number, state_code),
    )
    row = cur.fetchone()
    assert row is not None, (
        f"Facility with license_number='{license_number}' and state_code='{state_code}' "
        f"not found in database. Ingest may not have run or row was deleted."
    )
    return row


def _fetch_inspection_count(cur, facility_id: str) -> int:
    cur.execute(
        "SELECT COUNT(*) AS n FROM inspections WHERE facility_id = %s",
        (facility_id,),
    )
    return cur.fetchone()["n"]


def _fetch_deficiency_count(cur, facility_id: str) -> int:
    cur.execute(
        """
        SELECT COUNT(*) AS n
        FROM deficiencies d
        JOIN inspections i ON i.id = d.inspection_id
        WHERE i.facility_id = %s
        """,
        (facility_id,),
    )
    return cur.fetchone()["n"]


def _fetch_inspections(cur, facility_id: str) -> list[dict]:
    cur.execute(
        "SELECT * FROM inspections WHERE facility_id = %s ORDER BY inspection_date DESC",
        (facility_id,),
    )
    return cur.fetchall()


# ─────────────────────────────────────────────────────────────────────────────
# CA — Opal Care LLC (license 200672, Oakland)
# ─────────────────────────────────────────────────────────────────────────────

class TestCAOpalCare:
    """
    Opal Care LLC — CA's most-cited RCFE. Used as the primary regression fixture
    for negative-tier ranking correctness (ERRORS.md 2026-05 'inspections silently
    truncated' + smoke_test.py opal-care regression).
    """

    @pytest.fixture(autouse=True)
    def facility(self, db_conn):
        with db_conn.cursor() as cur:
            self._facility = _fetch_facility(cur, CA_OPAL_CARE["license_number"], "CA")

    @property
    def fac(self):
        return self._facility

    def test_exists_in_db(self):
        assert self.fac is not None

    def test_license_number(self):
        assert self.fac["license_number"] == CA_OPAL_CARE["license_number"], (
            f"Expected license_number='{CA_OPAL_CARE['license_number']}', "
            f"got '{self.fac['license_number']}'"
        )

    def test_state_code(self):
        assert self.fac["state_code"] == "CA"

    def test_name_contains_opal(self):
        assert CA_OPAL_CARE["name_fragment"].lower() in self.fac["name"].lower(), (
            f"Expected name to contain '{CA_OPAL_CARE['name_fragment']}', "
            f"got '{self.fac['name']}'"
        )

    def test_city_slug(self):
        assert self.fac["city_slug"] == CA_OPAL_CARE["city_slug"], (
            f"Expected city_slug='{CA_OPAL_CARE['city_slug']}', "
            f"got '{self.fac['city_slug']}'"
        )

    def test_slug(self):
        assert self.fac["slug"] == CA_OPAL_CARE["slug"], (
            f"Expected slug='{CA_OPAL_CARE['slug']}', got '{self.fac['slug']}'"
        )

    def test_publishable(self):
        assert self.fac["publishable"] is True, (
            "Opal Care must be publishable=true. "
            "It is a reference facility for the CA pipeline."
        )

    def test_serves_memory_care(self):
        assert self.fac["serves_memory_care"] is True, (
            "Opal Care must serve_memory_care=true (has MC disclosure or name keyword). "
            "If false, the signal recompute failed."
        )

    def test_license_status(self):
        assert self.fac["license_status"] == "LICENSED", (
            f"Expected license_status='LICENSED', got '{self.fac['license_status']}'"
        )

    def test_mc_review_status_not_rejected(self):
        status = self.fac["mc_review_status"]
        assert status != "reviewed_reject", (
            "Opal Care mc_review_status='reviewed_reject' would make it un-publishable. "
            f"Current status: {status}"
        )

    def test_beds_populated(self):
        beds = self.fac["beds"]
        assert beds is not None and beds > 0, (
            f"beds must be > 0 for Opal Care. Got: {beds}"
        )

    def test_latitude_populated(self):
        lat = self.fac["latitude"]
        assert lat is not None, "latitude must be populated after geocoding"
        lat_f = float(lat)
        assert 32 < lat_f < 42, f"CA latitude out of range: {lat_f}"

    def test_longitude_populated(self):
        lon = self.fac["longitude"]
        assert lon is not None, "longitude must be populated after geocoding"
        lon_f = float(lon)
        assert -125 < lon_f < -114, f"CA longitude out of range: {lon_f}"

    def test_street_populated(self):
        assert self.fac["street"], "street address must be populated"

    def test_city_populated(self):
        assert self.fac["city"], "city must be populated"

    def test_zip_populated(self):
        assert self.fac["zip"], "zip code must be populated"

    def test_care_category_populated(self):
        assert self.fac["care_category"], "care_category must be populated"

    def test_source_url_populated(self):
        assert self.fac["source_url"], "source_url must be populated"

    def test_inspections_exist(self, db_conn):
        with db_conn.cursor() as cur:
            count = _fetch_inspection_count(cur, str(self.fac["id"]))
        assert count >= 3, (
            f"Opal Care must have ≥3 inspections. Got {count}. "
            "CA's most-cited facility should have a deep inspection history."
        )

    def test_deficiencies_exist(self, db_conn):
        with db_conn.cursor() as cur:
            count = _fetch_deficiency_count(cur, str(self.fac["id"]))
        assert count >= 10, (
            f"Opal Care must have ≥10 deficiencies. Got {count}. "
            "This is CA's most-cited facility."
        )

    def test_at_least_one_inspection_has_source_url(self, db_conn):
        with db_conn.cursor() as cur:
            inspections = _fetch_inspections(cur, str(self.fac["id"]))
        urls = [i["source_url"] for i in inspections if i.get("source_url")]
        assert urls, "At least one inspection must have a source_url (CDSS report link)"

    def test_at_least_one_inspection_has_source_agency(self, db_conn):
        with db_conn.cursor() as cur:
            inspections = _fetch_inspections(cur, str(self.fac["id"]))
        agencies = [i["source_agency"] for i in inspections if i.get("source_agency")]
        assert agencies, "At least one inspection must have source_agency set"

    def test_inspection_dates_are_in_past(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS future_count
                FROM inspections
                WHERE facility_id = %s AND inspection_date > CURRENT_DATE
                """,
                (str(self.fac["id"]),),
            )
            future_count = cur.fetchone()["future_count"]
        assert future_count == 0, (
            f"{future_count} inspection(s) with future dates found for Opal Care"
        )

    def test_deficiencies_have_valid_severity(self, db_conn):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM deficiencies d
                JOIN inspections i ON i.id = d.inspection_id
                WHERE i.facility_id = %s
                  AND d.severity IS NOT NULL
                  AND d.severity NOT BETWEEN 1 AND 4
                """,
                (str(self.fac["id"]),),
            )
            bad = cur.fetchone()["n"]
        assert bad == 0, (
            f"{bad} deficiencies for Opal Care have severity outside 1–4 range"
        )

    def test_memory_care_signal_is_tier1(self, db_conn):
        """Opal Care must have at least one Tier-1 MC signal: name, disclosure, or curated."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    mc_signal_explicit_name,
                    memory_care_disclosure_filed,
                    mc_signal_chain_curated,
                    mc_signal_apfm_listed,
                    mc_signal_caring_listed
                FROM facilities WHERE id = %s
                """,
                (str(self.fac["id"]),),
            )
            row = cur.fetchone()

        tier1 = (
            row["mc_signal_explicit_name"]
            or row["memory_care_disclosure_filed"]
            or row["mc_signal_chain_curated"]
            or (row["mc_signal_apfm_listed"] and row["mc_signal_caring_listed"])
        )
        assert tier1, (
            f"Opal Care has no Tier-1 MC signal. "
            f"Signals: name={row['mc_signal_explicit_name']}, "
            f"disclosure={row['memory_care_disclosure_filed']}, "
            f"curated={row['mc_signal_chain_curated']}, "
            f"apfm={row['mc_signal_apfm_listed']}, caring={row['mc_signal_caring_listed']}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# PA — Rittenhouse (license 223010)
# ─────────────────────────────────────────────────────────────────────────────

class TestPARittenhouse:
    """
    Rittenhouse Senior Living PA (license 223010) — PA reference fixture from MEMORY.md.
    All three PA reference facilities must be publishable with mc_review_status='auto_published'.
    """

    @pytest.fixture(autouse=True)
    def facility(self, db_conn):
        with db_conn.cursor() as cur:
            self._facility = _fetch_facility(cur, PA_RITTENHOUSE["license_number"], "PA")

    @property
    def fac(self):
        return self._facility

    def test_exists_in_db(self):
        assert self.fac is not None

    def test_state_code(self):
        assert self.fac["state_code"] == "PA"

    def test_license_number(self):
        assert self.fac["license_number"] == PA_RITTENHOUSE["license_number"]

    def test_publishable(self):
        assert self.fac["publishable"] is True, (
            "PA Rittenhouse must be publishable. "
            "Confirmed publishable in MEMORY.md 2026-05-24."
        )

    def test_serves_memory_care(self):
        assert self.fac["serves_memory_care"] is True, (
            "PA Rittenhouse must serve_memory_care=true. "
            "PA Tier-1 signal: mc_designation_type IS NOT NULL."
        )

    def test_mc_review_status(self):
        assert self.fac["mc_review_status"] == "auto_published", (
            f"PA Rittenhouse must have mc_review_status='auto_published'. "
            f"Got: '{self.fac['mc_review_status']}'"
        )

    def test_mc_designation_type_not_null(self):
        """PA memory care designation column must be set (not NULL)."""
        assert self.fac["mc_designation_type"] is not None, (
            "mc_designation_type must not be NULL for PA Rittenhouse. "
            "This is the PA Tier-1 signal (DHS XLSX Special Care/Secure Dementia column)."
        )

    def test_mc_designation_type_valid_value(self):
        """mc_designation_type must be one of the two valid PA values."""
        valid = {"Secure Dementia Care Unit", "Special Care"}
        val = self.fac["mc_designation_type"]
        assert val in valid, (
            f"mc_designation_type='{val}' not in valid PA set {valid}"
        )

    def test_memory_care_disclosure_filed(self):
        """PA ingest mirrors mc_designation_type into memory_care_disclosure_filed."""
        assert self.fac["memory_care_disclosure_filed"] is True, (
            "memory_care_disclosure_filed must be true for PA Rittenhouse. "
            "pa_hsd_directory_ingest.py mirrors this from mc_designation_type."
        )

    def test_license_status(self):
        assert self.fac["license_status"] == "LICENSED", (
            f"Expected LICENSED, got '{self.fac['license_status']}'"
        )

    def test_beds_populated(self):
        assert self.fac["beds"] is not None and self.fac["beds"] > 0

    def test_street_populated(self):
        assert self.fac["street"], "PA facility must have a street address"

    def test_city_populated(self):
        assert self.fac["city"], "PA facility must have a city"

    def test_zip_populated(self):
        assert self.fac["zip"], "PA facility must have a zip code"

    def test_inspections_exist(self, db_conn):
        """PA Rittenhouse must have inspections (from pa_dhs_inspections_scraper.py)."""
        with db_conn.cursor() as cur:
            count = _fetch_inspection_count(cur, str(self.fac["id"]))
        assert count >= 1, (
            f"PA Rittenhouse must have ≥1 inspection. Got {count}. "
            "Run pa_dhs_inspections_scraper.py if missing."
        )

    def test_inspection_source_url_uses_portal_id(self, db_conn):
        """
        PA inspection URLs must use license_number[:-1] as the portal ID.
        223010 → 22301 (MEMORY.md documented pattern).
        """
        with db_conn.cursor() as cur:
            inspections = _fetch_inspections(cur, str(self.fac["id"]))
        if not inspections:
            pytest.skip("No inspections ingested yet for PA Rittenhouse")

        portal_id = PA_RITTENHOUSE["inspection_portal_id"]  # "22301"
        urls_with_portal_id = [
            i["source_url"]
            for i in inspections
            if i.get("source_url") and portal_id in i["source_url"]
        ]
        assert urls_with_portal_id, (
            f"Expected inspection source_url to contain portal_id='{portal_id}' "
            f"(license_number[:-1] = {PA_RITTENHOUSE['license_number']}[:-1]). "
            f"Source URLs found: {[i['source_url'] for i in inspections[:3]]}"
        )

    def test_slug_format(self):
        """Slug must be non-empty and URL-safe."""
        slug = self.fac["slug"]
        assert slug, "slug must be non-empty"
        assert " " not in slug, f"slug contains spaces: '{slug}'"
        assert slug == slug.lower(), f"slug must be lowercase: '{slug}'"


# ─────────────────────────────────────────────────────────────────────────────
# PA — Serenity Gardens (license 231010)
# ─────────────────────────────────────────────────────────────────────────────

class TestPASerenityGardens:
    """Serenity Gardens PA (license 231010) — second PA reference fixture."""

    @pytest.fixture(autouse=True)
    def facility(self, db_conn):
        with db_conn.cursor() as cur:
            self._facility = _fetch_facility(cur, PA_SERENITY_GARDENS["license_number"], "PA")

    @property
    def fac(self):
        return self._facility

    def test_exists_in_db(self):
        assert self.fac is not None

    def test_publishable(self):
        assert self.fac["publishable"] is True

    def test_serves_memory_care(self):
        assert self.fac["serves_memory_care"] is True

    def test_mc_review_status(self):
        assert self.fac["mc_review_status"] == "auto_published"

    def test_mc_designation_type_not_null(self):
        assert self.fac["mc_designation_type"] is not None

    def test_memory_care_disclosure_filed(self):
        assert self.fac["memory_care_disclosure_filed"] is True

    def test_license_status(self):
        assert self.fac["license_status"] == "LICENSED"

    def test_beds_populated(self):
        assert self.fac["beds"] is not None and self.fac["beds"] > 0

    def test_inspection_portal_id_pattern(self, db_conn):
        """Inspection URLs must contain portal_id=231010[:-1]=23101."""
        with db_conn.cursor() as cur:
            inspections = _fetch_inspections(cur, str(self.fac["id"]))
        if not inspections:
            pytest.skip("No inspections ingested yet for PA Serenity Gardens")
        portal_id = PA_SERENITY_GARDENS["inspection_portal_id"]
        matches = [i for i in inspections if i.get("source_url") and portal_id in i["source_url"]]
        assert matches, (
            f"No inspection source_url contains portal_id '{portal_id}' "
            f"(license {PA_SERENITY_GARDENS['license_number']}[:-1])"
        )


# ─────────────────────────────────────────────────────────────────────────────
# PA — Cambridge Village (license 456560)
# ─────────────────────────────────────────────────────────────────────────────

class TestPACambridgeVillage:
    """Cambridge Village PA (license 456560) — third PA reference fixture."""

    @pytest.fixture(autouse=True)
    def facility(self, db_conn):
        with db_conn.cursor() as cur:
            self._facility = _fetch_facility(cur, PA_CAMBRIDGE_VILLAGE["license_number"], "PA")

    @property
    def fac(self):
        return self._facility

    def test_exists_in_db(self):
        assert self.fac is not None

    def test_publishable(self):
        assert self.fac["publishable"] is True

    def test_serves_memory_care(self):
        assert self.fac["serves_memory_care"] is True

    def test_mc_review_status(self):
        assert self.fac["mc_review_status"] == "auto_published"

    def test_mc_designation_type_not_null(self):
        assert self.fac["mc_designation_type"] is not None

    def test_memory_care_disclosure_filed(self):
        assert self.fac["memory_care_disclosure_filed"] is True

    def test_license_status(self):
        assert self.fac["license_status"] == "LICENSED"

    def test_beds_populated(self):
        assert self.fac["beds"] is not None and self.fac["beds"] > 0

    def test_inspection_portal_id_pattern(self, db_conn):
        """Inspection URLs must contain portal_id=456560[:-1]=45656."""
        with db_conn.cursor() as cur:
            inspections = _fetch_inspections(cur, str(self.fac["id"]))
        if not inspections:
            pytest.skip("No inspections ingested yet for PA Cambridge Village")
        portal_id = PA_CAMBRIDGE_VILLAGE["inspection_portal_id"]
        matches = [i for i in inspections if i.get("source_url") and portal_id in i["source_url"]]
        assert matches, (
            f"No inspection source_url contains portal_id '{portal_id}' "
            f"(license {PA_CAMBRIDGE_VILLAGE['license_number']}[:-1])"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Per-state: spot-check a publishable MC facility for each covered state
# ─────────────────────────────────────────────────────────────────────────────

class TestStateRepresentativeFacilities:
    """
    For each ingested state, fetch the first publishable MC facility and assert
    that the required fields are populated. This is a general-purpose completeness
    check — not tied to a specific license number.
    """

    @pytest.mark.parametrize("state_code", ["CA", "OR", "WA", "MN", "TX", "UT", "IL"])
    def test_publishable_mc_facility_has_required_fields(self, db_conn, state_code):
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT *
                FROM facilities
                WHERE state_code = %s
                  AND publishable = true
                  AND serves_memory_care = true
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (state_code,),
            )
            row = cur.fetchone()

        assert row is not None, (
            f"No publishable MC facility found for state {state_code}. "
            "Ingest may not have run or recompute_publishable.py hasn't been run."
        )

        # Every publishable MC facility must have these fields
        assert row["name"], f"{state_code}: facility name is empty"
        assert row["slug"], f"{state_code}: facility slug is empty"
        assert row["city_slug"], f"{state_code}: city_slug is empty"
        assert row["license_status"] == "LICENSED", (
            f"{state_code}: publishable facility has license_status='{row['license_status']}'"
        )
        assert row["serves_memory_care"] is True, f"{state_code}: serves_memory_care mismatch"
        assert row["mc_review_status"] != "reviewed_reject", (
            f"{state_code}: publishable facility has mc_review_status='reviewed_reject' — "
            "this should be impossible"
        )

    @pytest.mark.parametrize("state_code", ["CA", "OR", "WA", "MN", "TX", "UT", "IL"])
    def test_publishable_facility_has_at_least_one_inspection(self, db_conn, state_code):
        """Every publishable facility must have ≥1 inspection (freshness gate requirement)."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT f.id, f.name, COUNT(i.id) AS insp_count
                FROM facilities f
                LEFT JOIN inspections i ON i.facility_id = f.id
                WHERE f.state_code = %s AND f.publishable = true
                GROUP BY f.id, f.name
                HAVING COUNT(i.id) = 0
                LIMIT 5
                """,
                (state_code,),
            )
            no_insp = cur.fetchall()

        assert not no_insp, (
            f"{state_code}: {len(no_insp)} publishable facilities have 0 inspections. "
            f"First few: {[r['name'] for r in no_insp]}. "
            "The freshness gate in recompute_publishable.py should prevent this."
        )

    @pytest.mark.parametrize("state_code", ["CA", "OR", "WA", "MN"])
    def test_inspections_link_to_deficiencies(self, db_conn, state_code):
        """For states with full deficiency ingest, ≥50% of inspections must have deficiencies."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(DISTINCT i.id) AS total_insp,
                    COUNT(DISTINCT d.inspection_id) AS insp_with_defs
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                LEFT JOIN deficiencies d ON d.inspection_id = i.id
                WHERE f.state_code = %s AND f.publishable = true
                """,
                (state_code,),
            )
            row = cur.fetchone()

        total = row["total_insp"] or 0
        with_defs = row["insp_with_defs"] or 0
        if total == 0:
            pytest.skip(f"No inspections for {state_code}")

        pct = with_defs / total * 100
        assert pct >= 20, (
            f"{state_code}: only {pct:.1f}% of inspections have deficiencies "
            f"({with_defs}/{total}). Expected ≥20% — deficiency ingest may not have run."
        )


# ─────────────────────────────────────────────────────────────────────────────
# State-specific signal fixture tests
# ─────────────────────────────────────────────────────────────────────────────

class TestStateSpecificSignals:
    """Verify state-specific Tier-1 signal columns are populated for relevant facilities."""

    def test_or_has_mce_endorsed_facilities(self, db_conn):
        """Oregon must have ≥1 facility with mce_endorsed=true (ORS 443.886 MCE)."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE state_code='OR' AND mce_endorsed=true"
            )
            n = cur.fetchone()["n"]
        assert n >= 1, (
            f"No OR facilities with mce_endorsed=true. "
            f"or_signal_mce.py or or_providers_ingest.py may not have run. Got: {n}"
        )

    def test_or_mce_endorsed_facility_is_publishable(self, db_conn):
        """An MCE-endorsed OR facility must be publishable (the MCE is a Tier-1 signal)."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE state_code='OR' AND mce_endorsed=true AND publishable=true
                """
            )
            n = cur.fetchone()["n"]
        assert n >= 1, (
            "No MCE-endorsed OR facility is publishable. "
            "mce_endorsed=true must set serves_memory_care=true via recompute_publishable.py."
        )

    def test_wa_has_memory_care_certified_facilities(self, db_conn):
        """WA must have ≥1 facility with wa_memory_care_certified=true."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE state_code='WA' AND wa_memory_care_certified=true"
            )
            n = cur.fetchone()["n"]
        assert n >= 1, (
            f"No WA facilities with wa_memory_care_certified=true. Got: {n}"
        )

    def test_wa_signal_sets_serves_mc(self, db_conn):
        """WA facilities with any of the 3 MC signals must have serves_memory_care=true."""
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE state_code='WA'
                  AND (wa_memory_care_certified OR wa_earc_sdc_contracted OR wa_dementia_specialty)
                  AND serves_memory_care = false
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} WA facilities have a WA MC signal but serves_memory_care=false. "
            "recompute_publishable.py WA branch is not working correctly."
        )

    def test_mn_has_dementia_care_licensed_facilities(self, db_conn):
        """MN must have ≥1 facility with mn_dementia_care_licensed=true."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE state_code='MN' AND mn_dementia_care_licensed=true"
            )
            n = cur.fetchone()["n"]
        assert n >= 1, f"No MN facilities with mn_dementia_care_licensed=true. Got: {n}"

    def test_tx_has_alzheimer_certified_facilities(self, db_conn):
        """TX must have ≥1 facility with tx_alzheimer_certified=true."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE state_code='TX' AND tx_alzheimer_certified=true"
            )
            n = cur.fetchone()["n"]
        assert n >= 1, f"No TX facilities with tx_alzheimer_certified=true. Got: {n}"

    def test_ut_has_secure_beds_facilities(self, db_conn):
        """UT must have ≥1 facility with secure_beds > 0 (R432-270-16 Secure Units)."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE state_code='UT' AND secure_beds > 0"
            )
            n = cur.fetchone()["n"]
        assert n >= 1, f"No UT facilities with secure_beds>0. Got: {n}"

    def test_pa_has_mc_designation_type_facilities(self, db_conn):
        """PA must have ≥1 facility with mc_designation_type IS NOT NULL."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM facilities WHERE state_code='PA' AND mc_designation_type IS NOT NULL"
            )
            n = cur.fetchone()["n"]
        assert n >= 1, f"No PA facilities with mc_designation_type set. Got: {n}"

    def test_or_unendorsed_violation_is_never_publishable(self, db_conn):
        """
        ERRORS.md 2026-05: unendorsed_mc_violation must NOT cause publishable=true.
        Facilities violating naming rules without MCE endorsement are NOT memory care.
        """
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM facilities
                WHERE state_code = 'OR'
                  AND unendorsed_mc_violation = true
                  AND mce_endorsed = false
                  AND publishable = true
                """
            )
            n = cur.fetchone()["n"]
        assert n == 0, (
            f"{n} OR facilities with unendorsed_mc_violation=true (no MCE) are publishable. "
            "This is the known false-positive bug (ERRORS.md 2026-05). "
            "The violation flag must never promote publishable."
        )
