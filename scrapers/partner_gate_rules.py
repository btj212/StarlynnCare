"""Verified Partner gate contract.

The numbers here are the same numbers in supabase/migrations/0071_verified_partners.sql.
The SQL function is what production runs. This module is the checked copy, and the
nightly job uses next_partner_state so a failed gate pauses billing without treating
a stale price as a billing event.
"""

from __future__ import annotations

ENTER_PERCENTILE = 50
RETAIN_PERCENTILE = 40
MIN_PEERS = 10
SEVERITY_4_MONTHS = 24
SEVERITY_3_MONTHS = 12
INSPECTION_MONTHS = 36
MAX_SEVERITY_3 = 1
ACTIVE_LICENSE = "LICENSED"
OPEN_ENFORCEMENT_TIER = 1
FOUNDING_CAP = 20
PROFILE_FRESH_DAYS = 30
RETAINED_STATUSES = ("active", "paused", "past_due")


def prices_are_fresh(age_days: int | None) -> bool:
    """A missing confirmation hides prices. It does not pause the subscription."""
    if age_days is None:
        return False
    return age_days <= PROFILE_FRESH_DAYS


def gate_passes(
    *,
    retained: bool,
    letter: str | None,
    composite: int | None,
    peers: int,
    severity_4: int,
    severity_3: int,
    license_status: str | None,
    license_expired: bool,
    enforcement_tier: int | None,
    inspection_within_36_months: bool,
) -> dict:
    required = RETAIN_PERCENTILE if retained else ENTER_PERCENTILE
    grade_ok = (
        letter is not None
        and composite is not None
        and peers >= MIN_PEERS
        and composite >= required
    )
    severity_4_ok = severity_4 == 0
    severity_3_ok = severity_3 <= MAX_SEVERITY_3
    if license_status != ACTIVE_LICENSE:
        license_ok = False
    elif license_expired:
        license_ok = False
    elif enforcement_tier == OPEN_ENFORCEMENT_TIER:
        license_ok = False
    else:
        license_ok = True
    current_ok = inspection_within_36_months and letter is not None and peers >= MIN_PEERS
    return {
        "pass": grade_ok and severity_4_ok and severity_3_ok and license_ok and current_ok,
        "rules": {
            "grade": grade_ok,
            "severity_4": severity_4_ok,
            "severity_3": severity_3_ok,
            "license": license_ok,
            "current_record": current_ok,
        },
    }


def next_partner_state(
    *,
    gate_pass: bool,
    status: str,
    pause_reason: str | None,
    collection_paused: bool,
) -> dict:
    """Nightly billing decision. Manual pause is never cleared here."""
    if status not in RETAINED_STATUSES:
        return {"change": False, "stripe": None}
    if not gate_pass:
        if pause_reason == "manual":
            return {"change": False, "stripe": None}
        needs_pause = status != "paused" or pause_reason != "gate" or not collection_paused
        return {
            "change": needs_pause,
            "status": "paused",
            "pause_reason": "gate",
            "collection_paused": True,
            "stripe": "pause" if not collection_paused else None,
        }
    if pause_reason == "manual" or status == "past_due":
        return {"change": False, "stripe": None}
    if status == "paused" and pause_reason == "gate":
        return {
            "change": True,
            "status": "active",
            "pause_reason": None,
            "collection_paused": False,
            "stripe": "resume" if collection_paused else None,
        }
    if status == "active" and collection_paused:
        return {
            "change": True,
            "status": "active",
            "pause_reason": None,
            "collection_paused": False,
            "stripe": "resume",
        }
    return {"change": False, "stripe": None}
