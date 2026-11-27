#!/usr/bin/env python3
"""Citation counting, summary-run counters, and WA PDF backfill totals.

Each test names the family-facing mistake it prevents: quoting accordion
row totals as citations, refusing a clean Oregon kitchen visit, crashing
the summarizer on empty source, or leaving a PDF-only visit at 0 citations.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRAPERS = ROOT / "scrapers"
sys.path.insert(0, str(SCRAPERS))

from _summary_guard import (  # noqa: E402
    CITATION_ROW_SQL,
    count_citation_rows,
    is_citation_row,
    is_or_initial_comment,
    is_wa_placeholder_text,
    new_run_counters,
    reject_false_clean_visit,
    tally_summary_result,
)


def _row(
    code: str | None = None,
    description: str | None = None,
    inspector_narrative: str | None = None,
) -> dict[str, str | None]:
    return {
        "code": code,
        "description": description,
        "inspector_narrative": inspector_narrative,
    }


class CitationRowTests(unittest.TestCase):
    def test_or_c0000_and_star0000_are_not_citations(self) -> None:
        """A clean OR visit with only C0000 should say no deficiencies were cited."""
        self.assertTrue(is_or_initial_comment("C0000"))
        self.assertTrue(is_or_initial_comment("V0000"))
        self.assertTrue(is_or_initial_comment("*0000"))
        self.assertTrue(is_or_initial_comment("m0000"))
        self.assertFalse(is_or_initial_comment("C0231"))
        self.assertFalse(is_or_initial_comment("C0010"))
        self.assertFalse(
            is_citation_row(
                code="C0000",
                inspector_narrative=(
                    "The findings of the kitchen inspection are documented in this report."
                ),
            )
        )

    def test_or_50a034_does_not_count_the_cover_tag(self) -> None:
        """Faye Wright 50A034 Mar 2024 had 33 accordion rows; C0000 is not a citation.

        The stored inspections.total_deficiency_count is 31 (CSV). The model was
        being handed GREATEST(31, 33)=33 and quoting 33 cited deficiencies.
        """
        rows = [_row("C0000", None, "The findings of the change of ownership survey...")]
        for code in (
            "C0150",
            "C0160",
            "C0200",
            "C0231",
            "C0242",
            "C0252",
            "C0260",
            "C0270",
            "C0280",
            "C0282",
            "C0290",
            "C0295",
            "C0300",
            "C0303",
            "C0304",
            "C0310",
            "C0315",
            "C0330",
            "C0360",
            "C0361",
            "C0372",
            "C0420",
            "C0422",
            "C0455",
            "C0510",
            "C0513",
            "C0555",
            "Z0142",
            "Z0155",
            "Z0162",
            "Z0163",
            "Z0164",
        ):
            rows.append(_row(code, None, "Based on observation, the facility failed to..."))
        self.assertEqual(len(rows), 33)
        self.assertEqual(count_citation_rows(rows), 32)

    def test_wa_placeholder_rows_are_not_citations(self) -> None:
        """A PDF-link stub is not a WAC citation. Counting it tells families a finding exists."""
        self.assertTrue(is_wa_placeholder_text("WA DSHS report: Inspections (06/2025)"))
        self.assertTrue(is_wa_placeholder_text("—: WA DSHS report: Investigations (09/2025)"))
        self.assertFalse(
            is_citation_row(
                code="__wa_738a4007ba49cae62b78447bebc25935",
                description="WA DSHS report: Investigations (09/2025)",
                inspector_narrative="https://fortress.wa.gov/dshs/adsaapps/lookup/RCSForms/BH/245",
            )
        )
        self.assertFalse(
            is_citation_row(
                description="https://fortress.wa.gov/dshs/adsaapps/lookup/BHForms.aspx?Lic=2141"
            )
        )
        self.assertTrue(
            is_citation_row(
                code="WAC 388-78A-2120",
                description="The facility failed to provide treatment for skin concerns.",
            )
        )

    def test_clean_or_visit_guard_uses_citation_count_not_raw_rows(self) -> None:
        """PR 258 must not refuse 'no deficiencies' when the only row is C0000."""
        source = (
            "The findings of the kitchen inspection, conducted 1/31/24, are documented "
            "in this report. The survey was conducted to determine compliance with the OARs."
        )
        summary = (
            "A kitchen inspection found no deficiencies were cited. "
            "The facility was in compliance with meal and sanitation rules."
        )
        citation_n = count_citation_rows(
            [_row("C0000", None, source)]
        )
        self.assertEqual(citation_n, 0)
        self.assertFalse(
            reject_false_clean_visit(summary, deficiency_count=citation_n, source_text=source)
        )
        # Counting the cover tag as a deficiency would reject a true clean visit.
        self.assertTrue(
            reject_false_clean_visit(summary, deficiency_count=1, source_text=source)
        )

    def test_sql_predicate_mentions_the_same_non_citation_shapes(self) -> None:
        """The SELECT the summarizer runs has to match the Python gate."""
        self.assertIn("^[A-Z*]0000$", CITATION_ROW_SQL)
        self.assertIn("WA DSHS report:", CITATION_ROW_SQL)
        self.assertIn("https?://", CITATION_ROW_SQL)


class RecordCounterTests(unittest.TestCase):
    def test_empty_source_and_not_written_do_not_crash(self) -> None:
        """skipped_empty / not_written used to be missing from nonlocal and crashed the run."""
        stats = new_run_counters()
        tally_summary_result(stats, "empty")
        tally_summary_result(stats, "ok", wrote=False)
        tally_summary_result(stats, "ok", wrote=True)
        tally_summary_result(stats, "fail")
        self.assertEqual(stats["skipped_empty"], 1)
        self.assertEqual(stats["not_written"], 1)
        self.assertEqual(stats["succeeded"], 1)
        self.assertEqual(stats["failed"], 1)
        self.assertEqual(stats["processed"], 4)

    def test_summarizer_no_longer_uses_incomplete_nonlocal(self) -> None:
        """A nested _record that increments skipped_empty without nonlocal UnboundLocals."""
        src = (ROOT / "scrapers" / "summarize_inspections.py").read_text()
        self.assertNotIn("nonlocal processed", src)
        self.assertIn("tally_summary_result", src)
        self.assertIn("skipped_empty", src)
        self.assertIn("not_written", src)


class WaPdfBackfillCountTests(unittest.TestCase):
    def test_total_deficiency_count_is_parsed_citations_not_report_links(self) -> None:
        """inspections.total_deficiency_count (not total_deficiencies) after a PDF swap.

        PDF-only visits were left at 0. Website imports were left at the number
        of report links. Families then saw a visit with WAC citations counted as 0.
        """
        before = [
            _row(
                "__wa_old",
                "WA DSHS report: Inspections (06/2025)",
                "https://fortress.wa.gov/dshs/adsaapps/lookup/RCSForms/BH/245",
            )
        ]
        after = [
            _row(
                "WAC 388-78A-2120",
                "The facility failed to provide treatment for skin concerns.",
            ),
            _row(
                "WAC 388-78A-24701",
                "The facility failed to complete a character, competence and suitability review.",
            ),
            _row(
                "__wa_other_pdf",
                "WA DSHS report: Investigations (09/2025)",
                "https://fortress.wa.gov/dshs/adsaapps/lookup/RCSForms/BH/246",
            ),
        ]
        self.assertEqual(count_citation_rows(before), 0)
        self.assertEqual(count_citation_rows(after), 2)
        self.assertEqual(count_citation_rows([]), 0)

    def test_backfill_writes_the_real_column_name(self) -> None:
        """The column is inspections.total_deficiency_count, not total_deficiencies."""
        src = (ROOT / "scrapers" / "wa_pdf_backfill.py").read_text()
        self.assertIn("total_deficiency_count = %s", src)
        self.assertNotIn("total_deficiencies", src)


if __name__ == "__main__":
    unittest.main()
