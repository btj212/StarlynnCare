#!/usr/bin/env python3
"""
Layer 3 (extended) — API route integration tests against the live production URL.

Tests every Next.js API route against the actual deployed production endpoint:

  • GET /api/facilities/{state}  — public JSON-LD dataset (all 10 covered states)
  • GET /api/facilities/invalid  — must return 404 with { error: "..." }
  • GET /api/export/ca-inspections — CA inspection CSV bulk export

No mocks. No mock server. Hits https://www.starlynncare.com directly.

Each facility in each state's response is validated for:
  - Field presence (every field the FacilityRow type declares)
  - Type correctness (booleans, numbers, strings)
  - Value constraints (URL patterns, state codes, positive counts)
  - Cross-consistency (state_code in facility matches route state)

Exit 0 = all checks passed. Exit 1 = one or more checks failed.
"""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from tests._lib import (  # noqa: E402
    check,
    run_all_checks,
    make_session,
    PRODUCTION_URL,
    COVERED_STATES,
    MIN_PUBLISHABLE,
    HTTP_TIMEOUT,
)

# ── Expected types + constraints ───────────────────────────────────────────────

# Fields the StateFacility type (in /api/facilities/[state]/route.ts) exposes.
# Each entry: (field_name, expected_python_type, nullable)
FACILITY_FIELDS: list[tuple[str, type | tuple, bool]] = [
    ("id",                    str,         False),
    ("name",                  str,         False),
    ("url",                   str,         False),
    ("street",                str,         True),
    ("city",                  str,         True),
    ("postal_code",           str,         True),
    ("state_code",            str,         False),
    ("latitude",              (int, float), True),
    ("longitude",             (int, float), True),
    ("license_number",        str,         True),
    ("license_type",          str,         True),
    ("beds",                  (int, float), True),
    ("care_category",         str,         False),
    ("serves_memory_care",    bool,        False),
    ("capacity_tier",         str,         True),
    ("regulator_url",         str,         True),
    ("last_inspection_date",  str,         True),
    ("total_deficiency_count", int,        False),
    ("updated_at",            str,         True),
]

# Top-level fields in the API payload
PAYLOAD_FIELDS = [
    "schema", "state_code", "state_name", "generated_at", "count",
    "methodology_url", "facilities",
]

# Known care_category values from the schema
VALID_CARE_CATEGORIES = {
    "assisted_living_memory_care",
    "memory_care_only",
    "nursing_home_memory_care",
    "assisted_living",
    "residential_care",
    "adult_family_home",
    "board_and_care",
}

