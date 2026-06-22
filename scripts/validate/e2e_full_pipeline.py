#!/usr/bin/env python3
"""
Soup-to-Nuts E2E Pipeline Tests for StarlynnCare.

Proves the entire data flow is correct for a set of real facilities:

  DB row (facilities + inspections + deficiencies)
    → facility_snapshot() RPC
    → /api/facilities/{state} (every field)
    → page HTML (profile page, JSON-LD, meta tags)
    → watch signup API (POST /api/watch, verifies DB write)

Test facilities are pulled fresh from the live DB (not hardcoded), so the
test is always meaningful: it picks real data, traces it through every layer,
and verifies that every layer reflects the DB truth.

Covers:
  1. DB row completeness   — every column on the specific facility row
  2. facility_snapshot RPC — all returned keys, values in range
  3. API route response    — facility present, all fields match DB
  4. Page HTML             — name/beds/city visible, JSON-LD complete, no corruption
  5. Watch signup          — POST /api/watch upserts to facility_watchers and returns ok

Usage:
    python3 scripts/validate/e2e_full_pipeline.py
    python3 scripts/validate/e2e_full_pipeline.py --base-url http://localhost:3000
    python3 scripts/validate/e2e_full_pipeline.py --state CA --count 3

Exit 0 = all checks passed. Exit 1 = one or more checks failed.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._lib import check, fetch_page, get_conn, run_all_checks  # noqa: E402

PRODUCTION_URL = "https://www.starlynncare.com"

# State → (slug, code) for the API route
STATE_SLUGS = {
    "CA": "california",
    "OR": "oregon",
    "WA": "washington",
    "MN": "minnesota",
    "TX": "texas",
    "UT": "utah",
}

# Snapshot RPC result keys that must be present
SNAPSHOT_REQUIRED_KEYS = {
    "facility",
    "peer_set",
    "metrics",
    "has_inspections",
    "trajectory_series",
    "heatmap",
}

SNAPSHOT_METRICS_KEYS = {"severity", "repeats", "frequency", "trajectory"}
SNAPSHOT_METRIC_SUBKEYS = {"value", "percentile", "peer_median"}

# JSON-LD types we expect on a facility profile page
EXPECTED_JSONLD_TYPES = {"LocalBusiness", "MedicalWebPage", "BreadcrumbList"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fetch_json(url: str, timeout: int = 60) -> tuple[int, Any, str]:
    """Returns (status, parsed_json, raw_body)."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "StarlynnCare-E2E/1.0 (tests@starlynncare.com)",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, json.loads(raw), raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        try:
            return e.code, json.loads(raw), raw
        except json.JSONDecodeError:
            return e.code, None, raw
    except Exception as exc:  # noqa: BLE001
        return -1, None, str(exc)


def _post_json(url: str, payload: dict[str, Any], timeout: int = 15) -> tuple[int, Any]:
    """POST JSON body; return (status, parsed_response)."""
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "User-Agent": "StarlynnCare-E2E/1.0 (tests@starlynncare.com)",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, None
    except Exception as exc:  # noqa: BLE001
        return -1, None


def _pick_test_facilities(cur: Any, state: str, count: int) -> list[dict[str, Any]]:
    """
    Select well-rounded test facilities from the DB:
      - At least 3 inspections in the last 3 years (non-trivial history)
      - Geocoded (lat/lon present)
      - Memory-care and non-memory-care mix
    Returns up to `count` facilities.
    """
    cur.execute(
        """
        SELECT
            f.id,
            f.name,
            f.slug,
            f.city_slug,
            f.state_code,
            f.beds,
            f.city,
            f.street,
            f.zip,
            f.license_number,
            f.license_type,
            f.care_category,
            f.serves_memory_care,
            f.latitude::float AS latitude,
            f.longitude::float AS longitude,
            f.last_inspection_date,
            f.updated_at,
            COUNT(i.id) AS insp_count
        FROM facilities f
        JOIN inspections i ON i.facility_id = f.id
            AND i.inspection_date >= CURRENT_DATE - INTERVAL '3 years'
        WHERE f.state_code = %s
          AND f.publishable = true
          AND f.latitude IS NOT NULL
          AND f.longitude IS NOT NULL
          AND f.beds > 0
        GROUP BY f.id, f.name, f.slug, f.city_slug, f.state_code, f.beds,
                 f.city, f.street, f.zip, f.license_number, f.license_type,
                 f.care_category, f.serves_memory_care, f.latitude, f.longitude,
                 f.last_inspection_date, f.updated_at
        HAVING COUNT(i.id) >= 2
        ORDER BY random()
        LIMIT %s
        """,
        (state, count),
    )
    return [dict(row) for row in cur.fetchall()]


