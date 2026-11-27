#!/usr/bin/env python3
"""Arizona keeps publishable when Directed Care is cleared.

Publishing is Blake's call. Losing serves_memory_care must not take an
Arizona home down. A closed license still does. California, Oregon, and
Texas keep the old rule: serves_memory_care false unpublishes. Washington
already stayed listed, and that stay is unchanged.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scrapers.recompute_publishable import (  # noqa: E402
    SERVES_MEMORY_CARE_EXPR,
    publishable_from_signals,
)

SOURCE = (ROOT / "scrapers" / "recompute_publishable.py").read_text()


def test_arizona_loss_does_not_unpublish() -> None:
    assert publishable_from_signals(
        state_code="AZ",
        license_status="LICENSED",
        serves_memory_care=False,
        publishable=True,
        mc_review_status="auto_published",
        fresh=True,
    ) is True


def test_arizona_closed_still_unpublishes() -> None:
    assert publishable_from_signals(
        state_code="AZ",
        license_status="CLOSED",
        serves_memory_care=False,
        publishable=True,
        mc_review_status="auto_published",
        fresh=True,
    ) is False


def test_arizona_stale_or_rejected_still_unpublishes() -> None:
    assert publishable_from_signals(
        state_code="AZ",
        license_status="LICENSED",
        serves_memory_care=False,
        publishable=True,
        mc_review_status="auto_published",
        fresh=False,
    ) is False
    assert publishable_from_signals(
        state_code="AZ",
        license_status="LICENSED",
        serves_memory_care=True,
        publishable=True,
        mc_review_status="reviewed_reject",
        fresh=True,
    ) is False


def test_arizona_does_not_newly_publish() -> None:
    assert publishable_from_signals(
        state_code="AZ",
        license_status="LICENSED",
        serves_memory_care=False,
        publishable=False,
        mc_review_status="auto_published",
        fresh=True,
    ) is False


def test_other_states_still_unpublish_without_memory_care() -> None:
    for state in ("CA", "OR", "TX", "CO", "PA", "IL", "MN", "MO", "UT"):
        assert publishable_from_signals(
            state_code=state,
            license_status="LICENSED",
            serves_memory_care=False,
            publishable=True,
            mc_review_status="auto_published",
            fresh=True,
        ) is False, state
        assert publishable_from_signals(
            state_code=state,
            license_status="LICENSED",
            serves_memory_care=True,
            publishable=True,
            mc_review_status="auto_published",
            fresh=True,
        ) is True, state


def test_washington_keep_is_unchanged() -> None:
    assert publishable_from_signals(
        state_code="WA",
        license_status="LICENSED",
        serves_memory_care=False,
        publishable=True,
        mc_review_status="auto_published",
        fresh=True,
    ) is True


def test_sql_keeps_only_wa_and_az() -> None:
    assert "OR (state_code = 'AZ' AND publishable = true)" in SOURCE
    assert "OR (state_code = 'WA' AND publishable = true)" in SOURCE
    for state in ("CA", "OR", "TX", "CO", "PA", "IL", "MN", "MO", "UT"):
        assert f"state_code = '{state}' AND publishable = true" not in SOURCE
    assert "publishable IS DISTINCT FROM" in SOURCE
    assert "publishable unchanged" in SOURCE
    assert "az_license_level = 'Directed Care'" in SERVES_MEMORY_CARE_EXPR


if __name__ == "__main__":
    test_arizona_loss_does_not_unpublish()
    test_arizona_closed_still_unpublishes()
    test_arizona_stale_or_rejected_still_unpublishes()
    test_arizona_does_not_newly_publish()
    test_other_states_still_unpublish_without_memory_care()
    test_washington_keep_is_unchanged()
    test_sql_keeps_only_wa_and_az()
    print("test_recompute_az_publishable: ok")
