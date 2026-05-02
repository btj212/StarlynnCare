#!/usr/bin/env python3
"""
Scrape APFM and Caring.com California memory care directory pages.

This script extracts memory care facility listings from two major directories:
- A Place for Mom (APFM): https://www.aplaceformom.com/alzheimers-care/california
- Caring.com: https://www.caring.com/senior-living/memory-care-facilities/california

Output is clean JSON files with facility name, address, and source URL for
downstream matching to CDSS records.

Usage
-----
    python directory_mc_scrape.py                       # both sources, limited to 3 cities (smoke test)
    python directory_mc_scrape.py --full                # both sources, all CA cities
    python directory_mc_scrape.py --source apfm         # only APFM
    python directory_mc_scrape.py --source caring       # only Caring.com
    python directory_mc_scrape.py --max-cities 5        # debugging — limit pages
    python directory_mc_scrape.py --skip-map            # use cached city URL list
    python directory_mc_scrape.py --dry-run             # show what would scrape, no calls

Output files:
- .firecrawl/directory-match/apfm-ca-mc.json
- .firecrawl/directory-match/caring-ca-mc.json

Each file contains: {source, scraped_at, pages_scraped, credits_used, facilities: [...]}.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import anthropic
from dotenv import load_dotenv

from firecrawl_markdown import parse_json_from_llm, scrape_url_to_markdown

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "CA"

# Source configurations
SOURCES = {
    "apfm": {
        "name": "A Place for Mom",
        "state_url": "https://www.aplaceformom.com/alzheimers-care/california",
        "output_file": ".firecrawl/directory-match/apfm-ca-mc.json",
    },
    "caring": {
        "name": "Caring.com", 
        "state_url": "https://www.caring.com/senior-living/memory-care-facilities/california",
        "output_file": ".firecrawl/directory-match/caring-ca-mc.json",
    }
}

# Firecrawl extraction schema for facility listings
EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "facilities": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "street": {"type": "string"},
                    "city": {"type": "string"},
                    "state": {"type": "string"},
                    "zip": {"type": "string"}
                },
                "required": ["name", "city"]
            }
        }
    },
    "required": ["facilities"]
}

EXTRACTION_PROMPT = (
    "Extract every memory care facility listed on this page. Return name, street, city, state, zip for each. "
    "Include all facilities, not just featured ones. Skip ads and editorial content."
)

# Haiku: cheap structured extraction from directory markdown (Sonnet reserved for judgment tasks).
DIRECTORY_LLM_MODEL = "claude-haiku-4-5-20251001"
DIRECTORY_LLM_SYSTEM = """You extract memory-care / dementia-care assisted living facility listings from a commercial directory page (markdown).

