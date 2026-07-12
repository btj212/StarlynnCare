#!/usr/bin/env python3
"""Create and publish State Watch transactional templates through the Loops API."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = "https://app.loops.so/api/v1"

TEMPLATES = {
    "State Watch · Area update": {
        "env": "LOOPS_AREA_WATCH_CHANGE_ID",
        "subject": "{data.areaName} public-record update",
        "preview": "{data.summary}",
        "lmx": """
<Style backgroundColor="#f4f0e8" bodyColor="#ffffff" bodyXPadding="28" bodyYPadding="28" bodyFontFamily="Lora" bodyFontCategory="serif" buttonBodyColor="#276f68" buttonTextColor="#ffffff" buttonBorderRadius="0" />
<Paragraph fontSize="12" textColor="#5e6b64">STARLYNNCARE · AREA WATCH</Paragraph>
<H1>An update for {data.areaName}</H1>
<Paragraph fontSize="18" lineHeight="150">{data.summary}</Paragraph>
<Section blockColor="#f8f6f0" paddingTop="18" paddingBottom="18">
  <Paragraph lineHeight="160">{data.details}</Paragraph>
</Section>
<Button href="{data.areaUrl}" align="left">Review the public records</Button>
<Divider />
<Paragraph fontSize="12" textColor="#69756f">We send updates only after every configured source completes successfully. <Link href="{data.unsubscribeUrl}">Stop watching this area</Link>.</Paragraph>
""".strip(),
    },
    "State Watch · Facility update": {
        "env": "LOOPS_WATCH_CHANGE_ID",
        "subject": "{data.facilityName} public-record update",
        "preview": "{data.summary}",
        "lmx": """
<Style backgroundColor="#f4f0e8" bodyColor="#ffffff" bodyXPadding="28" bodyYPadding="28" bodyFontFamily="Lora" bodyFontCategory="serif" buttonBodyColor="#276f68" buttonTextColor="#ffffff" buttonBorderRadius="0" />
<Paragraph fontSize="12" textColor="#5e6b64">STARLYNNCARE · FACILITY WATCH</Paragraph>
<H1>A record changed for {data.facilityName}</H1>
<Paragraph fontSize="18" lineHeight="150">{data.summary}</Paragraph>
<Section blockColor="#f8f6f0" paddingTop="18" paddingBottom="18">
  <Paragraph lineHeight="160">{data.details}</Paragraph>
</Section>
<Button href="{data.facilityUrl}" align="left">Review this facility</Button>
<Divider />
<Paragraph fontSize="12" textColor="#69756f">This alert reflects a completed regulator-source scan. <Link href="{data.unsubscribeUrl}">Stop watching this facility</Link>.</Paragraph>
""".strip(),
    },
}


def _request(
    method: str,
    path: str,
    api_key: str,
    *,
    json_body: dict[str, Any] | None = None,
) -> Any:
    response = requests.request(
        method,
        f"{API_ROOT}{path}",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=json_body,
        timeout=30,
    )
    if not response.ok:
        raise RuntimeError(f"Loops {method} {path} failed ({response.status_code}): {response.text}")
    return response.json() if response.content else {}


def _existing_templates(api_key: str) -> dict[str, dict[str, Any]]:
    payload = _request("GET", "/transactional-emails", api_key)
    rows = payload.get("data", payload) if isinstance(payload, dict) else payload
    return {row["name"]: row for row in rows}


def ensure_template(api_key: str, name: str, config: dict[str, str]) -> str:
    existing = _existing_templates(api_key).get(name)
    if existing:
        transactional_id = existing["id"]
        draft = _request(
            "POST",
            f"/transactional-emails/{transactional_id}/draft",
            api_key,
        )
    else:
        draft = _request(
            "POST",
            "/transactional-emails",
            api_key,
            json_body={"name": name},
        )
        transactional_id = draft["id"]

    message_id = draft["draftEmailMessageId"]
    revision_id = draft["draftEmailMessageContentRevisionId"]
    _request(
        "POST",
        f"/email-messages/{message_id}",
        api_key,
        json_body={
            "expectedRevisionId": revision_id,
            "subject": config["subject"],
            "previewText": config["preview"],
            "fromName": "StarlynnCare",
            "fromEmail": "blake",
            "lmx": config["lmx"],
        },
    )
    _request(
        "POST",
        f"/transactional-emails/{transactional_id}/publish",
        api_key,
    )
    return transactional_id


def main() -> int:
    parser = argparse.ArgumentParser(description="Create State Watch Loops templates")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    load_dotenv(REPO_ROOT / ".env.local")
    api_key = os.environ.get("LOOPS_API_KEY", "")
    if not api_key:
        raise RuntimeError("LOOPS_API_KEY not set")
    if not args.apply:
        print("Dry run: pass --apply to create and publish the templates.")
        for name, config in TEMPLATES.items():
            print(f"  {name} → {config['env']}")
        return 0

    for name, config in TEMPLATES.items():
        transactional_id = ensure_template(api_key, name, config)
        print(f"{config['env']}={transactional_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
