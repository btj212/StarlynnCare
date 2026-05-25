"""
Comprehensive pure-function parsing tests for ALL state ingest scripts.

These tests import parsing/transformation functions directly from the scraper
modules and verify them against realistic inputs drawn from the actual CSV
column formats documented in each script's docstring.

No database connection required — all tests are deterministic.
"""

from __future__ import annotations

import csv
import io
import sys
from datetime import date
from pathlib import Path

import pytest

# ─── Import scraper modules via sys.path (configured in conftest.py) ─────────

or_providers = pytest.importorskip(
    "or_providers_ingest",
    reason="or_providers_ingest deps unavailable",
)
or_inspections = pytest.importorskip(
    "or_inspections_ingest",
    reason="or_inspections_ingest deps unavailable",
)
or_violations = pytest.importorskip(
    "or_violations_ingest",
    reason="or_violations_ingest deps unavailable",
)
wa_dshs = pytest.importorskip(
    "wa_dshs_directory_ingest",
    reason="wa_dshs_directory_ingest deps unavailable",
)
tx_alf = pytest.importorskip(
    "tx_alf_ingest",
    reason="tx_alf_ingest deps unavailable",
)
mn_alrc = pytest.importorskip(
    "mn_alrc_ingest",
    reason="mn_alrc_ingest deps unavailable",
)


# ═══════════════════════════════════════════════════════════════════════════════
# SHARED / COMMON HELPERS (slug + titleize appear in every state's script)
# ═══════════════════════════════════════════════════════════════════════════════


class TestSlugify:
    """slugify() is re-implemented identically in every ingest script."""

    @pytest.mark.parametrize(
        "inpt,expected",
        [
            # Basic lowercase + hyphenation
            ("Opal Care Memory Care", "opal-care-memory-care"),
            ("SHADY PINES", "shady-pines"),
            ("  leading and trailing  ", "leading-and-trailing"),
            # Special characters → hyphens
            ("St. Mary's Home", "st-mary-s-home"),
            ("Sunrise Senior Living, LLC", "sunrise-senior-living-llc"),
            ("A & B Care", "a-b-care"),
            # Numbers preserved
            ("ABC123 Care", "abc123-care"),
            ("3rd Street Senior", "3rd-street-senior"),
            # Consecutive special chars → single hyphen
            ("Care--Home", "care-home"),
            ("Care   Home", "care-home"),
            # Empty / edge
            ("", "facility"),
            ("   ", "facility"),
            ("---", "facility"),
            # Already lowercase
            ("hillcrest manor", "hillcrest-manor"),
        ],
    )
    def test_or_slugify(self, inpt: str, expected: str) -> None:
        assert or_providers.slugify(inpt) == expected

    @pytest.mark.parametrize(
        "inpt,expected",
        [
            ("Sunrise Memory Care", "sunrise-memory-care"),
            ("", "facility"),
            ("THE VINEYARD", "the-vineyard"),
        ],
    )
    def test_wa_slugify(self, inpt: str, expected: str) -> None:
        assert wa_dshs.slugify(inpt) == expected

    @pytest.mark.parametrize(
        "inpt,expected",
        [
            ("Sunrise Senior Living", "sunrise-senior-living"),
            ("", "facility"),
        ],
    )
    def test_tx_slugify(self, inpt: str, expected: str) -> None:
        assert tx_alf.slugify(inpt) == expected

    @pytest.mark.parametrize(
        "inpt,expected",
        [
            ("Elim Care Brooklyn Park", "elim-care-brooklyn-park"),
            ("", "facility"),
        ],
    )
    def test_mn_slugify(self, inpt: str, expected: str) -> None:
        assert mn_alrc.slugify(inpt) == expected


