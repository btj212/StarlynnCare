#!/usr/bin/env python3
"""
Download CMS Nursing Home Provider Information (dataset 4pq5-n9py),
filter Florida, upsert into `facilities` on `cms_id`, write `scrape_runs`.

Primary source: https://data.cms.gov/provider-data/dataset/4pq5-n9py

Requires DATABASE_URL (Supabase Postgres connection URI) in environment.
Loads .env.local or .env from repo root (parent of scrapers/).
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
CMS_DATASET_PAGE = "https://data.cms.gov/provider-data/dataset/4pq5-n9py"
CMS_QUERY_URL = (
    "https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0"
)
SCRAPER_NAME = "cms_provider_information"
STATE_CODE = "FL"


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "facility"


def map_ownership(raw: str | None) -> str | None:
    if not raw:
        return None
    lower = raw.lower()
    if "government" in lower:
        return "government"
    if "non profit" in lower or "nonprofit" in lower:
        return "non-profit"
    if "for profit" in lower or "for-profit" in lower:
        return "for-profit"
    return None


def map_certification(provider_type: str | None) -> str | None:
    if not provider_type:
        return None
    lower = provider_type.lower()
    if "medicare" in lower and "medicaid" in lower:
        return "both"
    if "medicare" in lower:
        return "medicare"
    if "medicaid" in lower:
        return "medicaid"
    return "private"


def parse_int(val: str | None) -> int | None:
    if val is None or str(val).strip() == "":
        return None
    try:
        return int(float(str(val).strip()))
    except ValueError:
        return None


def parse_date_iso(val: str | None) -> date | None:
    if not val or str(val).strip() == "":
        return None
    try:
        return date.fromisoformat(str(val).strip()[:10])
    except ValueError:
        return None


def fetch_florida_providers() -> list[dict[str, Any]]:
    # API enforces maximum limit (currently 1500); FL batch fits in one page.
    payload_in = {
        "conditions": [
            {"property": "state", "value": STATE_CODE, "operator": "="}
        ],
        "limit": 1500,
        "offset": 0,
    }
    resp = requests.post(
        CMS_QUERY_URL,
        json=payload_in,
        headers={"Accept": "application/json"},
        timeout=120,
    )
    resp.raise_for_status()
    payload = resp.json()
    rows = payload.get("results") or []
    expected = payload.get("count")
    if expected is not None and len(rows) != int(expected):
        print(
            f"Warning: received {len(rows)} rows but API count was {expected}",
            file=sys.stderr,
        )
    return rows


def facility_slug(name: str, ccn: str) -> str:
    """Stable URL slug: derived name + CMS CCN guarantees uniqueness."""
    base = slugify(name)
    return f"{base}-{ccn.strip().lower()}"


def upsert_facilities(
    conn: psycopg.Connection, rows: list[dict[str, Any]]
) -> tuple[int, int]:
    """Returns (upsert_row_count, skipped_invalid_ccn)."""
    upsert_sql = """
        INSERT INTO facilities (
            state_code, name, cms_id,
            street, city, zip,
            city_slug, slug,
            beds, facility_type,
            certification_type,
            operator_name, management_company, ownership_type,
            phone,
            cms_star_rating, last_inspection_date,
            latitude, longitude,
            source_url, updated_at
        ) VALUES (
            %(state_code)s, %(name)s, %(cms_id)s,
            %(street)s, %(city)s, %(zip)s,
            %(city_slug)s, %(slug)s,
            %(beds)s, %(facility_type)s,
            %(certification_type)s,
            %(operator_name)s, %(management_company)s, %(ownership_type)s,
            %(phone)s,
            %(cms_star_rating)s, %(last_inspection_date)s,
            %(latitude)s, %(longitude)s,
            %(source_url)s, now()
        )
        ON CONFLICT (cms_id) DO UPDATE SET
            name = EXCLUDED.name,
            street = EXCLUDED.street,
            city = EXCLUDED.city,
            zip = EXCLUDED.zip,
            city_slug = EXCLUDED.city_slug,
            slug = EXCLUDED.slug,
            beds = EXCLUDED.beds,
            facility_type = EXCLUDED.facility_type,
            certification_type = EXCLUDED.certification_type,
            operator_name = EXCLUDED.operator_name,
            management_company = EXCLUDED.management_company,
            ownership_type = EXCLUDED.ownership_type,
            phone = EXCLUDED.phone,
            cms_star_rating = EXCLUDED.cms_star_rating,
            last_inspection_date = EXCLUDED.last_inspection_date,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            source_url = EXCLUDED.source_url,
            updated_at = now()
    """
    processed = 0
    skipped = 0
    with conn.cursor() as cur:
        for r in rows:
            ccn = (r.get("cms_certification_number_ccn") or "").strip()
            if not ccn:
                skipped += 1
                continue
            city = (r.get("citytown") or "").strip()
            city_s = slugify(city) if city else "unknown-city"
            name = (r.get("provider_name") or "").strip() or f"Facility {ccn}"
            slug = facility_slug(name, ccn)

            lat = r.get("latitude") or ""
            lng = r.get("longitude") or ""
            params = {
                "state_code": STATE_CODE,
                "name": name,
                "cms_id": ccn,
                "street": (r.get("provider_address") or "").strip() or None,
                "city": city or None,
                "zip": (str(r.get("zip_code") or "").strip()[:10] or None),
                "city_slug": city_s,
                "slug": slug,
                "beds": parse_int(r.get("number_of_certified_beds")),
                "facility_type": (r.get("provider_type") or "").strip() or None,
                "certification_type": map_certification(
                    (r.get("provider_type") or "").strip()
                ),
                "operator_name": (r.get("legal_business_name") or "").strip()
                or None,
                "management_company": (r.get("chain_name") or "").strip() or None,
                "ownership_type": map_ownership(
                    (r.get("ownership_type") or "").strip()
                ),
                "phone": (r.get("telephone_number") or "").strip() or None,
                "cms_star_rating": parse_int(r.get("overall_rating")),
                "last_inspection_date": parse_date_iso(
                    r.get("rating_cycle_1_standard_survey_health_date")
                ),
                "latitude": lat if lat else None,
                "longitude": lng if lng else None,
                "source_url": CMS_DATASET_PAGE,
            }
            cur.execute(upsert_sql, params)
            processed += 1
    conn.commit()
    return processed, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="CMS Provider Information → facilities")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch CMS data only; do not connect to Postgres.",
    )
    args = parser.parse_args()
    load_env()

    if not args.dry_run:
        if not os.environ.get("DATABASE_URL"):
            print(
                "DATABASE_URL is not set. Add your Supabase Postgres URI to .env.local "
                "(Dashboard → Database → Connection string → URI).",
                file=sys.stderr,
            )
            sys.exit(1)

    print(f"Fetching CMS Provider Information ({CMS_DATASET_PAGE}) …")
    rows = fetch_florida_providers()
    print(f"Florida rows from API: {len(rows)}")
    if args.dry_run:
        print("Dry run — skipping database.")
        return

    dsn = os.environ["DATABASE_URL"]

    started_at = datetime.now(timezone.utc)
    scrape_run_id: str | None = None
    error_log: str | None = None
    status = "failed"

    try:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO scrape_runs (
                        state_code, scraper_name, status, started_at
                    ) VALUES (%s, %s, 'running', %s)
                    RETURNING id::text
                    """,
                    (STATE_CODE, SCRAPER_NAME, started_at),
                )
                scrape_run_id = cur.fetchone()[0]
            conn.commit()

            processed, skipped = upsert_facilities(conn, rows)
            completed_at = datetime.now(timezone.utc)

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE scrape_runs SET
                        completed_at = %s,
                        status = %s,
                        records_found = %s,
                        records_new = NULL,
                        records_updated = NULL,
                        error_log = NULL
                    WHERE id = %s::uuid
                    """,
                    (
                        completed_at,
                        "success",
                        processed,
                        scrape_run_id,
                    ),
                )
            conn.commit()

            status = "success"
            print(f"Upserted facility rows: {processed} (skipped empty CCN: {skipped})")
            print(f"scrape_run id: {scrape_run_id}")

    except Exception as e:
        error_log = str(e)
        print(error_log, file=sys.stderr)
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
                print(f"Could not record failure on scrape_run: {cleanup_err}", file=sys.stderr)
        sys.exit(1)

    # Optional: bump states.last_successful_scrape for FL
    if status == "success":
        try:
            with psycopg.connect(dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE states SET
                            last_successful_scrape = now(),
                            scraper_name = %s,
                            confidence = 'medium'
                        WHERE code = %s
                        """,
                        (SCRAPER_NAME, STATE_CODE),
                    )
                conn.commit()
        except Exception as e:
            print(f"Note: could not update states row: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
