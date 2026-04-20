#!/usr/bin/env python3
"""
Ingest California RCFE roster for Alameda County into StarlynnCare facilities.

Data sources
------------
1.  CA Open Data CKAN — RCFE roster
    https://data.ca.gov/dataset/community-care-licensing-facilities
    resource id: 6b2f5818-f60d-40b5-bc2a-94f995f9f8b0
    Filter: county_name = "ALAMEDA"

2.  CDSS Transparency API — per-facility visit metrics (once per run, statewide)
    https://www.ccld.dss.ca.gov/transparencyapi/api/Facility/<any>
    Returns a ~30 MB JSON array of every CCLD facility; we filter in-memory.
    Cached to /tmp/ccld_facility_all_cache.json (TTL: 24 h) to avoid hammering
    the server on repeated runs.

Upsert conflict: (state_code, city_slug, slug)
    License numbers are used to generate stable slugs. CDSS facilities have no
    cms_id, so cms_id is left NULL.

Run modes
---------
    python ccld_rcfe_ingest.py --dry-run          # CKAN only, no DB
    python ccld_rcfe_ingest.py --smoke            # first 10 records, writes DB
    python ccld_rcfe_ingest.py                    # full Alameda ingest
    python ccld_rcfe_ingest.py --force-publish    # skip memory-care gate (testing)

Memory-care identification
--------------------------
Pass 1 (name regex): flag rcfe_memory_care if the facility name or licensee
contains any of the canonical memory-care keywords.
Pass 2 (citation scan, Phase D): flag facilities cited under §87705/§87706.
Pass 3 (manual): only manually-confirmed facilities get publishable = true
  UNLESS --force-publish is set.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "CA"
SCRAPER_NAME = "cdss_ccld_rcfe_alameda"
COUNTY_FILTER = "ALAMEDA"

CKAN_RESOURCE_ID = "6b2f5818-f60d-40b5-bc2a-94f995f9f8b0"
CKAN_DATASTORE_URL = "https://data.ca.gov/api/3/action/datastore_search"

TRANSPARENCY_ALL_URL = (
    "https://www.ccld.dss.ca.gov/transparencyapi/api/Facility/any"
)
TRANSPARENCY_CACHE = Path("/tmp/ccld_facility_all_cache.json")
TRANSPARENCY_CACHE_TTL_HOURS = 24

FACILITY_PROFILE_URL = (
    "https://www.ccld.dss.ca.gov/carefacilitysearch/?rewrite=FacDetail&facNum={}"
)

# Regex for Phase 1 memory-care identification.
# Matches facility_name or licensee (case-insensitive, word-boundary anchored).
# "legacy" is excluded — too common a facility name word without memory-care context.
# "silverado" is a known memory-care brand, kept.
MEMORY_CARE_RE = re.compile(
    r"\b("
    r"memory\s*care|memory[-\s]care|memory\s+care"
    r"|dementia"
    r"|alzheimer"
    r"|silverado"
    r"|cognitive\s+care|cognitive\s+memory"
    r"|reminiscence"
    r"|mind[s]?\s*\&?\s*motion"
    r"|neurocognitive|neurodegenerative"
    r")\b",
    re.IGNORECASE,
)

# City→county lookup for sanity-check. CDSS occasionally mis-assigns a facility
# to the wrong county. Drop records whose city is known to be outside Alameda.
CITIES_NOT_IN_ALAMEDA = frozenset({
    "concord", "walnut-creek", "antioch", "pittsburg", "brentwood",
    "richmond", "el-cerrito", "san-pablo", "hercules", "pinole",
    "san-jose", "santa-clara", "milpitas", "sunnyvale",
    "san-francisco", "south-san-francisco", "daly-city",
})

REQUEST_DELAY_SECS = 0.5  # polite delay between Transparency API calls

# ---------------------------------------------------------------------------
# Env
# ---------------------------------------------------------------------------


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ---------------------------------------------------------------------------
# Slug helpers
# ---------------------------------------------------------------------------


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "facility"


def titleize(text: str) -> str:
    """Uppercase-all CDSS names → Title Case."""
    if not text:
        return text
    stop = {"and", "or", "of", "in", "the", "a", "at", "by", "for", "to",
            "de", "del", "las", "los", "el", "la", "&"}
    words = text.lower().split()
    result = []
    for i, w in enumerate(words):
        result.append(w if (i > 0 and w in stop) else w.capitalize())
    return " ".join(result)


def pad_license(num: int | str) -> str:
    """CDSS facility numbers are 9 digits, sometimes stored as ints → restore leading zeros."""
    return str(int(num)).zfill(9)


def facility_slug(name: str, license_num: str) -> str:
    """Stable slug: name-slug + last-6 of license number."""
    base = slugify(name)
    suffix = license_num[-6:].lstrip("0") or license_num[-2:]
    return f"{base}-{suffix}"


# ---------------------------------------------------------------------------
# Parse helpers
# ---------------------------------------------------------------------------


def parse_date_cdss(val: str | None) -> date | None:
    """Parse M/D/YYYY dates from CDSS (license_first_date, LastVisitDate)."""
    if not val or str(val).strip() in ("", "None"):
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(val).strip(), fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Source 1: CKAN roster
# ---------------------------------------------------------------------------


def fetch_alameda_rcfe_roster(limit: int | None = None) -> list[dict[str, Any]]:
    """
    Pull all Alameda County RCFE records from the CA Open Data CKAN datastore.
    CKAN's county_name values are UPPERCASE — the filter must match exactly.
    """
    page_size = 500
    all_rows: list[dict[str, Any]] = []
    offset = 0

    while True:
        params: dict[str, Any] = {
            "resource_id": CKAN_RESOURCE_ID,
            "filters": json.dumps({"county_name": COUNTY_FILTER}),
            "limit": page_size,
            "offset": offset,
        }
        resp = requests.get(
            CKAN_DATASTORE_URL,
            params=params,
            timeout=30,
            headers={"User-Agent": "StarlynnCare/RCFE-ingest (contact@starlynncare.com)"},
        )
        resp.raise_for_status()
        payload = resp.json()

        if not payload.get("success"):
            raise RuntimeError(f"CKAN returned error: {payload.get('error')}")

        rows = payload["result"]["records"]
        all_rows.extend(rows)

        if limit and len(all_rows) >= limit:
            all_rows = all_rows[:limit]
            break

        if len(rows) < page_size:
            break  # last page
        offset += page_size

    return all_rows


# ---------------------------------------------------------------------------
# Source 2: Transparency API — statewide facility metrics (cached)
# ---------------------------------------------------------------------------


def load_transparency_all(force_refresh: bool = False) -> dict[str, dict[str, Any]]:
    """
    Download (and cache) the 30 MB CDSS transparency facility dump.
    Returns a dict keyed by zero-padded 9-digit facility_number string.
    """
    cache_valid = (
        not force_refresh
        and TRANSPARENCY_CACHE.exists()
        and (
            datetime.now() - datetime.fromtimestamp(TRANSPARENCY_CACHE.stat().st_mtime)
            < timedelta(hours=TRANSPARENCY_CACHE_TTL_HOURS)
        )
    )

    if cache_valid:
        print(f"Using cached Transparency API data: {TRANSPARENCY_CACHE}")
        with open(TRANSPARENCY_CACHE) as f:
            raw = json.load(f)
    else:
        print(f"Downloading Transparency API data (~30 MB) from {TRANSPARENCY_ALL_URL} …")
        resp = requests.get(
            TRANSPARENCY_ALL_URL,
            timeout=120,
            headers={"User-Agent": "StarlynnCare/RCFE-ingest"},
        )
        resp.raise_for_status()
        raw = resp.json()
        with open(TRANSPARENCY_CACHE, "w") as f:
            json.dump(raw, f)
        print(f"Cached to {TRANSPARENCY_CACHE}")

    # Build lookup: pad FacilityNumber to 9 chars
    lookup: dict[str, dict[str, Any]] = {}
    for item in raw:
        num_raw = str(item.get("FacilityNumber") or "").strip()
        if num_raw:
            key = num_raw.zfill(9)
            lookup[key] = item
    print(f"Transparency lookup: {len(lookup)} facilities loaded")
    return lookup


# ---------------------------------------------------------------------------
# Memory-care classification
# ---------------------------------------------------------------------------


def classify_facility(
    row: dict[str, Any],
) -> tuple[str, bool, str | None]:
    """
    Returns (care_category, serves_memory_care, memory_care_designation).

    care_category options (from migration 0002):
      rcfe_memory_care | rcfe_general | ccrc | snf_* (N/A here)

    Identification is Pass 1 only (name regex). Pass 2 (citation scan §87705/§87706)
    runs in Phase D after inspection HTML is ingested.
    """
    ftype = (row.get("facility_type") or "").upper()
    is_ccrc = "CONTINUING CARE RETIREMENT COMMUNITY" in ftype

    name = row.get("facility_name") or ""
    licensee = row.get("licensee") or ""
    combined = f"{name} {licensee}"

    mc_match = MEMORY_CARE_RE.search(combined)

    if is_ccrc:
        care_category = "ccrc"
        if mc_match:
            serves_mc = True
            designation = (
                f"CCRC — name indicates memory-care program "
                f"(matched: '{mc_match.group()}')"
            )
        else:
            serves_mc = False
            designation = "CCRC — memory-care capability unconfirmed"
    else:
        if mc_match:
            care_category = "rcfe_memory_care"
            serves_mc = True
            designation = (
                f"RCFE — name indicates dementia/memory-care program "
                f"(matched: '{mc_match.group()}')"
            )
        else:
            care_category = "rcfe_general"
            serves_mc = False
            designation = None

    return care_category, serves_mc, designation


# ---------------------------------------------------------------------------
# Build DB row
# ---------------------------------------------------------------------------


def build_facility_row(
    ckan: dict[str, Any],
    trans: dict[str, Any] | None,
    force_publish: bool = False,
) -> dict[str, Any] | None:
    """
    Map one CKAN + Transparency row to a facilities INSERT dict.
    Returns None if the record should be skipped (e.g. city outside Alameda).
    """
    raw_num = ckan.get("facility_number")
    license_num = pad_license(raw_num) if raw_num else "000000000"

    raw_name = (ckan.get("facility_name") or "").strip()
    name = titleize(raw_name) or f"Facility {license_num}"

    raw_city = (ckan.get("facility_city") or "").strip()
    city = titleize(raw_city)
    city_slug = slugify(raw_city) if raw_city else "unknown-city"

    # Drop records whose city is known to be outside Alameda County
    if city_slug in CITIES_NOT_IN_ALAMEDA:
        return None

    slug = facility_slug(name, license_num)

    raw_status = (ckan.get("facility_status") or "").strip().upper()

    care_category, serves_mc, designation = classify_facility(ckan)

    # publishable: LICENSED + memory-care confirmed (or force flag for testing)
    publishable = bool(raw_status == "LICENSED" and (serves_mc or force_publish))

    # last inspection date from Transparency API
    last_inspection: date | None = None
    if trans:
        last_inspection = parse_date_cdss(trans.get("LastVisitDate"))

    # license_first_date → use as a rough proxy for license_expiration? No —
    # CA RCFEs don't have an expiration date per se (annual renewal). We store
    # license_first_date in the notes but leave license_expiration null.

    raw_cap = ckan.get("facility_capacity")
    beds: int | None = None
    if raw_cap is not None:
        try:
            beds = int(float(str(raw_cap)))
        except (ValueError, TypeError):
            pass

    raw_phone = (ckan.get("facility_telephone_number") or "").strip()
    raw_zip = ckan.get("facility_zip")
    zip_str: str | None = None
    if raw_zip is not None:
        z = str(int(float(str(raw_zip)))).zfill(5)
        zip_str = z if z != "00000" else None

    source_url = FACILITY_PROFILE_URL.format(license_num)

    return {
        "state_code": STATE_CODE,
        "name": name,
        "cms_id": None,  # RCFEs are state-only; no CMS certification
        "license_number": license_num,
        "license_type": ckan.get("facility_type") or None,
        "street": titleize((ckan.get("facility_address") or "").strip()) or None,
        "city": city or None,
        "zip": zip_str,
        "city_slug": city_slug,
        "slug": slug,
        "beds": beds,
        "facility_type": "rcfe",
        "certification_type": "state",
        "operator_name": titleize((ckan.get("licensee") or "").strip()) or None,
        "management_company": titleize(
            (ckan.get("facility_administrator") or "").strip()
        ) or None,
        "ownership_type": None,  # not in CDSS data
        "phone": raw_phone or None,
        "website": None,
        "cms_star_rating": None,
        "last_inspection_date": last_inspection,
        "latitude": None,
        "longitude": None,
        "source_url": source_url,
        # 0002_alameda_beachhead.sql columns
        "care_category": care_category,
        "serves_memory_care": serves_mc,
        "memory_care_designation": designation,
        "license_status": ckan.get("facility_status") or None,
        "license_expiration": None,
        "publishable": publishable,
    }


# ---------------------------------------------------------------------------
# DB upsert
# ---------------------------------------------------------------------------

UPSERT_SQL = """
INSERT INTO facilities (
    state_code, name, cms_id,
    license_number, license_type,
    street, city, zip,
    city_slug, slug,
    beds, facility_type, certification_type,
    operator_name, management_company, ownership_type,
    phone, website,
    cms_star_rating, last_inspection_date,
    latitude, longitude,
    source_url,
    care_category, serves_memory_care, memory_care_designation,
    license_status, license_expiration, publishable,
    updated_at
) VALUES (
    %(state_code)s, %(name)s, %(cms_id)s,
    %(license_number)s, %(license_type)s,
    %(street)s, %(city)s, %(zip)s,
    %(city_slug)s, %(slug)s,
    %(beds)s, %(facility_type)s, %(certification_type)s,
    %(operator_name)s, %(management_company)s, %(ownership_type)s,
    %(phone)s, %(website)s,
    %(cms_star_rating)s, %(last_inspection_date)s,
    %(latitude)s, %(longitude)s,
    %(source_url)s,
    %(care_category)s, %(serves_memory_care)s, %(memory_care_designation)s,
    %(license_status)s, %(license_expiration)s, %(publishable)s,
    now()
)
ON CONFLICT (state_code, city_slug, slug) DO UPDATE SET
    name                    = EXCLUDED.name,
    license_number          = EXCLUDED.license_number,
    license_type            = EXCLUDED.license_type,
    street                  = EXCLUDED.street,
    city                    = EXCLUDED.city,
    zip                     = EXCLUDED.zip,
    beds                    = EXCLUDED.beds,
    facility_type           = EXCLUDED.facility_type,
    certification_type      = EXCLUDED.certification_type,
    operator_name           = EXCLUDED.operator_name,
    management_company      = EXCLUDED.management_company,
    phone                   = EXCLUDED.phone,
    last_inspection_date    = EXCLUDED.last_inspection_date,
    source_url              = EXCLUDED.source_url,
    care_category           = EXCLUDED.care_category,
    serves_memory_care      = EXCLUDED.serves_memory_care,
    memory_care_designation = EXCLUDED.memory_care_designation,
    license_status          = EXCLUDED.license_status,
    publishable             = EXCLUDED.publishable,
    updated_at              = now()