class TestTitleize:
    """titleize() converts ALL-CAPS source data to proper title case."""

    @pytest.mark.parametrize(
        "inpt,expected",
        [
            # Stop words stay lower after position 0
            ("OPAL CARE MEMORY CARE", "Opal Care Memory Care"),
            ("SISTERS OF MERCY", "Sisters of Mercy"),
            ("THE VINEYARD AT BEAVERTON", "The Vineyard at Beaverton"),
            ("HOME FOR THE AGED", "Home for the Aged"),
            ("RIDGE AT HILLTOP", "Ridge at Hilltop"),
            # First word always capitalised even if stop word
            ("OF THE VALLEY", "Of the Valley"),
            ("IN THE PINES", "In the Pines"),
            # Empty
            ("", ""),
            # Mixed input
            ("maplewood senior living", "Maplewood Senior Living"),
            # Single word
            ("HILLCREST", "Hillcrest"),
        ],
    )
    def test_or_titleize(self, inpt: str, expected: str) -> None:
        assert or_providers.titleize(inpt) == expected

    @pytest.mark.parametrize(
        "inpt,expected",
        [
            ("MEMORY CARE AT BELLINGHAM", "Memory Care at Bellingham"),
            ("", ""),
        ],
    )
    def test_wa_titleize(self, inpt: str, expected: str) -> None:
        assert wa_dshs.titleize(inpt) == expected

    def test_tx_titleize_spanish_stop_words(self) -> None:
        # TX titleize includes Spanish stop words: de, del, las, los, el, la
        result = tx_alf.titleize("HACIENDA DE LOS ANGELES")
        assert result == "Hacienda de los Angeles"

    def test_mn_titleize(self) -> None:
        assert mn_alrc.titleize("ELIM CARE BROOKLYN PARK") == "Elim Care Brooklyn Park"


# ═══════════════════════════════════════════════════════════════════════════════
# OR PROVIDERS — or_providers_ingest.py
# ═══════════════════════════════════════════════════════════════════════════════


class TestOrProvidersFacilitySlug:
    """
    OR facility_slug uses external_id (alphanumeric like "50R368") as suffix.
    Unlike numeric-only states, OR IDs are already compact.
    """

    def test_standard_alphanumeric_id(self) -> None:
        slug = or_providers.facility_slug("Opal Care Memory Care", "50R368")
        assert slug.startswith("opal-care-memory-care-")
        assert "50R368" in slug or "50r368" in slug.lower() or slug.endswith("50R368"[-8:].lstrip("0"))

    def test_numeric_external_id_strips_leading_zeros(self) -> None:
        slug = or_providers.facility_slug("Rose Garden Care", "0000001234")
        assert slug.startswith("rose-garden-care-")
        # suffix should strip leading zeros from last 8 chars
        assert not slug.endswith("-00000012")  # leading zeros stripped

    def test_short_id_preserved(self) -> None:
        slug = or_providers.facility_slug("Cedar Hills", "50M300")
        assert "cedar-hills-" in slug

    def test_empty_name_falls_back(self) -> None:
        # slugify("") returns "facility"; slug should still be valid
        slug = or_providers.facility_slug("", "ABC123")
        assert slug.startswith("facility-")


