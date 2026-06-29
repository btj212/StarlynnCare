#!/usr/bin/env python3
"""
Layer 4 — End-to-end cross-layer data correlation tests.

For a sample of known facilities across all covered states, this test suite
verifies that data is consistent across three independent data surfaces:

  DB layer    — Supabase Postgres (via psycopg + DATABASE_URL)
  API layer   — /api/facilities/{state} (live production JSON)
  HTML layer  — /{state}/{city_slug}/{slug} (live production page render)

If a field has a given value in the DB, it must appear correctly in the API
response AND be rendered visibly on the live facility profile page.

This proves the complete pipeline is working end-to-end without any layer
silently dropping or misrepresenting data.

Requires DATABASE_URL + live production site. Runs in GitHub Actions.

Exit 0 = all checks passed. Exit 1 = one or more checks failed.
"""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests._lib import (  # noqa: E402
    check,
    get_conn,
    run_all_checks,
    fetch_page,
    make_session,
    PRODUCTION_URL,
    COVERED_STATES,
    HTTP_TIMEOUT,
)

# ── How many facilities to sample per state for E2E correlation ────────────────
SAMPLE_PER_STATE = 3


# ── Pull test fixtures from the live DB ────────────────────────────────────────

def _sample_facilities(cur, state_code: str, n: int) -> list[dict]:
    """
    Return n publishable facilities for the state, selecting those with the
    richest data (has inspections, has license_number, has lat/lon) so the
    correlation tests have something meaningful to verify.
    """
    cur.execute(
        """
        SELECT
            f.id,
            f.name,
            f.slug,
            f.city_slug,
            f.state_code,
            f.license_number,
            f.beds,
            f.care_category,
            f.serves_memory_care,
            f.latitude,
            f.longitude,
            f.last_inspection_date,
            f.capacity_tier,
            COUNT(i.id) AS inspection_count
        FROM facilities f
        LEFT JOIN inspections i ON i.facility_id = f.id
        WHERE f.state_code = %s
          AND f.publishable = true
          AND f.license_number IS NOT NULL
          AND f.city_slug IS NOT NULL
          AND f.slug IS NOT NULL
        GROUP BY f.id, f.name, f.slug, f.city_slug, f.state_code,
                 f.license_number, f.beds, f.care_category,
                 f.serves_memory_care, f.latitude, f.longitude,
                 f.last_inspection_date, f.capacity_tier
        HAVING COUNT(i.id) > 0
        ORDER BY COUNT(i.id) DESC
        LIMIT %s
        """,
        (state_code, n),
    )
    return [dict(row) for row in cur.fetchall()]


# ── API layer correlation ──────────────────────────────────────────────────────

def _get_api_facilities(sess, state_slug: str) -> dict[str, dict]:
    """Return a map of {facility_id → facility_object} from the API response."""
    url = f"{PRODUCTION_URL}/api/facilities/{state_slug}"
    r = sess.get(url, timeout=HTTP_TIMEOUT * 2)
    if r.status_code != 200:
        return {}
    try:
        payload = r.json()
    except Exception:
        return {}
    return {fac["id"]: fac for fac in payload.get("facilities", []) if "id" in fac}


