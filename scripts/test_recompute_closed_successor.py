#!/usr/bin/env python3
"""CLOSED rows that name a successor keep their current publishable flag.

Built on the PR 271 mirror: Arizona still stays published when Directed Care
is cleared, and a closed license with no successor note still comes down.
Other states keep that same closed-license rule. The note is the only hold.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scrapers.recompute_publishable import (  # noqa: E402
    CLOSED_SUCCESSOR_HOLD_SQL,
    hold_closed_successor,
    publishable_from_signals,
    successor_row_id,
)

SUCCESSOR = "6d3d6d03-a395-4ad4-bdf0-dc7ff28cb55f"
OLD_NOTE = (
    "AZ Care Check 2026-11-27: license AL10538H closed. "
    "New licensed home here: SAKINA ASSISTED LIVING CARE LLC (ALH20408) = "
    f"StarlynnCare row {SUCCESSOR} (unpublished)."
)
NEW_NOTE = (
    "AZ Care Check 2026-11-27: Active, license ALH20408. "
    "New licensed home at the address of previous StarlynnCare row(s): "
    "6ab04d04-c1fc-4baa-beec-c8e8678eaf4f (AEGIS AT HOMESTEAD ASSISTED LIVING HOME, AL10538H); "
    "2fa7048e-bdd6-4782-965f-2a79fe9cd526 (JANNAH ASSISTED LIVING, LLC, AL13342H)"
)


def test_parser_reads_the_old_row_and_not_the_new_row() -> None:
    assert successor_row_id(OLD_NOTE) == SUCCESSOR
    assert successor_row_id(NEW_NOTE) is None
    assert successor_row_id("Closed, Change of Ownership") is None
    assert hold_closed_successor("CLOSED", OLD_NOTE) is True
    assert hold_closed_successor("closed", OLD_NOTE) is True
    assert hold_closed_successor("LICENSED", OLD_NOTE) is False
    assert hold_closed_successor("CLOSED", NEW_NOTE) is False
    assert hold_closed_successor("CLOSED", "Closed, Change of Ownership") is False


def test_closed_successor_row_keeps_publishable() -> None:
    """The 47 Arizona closed rows are still publishable. Recompute must not flip them."""
    assert publishable_from_signals(
        state_code="AZ",
        license_status="CLOSED",
        serves_memory_care=False,
        publishable=True,
        mc_review_status="auto_published",
        fresh=False,
        license_status_detail=OLD_NOTE,
    ) is True
    assert publishable_from_signals(
        state_code="AZ",
        license_status="CLOSED",
        serves_memory_care=True,
        publishable=False,
        mc_review_status="auto_published",
        fresh=True,
        license_status_detail=OLD_NOTE,
    ) is False


def test_closed_without_the_note_still_unpublishes() -> None:
    assert publishable_from_signals(
        state_code="AZ",
        license_status="CLOSED",
        serves_memory_care=False,
        publishable=True,
        mc_review_status="auto_published",
        fresh=True,
    ) is False


def test_arizona_directed_care_loss_still_keeps_a_licensed_home() -> None:
    assert publishable_from_signals(
        state_code="AZ",
        license_status="LICENSED",
        serves_memory_care=False,
        publishable=True,
        mc_review_status="auto_published",
        fresh=True,
    ) is True


def test_non_az_without_a_successor_note_is_unchanged() -> None:
    assert publishable_from_signals(
        state_code="CA",
        license_status="CLOSED",
        serves_memory_care=True,
        publishable=True,
        mc_review_status="auto_published",
        fresh=True,
        license_status_detail="Closed, Change of Ownership",
    ) is False
    assert publishable_from_signals(
        state_code="OR",
        license_status="LICENSED",
        serves_memory_care=True,
        publishable=True,
        mc_review_status="auto_published",
        fresh=True,
    ) is True
    assert publishable_from_signals(
        state_code="WA",
        license_status="LICENSED",
        serves_memory_care=False,
        publishable=True,
        mc_review_status="auto_published",
        fresh=True,
    ) is True


def test_sql_holds_the_row_out_of_the_update() -> None:
    source = (ROOT / "scrapers" / "recompute_publishable.py").read_text()
    assert "AND NOT ({CLOSED_SUCCESSOR_HOLD_SQL})" in source
    assert "WHEN {CLOSED_SUCCESSOR_HOLD_SQL} THEN publishable" in source
    assert "StarlynnCare row [0-9a-fA-F]" in CLOSED_SUCCESSOR_HOLD_SQL
    assert "previous StarlynnCare row" not in CLOSED_SUCCESSOR_HOLD_SQL
    assert "OR (state_code = 'AZ' AND publishable = true)" in source
    assert "publishable left as-is" in source


if __name__ == "__main__":
    test_parser_reads_the_old_row_and_not_the_new_row()
    test_closed_successor_row_keeps_publishable()
    test_closed_without_the_note_still_unpublishes()
    test_arizona_directed_care_loss_still_keeps_a_licensed_home()
    test_non_az_without_a_successor_note_is_unchanged()
    test_sql_holds_the_row_out_of_the_update()
    print("test_recompute_closed_successor: ok")
