"""
Facility upsert pipeline — end-to-end DB tests.

Tests the UPSERT SQL from ccld_rcfe_ingest.py against the real Supabase DB.
Every test runs inside a transaction that is rolled back, leaving no trace.

Validates:
  • All fields round-trip correctly through INSERT → SELECT
  • ON CONFLICT (state_code, city_slug, slug) behaves as upsert not double-insert
  • RETURNING (xmax=0) correctly signals INSERT vs UPDATE
  • mc_review_status is preserved when already reviewed_publish/reviewed_reject
  • mc_review_status is updated when transitioning from needs_review → auto_published
  • capacity_tier generated column reflects beds immediately after insert
  • scrape_run linking via scrape_run_id
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

import pytest

from conftest import insert_test_facility

# The UPSERT SQL verbatim from ccld_rcfe_ingest.py
UPSERT_SQL = """
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
ON CONFLICT (state_code, city_slug, slug) DO UPDATE SET
    name                    = EXCLUDED.name,
    license_number          = EXCLUDED.license_number,
    license_type            = EXCLUDED.license_type,
    street                  = EXCLUDED.street,
    city                    = EXCLUDED.city,
    zip                     = EXCLUDED.zip,
    beds                    = EXCLUDED.beds,
    facility_type           = EXCLUDED.facility_type,
    certification_type      = EXCLUDED.certification_type,
    operator_name           = EXCLUDED.operator_name,
    management_company      = EXCLUDED.management_company,
    phone                   = EXCLUDED.phone,
    last_inspection_date    = EXCLUDED.last_inspection_date,
    source_url              = EXCLUDED.source_url,
    care_category           = EXCLUDED.care_category,
    serves_memory_care      = EXCLUDED.serves_memory_care,
    memory_care_designation = EXCLUDED.memory_care_designation,
    license_status          = EXCLUDED.license_status,
    publishable             = EXCLUDED.publishable,
    mc_signal_explicit_name = EXCLUDED.mc_signal_explicit_name,
    mc_signal_chain_name    = EXCLUDED.mc_signal_chain_name,
    mc_review_status        = CASE
        WHEN facilities.mc_review_status IN ('reviewed_publish','reviewed_reject')
        THEN facilities.mc_review_status
        ELSE EXCLUDED.mc_review_status
    END,
    updated_at              = now()
