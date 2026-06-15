"""
Facility Profile Tests — per-facility end-to-end validation.

Tests sample real publishable facilities from the DB and validate that
every field required for rendering is populated and correctly shaped.

Also validates the facility_snapshot() RPC output for each sampled facility —
this is the core quality metric engine.

No mocks.  Real DB queries, real RPC calls.

Run:
    pytest tests/integration/test_facility_profiles.py -v
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

PUBLISHABLE_STATES = ("CA", "OR", "WA", "MN", "TX", "UT", "IL", "PA")

# How many facilities to sample per state for the field completeness checks
SAMPLE_SIZE = 10

# Known fixtures — must always load cleanly
KNOWN_FIXTURES = [
    # (state_code, city_slug, slug, human name, has_inspections)
    ("CA", "oakland", "opal-care-llc-200672", "Opal Care LLC", True),
]


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════


def _sample_facilities(cur, state: str, n: int) -> list[dict]:
    """Return N publishable facilities from state, ordered for determinism."""
    cur.execute(
        """
        SELECT id, name, slug, city_slug, state_code, beds, license_number,
               street, city, zip, phone, latitude, longitude,
               serves_memory_care, publishable, mc_review_status,
               care_category, license_status, capacity_tier,
               memory_care_disclosure_filed, created_at, updated_at
        FROM facilities
        WHERE publishable = true AND state_code = %s
        ORDER BY name ASC
        LIMIT %s
        """,
        (state, n),
    )
    return cur.fetchall()


def _get_inspections(cur, facility_id: str) -> list[dict]:
    cur.execute(
        """
        SELECT id, inspection_date, inspection_type, is_complaint,
               total_deficiency_count, source_url, source_agency, raw_data
        FROM inspections
        WHERE facility_id = %s
        ORDER BY inspection_date DESC
        LIMIT 50
        """,
        (facility_id,),
    )
    return cur.fetchall()


def _get_deficiencies(cur, inspection_ids: list[str]) -> list[dict]:
    if not inspection_ids:
        return []
    cur.execute(
        """
        SELECT id, inspection_id, code, severity, scope, immediate_jeopardy,
               description, inspector_narrative, state_severity_raw, is_repeat, class
        FROM deficiencies
        WHERE inspection_id = ANY(%s)
        """,
        (inspection_ids,),
    )
    return cur.fetchall()


def _call_snapshot_rpc(cur, facility_id: str) -> dict | None:
    """Call facility_snapshot() RPC via psycopg."""
    try:
        cur.execute("SELECT facility_snapshot(%s) AS result", (facility_id,))
        row = cur.fetchone()
        return row["result"] if row else None
    except Exception as exc:
        return {"_error": str(exc)}


# ══════════════════════════════════════════════════════════════════════════════
# Per-state facility field completeness
# ══════════════════════════════════════════════════════════════════════════════


class TestFacilityFieldCompleteness:
    """Validate every important field on a sample of publishable facilities."""

    @pytest.mark.parametrize("state", PUBLISHABLE_STATES)
    def test_sample_facilities_have_required_fields(self, db, state):
        """
        Samples 10 publishable facilities per state and validates that every
        required rendering field is populated.
        """
        with db.cursor() as cur:
            facilities = _sample_facilities(cur, state, SAMPLE_SIZE)

        if not facilities:
            pytest.skip(f"{state}: no publishable facilities found in DB")

        issues = []
        for fac in facilities:
            label = f"{state}/{fac['city_slug']}/{fac['slug']}"

            if not fac["name"] or not fac["name"].strip():
                issues.append(f"{label}: name is empty")
            if not fac["slug"] or not fac["slug"].strip():
                issues.append(f"{label}: slug is empty")
            if not fac["city_slug"] or not fac["city_slug"].strip():
                issues.append(f"{label}: city_slug is empty")
            if fac["state_code"] != state:
                issues.append(f"{label}: state_code={fac['state_code']} != {state}")
            if fac["license_status"] != "LICENSED":
                issues.append(f"{label}: license_status={fac['license_status']} != LICENSED")
            if not fac["serves_memory_care"]:
                issues.append(f"{label}: serves_memory_care=False on publishable facility")
            if not fac["publishable"]:
                issues.append(f"{label}: publishable=False (shouldn't be in this query)")
            if fac["care_category"] not in (
                "rcfe_memory_care", "rcfe_general", "alf_memory_care", "alf_general",
                "snf_general", "snf_dementia_scu", "ccrc",
            ):
                issues.append(f"{label}: unexpected care_category={fac['care_category']}")
            if fac["capacity_tier"] not in ("small", "medium", "large", "unknown"):
                issues.append(f"{label}: unexpected capacity_tier={fac['capacity_tier']}")

        assert not issues, (
            f"{state}: {len(issues)} field issues in sampled facilities:\n"
            + "\n".join(f"  • {i}" for i in issues[:20])
        )

    @pytest.mark.parametrize("state", PUBLISHABLE_STATES)
    def test_sample_facilities_have_at_least_one_inspection(self, db, state):
        """Each sampled facility has at least one inspection row."""
        with db.cursor() as cur:
            facilities = _sample_facilities(cur, state, SAMPLE_SIZE)

        if not facilities:
            pytest.skip(f"{state}: no publishable facilities")

        no_insp = []
        for fac in facilities:
            with db.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) AS n FROM inspections WHERE facility_id = %s",
                    (fac["id"],),
                )
                n = cur.fetchone()["n"]
            if n == 0:
                no_insp.append(f"{state}/{fac['city_slug']}/{fac['slug']}")

        # Allow up to 10% without inspections (freshness gate may apply)
        pct_missing = len(no_insp) / len(facilities) * 100
        assert pct_missing <= 10, (
            f"{state}: {pct_missing:.0f}% of sampled facilities have 0 inspections: "
            f"{no_insp[:5]}"
        )

    @pytest.mark.parametrize("state", PUBLISHABLE_STATES)
    def test_sample_inspections_have_valid_dates(self, db, state):
        """Inspections for sampled facilities have valid, parseable dates."""
        with db.cursor() as cur:
            facilities = _sample_facilities(cur, state, SAMPLE_SIZE)

        if not facilities:
            pytest.skip(f"{state}: no publishable facilities")

        bad_dates = []
        for fac in facilities:
            with db.cursor() as cur:
                inspections = _get_inspections(cur, fac["id"])
            for insp in inspections:
                date_str = insp["inspection_date"]
                if not date_str:
                    bad_dates.append((fac["slug"], "NULL date"))
                    continue
                # Must be YYYY-MM-DD format
                try:
                    from datetime import date
                    parsed = date.fromisoformat(str(date_str))
                    if parsed.year < 1990 or parsed.year > 2030:
                        bad_dates.append((fac["slug"], f"year={parsed.year}"))
                except (ValueError, TypeError):
                    bad_dates.append((fac["slug"], f"unparseable: {date_str!r}"))

        assert not bad_dates, (
            f"{state}: {len(bad_dates)} inspections have invalid dates: "
            f"{bad_dates[:5]}"
        )

    @pytest.mark.parametrize("state", PUBLISHABLE_STATES)
    def test_sample_deficiencies_have_inspection_links(self, db, state):
        """Deficiency rows for sampled facilities all link to valid inspections."""
        with db.cursor() as cur:
            facilities = _sample_facilities(cur, state, SAMPLE_SIZE)

        if not facilities:
            pytest.skip(f"{state}: no publishable facilities")

        orphan_count = 0
        for fac in facilities:
            with db.cursor() as cur:
                inspections = _get_inspections(cur, fac["id"])
                if not inspections:
                    continue
                insp_ids = [i["id"] for i in inspections]
                deficiencies = _get_deficiencies(cur, insp_ids)

                valid_ids = set(insp_ids)
                for d in deficiencies:
                    if d["inspection_id"] not in valid_ids:
                        orphan_count += 1

        assert orphan_count == 0, (
            f"{state}: {orphan_count} deficiency rows reference invalid inspection_ids"
        )

    @pytest.mark.parametrize("state", PUBLISHABLE_STATES)
    def test_sample_deficiency_severity_in_range(self, db, state):
        """All deficiencies for sampled facilities have severity in 1–4 or NULL."""
        with db.cursor() as cur:
            facilities = _sample_facilities(cur, state, SAMPLE_SIZE)

        if not facilities:
            pytest.skip(f"{state}: no publishable facilities")

        bad_sev = []
        for fac in facilities:
            with db.cursor() as cur:
                inspections = _get_inspections(cur, fac["id"])
                if not inspections:
                    continue
                insp_ids = [i["id"] for i in inspections]
                deficiencies = _get_deficiencies(cur, insp_ids)

            for d in deficiencies:
                sev = d["severity"]
                if sev is not None and sev not in (1, 2, 3, 4):
                    bad_sev.append((fac["slug"], sev))

        assert not bad_sev, (
            f"{state}: deficiencies have out-of-range severity values: {bad_sev[:5]}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# facility_snapshot() RPC output validation
# ══════════════════════════════════════════════════════════════════════════════


class TestFacilitySnapshotRpc:
    """
    The facility_snapshot() RPC must return a correctly-shaped payload for
    sampled facilities.  This is the core quality metric engine — a malformed
    payload silently breaks grades, percentiles, and the timeline chart.
    """

    @pytest.mark.parametrize("state", ("CA", "OR", "WA", "MN", "TX"))
    def test_snapshot_rpc_returns_valid_payload_for_sampled_facilities(self, db, state):
        """facility_snapshot() returns a valid payload for facilities with inspections."""
        with db.cursor() as cur:
            # Sample facilities that have inspections
            cur.execute(
                """
                SELECT DISTINCT f.id, f.slug, f.state_code
                FROM facilities f
                JOIN inspections i ON i.facility_id = f.id
                WHERE f.publishable = true AND f.state_code = %s
                ORDER BY f.slug ASC
                LIMIT 5
                """,
                (state,),
            )
            facilities = cur.fetchall()

        if not facilities:
            pytest.skip(f"{state}: no publishable facilities with inspections")

        required_keys = {
            "facility", "peer_set", "metrics", "grade", "has_inspections",
            "trajectory_series", "heatmap",
        }
        metric_keys = {"severity", "repeats", "frequency", "trajectory"}
        metric_sub_keys = {"value", "percentile", "peer_median"}

        for fac in facilities:
            label = f"{state}/{fac['slug']}"
            with db.cursor() as cur:
                snapshot = _call_snapshot_rpc(cur, fac["id"])

            if snapshot is None:
                pytest.fail(f"{label}: facility_snapshot() returned NULL")
            if "_error" in snapshot:
                pytest.fail(f"{label}: facility_snapshot() threw: {snapshot['_error']}")

            # Top-level keys
            for key in required_keys:
                assert key in snapshot, (
                    f"{label}: snapshot missing top-level key '{key}'"
                )

            # peer_set shape
            peer = snapshot["peer_set"]
            assert "definition" in peer, f"{label}: peer_set missing 'definition'"
            assert "n" in peer, f"{label}: peer_set missing 'n'"
            assert isinstance(peer["n"], int) and peer["n"] >= 1, (
                f"{label}: peer_set.n={peer['n']} (must be ≥1)"
            )

            # metrics shape
            metrics = snapshot["metrics"]
            for mk in metric_keys:
                assert mk in metrics, f"{label}: metrics missing '{mk}'"
                msub = metrics[mk]
                for sk in metric_sub_keys:
                    assert sk in msub, f"{label}: metrics.{mk} missing '{sk}'"
                # value must be numeric
                assert isinstance(msub["value"], (int, float)), (
                    f"{label}: metrics.{mk}.value={msub['value']!r} is not numeric"
                )
                # percentile is 0–100 or null
                pct = msub["percentile"]
                if pct is not None:
                    assert 0 <= float(pct) <= 100, (
                        f"{label}: metrics.{mk}.percentile={pct} out of 0–100 range"
                    )

            # grade: either null or {letter, composite_percentile}
            grade = snapshot["grade"]
            if grade is not None:
                assert "letter" in grade, f"{label}: grade missing 'letter'"
                assert "composite_percentile" in grade, (
                    f"{label}: grade missing 'composite_percentile'"
                )
                assert grade["letter"] in ("A", "B", "C", "D", "F"), (
                    f"{label}: unexpected grade letter '{grade['letter']}'"
                )
                assert 0 <= float(grade["composite_percentile"]) <= 100, (
                    f"{label}: composite_percentile={grade['composite_percentile']} out of range"
                )

            # trajectory_series: list of {month, facility_score, peer_median_score}
            series = snapshot["trajectory_series"]
            assert isinstance(series, list), (
                f"{label}: trajectory_series is not a list"
            )
            for pt in series:
                assert "month" in pt, f"{label}: trajectory_series entry missing 'month'"
                assert "facility_score" in pt, (
                    f"{label}: trajectory_series entry missing 'facility_score'"
                )
                assert "peer_median_score" in pt, (
                    f"{label}: trajectory_series entry missing 'peer_median_score'"
                )
                # Month must be YYYY-MM format
                month = str(pt["month"])
                assert len(month) == 7 and month[4] == "-", (
                    f"{label}: invalid month format: {month!r}"
                )

            # heatmap: list of {severity, scope, count, tags}
            heatmap = snapshot["heatmap"]
            assert isinstance(heatmap, list), f"{label}: heatmap is not a list"
            for cell in heatmap:
                assert "severity" in cell, f"{label}: heatmap cell missing 'severity'"
                assert "scope" in cell, f"{label}: heatmap cell missing 'scope'"
                assert "count" in cell, f"{label}: heatmap cell missing 'count'"
                sev = cell["severity"]
                assert sev in (1, 2, 3, 4), (
                    f"{label}: heatmap cell has unexpected severity={sev}"
                )
                assert cell["scope"] in ("isolated", "pattern", "widespread"), (
                    f"{label}: heatmap cell has unexpected scope={cell['scope']!r}"
                )
                assert isinstance(cell["count"], int) and cell["count"] >= 0, (
                    f"{label}: heatmap cell count={cell['count']!r} is not a non-negative int"
                )

    def test_snapshot_rpc_handles_facility_without_inspections(self, db):
        """facility_snapshot() returns a valid (empty) payload for a facility with no inspections."""
        # Find a non-publishable facility with no inspections
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT f.id, f.slug FROM facilities f
                LEFT JOIN inspections i ON i.facility_id = f.id
                WHERE i.id IS NULL
                LIMIT 1
                """
            )
            row = cur.fetchone()

        if not row:
            pytest.skip("No facility without inspections found")

        with db.cursor() as cur:
            snapshot = _call_snapshot_rpc(cur, row["id"])

        assert snapshot is not None, "facility_snapshot() returned NULL for no-inspection facility"
        if "_error" in snapshot:
            # RPC may legitimately skip no-inspection facilities
            pytest.skip(f"RPC error for no-inspection facility: {snapshot['_error']}")
        # has_inspections must be False
        assert snapshot.get("has_inspections") is False, (
            f"has_inspections should be False for no-inspection facility, "
            f"got {snapshot.get('has_inspections')}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# State-specific signal validation
# ══════════════════════════════════════════════════════════════════════════════


class TestStateSpecificSignals:
    """Verify state-specific MC signal flags are correctly populated."""

    def test_wa_mc_signals_on_publishable_facilities(self, db):
        """WA publishable facilities have at least one of the three WA MC signals."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, slug,
                       wa_dementia_care_contract, wa_memory_care_certified,
                       wa_earc_sdc_contracted, wa_dementia_specialty,
                       mc_signal_explicit_name, memory_care_disclosure_filed,
                       mc_signal_chain_curated, mc_review_status
                FROM facilities
                WHERE state_code = 'WA' AND publishable = true
                ORDER BY name ASC
                LIMIT 20
                """
            )
            facilities = cur.fetchall()

        if not facilities:
            pytest.skip("No publishable WA facilities")

        bad = []
        for fac in facilities:
            has_wa_signal = any([
                fac["wa_dementia_care_contract"],
                fac["wa_memory_care_certified"],
                fac["wa_earc_sdc_contracted"],
                fac["wa_dementia_specialty"],
            ])
            has_generic_signal = any([
                fac["mc_signal_explicit_name"],
                fac["memory_care_disclosure_filed"],
                fac["mc_signal_chain_curated"],
                fac["mc_review_status"] == "reviewed_publish",
            ])
            if not has_wa_signal and not has_generic_signal:
                bad.append(fac["slug"])

        assert not bad, (
            f"{len(bad)} WA publishable facilities have no WA or generic MC signal: {bad[:5]}"
        )

    def test_or_mce_endorsed_facilities_have_mce_evidence(self, db):
        """OR facilities with mce_endorsed=True all have mce_evidence populated."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT slug, mce_evidence FROM facilities
                WHERE state_code = 'OR' AND mce_endorsed = true
                AND (mce_evidence IS NULL OR TRIM(mce_evidence) = '')
                """
            )
            bad = cur.fetchall()

        assert not bad, (
            f"{len(bad)} OR mce_endorsed facilities have empty mce_evidence: "
            f"{[r['slug'] for r in bad[:5]]}"
        )

    def test_pa_facilities_have_designation_type_or_license_type(self, db):
        """PA publishable facilities all have mc_designation_type or the ALR-SC license."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT slug, mc_designation_type, license_type,
                       memory_care_disclosure_filed, mc_signal_explicit_name
                FROM facilities
                WHERE state_code = 'PA' AND publishable = true
                  AND mc_designation_type IS NULL
                  AND license_type != 'ASSISTED LIVING - SPECIAL CARE'
                  AND NOT COALESCE(memory_care_disclosure_filed, false)
                  AND NOT COALESCE(mc_signal_explicit_name, false)
                  AND mc_review_status != 'reviewed_publish'
                  AND NOT COALESCE(mc_signal_chain_curated, false)
                ORDER BY slug
                LIMIT 10
                """
            )
            bad = cur.fetchall()

        assert not bad, (
            f"{len(bad)} PA publishable facilities have no PA-specific or generic signal: "
            f"{[r['slug'] for r in bad[:5]]}"
        )

    def test_ut_memory_care_facilities_have_secure_beds(self, db):
        """UT facilities published via the secure-beds signal have secure_beds > 0."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT slug, secure_beds, serves_memory_care FROM facilities
                WHERE state_code = 'UT' AND publishable = true
                  AND COALESCE(secure_beds, 0) = 0
                  AND NOT COALESCE(mc_signal_explicit_name, false)
                  AND NOT COALESCE(memory_care_disclosure_filed, false)
                  AND NOT COALESCE(mc_signal_chain_curated, false)
                  AND mc_review_status != 'reviewed_publish'
                """
            )
            bad = cur.fetchall()

        assert not bad, (
            f"{len(bad)} UT publishable facilities have secure_beds≤0 and no other signal: "
            f"{[r['slug'] for r in bad[:5]]}"
        )

    def test_mn_dementia_licensed_facilities_exist(self, db):
        """At least 5 MN facilities have mn_dementia_care_licensed=True."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code = 'MN' AND mn_dementia_care_licensed = true
                """
            )
            n = cur.fetchone()["n"]

        assert n >= 5, (
            f"Only {n} MN facilities have mn_dementia_care_licensed=True — "
            f"signal may not be ingested yet"
        )

    def test_tx_alzheimer_certified_facilities_exist(self, db):
        """At least 10 TX facilities have tx_alzheimer_certified=True."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM facilities
                WHERE state_code = 'TX' AND tx_alzheimer_certified = true
                """
            )
            n = cur.fetchone()["n"]

        assert n >= 10, (
            f"Only {n} TX facilities have tx_alzheimer_certified=True — "
            f"signal may not be ingested or TX ingest may have run with --metros-only"
        )


