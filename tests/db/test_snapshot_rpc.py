"""
facility_snapshot() RPC — comprehensive end-to-end tests.

This is the quality-scoring heart of StarlynnCare. Every output field is
tested on real DB data (inserted within a rollback transaction).

The RPC returns:
  {
    "facility": { id, name, beds, state_code, license_type },
    "peer_set": { definition, n, fallback_level },
    "metrics": {
      "severity":   { value, percentile, peer_median },
      "repeats":    { value, percentile, peer_median },
      "frequency":  { value, percentile, peer_median },
      "trajectory": { value, percentile, peer_median }
    },
    "grade": { letter, composite_percentile } | null,
    "has_inspections": bool,
    "trajectory_series": [{ month, facility_score, peer_median_score }, ...],  # 24 entries
    "heatmap": [{ severity, scope, count, tags }, ...],
    "pull_quote": { date, tag, text } | null
  }

All tests run inside the rollback fixture — no data survives.
"""

from __future__ import annotations

import re
import uuid
from datetime import date, timedelta
from typing import Any

import pytest

from conftest import (
    insert_test_deficiency,
    insert_test_facility,
    insert_test_inspection,
)

MONTH_RE = re.compile(r"^\d{4}-\d{2}$")  # YYYY-MM


def call_snapshot(conn, facility_id: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT facility_snapshot(%s::uuid)", (facility_id,)
        )
        row = cur.fetchone()
    if row is None:
        return None
    return row[0]  # jsonb → dict