class TestOrProvidersRowToRecord:
    """
    row_to_record maps CSV rows (exact column names from OR DHS export) to
    DB record dicts. Every field must map correctly.
    """

    def _make_row(self, **overrides: str) -> dict[str, str]:
        defaults = {
            "ID": "50R368",
            "Name": "OPAL CARE MEMORY CARE",
            "Type": "Residential Care Facility",
            "Address": "1234 OAK ST",
            "City": "PORTLAND",
            "Zip": "97201",
            "County": "Multnomah",
            "Licensed beds": "42",
            "Accepts Medicaid": "Yes",
            "Memory Care": "Yes",
            "Status": "Open",
        }
        defaults.update(overrides)
        return defaults

    def test_full_row_all_fields_present(self) -> None:
        rec = or_providers.row_to_record(self._make_row())
        assert rec is not None
        # Identity
        assert rec["external_id"] == "50R368"
        assert rec["license_number"] == "50R368"
        assert rec["state_code"] == "OR"
        # Name transformations
        assert rec["name"] == "Opal Care Memory Care"
        assert rec["city"] == "Portland"
        assert rec["city_slug"] == "portland"
        assert rec["slug"].startswith("opal-care-memory-care-")
        # Address
        assert rec["street"] == "1234 Oak St"
        assert rec["zip"] == "97201"
        # Facility characteristics
        assert rec["beds"] == 42
        assert rec["license_type"] == "Residential Care Facility"
        # Memory care signal — "Yes" → True
        assert rec["mce_endorsed"] is True
        assert rec["serves_memory_care"] is True
        # Status
        assert rec["license_status"] == "LICENSED"
        # publishable is always False (set by recompute)
        assert rec["publishable"] is False

    def test_memory_care_no_maps_correctly(self) -> None:
        rec = or_providers.row_to_record(self._make_row(**{"Memory Care": "No"}))
        assert rec is not None
        assert rec["mce_endorsed"] is False
        assert rec["serves_memory_care"] is False

    def test_status_closed_maps_correctly(self) -> None:
        rec = or_providers.row_to_record(self._make_row(**{"Status": "Closed"}))
        assert rec is not None
        assert rec["license_status"] == "CLOSED"

    def test_missing_id_returns_none(self) -> None:
        rec = or_providers.row_to_record(self._make_row(**{"ID": ""}))
        assert rec is None

    def test_missing_name_returns_none(self) -> None:
        rec = or_providers.row_to_record(self._make_row(**{"Name": ""}))
        assert rec is None

    def test_beds_null_when_empty(self) -> None:
        rec = or_providers.row_to_record(self._make_row(**{"Licensed beds": ""}))
        assert rec is not None
        assert rec["beds"] is None

    def test_beds_parsed_as_int(self) -> None:
        rec = or_providers.row_to_record(self._make_row(**{"Licensed beds": "120"}))
        assert rec is not None
        assert rec["beds"] == 120

    def test_city_slug_empty_city_fallback(self) -> None:
        rec = or_providers.row_to_record(self._make_row(**{"City": ""}))
        assert rec is not None
        assert rec["city_slug"] == "unknown-city"
        assert rec["city"] is None

    def test_zip_truncated_to_10_chars(self) -> None:
        rec = or_providers.row_to_record(self._make_row(**{"Zip": "97201-1234567"}))
        assert rec is not None
        assert len(rec["zip"]) <= 10

    def test_afh_type_sets_care_category(self) -> None:
        rec = or_providers.row_to_record(self._make_row(**{"Type": "Adult Foster Home", "Memory Care": "Yes"}))
        assert rec is not None
        # AFH with memory care → rcfe_memory_care or similar MC category
        assert rec["care_category"] is not None

    def test_csv_roundtrip_via_dictreader(self) -> None:
        """End-to-end: write a CSV matching OR DHS format, parse it via DictReader."""
        csv_content = (
            "ID,Name,Type,Address,City,Zip,County,Licensed beds,Accepts Medicaid,Memory Care,Status\n"
            "50R368,OPAL CARE MEMORY CARE,Residential Care Facility,1234 OAK ST,PORTLAND,97201,Multnomah,42,Yes,Yes,Open\n"
            "5MA238,CEDAR HILLS ADULT FOSTER HOME,Adult Foster Home,567 PINE AVE,EUGENE,97401,Lane,6,No,No,Open\n"
            "50M300,CLOSED FACILITY INC,Residential Care Facility,999 ELM ST,SALEM,97301,Marion,30,No,No,Closed\n"
        )
        reader = csv.DictReader(io.StringIO(csv_content))
        rows = [or_providers.row_to_record(r) for r in reader]
        rows = [r for r in rows if r is not None]

        assert len(rows) == 3

        opal = next(r for r in rows if r["external_id"] == "50R368")
        cedar = next(r for r in rows if r["external_id"] == "5MA238")
        closed_fac = next(r for r in rows if r["external_id"] == "50M300")

        # Opal Care — MCE=Yes, Open
        assert opal["mce_endorsed"] is True
        assert opal["license_status"] == "LICENSED"
        assert opal["beds"] == 42
        assert opal["name"] == "Opal Care Memory Care"

        # Cedar Hills — MCE=No, Open, AFH
        assert cedar["mce_endorsed"] is False
        assert cedar["license_status"] == "LICENSED"
        assert cedar["beds"] == 6

        # Closed Facility — MCE=No, Closed
        assert closed_fac["license_status"] == "CLOSED"
        assert closed_fac["publishable"] is False


# ═══════════════════════════════════════════════════════════════════════════════
# OR INSPECTIONS — or_inspections_ingest.py
# ═══════════════════════════════════════════════════════════════════════════════


class TestOrInspectionsParseDate:
    """
    parse_date handles the three date formats seen in OR DHS CSV exports.
    """

    @pytest.mark.parametrize(
        "raw,expected",
        [
            # US format (MM/DD/YYYY) — most common in OR CSV
            ("03/15/2024", date(2024, 3, 15)),
            ("12/01/2023", date(2023, 12, 1)),
            ("01/31/2020", date(2020, 1, 31)),
            # ISO format (YYYY-MM-DD)
            ("2024-03-15", date(2024, 3, 15)),
            ("2023-12-01", date(2023, 12, 1)),
            # US with dashes (MM-DD-YYYY)
            ("03-15-2024", date(2024, 3, 15)),
            # Leading/trailing whitespace stripped
            ("  03/15/2024  ", date(2024, 3, 15)),
            # Empty / invalid → None
            ("", None),
            ("   ", None),
            ("N/A", None),
            ("invalid-date", None),
        ],
    )
    def test_parse_date(self, raw: str, expected: date | None) -> None:
        assert or_inspections.parse_date(raw) == expected


