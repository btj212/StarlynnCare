#!/usr/bin/env python3
"""Tests for the Colorado workbook assembly and directory rules.

Each test names the family-facing mistake it prevents: a made-up date, a
dropped citation, a public URL that moves, or a memory-care claim the source
did not make.
"""

from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scrapers.cms_nh_directory_ingest import main as cms_directory_main
from scrapers.co_cdphe_directory_ingest import UPSERT_SQL
from scrapers.co_cms_parse import (
    classify_cms_deficiency,
    classify_cms_provider,
    cms_external_id,
    cms_tag_code,
)
from scrapers.co_directory_parse import classify_directory_feature, facility_slug, parse_address
from scrapers.co_hfq_parse import (
    HFQ_AS_OF,
    REASON_CONFLICTING_DATES,
    REASON_FUTURE,
    REASON_UNDATED,
    REASON_UNMATCHED,
    assemble,
    canonical_id,
    join_parts,
    map_severity,
    normalize_citation_code,
    survey_from_cells,
)


def complaint(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "source_key": "c1",
        "facility_id": "230106",
        "event_id": "753611",
        "facility_name": "DEVONSHIRE CARE CENTER",
        "type_code": "SA1",
        "start_date": date(2023, 5, 4),
        "exit_date": date(2023, 5, 4),
        "findings": "Substantiated",
        "allegation": "Quality of Care",
        "tags": "0000, 0610",
        "complaint_ids": "CO00027076",
        "raw": {"Event ID": "753611"},
    }
    row.update(overrides)
    return row


def survey(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "source_key": "s1",
        "facility_id": "230106",
        "event_id": "753611",
        "regset_id": "OONO",
        "facility_name": "DEVONSHIRE CARE CENTER",
        "type_code": "SA1",
        "citation_code": "0610",
        "citation_title": "Personnel",
        "regulation_text": "The residence shall check staff.",
        "citation_text": "The inspector saw four staff without the check.",
        "scope": 2,
        "severity_letter": "B",
        "plan_of_correction": "The residence completed the checks.",
        "inspection_date": date(2023, 5, 4),
        "inspection_type": "Licensure (Re-licensure)",
        "raw": {"Citation Code": 610},
    }
    row.update(overrides)
    return row


def directory(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "OBJECTID": 1,
        "Facility_ID": "230106",
        "Facility_Name": "DEVONSHIRE CARE CENTER",
        "Facility_Type_Code": "SA1",
        "Facility_Type_Detail": "ALR ONLY",
        "Facility_Type_Abbreviation": "ALRONLY",
        "Licensed_Beds_Total": 24,
        "Telephone": "(970) 522-4888",
        "County": "LOGAN",
        "Address_Full": "1330 N SIDNEY AVE, STERLING, CO 80751",
        "Latitude": 40.64196,
        "Longitude": -103.202438,
        "CDPHE_HFEMS_Licensed": "Licensed",
        "Operating_Status": "Active",
        "Date_Data_Updated": 1790665200000,
    }
    row.update(overrides)
    return row


class ColoradoIdAndTextTests(unittest.TestCase):
    def test_numeric_and_alphanumeric_ids_stay_distinct(self) -> None:
        """Excel turns some ids into numbers. Alphanumeric event ids keep their zeros."""
        self.assertEqual(canonical_id(230464.0), "230464")
        self.assertEqual(canonical_id("23P166"), "23P166")
        self.assertEqual(canonical_id("003G11"), "003G11")
        self.assertEqual(canonical_id("007511"), "7511")
        self.assertEqual(canonical_id("NULL"), "")

    def test_citation_codes_are_four_digits(self) -> None:
        """A tag stored as 610 has to match the complaint sheet's 0610."""
        self.assertEqual(normalize_citation_code(610), "0610")
        self.assertEqual(normalize_citation_code(0), "0000")
        self.assertEqual(normalize_citation_code("9999"), "9999")

    def test_overflow_columns_are_joined_without_a_new_separator(self) -> None:
        """CDPHE splits a sentence at a character limit. A space or newline would change the finding."""
        cells = {
            "Facility ID": "230106",
            "EVENTID": "753611",
            "REGSETID": "OONO",
            "Citation Code": 610,
            "Citation Title": "Personnel",
            "Regulation Text": "The rule ",
            "Regulation Text_Overflow1": "continues here.",
            "Citation Text": "Staff ",
            "Citation Text_Overflow1": "had",
            "Citation Text_Overflow2": " no check.",
            "Citation Text_Overflow3": None,
            "Scope": 2,
            "Ss": "B",
            "Facility Plan of Correction": "Corrected",
            "Facility Plan of Correction_Overflow1": " the file.",
            "Inspection Date": date(2023, 5, 4),
            "Inspection Type": "Licensure (Re-licensure)",
        }
        parsed = survey_from_cells("9", cells)
        self.assertEqual(parsed["regulation_text"], "The rule continues here.")
        self.assertEqual(parsed["citation_text"], "Staff had no check.")
        self.assertEqual(parsed["plan_of_correction"], "Corrected the file.")
        self.assertEqual(join_parts("hello", None, "NULL", "world"), "helloworld")


