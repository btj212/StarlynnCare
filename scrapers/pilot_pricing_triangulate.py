#!/usr/bin/env python3
"""
Pilot 4 — Pricing triangulation for Orange County, CA.

Goal: estimate a "starting price" per facility by triangulating across
multiple senior-living aggregator pages.

Per facility:
  1. For each PRICING_SOURCES domain, fc_search('"name" "city" {domain}').
  2. Take top result; filter out wrong-facility matches via URL/title heuristic.
  3. fc_extract with the pricing schema.
  4. Persist row to pilot_pricing_sources (one per source per facility).
  5. After all sources, compute triangulated row in pilot_pricing_triangulated.

Genworth state-median anchor (CA, 2024 memory care): $6,500/mo (constant).

Cost: ~5 sources × (1 search + 1 extract @ 5 cr) ≈ ~30 credits per facility ≈ $0.03/facility.

Usage:
  python3 scrapers/pilot_pricing_triangulate.py --smoke           # 5 facilities
  python3 scrapers/pilot_pricing_triangulate.py                    # all OC
  python3 scrapers/pilot_pricing_triangulate.py --run-id oc_p4_v2
"""

import argparse
import json
import os
import re
import statistics
import sys
from pathlib import Path
from urllib.parse import urlparse

import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
sys.path.insert(0, str(Path(__file__).parent))
from _firecrawl import current_spend_usd, fc_extract, fc_search  # noqa: E402

DB_URL = os.environ["DATABASE_URL"]

# Genworth 2024 CA memory-care monthly median (anchor for sanity check).
CA_STATE_MEDIAN_MEMORY_CARE_USD = 6500

PRICING_SOURCES = [
    ("aplaceformom", "aplaceformom.com"),
    ("caring", "caring.com"),
    ("seniorly", "seniorly.com"),
    ("senioradvisor", "senioradvisor.com"),
]

OC_CITIES = (
    "Anaheim", "Brea", "Buena Park", "Costa Mesa", "Cypress", "Dana Point",
    "Fountain Valley", "Fullerton", "Garden Grove", "Huntington Beach",
    "Irvine", "La Habra", "La Palma", "Laguna Beach", "Laguna Hills",
    "Laguna Niguel", "Laguna Woods", "Lake Forest", "Los Alamitos",
    "Mission Viejo", "Newport Beach", "Orange", "Placentia",
    "Rancho Santa Margarita", "San Clemente", "San Juan Capistrano",
    "Santa Ana", "Seal Beach", "Stanton", "Tustin", "Villa Park",
    "Westminster", "Yorba Linda",
)

PRICE_SCHEMA = {
    "type": "object",
    "properties": {
        "facility_name_match": {
            "type": "string",
            "description": "Facility name as shown on this page",
        },
        "city_match": {
            "type": "string",
            "description": "City as shown on this page",
        },
        "is_correct_facility": {
            "type": "boolean",
            "description": "True only if this page is clearly the same facility we searched for (same name AND same city).",
        },
        "starting_price_monthly_usd": {
            "type": ["integer", "null"],
            "description": "Lowest monthly price mentioned, in USD per month",
        },
        "memory_care_price_monthly_usd": {
            "type": ["integer", "null"],
            "description": "Memory-care-specific monthly price if separately listed",
        },
        "assisted_living_price_monthly_usd": {
            "type": ["integer", "null"],
            "description": "Assisted-living monthly price if separately listed",
        },
        "price_range_min_usd": {"type": ["integer", "null"]},
        "price_range_max_usd": {"type": ["integer", "null"]},
        "price_disclaimer": {
            "type": ["string", "null"],
            "description": "Any disclaimer like 'starting at', 'community fees apply', 'prices may vary'",
        },
        "data_source": {
            "type": "string",
            "description": "Which aggregator this came from (aplaceformom, caring, seniorly, senioradvisor, other)",
        },
    },
    "required": [
        "facility_name_match",
        "city_match",
        "is_correct_facility",
        "data_source",
    ],
}

