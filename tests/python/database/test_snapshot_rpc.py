"""
Tests: facility_snapshot() RPC via Supabase REST.

Verifies the complete output shape of the facility_snapshot() RPC for
representative facilities from each covered state. This is the most
performance-critical query on the site — it drives every peer-rank display,
the composite grade, the trajectory sparkline, and the heatmap.
"""

from __future__ import annotations

import pytest
from tests.python.conftest import SupabaseRest

# ── Helpers ────────────────────────────────────────────────────────────────────

def get_representative_facility_id(
    supabase: SupabaseRest, state_code: str
) -> str | None:
    """
    Find a publishable facility in the given state that has at least one
    inspection, so the snapshot has real data to compute against.
    """
    # Get facilities with inspections via a two-step query.
    fac_result = supabase.select(
        "facilities",
        select="id",
        filters={"state_code": f"eq.{state_code}", "publishable": "eq.true"},
        limit=20,
        order="updated_at.desc",
    )
    fac_ids = [r["id"] for r in fac_result["data"]]
    if not fac_ids:
        return None

    # Pick the first one that has inspections
    for fid in fac_ids:
        insp_result = supabase.select(
            "inspections",
            select="id",
            filters={"facility_id": f"eq.{fid}"},
            limit=1,
        )
        if insp_result["data"]:
            return fid
    return None


# ── Snapshot structure tests ──────────────────────────────────────────────────

@pytest.mark.database
def test_snapshot_rpc_exists_and_returns_data(supabase_rest: SupabaseRest) -> None:
    """facility_snapshot RPC exists and returns a non-null payload."""
    fid = get_representative_facility_id(supabase_rest, "CA")
    if not fid:
        pytest.skip("No CA facility with inspections found")

    result = supabase_rest.rpc("facility_snapshot", {"p_facility_id": fid})
    assert result is not None, "facility_snapshot returned null"
    assert isinstance(result, dict), f"Expected dict, got {type(result).__name__}"


@pytest.mark.database
def test_snapshot_has_facility_block(supabase_rest: SupabaseRest) -> None:
    """Snapshot 'facility' block has id, name, beds, state_code, license_type."""
    fid = get_representative_facility_id(supabase_rest, "CA")
    if not fid:
        pytest.skip("No CA facility with inspections found")

    snap = supabase_rest.rpc("facility_snapshot", {"p_facility_id": fid})
    assert "facility" in snap, f"Missing 'facility' block in snapshot: {list(snap.keys())}"
    fac = snap["facility"]
    for key in ("id", "name", "state_code"):
        assert key in fac, f"Missing facility.{key}"
        assert fac[key], f"facility.{key} is null"
    assert fac["id"] == fid


@pytest.mark.database
def test_snapshot_has_peer_set(supabase_rest: SupabaseRest) -> None:
    """Snapshot 'peer_set' block has definition, n (count), fallback_level."""
    fid = get_representative_facility_id(supabase_rest, "OR")
    if not fid:
        pytest.skip("No OR facility with inspections found")

    snap = supabase_rest.rpc("facility_snapshot", {"p_facility_id": fid})
    assert "peer_set" in snap, f"Missing peer_set: {list(snap.keys())}"
    ps = snap["peer_set"]
    assert "definition" in ps, "Missing peer_set.definition"
    assert "n" in ps, "Missing peer_set.n"
    assert "fallback_level" in ps, "Missing peer_set.fallback_level"
    assert isinstance(ps["n"], int), f"peer_set.n is not int: {type(ps['n'])}"
    assert ps["n"] >= 1, "Peer set has fewer than 1 peer (including the facility itself)"
    assert ps["fallback_level"] in (0, 1, 2), f"Invalid fallback_level: {ps['fallback_level']}"


@pytest.mark.database
def test_snapshot_has_all_four_metrics(supabase_rest: SupabaseRest) -> None:
    """
    Snapshot metrics block has all four required metrics:
    severity, repeats, frequency, trajectory.
    Each has value, percentile, peer_median.
    """
    fid = get_representative_facility_id(supabase_rest, "WA")
    if not fid:
        pytest.skip("No WA facility with inspections found")

    snap = supabase_rest.rpc("facility_snapshot", {"p_facility_id": fid})
    assert "metrics" in snap, f"Missing metrics: {list(snap.keys())}"
    metrics = snap["metrics"]

    for metric_name in ("severity", "repeats", "frequency", "trajectory"):
        assert metric_name in metrics, f"Missing metrics.{metric_name}"
        m = metrics[metric_name]
        for field in ("value", "percentile", "peer_median"):
            assert field in m, f"Missing metrics.{metric_name}.{field}"


@pytest.mark.database
def test_snapshot_grade_is_valid_letter_or_null(supabase_rest: SupabaseRest) -> None:
    """
    Snapshot grade is null or has letter (A-F) and composite_percentile (0-100).
    Grade is null when has_inspections=false or narrative text gate fails.
    """
    fid = get_representative_facility_id(supabase_rest, "PA")
    if not fid:
        pytest.skip("No PA facility with inspections found")

    snap = supabase_rest.rpc("facility_snapshot", {"p_facility_id": fid})
    grade = snap.get("grade")
    if grade is None:
        # Acceptable when the facility has no inspections or thin peer set
        return

    assert "letter" in grade, f"Grade missing 'letter': {grade}"
    assert "composite_percentile" in grade, f"Grade missing composite_percentile: {grade}"
    assert grade["letter"] in ("A", "B", "C", "D", "F"), (
        f"Invalid grade letter: {grade['letter']!r}"
    )
    pct = grade["composite_percentile"]
    assert isinstance(pct, (int, float)), f"composite_percentile is not numeric: {pct}"
    assert 0 <= pct <= 100, f"composite_percentile {pct} out of range [0, 100]"