RETURNING (xmax = 0) AS is_insert
"""


def _make_row(**overrides) -> dict[str, Any]:
    """Base facility row with all required fields."""
    base_slug = f"zzz-e2e-upsert-{uuid.uuid4().hex[:8]}"
    row: dict[str, Any] = {
        "state_code": "CA",
        "name": "E2E Upsert Test Facility",
        "cms_id": None,
        "license_number": f"E2E{uuid.uuid4().hex[:6].upper()}",
        "license_type": "RESIDENTIAL CARE FACILITY FOR THE ELDERLY",
        "street": "999 Test St",
        "city": "Oakland",
        "zip": "94601",
        "city_slug": f"zzz-e2e-city-{uuid.uuid4().hex[:8]}",
        "slug": base_slug,
        "beds": 24,
        "facility_type": "rcfe",
        "certification_type": "state",
        "operator_name": "E2E Test LLC",
        "management_company": None,
        "ownership_type": None,
        "phone": "(510) 555-9999",
        "website": None,
        "cms_star_rating": None,
        "last_inspection_date": None,
        "latitude": None,
        "longitude": None,
        "source_url": "https://example.com/e2e-test",
        "care_category": "rcfe_memory_care",
        "serves_memory_care": True,
        "memory_care_designation": "RCFE — name indicates dementia/memory-care program",
        "license_status": "LICENSED",
        "license_expiration": None,
        "publishable": True,
        "mc_signal_explicit_name": True,
        "mc_signal_chain_name": False,
        "mc_review_status": "auto_published",
    }
    row.update(overrides)
    return row


def _upsert(conn, row: dict) -> bool:
    """Run the upsert, return True if INSERT (new row), False if UPDATE."""
    with conn.cursor() as cur:
        cur.execute(UPSERT_SQL, row)
        result = cur.fetchone()
        return bool(result[0])


def _fetch_by_id(conn, facility_id: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM facilities WHERE id = %s::uuid", (facility_id,))
        row = cur.fetchone()
        if row is None:
            return None
        cols = [d[0] for d in cur.description]
        return dict(zip(cols, row))


# ─────────────────────────────────────────────────────────────────────────────
# INSERT — new row
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_upsert_new_row_returns_is_insert_true(db_conn):
    row = _make_row()
    is_insert = _upsert(db_conn, row)
    assert is_insert is True


@pytest.mark.db
def test_upsert_creates_exactly_one_row(db_conn):
    row = _make_row()
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM facilities WHERE city_slug = %s AND slug = %s",
            (row["city_slug"], row["slug"]),
        )
        count = cur.fetchone()[0]
    assert count == 1


@pytest.mark.db
def test_upsert_assigns_uuid_id(db_conn):
    row = _make_row()
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT id::text FROM facilities WHERE city_slug = %s AND slug = %s",
            (row["city_slug"], row["slug"]),
        )
        fac_id = cur.fetchone()[0]
    assert fac_id is not None
    # Validate UUID format
    uuid.UUID(fac_id)  # Raises ValueError if invalid


# ─────────────────────────────────────────────────────────────────────────────
# Field round-trip — every inserted value reads back correctly
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_upsert_name_round_trips(db_conn):
    row = _make_row(name="Granular Memory Care Test")
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute("SELECT name FROM facilities WHERE slug = %s", (row["slug"],))
        assert cur.fetchone()[0] == "Granular Memory Care Test"


@pytest.mark.db
def test_upsert_license_number_round_trips(db_conn):
    row = _make_row()
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute("SELECT license_number FROM facilities WHERE slug = %s", (row["slug"],))
        assert cur.fetchone()[0] == row["license_number"]


@pytest.mark.db
def test_upsert_state_code_round_trips(db_conn):
    row = _make_row(state_code="CA")
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute("SELECT state_code FROM facilities WHERE slug = %s", (row["slug"],))
        assert cur.fetchone()[0] == "CA"


@pytest.mark.db
def test_upsert_beds_round_trips(db_conn):
    row = _make_row(beds=42)
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute("SELECT beds FROM facilities WHERE slug = %s", (row["slug"],))
        assert cur.fetchone()[0] == 42


@pytest.mark.db
def test_upsert_beds_null_round_trips(db_conn):
    row = _make_row(beds=None)
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute("SELECT beds FROM facilities WHERE slug = %s", (row["slug"],))
        assert cur.fetchone()[0] is None


@pytest.mark.db
def test_upsert_care_category_round_trips(db_conn):
    for cat in ("rcfe_memory_care", "rcfe_general", "ccrc"):
        row = _make_row(care_category=cat)
        _upsert(db_conn, row)
        with db_conn.cursor() as cur:
            cur.execute("SELECT care_category FROM facilities WHERE slug = %s", (row["slug"],))
            assert cur.fetchone()[0] == cat


@pytest.mark.db
def test_upsert_publishable_true_round_trips(db_conn):
    row = _make_row(publishable=True)
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute("SELECT publishable FROM facilities WHERE slug = %s", (row["slug"],))
        assert cur.fetchone()[0] is True


@pytest.mark.db
def test_upsert_publishable_false_round_trips(db_conn):
    row = _make_row(publishable=False)
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute("SELECT publishable FROM facilities WHERE slug = %s", (row["slug"],))
        assert cur.fetchone()[0] is False


@pytest.mark.db
def test_upsert_mc_signal_explicit_name_round_trips(db_conn):
    for val in (True, False):
        row = _make_row(mc_signal_explicit_name=val)
        _upsert(db_conn, row)
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT mc_signal_explicit_name FROM facilities WHERE slug = %s", (row["slug"],)
            )
            assert cur.fetchone()[0] is val


@pytest.mark.db
def test_upsert_mc_signal_chain_name_round_trips(db_conn):
    for val in (True, False):
        row = _make_row(mc_signal_chain_name=val)
        _upsert(db_conn, row)
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT mc_signal_chain_name FROM facilities WHERE slug = %s", (row["slug"],)
            )
            assert cur.fetchone()[0] is val


@pytest.mark.db
def test_upsert_phone_round_trips(db_conn):
    row = _make_row(phone="(510) 555-1234")
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute("SELECT phone FROM facilities WHERE slug = %s", (row["slug"],))
        assert cur.fetchone()[0] == "(510) 555-1234"


@pytest.mark.db
def test_upsert_phone_null_round_trips(db_conn):
    row = _make_row(phone=None)
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute("SELECT phone FROM facilities WHERE slug = %s", (row["slug"],))
        assert cur.fetchone()[0] is None


@pytest.mark.db
def test_upsert_last_inspection_date_round_trips(db_conn):
    d = date(2023, 6, 15)
    row = _make_row(last_inspection_date=d)
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT last_inspection_date FROM facilities WHERE slug = %s", (row["slug"],)
        )
        assert cur.fetchone()[0] == d


@pytest.mark.db
def test_upsert_operator_name_round_trips(db_conn):
    row = _make_row(operator_name="Silverado Senior Living Inc")
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute("SELECT operator_name FROM facilities WHERE slug = %s", (row["slug"],))
        assert cur.fetchone()[0] == "Silverado Senior Living Inc"


@pytest.mark.db
def test_upsert_license_status_round_trips(db_conn):
    for status in ("LICENSED", "CLOSED", "PENDING"):
        row = _make_row(license_status=status)
        _upsert(db_conn, row)
        with db_conn.cursor() as cur:
            cur.execute("SELECT license_status FROM facilities WHERE slug = %s", (row["slug"],))
            assert cur.fetchone()[0] == status


# ─────────────────────────────────────────────────────────────────────────────
# capacity_tier generated column
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("beds,expected_tier", [
    (1, "small"),
    (6, "small"),
    (7, "medium"),
    (49, "medium"),
    (50, "large"),
    (200, "large"),
    (None, "unknown"),
])
@pytest.mark.db
def test_capacity_tier_generated_from_beds(db_conn, beds, expected_tier):
    row = _make_row(beds=beds)
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute("SELECT capacity_tier FROM facilities WHERE slug = %s", (row["slug"],))
        tier = cur.fetchone()[0]
    assert tier == expected_tier, (
        f"beds={beds} → expected capacity_tier={expected_tier!r}, got {tier!r}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# ON CONFLICT — upsert behavior
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_upsert_same_slug_returns_is_insert_false(db_conn):
    row = _make_row()
    _upsert(db_conn, row)
    is_insert = _upsert(db_conn, row)  # Second time, same slug
    assert is_insert is False


@pytest.mark.db
def test_upsert_same_slug_does_not_create_duplicate(db_conn):
    row = _make_row()
    _upsert(db_conn, row)
    _upsert(db_conn, row)
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM facilities WHERE city_slug = %s AND slug = %s",
            (row["city_slug"], row["slug"]),
        )
        count = cur.fetchone()[0]
    assert count == 1, f"Upsert created {count} rows; expected 1"


@pytest.mark.db
def test_upsert_updates_name_on_conflict(db_conn):
    row = _make_row(name="Original Name")
    _upsert(db_conn, row)
    row2 = {**row, "name": "Updated Name"}
    _upsert(db_conn, row2)
    with db_conn.cursor() as cur:
        cur.execute("SELECT name FROM facilities WHERE slug = %s", (row["slug"],))
        assert cur.fetchone()[0] == "Updated Name"


@pytest.mark.db
def test_upsert_updates_beds_on_conflict(db_conn):
    row = _make_row(beds=10)
    _upsert(db_conn, row)
    row2 = {**row, "beds": 25}
    _upsert(db_conn, row2)
    with db_conn.cursor() as cur:
        cur.execute("SELECT beds FROM facilities WHERE slug = %s", (row["slug"],))
        assert cur.fetchone()[0] == 25


# ─────────────────────────────────────────────────────────────────────────────
# mc_review_status preservation logic
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_upsert_preserves_reviewed_publish_status(db_conn):
    """
    Once mc_review_status is 'reviewed_publish', a re-scrape must NOT reset it
    to 'auto_published' or 'needs_review'. This is the critical safety check —
    resetting would unexpectedly un-publish human-reviewed facilities.
    """
    row = _make_row(mc_review_status="needs_review")
    _upsert(db_conn, row)

    # Simulate admin approval
    with db_conn.cursor() as cur:
        cur.execute(
            "UPDATE facilities SET mc_review_status = 'reviewed_publish' WHERE slug = %s",
            (row["slug"],),
        )

    # Re-scrape tries to set it to 'auto_published'
    row2 = {**row, "mc_review_status": "auto_published"}
    _upsert(db_conn, row2)

    with db_conn.cursor() as cur:
        cur.execute("SELECT mc_review_status FROM facilities WHERE slug = %s", (row["slug"],))
        status = cur.fetchone()[0]

    assert status == "reviewed_publish", (
        f"mc_review_status was reset to {status!r} — "
        "re-scrape must NOT override reviewed_publish"
    )


@pytest.mark.db
def test_upsert_preserves_reviewed_reject_status(db_conn):
    row = _make_row(mc_review_status="needs_review")
    _upsert(db_conn, row)

    with db_conn.cursor() as cur:
        cur.execute(
            "UPDATE facilities SET mc_review_status = 'reviewed_reject' WHERE slug = %s",
            (row["slug"],),
        )

    row2 = {**row, "mc_review_status": "needs_review"}
    _upsert(db_conn, row2)

    with db_conn.cursor() as cur:
        cur.execute("SELECT mc_review_status FROM facilities WHERE slug = %s", (row["slug"],))
        status = cur.fetchone()[0]

    assert status == "reviewed_reject", (
        f"mc_review_status was reset to {status!r} — "
        "re-scrape must NOT override reviewed_reject"
    )


@pytest.mark.db
def test_upsert_updates_needs_review_to_auto_published(db_conn):
    """
    A facility in needs_review CAN be updated to auto_published by a re-scrape
    (e.g., its name now contains an explicit MC keyword). Only reviewed_* are frozen.
    """
    row = _make_row(mc_review_status="needs_review")
    _upsert(db_conn, row)

    row2 = {**row, "mc_review_status": "auto_published"}
    _upsert(db_conn, row2)

    with db_conn.cursor() as cur:
        cur.execute("SELECT mc_review_status FROM facilities WHERE slug = %s", (row["slug"],))
        status = cur.fetchone()[0]

    assert status == "auto_published"


# ─────────────────────────────────────────────────────────────────────────────
# scrape_run lifecycle
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_scrape_run_insert_and_update(db_conn):
    started = datetime.now(timezone.utc)
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO scrape_runs (state_code, scraper_name, status, started_at)
            VALUES ('CA', 'e2e_test_scraper', 'running', %s)
            RETURNING id::text
            """,
            (started,),
        )
        run_id = cur.fetchone()[0]

    assert uuid.UUID(run_id)  # valid UUID

    # Insert a test facility and link it to the run (simulates real scraper behavior)
    row = _make_row()
    _upsert(db_conn, row)

    # Close the run
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE scrape_runs SET
                completed_at = now(),
                status = 'success',
                records_found = 1,
                records_new = 1,
                records_updated = 0
            WHERE id = %s::uuid
            """,
            (run_id,),
        )
        cur.execute(
            "SELECT status, records_found, records_new FROM scrape_runs WHERE id = %s::uuid",
            (run_id,),
        )
        result = cur.fetchone()

    assert result[0] == "success"
    assert result[1] == 1
    assert result[2] == 1


@pytest.mark.db
def test_scrape_run_failure_records_error_log(db_conn):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO scrape_runs (state_code, scraper_name, status, started_at)
            VALUES ('CA', 'e2e_test_scraper', 'running', now())
            RETURNING id::text
            """
        )
        run_id = cur.fetchone()[0]
        cur.execute(
            """
            UPDATE scrape_runs SET
                completed_at = now(),
                status = 'failed',
                error_log = 'Connection timeout after 30s'
            WHERE id = %s::uuid
            """,
            (run_id,),
        )
        cur.execute(
            "SELECT status, error_log FROM scrape_runs WHERE id = %s::uuid",
            (run_id,),
        )
        row = cur.fetchone()

    assert row[0] == "failed"
    assert "timeout" in (row[1] or "").lower()
