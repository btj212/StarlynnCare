#!/usr/bin/env python3
"""Intent tests for State Watch material-change and delivery deduplication."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from dispatch_watch_alerts import _delivery_fingerprint, scan_is_dispatchable  # noqa: E402
from state_watch_ledger import _delta_summary, fingerprint, is_family_facing_delta  # noqa: E402


class StateWatchAutomationTests(unittest.TestCase):
    def test_fingerprint_ignores_dictionary_key_order(self) -> None:
        """Equivalent regulator payloads must not generate duplicate alerts."""
        first = {"license": "123", "record": {"count": 2, "latest": "2026-07-01"}}
        second = {"record": {"latest": "2026-07-01", "count": 2}, "license": "123"}
        self.assertEqual(fingerprint(first), fingerprint(second))

    def test_record_change_has_family_facing_summary(self) -> None:
        """A new citation must be classified as an inspection-record change."""
        before = {
            "name": "Example Care",
            "city": "Seattle",
            "inspection_count": 2,
            "deficiency_count": 3,
            "record_fingerprint": "old",
        }
        after = {
            "name": "Example Care",
            "city": "Seattle",
            "inspection_count": 3,
            "deficiency_count": 5,
            "record_fingerprint": "new",
        }
        change_type, summary = _delta_summary(before, after)
        self.assertEqual(change_type, "inspection_record_changed")
        self.assertIn("+1 inspections", summary)
        self.assertIn("+2 citations", summary)

    def test_delivery_fingerprint_is_order_independent(self) -> None:
        """The same scan changes can only produce one subscriber delivery."""
        first = _delivery_fingerprint("area:watcher", ["change-b", "change-a"])
        second = _delivery_fingerprint("area:watcher", ["change-a", "change-b"])
        self.assertEqual(first, second)

    def test_no_change_delivery_is_scoped_to_scan(self) -> None:
        """A requested verified-no-change note is sendable once per scan."""
        first = _delivery_fingerprint("area:watcher", ["run-1:verified-no-change"])
        second = _delivery_fingerprint("area:watcher", ["run-2:verified-no-change"])
        self.assertNotEqual(first, second)

    def test_partial_or_failed_scan_never_dispatches(self) -> None:
        """A source failure must suppress every family-facing alert."""
        self.assertTrue(scan_is_dispatchable("completed"))
        self.assertFalse(scan_is_dispatchable("partial"))
        self.assertFalse(scan_is_dispatchable("failed"))
        self.assertFalse(scan_is_dispatchable("running"))

    def test_non_publishable_directory_churn_does_not_alert_families(self) -> None:
        """Roster changes outside the public memory-care directory are operational only."""
        self.assertFalse(is_family_facing_delta(None, {"publishable": False}))
        self.assertFalse(
            is_family_facing_delta(
                {"publishable": False},
                {"publishable": False},
            )
        )
        self.assertTrue(
            is_family_facing_delta(
                {"publishable": True},
                {"publishable": False},
            )
        )


if __name__ == "__main__":
    unittest.main()
