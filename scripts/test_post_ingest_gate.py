"""Why a quiet weekly scan is allowed to pass."""

from __future__ import annotations

import unittest

from validate.post_ingest_check import (
    bed_counts_are_published,
    bed_nulls_pass,
    inspection_coverage_passes,
)


class PostIngestGateTests(unittest.TestCase):
    def test_illinois_missing_beds_is_not_a_failed_scan(self) -> None:
        """Illinois publishes no bed counts, so an all-null column is the source, not a broken week."""
        self.assertFalse(bed_counts_are_published(30, 30))

    def test_oregon_two_missing_beds_stay_inside_the_allowance(self) -> None:
        """Oregon does publish beds. Two blanks match the existing allowance of five."""
        self.assertTrue(bed_counts_are_published(130, 2))
        self.assertTrue(bed_nulls_pass(2))

    def test_a_state_that_publishes_beds_fails_above_the_allowance(self) -> None:
        """Six missing bed counts in a state that otherwise has them is a real data break."""
        self.assertTrue(bed_counts_are_published(561, 6))
        self.assertFalse(bed_nulls_pass(6))

    def test_blank_facility_date_passes_when_the_inspection_row_exists(self) -> None:
        """Missouri and the other live states keep the date on the inspection, not the facility column."""
        self.assertTrue(inspection_coverage_passes(268, 268))

    def test_coverage_uses_the_existing_ninety_percent_bar(self) -> None:
        """The weekly gate matches db_invariants: 90% of published homes need an inspection row."""
        self.assertTrue(inspection_coverage_passes(90, 100))
        self.assertFalse(inspection_coverage_passes(89, 100))

    def test_an_empty_state_does_not_invent_a_coverage_failure(self) -> None:
        """The row-count check owns the empty case. Coverage does not fail it a second time."""
        self.assertTrue(inspection_coverage_passes(0, 0))
