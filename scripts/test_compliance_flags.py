#!/usr/bin/env python3
"""Compliance flags follow the letter, and a second run with the same letters changes nothing."""

from __future__ import annotations

import json
import sys
import unittest
from datetime import date
from pathlib import Path

SCRAPERS = Path(__file__).resolve().parents[1] / "scrapers"
if str(SCRAPERS) not in sys.path:
    sys.path.insert(0, str(SCRAPERS))

from compliance.classify import (  # noqa: E402
    SourceDoc,
    build_diff,
    classify_documents,
)
from wa_forms_links import parse_forms_links  # noqa: E402

FIXTURES = SCRAPERS / "fixtures" / "compliance"
AS_OF = date(2026, 10, 27)


def load_home(license_number: str) -> list[SourceDoc]:
    manifest = json.loads((FIXTURES / "manifest.json").read_text())
    docs = []
    for row in manifest:
        if row["license"] != license_number:
            continue
        docs.append(
            SourceDoc(
                filename=row["filename"],
                text=(FIXTURES / row["text_file"]).read_text(),
                url=row["url"],
                doc_type=row["doc_type"],
                posted_month=row["posted_month"],
            )
        )
    return docs


class ComplianceFlagTests(unittest.TestCase):
    def test_relative_dshs_links_keep_their_category_and_month(self) -> None:
        """The forms page posts relative links. An absolute-only match used to find nothing."""
        html = (
            '<a href="/dshs/adsaapps/lookup/RCSForms/AF/756400/enforcement letters/2026/Rev SP.pdf">'
            "09/2026 - Enforcement Letters</a>"
        )
        links = parse_forms_links(
            html,
            "https://fortress.wa.gov/dshs/adsaapps/lookup/AFHForms.aspx?Lic=756400",
        )
        self.assertEqual(len(links), 1)
        self.assertEqual(links[0].doc_type, "enforcement_letter")
        self.assertEqual(links[0].posted_month, "2026-09")
        self.assertIn("enforcement%20letters", links[0].url)
        self.assertTrue(links[0].url.startswith("https://fortress.wa.gov/"))

    def test_an_apostrophe_in_the_filename_stays_in_the_path(self) -> None:
        """DSHS writes an apostrophe as &#39;. Treating # as a fragment dropped the file."""
        html = (
            '<a href="/dshs/adsaapps/lookup/RCSForms/AF/754275/inspections/2024/R Aysha&#39;s.pdf">'
            "04/2024 - Inspections</a>"
        )
        links = parse_forms_links(
            html,
            "https://fortress.wa.gov/dshs/adsaapps/lookup/AFHForms.aspx?Lic=754275",
        )
        self.assertEqual(len(links), 1)
        self.assertIn("%27", links[0].url)
        self.assertNotIn("%26", links[0].url)
        self.assertTrue(links[0].url.lower().endswith(".pdf"))

    def test_beacons_of_hope_revocation_stays_tier_1(self) -> None:
        """License 756400 was revoked and stop-placed. Returned mail is not a lift."""
        result = classify_documents(load_home("756400"), as_of=AS_OF)
        self.assertEqual(result.tier, 1)
        self.assertIn("revocation", result.open_actions)
        self.assertIn("stop_placement", result.open_actions)
        self.assertIsNotNone(result.banner_text)
        assert result.banner_text is not None
        self.assertIn("2026-09-15", result.banner_text)
        self.assertIn("2026-10-22", result.banner_text)
        self.assertIn("As of 2026-10-27", result.banner_text)

    def test_beacons_of_hope_one_lift_is_tier_2(self) -> None:
        """License 755245's stop placement and conditions were lifted. It is not Tier 1."""
        result = classify_documents(load_home("755245"), as_of=AS_OF)
        self.assertEqual(result.tier, 2)
        self.assertEqual(result.open_actions, [])
        assert result.banner_text is not None
        self.assertIn("2025-07-14", result.banner_text)
        self.assertIn("2025-11-12", result.banner_text)
        self.assertIn("lifted", result.banner_text)

    def test_beatrice_lift_is_tier_2(self) -> None:
        """License 753541's continued stop placement and conditions were lifted."""
        result = classify_documents(load_home("753541"), as_of=AS_OF)
        self.assertEqual(result.tier, 2)
        self.assertNotIn("stop_placement", result.open_actions)
        self.assertNotIn("conditions", result.open_actions)
        assert result.banner_text is not None
        self.assertIn("2026-10-14", result.banner_text)

    def test_clean_reports_and_boilerplate_are_not_flags(self) -> None:
        """A clean visit, a not-cited report, and a disclosure form do not flag the home."""
        docs = [
            SourceDoc(
                filename="Inspection.pdf",
                text="Inspection completed. No deficiencies were cited. The home was not cited.",
                url="https://example.test/clean.pdf",
                doc_type="inspection",
                posted_month="2026-01",
            ),
            SourceDoc(
                filename="Disclosure of Services.pdf",
                text="Disclosure of Services. The home provides the following services.",
                url="https://example.test/disclosure.pdf",
                doc_type="inspection",
                posted_month="2026-02",
            ),
        ]
        result = classify_documents(docs, as_of=AS_OF)
        self.assertEqual(result.tier, 0)
        self.assertIsNone(result.banner_text)

    def test_one_cited_report_is_tier_3(self) -> None:
        """One statement of deficiencies in the last three years is an info line, not a banner tier."""
        docs = [
            SourceDoc(
                filename="R Home Inspection.pdf",
                text="Statement of Deficiencies dated March 2, 2026. The home failed to keep a record.",
                url="https://example.test/sod.pdf",
                doc_type="inspection",
                posted_month="2026-03",
            )
        ]
        result = classify_documents(docs, as_of=AS_OF)
        self.assertEqual(result.tier, 3)
        assert result.banner_text is not None
        self.assertNotIn("families may want to ask", result.banner_text)

    def test_a_second_run_with_the_same_letters_reports_no_changes(self) -> None:
        """The weekly diff is empty when the state has not posted anything new."""
        result = classify_documents(load_home("756400"), as_of=AS_OF)
        snapshot = {
            "home-1": {"tier": result.tier, "docs": result.docs, "name": "Beacons of Hope"}
        }
        diff = build_diff(snapshot, snapshot)
        self.assertEqual(diff["new_flags"], [])
        self.assertEqual(diff["lifted_flags"], [])
        self.assertEqual(diff["tier_changes"], [])

        lifted = classify_documents(load_home("755245"), as_of=AS_OF)
        changed = build_diff(
            snapshot,
            {"home-1": {"tier": lifted.tier, "docs": lifted.docs, "name": "Beacons of Hope"}},
        )
        self.assertEqual(changed["tier_changes"][0]["from"], 1)
        self.assertEqual(changed["tier_changes"][0]["to"], 2)
        self.assertEqual(len(changed["lifted_flags"]), 1)
        self.assertEqual(changed["new_flags"], [])


if __name__ == "__main__":
    unittest.main()
