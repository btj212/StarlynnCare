#!/usr/bin/env python3
"""
Pilot 1 — News monitor for Alameda County, CA.

For each publishable Alameda facility, searches for recent news (lawsuits,
citations, ownership changes) and classifies results with Claude Haiku.

Usage:
  python3 scrapers/pilot_news_monitor.py --smoke      # first 5 facilities
  python3 scrapers/pilot_news_monitor.py               # all Alameda facilities
  python3 scrapers/pilot_news_monitor.py --run-id my_run
"""

import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import anthropic
import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
sys.path.insert(0, str(Path(__file__).parent))
from _firecrawl import fc_scrape, fc_search, current_spend_usd

DB_URL = os.environ["DATABASE_URL"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
SKIP_DOMAINS = {"cdss.ca.gov", "ca.gov", "dhcs.ca.gov", "dss.ca.gov"}

ALAMEDA_CITIES = (
    "Alameda", "Albany", "Berkeley", "Castro Valley", "Dublin", "Emeryville",
    "Fremont", "Hayward", "Livermore", "Newark", "Oakland", "Piedmont",
    "Pleasanton", "San Leandro", "San Lorenzo", "Union City",
)

SEED_CSV = Path(__file__).parent.parent / ".firecrawl" / "pilot-seed-news.csv"


def get_facilities(conn: psycopg.Connection, limit: int | None = None) -> list[dict]:
    city_list = ", ".join(f"'{c}'" for c in ALAMEDA_CITIES)
    q = f"""
        SELECT id, name, city, street, slug
        FROM facilities
        WHERE state_code='CA'
          AND publishable=true
          AND city IN ({city_list})
        ORDER BY name
        {'LIMIT ' + str(limit) if limit else ''}
    """
    with conn.cursor() as cur:
        cur.execute(q)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def get_already_processed(conn: psycopg.Connection, run_id: str) -> set:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT facility_id FROM pilot_news_hits WHERE pilot_run_id=%s",
            (run_id,),
        )
        return {str(r[0]) for r in cur.fetchall()}


def build_seed_list(conn: psycopg.Connection) -> None:
    """Identify high-citation facilities as ground-truth seed."""
    city_list = ", ".join(f"'{c}'" for c in ALAMEDA_CITIES)
    q = f"""
        SELECT f.id, f.name, f.city, COUNT(d.id) as citation_count,
               MAX(d.severity) as max_severity
        FROM facilities f
        LEFT JOIN deficiencies d ON d.facility_id = f.id
        WHERE f.state_code='CA' AND f.publishable=true
          AND f.city IN ({city_list})
        GROUP BY f.id, f.name, f.city
        ORDER BY citation_count DESC, max_severity DESC NULLS LAST
        LIMIT 20
    """
    with conn.cursor() as cur:
        cur.execute(q)
        rows = cur.fetchall()
    SEED_CSV.parent.mkdir(exist_ok=True)
    with open(SEED_CSV, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "name", "city", "citation_count", "max_severity", "expected_news"])
        for row in rows:
            w.writerow(list(row) + [""])
    print(f"  Seed list written to {SEED_CSV} ({len(rows)} facilities)")


def classify_article(
    client: anthropic.Anthropic,
    facility_name: str,
    city: str,
    url: str,
    text: str,
) -> dict:
    prompt = (
        f"Does this article relate to a specific memory care or assisted living facility "
        f"named '{facility_name}' located in {city}, California?\n\n"
        f"Article URL: {url}\n\n"
        f"Article text (first 1500 chars): {text[:1500]}\n\n"
        "Return JSON: {\"category\": \"enforcement|lawsuit|ownership_change|news|wrong_facility|unrelated\", "
        "\"confidence\": 0.0-1.0, \"is_about_this_facility\": true/false, "
        "\"key_excerpt\": \"max 200 chars or null\", \"event_date\": \"YYYY-MM-DD or null\"}"
    )
    msg = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=300,
        system="You are a precise classifier. Return ONLY valid JSON.",
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON from the response
        import re
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                pass
    return {
        "category": "unrelated",
        "confidence": 0.0,
        "is_about_this_facility": False,
        "key_excerpt": None,
        "event_date": None,
    }


