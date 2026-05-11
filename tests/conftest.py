"""
Shared pytest fixtures for the StarlynnCare end-to-end test suite.

No mocks. No fake data. Everything here talks to real services:
  - DATABASE_URL → live Supabase/Postgres
  - External HTTP → real government APIs

Tests that need DB skip automatically when DATABASE_URL is unset.
Tests marked `external_api` skip when the remote is unreachable.
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Generator

import psycopg
import pytest

# ── Add scrapers/ to sys.path so we can import scraper modules directly ───────
REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = REPO_ROOT / "scrapers"
sys.path.insert(0, str(SCRAPERS_DIR))

# ── Load .env.local / .env before any fixture or test runs ───────────────────
from dotenv import load_dotenv

for _env_name in (".env.local", ".env"):
    _env_path = REPO_ROOT / _env_name
    if _env_path.is_file():
        load_dotenv(_env_path)
        break


# ─────────────────────────────────────────────────────────────────────────────
# DB URL
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def db_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        pytest.skip("DATABASE_URL not set — skipping all DB tests")
    return url


# ─────────────────────────────────────────────────────────────────────────────
# Rollback connection (per-test)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture
def db_conn(db_url: str) -> Generator[psycopg.Connection, None, None]:
    """
    Per-test DB connection. Wraps every test in a transaction that is always
    rolled back — even on assertion errors or unexpected exceptions.

    Within the transaction, PostgreSQL sees all inserted/updated rows (READ
    COMMITTED default), so RPC functions and subsequent SELECTs will observe
    the test data without any commit.
    """
    with psycopg.connect(db_url) as conn:
        conn.autocommit = False
        yield conn
        conn.rollback()


# ─────────────────────────────────────────────────────────────────────────────
# Session-scoped read-only connection (for schema introspection tests)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def db_ro(db_url: str) -> Generator[psycopg.Connection, None, None]:
    """Session-scoped read-only connection. Never writes."""
    with psycopg.connect(db_url) as conn:
        yield conn


# ─────────────────────────────────────────────────────────────────────────────
# Test facility helpers
# ─────────────────────────────────────────────────────────────────────────────

# A deliberately bizarre slug prefix so it can't collide with real data.
_TEST_SLUG_PREFIX = "zzz-e2e-test"


def _unique_slug(base: str = "facility") -> str:
    return f"{_TEST_SLUG_PREFIX}-{base}-{uuid.uuid4().hex[:8]}"


def _unique_city_slug() -> str:
    return f"{_TEST_SLUG_PREFIX}-city-{uuid.uuid4().hex[:8]}"


def insert_test_facility(
    conn: psycopg.Connection,
    *,
    state_code: str = "CA",
    beds: int = 24,
    care_category: str = "rcfe_memory_care",
    license_status: str = "LICENSED",
    publishable: bool = True,
    mc_signal_explicit_name: bool = True,
    mc_signal_chain_name: bool = False,
    mc_review_status: str = "auto_published",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Insert one facility row inside the caller's transaction.
    Returns a dict with all column values including the generated UUID.
    """
    city_slug = _unique_city_slug()
    slug = _unique_slug()
    license_number = f"TEST{uuid.uuid4().hex[:6].upper()}"

    row: dict[str, Any] = {
        "state_code": state_code,
        "name": f"Test Memory Care {slug}",
        "cms_id": None,
        "license_number": license_number,
        "license_type": "RESIDENTIAL CARE FACILITY FOR THE ELDERLY",
        "street": "999 E2E Test Street",
        "city": "Oakland",
        "zip": "94601",
        "city_slug": city_slug,
        "slug": slug,
        "beds": beds,
        "facility_type": "rcfe",
        "certification_type": "state",
        "operator_name": "E2E Test Care LLC",
        "management_company": None,
        "ownership_type": None,
        "phone": "(510) 555-0001",
        "website": None,
        "cms_star_rating": None,
        "last_inspection_date": None,
        "latitude": None,
        "longitude": None,
        "source_url": f"https://example.com/test/{slug}",
        "care_category": care_category,
        "serves_memory_care": mc_signal_explicit_name or mc_signal_chain_name,
        "memory_care_designation": "RCFE — name indicates dementia/memory-care program" if mc_signal_explicit_name else None,
        "license_status": license_status,
        "license_expiration": None,
        "publishable": publishable,
        "mc_signal_explicit_name": mc_signal_explicit_name,
        "mc_signal_chain_name": mc_signal_chain_name,
        "mc_review_status": mc_review_status,
    }
    if extra:
        row.update(extra)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO facilities (
                state_code, name, cms_id,
                license_number, license_type,
                street, city, zip,
                city_slug, slug,
                beds, facility_type, certification_type,
                operator_name, management_company, ownership_type,
                phone, website,
                cms_star_rating, last_inspection_date,
                latitude, longitude,
                source_url,
                care_category, serves_memory_care, memory_care_designation,
                license_status, license_expiration, publishable,
                mc_signal_explicit_name, mc_signal_chain_name, mc_review_status,
                updated_at
            ) VALUES (
                %(state_code)s, %(name)s, %(cms_id)s,
                %(license_number)s, %(license_type)s,
                %(street)s, %(city)s, %(zip)s,
                %(city_slug)s, %(slug)s,
                %(beds)s, %(facility_type)s, %(certification_type)s,
                %(operator_name)s, %(management_company)s, %(ownership_type)s,
                %(phone)s, %(website)s,
                %(cms_star_rating)s, %(last_inspection_date)s,
                %(latitude)s, %(longitude)s,
                %(source_url)s,
                %(care_category)s, %(serves_memory_care)s, %(memory_care_designation)s,
                %(license_status)s, %(license_expiration)s, %(publishable)s,
                %(mc_signal_explicit_name)s, %(mc_signal_chain_name)s, %(mc_review_status)s,
                now()
            )
            RETURNING id::text
            """,
            row,
        )
        row["id"] = cur.fetchone()[0]

    return row


def insert_test_inspection(
    conn: psycopg.Connection,
    facility_id: str,
    *,
    inspection_date: date | None = None,
    inspection_type: str = "standard",
    is_complaint: bool = False,
    total_deficiency_count: int = 0,
    source_url: str | None = None,
) -> str:
    """Insert one inspection, return its UUID string."""
    idate = inspection_date or (date.today() - timedelta(days=180))
    surl = source_url or f"https://example.com/inspection/{uuid.uuid4().hex[:8]}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO inspections (
                facility_id, inspection_date, inspection_type,
                is_complaint, total_deficiency_count,
                source_url, source_agency
            ) VALUES (%s::uuid, %s, %s, %s, %s, %s, %s)
            RETURNING id::text
            """,
            (
                facility_id,
                idate,
                inspection_type,
                is_complaint,
                total_deficiency_count,
                surl,
                "TEST AGENCY",
            ),
        )
        return cur.fetchone()[0]


def insert_test_deficiency(
    conn: psycopg.Connection,
    inspection_id: str,
    *,
    severity: int | None = 2,
    scope: str = "isolated",
    immediate_jeopardy: bool = False,
    is_repeat: bool = False,
    ftag: str | None = "F600",
    code: str | None = None,
    class_: str | None = None,
    inspector_narrative: str | None = "Inspector observed staff failing to follow care plan.",
) -> str:
    """Insert one deficiency, return its UUID string."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO deficiencies (
                inspection_id, ftag, code, category,
                severity, scope, class,
                immediate_jeopardy, is_repeat,
                description, inspector_narrative
            ) VALUES (
                %s::uuid, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s
            )
            RETURNING id::text
            """,
            (
                inspection_id,
                ftag,
                code,
                "Quality of Care",
                severity,
                scope,
                class_,
                immediate_jeopardy,
                is_repeat,
                "Regulatory citation description.",
                inspector_narrative,
            ),
        )
        return cur.fetchone()[0]