PRICE_PROMPT = (
    "You are extracting senior-living pricing from this page. "
    "Only set is_correct_facility=true if the page is unambiguously the same "
    "facility we searched for (matching name AND matching city). "
    "Return monthly USD prices as integers, no symbols. If a price is given as "
    "'starting at $5,995/mo' return 5995. If only a range is given (e.g. "
    "'$4,500-$7,200'), set range_min/range_max AND set starting_price_monthly_usd "
    "to the minimum. If no price is on the page, return null for all price fields."
)


def domain_of(url: str) -> str:
    try:
        host = urlparse(url).hostname or ""
    except Exception:
        return ""
    return host.lower().lstrip("www.")


def url_matches_facility(url: str, title: str, name: str, city: str) -> bool:
    """Cheap pre-extract sanity check: does the URL or title plausibly contain
    the facility name and/or city? Avoids burning extract credits on a
    'Top 10 Memory Care in Orange County' listicle.
    """
    name_tokens = [
        t.lower()
        for t in re.split(r"[^A-Za-z0-9]+", name)
        if len(t) >= 3
    ]
    if not name_tokens:
        return False
    haystack = f"{url} {title}".lower()
    # At least 2 distinctive name tokens OR (1 token + city).
    matched = sum(1 for t in name_tokens if t in haystack)
    city_in = city.lower().replace(" ", "-") in haystack or city.lower() in haystack
    if matched >= 2:
        return True
    if matched >= 1 and city_in:
        return True
    return False


def get_facilities(conn: psycopg.Connection, limit: int | None = None) -> list[dict]:
    placeholders = ", ".join(["%s"] * len(OC_CITIES))
    q = f"""
        SELECT id, name, city, slug
        FROM facilities
        WHERE state_code='CA'
          AND publishable=true
          AND city IN ({placeholders})
        ORDER BY name
    """
    if limit:
        q += f" LIMIT {limit}"
    with conn.cursor() as cur:
        cur.execute(q, OC_CITIES)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def get_already_processed(conn: psycopg.Connection, run_id: str) -> set:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT facility_id FROM pilot_pricing_triangulated "
            "WHERE pilot_run_id=%s",
            (run_id,),
        )
        return {str(r[0]) for r in cur.fetchall()}


