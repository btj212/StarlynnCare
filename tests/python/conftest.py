"""
Shared fixtures and marks for the StarlynnCare test suite.

All integration tests require real DB credentials:
  DATABASE_URL       — for direct psycopg connections (write tests)
  NEXT_PUBLIC_SUPABASE_URL + KEY — for Supabase REST API tests

Tests skip gracefully when credentials are absent. In CI with credentials,
all tests run against the real database — no mocks, no fake data.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# ─── sys.path: make scrapers/ importable without installing them as a package
SCRAPERS_DIR = Path(__file__).resolve().parent.parent.parent / "scrapers"
sys.path.insert(0, str(SCRAPERS_DIR))

# ─── env vars ────────────────────────────────────────────────────────────────


def _require_env(*names: str) -> str:
    for name in names:
        val = os.environ.get(name, "").strip()
        if val:
            return val
    pytest.skip(f"None of {names} set — skipping integration test")


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def database_url() -> str:
    return _require_env("DATABASE_URL", "POSTGRES_URL")


@pytest.fixture(scope="session")
def supabase_url() -> str:
    return _require_env("NEXT_PUBLIC_SUPABASE_URL")


@pytest.fixture(scope="session")
def supabase_key() -> str:
    return _require_env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY")


@pytest.fixture
def db_conn(database_url: str):
    """
    Transactional DB fixture.

    Opens a real psycopg connection, disables autocommit, yields the
    connection to the test, then ROLLS BACK unconditionally. This means
    any inserts/updates made during the test are never committed — no
    pollution of production data.
    """
    import psycopg

    conn = psycopg.connect(database_url)
    conn.autocommit = False
    yield conn
    conn.rollback()
    conn.close()


@pytest.fixture(scope="session")
def supabase_client(supabase_url: str, supabase_key: str):
    """Supabase anon/publishable client for read-only REST queries."""
    from supabase import create_client

    return create_client(supabase_url, supabase_key)


# ─── Per-state published facility sample ─────────────────────────────────────


@pytest.fixture(scope="session")
def published_by_state(supabase_client):
    """
    Returns {state_code: [facility_row, ...]} for the first 5 published
    facilities in each covered state. Used by multiple test modules.
    """
    states = ["CA", "OR", "WA", "TX", "MN", "UT", "IL"]
    result: dict[str, list[dict]] = {}
    for sc in states:
        resp = (
            supabase_client.table("facilities")
            .select(
                "id,name,slug,city_slug,state_code,license_number,license_type,"
                "street,city,zip,beds,care_category,serves_memory_care,"
                "capacity_tier,memory_care_disclosure_filed,mce_endorsed,"
                "wa_memory_care_certified,wa_earc_sdc_contracted,wa_dementia_specialty,"
                "wa_dementia_care_contract,tx_alzheimer_certified,"
                "mn_dementia_care_licensed,mc_review_status,license_status,"
                "publishable,last_inspection_date,created_at,updated_at"
            )
            .eq("state_code", sc)
            .eq("publishable", True)
            .limit(5)
            .execute()
        )
        rows = resp.data or []
        if rows:
            result[sc] = rows
    return result