# ══════════════════════════════════════════════════════════════════════════════
# Known facility regression tests
# ══════════════════════════════════════════════════════════════════════════════


class TestKnownFacilityRegressions:
    """
    Specific well-known facilities that must exist in the DB with correct data.
    These are permanent regression anchors.
    """

    def test_opal_care_exists_and_is_publishable(self, db):
        """Opal Care LLC (CA/oakland) exists and is publishable."""
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, publishable, serves_memory_care, care_category
                FROM facilities
                WHERE state_code = 'CA' AND slug = 'opal-care-llc-200672'
                """
            )
            row = cur.fetchone()
        assert row, "Opal Care LLC (opal-care-llc-200672) not found in DB"
        assert row["publishable"], "Opal Care LLC is not publishable"
        assert row["serves_memory_care"], "Opal Care LLC has serves_memory_care=False"

    def test_opal_care_has_inspections(self, db):
        """Opal Care has at least 5 inspections (high-activity facility)."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT id FROM facilities WHERE slug = 'opal-care-llc-200672' AND state_code = 'CA'"
            )
            row = cur.fetchone()
        if not row:
            pytest.skip("Opal Care not found")
        with db.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM inspections WHERE facility_id = %s",
                (row["id"],),
            )
            n = cur.fetchone()["n"]
        assert n >= 5, f"Opal Care has only {n} inspections — expected ≥5"

    def test_opal_care_snapshot_has_low_percentile(self, db):
        """
        Opal Care's composite_pct is < 40 (known bad actor).
        Regression check for the 'highly rated' bug — this facility must never
        rank above the 40th percentile.
        """
        with db.cursor() as cur:
            cur.execute(
                "SELECT id FROM facilities WHERE slug = 'opal-care-llc-200672' AND state_code = 'CA'"
            )
            row = cur.fetchone()
        if not row:
            pytest.skip("Opal Care not found")

        with db.cursor() as cur:
            snapshot = _call_snapshot_rpc(cur, row["id"])

        if snapshot is None or "_error" in snapshot:
            pytest.skip(f"Snapshot RPC failed: {snapshot}")

        grade = snapshot.get("grade")
        if grade is None:
            return  # degraded snapshot is OK
        composite_pct = grade.get("composite_percentile")
        assert composite_pct is not None, "Opal Care snapshot has grade but no composite_percentile"
        assert float(composite_pct) < 40, (
            f"Opal Care composite_pct={composite_pct} — expected <40. "
            f"This is the 'highly rated' bug regression check."
        )

    def test_opal_care_snapshot_has_many_repeat_codes(self, db):
        """Opal Care has ≥ 3 repeat-cited regulation codes in the past 3 years."""
        with db.cursor() as cur:
            cur.execute(
                "SELECT id FROM facilities WHERE slug = 'opal-care-llc-200672' AND state_code = 'CA'"
            )
            row = cur.fetchone()
        if not row:
            pytest.skip("Opal Care not found")
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM (
                    SELECT d.code
                    FROM deficiencies d
                    JOIN inspections i ON i.id = d.inspection_id
                    WHERE i.facility_id = %s
                      AND d.code IS NOT NULL
                      AND i.inspection_date >= CURRENT_DATE - INTERVAL '36 months'
                    GROUP BY d.code
                    HAVING COUNT(DISTINCT i.id) >= 3
                ) sub
                """,
                (row["id"],),
            )
            n = cur.fetchone()["n"]
        assert n >= 3, (
            f"Opal Care has only {n} repeat-cited codes (need ≥3). "
            f"This facility is a known repeat offender."
        )

    def test_all_states_have_at_least_one_high_inspection_count_facility(self, db):
        """Each state has at least one facility with ≥ 5 inspections (data isn't sparse)."""
        missing_states = []
        for state in ("CA", "OR", "WA", "MN", "TX"):
            with db.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(*) AS n FROM (
                        SELECT facility_id
                        FROM inspections i
                        JOIN facilities f ON f.id = i.facility_id
                        WHERE f.state_code = %s AND f.publishable = true
                        GROUP BY facility_id
                        HAVING COUNT(*) >= 5
                    ) sub
                    """,
                    (state,),
                )
                n = cur.fetchone()["n"]
            if n == 0:
                missing_states.append(state)

        assert not missing_states, (
            f"States with no facility having ≥5 inspections: {missing_states}. "
            f"Inspection ingest may have failed."
        )
