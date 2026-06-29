#!/usr/bin/env python3
"""
recompute_physical_city.py — Rewrite facility city + city_slug using physical
place names derived from latitude/longitude via the US Census Geocoder.

Problem: state directory feeds publish USPS mailing cities, not physical
cities. This causes suburb facilities to be mis-categorised (e.g. Taylorsville,
UT facilities all showing as "Salt Lake City").

Solution: call the free Census Geocoder coordinates endpoint for every
facility with lat/lon, resolve the Incorporated Place (preferred) or Census
Designated Place that contains the point, and update the DB.  Prior city_slug
values are preserved in historical_city_slugs[] so the app can 301-redirect.

Usage:
    python -u scrapers/recompute_physical_city.py --state UT             # dry-run
    python -u scrapers/recompute_physical_city.py --state UT --apply     # write
    python -u scrapers/recompute_physical_city.py --all                  # all states, dry-run
    python -u scrapers/recompute_physical_city.py --all --apply          # all states, write

Run order:
    After: scrapers/geocode_facilities.py  (needs lat/lon populated)
    Before: scrapers/recompute_publishable.py

Cache:
    Geocoder results are cached in data/.cache/census_geo.json keyed by
    rounded (5-decimal) lat/lon pair so re-runs are fast and idempotent.

Requires:
    DATABASE_URL in .env.local
    No external API key needed — Census Geocoder is public.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# ── Census Geocoder ───────────────────────────────────────────────────────────

CENSUS_URL = (
    "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"
    "?x={lon}&y={lat}"
    "&benchmark=Public_AR_Current"
    "&vintage=Current_Current"
    "&layers=Incorporated_Places,Census_Designated_Places"
    "&format=json"
)

# Suffixes to strip from Census Place names before slugifying.
_PLACE_SUFFIX_RE = re.compile(
    r"\s+(city|town|village|borough|municipality|CDP|census designated place)$",
    re.IGNORECASE,
)

RATE_LIMIT_RPS = 8   # conservative; Census has no published hard limit
CACHE_PATH = Path(__file__).parent.parent / "data" / ".cache" / "census_geo.json"


def _load_cache() -> dict[str, str | None]:
    """Load lat/lon → place-name cache from disk."""
    if CACHE_PATH.exists():
        try:
            with CACHE_PATH.open() as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_cache(cache: dict[str, str | None]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CACHE_PATH.open("w") as f:
        json.dump(cache, f, indent=2)


def _cache_key(lat: float, lon: float) -> str:
    return f"{round(lat, 5)},{round(lon, 5)}"


def _fetch_census_place(lat: float, lon: float) -> str | None:
    """Return the Census physical place name for coordinates, or None."""
    url = CENSUS_URL.format(lat=round(lat, 6), lon=round(lon, 6))
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        print(f"  Census request failed ({lat},{lon}): {exc}", flush=True)
        return None

    geographies = data.get("result", {}).get("geographies", {})

    # Prefer Incorporated Places over CDPs
    for layer_key in ("Incorporated Places", "Census Designated Places"):
        places = geographies.get(layer_key, [])
        if places:
            raw_name: str = places[0].get("NAME", "")
            # Strip state suffix like "Taylorsville, Utah"
            if "," in raw_name:
                raw_name = raw_name.split(",")[0].strip()
            # Strip type suffixes
            name = _PLACE_SUFFIX_RE.sub("", raw_name).strip()
            return name if name else None

    return None


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


# ── DB helpers ────────────────────────────────────────────────────────────────

def fetch_facilities(
    conn: psycopg.Connection,
    state_codes: list[str],
) -> list[dict]:
    """Return all facilities with lat/lon for the given states."""
    placeholders = ", ".join(["%s"] * len(state_codes))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id::text, state_code, name, city, city_slug, latitude, longitude
              FROM facilities
             WHERE state_code IN ({placeholders})
               AND latitude IS NOT NULL
               AND longitude IS NOT NULL
            """,
            state_codes,
        )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def apply_city_update(
    conn: psycopg.Connection,
    facility_id: str,
    new_city: str,
    new_slug: str,
    old_slug: str,
    dry_run: bool,
) -> None:
    if dry_run:
        return
    with conn.cursor() as cur:
        cur.execute("SAVEPOINT sp")
        try:
            cur.execute(
                """
                UPDATE facilities
                   SET city = %(new_city)s,
                       city_slug = %(new_slug)s,
                       historical_city_slugs = (
                         CASE WHEN %(old_slug)s = ANY(historical_city_slugs)
                              THEN historical_city_slugs
                              ELSE array_append(historical_city_slugs, %(old_slug)s)
                         END
                       ),
                       updated_at = now()
                 WHERE id = %(facility_id)s::uuid
                """,
                {
                    "new_city": new_city,
                    "new_slug": new_slug,
                    "old_slug": old_slug,
                    "facility_id": facility_id,
                },
            )
            cur.execute("RELEASE SAVEPOINT sp")
        except Exception as exc:
            cur.execute("ROLLBACK TO SAVEPOINT sp")
            print(f"  DB update error for {facility_id}: {exc}", flush=True)


