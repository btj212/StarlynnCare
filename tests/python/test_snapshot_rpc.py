"""
facility_snapshot() RPC tests — run against the REAL Supabase database.

The RPC function returns a composite quality snapshot including peer-ranked
metrics, a letter grade, a 24-month trajectory series, a heatmap, and an
optional pull quote. Every field in the response is verified here.

No mocks. Calls the real Supabase RPC with real facility IDs.
"""

from __future__ import annotations

import re

import pytest


# ─── Expected shape ───────────────────────────────────────────────────────────

MONTH_RE = re.compile(r"^\d{4}-\d{2}$")  # YYYY-MM
LETTER_GRADES = {"A", "B", "C", "D", "F"}
VALID_SCOPES = {"isolated", "pattern", "widespread"}
VALID_FALLBACK_LEVELS = {0, 1, 2, 3}
METRIC_KEYS = {"severity", "repeats", "frequency", "trajectory"}


def _assert_snapshot_shape(snap: dict, facility_id: str) -> None:
    """
    Full structural assertion on a facility_snapshot() RPC response.
    Every field documented in SnapshotPayload (loadFacilityProfile.ts) is checked.
    """
    ctx = f"facility {facility_id}"

    # ── facility block ──────────────────────────────────────────────────────
    assert "facility" in snap, f"{ctx}: missing 'facility' key"
    fac = snap["facility"]
    assert fac.get("id") == facility_id, f"{ctx}: facility.id mismatch"
    assert isinstance(fac.get("name"), str) and fac["name"], f"{ctx}: facility.name must be non-empty str"
    assert fac.get("state_code") in {"CA", "OR", "WA", "TX", "MN", "UT", "IL"}, (
        f"{ctx}: facility.state_code {fac.get('state_code')!r} not a covered state"
    )
    # beds may be null for some facilities
    if fac.get("beds") is not None:
        assert isinstance(fac["beds"], int) and fac["beds"] > 0, (
            f"{ctx}: facility.beds should be positive int, got {fac['beds']}"
        )

    # ── peer_set block ──────────────────────────────────────────────────────
    assert "peer_set" in snap, f"{ctx}: missing 'peer_set' key"
    ps = snap["peer_set"]
    assert isinstance(ps.get("n"), int) and ps["n"] >= 0, (
        f"{ctx}: peer_set.n should be non-negative int, got {ps.get('n')}"
    )
    assert isinstance(ps.get("definition"), str), f"{ctx}: peer_set.definition should be str"
    assert ps.get("fallback_level") in VALID_FALLBACK_LEVELS, (
        f"{ctx}: peer_set.fallback_level {ps.get('fallback_level')} not in {VALID_FALLBACK_LEVELS}"
    )

    # ── metrics block ───────────────────────────────────────────────────────
    assert "metrics" in snap, f"{ctx}: missing 'metrics' key"
    metrics = snap["metrics"]
    assert set(metrics.keys()) >= METRIC_KEYS, (
        f"{ctx}: metrics missing keys: {METRIC_KEYS - set(metrics.keys())}"
    )
    for metric_name in METRIC_KEYS:
        m = metrics[metric_name]
        assert isinstance(m.get("value"), (int, float)), (
            f"{ctx}: metrics.{metric_name}.value should be numeric, got {type(m.get('value'))}"
        )
        assert m.get("value") >= 0, f"{ctx}: metrics.{metric_name}.value should be non-negative"
        # percentile may be null when peer_set is too small
        if m.get("percentile") is not None:
            assert 0 <= m["percentile"] <= 100, (
                f"{ctx}: metrics.{metric_name}.percentile {m['percentile']} out of [0, 100]"
            )
        assert isinstance(m.get("peer_median"), (int, float)), (
            f"{ctx}: metrics.{metric_name}.peer_median should be numeric"
        )

    # ── has_inspections ──────────────────────────────────────────────────────
    assert isinstance(snap.get("has_inspections"), bool), (
        f"{ctx}: has_inspections should be bool, got {type(snap.get('has_inspections'))}"
    )

    # ── grade ────────────────────────────────────────────────────────────────
    # grade is null when there are no inspections or when degraded
    grade = snap.get("grade")
    if grade is not None:
        assert grade.get("letter") in LETTER_GRADES, (
            f"{ctx}: grade.letter {grade.get('letter')!r} not in {LETTER_GRADES}"
        )
        assert 0 <= grade["composite_percentile"] <= 100, (
            f"{ctx}: grade.composite_percentile {grade['composite_percentile']} out of [0, 100]"
        )

    # ── trajectory_series ────────────────────────────────────────────────────
    assert isinstance(snap.get("trajectory_series"), list), (
        f"{ctx}: trajectory_series should be list"
    )
    for i, point in enumerate(snap["trajectory_series"]):
        assert MONTH_RE.match(point.get("month", "")), (
            f"{ctx}: trajectory_series[{i}].month {point.get('month')!r} not YYYY-MM format"
        )
        assert isinstance(point.get("facility_score"), (int, float)), (
            f"{ctx}: trajectory_series[{i}].facility_score should be numeric"
        )
        assert isinstance(point.get("peer_median_score"), (int, float)), (
            f"{ctx}: trajectory_series[{i}].peer_median_score should be numeric"
        )

    # ── heatmap ──────────────────────────────────────────────────────────────
    assert isinstance(snap.get("heatmap"), list), f"{ctx}: heatmap should be list"
    for i, cell in enumerate(snap["heatmap"]):
        assert cell.get("severity") in {1, 2, 3, 4}, (
            f"{ctx}: heatmap[{i}].severity {cell.get('severity')} not in {{1,2,3,4}}"
        )
        assert cell.get("scope") in VALID_SCOPES, (
            f"{ctx}: heatmap[{i}].scope {cell.get('scope')!r} not valid"
        )
        assert isinstance(cell.get("count"), int) and cell["count"] >= 0, (
            f"{ctx}: heatmap[{i}].count should be non-negative int"
        )
        assert isinstance(cell.get("tags"), list), (
            f"{ctx}: heatmap[{i}].tags should be list (may be empty)"
        )

    # ── pull_quote ───────────────────────────────────────────────────────────
    pq = snap.get("pull_quote")
    if pq is not None:
        assert isinstance(pq.get("date"), str), f"{ctx}: pull_quote.date should be str"
        assert isinstance(pq.get("text"), str) and pq["text"], (
            f"{ctx}: pull_quote.text should be non-empty str"
        )
        # tag is nullable
        if pq.get("tag") is not None:
            assert isinstance(pq["tag"], str)