def test_db_vs_api_field_correlation(cur, sess) -> None:
    """
    For each sampled facility, all DB fields that the API exposes must match
    the values returned by /api/facilities/{state}.
    """
    print("\n[DB ↔ API correlation — field-level match]")

    for state_code, state_slug in COVERED_STATES:
        facilities = _sample_facilities(cur, state_code, SAMPLE_PER_STATE)
        if not facilities:
            print(f"  SKIP  {state_code}: no suitable sample facilities found")
            continue

        # Fetch API response once per state (avoid repeated calls)
        api_map = _get_api_facilities(sess, state_slug)
        if not api_map:
            check(
                f"{state_code}: API response reachable",
                False,
                "could not fetch /api/facilities/" + state_slug,
            )
            continue

        for fac in facilities:
            fac_id = str(fac["id"])
            label = f"{state_code}/{fac['slug']}"

            # Must be present in the API response
            api_fac = api_map.get(fac_id)
            check(
                f"{label}: facility present in /api/facilities/{state_slug}",
                api_fac is not None,
                f"id={fac_id} not found in API response",
            )
            if api_fac is None:
                continue

            # Name must match (API may have slightly different casing — use strip/lower)
            db_name = (fac.get("name") or "").strip().lower()
            api_name = (api_fac.get("name") or "").strip().lower()
            check(
                f"{label}: name matches DB ↔ API",
                db_name == api_name,
                f"DB={db_name!r} API={api_name!r}",
            )

            # License number must match
            db_lic = (fac.get("license_number") or "").strip()
            api_lic = (api_fac.get("license_number") or "").strip()
            check(
                f"{label}: license_number matches DB ↔ API",
                db_lic == api_lic,
                f"DB={db_lic!r} API={api_lic!r}",
            )

            # serves_memory_care must match (bool vs bool)
            db_smc = bool(fac.get("serves_memory_care"))
            api_smc = bool(api_fac.get("serves_memory_care"))
            check(
                f"{label}: serves_memory_care matches DB ↔ API",
                db_smc == api_smc,
                f"DB={db_smc} API={api_smc}",
            )

            # state_code must match
            db_sc = (fac.get("state_code") or "").strip()
            api_sc = (api_fac.get("state_code") or "").strip()
            check(
                f"{label}: state_code matches DB ↔ API",
                db_sc == api_sc,
                f"DB={db_sc!r} API={api_sc!r}",
            )

            # care_category must match
            db_cc = (fac.get("care_category") or "").strip()
            api_cc = (api_fac.get("care_category") or "").strip()
            check(
                f"{label}: care_category matches DB ↔ API",
                db_cc == api_cc,
                f"DB={db_cc!r} API={api_cc!r}",
            )

            # beds must match (numeric)
            db_beds = fac.get("beds")
            api_beds = api_fac.get("beds")
            if db_beds is not None and api_beds is not None:
                check(
                    f"{label}: beds matches DB ↔ API",
                    float(db_beds) == float(api_beds),
                    f"DB={db_beds} API={api_beds}",
                )

            # API URL must follow the canonical 3-segment pattern
            api_url = api_fac.get("url", "")
            expected_suffix = f"/{state_slug}/{fac['city_slug']}/{fac['slug']}"
            check(
                f"{label}: API URL contains canonical path",
                expected_suffix in api_url,
                f"url={api_url!r} expected_suffix={expected_suffix!r}",
            )


# ── HTML layer correlation ─────────────────────────────────────────────────────

def test_db_vs_html_field_correlation(cur) -> None:
    """
    For each sampled facility, key values present in the DB must be
    visible in the rendered HTML of the facility profile page.
    """
    print("\n[DB ↔ HTML correlation — key fields rendered on profile pages]")

    for state_code, state_slug in COVERED_STATES:
        facilities = _sample_facilities(cur, state_code, SAMPLE_PER_STATE)
        if not facilities:
            print(f"  SKIP  {state_code}: no suitable sample facilities found")
            continue

        for fac in facilities:
            url = f"{PRODUCTION_URL}/{state_slug}/{fac['city_slug']}/{fac['slug']}"
            label = f"{state_code}/{fac['slug']}"

            status, body = fetch_page(url, timeout=HTTP_TIMEOUT * 2)
            check(f"{label}: HTML profile page HTTP 200", status == 200, f"got {status}")
            if status != 200:
                continue

            body_lower = body.lower()

            # Facility name appears on the page (first significant word, case-insensitive)
            name = fac.get("name", "")
            first_word = next(
                (w for w in name.split() if len(w) > 3 and w.lower() not in ("the", "and", "for")),
                name.split()[0] if name else "",
            )
            check(
                f"{label}: facility name visible ('{first_word}')",
                first_word.lower() in body_lower,
                f"'{first_word}' not found in page body ({len(body)} chars)",
            )

            # License number appears on the page (if set)
            lic_num = fac.get("license_number", "")
            if lic_num:
                check(
                    f"{label}: license number '{lic_num}' visible",
                    lic_num.lower() in body_lower,
                    f"not found in page ({len(body)} chars)",
                )

            # City name appears on the page
            city_slug = fac.get("city_slug", "")
            if city_slug:
                city_words = city_slug.replace("-", " ")
                check(
                    f"{label}: city '{city_words}' visible",
                    city_words in body_lower,
                    f"not found in page ({len(body)} chars)",
                )

            # No JavaScript errors / uncaught rendering artifacts
            has_nan = bool(re.search(r"\bNaN\b", body))
            has_undef = bool(re.search(r"\bundefined\b", body))
            has_obj = "[object Object]" in body
            check(
                f"{label}: no NaN / undefined / [object Object] in HTML",
                not has_nan and not has_undef and not has_obj,
                f"NaN={has_nan} undefined={has_undef} [object]={has_obj}",
            )

            # Body must have substantial content (not an empty shell)
            check(
                f"{label}: page body ≥ 5000 chars",
                len(body) >= 5000,
                f"body length={len(body)}",
            )

            # JSON-LD must be present (for YMYL SEO)
            check(
                f"{label}: JSON-LD script present",
                'application/ld+json' in body,
                "no <script type='application/ld+json'> found",
            )

            # Canonical link tag must be present
            check(
                f"{label}: canonical <link> present",
                'rel="canonical"' in body or "rel='canonical'" in body,
                "no canonical link tag found",
            )


