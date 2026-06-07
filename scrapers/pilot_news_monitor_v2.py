#!/usr/bin/env python3
"""
Pilot 1 v2 — News monitor for Orange County, CA, refined from Alameda v1.

Key refinements vs v1:
  1. Aggregator domain blocklist (never scrape, never count as hit).
  2. Pull top 5 search results, scrape up to 3 NON-aggregator results.
  3. Tighter query: '"name" "city, California" (lawsuit OR fined OR ...)'.
  4. Skip facilities with non-distinctive names ("The Inn", "Sunrise", etc.).
  5. Stricter classifier: Haiku 4.5 prompted to require facility-name AND city
     in the article, plus a `source_type` field — drop aggregator_directory hits.

All rows tagged with pilot_run_id='oc_v2' (default).

Usage:
  python3 scrapers/pilot_news_monitor_v2.py --smoke      # first 5 facilities
  python3 scrapers/pilot_news_monitor_v2.py               # all OC facilities
  python3 scrapers/pilot_news_monitor_v2.py --run-id oc_v2_test
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import anthropic
import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
sys.path.insert(0, str(Path(__file__).parent))
from _firecrawl import current_spend_usd, fc_scrape, fc_search  # noqa: E402

DB_URL = os.environ["DATABASE_URL"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

# Domains we never scrape AND never count as a hit.
# Aggregator/directory/SEO + portals where we already have the data + generic listings.
AGGREGATOR_DOMAINS = {
    # Senior-living aggregators / SEO directories
    "thecareaudit.com", "miradorliving.com", "assistedlivingmagazine.com",
    "seniors.fyi", "everyplace.care", "agemark.com", "aplaceformom.com",
    "caring.com", "seniorliving.org", "seniorly.com", "senioradvisor.com",
    "alzdementia.com", "ourparents.com", "after55.com",
    "elderoptionsoftexas.com", "memorycare.com", "alzheimers.net",
    "snftraining.com",
    # Additional aggregators surfaced in OC v2 smoke (2026-05)
    "nearbyseniorliving.com", "seniorhomes.com", "careasone.com",
    "allages.com", "linkedin.com",
    # State portal domains (we already have this data)
    "cdss.ca.gov", "ca.gov", "ccld.dss.ca.gov", "dhcs.ca.gov", "dss.ca.gov",
    # Generic local listing pages
    "yelp.com", "google.com", "facebook.com",
    # Our own site
    "starlynncare.com",
}

# Facility names too generic to query without false positives.
# Lowercased exact-match list; also enforces a "alphanumeric chars after stop-words ≥ 4" rule.
COMMON_NAME_BLOCKLIST = {
    "the inn", "sunrise", "cottage", "garden", "house",
    "the cottage", "the cottages", "the gardens", "the manor",
    "the lodge", "the village", "the residences",
    "memory care", "assisted living", "senior living",
}
NAME_STOPWORDS = {
    "the", "a", "an", "of", "at", "on", "in", "and", "&",
    "inc", "llc", "corp", "company", "co",
    "memory", "care", "assisted", "living", "senior", "community",
    "home", "house", "village", "lodge", "manor", "gardens", "garden",
    "residences", "residence", "cottage", "cottages", "inn",
}

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


def domain_of(url: str) -> str:
    try:
        host = urlparse(url).hostname or ""
    except Exception:
        return ""
    return host.lower().lstrip("www.")


def is_aggregator(url: str) -> bool:
    host = domain_of(url)
    if not host:
        return True
    for blocked in AGGREGATOR_DOMAINS:
        if host == blocked or host.endswith("." + blocked):
            return True
    return False


def is_distinctive_name(name: str) -> tuple[bool, str]:
    """Return (is_distinctive, reason_if_not)."""
    cleaned = re.sub(r"[^A-Za-z0-9 ]+", " ", name).strip().lower()
    if cleaned in COMMON_NAME_BLOCKLIST:
        return False, f"common_name:{cleaned!r}"
    tokens = [t for t in cleaned.split() if t and t not in NAME_STOPWORDS]
    distinct_chars = sum(len(t) for t in tokens)
    if distinct_chars < 4:
        return False, f"low_signal_tokens:{tokens}"
    return True, ""


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
            "SELECT DISTINCT facility_id FROM pilot_news_hits WHERE pilot_run_id=%s",
            (run_id,),
        )
        return {str(r[0]) for r in cur.fetchall()}


def classify_article(
    client: anthropic.Anthropic,
    facility_name: str,
    city: str,
    url: str,
    text: str,
) -> dict:
    prompt = (
        "STRICT precision required. You are evaluating whether a web page is a real "
        "news / legal / regulatory event about ONE specific senior-living facility.\n\n"
        f"Facility: '{facility_name}' in {city}, California.\n\n"
        f"Article URL: {url}\n\n"
        f"Article text (first 2000 chars):\n{text[:2000]}\n\n"
        "Rules:\n"
        "- Mark `is_about_this_facility=false` UNLESS the article EXPLICITLY mentions "
        "BOTH the facility name AND the city. Inferring from a parent company is NOT enough.\n"
        "- A press release about a parent company without naming this facility = false.\n"
        "- A directory / aggregator listing page (just describing the facility) = false, "
        "and source_type='aggregator_directory'.\n"
        "- An operator's own marketing page about this facility = source_type='operator_site', "
        "but is_about_this_facility=false UNLESS it's a real news / press / legal event.\n\n"
        "Return ONLY valid JSON:\n"
        "{\n"
        '  "category": "enforcement|lawsuit|ownership_change|news|wrong_facility|unrelated",\n'
        '  "source_type": "news_outlet|court_record|press_release|regulatory_filing|aggregator_directory|operator_site|other",\n'
        '  "confidence": 0.0-1.0,\n'
        '  "is_about_this_facility": true|false,\n'
        '  "key_excerpt": "max 200 chars or null",\n'
        '  "event_date": "YYYY-MM-DD or null"\n'
        "}"
    )
    msg = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=400,
        system="You are a precise classifier. Return ONLY valid JSON.",
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                pass
    return {
        "category": "unrelated",
        "source_type": "other",
        "confidence": 0.0,
        "is_about_this_facility": False,
        "key_excerpt": None,
        "event_date": None,
    }


def process_facility(
    conn: psycopg.Connection,
    client: anthropic.Anthropic,
    facility: dict,
    run_id: str,
) -> tuple[int, int, int]:
    """
    Returns (hits_written, results_seen, scraped_count).
    """
    name = facility["name"]
    city = facility["city"]
    fid = str(facility["id"])

    query = (
        f'"{name}" "{city}, California" '
        "(lawsuit OR fined OR cited OR settled OR closed OR sold OR acquired OR "
        "death OR investigation OR abuse OR neglect OR violation)"
    )
    print(f"  Searching: {name} ({city})")

    try:
        results = fc_search(query, num_results=5)
    except RuntimeError:
        raise
    except Exception as e:
        print(f"    Search error: {e}")
        return 0, 0, 0

    # Filter aggregators FIRST so we count them as "noise removed", not as scraped pages.
    non_agg = [r for r in results if r.get("url") and not is_aggregator(r["url"])]
    aggregator_filtered = len(results) - len(non_agg)
    if aggregator_filtered:
        print(f"    Filtered {aggregator_filtered} aggregator result(s) pre-scrape")

    hits_written = 0
    scraped = 0

    for r in non_agg:
        if scraped >= 3:
            break
        url = r["url"]
        title = r.get("title", "")
        snippet = r.get("description", "")

        print(f"    Scraping: {url[:80]}")
        try:
            scraped_data = fc_scrape(url)
        except Exception as e:
            print(f"    Scrape error: {e}")
            continue
        scraped += 1

        markdown = scraped_data.get("markdown", "") or ""
        if not markdown:
            continue

        c = classify_article(client, name, city, url, markdown)
        source_type = c.get("source_type", "other")

        # Drop aggregator_directory regardless of confidence
        if source_type == "aggregator_directory":
            print(f"    DROP (aggregator_directory): {url[:60]}")
            continue

        if (
            c.get("is_about_this_facility")
            and c.get("confidence", 0) >= 0.7
            and c.get("category") not in ("wrong_facility", "unrelated")
        ):
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO pilot_news_hits
                      (pilot_run_id, facility_id, url, title, snippet,
                       published_at, category, confidence, raw_excerpt)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        run_id,
                        fid,
                        url,
                        title,
                        snippet[:500] if snippet else None,
                        c.get("event_date"),
                        # Encode source_type into category as suffix so v2 rows
                        # can be distinguished without a schema change:
                        # "<category>|<source_type>"
                        f"{c.get('category')}|{source_type}",
                        c.get("confidence"),
                        c.get("key_excerpt"),
                    ),
                )
            conn.commit()
            hits_written += 1
            print(
                f"    HIT: cat={c.get('category')} src={source_type} "
                f"conf={c.get('confidence', 0):.2f}"
            )

    return hits_written, len(results), scraped


def main() -> None:
    parser = argparse.ArgumentParser(description="Pilot 1 v2: OC news monitor")
    parser.add_argument("--smoke", action="store_true", help="First 5 facilities only")
    parser.add_argument("--run-id", default="oc_v2", help="pilot_run_id tag (default: oc_v2)")
    parser.add_argument("--skip-if-exists", action="store_true",
                        help="Skip facility_ids already in pilot_news_hits for this run_id")
    args = parser.parse_args()

    run_id = args.run_id
    limit = 5 if args.smoke else None

    print("=== Pilot 1 v2: OC News Monitor ===")
    print(f"Run ID: {run_id}")
    print(f"Mode: {'smoke (5)' if args.smoke else 'full'}")
    print(f"Spend so far: ${current_spend_usd():.3f}")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    with psycopg.connect(DB_URL) as conn:
        facilities = get_facilities(conn, limit=limit)
        print(f"OC facilities found: {len(facilities)}")

        already_done: set = set()
        if args.skip_if_exists:
            already_done = get_already_processed(conn, run_id)
            print(f"Already processed for run_id={run_id}: {len(already_done)}")

        skipped_common: list[tuple[str, str, str]] = []
        total_hits = 0
        total_processed = 0
        total_results_seen = 0
        total_scraped = 0

        for i, facility in enumerate(facilities, 1):
            fid = str(facility["id"])
            if fid in already_done:
                print(f"  [{i}/{len(facilities)}] SKIP (done) {facility['name']}")
                continue

            ok, reason = is_distinctive_name(facility["name"])
            if not ok:
                print(f"  [{i}/{len(facilities)}] SKIP (non-distinctive) "
                      f"{facility['name']} — {reason}")
                skipped_common.append((facility["name"], facility["city"], reason))
                continue

            print(f"[{i}/{len(facilities)}] {facility['name']}")
            try:
                hits, seen, scraped = process_facility(conn, client, facility, run_id)
                total_hits += hits
                total_processed += 1
                total_results_seen += seen
                total_scraped += scraped
            except RuntimeError as e:
                if "BUDGET" in str(e):
                    print(f"STOPPING: {e}")
                    break
                print(f"  ERROR: {e}")
                continue
            except Exception as e:  # noqa: BLE001
                print(f"  ERROR: {e}")
                continue

        print("\n=== Pilot 1 v2 Complete ===")
        print(f"Facilities considered: {len(facilities)}")
        print(f"Skipped non-distinctive: {len(skipped_common)}")
        for n, c, r in skipped_common[:20]:
            print(f"  - {n} ({c}) [{r}]")
        print(f"Processed: {total_processed}")
        print(f"Search results seen: {total_results_seen}")
        print(f"Pages scraped: {total_scraped}")
        print(f"Hits written: {total_hits}")
        print(f"Total spend: ${current_spend_usd():.3f}")


if __name__ == "__main__":
    main()
