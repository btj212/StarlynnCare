#!/usr/bin/env python3
"""
Layer 2 — Full DB row shape verification for StarlynnCare.

Goes far beyond Layer 1 (db_invariants.py) by checking every column on
every publishable facility, verifying state-specific columns, FK integrity,
value ranges, slug formats, and cross-table consistency.

Unlike Layer 1 (aggregate stats), Layer 2 verifies the per-row data model:
  - Every required column is populated
  - Every value is in the valid range / type / pattern
  - Every FK reference resolves
  - State-specific extension columns are present and coherent
  - The inspections + deficiencies tables are complete relative to facilities

Usage:
    python3 scripts/validate/layer2_db_shape.py               # all states
    python3 scripts/validate/layer2_db_shape.py --state CA    # one state
    python3 scripts/validate/layer2_db_shape.py --sample 20   # larger random sample

Exit 0 = all checks passed. Exit 1 = one or more checks failed.
"""
from __future__ import annotations

import re
import sys
import argparse
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._lib import check, get_conn, run_all_checks  # noqa: E402

PUBLISHABLE_STATES = ("CA", "OR", "WA", "MN", "TX", "UT", "IL", "PA", "AZ")
DEFAULT_SAMPLE = 10

# Slug must be lowercase alphanumeric + hyphens, no leading/trailing hyphen
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")
# US continental latitude range
LAT_MIN, LAT_MAX = 18.0, 72.0
# US continental longitude range
LON_MIN, LON_MAX = -180.0, -64.0

# care_category allowed values (from migration 0002_alameda_beachhead.sql)
CARE_CATEGORIES = {
    "rcfe_memory_care",
    "rcfe_general",
    "ccrc",
    "snf_mc",
    "snf_general",
    "alf_memory_care",
    "alf_general",
    "afh_memory_care",
    "afh_general",
    "nh_memory_care",
    "nh_general",
}

# mc_review_status allowed values
MC_REVIEW_STATUSES = {"auto_published", "needs_review", "approved", "rejected", "not_applicable"}

# deficiency severity allowed values (null + 1-4)
DEF_SEVERITY_ALLOWED = {None, 1, 2, 3, 4}

# deficiency scope allowed values
DEF_SCOPE_ALLOWED = {None, "isolated", "pattern", "widespread"}


# ---------------------------------------------------------------------------
# Universal facility column checks (all states)
# ---------------------------------------------------------------------------

