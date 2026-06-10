"""
Loops transactional email helpers for Facility Watch change alerts.
"""

from __future__ import annotations

import os
from typing import Any

import requests


def _loops_config() -> tuple[str, str, str] | None:
    api_key = os.environ.get("LOOPS_API_KEY", "").strip()
    admin_email = os.environ.get("ADMIN_ALERT_EMAIL", "").strip()
    template_id = (
        os.environ.get("LOOPS_WATCH_CHANGE_ID", "").strip()
        or os.environ.get("LOOPS_ADMIN_ALERT_ID", "").strip()
    )
    if not api_key or not admin_email or not template_id:
        return None
    return api_key, template_id, admin_email


def send_watch_change_alert(
    *,
    to: str,
    facility_name: str,
    facility_url: str,
    summary: str,
    details: str,
    detected_at: str,
) -> None:
    cfg = _loops_config()
    if not cfg:
        raise RuntimeError(
            "LOOPS_API_KEY, ADMIN_ALERT_EMAIL, and LOOPS_WATCH_CHANGE_ID "
            "(or LOOPS_ADMIN_ALERT_ID) must be set"
        )
    api_key, template_id, _admin = cfg
    payload: dict[str, Any] = {
        "email": to,
        "transactionalId": template_id,
        "dataVariables": {
            "submissionType": "Facility Watch Change",
            "email": to,
            "summary": f"{facility_name} — {summary}",
            "details": details[:800] if len(details) > 800 else details,
            "submittedAt": detected_at,
            "adminUrl": facility_url,
            "facilityName": facility_name,
        },
    }
    res = requests.post(
        "https://app.loops.so/api/v1/transactional",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        json=payload,
        timeout=30,
    )
    if not res.ok:
        raise RuntimeError(f"Loops API error {res.status_code}: {res.text}")
