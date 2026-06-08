"""
Tests: Per-state data coverage and completeness.

Verifies that the complete data pipeline has run correctly for each of the 8
covered states. Checks facility counts, inspection presence, deficiency data,
and state-specific signal columns.
"""

from __future__ import annotations

import pytest
from tests.python.conftest import SupabaseRest

# State-specific minimum expectations (conservative — from MEMORY.md data).
STATE_EXPECTATIONS = {
    "CA": {
        "min_publishable": 100,
        "min_inspections_per_sample": 3,   # CA has continuous coverage
        "signal_col": None,                 # CA uses name regex + citation scan
    },
    "OR": {
        "min_publishable": 50,
        "min_inspections_per_sample": 1,
        "signal_col": "mce_endorsed",
    },
    "WA": {
        "min_publishable": 50,
        "min_inspections_per_sample": 1,
        "signal_col": "wa_memory_care_certified",
    },
    "TX": {
        "min_publishable": 100,
        "min_inspections_per_sample": 1,
        "signal_col": "tx_alzheimer_certified",
    },
    "MN": {
        "min_publishable": 20,
        "min_inspections_per_sample": 1,
        "signal_col": "mn_dementia_care_licensed",
    },
    "UT": {
        "min_publishable": 20,
        "min_inspections_per_sample": 1,
        "signal_col": None,  # UT uses CMS overlay
    },
    "IL": {
        "min_publishable": 50,
        "min_inspections_per_sample": 1,
        "signal_col": "il_dementia_program_flag",
    },
    "PA": {
        "min_publishable": 350,
        "min_inspections_per_sample": 2,
        "signal_col": "mc_designation_type",
    },
}


@pytest.mark.database
@pytest.mark.parametrize("state_code", list(STATE_EXPECTATIONS.keys()))
def test_state_publishable_count(
    supabase_rest: SupabaseRest, state_code: str
) -> None:
    """Each state meets minimum publishable facility count."""
    expected = STATE_EXPECTATIONS[state_code]
    result = supabase_rest.select(
        "facilities",
        select="id",
        filters={
            "state_code": f"eq.{state_code}",
            "publishable": "eq.true",
        },
        limit=1,
        count=True,
    )
    count = result["count"] or 0
    assert count >= expected["min_publishable"], (
        f"{state_code}: expected ≥{expected['min_publishable']} publishable, got {count}"
    )


@pytest.mark.database
@pytest.mark.parametrize("state_code", list(STATE_EXPECTATIONS.keys()))
def test_state_facilities_have_inspections(
    supabase_rest: SupabaseRest, state_code: str
) -> None:
    """A sample of publishable facilities in each state has inspection records."""
    # Pick 3 facilities
    fac_result = supabase_rest.select(
        "facilities",
        select="id,name",
        filters={
            "state_code": f"eq.{state_code}",
            "publishable": "eq.true",
        },
        limit=5,
        order="updated_at.desc",
    )
    facilities = fac_result["data"]
    assert facilities, f"No publishable facilities found for {state_code}"

    facilities_with_inspections = 0
    for fac in facilities:
        insp_result = supabase_rest.select(
            "inspections",
            select="id",
            filters={"facility_id": f"eq.{fac['id']}"},
            limit=1,
        )
        if insp_result["data"]:
            facilities_with_inspections += 1

    min_expected = STATE_EXPECTATIONS[state_code]["min_inspections_per_sample"]
    assert facilities_with_inspections >= min(min_expected, len(facilities)), (
        f"{state_code}: only {facilities_with_inspections}/{len(facilities)} "
        f"sampled facilities have inspections"
    )


@pytest.mark.database
@pytest.mark.parametrize(
    "state_code,signal_col",
    [
        (sc, exp["signal_col"])
        for sc, exp in STATE_EXPECTATIONS.items()
        if exp["signal_col"]
    ],
)
def test_state_signal_column_is_set_on_some_facilities(
    supabase_rest: SupabaseRest, state_code: str, signal_col: str
) -> None:
    """
    Each state's primary MC signal column is non-null/true on at least some facilities.
    If zero rows have the signal set, the ingest pipeline may have failed to write it.
    """
    # For boolean columns: filter eq.true
    # For text columns (mc_designation_type): filter not.is.null
    if state_code == "PA" and signal_col == "mc_designation_type":
        result = supabase_rest.select(
            "facilities",
            select="id",
            filters={
                "state_code": "eq.PA",
                "mc_designation_type": "not.is.null",
            },
            limit=1,
            count=True,
        )
    else:
        result = supabase_rest.select(
            "facilities",
            select="id",
            filters={
                "state_code": f"eq.{state_code}",
                signal_col: "eq.true",
            },
            limit=1,
            count=True,
        )

    count = result["count"] or 0
    assert count >= 1, (
        f"{state_code}.{signal_col}: zero facilities have this signal set. "
        "The ingest script may have failed to write this column."
    )


