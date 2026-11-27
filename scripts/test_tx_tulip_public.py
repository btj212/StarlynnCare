"""Texas inspections match on the license number, and only a dated TULIP row counts.

The fixture is a real guest-Aura capture from 2026-11-27. The inspections
method currently returns yesData / noData, not the violation table. A penalty
on the enforcement method is a citation with a date. The Salesforce Account Id
is not a license and must not match a facility.
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scrapers"))

from tx_inspections_backfill import FacilityOutcome, summarize
from tx_tulip_public import (
    parse_enforcement_payload,
    parse_inspection_payload,
    pick_search_hit,
    read_aura_context,
)

FIXTURE = ROOT / "scrapers" / "fixtures" / "tx_tulip_public_sample.json"


def _load() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


class TulipParserTests(unittest.TestCase):
    def test_search_page_excerpt_still_carries_the_aura_context(self) -> None:
        """The client has to read fwuid off the live page. A hardcoded token goes stale."""
        sample = _load()
        fwuid, loaded = read_aura_context(sample["search_page_html_excerpt"])
        self.assertTrue(fwuid.startswith("Zjky"))
        self.assertTrue(loaded.startswith("1919_p_"))

    def test_license_match_uses_the_license_field_not_the_account_id(self) -> None:
        """148715's Account Id changed after the May smoke capture. The license did not."""
        sample = _load()
        hit = sample["search_148715"][0]
        self.assertEqual(hit["Id"], "001cv00000Rs8SAAAZ")
        self.assertIsNotNone(pick_search_hit(sample["search_148715"], "148715"))
        self.assertIsNone(pick_search_hit(sample["search_148715"], hit["Id"]))
        self.assertIsNone(pick_search_hit(sample["search_148715"], "307466"))

    def test_a_short_license_does_not_match_a_longer_one(self) -> None:
        """Zero-padding is for the directory's 6-digit key. 715 is not 148715."""
        sample = _load()
        self.assertIsNone(pick_search_hit(sample["search_148715"], "715"))
        self.assertIsNotNone(pick_search_hit(sample["search_148715"], "0148715"))

    def test_yesdata_without_a_date_is_not_an_inspection(self) -> None:
        """License 148715's current tab says yesData and leaves the date blank."""
        sample = _load()
        account = sample["search_148715"][0]["Id"]
        rows = parse_inspection_payload(sample["inspections_148715_yesdata_without_date"], account)
        self.assertEqual(rows, [])

    def test_yesdata_with_a_header_date_is_one_visit_and_zero_citations(self) -> None:
        """Windermere's page prints October 02, 2015 and no violation lines."""
        sample = _load()
        account = sample["search_148140"][0]["Id"]
        rows = parse_inspection_payload(sample["inspections_148140_yesdata_with_date"], account)
        self.assertEqual(len(rows), 1)
        visit = rows[0]
        self.assertEqual(visit["inspection_date"], "2015-10-02")
        self.assertEqual(visit["inspection_type"], "comprehensive")
        self.assertEqual(visit["total_deficiency_count"], 0)
        self.assertIn(account, visit["source_url"])
        self.assertTrue(visit["source_url"].startswith("https://tulip.hhs.texas.gov/"))

    def test_nodata_stores_nothing(self) -> None:
        """Kingfisher's tab says there is no inspection data. Do not invent a date."""
        sample = _load()
        account = sample["search_148102"][0]["Id"]
        rows = parse_inspection_payload(sample["inspections_148102_nodata"], account)
        self.assertEqual(rows, [])

    def test_enforcement_row_is_a_dated_citation_matched_separately_from_surveys(self) -> None:
        """Brookdale Sleepy Hollow's public penalty is 2025-02-27, rule 553.261."""
        sample = _load()
        account = sample["search_307466"][0]["Id"]
        rows = parse_enforcement_payload(sample["enforcement_307466"], account)
        self.assertEqual(len(rows), 1)
        penalty = rows[0]
        self.assertEqual(penalty["inspection_date"], "2025-02-27")
        self.assertEqual(penalty["inspection_type"], "Administrative Penalty")
        self.assertEqual(penalty["total_deficiency_count"], 1)
        self.assertEqual(penalty["deficiencies"][0]["code"], "553.261(a)(1)(A)")
        self.assertIn("medications", penalty["deficiencies"][0]["inspector_narrative"])
        self.assertEqual(penalty["source_event_id"], "a2ccv00000fKR6aAAG")
        self.assertEqual(penalty["civil_money_penalty_total"], 3000.0)
        self.assertIn("c__accountidparam=" + account, penalty["source_url"])

    def test_a_visit_row_groups_citations_from_the_same_exit_date(self) -> None:
        """The inspections tab still renders exitDate, correctedDate, and stateViolationCited.

        The 2026-11-27 ALF sample did not include one of these rows. This uses
        that field list so a future payload with two lines on one exit date
        stays one inspection.
        """
        rows = parse_inspection_payload(
            [
                {
                    "exitDate": "2/7/2020",
                    "correctedDate": "3/6/2020",
                    "visitType": "Life Safty Code",
                    "stateViolationCited": "The facility failed to keep the exit clear.",
                    "mostRecentExitDate": "February 16, 2023",
                },
                {
                    "exitDate": "2/7/2020",
                    "correctedDate": "3/6/2020",
                    "visitType": "Life Safty Code",
                    "stateViolationCited": "The facility failed to test the alarm.",
                },
            ],
            "001cv00000Rs8SAAAZ",
        )
        by_type = {row["inspection_type"]: row for row in rows}
        visit = by_type["Life Safty Code"]
        self.assertEqual(visit["inspection_date"], "2020-02-07")
        self.assertEqual(visit["total_deficiency_count"], 2)
        header = by_type["comprehensive"]
        self.assertEqual(header["inspection_date"], "2023-02-16")
        self.assertEqual(header["total_deficiency_count"], 0)


class BackfillCountTests(unittest.TestCase):
    def test_gain_count_skips_a_home_that_already_has_an_inspection(self) -> None:
        """The one live Texas page already has the 2023 smoke rows. It is not a new gain."""
        sample = _load()
        account = sample["search_307466"][0]["Id"]
        penalty = parse_enforcement_payload(sample["enforcement_307466"], account)
        already = FacilityOutcome(
            license_number="148715",
            name="Alzheimer's Care and Research Center Foundation",
            facility_id="86cd9ff9-d5f7-407b-9a45-3067119825ee",
            had_inspection=True,
            matched=True,
            inspections=penalty,
        )
        empty = FacilityOutcome(
            license_number="148102",
            name="Kingfisher",
            facility_id="x",
            had_inspection=False,
            matched=True,
            inspections=[],
        )
        wind = parse_inspection_payload(
            sample["inspections_148140_yesdata_with_date"],
            sample["search_148140"][0]["Id"],
        )
        new_home = FacilityOutcome(
            license_number="148140",
            name="Windermere",
            facility_id="y",
            had_inspection=False,
            matched=True,
            inspections=wind,
        )
        summary = summarize([already, empty, new_home])
        self.assertEqual(summary["facilities_matched"], 3)
        self.assertEqual(summary["inspections_found"], 2)
        self.assertEqual(summary["citations_found"], 1)
        self.assertEqual(summary["newest_date"], "2025-02-27")
        self.assertEqual(summary["facilities_that_would_gain_an_inspection"], 1)
        self.assertEqual(summary["homes_that_would_have_at_least_one_inspection"], 2)
        self.assertEqual(summary["homes_whose_newest_fetched_date_is_inside_48_months"], 1)


if __name__ == "__main__":
    unittest.main()