def insert_source_row(
    conn: psycopg.Connection,
    run_id: str,
    facility_id: str,
    source: str,
    url: str | None,
    extract: dict,
) -> None:
    def _i(key: str) -> int | None:
        v = extract.get(key)
        if isinstance(v, int):
            return v
        if isinstance(v, float):
            return int(v)
        return None

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO pilot_pricing_sources
              (pilot_run_id, facility_id, source, source_url,
               starting_price_monthly_usd,
               memory_care_price_monthly_usd,
               assisted_living_price_monthly_usd,
               price_range_min_usd, price_range_max_usd,
               price_disclaimer, is_correct_facility, raw_extract)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            """,
            (
                run_id,
                facility_id,
                source,
                url,
                _i("starting_price_monthly_usd"),
                _i("memory_care_price_monthly_usd"),
                _i("assisted_living_price_monthly_usd"),
                _i("price_range_min_usd"),
                _i("price_range_max_usd"),
                extract.get("price_disclaimer"),
                bool(extract.get("is_correct_facility", False)),
                json.dumps(extract),
            ),
        )
    conn.commit()


def triangulate(rows: list[dict]) -> dict | None:
    """Compute triangulated price stats from per-source rows for one facility."""
    valid_starting = [
        r["starting_price_monthly_usd"]
        for r in rows
        if r.get("is_correct_facility")
        and isinstance(r.get("starting_price_monthly_usd"), int)
        and r["starting_price_monthly_usd"] > 500
    ]
    valid_mc = [
        r["memory_care_price_monthly_usd"]
        for r in rows
        if r.get("is_correct_facility")
        and isinstance(r.get("memory_care_price_monthly_usd"), int)
        and r["memory_care_price_monthly_usd"] > 500
    ]

    if not valid_starting:
        return None

    median = int(statistics.median(valid_starting))
    pmin = min(valid_starting)
    pmax = max(valid_starting)
    spread = pmax - pmin
    divergence_pct = round((spread / median) * 100, 1) if median else 0.0
    n = len(valid_starting)

    # Confidence buckets per spec
    if n >= 3 and divergence_pct <= 20:
        confidence = "high"
    elif n >= 2 and divergence_pct <= 25:
        confidence = "medium"
    elif n >= 2 and divergence_pct <= 40:
        confidence = "medium"
    else:
        confidence = "low"

    median_mc = int(statistics.median(valid_mc)) if valid_mc else None
    vs_median = round(
        ((median - CA_STATE_MEDIAN_MEMORY_CARE_USD) / CA_STATE_MEDIAN_MEMORY_CARE_USD) * 100,
        1,
    )

    return {
        "source_count": n,
        "triangulated_starting_price_usd": median,
        "triangulated_memory_care_price_usd": median_mc,
        "price_min_usd": pmin,
        "price_max_usd": pmax,
        "divergence_pct": divergence_pct,
        "confidence": confidence,
        "vs_state_median_pct": vs_median,
    }


def upsert_triangulated(
    conn: psycopg.Connection,
    run_id: str,
    facility_id: str,
    summary: dict,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO pilot_pricing_triangulated
              (pilot_run_id, facility_id, source_count,
               triangulated_starting_price_usd,
               triangulated_memory_care_price_usd,
               price_min_usd, price_max_usd, divergence_pct,
               confidence, vs_state_median_pct)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (facility_id) DO UPDATE SET
              pilot_run_id = EXCLUDED.pilot_run_id,
              source_count = EXCLUDED.source_count,
              triangulated_starting_price_usd = EXCLUDED.triangulated_starting_price_usd,
              triangulated_memory_care_price_usd = EXCLUDED.triangulated_memory_care_price_usd,
              price_min_usd = EXCLUDED.price_min_usd,
              price_max_usd = EXCLUDED.price_max_usd,
              divergence_pct = EXCLUDED.divergence_pct,
              confidence = EXCLUDED.confidence,
              vs_state_median_pct = EXCLUDED.vs_state_median_pct,
              computed_at = now()
            """,
            (
                run_id,
                facility_id,
                summary["source_count"],
                summary["triangulated_starting_price_usd"],
                summary["triangulated_memory_care_price_usd"],
                summary["price_min_usd"],
                summary["price_max_usd"],
                summary["divergence_pct"],
                summary["confidence"],
                summary["vs_state_median_pct"],
            ),
        )
    conn.commit()