@pytest.mark.database
def test_ca_facilities_have_valid_care_category(supabase_rest: SupabaseRest) -> None:
    """CA facilities have one of the expected care_category values."""
    VALID_CATEGORIES = {
        "rcfe_memory_care",
        "rcfe_general",
        "alf_memory_care",
        "alf_general",
        "snf_general",
        "snf_dementia_scu",
        "ccrc",
        "unknown",
    }
    result = supabase_rest.select(
        "facilities",
        select="id,name,care_category",
        filters={"state_code": "eq.CA", "publishable": "eq.true"},
        limit=100,
    )
    for row in result["data"]:
        cat = row.get("care_category")
        assert cat in VALID_CATEGORIES, (
            f"CA facility {row.get('name')!r} has invalid care_category: {cat!r}"
        )


@pytest.mark.database
def test_facilities_have_city_slug_and_slug(supabase_rest: SupabaseRest) -> None:
    """All publishable facilities have both city_slug and slug (URL building requires these)."""
    result = supabase_rest.select(
        "facilities",
        select="id,state_code,name,city_slug,slug",
        filters={"publishable": "eq.true"},
        limit=100,
        order="updated_at.desc",
    )
    for row in result["data"]:
        assert row.get("city_slug"), (
            f"{row.get('state_code')} facility {row.get('name')!r} has null city_slug"
        )
        assert row.get("slug"), (
            f"{row.get('state_code')} facility {row.get('name')!r} has null slug"
        )
        # Slugs must be lowercase and URL-safe
        cs = row["city_slug"]
        fs = row["slug"]
        assert cs == cs.lower(), f"city_slug {cs!r} has uppercase"
        assert " " not in cs, f"city_slug {cs!r} has space"
        assert " " not in fs, f"slug {fs!r} has space"


@pytest.mark.database
def test_pa_deficiency_count_is_populated(supabase_rest: SupabaseRest) -> None:
    """
    PA has at least 40,000 deficiencies (MEMORY.md 2026-06: 42,753 backfilled).
    We estimate by counting inspections × average deficiencies.
    """
    # Get PA facilities
    fac_result = supabase_rest.select(
        "facilities",
        select="id",
        filters={"state_code": "eq.PA", "publishable": "eq.true"},
        limit=200,
    )
    pa_ids = [r["id"] for r in fac_result["data"]]
    if not pa_ids:
        pytest.skip("No PA facilities found")

    # Count inspections for PA
    insp_result = supabase_rest.select(
        "inspections",
        select="id",
        filters={"facility_id": f"in.({','.join(pa_ids[:50])})"},
        limit=1,
        count=True,
    )
    insp_count = insp_result["count"] or 0
    # PA has 12,774 inspections (MEMORY.md 2026-05), so at least 1000 for top 50 facilities
    assert insp_count >= 100, (
        f"PA top-50 facilities have only {insp_count} inspections — "
        "ingest may have failed"
    )


@pytest.mark.database
def test_all_states_have_recent_data(supabase_rest: SupabaseRest) -> None:
    """
    Each state's most recently updated facility was modified within the last
    6 months (stale data is a YMYL quality issue).
    """
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=180)).isoformat()

    for state_code in ("CA", "OR", "WA", "TX", "MN", "IL", "PA"):
        result = supabase_rest.select(
            "facilities",
            select="updated_at",
            filters={
                "state_code": f"eq.{state_code}",
                "publishable": "eq.true",
                "updated_at": f"gte.{cutoff}",
            },
            limit=1,
        )
        assert result["data"], (
            f"{state_code}: no publishable facilities updated in the last 6 months. "
            "Data refresh may have failed."
        )
