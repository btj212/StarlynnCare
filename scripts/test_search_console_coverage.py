"""Why the coverage audit keeps a cited home and drops an empty Arizona page."""

from __future__ import annotations

import io
import sys
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from validate.search_console_coverage import (  # noqa: E402
    FacilityFacts,
    OCTOBER_27_BASELINE,
    baseline_delta,
    classify_path,
    facility_cohort,
    facility_listed_in_sitemap,
    facility_marked_noindex,
    hub_cohort,
    parse_coverage_zip,
    parse_validation_zip,
)


def _facts(**overrides: object) -> FacilityFacts:
    values: dict[str, object] = {
        "state_code": "AZ",
        "city_slug": "tucson",
        "slug": "example",
        "beds": 10,
        "inspections": 2,
        "deficiencies": 0,
        "reviews": 0,
        "tour_questions": 0,
        "photos": 0,
        "has_narrative": False,
    }
    values.update(overrides)
    return FacilityFacts(**values)  # type: ignore[arg-type]


class CoverageCohortTests(unittest.TestCase):
    def test_a_small_arizona_home_without_citations_is_not_requested(self) -> None:
        """Google already crawled these template pages and declined them. The page and the sitemap both drop them."""
        facts = _facts()
        self.assertTrue(facility_marked_noindex(facts))
        self.assertFalse(facility_listed_in_sitemap(facts))
        self.assertEqual(facility_cohort(facts), "noindex")

    def test_a_citation_keeps_the_arizona_page_even_when_the_prose_is_missing(self) -> None:
        """The citation is the record. Missing prose is a gap to fill, not a reason to hide the page."""
        facts = _facts(deficiencies=3, has_narrative=False)
        self.assertFalse(facility_marked_noindex(facts))
        self.assertTrue(facility_listed_in_sitemap(facts))
        self.assertEqual(facility_cohort(facts), "enrich")

    def test_a_quoted_inspection_is_retained(self) -> None:
        """A page with real inspection prose is the page Google should keep."""
        facts = _facts(state_code="CA", beds=80, deficiencies=1, has_narrative=True)
        self.assertEqual(facility_cohort(facts), "retain")

    def test_a_photo_only_home_stays_off_the_request_list(self) -> None:
        """The page can be indexed if found, but the sitemap does not ask Google to crawl another thin URL."""
        facts = _facts(state_code="OR", beds=40, inspections=0, photos=1)
        self.assertFalse(facility_marked_noindex(facts))
        self.assertFalse(facility_listed_in_sitemap(facts))
        self.assertEqual(facility_cohort(facts), "enrich")

    def test_a_hub_of_only_excluded_homes_cannot_justify_a_listing(self) -> None:
        """The hub would only list pages the facility rule already told Google not to index."""
        homes = [_facts(slug="one"), _facts(slug="two", beds=6)]
        self.assertEqual(hub_cohort(homes), "noindex")

    def test_one_cited_home_keeps_the_hub(self) -> None:
        """A city page still has a home worth ranking, so the hub stays."""
        homes = [_facts(slug="empty"), _facts(slug="cited", deficiencies=2, has_narrative=True)]
        self.assertEqual(hub_cohort(homes), "retain")

    def test_build_files_and_guides_are_not_facility_pages(self) -> None:
        """A hashed script or a guide in the validation sample is not a home to noindex."""
        self.assertEqual(classify_path("/_next/static/chunks/app.js")[0], "asset")
        self.assertEqual(classify_path("/washington/how-to-read-our-inspection-data")[0], "editorial")
        self.assertEqual(classify_path("/arizona/tucson/brookdale-tanque-verde-al11370")[0], "facility")

    def test_the_october_27_export_is_the_comparison_point(self) -> None:
        """Later charts are judged against the drop to 1,637 indexed pages."""
        self.assertEqual(OCTOBER_27_BASELINE["indexed"], 1637)
        self.assertEqual(OCTOBER_27_BASELINE["not_indexed"], 4773)
        self.assertEqual(OCTOBER_27_BASELINE["crawled_not_indexed"], 3684)
        coverage = {
            "indexed": 1637,
            "not_indexed": 4773,
            "crawled_not_indexed": 3684,
        }
        validation = {"rows": [{"status": "Failed"}] * 162 + [{"status": "Pending"}] * 1000}
        delta = baseline_delta(coverage, validation)
        self.assertEqual(delta["indexed"], 0)
        self.assertEqual(delta["validation_failed"], 0)

    def test_zip_readers_keep_the_chart_date_and_the_validation_issue(self) -> None:
        """The audit has to read both Search Console zip shapes, not a hand-copied spreadsheet."""
        coverage_buf = io.BytesIO()
        with zipfile.ZipFile(coverage_buf, "w") as archive:
            archive.writestr(
                "Chart.csv",
                "Date,Not indexed,Indexed,Impressions\n2026-10-22,4773,1637,572\n",
            )
            archive.writestr(
                "Critical issues.csv",
                "Reason,Source,Validation,Pages\nCrawled - currently not indexed,Google systems,Failed,3684\n",
            )
        validation_buf = io.BytesIO()
        with zipfile.ZipFile(validation_buf, "w") as archive:
            archive.writestr(
                "Table.csv",
                "URL,Last crawled,Status\nhttps://www.starlynncare.com/_next/static/app.js,2026-10-23,Failed\n",
            )
            archive.writestr("Metadata.csv", "Property,Value\nIssue,Crawled - currently not indexed\n")
        coverage_path = Path("/tmp/starlynn-coverage-test.zip")
        validation_path = Path("/tmp/starlynn-validation-test.zip")
        coverage_path.write_bytes(coverage_buf.getvalue())
        validation_path.write_bytes(validation_buf.getvalue())
        coverage = parse_coverage_zip(coverage_path)
        validation = parse_validation_zip(validation_path)
        self.assertEqual(coverage["chart_date"], "2026-10-22")
        self.assertEqual(coverage["crawled_not_indexed"], 3684)
        self.assertEqual(validation["rows"][0]["kind"], "asset")
        self.assertEqual(validation["issue"], "Crawled - currently not indexed")


if __name__ == "__main__":
    unittest.main()
