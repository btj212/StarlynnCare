#!/usr/bin/env python3
"""
Utah CCL Inspection Scraper — Playwright + network interception

ccl.utah.gov is a React/Vite SPA backed by https://new-cclapi.utah.gov/api,
which requires OAuth (login.dts.utah.gov/sso/oauth2). This scraper:

1. Launches a Playwright browser and navigates to ccl.utah.gov.
2. Intercepts all XHR/fetch requests to new-cclapi.utah.gov to capture
   the Authorization header (Bearer token) that the app obtains on load.
3. Uses that token to make direct API calls for each UT publishable facility's
   inspection history, deficiencies, and enforcement actions.
4. Upserts results into the inspections/deficiencies tables.

The token obtained this way is a guest/public session token — the public
search requires no login but the SPA acquires it automatically via PKCE or
client-credentials flow. Once captured we can reuse it for all facility lookups.

Prerequisites:
    pip install playwright psycopg python-dotenv
    playwright install chromium

Usage:
    python3 -u ut_ccl_inspections_scraper.py --smoke-test   # test on 3 facilities
    python3 -u ut_ccl_inspections_scraper.py                # full run
    python3 -u ut_ccl_inspections_scraper.py --dry-run      # fetch only, no DB writes
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv

try:
    from playwright.sync_api import sync_playwright, Page, BrowserContext, Request
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

REPO_ROOT = Path(__file__).resolve().parent.parent
CCL_BASE = "https://ccl.utah.gov"
API_BASE = "https://new-cclapi.utah.gov/api"

# Polite request delay (seconds) — avoid Cloudflare rate-limiting
REQUEST_DELAY = 0.5


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ---------------------------------------------------------------------------
# Token capture via Playwright
# ---------------------------------------------------------------------------


def capture_auth_token(headless: bool = True) -> str | None:
    """
    Launch a Playwright browser, navigate to ccl.utah.gov, and intercept
    the Authorization header from the first API call to new-cclapi.utah.gov.

    Returns the Bearer token string, or None if not captured within 15s.
    """
    if not PLAYWRIGHT_AVAILABLE:
        print("playwright not installed. Run: pip install playwright && playwright install chromium", file=sys.stderr)
        return None

    captured_token: list[str] = []

    def handle_request(request: Request) -> None:
        if "new-cclapi.utah.gov" in request.url and not captured_token:
            auth = request.headers.get("authorization") or request.headers.get("Authorization")
            if auth and auth.startswith("Bearer "):
                token = auth[len("Bearer "):]
                captured_token.append(token)
                print(f"  Captured Bearer token: {token[:16]}…", flush=True)

    print("Launching Playwright to capture CCL session token …", flush=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        ctx: BrowserContext = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )
        page: Page = ctx.new_page()
        page.on("request", handle_request)

        # Navigate to the facility search page — this triggers the app to get its token
        page.goto(f"{CCL_BASE}/ccl/public/search", wait_until="networkidle", timeout=20_000)

        # Wait up to 10 more seconds if token not yet captured
        deadline = time.time() + 10
        while not captured_token and time.time() < deadline:
            page.wait_for_timeout(500)

        browser.close()

    return captured_token[0] if captured_token else None


# ---------------------------------------------------------------------------
# API calls (once we have the token)
# ---------------------------------------------------------------------------


def api_get(path: str, token: str, params: dict | None = None) -> dict | list | None:
    """Make an authenticated GET to new-cclapi.utah.gov/api/{path}."""
    url = f"{API_BASE}/{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    try:
        r = requests.get(url, headers=headers, params=params, timeout=20)
        if r.status_code == 401:
            print(f"  Token expired on {path} — need to re-capture", flush=True)
            return None
        if r.status_code == 404:
            return []
        r.raise_for_status()
        return r.json()
    except requests.RequestException as exc:
        print(f"  API ERROR {path}: {exc}", flush=True)
        return None


def discover_api_routes(token: str) -> None:
    """
    Probe known API patterns to identify available routes.
    Call this during smoke test to map the API before building the full scraper.
    """
    print("\nProbing API routes …", flush=True)
    probes = [
        "facility",
        "facility/search",
        "health-facility",
        "health-facility/search",
        "inspection",
        "inspection/search",
        "compliance",
        "compliance/search",
        "survey",
        "survey/search",
        "violation",
    ]
    for path in probes:
        r = requests.get(
            f"{API_BASE}/{path}",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            timeout=10,
        )
        print(f"  {r.status_code}  {API_BASE}/{path}", flush=True)
        time.sleep(0.2)


def fetch_facility_inspections(
    external_id: str,
    facility_name: str,
    token: str,
) -> list[dict]:
    """
    Fetch inspection records for a single facility from ccl.utah.gov.

    NOTE: Route patterns are probed during smoke test and may need adjustment
    based on what the API actually exposes. Update INSPECTION_PATH after discovery.
    """
    # These paths are our best guesses based on the SPA route structure.
    # Run --smoke-test first to identify the correct routes.
    candidate_paths = [
        f"facility/{external_id}/inspection",
        f"health-facility/{external_id}/inspection",
        f"facility/{external_id}/compliance",
        f"health-facility/{external_id}/compliance",
        f"inspection?facilityId={external_id}",
        f"inspection?licenseNumber={external_id}",
    ]
    for path in candidate_paths:
        result = api_get(path, token)
        if result is not None and isinstance(result, list) and len(result) > 0:
            print(f"  [{external_id}] Found inspections via: {path} ({len(result)} records)", flush=True)
            return result
        elif isinstance(result, dict) and result.get("data"):
            return result["data"]
        time.sleep(REQUEST_DELAY)
    return []


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


def load_publishable_facilities(conn: psycopg.Connection) -> list[dict]:
    """Return all UT publishable facilities with their external_id."""
    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(
            """
            SELECT id, external_id, name
            FROM facilities
            WHERE state_code = 'UT'
              AND serves_memory_care = true
              AND license_status = 'LICENSED'
            ORDER BY name
            """
        )
        return cur.fetchall()


def _parse_date(raw: str | None) -> date | None:
    if not raw:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(raw[:10], fmt[:10]).date()
        except (ValueError, AttributeError):
            pass
    return None


INSPECTION_INSERT_SQL = """
    INSERT INTO inspections (
        facility_id, inspection_date, inspection_type,
        deficiency_count, source_url
    ) VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (facility_id, inspection_date, inspection_type)
    DO UPDATE SET
        deficiency_count = EXCLUDED.deficiency_count,
        source_url       = EXCLUDED.source_url
    RETURNING id