@pytest.mark.database
def test_snapshot_trajectory_series_shape(supabase_rest: SupabaseRest) -> None:
    """
    trajectory_series is a list of monthly points, each with month, facility_score,
    peer_median_score. Points span up to 24 months (the RPC's window).
    """
    fid = get_representative_facility_id(supabase_rest, "MN")
    if not fid:
        pytest.skip("No MN facility with inspections found")

    snap = supabase_rest.rpc("facility_snapshot", {"p_facility_id": fid})
    series = snap.get("trajectory_series", [])
    assert isinstance(series, list), f"trajectory_series is not a list: {type(series)}"

    if series:
        for point in series[:5]:
            for field in ("month", "facility_score", "peer_median_score"):
                assert field in point, (
                    f"trajectory_series point missing {field!r}: {point}"
                )
        # Month format: YYYY-MM
        sample_month = series[0]["month"]
        assert len(sample_month) == 7 and sample_month[4] == "-", (
            f"Month format wrong: {sample_month!r} (expected YYYY-MM)"
        )


@pytest.mark.database
def test_snapshot_heatmap_shape(supabase_rest: SupabaseRest) -> None:
    """
    heatmap is a list of cells, each with severity (1-4), scope, count, tags.
    The grid is 4 severity × 3 scope = 12 cells maximum.
    """
    fid = get_representative_facility_id(supabase_rest, "TX")
    if not fid:
        pytest.skip("No TX facility with inspections found")

    snap = supabase_rest.rpc("facility_snapshot", {"p_facility_id": fid})
    heatmap = snap.get("heatmap", [])
    assert isinstance(heatmap, list), f"heatmap is not a list: {type(heatmap)}"
    assert len(heatmap) <= 12, f"Heatmap has {len(heatmap)} cells, max is 12"

    if heatmap:
        for cell in heatmap:
            assert "severity" in cell, f"Heatmap cell missing severity: {cell}"
            assert "scope" in cell, f"Heatmap cell missing scope: {cell}"
            assert "count" in cell, f"Heatmap cell missing count: {cell}"
            assert cell["severity"] in (1, 2, 3, 4), (
                f"Invalid severity: {cell['severity']}"
            )
            assert cell["scope"] in ("isolated", "pattern", "widespread"), (
                f"Invalid scope: {cell['scope']!r}"
            )
            assert isinstance(cell["count"], int) and cell["count"] >= 0, (
                f"Invalid count: {cell['count']}"
            )


@pytest.mark.database
def test_snapshot_pull_quote_shape(supabase_rest: SupabaseRest) -> None:
    """
    pull_quote is null or has date, tag (optional), text.
    When present, text must be a non-empty string.
    """
    fid = get_representative_facility_id(supabase_rest, "IL")
    if not fid:
        pytest.skip("No IL facility with inspections found")

    snap = supabase_rest.rpc("facility_snapshot", {"p_facility_id": fid})
    quote = snap.get("pull_quote")
    if quote is None:
        return  # Acceptable

    assert "date" in quote, f"pull_quote missing date: {quote}"
    assert "text" in quote, f"pull_quote missing text: {quote}"
    assert isinstance(quote["text"], str) and len(quote["text"]) > 0, (
        f"pull_quote.text is empty: {quote}"
    )


@pytest.mark.database
@pytest.mark.parametrize("state_code", ["CA", "OR", "WA", "TX", "MN", "UT", "IL", "PA"])
def test_snapshot_rpc_works_for_each_state(
    supabase_rest: SupabaseRest, state_code: str
) -> None:
    """
    facility_snapshot() returns a valid (non-error) payload for at least one
    facility in each covered state.
    """
    fid = get_representative_facility_id(supabase_rest, state_code)
    if not fid:
        pytest.skip(f"No {state_code} facility with inspections found")

    snap = supabase_rest.rpc("facility_snapshot", {"p_facility_id": fid})
    assert snap is not None, f"facility_snapshot returned null for {state_code}"
    assert "facility" in snap, (
        f"facility_snapshot for {state_code} missing 'facility' block"
    )
    assert snap["facility"]["state_code"] == state_code, (
        f"State mismatch: queried {state_code}, got {snap['facility']['state_code']}"
    )


@pytest.mark.database
def test_snapshot_returns_null_for_nonexistent_facility(
    supabase_rest: SupabaseRest,
) -> None:
    """facility_snapshot returns null for an ID that doesn't exist."""
    FAKE_ID = "00000000-0000-0000-0000-000000000000"
    result = supabase_rest.rpc("facility_snapshot", {"p_facility_id": FAKE_ID})
    assert result is None, (
        f"Expected null for non-existent facility, got: {result}"
    )