class ColoradoSeverityTests(unittest.TestCase):
    def test_letters_follow_chapter_7_and_a_blank_stays_blank(self) -> None:
        """A missing Ss letter is not level 2. E is the only immediate-jeopardy letter."""
        self.assertEqual(map_severity("A"), ("A", 1, False))
        self.assertEqual(map_severity("B"), ("B", 2, False))
        self.assertEqual(map_severity("C"), ("C", 3, False))
        self.assertEqual(map_severity("D"), ("D", 3, False))
        self.assertEqual(map_severity("E"), ("E", 4, True))
        self.assertEqual(map_severity("NULL"), (None, None, False))
        self.assertEqual(map_severity(None), (None, None, False))

    def test_unrated_citation_is_kept_with_no_severity(self) -> None:
        """Families should see the finding even when CDPHE left the letter off."""
        assembly = assemble([], [survey(severity_letter=None, source_key="s1")])
        deficiency = assembly.inspections[0].deficiencies[0]
        self.assertIsNone(deficiency.severity)
        self.assertFalse(deficiency.immediate_jeopardy)
        self.assertIsNone(deficiency.scope)

    def test_scope_follows_the_letter_not_the_workbook_number(self) -> None:
        """The Scope number is not the federal scale. Level C is isolated actual harm, not widespread."""
        assembly = assemble(
            [],
            [
                survey(source_key="c", event_id="C1", severity_letter="C", scope=3),
                survey(source_key="d", event_id="D1", severity_letter="D", scope=1),
                survey(source_key="e", event_id="E1", severity_letter="E", scope=2),
            ],
        )
        by_letter = {
            item.severity_letter: item
            for inspection in assembly.inspections
            for item in inspection.deficiencies
        }
        self.assertEqual(by_letter["C"].scope, "isolated")
        self.assertEqual(by_letter["C"].severity, 3)
        self.assertEqual(by_letter["D"].scope, "pattern")
        self.assertEqual(by_letter["D"].severity, 3)
        self.assertIsNone(by_letter["E"].scope)
        self.assertTrue(by_letter["E"].immediate_jeopardy)