"""

DEFICIENCY_INSERT_SQL = """
    INSERT INTO deficiencies (
        inspection_id, facility_id,
        code, description, severity_int, is_ij
    ) VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT (inspection_id, code) DO UPDATE SET
        description  = EXCLUDED.description,
        severity_int = EXCLUDED.severity_int,
        is_ij        = EXCLUDED.is_ij
"""


def _map_severity(raw_severity: str | None, fine_amount: float | None) -> tuple[int, bool]:
    """Map UT enforcement outcome to our severity_int scale (see methodology brief §5.2)."""
    if not raw_severity:
        return 1, False
    s = raw_severity.upper()
    is_ij = any(k in s for k in ("IMMEDIATE JEOPARDY", "REVOCATION", "SUSPENSION", "ABUSE"))
    if is_ij:
        return 4, True
    if any(k in s for k in ("SUSPENSION", "REVOCATION", "ADMISSION BAN", "MONITORING")):
        return 3, False
    if fine_amount and fine_amount >= 500:
        return 3, False
    if fine_amount and fine_amount > 0:
        return 2, False
    return 1, False


def store_inspections(
    conn: psycopg.Connection,
    facility_id: str,
    external_id: str,
    inspection_records: list[dict],
    dry_run: bool,
) -> tuple[int, int]:
    insp_count = 0
    def_count = 0
    source_url = f"https://ccl.utah.gov/ccl/facility/{external_id}"

    with conn.cursor() as cur:
        for rec in inspection_records:
            insp_date = _parse_date(
                rec.get("surveyDate") or rec.get("survey_date") or rec.get("inspectionDate")
            )
            if not insp_date:
                continue
            insp_type = "annual" if any(
                k in str(rec.get("surveyType") or "").upper()
                for k in ("ANNUAL", "STANDARD", "ROUTINE")
            ) else "complaint"
            defs = rec.get("deficiencies") or rec.get("violations") or []
            def_count_raw = len(defs) if isinstance(defs, list) else (rec.get("deficiencyCount") or 0)

            if dry_run:
                insp_count += 1
                def_count += def_count_raw
                continue

            sp = f"sp_{external_id}_{insp_date.isoformat().replace('-', '')}"
            try:
                cur.execute(f"SAVEPOINT {sp}")
                cur.execute(INSPECTION_INSERT_SQL, (facility_id, insp_date, insp_type, def_count_raw, source_url))
                row = cur.fetchone()
                inspection_id = row[0] if row else None
                cur.execute(f"RELEASE SAVEPOINT {sp}")
                insp_count += 1
            except Exception as exc:
                cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                print(f"  INSP ERROR {external_id} {insp_date}: {exc}", flush=True)
                continue

            if inspection_id is None:
                cur.execute(
                    "SELECT id FROM inspections WHERE facility_id=%s AND inspection_date=%s AND inspection_type=%s",
                    (facility_id, insp_date, insp_type),
                )
                row = cur.fetchone()
                inspection_id = row[0] if row else None

            if not inspection_id or not isinstance(defs, list):
                continue

            for d in defs:
                code = str(d.get("tag") or d.get("code") or d.get("regulationCode") or "UTN000")
                desc = d.get("description") or d.get("narrative") or ""
                fine = d.get("fineAmount") or d.get("penalty")
                try:
                    fine = float(fine) if fine else None
                except (ValueError, TypeError):
                    fine = None
                sev_int, is_ij = _map_severity(d.get("severity") or d.get("outcome"), fine)
                sp2 = f"sp_d_{code}"
                try:
                    cur.execute(f"SAVEPOINT {sp2}")
                    cur.execute(DEFICIENCY_INSERT_SQL, (inspection_id, facility_id, code, desc, sev_int, is_ij))
                    cur.execute(f"RELEASE SAVEPOINT {sp2}")
                    def_count += 1
                except Exception:
                    cur.execute(f"ROLLBACK TO SAVEPOINT {sp2}")

    return insp_count, def_count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="UT CCL inspection scraper (Playwright)")
    parser.add_argument("--smoke-test", action="store_true", help="Test on 3 facilities and probe API routes")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but don't write to DB")
    parser.add_argument("--headful", action="store_true", help="Run Playwright in headful mode")
    args = parser.parse_args()

    if not PLAYWRIGHT_AVAILABLE:
        print("Install playwright: pip install playwright && playwright install chromium", file=sys.stderr)
        sys.exit(1)

    load_env()
    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    # Step 1: Capture session token from the rendered SPA
    token = capture_auth_token(headless=not args.headful)
    if not token:
        print(
            "\nFailed to capture Bearer token from ccl.utah.gov.\n"
            "The SPA may require login before issuing API tokens.\n"
            "Next steps:\n"
            "  1. Run with --headful to watch the browser session\n"
            "  2. Inspect network traffic manually in Chrome DevTools on ccl.utah.gov\n"
            "  3. If OAuth is required, consider using CMS data only for NF inspections\n"
            "     and submitting a GRAMA request for ALF inspection records.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Step 2 (smoke test): probe API routes to find correct inspection endpoints
    if args.smoke_test:
        discover_api_routes(token)

    # Step 3: Load target facilities
    if not args.dry_run:
        dsn = os.environ["DATABASE_URL"]
        with psycopg.connect(dsn) as conn:
            facilities = load_publishable_facilities(conn)
    else:
        # Dry run — use stub data
        facilities = [{"id": "stub", "external_id": "F23-106644", "name": "Abbington Manor AL II"}]

    if args.smoke_test:
        facilities = facilities[:3]
        print(f"\nSmoke test: processing {len(facilities)} facilities", flush=True)
    else:
        print(f"\nProcessing {len(facilities)} UT publishable facilities", flush=True)

    total_insp = 0
    total_def = 0

    if not args.dry_run:
        dsn = os.environ["DATABASE_URL"]
        conn = psycopg.connect(dsn)
    else:
        conn = None

    try:
        for i, fac in enumerate(facilities, 1):
            ext_id = fac["external_id"]
            name = fac["name"]
            print(f"[{i}/{len(facilities)}] {ext_id} — {name}", flush=True)

            inspections = fetch_facility_inspections(ext_id, name, token)
            if not inspections:
                print(f"  No inspection records found", flush=True)
                time.sleep(REQUEST_DELAY)
                continue

            if conn:
                insp_c, def_c = store_inspections(conn, fac["id"], ext_id, inspections, dry_run=False)
                conn.commit()
            else:
                insp_c, def_c = store_inspections(None, fac["id"], ext_id, inspections, dry_run=True)

            total_insp += insp_c
            total_def += def_c
            print(f"  → {insp_c} inspections, {def_c} deficiencies stored", flush=True)
            time.sleep(REQUEST_DELAY)
    finally:
        if conn:
            conn.close()

    print(f"\nDone. Total: {total_insp} inspections, {total_def} deficiency records.", flush=True)


if __name__ == "__main__":
    main()
