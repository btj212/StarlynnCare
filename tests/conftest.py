"""
Shared fixtures for StarlynnCare integration tests.

All tests run against REAL services — no mocks, no fake data.

Required environment (load from .env.local or CI secrets):
  DATABASE_URL                       psycopg DSN for the Supabase Postgres DB
  NEXT_PUBLIC_SUPABASE_URL           Supabase project HTTPS URL (TypeScript path)
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  or NEXT_PUBLIC_SUPABASE_ANON_KEY
  SITE_BASE_URL                      defaults to https://www.starlynncare.com
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts" / "validate"))


def _load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.exists():
            try:
                from dotenv import load_dotenv
                load_dotenv(p, override=False)
            except ImportError:
                pass


_load_env()

# ---------------------------------------------------------------------------
# Global constants
# ---------------------------------------------------------------------------

PRODUCTION_URL = os.environ.get("SITE_BASE_URL", "https://www.starlynncare.com").rstrip("/")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

ALL_STATES = ("CA", "OR", "WA", "MN", "TX", "UT", "IL", "PA")
PUBLISHABLE_STATES = ("CA", "OR", "WA", "MN", "TX", "UT", "IL", "PA")

# Conservative lower bounds — actual counts are much higher
MIN_PUBLISHABLE_COUNTS: dict[str, int] = {
    "CA": 200,
    "OR": 50,
    "WA": 50,
    "MN": 50,
    "TX": 50,
    "UT": 10,
    "IL": 10,
    "PA": 100,
}

# Known production facility slugs (state, city_slug, slug, human_name)
# These are permanent fixtures — regression anchors.
KNOWN_FACILITIES: list[tuple[str, str, str, str]] = [
    # CA — Opal Care (Opal Care bug regression anchor)
    ("ca", "oakland", "opal-care-llc-200672", "Opal Care"),
    # PA — Rittenhouse Village at Devon
    ("pa", "devon", "rittenhouse-village-at-devon-223010", "Rittenhouse Village"),
    # OR — Footsteps at Carman Oaks
    ("or", "lake-oswego", "footsteps-at-carman-oaks-50r362", "Footsteps at Carman Oaks"),
]

# ---------------------------------------------------------------------------
# Session-scoped DB fixture (Python/psycopg tests)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def db():
    """
    Yield a psycopg connection with dict_row factory.
    Skips automatically when DATABASE_URL is not set.
    """
    if not DATABASE_URL:
        pytest.skip("DATABASE_URL not set — skipping DB-dependent tests")
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError:
        pytest.skip("psycopg not installed — install scrapers/requirements.txt")

    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def db_cursor(db):
    with db.cursor() as cur:
        yield cur


@pytest.fixture(scope="session")
def base_url():
    return PRODUCTION_URL


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def http_get(url: str, params: dict | None = None, timeout: int = 30) -> tuple[int, bytes]:
    """
    Make a real HTTP GET request.  No mocks.  Returns (status, body_bytes).
    On connection error returns (-1, error_bytes).
    """
    import urllib.request
    import urllib.error
    import urllib.parse

    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "StarlynnCare-IntegrationTest/1.0 (+https://www.starlynncare.com)"
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read() or b""
    except Exception as exc:
        return -1, str(exc).encode()
