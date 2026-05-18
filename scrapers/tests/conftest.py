"""
Shared pytest fixtures for StarlynnCare E2E scraper tests.

All fixtures use real external services — no mocking.
Tests that require credentials are skipped automatically when env vars are absent.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Generator

import pytest
import requests

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
DATA_DIR = Path(__file__).parent.parent / "data"
REPO_ROOT = Path(__file__).parent.parent.parent


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "live_api: requires live external API access")
    config.addinivalue_line("markers", "db: requires DATABASE_URL pointing at real Supabase")
    config.addinivalue_line("markers", "slow: test takes > 10 seconds")
    config.addinivalue_line("markers", "anthropic: requires ANTHROPIC_API_KEY")


# ─────────────────────────────────────────────────────────────────────────────
# Environment helpers
# ─────────────────────────────────────────────────────────────────────────────


def _skip_no_db() -> None:
    if not os.environ.get("DATABASE_URL"):
        pytest.skip("DATABASE_URL not set — skipping DB test")


def _skip_no_anthropic() -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set — skipping Anthropic test")


# ─────────────────────────────────────────────────────────────────────────────
# Database fixtures (real Supabase/Postgres)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def db_conn():
    """Real psycopg3 connection to the production Supabase database."""
    _skip_no_db()
    import psycopg

    url = os.environ["DATABASE_URL"]
    with psycopg.connect(url, row_factory=psycopg.rows.dict_row) as conn:
        conn.autocommit = True
        yield conn


@pytest.fixture(scope="session")
def ca_facilities(db_conn):
    """Real CA publishable facilities from the DB."""
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, license_number, slug, city_slug, state_code,
                   serves_memory_care, mc_review_status, care_category,
                   mc_signal_explicit_name, mc_signal_chain_name,
                   license_status, publishable, beds, phone
            FROM facilities
            WHERE state_code = 'CA' AND publishable = true
            ORDER BY name
            LIMIT 20
            """
        )
        rows = cur.fetchall()
    assert len(rows) > 0, "Expected publishable CA facilities in DB — run CA ingest first"
    return rows


@pytest.fixture(scope="session")
def or_facilities(db_conn):
    """Real OR facilities from the DB."""
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, license_number, state_code, serves_memory_care,
                   mce_endorsed, enhanced_oversight, publishable,
                   mc_review_status, license_status
            FROM facilities
            WHERE state_code = 'OR'
            ORDER BY name
            LIMIT 20
            """
        )
        return cur.fetchall()


@pytest.fixture(scope="session")
def wa_facilities(db_conn):
    """Real WA facilities from the DB."""
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, license_number, state_code, serves_memory_care,
                   wa_dementia_care_contract, wa_memory_care_certified,
                   wa_facility_type, publishable, mc_review_status
            FROM facilities
            WHERE state_code = 'WA'
            ORDER BY name
            LIMIT 20
            """
        )
        return cur.fetchall()


@pytest.fixture(scope="session")
def mn_facilities(db_conn):
    """Real MN facilities from the DB."""
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, license_number, state_code, serves_memory_care,
                   mn_dementia_care_licensed, publishable, mc_review_status
            FROM facilities
            WHERE state_code = 'MN'
            ORDER BY name
            LIMIT 20
            """
        )
        return cur.fetchall()


@pytest.fixture(scope="session")
def tx_facilities(db_conn):
    """Real TX facilities from the DB."""
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, license_number, state_code, serves_memory_care,
                   tx_alzheimer_certified, tx_alzheimer_cert_no,
                   publishable, mc_review_status
            FROM facilities
            WHERE state_code = 'TX'
            ORDER BY name
            LIMIT 20
            """
        )
        return cur.fetchall()


@pytest.fixture(scope="session")
def sample_inspections(db_conn):
    """Real inspection rows from across all states."""
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT i.id, i.facility_id, i.inspection_date, i.inspection_type,
                   i.is_complaint, i.complaint_id, i.total_deficiency_count,
                   i.source_url, i.source_agency, i.raw_data,
                   f.state_code, f.name AS facility_name
            FROM inspections i
            JOIN facilities f ON f.id = i.facility_id
            WHERE i.inspection_date IS NOT NULL
            ORDER BY i.inspection_date DESC
            LIMIT 50
            """
        )
        return cur.fetchall()


@pytest.fixture(scope="session")
def sample_deficiencies(db_conn):
    """Real deficiency rows — one per state where available."""
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT d.id, d.inspection_id, d.code, d.category, d.severity,
                   d.class, d.scope_severity_code, d.immediate_jeopardy,
                   d.description, d.inspector_narrative, d.state_severity_raw,
                   d.is_repeat, d.cited_date, d.corrected_date,
                   f.state_code
            FROM deficiencies d
            JOIN inspections i ON i.id = d.inspection_id
            JOIN facilities f ON f.id = i.facility_id
            ORDER BY d.severity DESC NULLS LAST
            LIMIT 50
            """
        )
        return cur.fetchall()


@pytest.fixture(scope="session")
def publishable_facility_with_inspections(db_conn):
    """A real publishable facility that has at least one inspection."""
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT f.id, f.name, f.slug, f.city_slug, f.state_code,
                   f.serves_memory_care, f.license_status, f.publishable,
                   f.care_category, f.beds, f.street, f.city, f.zip,
                   COUNT(i.id) AS inspection_count
            FROM facilities f
            JOIN inspections i ON i.facility_id = f.id
            WHERE f.publishable = true
            GROUP BY f.id
            HAVING COUNT(i.id) >= 1
            ORDER BY COUNT(i.id) DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
    assert row is not None, "Expected at least one publishable facility with inspections in DB"
    return row


# ─────────────────────────────────────────────────────────────────────────────
# Fixture file loaders
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture
def or_fixture() -> dict:
    return json.loads((FIXTURES_DIR / "or_inspections_smoke.json").read_text())


@pytest.fixture
def mn_fixture() -> dict:
    return json.loads((FIXTURES_DIR / "mn_inspections_smoke.json").read_text())


@pytest.fixture
def wa_fixture() -> dict:
    return json.loads((FIXTURES_DIR / "wa_inspections_smoke.json").read_text())


@pytest.fixture
def tx_fixture() -> dict:
    return json.loads((FIXTURES_DIR / "tx_inspections_smoke.json").read_text())


# ─────────────────────────────────────────────────────────────────────────────
# HTTP session (for live API tests)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def http() -> requests.Session:
    """Requests session with polite User-Agent (same as _http_helpers.py)."""
    sess = requests.Session()
    sess.headers.update(
        {
            "User-Agent": (
                "StarlynnCare-TestSuite/1.0 "
                "(automated integration test; contact team@starlynncare.com)"
            ),
            "Accept": "application/json",
        }
    )
    return sess
