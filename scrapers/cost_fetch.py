#!/usr/bin/env python3
"""
Read the prices three sites show for a home, with plain HTTP. No paid API, no model.

Sources: Caring.com, A Place for Mom (apfm), SeniorAdvisor (senioradvisor).
Seniorly is now CareScout, and its public sitemap holds about 1,200 provider pages (28 in
Arizona, 74 in California), so it is not read.

Two of the sites show "$X,XXX" until a visitor fills in a lead form. The real number is in the
page already sent to every visitor, hidden from view. Blake asked for it to be read anyway.
Robots.txt is still obeyed, requests are spaced 2.5 s apart, and only the home's own price
rows are read. Nothing else on the page is kept.

Per home and source:
  1. Find the home's page from the site's own sitemap (name match, then state or city).
  2. Fetch it (robots.txt checked).
  3. Confirm the page's address block has the same ZIP code and house number.
  4. Read the home's own price rows. Not the neighbours' cards or compare columns.
  5. Add a row to pilot_pricing_sources. Rows are never overwritten.

Memory care costs more than assisted living. A price is stored as memory care only when the
page labels it that way. An unlabeled price is stored as the starting price, with the label
kept in raw_extract.care_basis.

Usage:
  python3 scrapers/cost_fetch.py --probe --run-id cost_fetch_probe_2   # 10 Mesa + 10 Orange County
  python3 scrapers/cost_fetch.py --state AZ --run-id cost_fetch_az --sources caring,apfm
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

import psycopg
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
sys.path.insert(0, str(Path(__file__).parent))
from _robots import polite_get  # noqa: E402

DB_URL = os.environ["DATABASE_URL"]
CACHE_DIR = Path(__file__).parent.parent / ".cache"
CACHE = CACHE_DIR / "caring_community_urls.txt"
SITEMAP_INDEX = "https://www.caring.com/ccds/sitemap_index.xml"
APFM_SITEMAPS = [f"https://www.aplaceformom.com/sitemap-community-{n}.xml" for n in (1, 2, 3)]
SA_SITEMAP = "https://www.senioradvisor.com/sitemap-communities.xml"
STATE_ABBR_SLUG = {"AZ": "az", "CA": "ca", "CO": "co", "IL": "il", "MN": "mn", "MO": "mo",
                   "OR": "or", "PA": "pa", "TX": "tx", "UT": "ut", "WA": "wa"}
MAX_PAGE_TRIES = 3

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


def load_sitemap_urls(cache_name: str, sitemaps: list[str], keep: str) -> list[str]:
    """Every <loc> containing `keep` in the given sitemaps. Cached after the first run."""
    cache = CACHE_DIR / cache_name
    if cache.exists():
        return cache.read_text().split()
    urls: list[str] = []
    for sitemap in sitemaps:
        status, body = polite_get(sitemap, min_gap_s=1.0)
        if status != 200:
            raise RuntimeError(f"{sitemap} returned {status}")
        urls.extend(u for u in re.findall(r"<loc>([^<]+)</loc>", body) if keep in u)
    CACHE_DIR.mkdir(exist_ok=True)
    cache.write_text("\n".join(urls))
    return urls


def best_by_name(facility: dict, slugs: dict[str, str]) -> list[str]:
    """URLs whose slug overlaps the home's name by at least MIN_NAME_OVERLAP, best first."""
    ours = slug_tokens(facility["name"])
    scored: list[tuple[float, str]] = []
    for url, slug in slugs.items():
        theirs = slug_tokens(slug)
        if ours and theirs:
            score = len(ours & theirs) / len(ours | theirs)
            if score >= MIN_NAME_OVERLAP:
                scored.append((score, url))
    return [url for _, url in sorted(scored, reverse=True)[:MAX_PAGE_TRIES]]


def address_matches(html: str, zip5: str, street: str | None) -> bool:
    """The page's schema.org address block has our ZIP code and house number (either key order)."""
    ours = house_number(street)
    if not ours:
        return False
    for block in re.finditer(r'"PostalAddress"[^{}]*', html):
        text = block.group(0)
        street_match = re.search(r'"streetAddress":"([^"]*)"', text)
        zip_match = re.search(r'"postalCode":"(\d{5})', text)
        if street_match and zip_match and zip_match.group(1) == zip5 and house_number(street_match.group(1)) == ours:
            return True
    return False


def dollars(text: str) -> list[int]:
    return [int(n.replace(",", "")) for n in re.findall(r"\$\s*([\d,]{4,})", text)]


def read_apfm(html: str, zip5: str, street: str | None) -> dict | None:
    """Room prices of column 0 of the compare table, which is this home. The hidden
    "ungated" span holds the real number while the visible one shows $X,XXX."""
    if not address_matches(html, zip5, street):
        return None
    soup = BeautifulSoup(html, "html.parser")
    rooms: dict[str, int] = {}
    for box in soup.select('div.Compare__sectionContainer[data-compare-index="0"]'):
        label = box.select_one(".Compare__PricingSection__header")
        ungated = box.select_one('span[id="ComparePricingSectionUngated"]')
        if not label or not ungated:
            continue
        found = dollars(ungated.get_text(" "))
        if found:
            rooms.setdefault(label.get_text(" ", strip=True), found[0])
    return {
        "starting_price": min(rooms.values()) if rooms else None,
        "rooms": rooms, "care_types": {}, "care_basis": "unlabeled",
    }