# ── Main ──────────────────────────────────────────────────────────────────────

def run(state_codes: list[str], apply: bool) -> None:
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env.local", flush=True)
        sys.exit(1)

    cache = _load_cache()
    print(f"Cache loaded: {len(cache)} entries", flush=True)

    mode = "APPLY" if apply else "DRY-RUN"
    print(f"Mode: {mode} | States: {', '.join(state_codes)}", flush=True)

    with psycopg.connect(DATABASE_URL) as conn:
        facilities = fetch_facilities(conn, state_codes)
        print(f"Facilities to evaluate: {len(facilities)}", flush=True)

        if not facilities:
            print("ERROR: no publishable facilities with lat/lon found — check state codes or geocode first", flush=True)
            sys.exit(1)

        changed = 0
        unchanged = 0
        skipped_no_place = 0
        errors = 0
        last_req_time = 0.0

        for i, fac in enumerate(facilities):
            lat = float(fac["latitude"])
            lon = float(fac["longitude"])
            key = _cache_key(lat, lon)

            if key in cache:
                place_name = cache[key]
            else:
                # Rate-limit
                elapsed = time.monotonic() - last_req_time
                gap = 1.0 / RATE_LIMIT_RPS
                if elapsed < gap:
                    time.sleep(gap - elapsed)
                place_name = _fetch_census_place(lat, lon)
                last_req_time = time.monotonic()
                cache[key] = place_name

                # Persist cache every 100 new lookups
                if (i + 1) % 100 == 0:
                    _save_cache(cache)

            if place_name is None:
                skipped_no_place += 1
                continue

            new_slug = slugify(place_name)
            old_slug = fac["city_slug"]

            if new_slug == old_slug:
                unchanged += 1
                continue

            changed += 1
            print(
                f"  {fac['state_code']} | {fac['name'][:40]:<40} | "
                f"{fac['city'] or old_slug!r} → {place_name!r} (slug: {old_slug} → {new_slug})",
                flush=True,
            )
            apply_city_update(conn, fac["id"], place_name, new_slug, old_slug, dry_run=not apply)

        if apply:
            conn.commit()

    # Final cache flush
    _save_cache(cache)

    print(
        f"\nDone. changed={changed} unchanged={unchanged} "
        f"skipped_no_place={skipped_no_place} errors={errors}",
        flush=True,
    )
    if apply and changed == 0 and unchanged == 0:
        print(
            "WARNING: 0 facilities processed — either all rows lack lat/lon "
            "or state codes are wrong. Run geocode_facilities.py first.",
            flush=True,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--state", metavar="XX", help="Two-letter state code(s), comma-separated (e.g. UT or CA,OR)")
    group.add_argument("--all", action="store_true", help="Run for all covered states")
    parser.add_argument("--apply", action="store_true", help="Write changes to DB (default: dry-run)")
    args = parser.parse_args()

    all_states = ["CA", "TX", "OR", "WA", "MN", "UT", "IL", "PA", "AZ", "MO"]

    if args.all:
        state_codes = all_states
    else:
        state_codes = [s.strip().upper() for s in args.state.split(",")]
        invalid = [s for s in state_codes if s not in all_states]
        if invalid:
            print(f"ERROR: unknown state code(s): {', '.join(invalid)}", flush=True)
            sys.exit(1)

    run(state_codes, apply=args.apply)


if __name__ == "__main__":
    main()
