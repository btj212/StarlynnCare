#!/usr/bin/env python3
"""Parser tests for the Illinois and Missouri source files.

Each test names the family-facing mistake it prevents: a same-day visit
disappearing, a visit id being treated as a license, or a complaint label
being shown as immediate jeopardy.
"""

from __future__ import annotations

import sys
import unittest
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scrapers.il_foia_parse import pair_visits, parse_visit_row
from scrapers.il_llcs_directory_scrape import refuse_foia_bootstrap
from scrapers.mo_records_parse import (
    REASON_CONFLICTING_DATES,
    assemble,
    map_severity,
)


def mo_row(event_id: str, tag: str, **overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "FACILITY_ID": "02160D",
        "NAME": "Example Home",
        "EVENT_DATE": date(2021, 8, 18),
        "SURVEY_CATEGORY": "STATE LICENSURE",
        "EVENT_ID": event_id,
        "TAG": tag,
        "DESCRIPTION": "The record was incomplete.",
        "FACILITY_TYPE": "ALF",
    }
    row.update(overrides)
    return row


class MissouriEventTests(unittest.TestCase):
    def test_same_day_events_stay_separate(self) -> None:
        """A second visit on the same day is a different inspection, not a duplicate."""
        result = assemble([
            (2, mo_row("129D11", "000L")),
            (3, mo_row("K93711", "000L")),
        ])
        self.assertEqual(
            [event["event_id"] for event in result["events"]],
            ["129D11", "K93711"],
        )
        self.assertTrue(all(event["deficiencies"] == [] for event in result["events"]))

    def test_same_day_findings_are_not_merged(self) -> None:
        """Citations from the second visit must not be dropped or attached to the first."""
        result = assemble([
            (2, mo_row("36MN11", "A100", DESCRIPTION="First visit finding.")),
            (3, mo_row("H0RD11", "B200", DESCRIPTION="Second visit finding.")),
        ])
        by_event = {event["event_id"]: event["deficiencies"] for event in result["events"]}
        self.assertEqual([item["tag"] for item in by_event["36MN11"]], ["A100"])
        self.assertEqual([item["tag"] for item in by_event["H0RD11"]], ["B200"])

    def test_complaint_label_is_not_immediate_jeopardy(self) -> None:
        """A paperwork tag found during a complaint visit stays a paperwork tag."""
        severity, immediate = map_severity("The file was missing a signature.")
        self.assertEqual(severity, 2)
        self.assertFalse(immediate)
        result = assemble([
            (2, mo_row(
                "C1",
                "A100",
                SURVEY_CATEGORY="COMPLAINT INVESTIGATION",
                DESCRIPTION="The file was missing a signature.",
            )),
        ])
        self.assertEqual(result["events"][0]["inspection_type"], "complaint")
        self.assertTrue(result["events"][0]["is_complaint"])

    def test_harm_language_is_severity_four(self) -> None:
        severity, immediate = map_severity("The resident left through an unsupervised elopement.")
        self.assertEqual(severity, 4)
        self.assertFalse(immediate)

    def test_excel_datetime_stays_a_real_date(self) -> None:
        """A spreadsheet timestamp is the visit date. It must not be stored as blank."""
        result = assemble([
            (2, mo_row("E9", "A100", EVENT_DATE=datetime(2021, 8, 18, 0, 0))),
        ])
        self.assertEqual(result["events"][0]["event_date"], date(2021, 8, 18))

    def test_conflicting_dates_are_quarantined(self) -> None:
        """One event id cannot be given two dates. The rows are kept and not inserted."""
        result = assemble([
            (2, mo_row("E1", "A100", EVENT_DATE=date(2021, 8, 18))),
            (3, mo_row("E1", "A100", EVENT_DATE=date(2021, 8, 19))),
        ])
        self.assertEqual(result["events"], [])
        self.assertTrue(all(item["reason"] == REASON_CONFLICTING_DATES for item in result["ledger"]))
        self.assertTrue(all(item["disposition"] == "quarantined" for item in result["ledger"]))


class IllinoisVisitTests(unittest.TestCase):
    def test_name_column_is_a_visit_id_not_a_license(self) -> None:
        """Publishing this number as a license would point a family at the wrong record."""
        visit = parse_visit_row((
            "Reflections Memory Care - Chatham",
            "00120355",
            "7D FRI  = Facility Reported Incident",
            date(2024, 12, 3),
            "No Violations",
            None,
        ), 2)
        self.assertEqual(visit["source_event_id"], "00120355")
        self.assertIsNone(visit["license_number"])
        self.assertEqual(visit["normalized_name"], "reflections memory care chatham")

    def test_lowest_visit_id_claims_the_stored_same_day_row(self) -> None:
        """The stored row is one of the visits. The other visit still has to be inserted."""
        first = parse_visit_row((
            "Reflections Memory Care - Chatham",
            "00120355",
            "7D FRI  = Facility Reported Incident",
            date(2024, 12, 3),
            "",
            None,
        ), 2)
        second = parse_visit_row((
            "Reflections Memory Care - Chatham",
            "00121041",
            "7D FRI  = Facility Reported Incident",
            date(2024, 12, 3),
            "",
            None,
        ), 3)
        stored = [{
            "id": "stored-row",
            "inspection_date": date(2024, 12, 3),
            "inspection_type": "facility_reported_incident",
            "survey_subtype": "7D FRI  = Facility Reported Incident",
            "source_event_id": None,
        }]
        claims, inserts = pair_visits([second, first], stored)
        self.assertEqual(claims, [("stored-row", "00120355")])
        self.assertEqual([visit["source_event_id"] for visit in inserts], ["00121041"])

    def test_rule_text_keeps_a_stable_code(self) -> None:
        """A second run must not invent a new finding id for the same cited line."""
        visit = parse_visit_row((
            "Example Home",
            "00120001",
            "L/SP = Special",
            date(2025, 1, 2),
            "295.4010 a) 1), T2, $500",
            500,
        ), 4)
        self.assertEqual(visit["citations"][0]["code"], "295.4010 a) 1)")
        self.assertEqual(visit["citations"][0]["state_severity_raw"], "Type 2")
        again = parse_visit_row((
            "Example Home",
            "00120001",
            "L/SP = Special",
            date(2025, 1, 2),
            "Unstructured note without a code",
            None,
        ), 4)
        self.assertEqual(again["citations"][0]["code"], "IL-00120001-1")

    def test_bootstrap_cannot_turn_visit_ids_into_facilities(self) -> None:
        with self.assertRaises(SystemExit) as caught:
            refuse_foia_bootstrap()
        self.assertEqual(caught.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
