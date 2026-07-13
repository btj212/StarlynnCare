#!/usr/bin/env python3
"""Send an operational alert when a scheduled state scan fails."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRAPERS_DIR = REPO_ROOT / "scrapers"
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _watch_alert import send_scan_failure_alert  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Notify admin of a failed state scan")
    parser.add_argument("--state", required=True)
    parser.add_argument("--workflow-url", required=True)
    args = parser.parse_args()

    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            break

    try:
        send_scan_failure_alert(
            state_code=args.state,
            details="The scheduled source scan or its validation step failed. No subscriber alerts were sent.",
            workflow_url=args.workflow_url,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"Could not send scan failure alert: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
