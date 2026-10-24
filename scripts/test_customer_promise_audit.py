"""The audit must tell our misses apart from a family who has not sent the contract yet."""

from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.audit_customer_promises import (
    add_business_days,
    is_our_miss,
    should_open_follow_up,
)


def _utc(year: int, month: int, day: int) -> datetime:
    return datetime(year, month, day, tzinfo=timezone.utc)


class PromiseAuditTests(unittest.TestCase):
    def test_two_business_days_skips_the_weekend(self) -> None:
        # Friday 23 Oct 2026 plus two business days is Tuesday the 27th.
        self.assertEqual(
            add_business_days(_utc(2026, 10, 23), 2).date().isoformat(),
            "2026-10-27",
        )

    def test_contract_waiting_on_the_family_is_not_our_miss(self) -> None:
        now = _utc(2026, 10, 30)
        self.assertFalse(is_our_miss("open", "requested", _utc(2026, 10, 27), now))

    def test_file_in_hand_past_the_due_date_is_our_miss(self) -> None:
        now = _utc(2026, 10, 30)
        self.assertTrue(is_our_miss("open", "file_received", _utc(2026, 10, 27), now))

    def test_already_overdue_stays_visible(self) -> None:
        self.assertTrue(is_our_miss("overdue", "asset_pending", None, _utc(2026, 10, 30)))

    def test_follow_up_opens_once(self) -> None:
        now = _utc(2026, 10, 30)
        due = _utc(2026, 10, 29)
        self.assertTrue(should_open_follow_up("fulfilled", due, now, False))
        self.assertFalse(should_open_follow_up("fulfilled", due, now, True))
        self.assertFalse(should_open_follow_up("unsubscribed", due, now, False))


if __name__ == "__main__":
    unittest.main()