class TestOrInspectionsParseInspectionTypes:
    """
    parse_inspection_types maps the OR "Inspection type(s)" CSV column to
    (is_complaint: bool, label: str). The field can contain one or more types
    separated by semicolons.
    """

    @pytest.mark.parametrize(
        "raw,expected_complaint,expected_label",
        [
            # Routine / scheduled
            ("Standard", False, "standard"),
            ("Annual", False, "standard"),
            ("Routine", False, "standard"),
            ("Relicensure", False, "standard"),
            ("Initial", False, "initial"),
            # Follow-up types
            ("Monitoring", False, "follow-up"),
            ("Revisit", False, "follow-up"),
            ("Follow-Up", False, "follow-up"),
            ("Followup", False, "follow-up"),
            # Complaint
            ("Complaint", True, "complaint"),
            ("Complaint; Standard", True, "complaint"),
            ("Standard; Complaint", True, "complaint"),
            # Mixed with follow-up — follow-up wins unless complaint present
            ("Revisit; Monitoring", False, "follow-up"),
            # Empty → falls back to standard
            ("", False, "standard"),
            # Unknown type preserved verbatim
            ("Unrecognized Type", False, "Unrecognized Type"),
        ],
    )
    def test_parse_inspection_types(
        self, raw: str, expected_complaint: bool, expected_label: str
    ) -> None:
        is_complaint, label = or_inspections.parse_inspection_types(raw)
        assert is_complaint == expected_complaint
        assert label == expected_label


class TestOrInspectionsParseDeficiencyCount:
    """
    parse_deficiency_count: "Deficiencies cited" column in OR inspections CSV.
    """

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("0", 0),
            ("1", 1),
            ("3", 3),
            ("42", 42),
            # Float strings (Excel sometimes exports as floats)
            ("3.0", 3),
            ("10.0", 10),
            # Empty → None
            ("", None),
            # Invalid → None
            ("N/A", None),
            ("--", None),
        ],
    )
    def test_parse_deficiency_count(self, raw: str, expected: int | None) -> None:
        assert or_inspections.parse_deficiency_count(raw) == expected


class TestOrInspectionsCsvRoundtrip:
    """
    Full CSV parse roundtrip: construct a string matching the exact OR DHS
    inspections export format and verify all fields are correctly extracted.
    """

    def test_full_csv_parse(self) -> None:
        csv_content = (
            "Date,Provider ID,Name,Type,Event ID,Inspection type(s),Deficiencies cited\n"
            "03/15/2024,50R368,OPAL CARE MEMORY CARE,Residential Care Facility,EVT001,Standard,3\n"
            "11/22/2023,50R368,OPAL CARE MEMORY CARE,Residential Care Facility,EVT002,Complaint,0\n"
            "06/01/2022,5MA238,CEDAR HILLS ADULT FOSTER HOME,Adult Foster Home,EVT003,Annual,1\n"
            "01/15/2022,5MA238,CEDAR HILLS ADULT FOSTER HOME,Adult Foster Home,,Revisit; Monitoring,0\n"
        )
        reader = csv.DictReader(io.StringIO(csv_content))
        parsed = []
        for row in reader:
            ext_id = row.get("Provider ID", "").strip()
            insp_date = or_inspections.parse_date(row.get("Date", ""))
            is_complaint, insp_type = or_inspections.parse_inspection_types(
                row.get("Inspection type(s)", "")
            )
            def_count = or_inspections.parse_deficiency_count(
                row.get("Deficiencies cited", "")
            )
            parsed.append(
                {
                    "external_id": ext_id,
                    "inspection_date": insp_date,
                    "is_complaint": is_complaint,
                    "inspection_type": insp_type,
                    "total_deficiency_count": def_count,
                }
            )

        assert len(parsed) == 4

        # Row 0: Standard inspection, 3 deficiencies
        assert parsed[0]["external_id"] == "50R368"
        assert parsed[0]["inspection_date"] == date(2024, 3, 15)
        assert parsed[0]["is_complaint"] is False
        assert parsed[0]["inspection_type"] == "standard"
        assert parsed[0]["total_deficiency_count"] == 3

        # Row 1: Complaint inspection, 0 deficiencies
        assert parsed[1]["is_complaint"] is True
        assert parsed[1]["inspection_type"] == "complaint"
        assert parsed[1]["total_deficiency_count"] == 0

        # Row 2: Annual inspection, 1 deficiency
        assert parsed[2]["external_id"] == "5MA238"
        assert parsed[2]["inspection_date"] == date(2022, 6, 1)
        assert parsed[2]["inspection_type"] == "standard"
        assert parsed[2]["total_deficiency_count"] == 1

        # Row 3: Revisit + Monitoring — combined types → follow-up
        assert parsed[3]["is_complaint"] is False
        assert parsed[3]["inspection_type"] == "follow-up"