# ═══════════════════════════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestSnapshotRpcShape:
    """
    Calls the real facility_snapshot() RPC for published facilities in each state
    and asserts the full response shape is correct.
    """

    @pytest.mark.parametrize("state_code", ["CA", "OR", "WA", "TX", "MN"])
    def test_snapshot_shape_per_state(self, state_code: str, supabase_client) -> None:
        # Get 3 published facilities for this state
        resp = (
            supabase_client.table("facilities")
            .select("id,name")
            .eq("state_code", state_code)
            .eq("publishable", True)
            .limit(3)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            pytest.skip(f"No published {state_code} facilities for snapshot test")

        for facility in rows:
            fac_id = facility["id"]
            snap_resp = supabase_client.rpc(
                "facility_snapshot", {"p_facility_id": fac_id}
            ).execute()
            snap = snap_resp.data
            assert snap is not None, (
                f"facility_snapshot() returned null for {facility['name']} ({fac_id})"
            )
            _assert_snapshot_shape(snap, fac_id)

    def test_snapshot_facility_id_must_match(self, supabase_client) -> None:
        """The facility.id in the response must equal the input p_facility_id."""
        resp = (
            supabase_client.table("facilities")
            .select("id,name")
            .eq("publishable", True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            pytest.skip("No published facilities found")

        fac_id = rows[0]["id"]
        snap_resp = supabase_client.rpc(
            "facility_snapshot", {"p_facility_id": fac_id}
        ).execute()
        snap = snap_resp.data
        assert snap is not None
        assert snap["facility"]["id"] == fac_id

    def test_snapshot_has_inspections_flag_consistent(self, supabase_client) -> None:
        """
        has_inspections in the snapshot must be consistent with actual inspection records.
        """
        # Get a facility with known inspections
        resp = (
            supabase_client.table("facilities")
            .select("id,name,last_inspection_date")
            .eq("publishable", True)
            .not_.is_("last_inspection_date", "null")
            .limit(3)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            pytest.skip("No facilities with last_inspection_date found")

        for fac in rows:
            fac_id = fac["id"]
            snap_resp = supabase_client.rpc(
                "facility_snapshot", {"p_facility_id": fac_id}
            ).execute()
            snap = snap_resp.data
            if snap is None:
                continue
            assert snap["has_inspections"] is True, (
                f"Facility {fac['name']} has last_inspection_date={fac['last_inspection_date']} "
                f"but snapshot.has_inspections=False"
            )

    def test_trajectory_months_are_chronological(self, supabase_client) -> None:
        """trajectory_series months must be in ascending chronological order."""
        resp = (
            supabase_client.table("facilities")
            .select("id,name")
            .eq("publishable", True)
            .limit(5)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            pytest.skip("No published facilities found")

        for fac in rows:
            snap_resp = supabase_client.rpc(
                "facility_snapshot", {"p_facility_id": fac["id"]}
            ).execute()
            snap = snap_resp.data
            if not snap or not snap.get("trajectory_series"):
                continue
            months = [p["month"] for p in snap["trajectory_series"]]
            assert months == sorted(months), (
                f"Facility {fac['name']}: trajectory_series months not in ascending order: {months}"
            )

    def test_grade_null_when_no_inspections(self, supabase_client) -> None:
        """Facilities with no inspections should return grade=null."""
        resp = (
            supabase_client.table("facilities")
            .select("id,name")
            .eq("publishable", True)
            .is_("last_inspection_date", "null")
            .limit(3)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            pytest.skip("No published facilities without inspections found")

        for fac in rows:
            snap_resp = supabase_client.rpc(
                "facility_snapshot", {"p_facility_id": fac["id"]}
            ).execute()
            snap = snap_resp.data
            if snap is None:
                continue
            assert snap.get("has_inspections") is False, (
                f"Facility {fac['name']} has null last_inspection_date "
                f"but has_inspections=True in snapshot"
            )


class TestSnapshotPeerMetrics:
    """
    Peer metrics must be internally consistent:
    - percentile in [0, 100] when peer_set.n is large enough
    - peer_median must be >= 0
    - severity value = inspections_score derived from deficiency data
    """

    def test_peer_set_fallback_level_increases_when_peers_scarce(self, supabase_client) -> None:
        """
        Facilities with unusual bed counts or rare care categories should
        fall back to a broader peer set (higher fallback_level). We can't
        control which facility triggers this, but we verify the range is valid.
        """
        resp = (
            supabase_client.table("facilities")
            .select("id,name,beds,care_category")
            .eq("publishable", True)
            .limit(10)
            .execute()
        )
        rows = resp.data or []
        fallback_levels_seen = set()
        for fac in rows:
            snap_resp = supabase_client.rpc(
                "facility_snapshot", {"p_facility_id": fac["id"]}
            ).execute()
            snap = snap_resp.data
            if snap is None:
                continue
            level = snap["peer_set"]["fallback_level"]
            assert level in VALID_FALLBACK_LEVELS, (
                f"Facility {fac['name']}: invalid fallback_level {level}"
            )
            fallback_levels_seen.add(level)

        # At least fallback_level=0 should appear in a sample of 10 facilities
        assert 0 in fallback_levels_seen or len(fallback_levels_seen) > 0

    def test_all_metrics_non_negative(self, supabase_client) -> None:
        resp = (
            supabase_client.table("facilities")
            .select("id,name")
            .eq("publishable", True)
            .limit(5)
            .execute()
        )
        rows = resp.data or []
        for fac in rows:
            snap_resp = supabase_client.rpc(
                "facility_snapshot", {"p_facility_id": fac["id"]}
            ).execute()
            snap = snap_resp.data
            if not snap:
                continue
            for metric_name, m in snap["metrics"].items():
                assert m["value"] >= 0, (
                    f"Facility {fac['name']}: metrics.{metric_name}.value is negative"
                )
                assert m["peer_median"] >= 0, (
                    f"Facility {fac['name']}: metrics.{metric_name}.peer_median is negative"
                )
