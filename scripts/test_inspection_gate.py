#!/usr/bin/env python3
"""Inspection-gate parsers for Washington, Illinois, Utah, Colorado, and Pennsylvania.

A live page is indexed only when one inspection has a date, a source URL, and
a citation count. Zero is a real count. A file we could not read is not zero,
and a lookup page is not a survey document.
"""

from __future__ import annotations

import json
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "scrapers" / "fixtures" / "gate"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scrapers.backfill_co_inspection_gate import document_url_for_cdphe_event
from scrapers.backfill_il_inspection_gate import is_document_url
from scrapers.backfill_pa_inspection_gate import citation_count_for_survey, pa_match_key
from scrapers.il_foia_parse import citation_count_from_tags, parse_citations
from scrapers.ut_ccl_inspections_scraper import ccl_facility_url, external_id_to_ccl_id
from scrapers.wa_report_parse import (
    license_in_pdf_url,
    parse_wa_report,
    posted_month_date,
    same_license,
)


def _text(name: str) -> str:
    return (FIXTURES / name).read_text()


class WashingtonReportTests(unittest.TestCase):
    def test_statement_of_deficiencies_counts_cited_rules_and_matches_the_roster_license(self) -> None:
        """Five 'not met' WAC blocks are five citations. The roster stores the same license with leading zeros."""
        report = parse_wa_report(_text("wa_blue_haven_sod.txt"))
        self.assertEqual(report.citation_count, 5)
        self.assertEqual(report.inspection_date, date(2025, 9, 4))
        self.assertTrue(same_license("0000754592", report.license_digits))
        self.assertEqual(
            [code for code, _title in report.citations],
            [
                "WAC 388-76-10350",
                "WAC 388-76-10355",
                "WAC 388-76-10365",
                "WAC 388-76-10198",
                "WAC 388-76-10485",
            ],
        )
        url = (
            "https://www.dshs.wa.gov/dshs/adsaapps/lookup/RCSForms/AF/754592/"
            "inspections/2025/R%20Blue%20Haven.pdf"
        )
        self.assertTrue(same_license("0000754592", license_in_pdf_url(url)))

    def test_consultation_that_was_not_cited_is_zero(self) -> None:
        """Anchor of Hope's letter names a WAC under Consultation and says it was not cited."""
        report = parse_wa_report(_text("wa_anchor_consultation.txt"))
        self.assertEqual(report.citation_count, 0)
        self.assertEqual(report.citations, ())
        self.assertEqual(report.inspection_date, date(2024, 9, 24))
        self.assertTrue(same_license("0000753122", report.license_digits))

    def test_unreadable_scan_is_not_stored_as_zero(self) -> None:
        """Locator boilerplate is the only text. A guessed zero would publish a clean inspection."""
        report = parse_wa_report(_text("wa_unreadable_boilerplate.txt"))
        self.assertIsNone(report.citation_count)
        self.assertIsNone(report.inspection_date)

    def test_a_different_license_in_the_pdf_folder_does_not_match(self) -> None:
        self.assertFalse(same_license("0000754592", "753122"))
        self.assertEqual(posted_month_date("2025-10"), date(2025, 10, 1))


class IllinoisTagTests(unittest.TestCase):
    def test_no_violation_cells_are_zero_and_a_blank_cell_is_unknown(self) -> None:
        """IDPH writes none, No Violations, and NONE. An empty cell does not mean a clean visit."""
        tags = json.loads(_text("il_tags.json"))
        for key in ("none", "no_violations", "none_period", "dash_no_violations"):
            self.assertEqual(citation_count_from_tags(tags[key], "00120001"), 0, key)
        self.assertIsNone(citation_count_from_tags(tags["blank"], "00120001"))

    def test_a_no_violation_line_does_not_erase_the_cited_rules(self) -> None:
        """The old parser dropped the whole cell when any line said no violations."""
        tags = json.loads(_text("il_tags.json"))
        citations = parse_citations(tags["mixed_none_and_rules"], "00120001")
        codes = [item["code"] for item in citations]
        self.assertIn("295.2050", codes)
        self.assertIn("295.4010", codes)
        self.assertIn("295.4060", codes)
        self.assertIn("295.6000", codes)
        self.assertGreaterEqual(citation_count_from_tags(tags["mixed_none_and_rules"], "00120001") or 0, 4)
        self.assertEqual(citation_count_from_tags(tags["one_rule"], "00120001"), 1)

    def test_the_lookup_shell_is_not_a_survey_document(self) -> None:
        shell = "https://llcs.dph.illinois.gov/s/?language=en_US#license=00117480"
        self.assertFalse(is_document_url(shell))
        self.assertFalse(is_document_url(""))
        self.assertTrue(
            is_document_url(
                "https://www.dshs.wa.gov/dshs/adsaapps/lookup/RCSForms/AF/754592/inspections/2025/report.pdf"
            )
        )


class UtahMatchTests(unittest.TestCase):
    def test_arcgis_id_number_is_the_public_facility_page(self) -> None:
        """license_number is empty. F23-106488 is the API idNumber, and 106488 is the CCL id."""
        rows = json.loads(_text("ut_external_ids.json"))
        for row in rows:
            self.assertIsNone(row["license_number"])
            ccl_id = external_id_to_ccl_id(row["external_id"])
            self.assertEqual(ccl_id, row["ccl_id"])
            self.assertEqual(ccl_facility_url(ccl_id or 0), f"https://ccl.utah.gov/facility/{row['ccl_id']}")


class ColoradoEventTests(unittest.TestCase):
    def test_a_records_event_id_is_not_turned_into_a_url(self) -> None:
        """23T231|M5T211|complaint is the workbook key. The tableau search is not that event's address."""
        event = json.loads(_text("co_event.json"))
        self.assertEqual(event["total_deficiency_count"], 0)
        self.assertEqual(event["source_url"], "")
        self.assertIsNone(document_url_for_cdphe_event(event["event_id"]))
        self.assertIsNone(document_url_for_cdphe_event(event["event_key"]))


class PennsylvaniaMatchTests(unittest.TestCase):
    def test_f_tag_rows_are_the_count_and_the_ccn_is_the_match(self) -> None:
        """CMS survey 395045 on 2026-02-26 has three F-tags and no Pennsylvania license number."""
        survey = json.loads(_text("pa_cms_survey.json"))
        self.assertIsNone(survey["license_number"])
        self.assertEqual(pa_match_key(survey["cms_ccn"], survey["license_number"]), ("cms_ccn", "395045"))
        self.assertEqual(citation_count_for_survey(survey["codes"]), 3)


if __name__ == "__main__":
    unittest.main()