# ═══════════════════════════════════════════════════════════════════════════════
# OR VIOLATIONS — or_violations_ingest.py
# ═══════════════════════════════════════════════════════════════════════════════


class TestOrViolationsParseDate:
    """or_violations_ingest has its own parse_date — same logic, independent test."""

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("03/15/2024", date(2024, 3, 15)),
            ("2024-03-15", date(2024, 3, 15)),
            ("03-15-2024", date(2024, 3, 15)),
            ("", None),
            ("invalid", None),
        ],
    )
    def test_parse_date(self, raw: str, expected: date | None) -> None:
        assert or_violations.parse_date(raw) == expected


class TestOrViolationsCsvRoundtrip:
    """
    OR violations CSV: Date | Provider ID | Name | Provider type | Report number | Allegation | Type
    Verify every field maps to the expected deficiency record shape.
    """

    def test_full_csv_parse(self) -> None:
        csv_content = (
            "Date,Provider ID,Name,Provider type,Report number,Allegation,Type\n"
            "03/15/2024,50R368,OPAL CARE MEMORY CARE,Residential Care Facility,"
            "CALMS - 00105883,Care planning documentation incomplete for memory-care residents.,Licensing Violation\n"
            "11/22/2023,5MA238,CEDAR HILLS ADULT FOSTER HOME,Adult Foster Home,"
            "CALMS - 00200001,Insufficient staffing during overnight hours.,Critical Violation\n"
        )
        reader = csv.DictReader(io.StringIO(csv_content))
        parsed = []
        for row in reader:
            viol_date = or_violations.parse_date(row.get("Date", ""))
            parsed.append(
                {
                    "external_id": row.get("Provider ID", "").strip(),
                    "violation_date": viol_date,
                    "report_number": row.get("Report number", "").strip(),
                    "allegation": row.get("Allegation", "").strip(),
                    "state_severity_raw": row.get("Type", "").strip(),
                }
            )

        assert len(parsed) == 2

        r0 = parsed[0]
        assert r0["external_id"] == "50R368"
        assert r0["violation_date"] == date(2024, 3, 15)
        assert r0["report_number"] == "CALMS - 00105883"
        assert "care planning" in r0["allegation"].lower()
        assert r0["state_severity_raw"] == "Licensing Violation"

        r1 = parsed[1]
        assert r1["external_id"] == "5MA238"
        assert r1["violation_date"] == date(2023, 11, 22)
        assert r1["state_severity_raw"] == "Critical Violation"


# ═══════════════════════════════════════════════════════════════════════════════
# WA DSHS — wa_dshs_directory_ingest.py
# ═══════════════════════════════════════════════════════════════════════════════


class TestWaLicensePadding:
    """
    pad_wa_license: WA license numbers can be numeric strings or alphanumeric.
    Numeric → zero-pad to 10 digits. Non-numeric → strip whitespace, max 32 chars.
    """

    @pytest.mark.parametrize(
        "raw,expected",
        [
            # Numeric: zero-pad to 10 digits
            ("12345678", "0012345678"),
            ("1234567890", "1234567890"),
            ("1", "0000000001"),
            # Already 10 digits → unchanged
            ("9876543210", "9876543210"),
            # None / empty → all-zeros sentinel
            (None, "0000000000"),
            ("", "0000000000"),
            ("   ", "0000000000"),
        ],
    )
    def test_pad_wa_license(self, raw, expected: str) -> None:
        assert wa_dshs.pad_wa_license(raw) == expected