def process_facility(
    conn: psycopg.Connection,
    facility: dict,
    run_id: str,
) -> dict:
    name = facility["name"]
    city = facility["city"]
    fid = str(facility["id"])
    print(f"[{name} — {city}]")

    per_source_rows: list[dict] = []
    for source_label, source_domain in PRICING_SOURCES:
        query = f'"{name}" "{city}" {source_domain}'
        try:
            results = fc_search(query, num_results=3)
        except RuntimeError:
            raise
        except Exception as e:
            print(f"  [{source_label}] search error: {e}")
            continue

        # Pick the first result on this domain.
        hit_url = None
        hit_title = ""
        for r in results:
            url = r.get("url", "")
            if not url:
                continue
            if domain_of(url).endswith(source_domain):
                hit_url = url
                hit_title = r.get("title", "")
                break

        if not hit_url:
            print(f"  [{source_label}] no on-domain result")
            continue

        if not url_matches_facility(hit_url, hit_title, name, city):
            print(f"  [{source_label}] URL/title sanity check failed: {hit_url[:80]}")
            continue

        try:
            res = fc_extract(hit_url, schema=PRICE_SCHEMA, prompt=PRICE_PROMPT)
        except RuntimeError:
            raise
        except Exception as e:
            print(f"  [{source_label}] extract error: {e}")
            continue

        extract = res.get("extract", {}) or {}
        # Force data_source so we can audit.
        extract["data_source"] = source_label

        insert_source_row(conn, run_id, fid, source_label, hit_url, extract)
        per_source_rows.append(extract)

        ic = extract.get("is_correct_facility")
        sp = extract.get("starting_price_monthly_usd")
        print(f"  [{source_label}] correct={ic} start=${sp} url={hit_url[:60]}")

    summary = triangulate(per_source_rows)
    if summary:
        upsert_triangulated(conn, run_id, fid, summary)
        print(
            f"  TRIANGULATED: n={summary['source_count']} "
            f"median=${summary['triangulated_starting_price_usd']} "
            f"spread={summary['divergence_pct']}% "
            f"confidence={summary['confidence']} "
            f"vs_state={summary['vs_state_median_pct']}%"
        )
    else:
        print("  No valid price data — skipping triangulation row")

    return {
        "sources_attempted": len(PRICING_SOURCES),
        "sources_with_extract": len(per_source_rows),
        "valid_count": summary["source_count"] if summary else 0,
        "triangulated": bool(summary),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Pilot 4: pricing triangulation")
    parser.add_argument("--smoke", action="store_true", help="First 5 facilities only")
    parser.add_argument("--run-id", default="oc_p4", help="pilot_run_id tag (default: oc_p4)")
    parser.add_argument(
        "--skip-if-exists",
        action="store_true",
        help="Skip facility_ids already in pilot_pricing_triangulated for this run_id",
    )
    args = parser.parse_args()

    run_id = args.run_id
    limit = 5 if args.smoke else None

    print("=== Pilot 4: Pricing Triangulation (OC) ===")
    print(f"Run ID: {run_id}")
    print(f"Mode: {'smoke (5)' if args.smoke else 'full'}")
    print(f"Sources: {[s for s, _ in PRICING_SOURCES]}")
    print(f"Spend so far: ${current_spend_usd():.3f}")

    with psycopg.connect(DB_URL) as conn:
        facilities = get_facilities(conn, limit=limit)
        print(f"OC facilities found: {len(facilities)}")

        already_done: set = set()
        if args.skip_if_exists:
            already_done = get_already_processed(conn, run_id)
            print(f"Already triangulated for run_id={run_id}: {len(already_done)}")

        agg = {
            "facilities": 0,
            "with_any_price": 0,
            "triangulated_2plus": 0,
            "triangulated_3plus": 0,
        }

        for i, facility in enumerate(facilities, 1):
            fid = str(facility["id"])
            if fid in already_done:
                print(f"[{i}/{len(facilities)}] SKIP (done) {facility['name']}")
                continue

            print(f"[{i}/{len(facilities)}] -> ", end="")
            try:
                stats = process_facility(conn, facility, run_id)
                agg["facilities"] += 1
                if stats["valid_count"] >= 1:
                    agg["with_any_price"] += 1
                if stats["valid_count"] >= 2:
                    agg["triangulated_2plus"] += 1
                if stats["valid_count"] >= 3:
                    agg["triangulated_3plus"] += 1
            except RuntimeError as e:
                if "BUDGET" in str(e):
                    print(f"STOPPING: {e}")
                    break
                print(f"ERROR: {e}")
                continue
            except Exception as e:  # noqa: BLE001
                print(f"ERROR: {e}")
                continue

        print("\n=== Pilot 4 Complete ===")
        print(f"Facilities processed: {agg['facilities']}")
        print(f"With ≥1 valid price: {agg['with_any_price']}")
        print(f"Triangulated (≥2 sources): {agg['triangulated_2plus']}")
        print(f"Triangulated (≥3 sources): {agg['triangulated_3plus']}")
        print(f"Total spend: ${current_spend_usd():.3f}")


if __name__ == "__main__":
    main()