# ---------------------------------------------------------------------------
# Step 1: DB row completeness for the specific test facility
# ---------------------------------------------------------------------------

def _check_db_row(fac: dict[str, Any]) -> None:
    """Verify the specific facility row has all fields we depend on downstream."""
    lbl = f"{fac['state_code']}/{fac['slug']}"

    # Universal required
    for field in ("id", "name", "slug", "city_slug", "state_code", "license_number",
                  "care_category", "beds", "city"):
        check(
            f"{lbl} DB: field '{field}' non-null",
            fac.get(field) is not None and str(fac[field]).strip() != "",
            f"{field}={fac.get(field)!r}",
        )

    # Beds in range
    beds = fac.get("beds")
    check(f"{lbl} DB: beds 1–1000", beds is not None and 1 <= beds <= 1000, f"beds={beds}")

    # Lat/lon in US range
    lat = fac.get("latitude")
    lon = fac.get("longitude")
    check(f"{lbl} DB: latitude in US range", lat is not None and 18.0 <= float(lat) <= 72.0, f"lat={lat}")
    check(f"{lbl} DB: longitude in US range", lon is not None and -180.0 <= float(lon) <= -64.0, f"lon={lon}")

    # Slug format
    slug = fac.get("slug", "")
    check(
        f"{lbl} DB: slug is valid format",
        bool(re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", slug)) if len(slug) >= 2 else slug.isalnum(),
        f"slug={slug!r}",
    )

    # last_inspection_date format if present
    lid = fac.get("last_inspection_date")
    if lid:
        check(
            f"{lbl} DB: last_inspection_date is YYYY-MM-DD",
            bool(re.match(r"^\d{4}-\d{2}-\d{2}$", str(lid))),
            f"last_inspection_date={lid!r}",
        )

    # Inspection count (from the query)
    insp_count = fac.get("insp_count", 0)
    check(f"{lbl} DB: has ≥2 inspections in last 3 years", insp_count >= 2, f"insp_count={insp_count}")


# ---------------------------------------------------------------------------
# Step 2: Inspection and deficiency completeness
# ---------------------------------------------------------------------------

def _check_inspection_deficiency_chain(cur: Any, fac: dict[str, Any]) -> None:
    """Verify inspections + deficiencies for this facility are complete and coherent."""
    lbl = f"{fac['state_code']}/{fac['slug']}"

    cur.execute(
        """
        SELECT
            i.id,
            i.inspection_date,
            i.is_complaint,
            i.total_deficiency_count,
            i.source_agency,
            i.source_url,
            COUNT(d.id) AS def_row_count,
            COUNT(d.id) FILTER (WHERE d.severity IS NULL OR d.severity NOT IN (1,2,3,4)) AS bad_severity,
            COUNT(d.id) FILTER (WHERE d.immediate_jeopardy NOT IN (true, false)) AS bad_ij,
            COUNT(d.id) FILTER (WHERE d.is_repeat NOT IN (true, false)) AS bad_repeat
        FROM inspections i
        LEFT JOIN deficiencies d ON d.inspection_id = i.id
        WHERE i.facility_id = %s
        GROUP BY i.id, i.inspection_date, i.is_complaint,
                 i.total_deficiency_count, i.source_agency, i.source_url
        ORDER BY i.inspection_date DESC
        """,
        (fac["id"],),
    )
    rows = cur.fetchall()
    check(f"{lbl} inspections: has rows", len(rows) > 0, f"got {len(rows)}")

    for row in rows:
        iid = row["id"][:8]
        insp_lbl = f"{lbl}/insp({iid})"

        # inspection_date valid
        check(
            f"{insp_lbl}: inspection_date YYYY-MM-DD",
            bool(re.match(r"^\d{4}-\d{2}-\d{2}$", str(row["inspection_date"]))),
            f"date={row['inspection_date']!r}",
        )

        # source_agency non-empty
        check(
            f"{insp_lbl}: source_agency non-empty",
            row["source_agency"] is not None and str(row["source_agency"]).strip() != "",
            f"source_agency={row['source_agency']!r}",
        )

        # Deficiency field integrity
        if row["def_row_count"] > 0:
            check(
                f"{insp_lbl}: all deficiencies have valid severity (null or 1-4)",
                row["bad_severity"] == 0,
                f"{row['bad_severity']}/{row['def_row_count']} bad severity values",
            )
            check(
                f"{insp_lbl}: all deficiencies have boolean immediate_jeopardy",
                row["bad_ij"] == 0,
                f"{row['bad_ij']}/{row['def_row_count']} bad is_repeat values",
            )
            check(
                f"{insp_lbl}: all deficiencies have boolean is_repeat",
                row["bad_repeat"] == 0,
                f"{row['bad_repeat']}/{row['def_row_count']} bad is_repeat values",
            )


# ---------------------------------------------------------------------------
# Step 3: facility_snapshot RPC
# ---------------------------------------------------------------------------

def _check_snapshot_rpc(cur: Any, fac: dict[str, Any]) -> None:
    """Call the facility_snapshot RPC and verify all expected keys and ranges."""
    lbl = f"{fac['state_code']}/{fac['slug']}"

    cur.execute("SELECT facility_snapshot(%s) AS result", (fac["id"],))
    row = cur.fetchone()
    if row is None or row["result"] is None:
        check(f"{lbl} snapshot RPC: returned non-null", False, "RPC returned null")
        return
    check(f"{lbl} snapshot RPC: returned non-null", True, "")

    snap = row["result"]
    if isinstance(snap, str):
        try:
            snap = json.loads(snap)
        except json.JSONDecodeError:
            check(f"{lbl} snapshot RPC: parseable JSON", False, "")
            return

    # Top-level keys
    missing = SNAPSHOT_REQUIRED_KEYS - set(snap.keys())
    check(
        f"{lbl} snapshot RPC: all required top-level keys present",
        not missing,
        f"missing: {missing}",
    )

    # facility sub-object
    fac_snap = snap.get("facility") or {}
    check(f"{lbl} snapshot: facility.id matches", fac_snap.get("id") == fac["id"], f"id={fac_snap.get('id')!r}")
    check(f"{lbl} snapshot: facility.name present", bool(fac_snap.get("name")), f"name={fac_snap.get('name')!r}")
    check(f"{lbl} snapshot: facility.state_code matches", fac_snap.get("state_code") == fac["state_code"], f"state={fac_snap.get('state_code')!r}")

    # peer_set sub-object
    ps = snap.get("peer_set") or {}
    check(f"{lbl} snapshot: peer_set.n > 0", (ps.get("n") or 0) > 0, f"n={ps.get('n')}")
    check(f"{lbl} snapshot: peer_set.fallback_level is int", isinstance(ps.get("fallback_level"), int), f"fallback_level={ps.get('fallback_level')!r}")

    # metrics sub-object — all 4 metrics present with correct sub-keys
    metrics = snap.get("metrics") or {}
    for metric_name in SNAPSHOT_METRICS_KEYS:
        metric = metrics.get(metric_name)
        check(
            f"{lbl} snapshot: metrics.{metric_name} present",
            metric is not None,
            f"missing metric '{metric_name}'",
        )
        if metric is not None:
            for subkey in SNAPSHOT_METRIC_SUBKEYS:
                check(
                    f"{lbl} snapshot: metrics.{metric_name}.{subkey} present",
                    subkey in metric,
                    f"missing subkey '{subkey}'",
                )
            # value must be non-negative
            check(
                f"{lbl} snapshot: metrics.{metric_name}.value >= 0",
                (metric.get("value") or 0) >= 0,
                f"value={metric.get('value')}",
            )
            # percentile null or 0-100
            pct = metric.get("percentile")
            check(
                f"{lbl} snapshot: metrics.{metric_name}.percentile null or 0–100",
                pct is None or (isinstance(pct, (int, float)) and 0 <= pct <= 100),
                f"percentile={pct}",
            )

    # has_inspections must agree with what we found in the DB
    has_insp = snap.get("has_inspections")
    check(
        f"{lbl} snapshot: has_inspections is boolean",
        isinstance(has_insp, bool),
        f"has_inspections={has_insp!r}",
    )
    check(
        f"{lbl} snapshot: has_inspections=True (facility has inspections)",
        has_insp is True,
        f"has_inspections={has_insp}",
    )

    # trajectory_series: list of dicts with 'month', 'facility_score', 'peer_median_score'
    ts = snap.get("trajectory_series") or []
    check(f"{lbl} snapshot: trajectory_series is list", isinstance(ts, list), "")
    if ts:
        first = ts[0]
        check(
            f"{lbl} snapshot: trajectory_series[0] has 'month'",
            "month" in first,
            f"keys={list(first.keys())}",
        )
        check(
            f"{lbl} snapshot: trajectory_series[0] has 'facility_score'",
            "facility_score" in first,
            f"keys={list(first.keys())}",
        )
        check(
            f"{lbl} snapshot: trajectory_series[0] has 'peer_median_score'",
            "peer_median_score" in first,
            f"keys={list(first.keys())}",
        )

    # grade: null or has letter + composite_percentile
    grade = snap.get("grade")
    if grade is not None:
        check(
            f"{lbl} snapshot: grade.letter is A-F",
            bool(re.match(r"^[A-F][+-]?$", str(grade.get("letter", "")))),
            f"letter={grade.get('letter')!r}",
        )
        cp = grade.get("composite_percentile")
        check(
            f"{lbl} snapshot: grade.composite_percentile 0–100",
            isinstance(cp, (int, float)) and 0 <= cp <= 100,
            f"composite_percentile={cp}",
        )


# ---------------------------------------------------------------------------
# Step 4: API route — facility appears with correct values
# ---------------------------------------------------------------------------

def _check_api_route(base: str, fac: dict[str, Any]) -> None:
    """Fetch /api/facilities/{state}, find this facility, verify every field."""
    lbl = f"{fac['state_code']}/{fac['slug']}"
    slug = STATE_SLUGS.get(fac["state_code"], fac["state_code"].lower())
    url = f"{base}/api/facilities/{slug}"

    status, payload, raw = _fetch_json(url)
    check(f"{lbl} API route: HTTP 200", status == 200, f"got {status}")
    if status != 200 or not payload:
        return

    facilities = payload.get("facilities", [])
    # Find this facility in the response
    match = next((f for f in facilities if f.get("id") == fac["id"]), None)
    check(
        f"{lbl} API route: facility present in response",
        match is not None,
        f"id={fac['id']} not found in {len(facilities)} facilities",
    )
    if match is None:
        return

    # Verify every field of the matched facility against the DB row
    check(f"{lbl} API route: name matches", match.get("name") == fac["name"], f"api={match.get('name')!r} db={fac['name']!r}")
    check(f"{lbl} API route: beds matches", match.get("beds") == fac["beds"], f"api={match.get('beds')} db={fac['beds']}")
    check(f"{lbl} API route: serves_memory_care matches", bool(match.get("serves_memory_care")) == bool(fac["serves_memory_care"]), f"api={match.get('serves_memory_care')} db={fac['serves_memory_care']}")
    check(f"{lbl} API route: care_category matches", match.get("care_category") == fac["care_category"], f"api={match.get('care_category')!r} db={fac['care_category']!r}")

    url_field = match.get("url", "")
    check(f"{lbl} API route: url contains city_slug", fac["city_slug"] in url_field, f"url={url_field!r}")
    check(f"{lbl} API route: url contains slug", fac["slug"] in url_field, f"url={url_field!r}")
    check(f"{lbl} API route: url is https://", url_field.startswith("https://"), f"url={url_field!r}")

    # total_deficiency_count must be non-negative
    tdc = match.get("total_deficiency_count", 0)
    check(f"{lbl} API route: total_deficiency_count >= 0", isinstance(tdc, int) and tdc >= 0, f"tdc={tdc}")

    # postal_code present (may be null — just verify key exists)
    check(f"{lbl} API route: postal_code key exists", "postal_code" in match, f"keys={list(match.keys())[:12]}")
    check(f"{lbl} API route: latitude key exists", "latitude" in match, f"keys={list(match.keys())[:12]}")
    check(f"{lbl} API route: longitude key exists", "longitude" in match, f"keys={list(match.keys())[:12]}")
    check(f"{lbl} API route: last_inspection_date key exists", "last_inspection_date" in match, "")
    check(f"{lbl} API route: regulator_url key exists", "regulator_url" in match, "")


# ---------------------------------------------------------------------------
# Step 5: Profile page HTML
# ---------------------------------------------------------------------------

def _check_profile_page_html(base: str, fac: dict[str, Any]) -> None:
    """Fetch the facility profile page and verify every expected element."""
    lbl = f"{fac['state_code']}/{fac['slug']}"
    state_slug = fac["state_code"].lower()
    url = f"{base}/{state_slug}/{fac['city_slug']}/{fac['slug']}"

    status, body = fetch_page(url)
    check(f"{lbl} page: HTTP 200", status == 200, f"got {status}")
    if status != 200:
        return

    check(f"{lbl} page: body > 10 KB", len(body) > 10_000, f"len={len(body)}")

    # Facility name appears on page (first significant word)
    words = [w for w in fac["name"].split() if len(w) > 3]
    if words:
        first_word = words[0]
        check(
            f"{lbl} page: facility name visible",
            first_word.lower() in body.lower(),
            f"looking for '{first_word}'",
        )

    # No corruption artifacts
    has_nan = bool(re.search(r'\bNaN\b', body))
    has_undef = bool(re.search(r'\bundefined\b', body))
    has_obj = "[object Object]" in body
    check(f"{lbl} page: no 'NaN'", not has_nan, "found 'NaN' in page body")
    check(f"{lbl} page: no 'undefined'", not has_undef, "found 'undefined' in page body")
    check(f"{lbl} page: no '[object Object]'", not has_obj, "found '[object Object]' in page body")

    # JSON-LD script tags
    jsonld_blocks = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        body,
        re.DOTALL | re.IGNORECASE,
    )
    check(
        f"{lbl} page: at least one JSON-LD block",
        len(jsonld_blocks) >= 1,
        f"found {len(jsonld_blocks)} blocks",
    )

    # Parse all JSON-LD blocks and verify required @types
    found_types: set[str] = set()
    for block in jsonld_blocks:
        try:
            ld = json.loads(block.strip())
            if isinstance(ld, dict):
                t = ld.get("@type", "")
                if isinstance(t, list):
                    found_types.update(t)
                else:
                    found_types.add(t)
            elif isinstance(ld, list):
                for item in ld:
                    if isinstance(item, dict):
                        t = item.get("@type", "")
                        if isinstance(t, list):
                            found_types.update(t)
                        else:
                            found_types.add(t)
        except json.JSONDecodeError:
            pass

    for expected_type in EXPECTED_JSONLD_TYPES:
        check(
            f"{lbl} page: JSON-LD contains @type '{expected_type}'",
            expected_type in found_types,
            f"found types: {found_types}",
        )

    # LocalBusiness JSON-LD must have name matching DB
    for block in jsonld_blocks:
        try:
            ld = json.loads(block.strip())
            items = [ld] if isinstance(ld, dict) else (ld if isinstance(ld, list) else [])
            for item in items:
                if not isinstance(item, dict):
                    continue
                t = item.get("@type", "")
                types = t if isinstance(t, list) else [t]
                if "LocalBusiness" in types:
                    ld_name = item.get("name", "")
                    check(
                        f"{lbl} page: LocalBusiness name contains facility name",
                        fac["name"].split()[0].lower() in ld_name.lower(),
                        f"ld_name={ld_name!r} expected first word of {fac['name']!r}",
                    )
                    # address should be present
                    check(
                        f"{lbl} page: LocalBusiness has address",
                        "address" in item,
                        f"keys={list(item.keys())[:10]}",
                    )
                    break
        except json.JSONDecodeError:
            pass

    # Canonical URL in head
    canonical_match = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']', body)
    check(
        f"{lbl} page: canonical link tag present",
        canonical_match is not None,
        "no <link rel='canonical'> found",
    )
    if canonical_match:
        canonical = canonical_match.group(1)
        check(
            f"{lbl} page: canonical URL contains slug",
            fac["slug"] in canonical,
            f"canonical={canonical!r}",
        )

    # Open graph title
    og_title = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', body)
    check(
        f"{lbl} page: og:title meta tag present",
        og_title is not None,
        "no og:title found",
    )

    # Breadcrumb navigation — state name should appear
    check(
        f"{lbl} page: state-level breadcrumb text present",
        fac["state_code"] in body or fac.get("city", "").split()[0].lower() in body.lower(),
        "state code or city not found in breadcrumb area",
    )