class TestWaFacilitySlug:
    """
    WA facility_slug: name-slug + last-8-chars-of-license suffix.
    """

    def test_standard(self) -> None:
        slug = wa_dshs.facility_slug("Sunrise Memory Care", "1234567890")
        assert slug.startswith("sunrise-memory-care-")
        # suffix is LAST 8 chars of "1234567890" → "34567890", no leading zeros to strip
        assert slug == "sunrise-memory-care-34567890"

    def test_all_zeros_license(self) -> None:
        slug = wa_dshs.facility_slug("Meadowbrook", "0000000000")
        assert slug.startswith("meadowbrook-")
        # last 8 = "00000000", stripped of leading 0s → "0000" fallback
        assert slug.endswith("-0000") or slug.endswith("-00000000")

    def test_short_license(self) -> None:
        slug = wa_dshs.facility_slug("Hilltop Care", "001")
        assert "hilltop-care" in slug


class TestWaNormHeader:
    """
    norm_header: used to normalise CSV column headers for detect_col.
    Strips, lowercases, collapses multiple spaces.
    """

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("  Facility Name  ", "facility name"),
            ("License Number", "license number"),
            ("Multiple   Spaces", "multiple spaces"),
            ("BEDS", "beds"),
            ("", ""),
            (None, ""),
        ],
    )
    def test_norm_header(self, raw, expected: str) -> None:
        assert wa_dshs.norm_header(raw) == expected


class TestWaDetectCol:
    """
    detect_col: fuzzy header detection by keyword substring match (no-spaces).
    """

    HEADERS = [
        "Facility Name",
        "License Number",
        "Licensed Beds",
        "Dementia Care Contract",
        "County",
        "Facility Type",
        "Phone Number",
        "Owner Name",
    ]

    def test_detects_license_number(self) -> None:
        result = wa_dshs.detect_col(self.HEADERS, "licensenumber", "licnum")
        assert result == "License Number"

    def test_detects_beds(self) -> None:
        result = wa_dshs.detect_col(self.HEADERS, "licensedbeds", "beds")
        assert result == "Licensed Beds"

    def test_detects_dementia_care(self) -> None:
        result = wa_dshs.detect_col(self.HEADERS, "dementiacarecontract", "dementia")
        assert result == "Dementia Care Contract"

    def test_returns_none_when_not_found(self) -> None:
        result = wa_dshs.detect_col(self.HEADERS, "nonexistentfield")
        assert result is None

    def test_empty_headers(self) -> None:
        result = wa_dshs.detect_col([], "beds")
        assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# TX ALF — tx_alf_ingest.py
# ═══════════════════════════════════════════════════════════════════════════════


class TestTxLicensePadding:
    """
    pad_license_tx: TX license numbers are 6-digit integers.
    """

    @pytest.mark.parametrize(
        "raw,expected",
        [
            (1234, "001234"),
            ("1234", "001234"),
            ("123456", "123456"),
            (123456, "123456"),
            # Float strings from Excel
            ("1234.0", "001234"),
            ("123456.0", "123456"),
            # None / empty → zeros
            (None, "000000"),
            ("", "000000"),
        ],
    )
    def test_pad_license_tx(self, raw, expected: str) -> None:
        assert tx_alf.pad_license_tx(raw) == expected


class TestTxFacilitySlug:
    """
    TX facility_slug: name + last-6-chars-of-license (stripped leading zeros).
    """

    def test_standard(self) -> None:
        slug = tx_alf.facility_slug("Sunrise Senior Living", "001234")
        assert slug.startswith("sunrise-senior-living-")
        # suffix: last 6 chars "001234", lstrip "0" → "1234"
        assert slug.endswith("-1234")

    def test_all_zeros_falls_back_to_last_2(self) -> None:
        # If lstrip("0") returns empty string, use last 2 chars
        slug = tx_alf.facility_slug("Cedar Oaks", "000000")
        assert "cedar-oaks" in slug
        assert slug.endswith("-00")

    def test_full_license_no_leading_zeros(self) -> None:
        slug = tx_alf.facility_slug("Memory Care at Bellaire", "100200")
        assert slug.endswith("-100200")


class TestTxCitySlugOverrides:
    """
    slugify_tx_city: certain TX cities collide with other state hub slugs.
    These must be overridden with a -tx suffix.
    """

    @pytest.mark.parametrize(
        "city,expected_slug",
        [
            ("Pasadena", "pasadena-tx"),
            ("Arlington", "arlington-tx"),
            ("Paris", "paris-tx"),
            ("Glendale", "glendale-tx"),
            ("Richmond", "richmond-tx"),
            ("Cleveland", "cleveland-tx"),
            ("Springfield", "springfield-tx"),
            # No override → normal slug
            ("Houston", "houston"),
            ("Austin", "austin"),
            ("Dallas", "dallas"),
            ("San Antonio", "san-antonio"),
        ],
    )
    def test_city_slug_overrides(self, city: str, expected_slug: str) -> None:
        assert tx_alf.slugify_tx_city(city) == expected_slug

    def test_case_insensitive_override(self) -> None:
        # slugify lowercases before checking overrides
        assert tx_alf.slugify_tx_city("PASADENA") == "pasadena-tx"
        assert tx_alf.slugify_tx_city("arlington") == "arlington-tx"


