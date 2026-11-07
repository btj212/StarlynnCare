#!/usr/bin/env python3
"""California mail waits for Sunday. A watched home does not wait for every other home."""

from __future__ import annotations

import sys
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from ca_sunday_alerts import (  # noqa: E402
    held_scan_is_sendable,
    pacific_is_sunday,
    parse_sent_counts,
    window_start,
)

PACIFIC = ZoneInfo("America/Los_Angeles")


class CaliforniaSundayAlertTests(unittest.TestCase):
    def test_a_watched_home_can_email_from_a_partial_sunday_scan(self) -> None:
        """Another home failing does not drop the note for a home that was checked."""
        self.assertTrue(
            held_scan_is_sendable(
                status="completed",
                already_sent=False,
                layer5_passed=True,
                is_sunday=True,
            )
        )
        self.assertTrue(
            held_scan_is_sendable(
                status="partial",
                already_sent=False,
                layer5_passed=True,
                is_sunday=True,
            )
        )
        for status in ("failed", "running"):
            self.assertFalse(
                held_scan_is_sendable(
                    status=status,
                    already_sent=False,
                    layer5_passed=True,
                    is_sunday=True,
                )
            )
        self.assertFalse(
            held_scan_is_sendable(
                status="completed",
                already_sent=False,
                layer5_passed=True,
                is_sunday=False,
            )
        )
        self.assertFalse(
            held_scan_is_sendable(
                status="completed",
                already_sent=False,
                layer5_passed=False,
                is_sunday=True,
            )
        )
        self.assertFalse(
            held_scan_is_sendable(
                status="completed",
                already_sent=True,
                layer5_passed=True,
                is_sunday=True,
            )
        )

    def test_sunday_is_pacific_not_utc(self) -> None:
        """A Monday morning in California is still Sunday in UTC and must not send."""
        sunday_evening = datetime(2026, 10, 25, 22, 13, tzinfo=PACIFIC)
        monday_morning = datetime(2026, 10, 26, 6, 15, tzinfo=PACIFIC)
        self.assertTrue(pacific_is_sunday(sunday_evening))
        self.assertFalse(pacific_is_sunday(monday_morning))
        with self.assertRaises(ValueError):
            pacific_is_sunday(datetime(2026, 10, 25, 22, 13))

    def test_the_hold_window_is_one_week(self) -> None:
        """Notes older than this week are not swept into the Sunday send."""
        moment = datetime(2026, 10, 25, 6, 15, tzinfo=PACIFIC)
        self.assertEqual(window_start(moment), datetime(2026, 10, 17, 0, 0, tzinfo=PACIFIC))

    def test_send_goes_to_every_matching_watcher(self) -> None:
        """There is no one-recipient proof. Sunday --send is the send."""
        script = (SCRIPTS_DIR / "ca_sunday_alerts.py").read_text()
        self.assertNotIn("may_email_every_watcher", script)
        self.assertNotIn("ca-sunday-alerts-proven", script)
        self.assertIn("dry_run = not args.send", script)

    def test_a_failed_send_is_not_counted_as_mail_that_went_out(self) -> None:
        """The summary is how a Sunday run knows whether the dispatch actually sent."""
        self.assertEqual(
            parse_sent_counts("Alerts: area sent=1, facility sent=0, failed=0\n"),
            (1, 0, 0),
        )
        self.assertEqual(parse_sent_counts("Finished California scans waiting: 0\n"), (0, 0, 0))

    def test_the_morning_job_checks_sunday_without_emailing_from_the_crawl(self) -> None:
        """The crawl command stays the same. Sunday mail is a later step."""
        script = (SCRIPTS_DIR / "run_ca_watch_local.sh").read_text()
        self.assertIn('"--state"', script)
        self.assertIn('"CA"', script)
        self.assertIn('"--skip-validate"', script)
        self.assertIn("scripts/ca_sunday_alerts.py", script)
        self.assertIn('"--send"', script)
        self.assertNotIn("dispatch_watch_alerts.py", script)
        workflow = (
            SCRIPTS_DIR.parent / ".github/workflows/weekly-inspection-ingest.yml"
        ).read_text()
        matrix = workflow.split("matrix:", 1)[1].split("steps:", 1)[0]
        self.assertNotIn("CA", matrix)


if __name__ == "__main__":
    unittest.main()