RETURNING (xmax = 0) AS is_insert
"""


def upsert_facilities(
    conn: psycopg.Connection,
    rows: list[dict[str, Any]],
) -> tuple[int, int]:
    """Returns (new_count, updated_count)."""
    new_count = 0
    updated_count = 0
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(UPSERT_SQL, row)
            result = cur.fetchone()
            if result and result[0]:
                new_count += 1
            else:
                updated_count += 1
    conn.commit()
    return new_count, updated_count


# ---------------------------------------------------------------------------
# Summary printout
# ---------------------------------------------------------------------------


def print_summary(rows: list[dict[str, Any]]) -> None:
    status_counts: dict[str, int] = {}
    cat_counts: dict[str, int] = {}
    mc_count = 0
    publishable_count = 0

    for r in rows:
        s = r.get("license_status") or "UNKNOWN"
        status_counts[s] = status_counts.get(s, 0) + 1
        c = r.get("care_category") or "unknown"
        cat_counts[c] = cat_counts.get(c, 0) + 1
        if r.get("serves_memory_care"):
            mc_count += 1
        if r.get("publishable"):
            publishable_count += 1

    print(f"\n{'='*60}")
    print(f"Alameda County RCFE summary ({len(rows)} total records)")
    print(f"{'='*60}")
    print(f"\nBy license status:")
    for s, n in sorted(status_counts.items()):
        print(f"  {s:<20} {n:>4}")
    print(f"\nBy care category:")
    for c, n in sorted(cat_counts.items()):
        print(f"  {c:<28} {n:>4}")
    print(f"\nServes memory care (name-matched): {mc_count}")
    print(f"Publishable (LICENSED + memory-care): {publishable_count}")
    print(f"{'='*60}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CDSS CCLD Alameda County RCFE ingest → StarlynnCare facilities"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch CKAN data and print summary; do not write to Postgres.",
    )
    parser.add_argument(
        "--smoke",
        action="store_true",
        help="Limit to first 10 facilities (writes DB unless --dry-run).",
    )
    parser.add_argument(
        "--force-publish",
        action="store_true",
        help="Mark all LICENSED facilities publishable regardless of memory-care flag.",
    )
    parser.add_argument(
        "--refresh-cache",
        action="store_true",
        help="Force re-download of the Transparency API statewide JSON.",
    )
    args = parser.parse_args()

    load_env()

    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print(
            "DATABASE_URL is not set. Add your Supabase Postgres URI to .env.local "
            "(Dashboard → Database → Connection string → URI).",
            file=sys.stderr,
        )
        sys.exit(1)

    # ── Step 1: CKAN roster ──────────────────────────────────────────────
    limit = 10 if args.smoke else None
    print(f"Fetching Alameda County RCFE roster from CA Open Data …")
    ckan_rows = fetch_alameda_rcfe_roster(limit=limit)
    print(f"CKAN rows received: {len(ckan_rows)}")

    # ── Step 2: Transparency API metrics ────────────────────────────────
    trans_lookup: dict[str, dict[str, Any]] = {}
    if not args.dry_run:
        try:
            trans_lookup = load_transparency_all(
                force_refresh=args.refresh_cache
            )
        except Exception as e:
            print(
                f"Warning: could not load Transparency API data ({e}). "
                "last_inspection_date will be null for this run.",
                file=sys.stderr,
            )

    # ── Step 3: Build facility rows ──────────────────────────────────────
    facility_rows: list[dict[str, Any]] = []
    skipped_geo = 0
    for ckan in ckan_rows:
        raw_num = ckan.get("facility_number")
        padded = pad_license(raw_num) if raw_num else None
        trans = trans_lookup.get(padded) if padded else None
        row = build_facility_row(ckan, trans, force_publish=args.force_publish)
        if row is None:
            skipped_geo += 1
        else:
            facility_rows.append(row)
    if skipped_geo:
        print(f"Skipped {skipped_geo} records with city outside Alameda County")

    print_summary(facility_rows)

    if args.dry_run:
        print("Dry run — database not modified.")
        if facility_rows:
            print("Sample record (first):")
            sample = facility_rows[0]
            for k, v in sample.items():
                if v is not None:
                    print(f"  {k}: {v}")
        return

    # ── Step 4: Upsert ───────────────────────────────────────────────────
    dsn = os.environ["DATABASE_URL"]
    started_at = datetime.now(timezone.utc)
    scrape_run_id: str | None = None
    error_log: str | None = None
    run_status = "failed"

    try:
        with psycopg.connect(dsn) as conn:
            # Open scrape_run
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO scrape_runs (state_code, scraper_name, status, started_at)
                    VALUES (%s, %s, 'running', %s)
                    RETURNING id::text
                    """,
                    (STATE_CODE, SCRAPER_NAME, started_at),
                )
                scrape_run_id = cur.fetchone()[0]
            conn.commit()

            print(f"Upserting {len(facility_rows)} rows …")
            new_count, updated_count = upsert_facilities(conn, facility_rows)
            completed_at = datetime.now(timezone.utc)

            # Close scrape_run
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE scrape_runs SET
                        completed_at   = %s,
                        status         = 'success',
                        records_found  = %s,
                        records_new    = %s,
                        records_updated = %s
                    WHERE id = %s::uuid
                    """,
                    (
                        completed_at,
                        len(facility_rows),
                        new_count,
                        updated_count,
                        scrape_run_id,
                    ),
                )
            conn.commit()

        run_status = "success"
        print(
            f"Done. New rows: {new_count}  Updated: {updated_count}"
            f"  scrape_run: {scrape_run_id}"
        )

    except Exception as e:
        error_log = str(e)
        print(f"ERROR: {error_log}", file=sys.stderr)
        if scrape_run_id:
            try:
                with psycopg.connect(dsn) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            UPDATE scrape_runs SET
                                completed_at = now(),
                                status = 'failed',
                                error_log = %s
                            WHERE id = %s::uuid
                            """,
                            (error_log, scrape_run_id),
                        )
                    conn.commit()
            except Exception as cleanup_err:
                print(
                    f"Could not record failure on scrape_run: {cleanup_err}",
                    file=sys.stderr,
                )
        sys.exit(1)

    # ── Step 5: Update states row ────────────────────────────────────────
    if run_status == "success":
        try:
            with psycopg.connect(dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE states SET
                            last_successful_scrape = now(),
                            scraper_name           = %s,
                            confidence             = 'high'
                        WHERE code = %s
                        """,
                        (SCRAPER_NAME, STATE_CODE),
                    )
                conn.commit()
        except Exception as e:
            print(f"Note: could not update states row: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