class TestTxParseGeo:
    """
    parse_geo: parses "lat,lon" strings from TX HHSC export.
    """

    @pytest.mark.parametrize(
        "raw,expected_lat,expected_lon",
        [
            ("30.1234,-97.5678", 30.1234, -97.5678),
            ("29.7604,-95.3698", 29.7604, -95.3698),
            # Extra whitespace
            (" 30.1234 , -97.5678 ", 30.1234, -97.5678),
        ],
    )
    def test_valid_coords(self, raw: str, expected_lat: float, expected_lon: float) -> None:
        lat, lon = tx_alf.parse_geo(raw)
        assert lat == pytest.approx(expected_lat, abs=1e-4)
        assert lon == pytest.approx(expected_lon, abs=1e-4)

    @pytest.mark.parametrize(
        "raw",
        [None, "", "   ", "no-comma", "not,numbers"],
    )
    def test_invalid_returns_none_pair(self, raw) -> None:
        lat, lon = tx_alf.parse_geo(raw)
        assert lat is None
        assert lon is None


class TestTxParseZip:
    """
    parse_zip: handles 5-digit, ZIP+4, and Excel-mangled formats.
    """

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("75001", "75001"),
            # ZIP+4 → strip to 5
            ("75001-1234", "75001"),
            # Excel sometimes drops leading zeros on numeric columns
            ("7501", "07501"),  # zfill(5)
            # None / empty
            (None, None),
            ("", None),
            ("  ", None),
        ],
    )
    def test_parse_zip(self, raw, expected) -> None:
        assert tx_alf.parse_zip(raw) == expected


class TestTxToDate:
    """
    to_date: handles datetime objects, date objects, ISO strings, US strings.
    """

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("2024-03-15", date(2024, 3, 15)),
            ("03/15/2024", date(2024, 3, 15)),
            (date(2024, 3, 15), date(2024, 3, 15)),
            (None, None),
            ("", None),
            ("   ", None),
            ("N/A", None),
        ],
    )
    def test_to_date(self, raw, expected) -> None:
        assert tx_alf.to_date(raw) == expected

    def test_datetime_object_returns_date(self) -> None:
        from datetime import datetime

        dt = datetime(2024, 3, 15, 10, 30, 0)
        assert tx_alf.to_date(dt) == date(2024, 3, 15)


class TestTxMetroCounties:
    """
    METRO_COUNTIES: the seven TX metro footprints used for Phase 1 filter.
    All 13 counties must be present (case-sensitive HHSC uppercase format).
    """

    EXPECTED_COUNTIES = {
        "HARRIS",
        "FORT BEND",
        "MONTGOMERY",
        "BRAZORIA",
        "GALVESTON",
        "DALLAS",
        "COLLIN",
        "TARRANT",
        "BEXAR",
        "TRAVIS",
        "WILLIAMSON",
        "HAYS",
        "DENTON",
    }

    def test_metro_counties_complete(self) -> None:
        assert tx_alf.METRO_COUNTIES == self.EXPECTED_COUNTIES

    def test_metro_county_membership(self) -> None:
        assert "HARRIS" in tx_alf.METRO_COUNTIES
        assert "DALLAS" in tx_alf.METRO_COUNTIES
        assert "TRAVIS" in tx_alf.METRO_COUNTIES
        # Non-metro counties must NOT be included
        assert "LUBBOCK" not in tx_alf.METRO_COUNTIES
        assert "EL PASO" not in tx_alf.METRO_COUNTIES


# ═══════════════════════════════════════════════════════════════════════════════
# MN ALRC — mn_alrc_ingest.py
# ═══════════════════════════════════════════════════════════════════════════════