def read_senioradvisor(html: str, zip5: str, street: str | None) -> dict | None:
    """Rows of the "Published Prices" table. The hidden data-price holds the real figure
    (shown as "~$5,150") while the visible text is $X,XXX."""
    if not address_matches(html, zip5, street):
        return None
    soup = BeautifulSoup(html, "html.parser")
    rooms: dict[str, int] = {}
    industry = None
    for row in soup.select("table.rack-prices tbody tr"):
        label = row.select_one("td")
        cell = row.select_one("[data-price]")
        if not label or not cell:
            continue
        found = dollars(str(cell.get("data-price", "")))
        if found:
            rooms.setdefault(label.get_text(" ", strip=True), min(found))
        link = row.select_one("a.see-rack-price")
        industry = industry or (link.get("data-industry") if link else None)
    care_types = {industry: min(rooms.values())} if industry and rooms else {}
    basis = {"Memory Care": "memory_care", "Assisted Living": "assisted_living"}.get(str(industry), "unlabeled")
    return {
        "starting_price": min(rooms.values()) if rooms else None,
        "rooms": rooms, "care_types": care_types, "care_basis": basis,
    }


def caring_candidates(facility: dict, index: dict[str, list[str]]) -> list[str]:
    url = find_page(index, facility)
    return [url] if url else []


def apfm_candidates(facility: dict, index: list[str]) -> list[str]:
    slugs = {u: re.sub(r"-\d+$", "", u.rsplit("/", 1)[-1]) for u in index}
    return best_by_name(facility, slugs)


def senioradvisor_candidates(facility: dict, index: list[str]) -> list[str]:
    city = re.sub(r"[^a-z0-9]+", "-", (facility["city"] or "").lower()).strip("-")
    tail = f"-{city}-{STATE_ABBR_SLUG[facility['state_code']]}"
    slugs = {u: u.rsplit("/", 1)[-1].removesuffix(tail) for u in index if u.endswith(tail)}
    return best_by_name(facility, slugs)


def load_sources(wanted: list[str]) -> dict[str, tuple]:
    """source name -> (url index, candidates function, page reader)."""
    sources: dict[str, tuple] = {}
    if "caring" in wanted:
        by_state: dict[str, list[str]] = {}
        for url in load_caring_urls():
            by_state.setdefault(url.split("/senior-living/")[1].split("/")[0], []).append(url)
        sources["caring"] = (by_state, caring_candidates, read_prices)
    if "apfm" in wanted:
        index = load_sitemap_urls("apfm_community_urls.txt", APFM_SITEMAPS, "/community/")
        sources["apfm"] = (index, apfm_candidates, read_apfm)
    if "senioradvisor" in wanted:
        index = load_sitemap_urls("senioradvisor_community_urls.txt", [SA_SITEMAP], "/local/")
        sources["senioradvisor"] = (index, senioradvisor_candidates, read_senioradvisor)
    return sources


def main() -> None:
    parser = argparse.ArgumentParser(description="Plain-fetch prices from Caring, A Place for Mom, SeniorAdvisor")
    parser.add_argument("--probe", action="store_true", help="10 Mesa AZ + 10 Orange County CA homes")
    parser.add_argument("--state", choices=sorted(STATE_SLUG), help="every published home in a state")
    parser.add_argument("--sources", default="caring,apfm,senioradvisor")
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    if not args.probe and not args.state:
        parser.error("pass --probe or --state")
    wanted = args.sources.split(",")

    print("Loading page lists…")
    sources = load_sources(wanted)
    counts = {name: {"page_found": 0, "robots": 0, "http_error": 0, "not_this_home": 0,
                     "no_price": 0, "priced": 0} for name in sources}
    priced_any: set[str] = set()
    homes = 0
    with psycopg.connect(DB_URL) as conn:
        for facility in get_facilities(conn, args.state, args.probe):
            homes += 1
            label = f"{facility['name']} — {facility['city']}"
            zip5 = (facility["zip"] or "")[:5]
            for name, (index, candidates, reader) in sources.items():
                stat = counts[name]
                urls = candidates(facility, index)
                if not urls:
                    continue
                outcome = "not_this_home"
                for url in urls:
                    status, html = polite_get(url)
                    if status == 0:
                        outcome = "robots"
                        break
                    if status != 200:
                        outcome = "http_error"
                        continue
                    prices = reader(html, zip5, facility["street"])
                    if prices is None:
                        continue
                    outcome = "priced" if prices["starting_price"] is not None else "no_price"
                    break
                stat["page_found"] += 1
                stat[outcome] += 1
                if outcome != "priced":
                    print(f"[{name}: {outcome}] {label}")
                    continue
                care = prices["care_types"]
                conn.execute(
                    """
                    INSERT INTO pilot_pricing_sources
                      (pilot_run_id, facility_id, source, source_url, starting_price_monthly_usd,
                       memory_care_price_monthly_usd, assisted_living_price_monthly_usd,
                       is_correct_facility, raw_extract)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, true, %s::jsonb)
                    """,
                    (
                        args.run_id, str(facility["id"]), name, url, prices["starting_price"],
                        care.get("Memory Care"), care.get("Assisted Living"),
                        json.dumps({**prices, "care_basis": prices.get("care_basis", "labeled")}),
                    ),
                )
                conn.commit()
                priced_any.add(str(facility["id"]))
                print(f"[{name}: priced] {label}: from ${prices['starting_price']:,} {care or ''} {url}")

    print("\n=== Done ===")
    print(f"homes: {homes}   homes with at least one price: {len(priced_any)}")
    for name, stat in counts.items():
        print(f"{name}: {stat}")


if __name__ == "__main__":
    main()
