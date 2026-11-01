#!/usr/bin/env python3
"""The partner gate fails closed, and a stale price does not pause billing.

Families are told a fee cannot buy a grade. These checks pin the numbers that
promise uses: C to enter, C− to stay, no severe citation pattern, an active
license, and a current inspection. The nightly job may pause Stripe only when
that gate fails. A 30-day-old price hides the price, and leaves the subscription alone.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRAPERS = ROOT / "scrapers"
if str(SCRAPERS) not in sys.path:
    sys.path.insert(0, str(SCRAPERS))

from partner_gate_rules import (  # noqa: E402
    gate_passes,
    next_partner_state,
    prices_are_fresh,
)

SQL = (ROOT / "supabase" / "migrations" / "0071_verified_partners.sql").read_text()
LIFECYCLE = (ROOT / "src" / "lib" / "partners" / "lifecycle.ts").read_text()
CONSTANTS = (ROOT / "src" / "lib" / "partners" / "constants.ts").read_text()
NIGHTLY = (ROOT / "scrapers" / "partner_gate_nightly.py").read_text()


def base(**overrides):
    row = {
        "retained": False,
        "letter": "C",
        "composite": 50,
        "peers": 10,
        "severity_4": 0,
        "severity_3": 0,
        "license_status": "LICENSED",
        "license_expired": False,
        "enforcement_tier": None,
        "inspection_within_36_months": True,
    }
    row.update(overrides)
    return gate_passes(**row)


class PartnerGateRulesTest(unittest.TestCase):
    def test_sql_uses_the_same_thresholds_families_are_told(self):
        self.assertIn("then 40 else 50", SQL)
        self.assertIn("v_peers >= 10", SQL)
        self.assertIn("interval '24 months'", SQL)
        self.assertIn("interval '12 months'", SQL)
        self.assertIn("interval '36 months'", SQL)
        self.assertIn("license_status is distinct from 'LICENSED'", SQL)
        self.assertIn("f.tier = 1", SQL)
        self.assertIn("status in ('active', 'paused', 'past_due')", SQL)
        self.assertIn("v_count >= 20", SQL)
        self.assertNotIn("'stale'", SQL)

    def test_entry_is_the_top_half_and_retention_stops_at_c_minus(self):
        self.assertTrue(base()["pass"])
        self.assertFalse(base(composite=49)["pass"])
        self.assertFalse(base(composite=45, retained=False)["rules"]["grade"])
        self.assertTrue(base(composite=40, letter="C−", retained=True)["pass"])
        self.assertFalse(base(composite=39, letter="D", retained=True)["pass"])

    def test_a_public_grade_needs_ten_peers(self):
        result = base(peers=9)
        self.assertFalse(result["rules"]["grade"])
        self.assertFalse(result["rules"]["current_record"])

    def test_severity_limits_match_the_published_rules(self):
        self.assertFalse(base(severity_4=1)["rules"]["severity_4"])
        self.assertTrue(base(severity_3=1)["rules"]["severity_3"])
        self.assertFalse(base(severity_3=2)["rules"]["severity_3"])

    def test_license_fails_closed_when_the_state_file_is_not_an_active_license(self):
        self.assertFalse(base(license_status="PROBATIONARY")["rules"]["license"])
        self.assertFalse(base(license_status=None)["rules"]["license"])
        self.assertFalse(base(license_status="LICENSED", license_expired=True)["rules"]["license"])
        self.assertTrue(base(license_status="LICENSED", license_expired=False)["rules"]["license"])
        self.assertFalse(base(enforcement_tier=1)["rules"]["license"])
        self.assertTrue(base(enforcement_tier=2)["rules"]["license"])

    def test_an_old_inspection_is_not_a_current_record(self):
        self.assertFalse(base(inspection_within_36_months=False)["rules"]["current_record"])
        self.assertFalse(base(letter=None, composite=None)["pass"])

    def test_stale_prices_do_not_pause_billing(self):
        self.assertFalse(prices_are_fresh(None))
        self.assertFalse(prices_are_fresh(31))
        self.assertTrue(prices_are_fresh(30))
        failed = next_partner_state(
            gate_pass=False,
            status="active",
            pause_reason=None,
            collection_paused=False,
        )
        self.assertEqual(failed["stripe"], "pause")
        self.assertEqual(failed["pause_reason"], "gate")
        stayed = next_partner_state(
            gate_pass=True,
            status="active",
            pause_reason=None,
            collection_paused=False,
        )
        self.assertFalse(stayed["change"])

    def test_a_manual_pause_is_not_resumed_by_the_nightly_job(self):
        manual = next_partner_state(
            gate_pass=True,
            status="paused",
            pause_reason="manual",
            collection_paused=True,
        )
        self.assertFalse(manual["change"])
        resumed = next_partner_state(
            gate_pass=True,
            status="paused",
            pause_reason="gate",
            collection_paused=True,
        )
        self.assertEqual(resumed["status"], "active")
        self.assertEqual(resumed["stripe"], "resume")

    def test_past_due_is_not_forgiven_by_a_passing_gate(self):
        row = next_partner_state(
            gate_pass=True,
            status="past_due",
            pause_reason=None,
            collection_paused=False,
        )
        self.assertFalse(row["change"])

    def test_webhook_keeps_a_gate_pause_when_stripe_still_says_active(self):
        self.assertIn('existingPauseReason === "gate"', LIFECYCLE)
        self.assertIn("pauseCollection", LIFECYCLE)
        self.assertIn("status: \"paused\"", LIFECYCLE)

    def test_public_panel_requires_an_active_published_passing_partner(self):
        self.assertIn('input.status === "active"', CONSTANTS)
        self.assertIn("input.published", CONSTANTS)
        self.assertIn("input.gatePass", CONSTANTS)
        self.assertIn("input.facilityPublishable", CONSTANTS)
        self.assertIn("PROFILE_FRESH_DAYS = 30", CONSTANTS)

    def test_nightly_job_does_not_treat_a_stale_profile_as_a_billing_pause(self):
        self.assertNotIn("content_updated_at", NIGHTLY)
        self.assertIn("next_partner_state", NIGHTLY)
        self.assertIn("pause_collection[behavior]", NIGHTLY)


if __name__ == "__main__":
    unittest.main()