def is_skip_domain(url: str) -> bool:
    for domain in SKIP_DOMAINS:
        if domain in url:
            return True
    return False


def process_facility(
    conn: psycopg.Connection,
    client: anthropic.Anthropic,
    facility: dict,
    run_id: str,
) -> int:
    name = facility["name"]
    city = facility["city"]
    fid = str(facility["id"])

    query = (
        f'"{name}" "{city}" California '
        "(lawsuit OR fined OR cited OR settled OR closed OR sold OR acquired OR "
        "death OR investigation OR abuse OR neglect)"
    )
    print(f"  Searching: {name} ({city})")

    try:
        results = fc_search(query, num_results=5)
    except RuntimeError as e:
        print(f"    BUDGET: {e}")
        raise
    except Exception as e:
        print(f"    Search error: {e}")
        return 0

    hits_written = 0
    scraped = 0

    for r in results:
        url = r.get("url", "") or r.get("link", "")
        if not url or is_skip_domain(url):
            continue
        if scraped >= 2:
            break

        title = r.get("title", "")
        snippet = r.get("description", r.get("snippet", ""))

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

        classification = classify_article(client, name, city, url, markdown)

        if (
            classification.get("is_about_this_facility")
            and classification.get("confidence", 0) >= 0.7
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
                        classification.get("event_date"),
                        classification.get("category"),
                        classification.get("confidence"),
                        classification.get("key_excerpt"),
                    ),
                )
            conn.commit()
            hits_written += 1
            print(
                f"    HIT: cat={classification['category']} "
                f"conf={classification['confidence']:.2f}"
            )

    return hits_written


def main() -> None:
    parser = argparse.ArgumentParser(description="Pilot 1: Alameda news monitor")
    parser.add_argument("--smoke", action="store_true", help="First 5 facilities only")
    parser.add_argument("--run-id", default=None, help="Run identifier (default: timestamp)")
    parser.add_argument("--skip-if-exists", action="store_true", help="Skip already-processed")
    args = parser.parse_args()

    run_id = args.run_id or f"p1_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    limit = 5 if args.smoke else None

    print(f"=== Pilot 1: News Monitor ===")
    print(f"Run ID: {run_id}")
    print(f"Mode: {'smoke (5)' if args.smoke else 'full'}")
    print(f"Spend so far: ${current_spend_usd():.3f}")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    with psycopg.connect(DB_URL) as conn:
        facilities = get_facilities(conn, limit=limit)
        print(f"Facilities found: {len(facilities)}")

        already_done: set = set()
        if args.skip_if_exists:
            already_done = get_already_processed(conn, run_id)
            print(f"Already processed: {len(already_done)}")

        # Build seed list once
        print("Building seed list...")
        build_seed_list(conn)

        total_hits = 0
        total_processed = 0

        for i, facility in enumerate(facilities, 1):
            fid = str(facility["id"])
            if fid in already_done:
                print(f"  [{i}/{len(facilities)}] SKIP {facility['name']}")
                continue

            print(f"[{i}/{len(facilities)}] {facility['name']}")
            try:
                hits = process_facility(conn, client, facility, run_id)
                total_hits += hits
                total_processed += 1
            except RuntimeError as e:
                if "BUDGET" in str(e):
                    print(f"STOPPING: {e}")
                    break
                print(f"  ERROR: {e}")
                continue

        print(f"\n=== Pilot 1 Complete ===")
        print(f"Processed: {total_processed}/{len(facilities)}")
        print(f"Total hits: {total_hits}")
        print(f"Total spend: ${current_spend_usd():.3f}")


if __name__ == "__main__":
    main()