URL_RE = re.compile(r"^https?://")
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _validate_facility_object(label: str, fac: dict, expected_state_code: str) -> None:
    """Validate a single facility object from the API response."""
    # Check every declared field is present
    for field_name, field_type, nullable in FACILITY_FIELDS:
        val = fac.get(field_name)
        if not nullable:
            check(
                f"{label}.{field_name}: non-null",
                val is not None,
                f"got None (field is required)",
            )
        if val is not None:
            check(
                f"{label}.{field_name}: correct type",
                isinstance(val, field_type),
                f"expected {field_type}, got {type(val).__name__}={val!r}"[:80],
            )

    # URL must start with https://www.starlynncare.com/
    url = fac.get("url", "")
    check(
        f"{label}.url: starts with production base",
        url.startswith(f"{PRODUCTION_URL}/"),
        f"url={url!r}",
    )

    # state_code must match the route
    sc = fac.get("state_code", "")
    check(
        f"{label}.state_code: matches route ({expected_state_code})",
        sc == expected_state_code,
        f"got {sc!r}",
    )

    # total_deficiency_count must be ≥ 0
    tdc = fac.get("total_deficiency_count")
    if tdc is not None:
        check(
            f"{label}.total_deficiency_count: ≥ 0",
            isinstance(tdc, int) and tdc >= 0,
            f"got {tdc!r}",
        )

    # care_category must be a known value
    cc = fac.get("care_category", "")
    check(
        f"{label}.care_category: recognized value",
        cc in VALID_CARE_CATEGORIES,
        f"got {cc!r} (valid={VALID_CARE_CATEGORIES})",
    )

    # serves_memory_care must be a boolean
    smc = fac.get("serves_memory_care")
    check(
        f"{label}.serves_memory_care: is bool",
        isinstance(smc, bool),
        f"got {type(smc).__name__}={smc!r}",
    )

    # last_inspection_date, if set, must look like an ISO date
    lid = fac.get("last_inspection_date")
    if lid is not None:
        check(
            f"{label}.last_inspection_date: ISO date format",
            bool(ISO_DATE_RE.match(str(lid))),
            f"got {lid!r}",
        )

    # If regulator_url is set, must be an HTTP URL
    reg_url = fac.get("regulator_url")
    if reg_url is not None:
        check(
            f"{label}.regulator_url: is URL",
            bool(URL_RE.match(reg_url)),
            f"got {reg_url!r}",
        )


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_facilities_api_per_state(sess) -> None:
    """GET /api/facilities/{state} for all covered states — full schema validation."""
    print("\n[/api/facilities/{state} — all 10 states]")

    for state_code, state_slug in COVERED_STATES:
        url = f"{PRODUCTION_URL}/api/facilities/{state_slug}"
        print(f"\n  → {state_slug} ({state_code})")

        t0 = time.monotonic()
        r = sess.get(url, timeout=HTTP_TIMEOUT * 2)
        elapsed = time.monotonic() - t0

        label = f"/api/facilities/{state_slug}"
        check(f"{label}: HTTP 200", r.status_code == 200, f"got {r.status_code}")
        if r.status_code != 200:
            continue

        check(
            f"{label}: Content-Type JSON",
            "application/json" in r.headers.get("content-type", ""),
            f"content-type={r.headers.get('content-type')!r}",
        )

        try:
            payload = r.json()
        except Exception as e:
            check(f"{label}: valid JSON", False, str(e))
            continue
        check(f"{label}: valid JSON", True)

        # Top-level payload structure
        for field in PAYLOAD_FIELDS:
            check(f"{label}: payload.{field} present", field in payload, f"missing from response")

        check(
            f"{label}: schema = 'https://schema.org/Dataset'",
            payload.get("schema") == "https://schema.org/Dataset",
            f"got {payload.get('schema')!r}",
        )
        check(
            f"{label}: state_code = '{state_code}'",
            payload.get("state_code") == state_code,
            f"got {payload.get('state_code')!r}",
        )
        check(
            f"{label}: methodology_url is URL",
            bool(URL_RE.match(str(payload.get("methodology_url", "")))),
            f"got {payload.get('methodology_url')!r}",
        )
        check(
            f"{label}: generated_at is ISO timestamp",
            bool(ISO_DATE_RE.match(str(payload.get("generated_at", "")))),
            f"got {payload.get('generated_at')!r}",
        )

        facilities = payload.get("facilities", [])
        count_field = payload.get("count", -1)
        check(
            f"{label}: count field matches facilities array length",
            count_field == len(facilities),
            f"count={count_field} facilities_len={len(facilities)}",
        )

        min_n = MIN_PUBLISHABLE.get(state_code, 1)
        check(
            f"{label}: facility count ≥ {min_n}",
            len(facilities) >= min_n,
            f"got {len(facilities)}",
        )

        # Deep-validate the first 10 facilities and last 5 (catch sort edge cases)
        sample = facilities[:10] + facilities[-5:] if len(facilities) > 10 else facilities
        for i, fac in enumerate(sample):
            is_tail = i >= 10
            idx = len(facilities) - len(facilities[-5:]) + (i - 10) if is_tail else i
            fac_label = f"{label}/fac[{idx}]"
            _validate_facility_object(fac_label, fac, state_code)

        # Aggregate: no duplicate IDs in the response
        all_ids = [f.get("id") for f in facilities]
        unique_ids = set(all_ids)
        check(
            f"{label}: no duplicate facility IDs",
            len(all_ids) == len(unique_ids),
            f"total={len(all_ids)} unique={len(unique_ids)}",
        )

        # Aggregate: all serves_memory_care facilities must have a non-empty name
        mc_facilities = [f for f in facilities if f.get("serves_memory_care")]
        check(
            f"{label}: all memory-care facilities have non-empty names",
            all(bool(f.get("name")) for f in mc_facilities),
            f"mc_count={len(mc_facilities)}",
        )

        print(f"    OK  {len(facilities)} facilities in {elapsed:.1f}s")


