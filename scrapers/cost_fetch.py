#!/usr/bin/env python3
"""
Read the price shown on a home's Caring.com page, with plain HTTP. No paid API, no model.

Why not A Place for Mom: it shows "$X,XXX" until a visitor fills in a lead form. The real
number sits hidden in the page. Reading it would go around that gate, so it is not read.
A Place for Mom's compare table also puts neighbouring homes' prices on a home's own page,
which is how the earlier Firecrawl extract took a neighbour's $6,500 for Touch of Love.

Per home:
  1. Find the home's Caring page in Caring's own community sitemaps: same state,
     same ZIP code (the URL ends in it), best name match.
  2. Fetch it (robots.txt checked, one request every 2.5 s).
  3. Confirm the page's LocalBusiness block has the same ZIP code and house number.
  4. Read "Starting Price" and the home's own room and care-type prices. Nothing else.
  5. Add a row to pilot_pricing_sources (source = 'caring'). Rows are never overwritten.

Usage:
  python3 scrapers/cost_fetch.py --probe --run-id cost_fetch_probe_1   # 10 Mesa + 10 Orange County
  python3 scrapers/cost_fetch.py --state AZ --run-id cost_fetch_az     # every published home in a state
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
sys.path.insert(0, str(Path(__file__).parent))
from _robots import polite_get  # noqa: E402

DB_URL = os.environ["DATABASE_URL"]
CACHE = Path(__file__).parent.parent / ".cache" / "caring_community_urls.txt"
SITEMAP_INDEX = "https://www.caring.com/ccds/sitemap_index.xml"

STATE_SLUG = {
    "AZ": "arizona", "CA": "california", "CO": "colorado", "IL": "illinois",
    "MN": "minnesota", "MO": "missouri", "OR": "oregon", "PA": "pennsylvania",
    "TX": "texas", "UT": "utah", "WA": "washington",
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
# Words that name a kind of place or a company form, not the home itself.
FILLER = {
    "the", "at", "of", "and", "llc", "inc", "lp", "ltd", "corp", "co", "senior", "living",
    "assisted", "memory", "care", "home", "homes", "residence", "residences", "community",
    "center", "facility", "retirement", "village", "house",
}
MIN_NAME_OVERLAP = 0.5
CARE_TYPES = ("Assisted Living", "Memory Care", "Independent Living", "Board and Care Home")


def slug_tokens(text: str) -> set[str]:
    words = re.split(r"[^a-z0-9]+", text.lower().replace("'", ""))
    return {w for w in words if w and w not in FILLER}


def load_caring_urls() -> list[str]:
    """Every Caring community URL, from their sitemaps. Cached after the first run."""
    if CACHE.exists():
        return CACHE.read_text().split()
    status, index = polite_get(SITEMAP_INDEX, min_gap_s=1.0)
    if status != 200:
        raise RuntimeError(f"Caring sitemap index returned {status}")
    urls: list[str] = []
    for sitemap in re.findall(r"<loc>([^<]+)</loc>", index):
        status, body = polite_get(sitemap, min_gap_s=1.0)
        if status != 200:
            raise RuntimeError(f"{sitemap} returned {status}")
        urls.extend(u for u in re.findall(r"<loc>([^<]+)</loc>", body) if "/senior-living/" in u)
    CACHE.parent.mkdir(exist_ok=True)
    CACHE.write_text("\n".join(urls))
    return urls


def find_page(urls_by_state: dict[str, list[str]], facility: dict) -> str | None:
    """Same state, URL ends in the home's ZIP, best name overlap of at least MIN_NAME_OVERLAP."""
    zip5 = (facility.get("zip") or "")[:5]
    if not zip5:
        return None
    ours = slug_tokens(facility["name"])
    best, best_score = None, 0.0
    for url in urls_by_state.get(STATE_SLUG[facility["state_code"]], []):
        if not url.endswith(f"-{zip5}"):
            continue
        theirs = slug_tokens(url.rsplit("/", 1)[-1].removesuffix(f"-{zip5}"))
        if not ours or not theirs:
            continue
        score = len(ours & theirs) / len(ours | theirs)
        if score > best_score:
            best, best_score = url, score
    return best if best_score >= MIN_NAME_OVERLAP else None


def money(text: str) -> int:
    return int(text.replace("$", "").replace(",", ""))


def page_text(html: str) -> str:
    html = re.sub(r"<(script|style|svg)[\s\S]*?</\1>", "", html)
    text = re.sub(r"<[^>]+>", "|", html)
    return re.sub(r"[\s|]{2,}", " | ", text)


def house_number(street: str | None) -> str | None:
    match = re.match(r"\s*(\d+)", street or "")
    return match.group(1) if match else None


