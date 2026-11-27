#!/usr/bin/env python3
"""Citation-count rules for the inspection summarizer.

Families were told a clean Oregon visit had "one deficiency" because the
cover tag C0000 was counted, and other visits quoted the raw row total.
These tests lock the shared rule the summarizer, the post-check, the
mismatch script, and the Washington PDF backfill all use.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRAPERS = ROOT / "scrapers"
for path in (ROOT, SCRAPERS):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from _summary_guard import (  # noqa: E402
    citation_mismatch,
    citation_prompt_parts,
    is_real_citation,
    real_citation_count,
    summary_rejected_for_count,
)
from summarize_inspections import make_summary_recorder  # noqa: E402
from wa_pdf_backfill import backfill_inspection  # noqa: E402


def _or_visit_33() -> list[dict]:
    """33 rows: 31 real tags plus two cover comments ending in 0000."""
    rows = [
        {"code": f"C{index:04d}", "description": f"Based on observation, finding {index}."}
        for index in range(1, 32)
    ]
    rows.append({"code": "C0000", "description": "Initial comments. Substantial compliance."})
    rows.append({"code": "Z0000", "description": "The findings are documented in this report."})
    return rows


class CitationRuleTests(unittest.TestCase):
    def test_oregon_cover_tags_are_not_citations(self) -> None:
        self.assertFalse(is_real_citation({"code": "C0000", "description": "comments"}, "OR"))
        self.assertFalse(is_real_citation({"code": " c0000 ", "description": "comments"}, "OR"))
        self.assertTrue(is_real_citation({"code": "C0270", "description": "Based on record review."}, "OR"))

    def test_washington_placeholders_are_not_citations(self) -> None:
        self.assertFalse(
            is_real_citation(
                {"code": "x", "description": "WA DSHS report: 2025-06"},
                "WA",
            )
        )
        self.assertFalse(
            is_real_citation(
                {"code": "__wa_ab12", "description": "The facility failed to do something."},
                "WA",
            )
        )
        self.assertTrue(
            is_real_citation(
                {"code": "388-78A-2090", "description": "The facility failed to provide care."},
                "WA",
            )
        )

    def test_blank_row_is_not_a_citation_in_other_states(self) -> None:
        # Rule 4 only. A coded California row is still a citation.
        self.assertFalse(is_real_citation({"code": "  ", "description": "  "}, "CA"))
        self.assertTrue(is_real_citation({"code": "F689", "description": "Failed to provide care."}, "CA"))
        self.assertTrue(is_real_citation({"code": "C0000", "description": "comments"}, "CA"))

    def test_clean_oregon_visit_rejects_a_one_deficiency_summary(self) -> None:
        rows = [{"code": "C0000", "description": "Substantial compliance. Initial comments."}]
        self.assertEqual(real_citation_count(rows, "OR"), 0)
        self.assertTrue(summary_rejected_for_count("One deficiency was cited.", 0))
        self.assertFalse(summary_rejected_for_count("No deficiencies were cited.", 0))
        count, block, instruction = citation_prompt_parts(rows, "OR")
        self.assertEqual(count, 0)
        self.assertIn("Citations:\n(none)", block)
        self.assertIn("Inspector's general comments, not a citation:", block)
        self.assertNotIn("- C0000:", block.split("Inspector's general comments")[0])
        self.assertIn(
            "State exactly 0 deficiencies, or say no deficiencies were cited if 0 is 0; "
            "do not count rows yourself.",
            instruction,
        )
        self.assertTrue(summary_rejected_for_count("A deficiency was cited.", 0))
        self.assertTrue(summary_rejected_for_count("Deficiencies were cited.", 0))
        self.assertTrue(summary_rejected_for_count("Twenty deficiencies were cited.", 19))
        self.assertFalse(summary_rejected_for_count("Twenty deficiencies were cited.", 20))

    def test_oregon_33_rows_with_two_cover_tags_count_as_31(self) -> None:
        rows = _or_visit_33()
        self.assertEqual(len(rows), 33)
        self.assertEqual(real_citation_count(rows, "OR"), 31)
        self.assertTrue(summary_rejected_for_count("This visit had 33 deficiencies.", 31))
        self.assertFalse(summary_rejected_for_count("This visit had 31 deficiencies.", 31))
        self.assertTrue(summary_rejected_for_count("No deficiencies were cited.", 31))

    def test_duplicate_tag_and_text_count_once(self) -> None:
        rows = [
            {"code": "C0270", "description": "Same finding."},
            {"code": "C0270", "description": "Same finding."},
            {"code": "C0150", "description": "A different finding."},
        ]
        self.assertEqual(real_citation_count(rows, "OR"), 2)

    def test_mismatch_script_uses_the_same_helper(self) -> None:
        rows = [{"code": "C0000", "description": "Substantial compliance."}]
        self.assertTrue(citation_mismatch("One deficiency was cited.", rows, "OR"))
        self.assertFalse(citation_mismatch("No deficiencies were cited.", rows, "OR"))
        source = (ROOT / "scripts" / "count_summary_deficiency_mismatches.py").read_text()
        self.assertIn("citation_mismatch", source)
        self.assertIn("real_citation_count", source)


class _Cursor:
    def __init__(self, conn: "_Conn") -> None:
        self.conn = conn
        self.rowcount = 0
        self._one: tuple | None = None
        self._all: list = []

    def execute(self, sql: str, params=None) -> None:
        compact = " ".join(sql.split())
        self.conn.calls.append((compact, params))
        self.rowcount = 0
        self._one = None
        self._all = []
        if "COUNT(*)" in compact:
            self._one = (self.conn.placeholder_count,)
        elif compact.startswith("DELETE"):
            self.rowcount = self.conn.delete_rowcount
        elif "SELECT 1 FROM deficiencies" in compact:
            self._one = None
        elif compact.startswith("INSERT"):
            self.rowcount = 1
        elif "inspector_narrative" in compact and compact.startswith("SELECT"):
            self._all = list(self.conn.stored_rows)
        elif compact.startswith("SELECT code, description FROM"):
            self._all = [
                (code, desc)
                for code, desc, _narrative in self.conn.stored_rows
                if not (desc or "").startswith("WA DSHS report:")
            ]
        elif "narrative_summary" in compact:
            self.rowcount = self.conn.write_rowcount
        elif "total_deficiency_count" in compact:
            self.conn.count_update = params

    def fetchone(self):
        return self._one

    def fetchall(self):
        return self._all

    def __enter__(self) -> "_Cursor":
        return self

    def __exit__(self, *_exc: object) -> bool:
        return False


class _Conn:
    def __init__(
        self,
        *,
        placeholder_count: int = 1,
        delete_rowcount: int = 1,
        stored_rows: list[tuple] | None = None,
        write_rowcount: int = 0,
    ) -> None:
        self.placeholder_count = placeholder_count
        self.delete_rowcount = delete_rowcount
        self.stored_rows = stored_rows or []
        self.write_rowcount = write_rowcount
        self.calls: list[tuple] = []
        self.count_update = None
        self.commits = 0

    def cursor(self) -> _Cursor:
        cursor = _Cursor(self)
        cursor.rowcount = self.write_rowcount
        return cursor

    def commit(self) -> None:
        self.commits += 1


class RecorderTests(unittest.TestCase):
    def test_empty_and_not_written_do_not_raise(self) -> None:
        empty_conn = _Conn()
        record, snapshot = make_summary_recorder(
            empty_conn, refetch=True, workers=1, total=2
        )
        record(("insp-1", "Clean Home", None, "empty"))
        self.assertEqual(snapshot()["skipped_empty"], 1)
        self.assertEqual(snapshot()["processed"], 1)

        missed = _Conn(write_rowcount=0)
        record, snapshot = make_summary_recorder(
            missed, refetch=True, workers=1, total=1
        )
        record(("insp-2", "Missed Home", "No deficiencies were cited.", "ok"))
        self.assertEqual(snapshot()["not_written"], 1)
        self.assertEqual(snapshot()["succeeded"], 0)
        self.assertEqual(snapshot()["failed"], 0)

        failed = _Conn()
        record, snapshot = make_summary_recorder(
            failed, refetch=False, workers=1, total=1
        )
        record(("insp-3", "Failed Home", None, "fail"))
        self.assertEqual(snapshot()["failed"], 1)

        saved = _Conn(write_rowcount=1)
        record, snapshot = make_summary_recorder(
            saved, refetch=True, workers=1, total=1
        )
        record(("insp-4", "Saved Home", "No deficiencies were cited.", "ok"))
        self.assertEqual(snapshot()["succeeded"], 1)
        self.assertEqual(saved.commits, 1)


class BackfillCountTests(unittest.TestCase):
    def test_swap_sets_count_to_real_wac_rows(self) -> None:
        # One placeholder before the swap, then two parsed WAC rows.
        # The placeholder is still visible to the count query here so the
        # helper, not a raw row total, has to be what produces 2.
        stored = [
            ("388-78A-2090", "The facility failed to provide treatment.", None),
            ("388-78A-2120", "The facility failed to complete a review.", None),
            ("__wa_placeholder", "WA DSHS report: 2025-06", "https://example/report.pdf"),
        ]
        conn = _Conn(placeholder_count=1, delete_rowcount=1, stored_rows=stored)
        written = backfill_inspection(
            conn,
            "00000000-0000-0000-0000-000000000001",
            [
                {"code": "388-78A-2090", "description": "The facility failed to provide treatment."},
                {"code": "388-78A-2120", "description": "The facility failed to complete a review."},
            ],
            "https://example/report.pdf",
        )
        self.assertEqual(written, 2)
        self.assertEqual(conn.commits, 1)
        self.assertIsNotNone(conn.count_update)
        self.assertEqual(conn.count_update[0], 2)
        count_sql = [sql for sql, _params in conn.calls if "total_deficiency_count" in sql]
        narrative_at = next(
            index for index, (sql, _params) in enumerate(conn.calls) if "jsonb_set" in sql
        )
        count_at = next(
            index for index, (sql, _params) in enumerate(conn.calls) if "total_deficiency_count" in sql
        )
        self.assertEqual(len(count_sql), 1)
        self.assertLess(count_at, len(conn.calls))
        self.assertLess(narrative_at, count_at)

    def test_no_swap_does_not_change_the_count(self) -> None:
        conn = _Conn(placeholder_count=0, delete_rowcount=0, stored_rows=[])
        backfill_inspection(
            conn,
            "00000000-0000-0000-0000-000000000002",
            [],
            "https://example/other.pdf",
        )
        self.assertIsNone(conn.count_update)
        self.assertEqual(conn.commits, 1)


if __name__ == "__main__":
    unittest.main()