class ColoradoEventAssemblyTests(unittest.TestCase):
    def test_complaint_date_fills_only_the_same_undated_event(self) -> None:
        """The survey export left the date blank. Only the matching complaint event can date it."""
        assembly = assemble(
            [complaint(start_date=date(2022, 3, 15))],
            [survey(inspection_date=None, source_key="s1")],
        )
        inspection = assembly.inspections[0]
        self.assertEqual(inspection.inspection_date, date(2022, 3, 15))
        self.assertEqual(inspection.date_source, "complaint")
        self.assertTrue(inspection.is_complaint)

        other_event = assemble(
            [complaint(event_id="999", start_date=date(2022, 3, 15))],
            [survey(inspection_date=None, event_id="753611")],
        )
        self.assertEqual(
            [inspection.event_id for inspection in other_event.inspections],
            ["999"],
        )
        self.assertTrue(any(row.reason == REASON_UNDATED for row in other_event.quarantines()))

    def test_future_complaint_date_is_not_used_or_attached(self) -> None:
        """Dates after the workbook snapshot stay in quarantine, even when the survey date is real."""
        future = date(2036, 5, 15)
        assembly = assemble(
            [complaint(source_key="future", start_date=future, findings="Substantiated")],
            [survey(inspection_date=date(2023, 5, 4))],
            as_of=HFQ_AS_OF,
        )
        inspection = assembly.inspections[0]
        self.assertEqual(inspection.inspection_date, date(2023, 5, 4))
        self.assertFalse(inspection.is_complaint)
        self.assertIsNone(inspection.findings)
        future_rows = [row for row in assembly.quarantines() if row.reason == REASON_FUTURE]
        self.assertEqual(len(future_rows), 1)

        undated = assemble(
            [complaint(start_date=future)],
            [survey(inspection_date=None)],
            as_of=HFQ_AS_OF,
        )
        self.assertEqual(undated.inspections, [])
        reasons = {row.reason for row in undated.quarantines()}
        self.assertIn(REASON_FUTURE, reasons)
        self.assertIn(REASON_UNDATED, reasons)

    def test_sentinel_comments_are_not_counted_as_deficiencies(self) -> None:
        """0000 and 9999 are inspector comments. Counting them would inflate the citation total."""
        assembly = assemble(
            [],
            [
                survey(source_key="comment", citation_code=0, citation_text="Initial comment.", severity_letter=None),
                survey(source_key="real", citation_code=610),
                survey(source_key="tail", citation_code="9999", citation_text="End comment.", severity_letter=None),
            ],
        )
        inspection = assembly.inspections[0]
        self.assertEqual(len(inspection.deficiencies), 1)
        self.assertEqual(inspection.deficiencies[0].citation_code, "0610")
        self.assertIn("Initial comment.", inspection.inspection_comments)
        self.assertIn("End comment.", inspection.inspection_comments)

    def test_duplicate_citation_codes_are_both_kept(self) -> None:
        """Two findings can cite the same rule during one visit."""
        assembly = assemble(
            [],
            [
                survey(source_key="a", citation_text="First finding."),
                survey(source_key="b", citation_text="Second finding."),
            ],
        )
        texts = [item.inspector_narrative for item in assembly.inspections[0].deficiencies]
        self.assertEqual(texts, ["First finding.", "Second finding."])

    def test_conflicting_survey_dates_are_quarantined(self) -> None:
        """The ingest must not pick the more convenient of two dates."""
        assembly = assemble(
            [],
            [
                survey(source_key="a", inspection_date=date(2023, 5, 4)),
                survey(source_key="b", inspection_date=date(2023, 6, 1)),
            ],
        )
        self.assertEqual(assembly.inspections, [])
        self.assertTrue(all(row.reason == REASON_CONFLICTING_DATES for row in assembly.quarantines()))

    def test_unknown_facility_is_not_given_a_shell_profile(self) -> None:
        """A closed home in the workbook stays in quarantine instead of becoming a page with no address."""
        assembly = assemble(
            [complaint()],
            [survey()],
            known_facility_ids={"999999"},
        )
        self.assertEqual(assembly.inspections, [])
        self.assertTrue(all(row.reason == REASON_UNMATCHED for row in assembly.quarantines()))

    def test_complaint_with_no_citation_is_still_an_event(self) -> None:
        """An unsubstantiated complaint that produced no citation is still part of the record."""
        assembly = assemble(
            [complaint(findings="Unsubstantiated", tags="0000")],
            [],
            known_facility_ids={"230106"},
        )
        inspection = assembly.inspections[0]
        self.assertTrue(inspection.is_complaint)
        self.assertEqual(inspection.deficiencies, [])
        self.assertEqual(inspection.inspection_type_label, "Complaint")
        self.assertEqual(inspection.event_key, "230106|753611|complaint")

    def test_same_file_assembles_the_same_events_twice(self) -> None:
        """A second run has to find the same event keys or it will duplicate the visit."""
        complaints = [complaint(), complaint(source_key="future", event_id="FUT", start_date=date(2030, 1, 1))]
        surveys = [survey(), survey(source_key="blank", event_id="NONE", inspection_date=None, citation_code=772)]
        first = assemble(complaints, surveys, known_facility_ids={"230106"})
        second = assemble(complaints, surveys, known_facility_ids={"230106"})
        self.assertEqual(first.inspections, second.inspections)
        self.assertEqual(first.dispositions, second.dispositions)
        self.assertEqual(len(first.dispositions), 4)


class ColoradoDirectoryTests(unittest.TestCase):
    def test_address_city_and_slug_are_stable(self) -> None:
        """The public URL includes the facility id so a refresh cannot merge two homes that share a name."""
        street, city, zip_code = parse_address("123 MAIN ST, UNIT 2, DENVER, CO 80202")
        self.assertEqual((street, city, zip_code), ("123 MAIN ST, UNIT 2", "Denver", "80202"))
        first = classify_directory_feature(directory())
        second = classify_directory_feature(directory())
        assert first.facility is not None and second.facility is not None
        self.assertEqual(first.facility["slug"], second.facility["slug"])
        self.assertEqual(first.facility["slug"], facility_slug("DEVONSHIRE CARE CENTER", "230106"))
        other = classify_directory_feature(directory(Facility_ID="230107", OBJECTID=2))
        assert other.facility is not None
        self.assertNotEqual(first.facility["slug"], other.facility["slug"])

    def test_hcpf_and_pending_are_not_stored_as_licensed(self) -> None:
        """HCPF certification is a Medicaid label. A pending home is not yet licensed."""
        certified = classify_directory_feature(
            directory(CDPHE_HFEMS_Licensed="HCPF Certified", Licensed_Beds_Total=0)
        )
        pending = classify_directory_feature(directory(Operating_Status="Pending"))
        assert certified.facility is not None and pending.facility is not None
        self.assertEqual(certified.facility["license_status"], "CERTIFIED")
        self.assertIsNone(certified.facility["beds"])
        self.assertEqual(pending.facility["license_status"], "PENDING")
        self.assertFalse(certified.facility["publishable"])
        self.assertFalse(certified.facility["serves_memory_care"])

    def test_name_signal_is_not_a_published_memory_care_claim(self) -> None:
        """The name can queue a signal. It does not by itself say the home serves memory care."""
        named = classify_directory_feature(directory(Facility_Name="MEMORY CARE OF DENVER"))
        plain = classify_directory_feature(directory())
        chain = classify_directory_feature(directory(Facility_Name="BROOKDALE STERLING"))
        assert named.facility is not None and plain.facility is not None and chain.facility is not None
        self.assertTrue(named.facility["mc_signal_explicit_name"])
        self.assertFalse(named.facility["serves_memory_care"])
        self.assertFalse(plain.facility["mc_signal_explicit_name"])
        self.assertEqual(plain.facility["mc_review_status"], "auto_published")
        self.assertTrue(chain.facility["mc_signal_chain_name"])
        self.assertEqual(chain.facility["mc_review_status"], "needs_review")
        self.assertFalse(chain.facility["serves_memory_care"])

    def test_directory_refresh_does_not_move_the_public_url(self) -> None:
        """A later ArcGIS pull must not change the name, slug, or city already stored."""
        update_clause = UPSERT_SQL.split("DO UPDATE SET", 1)[1]
        for column in (
            "name",
            "slug",
            "city",
            "city_slug",
            "serves_memory_care",
            "publishable",
            "mc_review_status",
            "mc_signal_explicit_name",
        ):
            self.assertNotRegex(update_clause, rf"\b{column}\s*=")