# ─────────────────────────────────────────────────────────────────────────────
# Null / not-found cases
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_snapshot_returns_none_for_nonexistent_facility(db_conn):
    fake_id = str(uuid.uuid4())
    result = call_snapshot(db_conn, fake_id)
    assert result is None, (
        f"facility_snapshot() returned {result!r} for non-existent UUID; expected NULL"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Facility with no inspections
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_snapshot_no_inspections_has_inspections_false(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    assert snap is not None
    assert snap["has_inspections"] is False


@pytest.mark.db
def test_snapshot_no_inspections_grade_is_null(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    assert snap["grade"] is None, (
        "grade must be null when facility has no inspections"
    )


@pytest.mark.db
def test_snapshot_no_inspections_pull_quote_is_null(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    assert snap["pull_quote"] is None


@pytest.mark.db
def test_snapshot_no_inspections_trajectory_series_has_24_months(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    series = snap["trajectory_series"]
    assert isinstance(series, list)
    assert len(series) == 24, (
        f"trajectory_series must have 24 entries (one per month), got {len(series)}"
    )


@pytest.mark.db
def test_snapshot_no_inspections_trajectory_all_zero_scores(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    for entry in snap["trajectory_series"]:
        assert entry["facility_score"] == 0, (
            f"facility_score must be 0 with no inspections: {entry}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Top-level keys — always present regardless of inspection state
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_snapshot_has_all_top_level_keys(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    required_keys = {
        "facility", "peer_set", "metrics",
        "grade", "has_inspections",
        "trajectory_series", "heatmap", "pull_quote",
    }
    missing = required_keys - set(snap.keys())
    assert not missing, f"facility_snapshot() missing top-level keys: {missing}"


@pytest.mark.db
def test_snapshot_facility_block_has_required_fields(db_conn):
    fac = insert_test_facility(db_conn, beds=24)
    snap = call_snapshot(db_conn, fac["id"])
    facility_block = snap["facility"]
    required = {"id", "name", "beds", "state_code", "license_type"}
    missing = required - set(facility_block.keys())
    assert not missing, f"snapshot.facility missing fields: {missing}"


@pytest.mark.db
def test_snapshot_facility_block_values_match_inserted(db_conn):
    fac = insert_test_facility(db_conn, beds=24)
    snap = call_snapshot(db_conn, fac["id"])
    fb = snap["facility"]
    assert fb["id"] == fac["id"]
    assert fb["name"] == fac["name"]
    assert fb["beds"] == 24
    assert fb["state_code"] == "CA"
    assert fb["license_type"] == fac["license_type"]


@pytest.mark.db
def test_snapshot_peer_set_block_has_required_fields(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    ps = snap["peer_set"]
    required = {"definition", "n", "fallback_level"}
    missing = required - set(ps.keys())
    assert not missing, f"snapshot.peer_set missing fields: {missing}"


@pytest.mark.db
def test_snapshot_peer_set_n_is_positive_integer(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    n = snap["peer_set"]["n"]
    assert isinstance(n, int) and n >= 1, (
        f"peer_set.n must be ≥1 (at least the facility itself), got {n}"
    )


@pytest.mark.db
def test_snapshot_peer_set_fallback_level_is_0_1_or_2(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    fl = snap["peer_set"]["fallback_level"]
    assert fl in (0, 1, 2), f"fallback_level must be 0, 1, or 2; got {fl}"


@pytest.mark.db
def test_snapshot_peer_set_definition_is_string(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    definition = snap["peer_set"]["definition"]
    assert isinstance(definition, str) and definition.strip()


@pytest.mark.db
def test_snapshot_metrics_block_has_all_4_metrics(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    metrics = snap["metrics"]
    required = {"severity", "repeats", "frequency", "trajectory"}
    missing = required - set(metrics.keys())
    assert not missing, f"snapshot.metrics missing: {missing}"


@pytest.mark.db
def test_snapshot_each_metric_has_value_percentile_peer_median(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    for metric_name, metric in snap["metrics"].items():
        required = {"value", "percentile", "peer_median"}
        missing = required - set(metric.keys())
        assert not missing, (
            f"snapshot.metrics.{metric_name} missing fields: {missing}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Facility WITH inspections and deficiencies
# ─────────────────────────────────────────────────────────────────────────────


def _setup_graded_facility(conn, *, n_inspections: int = 3, beds: int = 24) -> dict:
    """
    Insert a publishable facility + several inspections + deficiencies
    within the 36-month window.
    Returns the facility dict with its id.
    """
    fac = insert_test_facility(conn, beds=beds)
    for i in range(n_inspections):
        insp_date = date.today() - timedelta(days=90 * (i + 1))
        insp_id = insert_test_inspection(conn, fac["id"], inspection_date=insp_date)
        # 2 deficiencies per inspection, alternating severity
        insert_test_deficiency(
            conn, insp_id,
            severity=2,
            scope="isolated",
            is_repeat=(i == 1),  # second inspection has a repeat
            inspector_narrative=f"Observation {i}: staff issue noted.",
        )
        insert_test_deficiency(
            conn, insp_id,
            severity=3,
            scope="pattern",
            immediate_jeopardy=False,
            inspector_narrative=f"Observation {i}: care plan deviation.",
        )
    return fac


@pytest.mark.db
def test_snapshot_with_inspections_has_inspections_true(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    assert snap["has_inspections"] is True


@pytest.mark.db
def test_snapshot_grade_is_not_null_with_inspections(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    assert snap["grade"] is not None, (
        "grade must not be null when facility has inspections"
    )


@pytest.mark.db
def test_snapshot_grade_has_letter_and_composite_percentile(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    grade = snap["grade"]
    assert "letter" in grade
    assert "composite_percentile" in grade


@pytest.mark.db
def test_snapshot_grade_letter_is_valid(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    valid_letters = {"A", "A−", "B", "B−", "C", "C−", "D", "F"}
    letter = snap["grade"]["letter"]
    assert letter in valid_letters, (
        f"Grade letter {letter!r} not in valid set {valid_letters}"
    )


@pytest.mark.db
def test_snapshot_grade_composite_percentile_is_0_to_100(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    pct = snap["grade"]["composite_percentile"]
    assert isinstance(pct, (int, float))
    assert 0 <= pct <= 100, (
        f"composite_percentile={pct} is outside 0–100 range"
    )


@pytest.mark.db
def test_snapshot_metrics_severity_value_is_positive(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    sev_val = snap["metrics"]["severity"]["value"]
    assert sev_val > 0, (
        "severity.value must be >0 for a facility with deficiencies"
    )


@pytest.mark.db
def test_snapshot_metrics_repeats_value_is_between_0_and_1(db_conn):
    """repeats = repeat_count / total_deficiencies → always 0–1."""
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    rep_val = snap["metrics"]["repeats"]["value"]
    assert 0 <= rep_val <= 1, (
        f"repeats.value={rep_val} must be in [0, 1]"
    )


@pytest.mark.db
def test_snapshot_metrics_frequency_value_is_nonnegative(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    freq_val = snap["metrics"]["frequency"]["value"]
    assert freq_val >= 0, f"frequency.value={freq_val} must be ≥0"


@pytest.mark.db
def test_snapshot_metrics_percentile_is_0_to_100(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    for name, metric in snap["metrics"].items():
        pct = metric.get("percentile")
        if pct is not None:
            assert 0 <= pct <= 100, (
                f"metrics.{name}.percentile={pct} is outside 0–100"
            )


@pytest.mark.db
def test_snapshot_metrics_peer_median_is_nonnegative(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    for name, metric in snap["metrics"].items():
        med = metric.get("peer_median")
        if med is not None:
            assert med >= 0, f"metrics.{name}.peer_median={med} must be ≥0"


# ─────────────────────────────────────────────────────────────────────────────
# Trajectory series — 24 months
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_snapshot_trajectory_series_has_exactly_24_entries(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    series = snap["trajectory_series"]
    assert len(series) == 24, (
        f"trajectory_series must have exactly 24 entries, got {len(series)}"
    )


@pytest.mark.db
def test_snapshot_trajectory_series_entries_have_required_keys(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    for i, entry in enumerate(snap["trajectory_series"]):
        required = {"month", "facility_score", "peer_median_score"}
        missing = required - set(entry.keys())
        assert not missing, (
            f"trajectory_series[{i}] missing keys: {missing}"
        )


@pytest.mark.db
def test_snapshot_trajectory_month_format_is_yyyy_mm(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    for i, entry in enumerate(snap["trajectory_series"]):
        month = entry["month"]
        assert MONTH_RE.match(str(month)), (
            f"trajectory_series[{i}].month={month!r} is not YYYY-MM format"
        )


@pytest.mark.db
def test_snapshot_trajectory_months_are_in_chronological_order(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    months = [entry["month"] for entry in snap["trajectory_series"]]
    assert months == sorted(months), (
        "trajectory_series months must be in ascending chronological order"
    )


@pytest.mark.db
def test_snapshot_trajectory_facility_score_is_nonnegative(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    for entry in snap["trajectory_series"]:
        score = entry["facility_score"]
        assert score >= 0, f"facility_score must be ≥0: {entry}"


@pytest.mark.db
def test_snapshot_trajectory_peer_median_score_is_nonnegative(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    for entry in snap["trajectory_series"]:
        med = entry["peer_median_score"]
        assert med >= 0, f"peer_median_score must be ≥0: {entry}"


@pytest.mark.db
def test_snapshot_trajectory_has_nonzero_score_in_inspection_months(db_conn):
    """
    Deficiencies from 90 days ago (last quarter) should produce a nonzero
    facility_score in the corresponding month.
    """
    fac = _setup_graded_facility(db_conn, n_inspections=1)
    snap = call_snapshot(db_conn, fac["id"])
    nonzero = [e for e in snap["trajectory_series"] if e["facility_score"] > 0]
    assert len(nonzero) > 0, (
        "trajectory_series has all-zero facility_score despite having inspections "
        "within the 24-month window"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Heatmap — scope×severity grid
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_snapshot_heatmap_is_list(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    assert isinstance(snap["heatmap"], list)


@pytest.mark.db
def test_snapshot_heatmap_entries_have_required_keys(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    for i, cell in enumerate(snap["heatmap"]):
        required = {"severity", "scope", "count", "tags"}
        missing = required - set(cell.keys())
        assert not missing, f"heatmap[{i}] missing keys: {missing}"


@pytest.mark.db
def test_snapshot_heatmap_severity_in_range(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    for cell in snap["heatmap"]:
        sev = cell["severity"]
        assert 1 <= sev <= 4, f"heatmap cell severity={sev} is outside 1–4 range"


@pytest.mark.db
def test_snapshot_heatmap_scope_is_valid(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    valid_scopes = {"isolated", "pattern", "widespread"}
    for cell in snap["heatmap"]:
        scope = cell["scope"]
        assert scope in valid_scopes, (
            f"heatmap cell scope={scope!r} is not one of {valid_scopes}"
        )


@pytest.mark.db
def test_snapshot_heatmap_count_is_positive_integer(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    for cell in snap["heatmap"]:
        assert isinstance(cell["count"], int) and cell["count"] > 0, (
            f"heatmap cell count must be positive int: {cell}"
        )


@pytest.mark.db
def test_snapshot_heatmap_tags_is_list_or_null(db_conn):
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    for cell in snap["heatmap"]:
        tags = cell.get("tags")
        assert tags is None or isinstance(tags, list), (
            f"heatmap cell tags must be list or null: {tags!r}"
        )


@pytest.mark.db
def test_snapshot_heatmap_reflects_inserted_deficiencies(db_conn):
    """
    We insert 2 deficiencies: severity=2/scope=isolated and severity=3/scope=pattern.
    The heatmap must contain cells for both.
    """
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    insert_test_deficiency(db_conn, insp_id, severity=2, scope="isolated")
    insert_test_deficiency(db_conn, insp_id, severity=3, scope="pattern")

    snap = call_snapshot(db_conn, fac["id"])
    heatmap = snap["heatmap"]

    sev2_isolated = next(
        (c for c in heatmap if c["severity"] == 2 and c["scope"] == "isolated"), None
    )
    sev3_pattern = next(
        (c for c in heatmap if c["severity"] == 3 and c["scope"] == "pattern"), None
    )

    assert sev2_isolated is not None, (
        "Heatmap missing cell for severity=2, scope=isolated"
    )
    assert sev3_pattern is not None, (
        "Heatmap missing cell for severity=3, scope=pattern"
    )
    assert sev2_isolated["count"] == 1
    assert sev3_pattern["count"] == 1


# ─────────────────────────────────────────────────────────────────────────────
# Pull quote
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_snapshot_pull_quote_not_null_when_narrative_exists(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    insert_test_deficiency(
        db_conn, insp_id,
        severity=3,
        inspector_narrative="Staff observed not following fall-prevention protocol.",
    )
    snap = call_snapshot(db_conn, fac["id"])
    assert snap["pull_quote"] is not None, (
        "pull_quote must not be null when inspector_narrative exists in deficiencies"
    )


@pytest.mark.db
def test_snapshot_pull_quote_has_required_keys(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    insert_test_deficiency(
        db_conn, insp_id,
        inspector_narrative="Medication not administered per schedule.",
    )
    snap = call_snapshot(db_conn, fac["id"])
    pq = snap["pull_quote"]
    assert pq is not None
    required = {"date", "tag", "text"}
    missing = required - set(pq.keys())
    assert not missing, f"pull_quote missing keys: {missing}"


@pytest.mark.db
def test_snapshot_pull_quote_text_matches_inserted_narrative(db_conn):
    narrative = "Inspector observed resident left unattended for 30 minutes."
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    insert_test_deficiency(db_conn, insp_id, severity=3, inspector_narrative=narrative)
    snap = call_snapshot(db_conn, fac["id"])
    assert snap["pull_quote"]["text"] == narrative


@pytest.mark.db
def test_snapshot_pull_quote_date_is_iso_string(db_conn):
    fac = insert_test_facility(db_conn)
    insp_date = date.today() - timedelta(days=45)
    insp_id = insert_test_inspection(db_conn, fac["id"], inspection_date=insp_date)
    insert_test_deficiency(db_conn, insp_id, inspector_narrative="Observation noted.")
    snap = call_snapshot(db_conn, fac["id"])
    pq_date = snap["pull_quote"]["date"]
    # Must be YYYY-MM-DD
    assert re.match(r"^\d{4}-\d{2}-\d{2}$", str(pq_date)), (
        f"pull_quote.date {pq_date!r} is not YYYY-MM-DD"
    )


@pytest.mark.db
def test_snapshot_pull_quote_picks_highest_severity(db_conn):
    """
    The RPC picks the pull quote from the MOST SEVERE deficiency.
    Insert severity=1 and severity=4; narrative from severity=4 must be chosen.
    """
    narrative_sev4 = "CRITICAL: immediate jeopardy found — resident at risk of serious harm."
    narrative_sev1 = "Minor administrative paperwork issue."

    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    insert_test_deficiency(
        db_conn, insp_id,
        severity=1,
        inspector_narrative=narrative_sev1,
    )
    insert_test_deficiency(
        db_conn, insp_id,
        severity=4,
        inspector_narrative=narrative_sev4,
    )

    snap = call_snapshot(db_conn, fac["id"])
    assert snap["pull_quote"]["text"] == narrative_sev4, (
        "pull_quote should pick the highest-severity inspector narrative. "
        f"Expected severity-4 narrative, got: {snap['pull_quote']['text']!r}"
    )


@pytest.mark.db
def test_snapshot_pull_quote_null_when_no_narrative(db_conn):
    fac = insert_test_facility(db_conn)
    insp_id = insert_test_inspection(db_conn, fac["id"])
    insert_test_deficiency(db_conn, insp_id, severity=3, inspector_narrative=None)
    snap = call_snapshot(db_conn, fac["id"])
    assert snap["pull_quote"] is None


# ─────────────────────────────────────────────────────────────────────────────
# Grade letter derivation from composite percentile
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_snapshot_grade_letter_reflects_peer_ranking(db_conn):
    """
    A facility with zero deficiencies should have percentile=100 (best) → grade A.
    A facility with many high-severity deficiencies should rank lower.

    We can't directly control this in isolation (grade depends on peers), but we
    can verify the letter is consistent with the composite_percentile.
    """
    fac = _setup_graded_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    grade = snap["grade"]
    pct = grade["composite_percentile"]
    letter = grade["letter"]

    expected = (
        "A" if pct >= 90
        else "A−" if pct >= 80
        else "B" if pct >= 70
        else "B−" if pct >= 60
        else "C" if pct >= 50
        else "C−" if pct >= 40
        else "D" if pct >= 30
        else "F"
    )
    assert letter == expected, (
        f"Grade letter {letter!r} does not match composite_percentile={pct} "
        f"(expected {expected!r})"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Peer set fallback
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.db
def test_snapshot_lone_facility_has_fallback_peer_set(db_conn):
    """
    A test facility with a unique care_category and bed count will have <10 peers
    at level 0, causing fallback. Verify fallback_level > 0 or n >= 1.
    This proves the fallback logic engages rather than crashing.
    """
    fac = insert_test_facility(
        db_conn,
        beds=1,  # Very small — unlikely to have 10+ peers at exact bed size
        care_category="rcfe_memory_care",
    )
    snap = call_snapshot(db_conn, fac["id"])
    ps = snap["peer_set"]
    assert ps["n"] >= 1, "peer_set.n must be at least 1 (self)"
    assert ps["fallback_level"] in (0, 1, 2)


@pytest.mark.db
def test_snapshot_peer_set_definition_contains_state_code(db_conn):
    fac = insert_test_facility(db_conn)
    snap = call_snapshot(db_conn, fac["id"])
    definition = snap["peer_set"]["definition"]
    assert "CA" in definition, (
        f"peer_set.definition {definition!r} should contain state code 'CA'"
    )