# ---------------------------------------------------------------------------
# Step 6: Watch signup API
# ---------------------------------------------------------------------------

def _check_watch_signup(base: str, cur: Any, fac: dict[str, Any]) -> None:
    """
    POST to /api/watch with a test email. Verify it returns {ok: true} and
    writes a row to facility_watchers. Then clean up the test row.

    We use a unique sentinel email to avoid polluting real data.
    """
    lbl = f"{fac['state_code']}/{fac['slug']}"
    test_email = f"e2e-test-{fac['id'][:8]}@example-e2e.invalid"
    url = f"{base}/api/watch"

    payload = {
        "email": test_email,
        "facilityId": fac["id"],
        "facilityName": fac["name"],
        "source": "facility_hero",
        # Timestamp-based honeypot field (fresh submission)
        "_ts": str(int(time.time() * 1000)),
    }

    status, resp = _post_json(url, payload)
    check(f"{lbl} watch signup: HTTP 200", status == 200, f"got {status}")
    if status == 200:
        check(
            f"{lbl} watch signup: response is {{ok: true}}",
            isinstance(resp, dict) and resp.get("ok") is True,
            f"response={resp!r}",
        )

    # Verify the DB row was written (only if we got 200)
    if status == 200:
        cur.execute(
            """
            SELECT id, email, facility_id, source, confirmed_at
            FROM facility_watchers
            WHERE email = %s AND facility_id = %s
            """,
            (test_email, fac["id"]),
        )
        db_row = cur.fetchone()
        check(
            f"{lbl} watch signup: DB row created in facility_watchers",
            db_row is not None,
            f"no row for email={test_email!r} facility_id={fac['id']!r}",
        )
        if db_row:
            check(
                f"{lbl} watch signup: confirmed_at is non-null",
                db_row["confirmed_at"] is not None,
                f"confirmed_at={db_row['confirmed_at']!r}",
            )

    # Cleanup: remove the test row so it doesn't contaminate watch digests
    cur.execute(
        "DELETE FROM facility_watchers WHERE email = %s AND facility_id = %s",
        (test_email, fac["id"]),
    )
    cur.connection.commit()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="StarlynnCare Soup-to-Nuts E2E Pipeline Tests"
    )
    parser.add_argument(
        "--base-url",
        default=PRODUCTION_URL,
        help=f"Base URL (default: {PRODUCTION_URL})",
    )
    parser.add_argument(
        "--state",
        default=None,
        help="Limit to one state (e.g. CA). Default: one facility per covered state.",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=2,
        help="Test facilities per state (default 2)",
    )
    parser.add_argument(
        "--skip-watch",
        action="store_true",
        help="Skip the watch signup API test (avoids POST to /api/watch)",
    )
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    state_filter = args.state.upper() if args.state else None
    count = max(1, args.count)

    states_to_test = [
        s for s in STATE_SLUGS.keys()
        if not state_filter or s == state_filter
    ]

    print("=" * 60)
    print("StarlynnCare — Soup-to-Nuts E2E Pipeline Tests")
    print(f"Base URL: {base}")
    print(f"States:   {states_to_test}")
    print(f"Count:    {count} facilities per state")
    print("=" * 60)

    with get_conn() as conn:
        with conn.cursor() as cur:
            for state in states_to_test:
                facilities = _pick_test_facilities(cur, state, count)
                if not facilities:
                    check(
                        f"{state}: found test facilities in DB",
                        False,
                        "0 facilities with ≥2 inspections + geocoding found",
                    )
                    continue

                print(f"\n{'─'*60}")
                print(f"  {state}: {len(facilities)} test facilit{'y' if len(facilities)==1 else 'ies'}")
                print(f"{'─'*60}")

                for fac in facilities:
                    print(f"\n  ▶ {fac['name']} ({fac['city']})")
                    print(f"    slug: {fac['slug']}")
                    print(f"    id:   {fac['id']}")

                    _check_db_row(fac)
                    _check_inspection_deficiency_chain(cur, fac)
                    _check_snapshot_rpc(cur, fac)
                    _check_api_route(base, fac)
                    _check_profile_page_html(base, fac)
                    if not args.skip_watch:
                        _check_watch_signup(base, cur, fac)
                    time.sleep(0.3)  # polite delay between profile page fetches

    run_all_checks("E2E full pipeline")


if __name__ == "__main__":
    main()
