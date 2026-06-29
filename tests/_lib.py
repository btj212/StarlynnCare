"""Shared test utilities for StarlynnCare integration + E2E tests.

Re-exports the existing check/get_conn/run_all_checks helpers from
scripts/validate/_lib.py and adds HTTP + state constants used across
the test suite.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from validate._lib import check, get_conn, run_all_checks, fetch_page  # noqa: E402

PRODUCTION_URL = "https://www.starlynncare.com"

# All states in COVERED_STATES (from src/lib/states.ts) — (code, slug) pairs
COVERED_STATES: list[tuple[str, str]] = [
    ("CA", "california"),
    ("OR", "oregon"),
    ("WA", "washington"),
    ("MN", "minnesota"),
    ("TX", "texas"),
    ("UT", "utah"),
    ("IL", "illinois"),
    ("PA", "pennsylvania"),
    ("AZ", "arizona"),
    ("MO", "missouri"),
]

# Minimum publishable facility counts per state (conservative lower bounds).
# Update these if counts legitimately drop after a recompute.
MIN_PUBLISHABLE: dict[str, int] = {
    "CA": 800,
    "OR": 80,
    "WA": 100,
    "MN": 30,
    "TX": 30,
    "UT": 15,
    "IL": 30,
    "PA": 200,
    "AZ": 30,
    "MO": 5,
}

# Minimum inspection counts per state across all publishable facilities
MIN_INSPECTIONS: dict[str, int] = {
    "CA": 3000,
    "OR": 300,
    "WA": 200,
    "MN": 100,
    "TX": 50,
    "UT": 50,
    "IL": 50,
    "PA": 800,
    "AZ": 50,
    "MO": 0,   # MO inspections may not be fully ingested yet
}

# Minimum deficiency counts per state
MIN_DEFICIENCIES: dict[str, int] = {
    "CA": 5000,
    "OR": 500,
    "WA": 200,
    "MN": 100,
    "TX": 50,
    "UT": 50,
    "IL": 50,
    "PA": 3000,
    "AZ": 100,
    "MO": 0,
}

BOT_UA = "StarlynnCare-TestBot/1.0 (+https://starlynn.care)"

HTTP_TIMEOUT = 30


def make_session() -> Any:
    """Return a requests.Session with the standard bot User-Agent."""
    import requests  # noqa: PLC0415
    s = requests.Session()
    s.headers.update({
        "User-Agent": BOT_UA,
        "Accept": "application/json, text/csv, application/vnd.ms-excel, */*",
    })
    return s


def assert_keys(label: str, obj: dict[str, Any], required_keys: list[str]) -> None:
    """Check that every key in required_keys is present in obj (not necessarily non-null)."""
    for k in required_keys:
        check(f"{label}: field '{k}' present", k in obj, f"missing from response keys: {list(obj.keys())[:10]}")


def assert_nonempty_string(label: str, value: Any, field: str) -> None:
    """Check that value is a non-empty string."""
    check(
        f"{label}: '{field}' is non-empty string",
        isinstance(value, str) and len(value.strip()) > 0,
        f"got {type(value).__name__}={value!r}",
    )