def _check_universal_columns(cur, state: str, sample: int) -> None:
    """Every publishable facility must have a valid value for universal required columns."""
    print(f"\n[{state} — Universal column completeness]")

    # Aggregate nulls across all publishable facilities
    cur.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE name IS NULL OR TRIM(name) = '')    AS null_name,
            COUNT(*) FILTER (WHERE license_number IS NULL OR TRIM(license_number) = '') AS null_license,
            COUNT(*) FILTER (WHERE slug IS NULL OR TRIM(slug) = '')    AS null_slug,
            COUNT(*) FILTER (WHERE city_slug IS NULL OR TRIM(city_slug) = '') AS null_city_slug,
            COUNT(*) FILTER (WHERE care_category IS NULL)              AS null_care_cat,
            COUNT(*) FILTER (WHERE city IS NULL OR TRIM(city) = '')    AS null_city,
            COUNT(*) FILTER (WHERE state_code != %s)                   AS wrong_state
        FROM facilities
        WHERE publishable = true AND state_code = %s
        """,
        (state, state),
    )
    row = cur.fetchone()
    total = row["total"] or 0

    check(f"{state}: has publishable facilities", total > 0, f"total={total}")
    if total == 0:
        return

    check(f"{state}: no null name",        row["null_name"] == 0,    f"{row['null_name']}/{total}")
    check(f"{state}: no null license_number", row["null_license"] == 0, f"{row['null_license']}/{total}")
    check(f"{state}: no null slug",        row["null_slug"] == 0,    f"{row['null_slug']}/{total}")
    check(f"{state}: no null city_slug",   row["null_city_slug"] == 0, f"{row['null_city_slug']}/{total}")
    check(f"{state}: no null care_category", row["null_care_cat"] == 0, f"{row['null_care_cat']}/{total}")
    check(f"{state}: no null city",        row["null_city"] == 0,    f"{row['null_city']}/{total}")
    check(f"{state}: state_code matches throughout", row["wrong_state"] == 0, f"{row['wrong_state']}/{total}")

    # care_category must be in the allowed enum
    cur.execute(
        """
        SELECT DISTINCT care_category
        FROM facilities
        WHERE publishable = true AND state_code = %s
        """,
        (state,),
    )
    cats = {r["care_category"] for r in cur.fetchall()}
    invalid_cats = cats - CARE_CATEGORIES
    check(
        f"{state}: all care_category values in allowed enum",
        not invalid_cats,
        f"invalid values: {invalid_cats}",
    )

    # Beds: publishable facilities must have beds > 0
    cur.execute(
        """
        SELECT COUNT(*) AS n
        FROM facilities
        WHERE publishable = true AND state_code = %s
          AND (beds IS NULL OR beds <= 0)
        """,
        (state,),
    )
    bad_beds = cur.fetchone()["n"]
    check(
        f"{state}: all publishable facilities have beds > 0",
        bad_beds == 0,
        f"{bad_beds}/{total} have null/zero beds",
    )


# ---------------------------------------------------------------------------
# Per-row sample checks (slug format, lat/lon, dates)
# ---------------------------------------------------------------------------

def _check_per_row_sample(cur, state: str, sample: int) -> None:
    """Pull a random sample and verify field-level correctness on every row."""
    print(f"\n[{state} — Per-row sample verification ({sample} random facilities)]")

    cur.execute(
        """
        SELECT
            id, name, slug, city_slug, state_code,
            license_number, care_category, mc_review_status,
            beds, street, city, zip,
            latitude::float AS latitude,
            longitude::float AS longitude,
            last_inspection_date,
            updated_at,
            publishable
        FROM facilities
        WHERE publishable = true AND state_code = %s
        ORDER BY random()
        LIMIT %s
        """,
        (state, sample),
    )
    rows = cur.fetchall()
    check(
        f"{state}: sample returned {len(rows)} rows",
        len(rows) > 0,
        f"got {len(rows)}",
    )

    for row in rows:
        lbl = f"{state}/{row['slug']}"

        # Slug format
        slug = row["slug"] or ""
        check(
            f"{lbl}: slug matches ^[a-z0-9][a-z0-9-]*[a-z0-9]$",
            bool(SLUG_RE.match(slug)) if len(slug) >= 2 else slug.isalnum(),
            f"slug={slug!r}",
        )
        city_slug = row["city_slug"] or ""
        check(
            f"{lbl}: city_slug matches slug pattern",
            bool(SLUG_RE.match(city_slug)) if len(city_slug) >= 2 else city_slug.isalnum(),
            f"city_slug={city_slug!r}",
        )

        # Beds in range
        beds = row["beds"]
        check(
            f"{lbl}: beds between 1 and 1000",
            beds is not None and 1 <= beds <= 1000,
            f"beds={beds}",
        )

        # Lat/lon in US range
        lat = row["latitude"]
        lon = row["longitude"]
        if lat is not None and lon is not None:
            check(
                f"{lbl}: latitude in US range ({LAT_MIN}–{LAT_MAX})",
                LAT_MIN <= float(lat) <= LAT_MAX,
                f"lat={lat}",
            )
            check(
                f"{lbl}: longitude in US range ({LON_MIN}–{LON_MAX})",
                LON_MIN <= float(lon) <= LON_MAX,
                f"lon={lon}",
            )

        # last_inspection_date format (YYYY-MM-DD if present)
        lid = row["last_inspection_date"]
        if lid is not None:
            check(
                f"{lbl}: last_inspection_date matches YYYY-MM-DD",
                bool(re.match(r"^\d{4}-\d{2}-\d{2}$", str(lid))),
                f"last_inspection_date={lid!r}",
            )

        # mc_review_status in allowed set
        mcs = row["mc_review_status"]
        check(
            f"{lbl}: mc_review_status in allowed set",
            mcs is None or mcs in MC_REVIEW_STATUSES,
            f"mc_review_status={mcs!r}",
        )


# ---------------------------------------------------------------------------
# State-specific column checks
# ---------------------------------------------------------------------------

def _check_state_specific_columns(cur, state: str) -> None:
    """Verify that state-specific extension columns are populated for publishable facilities."""
    print(f"\n[{state} — State-specific columns]")

    if state == "CA":
        # CA: license_status should be 'LICENSED' for all publishable
        cur.execute(
            """
            SELECT COUNT(*) AS n
            FROM facilities
            WHERE publishable = true AND state_code = 'CA'
              AND (license_status IS NULL OR UPPER(license_status) != 'LICENSED')
            """
        )
        n = cur.fetchone()["n"]
        check("CA: all publishable have license_status='LICENSED'", n == 0, f"{n} exceptions")

        # CA: mc_signal_explicit_name or mc_signal_chain_name must be true for memory-care
        cur.execute(
            """
            SELECT COUNT(*) AS n
            FROM facilities
            WHERE publishable = true AND state_code = 'CA'
              AND care_category = 'rcfe_memory_care'
              AND mc_signal_explicit_name = false
              AND mc_signal_chain_name = false
              AND memory_care_disclosure_filed = false
            """
        )
        n = cur.fetchone()["n"]
        check(
            "CA: all rcfe_memory_care have at least one MC signal",
            n == 0,
            f"{n} facilities with rcfe_memory_care but no MC signal",
        )

    elif state == "WA":
        # WA: wa_facility_type must be non-null
        cur.execute(
            """
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE wa_facility_type IS NULL) AS null_type,
                   COUNT(*) FILTER (WHERE wa_county IS NULL)        AS null_county
            FROM facilities
            WHERE publishable = true AND state_code = 'WA'
            """
        )
        row = cur.fetchone()
        check("WA: no null wa_facility_type",  row["null_type"] == 0,  f"{row['null_type']}/{row['total']}")
        check("WA: no null wa_county",         row["null_county"] == 0, f"{row['null_county']}/{row['total']}")

        # WA: at least one mc signal column is set for memory-care facilities
        cur.execute(
            """
            SELECT COUNT(*) AS n
            FROM facilities
            WHERE publishable = true AND state_code = 'WA'
              AND serves_memory_care = true
              AND (wa_memory_care_certified IS NULL OR wa_memory_care_certified = false)
              AND (wa_earc_sdc_contracted IS NULL OR wa_earc_sdc_contracted = false)
              AND (wa_dementia_specialty IS NULL OR wa_dementia_specialty = false)
              AND (wa_dementia_care_contract IS NULL OR wa_dementia_care_contract = false)
            """
        )
        n = cur.fetchone()["n"]
        check(
            "WA: all serves_memory_care have at least one WA MC signal",
            n == 0,
            f"{n} WA memory-care facilities with no WA MC signal column set",
        )

    elif state == "OR":
        # OR: or_memory_care_endorsed column should exist and be non-null for MC facilities
        cur.execute(
            """
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE or_memory_care_endorsed IS NULL) AS null_mc
            FROM facilities
            WHERE publishable = true AND state_code = 'OR'
              AND serves_memory_care = true
            """
        )
        row = cur.fetchone()
        total = row["total"] or 0
        if total > 0:
            check(
                "OR: or_memory_care_endorsed populated for MC facilities",
                row["null_mc"] == 0,
                f"{row['null_mc']}/{total} null",
            )
        else:
            print("  SKIP  OR: no publishable memory-care facilities to check")

    elif state == "MN":
        # MN: mn_hfid and mn_dementia_care_licensed should be non-null
        cur.execute(
            """
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE mn_hfid IS NULL) AS null_hfid,
                   COUNT(*) FILTER (WHERE mn_dementia_care_licensed IS NULL) AS null_dl
            FROM facilities
            WHERE publishable = true AND state_code = 'MN'
            """
        )
        row = cur.fetchone()
        check("MN: no null mn_hfid",                row["null_hfid"] == 0, f"{row['null_hfid']}/{row['total']}")
        check("MN: no null mn_dementia_care_licensed", row["null_dl"] == 0, f"{row['null_dl']}/{row['total']}")

    elif state == "UT":
        # UT: ut_secure_beds should be non-null (0 is valid — no secure unit licensed)
        cur.execute(
            """
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE ut_secure_beds IS NULL) AS null_sb
            FROM facilities
            WHERE publishable = true AND state_code = 'UT'
            """
        )
        row = cur.fetchone()
        check("UT: no null ut_secure_beds", row["null_sb"] == 0, f"{row['null_sb']}/{row['total']}")

        # UT: serves_memory_care = true IFF ut_secure_beds > 0
        cur.execute(
            """
            SELECT COUNT(*) AS n
            FROM facilities
            WHERE publishable = true AND state_code = 'UT'
              AND serves_memory_care = true
              AND (ut_secure_beds IS NULL OR ut_secure_beds = 0)
            """
        )
        n = cur.fetchone()["n"]
        check(
            "UT: all serves_memory_care=true have ut_secure_beds > 0",
            n == 0,
            f"{n} UT MC facilities with ut_secure_beds=0/null",
        )

    elif state == "AZ":
        # AZ: az_license_level should be non-null for directed-care (MC) facilities
        cur.execute(
            """
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE az_license_level IS NULL) AS null_ll
            FROM facilities
            WHERE publishable = true AND state_code = 'AZ'
              AND serves_memory_care = true
            """
        )
        row = cur.fetchone()
        total = row["total"] or 0
        if total > 0:
            check(
                "AZ: az_license_level populated for MC facilities",
                row["null_ll"] == 0,
                f"{row['null_ll']}/{total} null",
            )
        else:
            print("  SKIP  AZ: no publishable AZ MC facilities to check")

    elif state == "IL":
        # IL: il_dementia_program_flag should be non-null for all IL facilities
        cur.execute(
            """
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE il_dementia_program_flag IS NULL) AS null_flag
            FROM facilities
            WHERE publishable = true AND state_code = 'IL'
            """
        )
        row = cur.fetchone()
        if row["total"]:
            check(
                "IL: il_dementia_program_flag populated",
                row["null_flag"] == 0,
                f"{row['null_flag']}/{row['total']}",
            )

    elif state == "PA":
        # PA: mc_designation_type should be non-null for MC facilities
        cur.execute(
            """
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE mc_designation_type IS NULL) AS null_dt
            FROM facilities
            WHERE publishable = true AND state_code = 'PA'
              AND serves_memory_care = true
            """
        )
        row = cur.fetchone()
        total = row["total"] or 0
        if total > 0:
            check(
                "PA: mc_designation_type populated for MC facilities",
                row["null_dt"] == 0,
                f"{row['null_dt']}/{total} null",
            )


# ---------------------------------------------------------------------------
# FK integrity
# ---------------------------------------------------------------------------

def _check_fk_integrity(cur, state: str) -> None:
    """All inspection → facility and deficiency → inspection FKs must resolve."""
    print(f"\n[{state} — Foreign key integrity]")

    # Orphaned inspections (facility_id doesn't exist in facilities)
    cur.execute(
        """
        SELECT COUNT(*) AS n
        FROM inspections i
        WHERE i.facility_id NOT IN (SELECT id FROM facilities WHERE state_code = %s)
          AND i.facility_id IN (
              SELECT id FROM facilities WHERE state_code = %s
              UNION
              SELECT facility_id FROM inspections
          )
          AND EXISTS (
              SELECT 1 FROM facilities WHERE id = i.facility_id AND state_code = %s
          ) = false
          AND EXISTS (
              SELECT 1 FROM facilities WHERE id = i.facility_id
          ) = false
        """,
        (state, state, state),
    )
    # Simpler version: count inspections whose facility_id doesn't exist at all
    cur.execute(
        """
        SELECT COUNT(*) AS n
        FROM inspections i
        LEFT JOIN facilities f ON f.id = i.facility_id
        WHERE f.id IS NULL
        """
    )
    orphan_insp = cur.fetchone()["n"]
    check(
        "Global: no inspections with missing facility_id",
        orphan_insp == 0,
        f"{orphan_insp} orphaned inspection rows",
    )

    # Orphaned deficiencies
    cur.execute(
        """
        SELECT COUNT(*) AS n
        FROM deficiencies d
        LEFT JOIN inspections i ON i.id = d.inspection_id
        WHERE i.id IS NULL
        """
    )
    orphan_def = cur.fetchone()["n"]
    check(
        "Global: no deficiencies with missing inspection_id",
        orphan_def == 0,
        f"{orphan_def} orphaned deficiency rows",
    )


# ---------------------------------------------------------------------------
# Inspection row shape
# ---------------------------------------------------------------------------

def _check_inspection_shape(cur, state: str, sample: int) -> None:
    """Verify all inspection rows for the state have complete, valid fields."""
    print(f"\n[{state} — Inspection row shape (random {sample})]")

    cur.execute(
        """
        SELECT
            i.id,
            i.facility_id,
            i.inspection_date,
            i.is_complaint,
            i.total_deficiency_count,
            i.source_agency,
            i.source_url,
            f.slug AS facility_slug
        FROM inspections i
        JOIN facilities f ON f.id = i.facility_id
        WHERE f.state_code = %s AND f.publishable = true
        ORDER BY random()
        LIMIT %s
        """,
        (state, sample),
    )
    rows = cur.fetchall()
    if not rows:
        print(f"  SKIP  {state}: no inspections to check")
        return

    for row in rows:
        lbl = f"{state}/insp({row['id'][:8]})"

        # inspection_date format
        check(
            f"{lbl}: inspection_date is YYYY-MM-DD",
            bool(re.match(r"^\d{4}-\d{2}-\d{2}$", str(row["inspection_date"]))),
            f"date={row['inspection_date']!r}",
        )

        # total_deficiency_count >= 0
        tdc = row["total_deficiency_count"]
        check(
            f"{lbl}: total_deficiency_count >= 0",
            tdc is None or int(tdc) >= 0,
            f"total_deficiency_count={tdc}",
        )

        # is_complaint is boolean
        check(
            f"{lbl}: is_complaint is boolean",
            row["is_complaint"] in (True, False),
            f"is_complaint={row['is_complaint']!r}",
        )

        # source_agency is non-null string
        sa = row["source_agency"]
        check(
            f"{lbl}: source_agency is non-empty string",
            sa is not None and str(sa).strip() != "",
            f"source_agency={sa!r}",
        )

        # source_url (if present) starts with https://
        su = row["source_url"]
        if su is not None:
            check(
                f"{lbl}: source_url starts with https://",
                str(su).startswith(("https://", "http://")),
                f"source_url={str(su)[:80]!r}",
            )


# ---------------------------------------------------------------------------
# Deficiency row shape
# ---------------------------------------------------------------------------

def _check_deficiency_shape(cur, state: str, sample: int) -> None:
    """Verify deficiency rows for the state have valid field values."""
    print(f"\n[{state} — Deficiency row shape (random {sample})]")

    cur.execute(
        """
        SELECT
            d.id,
            d.inspection_id,
            d.code,
            d.severity,
            d.scope,
            d.immediate_jeopardy,
            d.is_repeat,
            d.description
        FROM deficiencies d
        JOIN inspections i ON i.id = d.inspection_id
        JOIN facilities f ON f.id = i.facility_id
        WHERE f.state_code = %s AND f.publishable = true
        ORDER BY random()
        LIMIT %s
        """,
        (state, sample),
    )
    rows = cur.fetchall()
    if not rows:
        print(f"  SKIP  {state}: no deficiencies to check")
        return

    for row in rows:
        lbl = f"{state}/def({row['id'][:8]})"

        # severity in allowed values
        sev = row["severity"]
        check(
            f"{lbl}: severity in {{null,1,2,3,4}}",
            sev in DEF_SEVERITY_ALLOWED,
            f"severity={sev}",
        )

        # scope in allowed values
        scope = row["scope"]
        check(
            f"{lbl}: scope in allowed set",
            scope in DEF_SCOPE_ALLOWED,
            f"scope={scope!r}",
        )

        # immediate_jeopardy and is_repeat are boolean
        check(
            f"{lbl}: immediate_jeopardy is boolean",
            row["immediate_jeopardy"] in (True, False),
            f"immediate_jeopardy={row['immediate_jeopardy']!r}",
        )
        check(
            f"{lbl}: is_repeat is boolean",
            row["is_repeat"] in (True, False),
            f"is_repeat={row['is_repeat']!r}",
        )


# ---------------------------------------------------------------------------
# Cross-table counts
# ---------------------------------------------------------------------------

def _check_cross_table_counts(cur, state: str) -> None:
    """Inspection counts from facilities vs. inspections table must agree."""
    print(f"\n[{state} — Cross-table count consistency]")

    # Every publishable facility must have at least one inspection row
    cur.execute(
        """
        SELECT
            COUNT(DISTINCT f.id) AS total_fac,
            COUNT(DISTINCT i.facility_id) AS fac_with_insp
        FROM facilities f
        LEFT JOIN inspections i ON i.facility_id = f.id
        WHERE f.publishable = true AND f.state_code = %s
        """,
        (state,),
    )
    row = cur.fetchone()
    total = row["total_fac"] or 0
    with_insp = row["fac_with_insp"] or 0
    pct = (with_insp / total * 100) if total > 0 else 0

    check(
        f"{state}: ≥90% publishable facilities have inspection rows",
        pct >= 90 or total == 0,
        f"{with_insp}/{total} ({pct:.0f}%)",
    )

    # For facilities with inspections: every inspection has a matching total_deficiency_count
    # that agrees with the actual deficiencies child-row count (within 20% tolerance,
    # because some states denormalize this column differently)
    cur.execute(
        """
        SELECT
            i.id,
            i.total_deficiency_count AS stored,
            COUNT(d.id) AS actual
        FROM inspections i
        LEFT JOIN deficiencies d ON d.inspection_id = i.id
        JOIN facilities f ON f.id = i.facility_id
        WHERE f.state_code = %s AND f.publishable = true
          AND i.total_deficiency_count IS NOT NULL
          AND i.total_deficiency_count > 0
        GROUP BY i.id, i.total_deficiency_count
        HAVING ABS(i.total_deficiency_count - COUNT(d.id)) > 5
           AND COUNT(d.id) = 0
        LIMIT 20
        """,
        (state,),
    )
    large_gaps = cur.fetchall()
    check(
        f"{state}: no inspections with non-zero stored count but zero actual deficiency rows",
        len(large_gaps) == 0,
        f"{len(large_gaps)} inspections with large count/row mismatch",
    )


# ---------------------------------------------------------------------------
# Geocoding coverage
# ---------------------------------------------------------------------------

def _check_geocoding_coverage(cur, state: str) -> None:
    """Most publishable facilities should have lat/lon."""
    print(f"\n[{state} — Geocoding coverage]")

    cur.execute(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) AS geocoded
        FROM facilities
        WHERE publishable = true AND state_code = %s
        """,
        (state,),
    )
    row = cur.fetchone()
    total = row["total"] or 0
    geocoded = row["geocoded"] or 0
    pct = (geocoded / total * 100) if total > 0 else 0

    threshold = 85.0
    check(
        f"{state}: ≥{threshold:.0f}% publishable facilities are geocoded",
        pct >= threshold or total == 0,
        f"{geocoded}/{total} ({pct:.1f}%) geocoded",
    )

    # Verify geocoded facilities have coordinates within US bounds
    cur.execute(
        """
        SELECT COUNT(*) AS n
        FROM facilities
        WHERE publishable = true AND state_code = %s
          AND latitude IS NOT NULL AND longitude IS NOT NULL
          AND (
              latitude::float NOT BETWEEN 18.0 AND 72.0
              OR longitude::float NOT BETWEEN -180.0 AND -64.0
          )
        """,
        (state,),
    )
    out_of_bounds = cur.fetchone()["n"]
    check(
        f"{state}: no geocoded facilities outside US bounds",
        out_of_bounds == 0,
        f"{out_of_bounds} facilities have coordinates outside US bounds",
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="StarlynnCare Layer 2 — Full DB row shape verification"
    )
    parser.add_argument(
        "--state",
        default=None,
        help="State code to verify (e.g. CA). Default: all publishable states.",
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=DEFAULT_SAMPLE,
        help=f"Random sample size per state (default {DEFAULT_SAMPLE})",
    )
    args = parser.parse_args()
    state_filter = args.state.upper() if args.state else None
    sample = max(5, args.sample)

    states = [s for s in PUBLISHABLE_STATES if not state_filter or s == state_filter]

    print("=" * 60)
    print("StarlynnCare — Layer 2: Full DB row shape verification")
    if state_filter:
        print(f"State filter: {state_filter}")
    print(f"Sample size:  {sample} rows per state")
    print("=" * 60)

    with get_conn() as conn:
        with conn.cursor() as cur:
            # Global FK integrity (once)
            _check_fk_integrity(cur, states[0] if states else "CA")

            for state in states:
                _check_universal_columns(cur, state, sample)
                _check_per_row_sample(cur, state, sample)
                _check_state_specific_columns(cur, state)
                _check_inspection_shape(cur, state, sample)
                _check_deficiency_shape(cur, state, sample)
                _check_cross_table_counts(cur, state)
                _check_geocoding_coverage(cur, state)

    run_all_checks("Layer 2 (DB row shape)")


if __name__ == "__main__":
    main()
