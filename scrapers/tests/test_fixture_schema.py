"""
test_fixture_schema.py — Validates all smoke fixture files against the expected
format_version:1 schema used by every state's inspection ingest script.

These tests use the real fixture files from scrapers/fixtures/.
No mocking, no synthetic data.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"

FIXTURE_FILES = [
    "or_inspections_smoke.json",
    "mn_inspections_smoke.json",
    "wa_inspections_smoke.json",
    "tx_inspections_smoke.json",
]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def load_fixture(filename: str) -> dict:
    path = FIXTURES_DIR / filename
    assert path.exists(), f"Fixture file missing: {path}"
    raw = path.read_text(encoding="utf-8")
    return json.loads(raw)


# ─────────────────────────────────────────────────────────────────────────────
# Top-level structure
# ─────────────────────────────────────────────────────────────────────────────


class TestFixtureTopLevel:
    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_format_version_is_1(self, filename):
        data = load_fixture(filename)
        assert data.get("format_version") == 1, (
            f"{filename}: expected format_version=1, got {data.get('format_version')}"
        )

    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_has_facilities_list(self, filename):
        data = load_fixture(filename)
        assert "facilities" in data, f"{filename}: missing top-level 'facilities' key"
        assert isinstance(data["facilities"], list)
        assert len(data["facilities"]) >= 1, f"{filename}: facilities list is empty"

    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_has_note_field(self, filename):
        data = load_fixture(filename)
        assert "note" in data, f"{filename}: missing 'note' field (smoke fixture documentation)"
        assert isinstance(data["note"], str)
        assert len(data["note"]) > 10


# ─────────────────────────────────────────────────────────────────────────────
# Facility-level structure
# ─────────────────────────────────────────────────────────────────────────────


class TestFixtureFacilityLevel:
    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_each_facility_has_license_number(self, filename):
        data = load_fixture(filename)
        for i, facility in enumerate(data["facilities"]):
            assert "license_number" in facility, (
                f"{filename}[{i}]: missing 'license_number'"
            )
            assert isinstance(facility["license_number"], str)
            assert len(facility["license_number"]) > 0

    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_each_facility_has_inspections_list(self, filename):
        data = load_fixture(filename)
        for i, facility in enumerate(data["facilities"]):
            assert "inspections" in facility, (
                f"{filename}[{i}]: missing 'inspections' key"
            )
            assert isinstance(facility["inspections"], list)
            assert len(facility["inspections"]) >= 1, (
                f"{filename}[{i}]: inspections list is empty"
            )


# ─────────────────────────────────────────────────────────────────────────────
# Inspection-level structure
# ─────────────────────────────────────────────────────────────────────────────


class TestFixtureInspectionLevel:
    REQUIRED_INSPECTION_FIELDS = {
        "inspection_date",
        "inspection_type",
        "is_complaint",
        "complaint_id",
        "source_url",
        "raw_data",
        "deficiencies",
    }

    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_inspection_has_all_required_fields(self, filename):
        data = load_fixture(filename)
        for fac in data["facilities"]:
            for j, insp in enumerate(fac["inspections"]):
                missing = self.REQUIRED_INSPECTION_FIELDS - set(insp.keys())
                assert not missing, (
                    f"{filename} facility {fac['license_number']} "
                    f"inspection[{j}]: missing fields {missing}"
                )

    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_inspection_date_is_iso_string(self, filename):
        import re

        iso_re = re.compile(r"^\d{4}-\d{2}-\d{2}$")
        data = load_fixture(filename)
        for fac in data["facilities"]:
            for insp in fac["inspections"]:
                date_val = insp["inspection_date"]
                assert isinstance(date_val, str), (
                    f"{filename}: inspection_date must be string, got {type(date_val)}"
                )
                assert iso_re.match(date_val), (
                    f"{filename}: inspection_date '{date_val}' is not YYYY-MM-DD format"
                )

    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_inspection_type_is_string_or_none(self, filename):
        data = load_fixture(filename)
        for fac in data["facilities"]:
            for insp in fac["inspections"]:
                assert isinstance(insp["inspection_type"], (str, type(None)))

    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_is_complaint_is_boolean(self, filename):
        data = load_fixture(filename)
        for fac in data["facilities"]:
            for insp in fac["inspections"]:
                assert isinstance(insp["is_complaint"], bool), (
                    f"{filename}: is_complaint must be bool, got {type(insp['is_complaint'])}"
                )

    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_complaint_id_matches_is_complaint(self, filename):
        data = load_fixture(filename)
        for fac in data["facilities"]:
            for insp in fac["inspections"]:
                if insp["is_complaint"] is False:
                    assert insp["complaint_id"] is None, (
                        f"{filename}: is_complaint=False but complaint_id is set to "
                        f"'{insp['complaint_id']}'"
                    )

    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_source_url_is_https(self, filename):
        data = load_fixture(filename)
        for fac in data["facilities"]:
            for insp in fac["inspections"]:
                url = insp["source_url"]
                assert isinstance(url, str), f"{filename}: source_url must be string"
                assert url.startswith("https://"), (
                    f"{filename}: source_url '{url}' does not start with https://"
                )

    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_raw_data_is_dict(self, filename):
        data = load_fixture(filename)
        for fac in data["facilities"]:
            for insp in fac["inspections"]:
                assert isinstance(insp["raw_data"], dict), (
                    f"{filename}: raw_data must be dict"
                )

    @pytest.mark.parametrize("filename", FIXTURE_FILES)
    def test_deficiencies_is_list(self, filename):
        data = load_fixture(filename)
        for fac in data["facilities"]:
            for insp in fac["inspections"]:
                assert isinstance(insp["deficiencies"], list), (
                    f"{filename}: deficiencies must be list"
                )


# ─────────────────────────────────────────────────────────────────────────────
# Deficiency-level structure (per state)
# ─────────────────────────────────────────────────────────────────────────────


class TestFixtureDeficiencyLevel:
    """Each state's deficiency schema has slight variations — test them all."""

    def test_tx_deficiencies_have_severity_and_class(self, tx_fixture):
        for fac in tx_fixture["facilities"]:
            for insp in fac["inspections"]:
                for def_ in insp["deficiencies"]:
                    assert "severity" in def_, "TX deficiency missing 'severity'"
                    assert isinstance(def_["severity"], int)
                    assert 1 <= def_["severity"] <= 4, (
                        f"TX severity {def_['severity']} out of range [1,4]"
                    )
                    assert "class" in def_, "TX deficiency missing 'class'"
                    assert "code" in def_, "TX deficiency missing 'code'"
                    assert "immediate_jeopardy" in def_
                    assert isinstance(def_["immediate_jeopardy"], bool)

    def test_tx_deficiency_state_severity_raw_present(self, tx_fixture):
        for fac in tx_fixture["facilities"]:
            for insp in fac["inspections"]:
                for def_ in insp["deficiencies"]:
                    assert "state_severity_raw" in def_
                    assert isinstance(def_["state_severity_raw"], str)
                    assert def_["state_severity_raw"].startswith("Type")

    def test_or_deficiencies_code_may_be_null(self, or_fixture):
        # OR uses null code (no F-tag system)
        for fac in or_fixture["facilities"]:
            for insp in fac["inspections"]:
                for def_ in insp["deficiencies"]:
                    assert "code" in def_  # key must exist, value can be None
                    assert "category" in def_
                    assert "description" in def_
                    assert "immediate_jeopardy" in def_
                    assert isinstance(def_["immediate_jeopardy"], bool)
                    # OR does NOT always have severity field (state uses narrative only)
                    if "severity" in def_:
                        assert isinstance(def_["severity"], (int, type(None)))

    def test_mn_deficiencies_minimal_schema(self, mn_fixture):
        # MN fixtures use minimal schema — code may be null
        for fac in mn_fixture["facilities"]:
            for insp in fac["inspections"]:
                for def_ in insp["deficiencies"]:
                    assert "description" in def_
                    assert "immediate_jeopardy" in def_
                    assert isinstance(def_["immediate_jeopardy"], bool)

    def test_wa_deficiencies_list_may_be_empty(self, wa_fixture):
        # WA fixture has empty deficiencies (inspection had no violations)
        for fac in wa_fixture["facilities"]:
            for insp in fac["inspections"]:
                assert isinstance(insp["deficiencies"], list)
                # Empty list is valid for WA — pass if empty
                for def_ in insp["deficiencies"]:
                    assert "immediate_jeopardy" in def_


# ─────────────────────────────────────────────────────────────────────────────
# Cross-fixture consistency
# ─────────────────────────────────────────────────────────────────────────────


class TestFixtureCrossStateConsistency:
    def test_all_fixtures_share_common_inspection_keys(self):
        """Every fixture must have the same mandatory inspection fields."""
        common_keys = {
            "inspection_date",
            "inspection_type",
            "is_complaint",
            "complaint_id",
            "source_url",
            "raw_data",
            "deficiencies",
        }
        for filename in FIXTURE_FILES:
            data = load_fixture(filename)
            for fac in data["facilities"]:
                for insp in fac["inspections"]:
                    present = set(insp.keys())
                    missing = common_keys - present
                    assert not missing, (
                        f"{filename}: inspection missing cross-state keys: {missing}"
                    )

    def test_all_fixtures_use_format_version_1(self):
        for filename in FIXTURE_FILES:
            data = load_fixture(filename)
            assert data["format_version"] == 1
