"""Shared fixtures and constants for the StarlynnCare end-to-end test suite."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent


def _load_env() -> None:
    """Load .env.local (then .env) without overwriting already-set vars."""
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            from dotenv import load_dotenv
            load_dotenv(p, override=False)
            return


_load_env()


# ---------------------------------------------------------------------------
# pytest markers
# ---------------------------------------------------------------------------

def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "external: requires live internet access")
    config.addinivalue_line("markers", "db: requires DATABASE_URL")
    config.addinivalue_line("markers", "api: requires Supabase URL + publishable key")


# ---------------------------------------------------------------------------
# DB fixture (psycopg, dict rows)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def db(db_conn):
    """Alias: same as db_conn."""
    return db_conn


@pytest.fixture(scope="session")
def db_conn():
    """
    psycopg connection via DATABASE_URL.

    Uses the direct Postgres URI (bypasses RLS) so tests can inspect all rows,
    including non-publishable ones that matter for integrity checks.
    """
    import psycopg
    from psycopg.rows import dict_row

    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.fail(
            "DATABASE_URL is not set. "
            "Add it to .env.local or export DATABASE_URL=<supabase-postgres-uri>. "
            "Get it from: Supabase → Project Settings → Database → Connection string (URI)."
        )

    try:
        conn = psycopg.connect(url, row_factory=dict_row)
    except Exception as exc:
        pytest.fail(f"Could not connect to DATABASE_URL: {exc}")

    yield conn
    conn.close()


# ---------------------------------------------------------------------------
# Known test fixtures (from MEMORY.md + ERRORS.md)
# ---------------------------------------------------------------------------

# CA: Opal Care LLC — most-cited CA RCFE; used as negative-tier regression fixture
CA_OPAL_CARE = {
    "license_number": "200672",
    "state_code": "CA",
    "city_slug": "oakland",
    "slug": "opal-care-llc-200672",
    "name_fragment": "Opal Care",
}

# PA: three reference facilities confirmed publishable in MEMORY.md 2026-05 entry
PA_RITTENHOUSE = {
    "license_number": "223010",
    "state_code": "PA",
    # portal inspection ID = license_number[:-1] (last digit stripped)
    "inspection_portal_id": "22301",
}
PA_SERENITY_GARDENS = {
    "license_number": "231010",
    "state_code": "PA",
    "inspection_portal_id": "23101",
}
PA_CAMBRIDGE_VILLAGE = {
    "license_number": "456560",
    "state_code": "PA",
    "inspection_portal_id": "45656",
}

# All states that have been ingested (DB columns exist)
ALL_INGESTED_STATES = ("CA", "OR", "WA", "MN", "TX", "UT", "IL", "PA")

# States exposed by the /api/facilities/[state] route (from COVERED_STATES in states.ts)
COVERED_STATE_SLUGS = (
    "california",
    "texas",
    "oregon",
    "washington",
    "minnesota",
    "utah",
    "illinois",
)

# ---------------------------------------------------------------------------
# External source URLs (canonical; from scraper source constants)
# ---------------------------------------------------------------------------

CMS_DKAN_META_BASE = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items"
CMS_PROVIDER_INFO_UUID = "4pq5-n9py"

CDSS_TRANSPARENCY_BASE = "https://www.ccld.dss.ca.gov/transparencyapi/api"

OR_DHS_LTC_SOURCE = "https://ltclicensing.oregon.gov/Providers"
WA_DSHS_ALF_SOURCE = "https://fortress.wa.gov/dshs/adsaapps/Lookup/BHAdvLookup.aspx"
MN_MDH_DIRECTORY_SOURCE = "https://www.health.state.mn.us/facilities/regulation/directory/directorydatafile.html"
PA_DHS_EXPORT_SOURCE = "https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/ExportToExcel"
CENSUS_GEOCODER_BASE = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"

# ---------------------------------------------------------------------------
# Minimum expected counts per state (conservative; from MEMORY.md)
# ---------------------------------------------------------------------------

MIN_PUBLISHABLE = {
    "CA": 1_000,
    "OR": 100,
    "WA": 100,
    "MN": 50,
    "TX": 50,
    "UT": 20,
    "IL": 10,
    "PA": 300,
}

MIN_INSPECTIONS = {
    "CA": 5_000,
    "OR": 500,
    "WA": 500,
    "MN": 200,
    "TX": 100,
    "UT": 50,
    "IL": 50,
    "PA": 10_000,
}

MIN_DEFICIENCIES = {
    "CA": 10_000,
    "OR": 1_000,
    "WA": 500,
    "MN": 500,
    "TX": 200,
    "UT": 50,
    "IL": 50,
    "PA": 5_000,
}
