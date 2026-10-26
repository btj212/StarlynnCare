#!/usr/bin/env python3
"""Intent tests for State Watch material-change and delivery deduplication."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from dispatch_watch_alerts import (  # noqa: E402
    _delivery_fingerprint,
    family_alerts_allowed,
    scan_is_dispatchable,
)
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

    def test_visit_with_no_new_citation_still_alerts(self) -> None:
        """A visit that adds no citation is the watch email, not silence."""
        before = {
            "name": "Example Care",
            "city": "Seattle",
            "inspection_count": 2,
            "deficiency_count": 4,
            "record_fingerprint": "old",
        }
        after = {
            "name": "Example Care",
            "city": "Seattle",
            "inspection_count": 3,
            "deficiency_count": 4,
            "record_fingerprint": "new",
        }
        change_type, summary = _delta_summary(before, after)
        self.assertEqual(change_type, "inspection_record_changed")
        self.assertIn("+1 inspections", summary)
        self.assertIn("+0 citations", summary)

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

    def test_only_a_passed_sunday_scan_emails_families(self) -> None:
        """A weeknight push, a failed check, or an unchecked manual run stays silent."""
        passed = dict(
            ingest_outcome="success",
            layer5_outcome="success",
            skipped=False,
        )
        self.assertTrue(
            family_alerts_allowed(event_name="schedule", dispatch_alerts=False, **passed)
        )
        self.assertFalse(
            family_alerts_allowed(
                event_name="schedule",
                dispatch_alerts=False,
                ingest_outcome="success",
                layer5_outcome="failure",
                skipped=False,
            )
        )
        self.assertFalse(
            family_alerts_allowed(
                event_name="schedule",
                dispatch_alerts=False,
                ingest_outcome="failure",
                layer5_outcome="skipped",
                skipped=False,
            )
        )
        self.assertFalse(
            family_alerts_allowed(event_name="schedule", dispatch_alerts=False, **{**passed, "skipped": True})
        )
        self.assertFalse(
            family_alerts_allowed(event_name="push", dispatch_alerts=False, **passed)
        )
        self.assertFalse(
            family_alerts_allowed(
                event_name="workflow_dispatch", dispatch_alerts=False, **passed
            )
        )
        self.assertTrue(
            family_alerts_allowed(
                event_name="workflow_dispatch", dispatch_alerts=True, **passed
            )
        )
        self.assertFalse(
            family_alerts_allowed(
                event_name="workflow_dispatch",
                dispatch_alerts=True,
                ingest_outcome="success",
                layer5_outcome="failure",
                skipped=False,
            )
        )

    def test_workflow_matches_the_sunday_alert_gate(self) -> None:
        """The GitHub job, not just this helper, is what actually sends mail."""
        workflow = (
            Path(__file__).resolve().parents[1] / ".github/workflows/weekly-inspection-ingest.yml"
        ).read_text()
        trigger, _, _rest = workflow.partition("\njobs:")
        self.assertNotIn("\n  push:", trigger)
        self.assertIn('cron: "0 8 * * 0"', trigger)
        self.assertIn("California is not in this workflow.", trigger)
        self.assertNotIn("CA,", workflow.split("matrix:", 1)[1].split("steps:", 1)[0])
        self.assertIn(
            "steps.ingest.outcome == 'success' "
            "&& steps.ingest.outputs.skip != 'true' "
            "&& steps.layer5.outcome == 'success' "
            "&& (github.event_name == 'schedule' || "
            "(github.event_name == 'workflow_dispatch' && inputs.dispatch_alerts))",
            workflow,
        )
        self.assertIn("No subscriber alerts were sent.", workflow)
        self.assertNotIn("Subscriber alerts still went out", workflow)

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
