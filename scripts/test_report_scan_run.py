#!/usr/bin/env python3
"""The operator hears about every scan. Families do not."""

from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

SCRIPTS_DIR = Path(__file__).resolve().parent
SCRAPERS_DIR = SCRIPTS_DIR.parent / "scrapers"
for path in (SCRIPTS_DIR, SCRAPERS_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from _watch_alert import send_operator_scan_report  # noqa: E402
from report_scan_run import (  # noqa: E402
    data_check_from_outcome,
    data_check_from_sunday_output,
    family_mail_line,
    format_missing_note,
    format_scan_note,
    inbox_line,
    operator_mail_is_configured,
)


def _scan(**overrides: object) -> dict[str, object]:
    scan: dict[str, object] = {
        "state_code": "CA",
        "status": "partial",
        "started_at": datetime(2026, 11, 7, 14, 15, tzinfo=timezone.utc),
        "completed_at": datetime(2026, 11, 7, 14, 20, tzinfo=timezone.utc),
        "inspections_before": 18048,
        "inspections_after": 18048,
        "deficiencies_before": 4000,
        "deficiencies_after": 4000,
        "error": "ccld_citations: exit 1",
        "sources": [{"source": "ccld_citations", "status": "failed", "error": "exit 1"}],
        "real_findings": [],
        "other_changes": 2,
        "facility_sent": 0,
        "facility_failed": 0,
        "area_sent": 0,
        "area_failed": 0,
        "watched": [
            {"name": "Alamo Care Home — Alamo", "opened": True, "finding": None},
            {"name": "Lakes — El Dorado Hills", "opened": False, "finding": None},
        ],
        "reports_seen": 30,
        "reports_new": 0,
        "not_opened": ["Maple Manor"],
        "data_check": "not-sunday",
    }
    scan.update(overrides)
    return scan


class OperatorScanNoteTests(unittest.TestCase):
    def test_a_partial_morning_still_says_what_was_opened(self) -> None:
        """A failed California crawl has to say which watched home was not checked."""
        summary, details = format_scan_note(_scan())
        self.assertEqual(summary, "CA partial — inspections +0, 0 family emails")
        self.assertIn("Alamo Care Home — Alamo: report index opened, no new inspection", details)
        self.assertIn("Lakes — El Dorado Hills: report index not opened", details)
        self.assertIn("Maple Manor", details)
        self.assertIn("No home gained an inspection or a citation.", details)
        self.assertIn("checksum flicker", details)
        self.assertIn("These notes wait until Sunday.", details)

    def test_a_new_inspection_is_named(self) -> None:
        """The note names a real new visit, and a sent family note is counted."""
        summary, details = format_scan_note(
            _scan(
                status="completed",
                inspections_after=18049,
                real_findings=["Ivy Park at San Ramon: inspection record changed (+1 inspections, +0 citations)"],
                other_changes=0,
                facility_sent=1,
                data_check="passed",
                watched=[
                    {
                        "name": "Ivy Park at San Ramon — San Ramon",
                        "opened": True,
                        "finding": "+1 inspections, +0 citations",
                    }
                ],
            )
        )
        self.assertEqual(summary, "CA completed — inspections +1, 1 family email")
        self.assertIn("Ivy Park at San Ramon: inspection record changed (+1 inspections, +0 citations)", details)
        self.assertIn("1 facility note(s) sent", details)
        self.assertNotIn("checksum flicker", details)
        self.assertNotIn("wait until Sunday", details)

    def test_a_failed_data_check_says_no_family_mail_went_out(self) -> None:
        """The operator note must not imply families were emailed when the data check stopped it."""
        self.assertIn(
            "No subscriber alerts were sent.",
            family_mail_line(
                facility_sent=0,
                facility_failed=0,
                area_sent=0,
                area_failed=0,
                data_check="failed",
            ),
        )

    def test_a_job_that_wrote_no_scan_still_sends_a_note(self) -> None:
        """Silence is the failure mode this note exists to end."""
        summary, details = format_missing_note("CA", "not-sunday")
        self.assertIn("did not record a run", summary)
        self.assertIn("nothing was checked", details)
        self.assertEqual(inbox_line("MN", "completed", 3, 0), "MN completed — inspections +3, 0 family emails")

    def test_sunday_and_github_results_use_the_same_words(self) -> None:
        """The Mac job and the GitHub job have to describe the data check the same way."""
        self.assertEqual(
            data_check_from_sunday_output(
                "California alerts are held until Sunday. No subscriber alerts were sent.\n"
            ),
            "not-sunday",
        )
        self.assertEqual(
            data_check_from_sunday_output("California data check failed. No subscriber alerts were sent.\n"),
            "failed",
        )
        self.assertEqual(
            data_check_from_sunday_output("California Sunday check: running the data check before any mail.\n"),
            "passed",
        )
        self.assertEqual(data_check_from_outcome("success"), "passed")
        self.assertEqual(data_check_from_outcome("failure"), "failed")
        self.assertEqual(data_check_from_outcome("skipped"), "not-run")

    def test_a_placeholder_loops_key_does_not_count_as_configured(self) -> None:
        """The morning job must not call Loops with the short placeholder in the local env file."""
        with patch.dict(
            os.environ,
            {
                "LOOPS_API_KEY": "not-a-key",
                "LOOPS_ADMIN_ALERT_ID": "a" * 20,
                "ADMIN_ALERT_EMAIL": "ops@example.com",
            },
        ):
            self.assertFalse(operator_mail_is_configured())
        with patch.dict(
            os.environ,
            {
                "LOOPS_API_KEY": "a" * 20,
                "LOOPS_ADMIN_ALERT_ID": "b" * 20,
                "ADMIN_ALERT_EMAIL": "ops@example.com",
            },
        ):
            self.assertTrue(operator_mail_is_configured())

    def test_ned_is_not_the_operator_recipient(self) -> None:
        """The operator note uses the configured address, and Ned stays off every send."""
        with patch.dict(
            os.environ,
            {
                "ADMIN_ALERT_EMAIL": "nedberke@gmail.com",
                "LOOPS_API_KEY": "test",
                "LOOPS_ADMIN_ALERT_ID": "test",
            },
        ):
            with patch("_watch_alert._send_transactional") as send:
                with self.assertRaises(RuntimeError):
                    send_operator_scan_report(summary="CA partial", details="none", admin_url="https://example.com")
                send.assert_not_called()


if __name__ == "__main__":
    unittest.main()