# ── API count vs DB count correlation ─────────────────────────────────────────

def test_api_count_vs_db_count(cur, sess) -> None:
    """
    The 'count' field in each API response must match the publishable facility
    count in the live DB for that state. (Tests that ISR/caching is fresh enough.)
    """
    print("\n[API count ↔ DB count correlation]")

    for state_code, state_slug in COVERED_STATES:
        # DB count
        cur.execute(
            "SELECT COUNT(*) AS n FROM facilities WHERE state_code = %s AND publishable = true",
            (state_code,),
        )
        db_count = cur.fetchone()["n"] or 0

        # API count
        url = f"{PRODUCTION_URL}/api/facilities/{state_slug}"
        r = sess.get(url, timeout=HTTP_TIMEOUT * 2)
        if r.status_code != 200:
            check(f"{state_code}: API reachable for count check", False, f"HTTP {r.status_code}")
            continue
        try:
            payload = r.json()
        except Exception:
            check(f"{state_code}: API response parseable", False, "not JSON")
            continue

        api_count = payload.get("count", -1)
        label = f"{state_code} publishable count"

        check(
            f"{label}: API count = DB count (±10%)",
            abs(api_count - db_count) <= max(db_count * 0.10, 5),
            f"API={api_count} DB={db_count} (diff={abs(api_count - db_count)}; ISR cache may lag)",
        )


# ── Deficiency count cross-layer check ────────────────────────────────────────

def test_deficiency_count_in_api(cur, sess) -> None:
    """
    For the most-cited facility per state, the total_deficiency_count in the
    API response must be > 0 and within 20% of the sum in the DB.
    """
    print("\n[Deficiency count cross-check: DB sum ↔ API total_deficiency_count]")

    for state_code, state_slug in COVERED_STATES:
        # Find the facility with the most deficiencies in this state
        cur.execute(
            """
            SELECT
                f.id,
                f.slug,
                f.city_slug,
                SUM(i.total_deficiency_count) AS total_defs
            FROM facilities f
            JOIN inspections i ON i.facility_id = f.id
            WHERE f.state_code = %s AND f.publishable = true
              AND i.total_deficiency_count IS NOT NULL
            GROUP BY f.id, f.slug, f.city_slug
            ORDER BY total_defs DESC
            LIMIT 1
            """,
            (state_code,),
        )
        row = cur.fetchone()
        if not row:
            print(f"  SKIP  {state_code}: no facilities with deficiency counts")
            continue

        fac_id = str(row["id"])
        db_total = int(row["total_defs"] or 0)
        if db_total == 0:
            print(f"  SKIP  {state_code}: top facility has 0 deficiencies")
            continue

        # Get API response for the state
        url = f"{PRODUCTION_URL}/api/facilities/{state_slug}"
        r = sess.get(url, timeout=HTTP_TIMEOUT * 2)
        if r.status_code != 200:
            continue

        try:
            payload = r.json()
        except Exception:
            continue

        api_map = {f["id"]: f for f in payload.get("facilities", []) if "id" in f}
        api_fac = api_map.get(fac_id)

        if api_fac is None:
            check(
                f"{state_code}: most-cited facility present in API response",
                False,
                f"fac_id={fac_id} not in API ({len(api_map)} facilities)",
            )
            continue

        api_total = int(api_fac.get("total_deficiency_count", 0) or 0)
        label = f"{state_code}/{row['slug']}"
        check(
            f"{label}: total_deficiency_count > 0 in API",
            api_total > 0,
            f"api={api_total} db={db_total}",
        )
        check(
            f"{label}: API deficiency count within 20% of DB sum",
            abs(api_total - db_total) <= max(db_total * 0.20, 10),
            f"API={api_total} DB={db_total} (diff={abs(api_total - db_total)})",
        )


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("StarlynnCare — Layer 4: E2E Cross-Layer Correlation Tests")
    print(f"Production URL: {PRODUCTION_URL}")
    print("=" * 60)

    sess = make_session()
    sess.headers["Accept"] = "application/json"

    with get_conn() as conn:
        with conn.cursor() as cur:
            test_db_vs_api_field_correlation(cur, sess)
            test_db_vs_html_field_correlation(cur)
            test_api_count_vs_db_count(cur, sess)
            test_deficiency_count_in_api(cur, sess)

    run_all_checks("Layer 4 (E2E correlation)")


if __name__ == "__main__":
    main()
