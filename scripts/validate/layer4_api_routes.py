#!/usr/bin/env python3
"""
Layer 4 — API route integration tests for StarlynnCare.

Calls the real deployed /api/facilities/{state} endpoint for every covered
state and asserts the full response shape: Dataset schema envelope, every
StateFacility field, count consistency with the DB, and spot-checks that
individual facility values match the DB exactly.

Usage:
    python3 scripts/validate/layer4_api_routes.py
    python3 scripts/validate/layer4_api_routes.py --base-url http://localhost:3000
    python3 scripts/validate/layer4_api_routes.py --state CA
    python3 scripts/validate/layer4_api_routes.py --spot-sample 10

Exit 0 = all checks passed. Exit 1 = one or more checks failed.

NOTE: Requires either a running local server or the deployed production/preview
URL.  Uses DATABASE_URL to spot-check API response values against the DB.
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._lib import check, get_conn, run_all_checks  # noqa: E402

PRODUCTION_URL = "https://www.starlynncare.com"

# States that should return non-empty facility arrays
COVERED_STATES = [
    ("california", "CA"),
    ("oregon", "OR"),
    ("washington", "WA"),
    ("minnesota", "MN"),
    ("texas", "TX"),
    ("utah", "UT"),
]

# All required top-level envelope fields
ENVELOPE_REQUIRED_FIELDS = {
    "schema",
    "state_code",
    "state_name",
    "generated_at",
    "count",
    "methodology_url",
    "facilities",
}

# All required per-facility fields (from StateFacility type in route.ts)
FACILITY_REQUIRED_FIELDS = {
    "id",
    "name",
    "url",
    "state_code",
    "care_category",
    "serves_memory_care",
    "total_deficiency_count",
}

# Nullable-but-expected fields — warn if absent, don't fail
FACILITY_EXPECTED_FIELDS = {
    "street",
    "city",
    "postal_code",
    "latitude",
    "longitude",
    "license_number",
    "license_type",
    "beds",
    "capacity_tier",
    "regulator_url",
    "last_inspection_date",
    "updated_at",
}

VALID_CARE_CATEGORIES = {
    "rcfe_memory_care", "rcfe_general", "ccrc",
    "snf_mc", "snf_general",
    "alf_memory_care", "alf_general",
    "afh_memory_care", "afh_general",
    "nh_memory_care", "nh_general",
}


def _fetch_json(url: str) -> tuple[int, Any]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "StarlynnCare-Validator/1.0 (tests@starlynncare.com)",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", errors="replace")
            return e.code, json.loads(body)
        except Exception:
            return e.code, None
    except Exception as e:  # noqa: BLE001
        print(f"    [fetch error] {type(e).__name__}: {e}", file=sys.stderr)
        return -1, None


def _check_envelope(slug: str, state_code: str, payload: Any) -> bool:
    """Verify top-level API response envelope. Returns True if envelope is valid."""
    label = f"/api/facilities/{slug}"

    missing_fields = ENVELOPE_REQUIRED_FIELDS - set(payload.keys())
    ok = check(
        f"{label}: all envelope fields present",
        not missing_fields,
        f"missing: {missing_fields}",
    )
    if not ok:
        return False

    check(
        f"{label}: schema == 'https://schema.org/Dataset'",
        payload.get("schema") == "https://schema.org/Dataset",
        f"schema={payload.get('schema')!r}",
    )
    check(
        f"{label}: state_code == '{state_code}'",
        payload.get("state_code") == state_code,
        f"state_code={payload.get('state_code')!r}",
    )
    check(
        f"{label}: state_name is non-empty string",
        bool(payload.get("state_name")),
        f"state_name={payload.get('state_name')!r}",
    )
    check(
        f"{label}: generated_at is ISO8601",
        bool(re.match(r"^\d{4}-\d{2}-\d{2}T", str(payload.get("generated_at", "")))),
        f"generated_at={payload.get('generated_at')!r}",
    )
    check(
        f"{label}: count matches len(facilities)",
        payload.get("count") == len(payload.get("facilities", [])),
        f"count={payload.get('count')} len={len(payload.get('facilities', []))}",
    )
    check(
        f"{label}: count > 0",
        (payload.get("count") or 0) > 0,
        f"count={payload.get('count')}",
    )
    check(
        f"{label}: methodology_url is https://",
        str(payload.get("methodology_url", "")).startswith("https://"),
        f"methodology_url={payload.get('methodology_url')!r}",
    )
    return True


def _check_facility_fields(slug: str, fac: dict[str, Any], idx: int) -> None:
    """Verify every field of a single StateFacility object."""
    label = f"/api/facilities/{slug}[{idx}]({fac.get('id', '?')[:8]})"

    # Required fields must be present and non-null
    for field in FACILITY_REQUIRED_FIELDS:
        check(
            f"{label}: required field '{field}' present and non-null",
            fac.get(field) is not None,
            f"field={field!r} value={fac.get(field)!r}",
        )

    # Expected fields present (keys must exist even if null)
    for field in FACILITY_EXPECTED_FIELDS:
        check(
            f"{label}: expected field '{field}' key exists",
            field in fac,
            f"missing key '{field}'",
        )

    # care_category in allowed enum
    cc = fac.get("care_category")
    check(
        f"{label}: care_category in allowed enum",
        cc in VALID_CARE_CATEGORIES,
        f"care_category={cc!r}",
    )

    # serves_memory_care is boolean
    smc = fac.get("serves_memory_care")
    check(
        f"{label}: serves_memory_care is boolean",
        isinstance(smc, bool),
        f"serves_memory_care={smc!r} (type={type(smc).__name__})",
    )

    # total_deficiency_count is non-negative int
    tdc = fac.get("total_deficiency_count")
    check(
        f"{label}: total_deficiency_count is non-negative",
        isinstance(tdc, int) and tdc >= 0,
        f"total_deficiency_count={tdc!r}",
    )

    # url is a valid https:// starlynncare.com URL
    url = fac.get("url", "")
    check(
        f"{label}: url starts with https://",
        str(url).startswith("https://"),
        f"url={str(url)[:80]!r}",
    )
    check(
        f"{label}: url contains state slug",
        f"/{slug}/" in str(url),
        f"url={str(url)[:80]!r}",
    )

    # beds (if non-null) must be positive
    beds = fac.get("beds")
    if beds is not None:
        check(
            f"{label}: beds > 0",
            beds > 0,
            f"beds={beds}",
        )

    # lat/lon: if present, within US bounds
    lat = fac.get("latitude")
    lon = fac.get("longitude")
    if lat is not None:
        check(
            f"{label}: latitude in US range (18–72)",
            18.0 <= float(lat) <= 72.0,
            f"lat={lat}",
        )
    if lon is not None:
        check(
            f"{label}: longitude in US range (-180 – -64)",
            -180.0 <= float(lon) <= -64.0,
            f"lon={lon}",
        )


def _spot_check_against_db(
    cur: Any,
    slug: str,
    state_code: str,
    facilities: list[dict[str, Any]],
    sample_size: int,
) -> None:
    """Cross-check a random sample of API response facilities against the DB."""
    label = f"/api/facilities/{slug} spot-check"
    sample = random.sample(facilities, min(sample_size, len(facilities)))
    print(f"\n[{label} — {len(sample)} facilities against DB]")

    for fac in sample:
        fid = fac.get("id")
        if not fid:
            continue
        cur.execute(
            """
            SELECT
                name, slug, city_slug, city,
                beds,
                serves_memory_care,
                care_category,
                license_number,
                latitude::float AS latitude,
                longitude::float AS longitude,
                last_inspection_date
            FROM facilities
            WHERE id = %s AND publishable = true
            """,
            (fid,),
        )
        db_row = cur.fetchone()
        flabel = f"{slug}/{fac.get('name', '?')!r}"

        if not check(f"{flabel}: facility exists in DB with publishable=true", db_row is not None, f"id={fid}"):
            continue

        # Name must match (case-insensitive)
        check(
            f"{flabel}: name matches DB",
            fac.get("name", "").lower() == (db_row["name"] or "").lower(),
            f"api={fac.get('name')!r} db={db_row['name']!r}",
        )

        # beds must match exactly
        check(
            f"{flabel}: beds matches DB",
            fac.get("beds") == db_row["beds"],
            f"api={fac.get('beds')} db={db_row['beds']}",
        )

        # serves_memory_care must match exactly
        check(
            f"{flabel}: serves_memory_care matches DB",
            bool(fac.get("serves_memory_care")) == bool(db_row["serves_memory_care"]),
            f"api={fac.get('serves_memory_care')} db={db_row['serves_memory_care']}",
        )

        # care_category must match exactly
        check(
            f"{flabel}: care_category matches DB",
            fac.get("care_category") == db_row["care_category"],
            f"api={fac.get('care_category')!r} db={db_row['care_category']!r}",
        )

        # URL must embed city_slug/slug from DB
        url = fac.get("url", "")
        check(
            f"{flabel}: url embeds correct slug",
            db_row["slug"] in url,
            f"url={url!r} expected slug={db_row['slug']!r}",
        )
        check(
            f"{flabel}: url embeds correct city_slug",
            db_row["city_slug"] in url,
            f"url={url!r} expected city_slug={db_row['city_slug']!r}",
        )

        # total_deficiency_count: recompute from DB and compare
        cur.execute(
            """
            SELECT COALESCE(SUM(i.total_deficiency_count), 0) AS total
            FROM inspections i
            WHERE i.facility_id = %s
            """,
            (fid,),
        )
        db_tdc = cur.fetchone()["total"] or 0
        api_tdc = fac.get("total_deficiency_count", 0)
        check(
            f"{flabel}: total_deficiency_count matches DB sum",
            int(api_tdc) == int(db_tdc),
            f"api={api_tdc} db_sum={db_tdc}",
        )


def _check_count_vs_db(cur: Any, slug: str, state_code: str, api_count: int) -> None:
    """Verify API response count matches DB publishable count for this state."""
    cur.execute(
        "SELECT COUNT(*) AS n FROM facilities WHERE state_code = %s AND publishable = true",
        (state_code,),
    )
    db_count = cur.fetchone()["n"]
    check(
        f"/api/facilities/{slug}: response count matches DB publishable count",
        api_count == db_count,
        f"api={api_count} db={db_count}",
    )


def _check_no_nan_or_undefined(slug: str, payload_str: str) -> None:
    """API JSON must not contain NaN or undefined (both invalid JSON / React artifacts)."""
    has_nan = "NaN" in payload_str
    has_undef = "undefined" in payload_str
    check(
        f"/api/facilities/{slug}: no NaN in JSON",
        not has_nan,
        "found 'NaN' in raw response",
    )
    check(
        f"/api/facilities/{slug}: no 'undefined' in JSON",
        not has_undef,
        "found 'undefined' in raw response",
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="StarlynnCare Layer 4 — API route integration tests"
    )
    parser.add_argument(
        "--base-url",
        default=PRODUCTION_URL,
        help=f"Base URL to test against (default: {PRODUCTION_URL})",
    )
    parser.add_argument(
        "--state",
        default=None,
        help="Only test one state slug (e.g. california). Default: all covered states.",
    )
    parser.add_argument(
        "--spot-sample",
        type=int,
        default=5,
        help="Number of facilities to spot-check against DB per state (default 5)",
    )
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    state_filter = args.state.lower() if args.state else None
    spot_n = max(3, args.spot_sample)

    states = [(slug, code) for (slug, code) in COVERED_STATES if not state_filter or slug == state_filter]

    print("=" * 60)
    print("StarlynnCare — Layer 4: API route integration tests")
    print(f"Base URL:  {base}")
    print(f"States:    {[s for s, _ in states]}")
    print(f"Spot-check: {spot_n} facilities per state")
    print("=" * 60)

    with get_conn() as conn:
        with conn.cursor() as cur:
            for slug, code in states:
                url = f"{base}/api/facilities/{slug}"
                print(f"\n[GET {url}]")

                # Fetch the raw bytes first for NaN/undefined check, then parse JSON
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": "StarlynnCare-Validator/1.0 (tests@starlynncare.com)",
                        "Accept": "application/json",
                    },
                )
                raw_body = ""
                http_status = -1
                payload = None

                try:
                    with urllib.request.urlopen(req, timeout=120) as resp:
                        http_status = resp.status
                        raw_body = resp.read().decode("utf-8", errors="replace")
                        try:
                            payload = json.loads(raw_body)
                        except json.JSONDecodeError as e:
                            check(f"/api/facilities/{slug}: valid JSON", False, str(e))
                except urllib.error.HTTPError as e:
                    http_status = e.code
                except Exception as exc:  # noqa: BLE001
                    print(f"    [error] {type(exc).__name__}: {exc}", file=sys.stderr)

                check(f"/api/facilities/{slug}: HTTP 200", http_status == 200, f"got {http_status}")
                if http_status != 200 or payload is None:
                    continue

                check(f"/api/facilities/{slug}: valid JSON", True, "")
                _check_no_nan_or_undefined(slug, raw_body)

                if not _check_envelope(slug, code, payload):
                    continue

                facilities = payload.get("facilities", [])

                # Verify every single facility object in the response
                print(f"\n[/api/facilities/{slug} — all {len(facilities)} facility objects]")
                for idx, fac in enumerate(facilities):
                    _check_facility_fields(slug, fac, idx)

                # Count vs DB
                _check_count_vs_db(cur, slug, code, len(facilities))

                # Spot-check against DB
                if facilities:
                    _spot_check_against_db(cur, slug, code, facilities, spot_n)

    run_all_checks("Layer 4 (API routes)")


if __name__ == "__main__":
    main()