class ColoradoCmsSeparationTests(unittest.TestCase):
    def test_a_cms_letter_is_not_a_colorado_letter(self) -> None:
        """CMS E means potential harm. Colorado E means immediate jeopardy. They must not share a scale."""
        mapped = classify_cms_deficiency(
            {
                "Deficiency Tag Number": "689",
                "Scope Severity Code": "E",
                "Deficiency Description": "The facility did not complete the assessment.",
            }
        )
        assert mapped is not None
        self.assertEqual(mapped["code"], "F689")
        self.assertIsNone(mapped.get("inspector_narrative"))
        self.assertEqual(mapped["severity"], 2)
        self.assertEqual(mapped["scope"], "pattern")
        self.assertFalse(mapped["immediate_jeopardy"])
        jeopardy = classify_cms_deficiency(
            {"Deficiency Tag Number": "689", "Scope Severity Code": "J", "Deficiency Description": "Immediate risk."}
        )
        assert jeopardy is not None
        self.assertEqual(jeopardy["severity"], 4)
        self.assertTrue(jeopardy["immediate_jeopardy"])
        self.assertEqual(cms_tag_code("F", "0584"), "F584")

    def test_name_and_address_match_does_not_merge_into_an_assisted_living_home(self) -> None:
        """A shared name is a review note. The nursing home keeps its own CCN and is not marked memory care."""
        decision = classify_cms_provider(
            {
                "CMS Certification Number (CCN)": "065001",
                "Provider Name": "DEVONSHIRE CARE CENTER",
                "Provider Address": "1330 N SIDNEY AVE",
                "City/Town": "STERLING",
                "Number of Certified Beds": "40",
            },
            alr_by_address={("devonshire care center", "1330 n sidney ave"): ["230106"]},
        )
        assert decision.facility is not None
        self.assertEqual(decision.candidate_alr_ids, ["230106"])
        self.assertEqual(decision.facility["external_id"], cms_external_id("065001"))
        self.assertNotEqual(decision.facility["external_id"], "230106")
        self.assertEqual(decision.facility["co_care_setting"], "NH")
        self.assertEqual(decision.facility["mc_review_status"], "needs_review")
        self.assertFalse(decision.facility["serves_memory_care"])
        self.assertFalse(decision.facility["publishable"])
        self.assertFalse(decision.facility["mc_signal_explicit_name"])

    def test_nursing_home_name_is_a_signal_not_a_published_claim(self) -> None:
        """Memory in the name is recorded. It does not by itself publish the nursing home."""
        decision = classify_cms_provider(
            {
                "CMS Certification Number (CCN)": "065999",
                "Provider Name": "FOOTHILLS MEMORY CARE",
                "Provider Address": "1 MAIN ST",
                "City/Town": "DENVER",
            }
        )
        assert decision.facility is not None
        self.assertTrue(decision.facility["mc_signal_explicit_name"])
        self.assertFalse(decision.facility["serves_memory_care"])
        self.assertEqual(decision.facility["mc_review_status"], "needs_review")

    def test_shared_cms_script_refuses_colorado(self) -> None:
        """The older CMS loader matches any CCN and would overwrite a Colorado home's city."""
        with self.assertRaises(SystemExit):
            cms_directory_main(["--state", "CO", "--dry-run"])


if __name__ == "__main__":
    unittest.main()
