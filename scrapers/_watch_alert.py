"""
Loops transactional email helpers for Facility Watch change alerts.
"""

from __future__ import annotations

import os

import requests


def _loops_config(template_env: str) -> tuple[str, str] | None:
    api_key = os.environ.get("LOOPS_API_KEY", "").strip()
    template_id = os.environ.get(template_env, "").strip()
    if not api_key or not template_id:
        return None
    return api_key, template_id


def _send_transactional(
    *,
    to: str,
    template_env: str,
    data_variables: dict[str, str],
) -> None:
    cfg = _loops_config(template_env)
    if not cfg:
        raise RuntimeError(f"LOOPS_API_KEY and {template_env} must be set")
    api_key, template_id = cfg
    res = requests.post(
        "https://app.loops.so/api/v1/transactional",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        json={
            "email": to,
            "transactionalId": template_id,
            "dataVariables": data_variables,
        },
        timeout=30,
    )
    if not res.ok:
        raise RuntimeError(f"Loops API error {res.status_code}: {res.text}")


def send_watch_change_alert(
    *,
    to: str,
    facility_name: str,
    facility_url: str,
    summary: str,
    details: str,
    detected_at: str,
    unsubscribe_url: str = "",
) -> None:
    _send_transactional(
        to=to,
        template_env="LOOPS_WATCH_CHANGE_ID",
        data_variables={
            "submissionType": "Facility Watch Change",
            "email": to,
            "summary": f"{facility_name} — {summary}",
            "details": details[:800] if len(details) > 800 else details,
            "submittedAt": detected_at,
            "adminUrl": facility_url,
            "facilityName": facility_name,
            "facilityUrl": facility_url,
            "unsubscribeUrl": unsubscribe_url,
        },
    )


def send_area_change_alert(
    *,
    to: str,
    area_name: str,
    area_url: str,
    summary: str,
    details: str,
    unsubscribe_url: str,
) -> None:
    _send_transactional(
        to=to,
        template_env="LOOPS_AREA_WATCH_CHANGE_ID",
        data_variables={
            "areaName": area_name,
            "summary": summary,
            "details": details[:2000],
            "areaUrl": area_url,
            "unsubscribeUrl": unsubscribe_url,
        },
    )


def send_scan_failure_alert(*, state_code: str, details: str, workflow_url: str) -> None:
    admin_email = os.environ.get("ADMIN_ALERT_EMAIL", "").strip()
    if not admin_email:
        raise RuntimeError("ADMIN_ALERT_EMAIL must be set")
    _send_transactional(
        to=admin_email,
        template_env="LOOPS_ADMIN_ALERT_ID",
        data_variables={
            "submissionType": "State Source Scan Failure",
            "email": admin_email,
            "summary": f"{state_code} source scan failed",
            "details": details[:2000],
            "submittedAt": "",
            "adminUrl": workflow_url,
        },
    )