Return ONE JSON object only (no markdown fences): {\"facilities\":[{\"name\":\"\",\"street\":\"\",\"city\":\"\",\"state\":\"\",\"zip\":\"\"},...]}

Rules:
- Include facilities explicitly listed as memory care, dementia care, Alzheimer's, or similar on this page.
- Include only rows that appear to be California facilities (state CA or CA cities/zips). Omit other states.
- Use \"\" for unknown street or zip.
- De-duplicate same name+city.
- If nothing qualifies, return {\"facilities\":[]}."""


def _extract_facilities_llm(markdown: str, source_url: str) -> list[dict[str, Any]]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    client = anthropic.Anthropic(api_key=api_key)
    clipped = markdown[:150000]
    msg = client.messages.create(
        model=DIRECTORY_LLM_MODEL,
        max_tokens=8192,
        system=DIRECTORY_LLM_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Page URL: {source_url}\n\n"
                    f"{EXTRACTION_PROMPT}\n\n"
                    f"--- MARKDOWN ---\n{clipped}"
                ),
            }
        ],
    )
    block = msg.content[0]
    if block.type != "text":
        raise RuntimeError("unexpected block type")
    data = parse_json_from_llm(block.text)
    facs = data.get("facilities")
    if not isinstance(facs, list):
        raise ValueError("missing facilities array")
    out: list[dict[str, Any]] = []
    for f in facs:
        if isinstance(f, dict) and f.get("name") and f.get("city"):
            out.append(
                {
                    "name": str(f.get("name", "")).strip(),
                    "street": str(f.get("street", "") or "").strip(),
                    "city": str(f.get("city", "")).strip(),
                    "state": str(f.get("state", "") or "CA").strip(),
                    "zip": str(f.get("zip", "") or "").strip(),
                }
            )
    return out


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def load_env() -> None:
    """Load environment variables from .env files."""
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def setup_logging() -> logging.Logger:
    """Set up logging to console."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)]
    )
    return logging.getLogger(__name__)


def normalize_name_city_zip(name: str, city: str, zip_code: str) -> tuple[str, str, str]:
    """Normalize facility name, city, and zip for deduplication."""
    # Normalize name: lowercase, remove extra spaces, common corporate suffixes
    norm_name = re.sub(r'\s+', ' ', name.lower().strip())
    norm_name = re.sub(r'\b(llc|inc|corp|ltd|senior living|assisted living|memory care)\b', '', norm_name)
    norm_name = norm_name.strip()
    
    # Normalize city: lowercase, remove spaces
    norm_city = re.sub(r'\s+', '', city.lower().strip())
    
    # Normalize zip: just first 5 digits
    norm_zip = re.sub(r'\D', '', zip_code)[:5] if zip_code else ""
    
    return norm_name, norm_city, norm_zip


def run_firecrawl_command(cmd: list[str], timeout: int = 300) -> dict[str, Any]:
    """Run a firecrawl CLI command and return parsed JSON output."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=True
        )
        
        # Parse JSON output
        if result.stdout.strip():
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError as e:
                logging.error(f"Failed to parse firecrawl JSON output: {e}")
                logging.error(f"Raw output: {result.stdout}")
                return {"error": f"JSON parse error: {e}"}
        else:
            return {"error": "Empty output from firecrawl"}
            
    except subprocess.TimeoutExpired:
        logging.error(f"Firecrawl command timed out after {timeout}s: {' '.join(cmd)}")
        return {"error": f"Timeout after {timeout}s"}
    except subprocess.CalledProcessError as e:
        logging.error(f"Firecrawl command failed: {' '.join(cmd)}")
        logging.error(f"Return code: {e.returncode}")
        logging.error(f"Stderr: {e.stderr}")
        return {"error": f"Command failed with code {e.returncode}: {e.stderr}"}


def discover_city_urls(state_url: str, source_key: str, use_cache: bool = False) -> list[str]:
    """Discover all city/county URLs for a source using firecrawl map."""
    cache_file = Path(f".firecrawl/directory-match/{source_key}-city-urls.json")
    
    if use_cache and cache_file.exists():
        logging.info(f"Using cached city URLs for {source_key}")
        with open(cache_file, 'r') as f:
            return json.load(f)
    
    logging.info(f"Discovering city URLs for {source_key}: {state_url}")
    
    # Use firecrawl map to discover all sub-URLs
    cmd = ["firecrawl", "map", state_url, "--search", "", "--json"]
    result = run_firecrawl_command(cmd, timeout=60)
    
    if "error" in result:
        logging.error(f"Failed to discover URLs for {source_key}: {result['error']}")
        return []
    
    # Extract URLs from the map result
    urls = []
    if "data" in result and "links" in result["data"]:
        base_path = urlparse(state_url).path.rstrip('/')
        for link_obj in result["data"]["links"]:
            if isinstance(link_obj, dict) and "url" in link_obj:
                url = link_obj["url"]
                parsed = urlparse(url)
                # Include URLs that extend the base path (city/county pages)
                if parsed.path.startswith(base_path + '/') and parsed.path != base_path:
                    urls.append(url)
    
    logging.info(f"Found {len(urls)} city URLs for {source_key}")
    
    # Cache the results
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_file, 'w') as f:
        json.dump(urls, f, indent=2)
    
    return urls


def extract_facilities_from_url(url: str, source_key: str) -> dict[str, Any]:
    """Scrape directory page to markdown, then extract facilities with Sonnet."""
    import hashlib

    logging.info(f"Extracting facilities from: {url}")
    h = hashlib.md5(url.encode()).hexdigest()[:12]
    out_md = Path(f".firecrawl/directory-match/_page-{source_key}-{h}.md")
    markdown = scrape_url_to_markdown(url, out_md, wait_ms=8000)
    if not markdown or len(markdown.strip()) < 40:
        logging.warning(f"Empty markdown for {url}")
        return {"facilities": [], "error": "empty_markdown"}

    try:
        facilities = _extract_facilities_llm(markdown, url)
    except Exception as e:
        logging.error(f"LLM extraction failed for {url}: {e}")
        return {"facilities": [], "error": str(e)}

    for facility in facilities:
        facility["source_url"] = url
    return {"facilities": facilities}


