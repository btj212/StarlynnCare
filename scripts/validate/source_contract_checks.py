#!/usr/bin/env python3
"""
Layer 0 — Live source contract checks for StarlynnCare.

Every other layer (1/2/3/5) validates data already sitting in our DB or
rendered on our pages. None of them ask the one question that actually
catches an upstream break before it reaches a scraper: does the real,
live external API still return the fields our ingest code depends on,
shaped the way our ingest code expects?

This script makes REAL network calls — no mocks, no fixtures, no cached
responses — against the public data sources our pipeline depends on and
checks the full field contract (not one or two sample fields) our code
actually reads.

Scope (deliberate, see docs/VALIDATION.md "Layer 0" section):
  - CMS Provider Information (data.cms.gov) — feeds cms_nh_directory_ingest.py.
  - US Census Geocoder (geocoding.geo.census.gov) — feeds
    recompute_physical_city.py, the physical-city source of truth.

Both are public, key-free, stable federal REST endpoints, so hitting them
live on demand is safe and free. This deliberately does NOT attempt the
Playwright-driven state portals (AZ ADHS/Salesforce, MO ShowMeLTC, IL FOIA
exports, TULIP, etc.) — those are fragile, ToS-sensitive, and/or have no
live "API" at all (FOIA drops are static files), so a live-hit contract
test for them would be either unsafe to run on a schedule or meaningless.
See MEMORY.md "Live source-contract test coverage is scoped, not total"
for the full reasoning and what a follow-up would need.

Usage:
    python3 scripts/validate/source_contract_checks.py
    python3 scripts/validate/source_contract_checks.py --cms-state WY

Exit 0 = all checks passed. Exit 1 = one or more checks failed.
NOT run in CI (external network dependency — see Layer 3 precedent).
Run manually, e.g. before trusting a new ingest run or after a long gap.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._lib import check, run_all_checks  # noqa: E402

USER_AGENT = "StarlynnCare-Validator/1.0 (https://www.starlynncare.com; validation bot)"

# ── CMS Provider Information ────────────────────────────────────────────────
# Mirrors scrapers/cms_nh_directory_ingest.py exactly: same DKAN metadata
# endpoint, same dataset UUID, same column-fallback pairs the ingest code
# reads via `row.get(a) or row.get(b)`.

CMS_DKAN_META = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items"
PROVIDER_INFO_UUID = "4pq5-n9py"

# (label, acceptable column names — ingest code accepts either)
CMS_REQUIRED_COLUMNS: list[tuple[str, tuple[str, ...]]] = [
    ("CCN", ("CMS Certification Number (CCN)",)),
    ("Provider Name", ("Provider Name",)),
    ("Address", ("Provider Address",)),
    ("City", ("City/Town", "Provider City")),
    ("State", ("State", "Provider State")),
    ("ZIP", ("ZIP Code", "Provider Zip Code")),
    ("County", ("County/Parish",)),
    ("Phone", ("Telephone Number", "Phone Number")),
    ("Overall Rating", ("Overall Rating",)),
    ("Health Inspection Rating", ("Health Inspection Rating",)),
    ("QM Rating", ("QM Rating",)),
    ("Staffing Rating", ("Staffing Rating",)),
    ("Certified Beds", ("Number of Certified Beds",)),
    ("Latitude", ("Latitude",)),
    ("Longitude", ("Longitude",)),
]


def _get_json(url: str, timeout: int = 30) -> tuple[int, dict | None]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:
        print(f"    request error: {type(e).__name__}: {e}", file=sys.stderr)
        return -1, None


def check_cms_source(state: str, sample_size: int = 15) -> None:
    print(f"\n[CMS Provider Information — data.cms.gov, state={state}]")

    status, meta = _get_json(f"{CMS_DKAN_META}/{PROVIDER_INFO_UUID}")
    if not check("CMS DKAN metadata endpoint returns 200", status == 200, f"status={status}"):
        return

    distributions = (meta or {}).get("distribution", [])
    csv_url = next(
        (d.get("downloadURL", "") for d in distributions if d.get("downloadURL", "").endswith(".csv")),
        None,
    )
    if not check("CMS metadata includes a CSV distribution", csv_url is not None):
        return

    req = urllib.request.Request(csv_url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            status = resp.status
            raw = resp.read()
    except Exception as e:
        check("CMS CSV download succeeds", False, f"{type(e).__name__}: {e}")
        return
    check("CMS CSV download succeeds", status == 200, f"status={status}")

    content = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(content))
    header = set(reader.fieldnames or [])
    check("CMS CSV is non-empty / parses as CSV", bool(header), f"{len(header)} columns")

    for label, candidates in CMS_REQUIRED_COLUMNS:
        present = any(c in header for c in candidates)
        check(f"CMS CSV has a '{label}' column", present, " or ".join(candidates))

    rows = []
    for row in reader:
        if row.get("State", "").strip().upper() == state.upper():
            rows.append(row)
        if len(rows) >= sample_size:
            break
    check(f"CMS CSV has ≥1 row for state={state}", len(rows) > 0, f"found {len(rows)}")

    if not rows:
        return

    bad_ccn = bad_rating = bad_latlon = bad_beds = 0
    for row in rows:
        ccn = str(row.get("CMS Certification Number (CCN)", "") or "").strip()
        if not (ccn.isdigit() and len(ccn) == 6):
            bad_ccn += 1

        for rating_col in ("Overall Rating", "Health Inspection Rating", "QM Rating", "Staffing Rating"):
            raw_val = str(row.get(rating_col, "") or "").strip()
            if raw_val and not (raw_val.isdigit() and 1 <= int(raw_val) <= 5):
                bad_rating += 1

        try:
            lat = float(row.get("Latitude") or "nan")
            lon = float(row.get("Longitude") or "nan")
            # Loose continental-US + AK/HI/PR bounding box.
            if not (-180 <= lon <= -65 and 15 <= lat <= 72):
                bad_latlon += 1
        except ValueError:
            bad_latlon += 1

        beds_raw = str(row.get("Number of Certified Beds", "") or "").strip()
        if beds_raw and (not beds_raw.isdigit() or int(beds_raw) < 0):
            bad_beds += 1

    check(f"CCN is a 6-digit code on all {len(rows)} sampled rows", bad_ccn == 0, f"{bad_ccn} malformed")
    check("Star ratings are within 1–5 on all sampled rows", bad_rating == 0, f"{bad_rating} out of range")
    check("Latitude/Longitude are within a plausible US bounding box", bad_latlon == 0, f"{bad_latlon} out of range")
    check("Certified beds is a non-negative integer where present", bad_beds == 0, f"{bad_beds} malformed")


# ── US Census Geocoder ──────────────────────────────────────────────────────
# Mirrors scrapers/recompute_physical_city.py's CENSUS_URL exactly. Fixtures
# below are real, fixed coordinates whose expected Census place name was
# confirmed against a live call to this same endpoint — this is a regression
# fixture (catch the API changing shape or the place being reclassified), not
# a fabricated expectation.

CENSUS_URL = (
    "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"
    "?x={lon}&y={lat}"
    "&benchmark=Public_AR_Current&vintage=Current_Current"
    "&layers=Incorporated_Places,Census_Designated_Places&format=json"
)

CENSUS_FIXTURES = [
    # (label, lat, lon, expected geography layer key, expected BASENAME)
    ("Oakland City Hall, CA (incorporated place)", 37.8044, -122.2712, "Incorporated Places", "Oakland"),
    ("Castro Valley, CA (unincorporated CDP)", 37.6935, -122.0868, "Census Designated Places", "Castro Valley"),
]


def check_census_geocoder() -> None:
    print("\n[US Census Geocoder — geocoding.geo.census.gov]")

    for label, lat, lon, layer_key, expected_name in CENSUS_FIXTURES:
        url = CENSUS_URL.format(lat=round(lat, 6), lon=round(lon, 6))
        status, data = _get_json(url, timeout=20)
        if not check(f"{label}: HTTP 200", status == 200, f"status={status}"):
            continue

        geographies = ((data or {}).get("result") or {}).get("geographies") or {}
        check(
            f"{label}: response has 'result.geographies' shape",
            isinstance(geographies, dict) and bool(geographies),
        )

        places = geographies.get(layer_key) or []
        check(f"{label}: '{layer_key}' layer present with ≥1 entry", len(places) >= 1, f"got {len(places)}")

        names = [p.get("BASENAME") for p in places]
        check(
            f"{label}: BASENAME matches expected place ('{expected_name}')",
            expected_name in names,
            f"got {names}",
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="StarlynnCare Layer 0 — live source contract checks (no mocks)"
    )
    parser.add_argument("--cms-state", default="WY", help="Small state to sample CMS rows for (default: WY)")
    args = parser.parse_args()

    print("StarlynnCare — Layer 0: Source Contract Checks")
    print(f"{'─' * 60}")

    check_cms_source(args.cms_state)
    check_census_geocoder()

    run_all_checks("Layer 0 (source contract checks)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