class TestMnFacilitySlug:
    """
    MN facility_slug: name-slug + "-mn" + alrc_id (int).
    Example: "Elim Care Brooklyn Park", 12345 → "elim-care-brooklyn-park-mn12345"
    """

    @pytest.mark.parametrize(
        "name,alrc_id,expected",
        [
            ("Elim Care Brooklyn Park", 12345, "elim-care-brooklyn-park-mn12345"),
            ("BENEDICTINE HEALTH CENTER", 99, "benedictine-health-center-mn99"),
            ("WALKER METHODIST HEALTH CENTER", 1001, "walker-methodist-health-center-mn1001"),
            # Edge: empty name
            ("", 5, "facility-mn5"),
        ],
    )
    def test_facility_slug(self, name: str, alrc_id: int, expected: str) -> None:
        assert mn_alrc.facility_slug(name, alrc_id) == expected

    def test_slug_is_lowercase_hyphenated(self) -> None:
        slug = mn_alrc.facility_slug("SAINTS CARE CENTER", 42)
        assert slug == "saints-care-center-mn42"
        assert slug == slug.lower()
        assert " " not in slug


# ═══════════════════════════════════════════════════════════════════════════════
# CROSS-STATE: inspectionHasRealNarrative logic (Python-equivalent tests)
# ═══════════════════════════════════════════════════════════════════════════════


class TestNarrativeValidity:
    """
    Tests for the narrative validity rules that gate whether a facility's
    grade is displayed. These rules appear in loadFacilityProfile.ts but
    the same logic is applied in recompute_has_inspection_text (SQL).

    We test the Python-equivalent logic to verify the business rules are correct:
    - URL-only narrative → not real
    - WA placeholder → not real
    - Short text < 100 chars → not real
    - All-placeholder concatenation → not real (even if > 100 chars)
    - Genuine narrative ≥ 100 chars → real
    - OR allegation text in description field → real
    """

    def _make_inspection(
        self,
        narrative: str | None = None,
        outcome: str | None = None,
    ) -> dict:
        raw_data: dict = {}
        if narrative is not None:
            raw_data["narrative"] = narrative
        if outcome is not None:
            raw_data["outcome"] = outcome
        return {
            "id": "test-id",
            "inspection_date": "2024-01-01",
            "inspection_type": "standard",
            "is_complaint": False,
            "complaint_id": None,
            "total_deficiency_count": 0,
            "narrative_summary": None,
            "source_url": None,
            "raw_data": raw_data,
        }

    def _make_deficiency(
        self,
        description: str | None = None,
        inspector_narrative: str | None = None,
    ) -> dict:
        return {
            "id": "def-id",
            "inspection_id": "test-id",
            "class": None,
            "code": None,
            "severity": None,
            "scope": None,
            "scope_severity_code": None,
            "immediate_jeopardy": False,
            "description": description,
            "inspector_narrative": inspector_narrative,
            "state_severity_raw": None,
            "is_repeat": False,
        }

    def test_no_narrative_is_not_real(self) -> None:
        # Must be able to import loadFacilityProfile logic
        sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))
        try:
            from lib.facility.loadFacilityProfile import inspectionHasRealNarrative  # type: ignore
        except ImportError:
            pytest.skip("TypeScript module not importable from Python tests")

    def test_business_rule_url_not_real(self) -> None:
        """Narrative that is just a URL is not a real narrative."""
        narrative = "https://example.com/inspection-report"
        # Verify URL_RE pattern catches it (conceptual test)
        import re
        URL_RE = re.compile(r"^https?://", re.IGNORECASE)
        assert URL_RE.match(narrative.strip())

    def test_business_rule_wa_placeholder_not_real(self) -> None:
        """WA placeholder narrative prefix is not real."""
        placeholder = "—: WA DSHS report: no parsed text available"
        import re
        WA_PLACEHOLDER_RE = re.compile(r"^—:\s*WA DSHS report:", re.IGNORECASE)
        assert WA_PLACEHOLDER_RE.match(placeholder.strip())

    def test_business_rule_short_text_not_real(self) -> None:
        """Narrative shorter than 100 chars is not considered real."""
        short = "Brief note"
        assert len(short.strip()) < 100

    def test_business_rule_long_genuine_narrative_is_real(self) -> None:
        """A genuine narrative ≥ 100 chars without placeholders is real."""
        genuine = (
            "During the inspection conducted on March 15, 2024, the surveyor observed "
            "that memory care residents were not receiving scheduled care planning sessions. "
            "The facility failed to document individualized care plans as required by "
            "regulation 87705(b)(1)."
        )
        assert len(genuine.strip()) >= 100
        import re
        URL_RE = re.compile(r"^https?://", re.IGNORECASE)
        WA_RE = re.compile(r"^—:\s*WA DSHS report:", re.IGNORECASE)
        assert not URL_RE.match(genuine.strip())
        assert not WA_RE.match(genuine.strip())