def _top_cities_from_db(top_n: int) -> set[str]:
    """Return the top-N city slugs by LICENSED facility count for CA."""
    import psycopg

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        logging.error("DATABASE_URL is not set; cannot use --cities-from-db")
        return set()

    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT city
            FROM facilities
            WHERE state_code='CA' AND license_status='LICENSED'
            GROUP BY city
            ORDER BY count(*) DESC
            LIMIT %s
            """,
            (top_n,),
        )
        return {_slug(row[0]) for row in cur.fetchall()}


def _slug(value: str) -> str:
    s = (value or "").lower().strip()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", "-", s)
    return s.strip("-")


def _filter_urls_by_city_slugs(urls: list[str], slugs: set[str]) -> list[str]:
    """Keep only URLs whose final path segment matches one of `slugs`."""
    out = []
    for u in urls:
        last = u.rstrip("/").rsplit("/", 1)[-1]
        if last in slugs:
            out.append(u)
    return out


def _checkpoint_source_urls(output_file: Path) -> set[str]:
    """URLs that already produced ≥1 facility in the checkpoint JSON (skip on resume)."""
    if not output_file.exists():
        return set()
    try:
        doc = json.loads(output_file.read_text())
        out: set[str] = set()
        for fac in doc.get("facilities", []) or []:
            if not isinstance(fac, dict):
                continue
            u = fac.get("source_url")
            if isinstance(u, str) and u.strip():
                out.add(u.strip())
        return out
    except (json.JSONDecodeError, OSError):
        return set()


def scrape_source(
    source_key: str,
    max_cities: int = None,
    skip_map: bool = False,
    dry_run: bool = False,
    city_slugs: set[str] | None = None,
    resume: bool = False,
) -> dict[str, Any]:
    """Scrape all facilities from a single source."""
    source_config = SOURCES[source_key]
    logging.info(f"Starting scrape of {source_config['name']}")

    start_time = datetime.now(timezone.utc)
    credits_start = get_current_credits()

    if not skip_map:
        city_urls = discover_city_urls(source_config["state_url"], source_key)
    else:
        cache_file = Path(f".firecrawl/directory-match/{source_key}-city-urls.json")
        if cache_file.exists():
            with open(cache_file, 'r') as f:
                city_urls = json.load(f)
        else:
            logging.error(f"No cached URLs found for {source_key} and --skip-map specified")
            return {"error": "No cached URLs"}

    if city_slugs:
        before = len(city_urls)
        city_urls = _filter_urls_by_city_slugs(city_urls, city_slugs)
        logging.info(f"Filtered by --cities-from-db: {len(city_urls)} of {before} URLs")

    output_file = Path(source_config["output_file"])
    if resume:
        done_urls = _checkpoint_source_urls(output_file)
        before_resume = len(city_urls)
        city_urls = [u for u in city_urls if u not in done_urls]
        logging.info(
            f"--resume: skipping {before_resume - len(city_urls)} URLs already in {output_file.name}, "
            f"{len(city_urls)} remaining"
        )

    if max_cities:
        city_urls = city_urls[:max_cities]
        logging.info(f"Limited to {max_cities} cities: {len(city_urls)} URLs")
    
    if dry_run:
        logging.info(f"DRY RUN: Would scrape {len(city_urls)} URLs for {source_key}")
        for i, url in enumerate(city_urls[:10]):  # Show first 10
            logging.info(f"  {i+1}: {url}")
        if len(city_urls) > 10:
            logging.info(f"  ... and {len(city_urls) - 10} more")
        return {"dry_run": True, "urls": city_urls}
    
    all_facilities: list[dict[str, Any]] = []
    failed_urls: list[dict[str, Any]] = []

    seen: set[str] = set()
    if output_file.exists():
        try:
            existing_doc = json.loads(output_file.read_text())
            for fac in existing_doc.get("facilities", []) or []:
                key = normalize_name_city_zip(
                    fac.get("name", ""), fac.get("city", ""), fac.get("zip", "")
                )
                if key:
                    seen.add(key)
        except Exception as exc:
            logging.warning(f"Could not parse {output_file}: {exc}")

    for i, url in enumerate(city_urls, 1):
        logging.info(f"Processing {i}/{len(city_urls)}: {url}")

        result = extract_facilities_from_url(url, source_key)

        if "error" in result:
            failed_urls.append({"url": url, "error": result["error"]})
        else:
            facilities = result.get("facilities", [])
            all_facilities.extend(facilities)
            logging.info(f"  Found {len(facilities)} facilities")

            # Incremental save after each city. Cheap insurance against an
            # interrupted run losing all collected data.
            try:
                _checkpoint_save(output_file, source_key, facilities, seen)
            except Exception as exc:
                logging.warning(f"  Checkpoint save failed: {exc}")

        if i < len(city_urls):
            time.sleep(0.5)
    
    # Deduplicate facilities by (normalized_name, city, zip)
    seen = set()
    deduped_facilities = []
    
    for facility in all_facilities:
        name = facility.get("name", "")
        city = facility.get("city", "")
        zip_code = facility.get("zip", "")
        
        norm_key = normalize_name_city_zip(name, city, zip_code)
        if norm_key not in seen:
            seen.add(norm_key)
            deduped_facilities.append(facility)
    
    credits_end = get_current_credits()
    credits_used = max(0, credits_start - credits_end)  # Handle case where credits might increase
    
    result = {
        "source": source_key,
        "scraped_at": start_time.isoformat(),
        "pages_scraped": len(city_urls),
        "pages_failed": len(failed_urls),
        "credits_used": credits_used,
        "facilities_raw": len(all_facilities),
        "facilities": deduped_facilities,
        "failed_urls": failed_urls
    }
    
    logging.info(f"Scraping complete for {source_key}:")
    logging.info(f"  Pages scraped: {len(city_urls)}")
    logging.info(f"  Pages failed: {len(failed_urls)}")
    logging.info(f"  Raw facilities: {len(all_facilities)}")
    logging.info(f"  Unique facilities: {len(deduped_facilities)}")
    logging.info(f"  Credits used: {credits_used}")
    
    return result


def get_current_credits() -> int:
    """Get current credit count from firecrawl status."""
    try:
        result = subprocess.run(
            ["firecrawl", "--status"],
            capture_output=True,
            text=True,
            timeout=30,
            check=True
        )
        
        # Parse credits from output like "Credits: 408 / 500"
        for line in result.stdout.split('\n'):
            if 'Credits:' in line:
                # Extract first number from "408 / 500"
                match = re.search(r'(\d+)', line.split('Credits:')[1])
                if match:
                    return int(match.group(1))
        
        return 0
    except:
        return 0


def _checkpoint_save(
    output_file: Path,
    source_key: str,
    new_facilities: list[dict[str, Any]],
    seen: set[str],
) -> None:
    """Append new (deduped) facilities to the per-source JSON file."""
    output_file.parent.mkdir(parents=True, exist_ok=True)

    existing_facilities: list[dict[str, Any]] = []
    if output_file.exists():
        try:
            existing_facilities = (
                json.loads(output_file.read_text()).get("facilities", []) or []
            )
        except Exception:
            existing_facilities = []

    for fac in new_facilities:
        key = normalize_name_city_zip(
            fac.get("name", ""), fac.get("city", ""), fac.get("zip", "")
        )
        if not key or key in seen:
            continue
        seen.add(key)
        existing_facilities.append(fac)

    output_file.write_text(
        json.dumps(
            {
                "source": source_key,
                "checkpointed_at": datetime.now(timezone.utc).isoformat(),
                "facilities": existing_facilities,
                "facilities_total": len(existing_facilities),
            },
            indent=2,
        )
    )


def save_results(results: dict[str, Any], source_key: str) -> None:
    """Merge new results with any existing JSON file (dedupe by name+city+zip).

    The smoke-test run already wrote a file. Subsequent runs add new facilities
    without trampling earlier results. Metadata fields reflect the latest run.
    """
    output_file = Path(SOURCES[source_key]["output_file"])
    output_file.parent.mkdir(parents=True, exist_ok=True)

    merged_facilities: list[dict[str, Any]] = []
    seen: set[str] = set()

    if output_file.exists():
        try:
            existing = json.loads(output_file.read_text())
            for fac in existing.get("facilities", []) or []:
                key = normalize_name_city_zip(
                    fac.get("name", ""), fac.get("city", ""), fac.get("zip", "")
                )
                if key and key not in seen:
                    seen.add(key)
                    merged_facilities.append(fac)
        except Exception as exc:
            logging.warning(f"Could not parse existing {output_file}: {exc}; starting fresh")

    for fac in results.get("facilities", []) or []:
        key = normalize_name_city_zip(
            fac.get("name", ""), fac.get("city", ""), fac.get("zip", "")
        )
        if key and key not in seen:
            seen.add(key)
            merged_facilities.append(fac)

    payload = {**results, "facilities": merged_facilities, "facilities_total": len(merged_facilities)}

    with open(output_file, "w") as f:
        json.dump(payload, f, indent=2)

    logging.info(
        f"Results saved to {output_file} "
        f"(new this run: {len(results.get('facilities', []) or [])}, total: {len(merged_facilities)})"
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape memory care directories")
    
    parser.add_argument(
        "--source",
        choices=list(SOURCES.keys()) + ["all"],
        default="all",
        help="Source to scrape (default: all)"
    )
    parser.add_argument(
        "--max-cities",
        type=int,
        default=3,
        help="Maximum cities to scrape per source (default: 3 for smoke testing)"
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Scrape all cities (overrides --max-cities)"
    )
    parser.add_argument(
        "--skip-map",
        action="store_true",
        help="Use cached city URL list instead of re-discovering"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be scraped without making API calls"
    )
    parser.add_argument(
        "--cities-from-db",
        type=int,
        default=None,
        metavar="N",
        help=(
            "Restrict the scrape to the top N cities (by LICENSED facility count) in our DB. "
            "Combine with --skip-map to avoid re-running map discovery."
        ),
    )
    parser.add_argument(
        "--cities",
        type=str,
        default=None,
        help="Comma-separated list of city slugs to scrape (e.g. 'oakland,san-jose,los-angeles').",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help=(
            "Skip city URLs that already have ≥1 extracted facility in the output JSON "
            "(same source_url). Empty-scrape cities are retried."
        ),
    )

    args = parser.parse_args()

    load_env()
    logger = setup_logging()

    city_slugs: set[str] | None = None
    if args.cities:
        city_slugs = {_slug(c) for c in args.cities.split(",") if c.strip()}
        logger.info(f"--cities filter: {sorted(city_slugs)}")
    elif args.cities_from_db:
        city_slugs = _top_cities_from_db(args.cities_from_db)
        logger.info(f"--cities-from-db top-{args.cities_from_db}: {sorted(city_slugs)}")

    max_cities = None if args.full else args.max_cities
    
    if not args.full and not args.dry_run:
        logger.info(f"SMOKE TEST MODE: Limited to {args.max_cities} cities per source. Use --full for complete scrape.")
    
    # Determine which sources to scrape
    if args.source == "all":
        sources_to_scrape = list(SOURCES.keys())
    else:
        sources_to_scrape = [args.source]
    
    # Scrape each source
    for source_key in sources_to_scrape:
        logger.info(f"\n{'='*60}")
        logger.info(f"SCRAPING {SOURCES[source_key]['name'].upper()}")
        logger.info(f"{'='*60}")
        
        try:
            results = scrape_source(
                source_key=source_key,
                max_cities=max_cities,
                skip_map=args.skip_map,
                dry_run=args.dry_run,
                city_slugs=city_slugs,
                resume=args.resume,
            )
            
            if not args.dry_run and "error" not in results:
                save_results(results, source_key)
                
                # Print sample facilities
                facilities = results.get("facilities", [])
                if facilities:
                    logger.info(f"\nSample facilities from {source_key}:")
                    for i, facility in enumerate(facilities[:5], 1):
                        name = facility.get("name", "N/A")
                        city = facility.get("city", "N/A")
                        street = facility.get("street", "N/A")
                        zip_code = facility.get("zip", "N/A")
                        logger.info(f"  {i}. {name} - {street}, {city} {zip_code}")
            
        except Exception as e:
            logger.error(f"Failed to scrape {source_key}: {e}")
            import traceback
            logger.error(traceback.format_exc())
    
    logger.info(f"\n{'='*60}")
    logger.info("SCRAPING COMPLETE")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    main()