def read_prices(html: str, zip5: str, street: str | None) -> dict | None:
    """The home's own prices, or None when the page is not this home.

    The page's LocalBusiness block must have our ZIP code and our house number.
    Two homes can share a ZIP code and half a name.
    """
    business = re.search(
        r'"@type":"LocalBusiness".*?"postalCode":"(\d{5})","streetAddress":"([^"]*)"', html
    )
    if not business or business.group(1) != zip5:
        return None
    ours, theirs = house_number(street), house_number(business.group(2))
    if not ours or ours != theirs:
        return None
    text = page_text(html)

    # The header block names the home and ends with "Get Help With Pricing".
    start = re.search(r"Starting Price \| (\$[\d,]+)", text)
    if not start:
        return {"starting_price": None, "rooms": {}, "care_types": {}}

    # Room prices sit between "Pricing for | {name}" and "Monthly costs vary".
    rooms: dict[str, int] = {}
    block = re.search(r"Pricing for \|[\s\S]*?Monthly costs vary", text)
    if block:
        for label, amount in re.findall(
            r"\| ([A-Z][A-Za-z ]{2,25}?) \| Starting at \| (\$[\d,]+)", block.group(0)
        ):
            rooms.setdefault(label.strip(), money(amount))

    # Care-type summary, e.g. "Memory Care | $10,630 | Starting Price".
    care_types: dict[str, int] = {}
    for label, amount in re.findall(
        r"(%s) \| (\$[\d,]+) \| Starting Price" % "|".join(CARE_TYPES), text
    ):
        care_types.setdefault(label, money(amount))

    return {"starting_price": money(start.group(1)), "rooms": rooms, "care_types": care_types}


def get_facilities(conn: psycopg.Connection, state: str | None, probe: bool) -> list[dict]:
    cols = "id, name, city, state_code, zip, street"
    with conn.cursor() as cur:
        if probe:
            cur.execute(
                f"SELECT {cols} FROM facilities WHERE state_code='AZ' AND publishable AND city='Mesa' "
                "ORDER BY md5(id::text) LIMIT 10"
            )
            rows = cur.fetchall()
            cur.execute(
                f"SELECT {cols} FROM facilities WHERE state_code='CA' AND publishable AND city = ANY(%s) "
                "ORDER BY md5(id::text) LIMIT 10",
                (list(OC_CITIES),),
            )
            rows += cur.fetchall()
        else:
            cur.execute(
                f"SELECT {cols} FROM facilities WHERE state_code=%s AND publishable ORDER BY name", (state,)
            )
            rows = cur.fetchall()
        names = [d[0] for d in cur.description]
    return [dict(zip(names, row)) for row in rows]


def main() -> None:
    parser = argparse.ArgumentParser(description="Plain-fetch Caring prices")
    parser.add_argument("--probe", action="store_true", help="10 Mesa AZ + 10 Orange County CA homes")
    parser.add_argument("--state", choices=sorted(STATE_SLUG), help="every published home in a state")
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    if not args.probe and not args.state:
        parser.error("pass --probe or --state")

    print("Loading Caring community URLs…")
    urls_by_state: dict[str, list[str]] = {}
    for url in load_caring_urls():
        urls_by_state.setdefault(url.split("/senior-living/")[1].split("/")[0], []).append(url)

    counts = {"homes": 0, "page_found": 0, "robots_blocked": 0, "fetch_failed": 0,
              "not_this_home": 0, "page_no_price": 0, "priced": 0}
    with psycopg.connect(DB_URL) as conn:
        for facility in get_facilities(conn, args.state, args.probe):
            counts["homes"] += 1
            label = f"{facility['name']} — {facility['city']}"
            url = find_page(urls_by_state, facility)
            if not url:
                print(f"[no page] {label}")
                continue
            counts["page_found"] += 1
            status, html = polite_get(url)
            if status == 0:
                counts["robots_blocked"] += 1
                print(f"[robots] {label}")
                continue
            if status != 200:
                counts["fetch_failed"] += 1
                print(f"[http {status}] {label}")
                continue
            prices = read_prices(html, (facility["zip"] or "")[:5], facility["street"])
            if prices is None:
                counts["not_this_home"] += 1
                print(f"[different address] {label} {url}")
                continue
            if prices["starting_price"] is None:
                counts["page_no_price"] += 1
                print(f"[page, no price] {label}")
                continue
            counts["priced"] += 1
            care = prices["care_types"]
            conn.execute(
                """
                INSERT INTO pilot_pricing_sources
                  (pilot_run_id, facility_id, source, source_url, starting_price_monthly_usd,
                   memory_care_price_monthly_usd, assisted_living_price_monthly_usd,
                   is_correct_facility, raw_extract)
                VALUES (%s, %s, 'caring', %s, %s, %s, %s, true, %s::jsonb)
                """,
                (
                    args.run_id, str(facility["id"]), url, prices["starting_price"],
                    care.get("Memory Care"), care.get("Assisted Living"), json.dumps(prices),
                ),
            )
            conn.commit()
            print(f"[priced] {label}: from ${prices['starting_price']:,} {care or ''} {url}")

    print("\n=== Done ===")
    for key, value in counts.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