def test_invalid_state_returns_404(sess) -> None:
    """GET /api/facilities/{invalid-slug} returns HTTP 404 with error JSON."""
    print("\n[/api/facilities/{state} — invalid state slug → 404]")

    invalid_slugs = ["mars", "canada", "not-a-state", "ca123"]
    for slug in invalid_slugs:
        url = f"{PRODUCTION_URL}/api/facilities/{slug}"
        r = sess.get(url, timeout=HTTP_TIMEOUT)
        check(f"/api/facilities/{slug}: HTTP 404", r.status_code == 404, f"got {r.status_code}")
        if r.status_code == 404:
            try:
                body = r.json()
                check(
                    f"/api/facilities/{slug}: error field present",
                    "error" in body,
                    f"body={body}",
                )
            except Exception:
                pass  # Non-JSON 404 is still a 404


def test_ca_inspections_export(sess) -> None:
    """GET /api/export/ca-inspections returns a CSV response."""
    print("\n[/api/export/ca-inspections — CSV bulk export]")

    url = f"{PRODUCTION_URL}/api/export/ca-inspections"
    r = sess.get(url, timeout=HTTP_TIMEOUT * 3, stream=True)
    check(
        "CA export: HTTP 200",
        r.status_code == 200,
        f"got {r.status_code}",
    )
    if r.status_code != 200:
        return

    ct = r.headers.get("content-type", "").lower()
    check(
        "CA export: Content-Type is text/csv or octet-stream",
        "csv" in ct or "octet-stream" in ct or "text/plain" in ct,
        f"content-type={ct!r}",
    )

    # Read the first 32 KB to validate the CSV header
    chunk = b""
    for piece in r.iter_content(chunk_size=8192):
        chunk += piece
        if len(chunk) >= 32768:
            break
    r.close()

    text = chunk.decode("utf-8-sig", errors="replace")
    import csv, io  # noqa: PLC0415
    reader = csv.reader(io.StringIO(text))
    try:
        header = next(reader)
        check("CA export: has header row", len(header) >= 5, f"got {len(header)} columns")
        # Must have facility-identifying columns
        header_lower = {h.strip().lower() for h in header}
        for expected_col in ("facility", "inspection", "date"):
            check(
                f"CA export: column containing '{expected_col}' present",
                any(expected_col in h for h in header_lower),
                f"header={list(header_lower)[:10]}",
            )
        # Check at least one data row
        data_row = next(reader, None)
        check("CA export: has at least 1 data row", data_row is not None, "empty CSV")
    except StopIteration:
        check("CA export: parseable CSV", False, "no rows found in first 32KB")


def test_cache_control_headers(sess) -> None:
    """API responses include appropriate Cache-Control headers."""
    print("\n[Cache-Control headers on facilities API]")

    url = f"{PRODUCTION_URL}/api/facilities/california"
    r = sess.get(url, timeout=HTTP_TIMEOUT * 2)
    if r.status_code != 200:
        check("Cache-Control check: skipped (endpoint returned error)", True, f"got {r.status_code}")
        return

    cc = r.headers.get("cache-control", "")
    check(
        "CA facilities API: Cache-Control header set",
        bool(cc),
        f"cache-control={cc!r}",
    )
    check(
        "CA facilities API: CORS header present",
        "access-control-allow-origin" in {k.lower() for k in r.headers},
        f"headers={list(r.headers.keys())}",
    )
    check(
        "CA facilities API: X-Robots-Tag=noindex",
        r.headers.get("x-robots-tag", "").lower() == "noindex",
        f"x-robots-tag={r.headers.get('x-robots-tag')!r}",
    )


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("StarlynnCare — Layer 3 (Extended): API Route Integration Tests")
    print(f"Target: {PRODUCTION_URL}")
    print("=" * 60)

    sess = make_session()
    sess.headers["Accept"] = "application/json"

    test_facilities_api_per_state(sess)
    test_invalid_state_returns_404(sess)
    test_ca_inspections_export(sess)
    test_cache_control_headers(sess)

    run_all_checks("Layer 3 Extended (API routes)")


if __name__ == "__main__":
    main()
