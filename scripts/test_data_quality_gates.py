"""Quality gates fail on a bad record, not on a quiet source."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scrapers"))

from _http_helpers import source_should_fail_job
from pa_dhs_inspections_scraper import status_is_retryable as pa_status_is_retryable
from ut_ccl_inspections_scraper import status_is_retryable as ut_status_is_retryable
from validate.db_invariants import (
    bed_gap_is_structural,
    bed_gaps_pass,
    future_dates_pass,
)
import weekly_inspection_ingest as weekly


class DataQualityGateTests(unittest.TestCase):
    def test_illinois_missing_beds_are_the_shape_of_that_source(self) -> None:
        """Illinois publishes no bed counts, so thirty blanks are not a broken roster."""
        self.assertTrue(bed_gap_is_structural(30, 30))

    def test_oregon_two_missing_beds_stay_inside_the_allowance(self) -> None:
        """Oregon does publish beds. Two blanks are not a failed ingest."""
        self.assertFalse(bed_gap_is_structural(130, 2))
        self.assertTrue(bed_gaps_pass(2))

    def test_six_missing_beds_in_a_state_that_publishes_them_fails(self) -> None:
        """A real hole in a state that stores bed counts has to surface."""
        self.assertFalse(bed_gaps_pass(6))

    def test_one_near_future_washington_date_is_not_a_parser_bug(self) -> None:
        """Aegis Living Kirkland's source file is dated 2026-12-01. One date that close is the source."""
        self.assertTrue(future_dates_pass(1, 37))

    def test_a_date_months_ahead_is_a_parser_bug(self) -> None:
        """A visit dated half a year from now was not on the state's calendar."""
        self.assertFalse(future_dates_pass(1, 200))

    def test_two_future_dates_fail(self) -> None:
        """The one known Washington outlier does not cover a second future date."""
        self.assertFalse(future_dates_pass(2, 10))

    def test_a_missing_page_is_not_retried_as_a_block(self) -> None:
        """404 means the facility page is gone. 403 and 500 can clear on a second try."""
        self.assertFalse(pa_status_is_retryable(404))
        self.assertTrue(pa_status_is_retryable(403))
        self.assertFalse(ut_status_is_retryable(404))
        self.assertTrue(ut_status_is_retryable(500))

    def test_a_handful_of_blocked_pages_does_not_fail_the_sunday_job(self) -> None:
        """Seven 403s out of 363 PA pages still stored 10,777 PDF rows. That is not a downed portal."""
        self.assertFalse(source_should_fail_job(363, 7, 10777))
        self.assertFalse(source_should_fail_job(119, 1, 566))

    def test_a_source_that_stores_nothing_still_fails(self) -> None:
        """If every page is blocked, or nothing was stored, the scan has to go red."""
        self.assertTrue(source_should_fail_job(363, 363, 0))
        self.assertTrue(source_should_fail_job(119, 40, 0))
        self.assertTrue(source_should_fail_job(100, 21, 50))

    def test_weekly_wa_does_not_resummarize_every_inspection(self) -> None:
        """--rescore re-ran Claude on 3,335 WA visits (~85 minutes) after 58 new PDFs."""
        src = Path(__file__).resolve().parents[1] / "scripts" / "weekly_inspection_ingest.py"
        text = src.read_text()
        self.assertNotIn('"--rescore"', text)
        self.assertIn("--created-since-days", text)

    def test_texas_without_a_capture_file_is_a_quiet_source(self) -> None:
        """No TULIP file this week means nothing new arrived. It is not a crashed scraper."""
        weekly._SOURCE_RESULTS.clear()
        with patch.object(Path, "glob", return_value=[]):
            self.assertTrue(weekly.ingest_tx(None))
        self.assertEqual(weekly._SOURCE_RESULTS[-1][1], 0)

    def test_a_texas_capture_that_cannot_be_ingested_still_fails(self) -> None:
        """A file sitting in the capture folder and not loaded is a real stop."""
        weekly._SOURCE_RESULTS.clear()
        with patch.object(Path, "glob", return_value=[Path("tulip-capture")]):
            self.assertFalse(weekly.ingest_tx(None))
        self.assertEqual(weekly._SOURCE_RESULTS[-1][1], 2)


if __name__ == "__main__":
    unittest.main()
