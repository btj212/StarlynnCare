#!/usr/bin/env python3
"""
Scrape chain operators' corporate websites to identify which CA facilities offer memory care.

This implements Phase 2 of the "Widen MC Signal" plan. For each major RCFE chain operator,
we scrape their "find a community" page (filtered for memory care) to get a list of CA 
facilities that definitively offer MC services. We then match these to CDSS records and 
set mc_signal_chain_curated = true.

Strategy
--------
1. Auto-confirm chains: Silverado, Belmont Village, Aegis, ActivCare are MC-only or
   MC-at-every-property — set mc_signal_chain_curated without scraping.
2. Variable chains: Use firecrawl agent with JSON schema to extract MC facility lists
   from corporate websites, then match by address to CDSS records.

Usage
-----
    python chain_curated_mc.py                      # All chains
    python chain_curated_mc.py --chain atria        # One chain  
    python chain_curated_mc.py --dry-run            # No DB writes
    python chain_curated_mc.py --skip-scrape        # Auto-confirm chains only
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import anthropic
import psycopg
from dotenv import load_dotenv

from firecrawl_markdown import parse_json_from_llm, scrape_url_to_markdown

# Add rapidfuzz for fuzzy matching
try:
    from rapidfuzz import fuzz
except ImportError:
    print("Installing rapidfuzz...")
    subprocess.run([sys.executable, "-m", "pip", "install", "rapidfuzz>=3.0.0"])
    from rapidfuzz import fuzz

# Chain configurations
CHAIN_CONFIGS = [
    # MC-only or MC-at-every-property — auto-confirm without scraping
    {
        "label": "silverado",
        "name_regex": r"\bsilverado\b",
        "auto_confirm": True,
    },
    {
        "label": "belmont-village",
        "name_regex": r"\bbelmont\s+village\b",
        "auto_confirm": True,
    },
    {
        "label": "aegis",
        "name_regex": r"\baegis\b",
        "auto_confirm": True,
    },
    {
        "label": "activcare",
        "name_regex": r"\bactivcare\b",
        "auto_confirm": True,
    },
    
    # Variable MC presence — scrape required
    {
        "label": "ivy-park",
        "name_regex": r"\bivy\s+park\b",
        "find_url": "https://www.ivypark.com/locations/?state=CA",
        "agent_prompt": "Extract every California Ivy Park community that offers Memory Care or Memory Support. Return name, street, city, zip.",
    },
    {
        "label": "brookdale",
        "name_regex": r"\bbrookdale\b",
        "find_url": "https://www.brookdale.com/en/find-a-community.html?careType=memory-care&state=CA",
        "agent_prompt": "Extract every California Brookdale community shown on this Memory Care filter page. Return name, street, city, zip.",
        "wait_ms": 15000,
    },
    {
        "label": "atria",
        "name_regex": r"\batria\b",
        "find_url": "https://www.atriaseniorliving.com/senior-living-communities/senior-living-in-california",
        "agent_prompt": "List every California Atria community with a memory care or Life Guidance program. Return name, street, city, zip.",
    },
    {
        "label": "oakmont",
        "name_regex": r"\boakmont\s+of\b",
        "find_url": "https://oakmontseniorliving.com/our-communities/",
        "agent_prompt": "Extract every California Oakmont community offering Memory Care or the Traditions program. Return name, street, city, zip.",
    },
    {
        "label": "front-porch",
        "name_regex": r"\bfront\s+porch\b",
        "find_url": "https://frontporch.net/communities/",
        "agent_prompt": "Extract every California Front Porch community with memory care or dementia care. Return name, street, city, zip.",
    },
    {
        "label": "sunrise",
        "name_regex": r"\bsunrise\s+(senior\s+living|of)\b",
        "find_url": "https://www.sunriseseniorliving.com/locations/?state=CA",
        "agent_prompt": "Extract every California Sunrise community offering Reminiscence or Memory Care. Return name, street, city, zip.",
    },
    {
        "label": "cogir",
        "name_regex": r"\bcogir\b",
        "find_url": "https://www.cogirseniorliving.com/california",
        "agent_prompt": "Extract every California Cogir community with memory care. Return name, street, city, zip.",
    },
    {
        "label": "carlton",
        "name_regex": r"\bcarlton\s+senior\s+living\b",
        "find_url": "https://www.carltonseniorliving.com/locations/",
        "agent_prompt": "Extract every California Carlton Senior Living community with memory care or dementia care. Return name, street, city, zip.",
    },
    {
        "label": "merrill-gardens",
        "name_regex": r"\bmerrill\s+gardens\b",
        "find_url": "https://www.merrillgardens.com/find-a-community/?state=ca",
        "agent_prompt": "Extract every California Merrill Gardens community with memory care or 'Garden Club'. Return name, street, city, zip.",
    },
    {
        "label": "eskaton",
        "name_regex": r"\beskaton\b",
        "find_url": "https://www.eskaton.org/communities",
        "agent_prompt": "Extract every California Eskaton community with memory care or dementia care. Return name, street, city, zip.",
    },
    {
        "label": "watermark",
        "name_regex": r"\b(watermark\s+at|the\s+watermark)\b",
        "find_url": "https://www.watermarkcommunities.com/find-a-community/",
        "agent_prompt": "Extract every California Watermark community with memory care. Return name, street, city, zip.",
    },
    {
        "label": "pacifica",
        "name_regex": r"\bpacifica\s+senior\s+living\b",
        "find_url": "https://pacificaseniorliving.com/community-search/?state=CA",
        "agent_prompt": "Extract every California Pacifica Senior Living community with memory care. Return name, street, city, zip.",
    },
    {
        "label": "generations",
        "name_regex": r"\bgenerations\b",
        "find_url": "https://generationslmc.com/communities/",
        "agent_prompt": "Extract every California Generations community with memory care. Return name, street, city, zip.",
    },
    {
        "label": "pegasus",
        "name_regex": r"\bpegasus\s+senior\s+living\b",
        "find_url": "https://www.pegasusseniorliving.com/communities/",
        "agent_prompt": "Extract every California Pegasus Senior Living community with memory care. Return name, street, city, zip.",
    },
]

# Haiku: bulk JSON extraction from scraped chain pages; queue_verifier stays on Sonnet.
EXTRACTION_MODEL = "claude-haiku-4-5-20251001"

CHAIN_EXTRACTION_SYSTEM = """You extract California senior-living community listings from webpage markdown.

Reply with ONE JSON object only (no markdown fences, no commentary). Shape:
{"communities":[{"name":"","street":"","city":"","zip":""},...]}

Rules:
- Include ONLY communities located in California (city/state CA or clearly CA addresses).
- Include ONLY locations that offer memory care, dementia care, Alzheimer's program, reminiscence, Life Guidance, Traditions memory care, or are explicitly labeled memory care / MC on the page.
- Omit Illinois, Texas, or any non-CA state unless the same row clearly states a CA address.
- Use empty string for unknown street or zip.
- De-duplicate identical name+city rows.
- If the page has no qualifying CA memory-care communities, return {"communities":[]}."""


def load_env() -> str:
    """Load environment variables and return DATABASE_URL."""
    repo_root = Path(__file__).parent.parent
    for name in (".env.local", ".env"):
        p = repo_root / name
        if p.exists():
            load_dotenv(p)
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL not found in environment")
        sys.exit(1)
    
    return database_url


def normalize_city(city: str) -> str:
    """Normalize city name for matching (lowercase, slugify)."""
    # Basic city normalization matching the pattern in the codebase
    normalized = city.lower().strip()
    # Replace common variations
    normalized = re.sub(r'[^a-z0-9\s]', '', normalized)  # Remove special chars
    normalized = re.sub(r'\s+', '-', normalized)  # Replace spaces with dashes
    return normalized


def normalize_street(street: str) -> str:
    """Normalize street address for matching."""
    if not street:
        return ""
    
    # Lowercase and basic cleanup
    normalized = street.lower().strip()
    
    # Common abbreviations
    abbreviations = {
        r'\bstreet\b': 'st',
        r'\bavenue\b': 'ave', 
        r'\bboulevard\b': 'blvd',
        r'\bdrive\b': 'dr',
        r'\broad\b': 'rd',
        r'\blane\b': 'ln',
        r'\bcircle\b': 'cir',
        r'\bcourt\b': 'ct',
        r'\bplace\b': 'pl',
        r'\bnorth\b': 'n',
        r'\bsouth\b': 's',
        r'\beast\b': 'e',
        r'\bwest\b': 'w',
    }
    
    for pattern, replacement in abbreviations.items():
        normalized = re.sub(pattern, replacement, normalized)
    
    # Remove extra whitespace
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    return normalized


def setup_firecrawl_dir():
    """Ensure .firecrawl/chain-curated directory exists."""
    firecrawl_dir = Path(".firecrawl/chain-curated")
    firecrawl_dir.mkdir(parents=True, exist_ok=True)
    
    # Ensure .firecrawl is in .gitignore
    gitignore = Path(".gitignore")
    if gitignore.exists():
        content = gitignore.read_text()
        if ".firecrawl/" not in content:
            with gitignore.open("a") as f:
                f.write("\n.firecrawl/\n")


def extract_communities_with_llm(
    markdown: str,
    chain_label: str,
    agent_prompt: str,
) -> dict[str, Any]:
    """Call Claude (Haiku) to extract {communities: [...]} from markdown."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

    client = anthropic.Anthropic(api_key=api_key)
    clipped = markdown[:150000]
    user_msg = (
        f"Chain operator key: {chain_label}\n"
        f"Additional extraction instructions: {agent_prompt}\n\n"
        f"--- BEGIN MARKDOWN ---\n{clipped}\n--- END MARKDOWN ---"
    )

    msg = client.messages.create(
        model=EXTRACTION_MODEL,
        max_tokens=8192,
        system=CHAIN_EXTRACTION_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    block = msg.content[0]
    if block.type != "text":
        raise RuntimeError("Unexpected Anthropic response block type")
    text = block.text
    data = parse_json_from_llm(text)
    if "communities" not in data:
        raise ValueError(f"Missing communities key in model JSON: {list(data.keys())}")
    return data


def extract_chain_communities_scrape_llm(chain: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Scrape chain locator page with Firecrawl, then extract CA MC communities via Haiku."""
    label = chain["label"]
    find_url = chain["find_url"]
    prompt = chain["agent_prompt"]
    wait_ms = int(chain.get("wait_ms", 6000))

    print(f"Scrape + LLM extraction for {label}...")
    print(f"  URL: {find_url}")

    md_path = Path(f".firecrawl/chain-curated/{label}-page.md")
    markdown = scrape_url_to_markdown(find_url, md_path, wait_ms=wait_ms)
    if not markdown or len(markdown.strip()) < 50:
        print("  Empty or trivial markdown; aborting extraction")
        return None

    try:
        data = extract_communities_with_llm(markdown, label, prompt)
    except Exception as e:
        print(f"  LLM extraction failed: {e}")
        return None

    # Persist raw extraction for audit
    audit_path = Path(f".firecrawl/chain-curated/{label}-extracted.json")
    audit_path.write_text(json.dumps(data, indent=2))
    return data


def find_facility_matches(communities: List[Dict[str, Any]], chain_regex: str, conn: psycopg.Connection) -> List[Tuple[Dict[str, Any], Optional[str]]]:
    """Match extracted communities to CDSS facilities."""
    matches = []
    chain_regex = _to_pg_regex(chain_regex)


    for community in communities:
        name = community.get("name", "").strip()
        street = community.get("street", "").strip() 
        city = community.get("city", "").strip()
        zip_code = community.get("zip", "").strip()
        
        if not name or not city:
            continue
        
        city_slug = normalize_city(city)
        normalized_street = normalize_street(street)
        
        facility_id = None
        
        # Primary match: city + zip + street similarity
        if zip_code and street:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, name, street, city_slug, zip
                    FROM facilities 
                    WHERE state_code = 'CA' 
                      AND name ~* %s
                      AND city_slug = %s
                      AND (zip = %s OR street ILIKE %s)
                    LIMIT 5
                """, (chain_regex, city_slug, zip_code, f"%{normalized_street[:20]}%"))
                
                rows = cur.fetchall()
                if rows:
                    # Take the first match for now, could add more sophisticated ranking
                    facility_id = rows[0][0]
        
        # Fallback: city + fuzzy name match
        if not facility_id:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, name, street, city_slug, zip
                    FROM facilities
                    WHERE state_code = 'CA'
                      AND name ~* %s  
                      AND city_slug = %s
                """, (chain_regex, city_slug))
                
                rows = cur.fetchall()
                best_match = None
                best_score = 0
                
                for row in rows:
                    facility_name = row[1]
                    score = fuzz.token_sort_ratio(name.lower(), facility_name.lower())
                    if score >= 80 and score > best_score:  # 80% threshold
                        best_score = score
                        best_match = row[0]
                
                facility_id = best_match
        
        matches.append((community, facility_id))
    
    return matches


def _to_pg_regex(pattern: str) -> str:
    """Translate Python word-boundary `\\b` into PostgreSQL POSIX `\\y`.

    PostgreSQL's `~*` operator uses POSIX ERE, which does not recognize Python's
    `\\b`. The SQL ends up matching against literal backspaces and never returns
    rows. `\\y` is the POSIX equivalent.
    """
    return pattern.replace(r"\b", r"\y")


def auto_confirm_chain(chain: Dict[str, Any], conn: psycopg.Connection, dry_run: bool = False) -> int:
    """Auto-confirm MC for chains that are MC-only or MC-at-every-property."""
    label = chain["label"]
    regex = _to_pg_regex(chain["name_regex"])

    print(f"Auto-confirming {label} (MC-only chain)...")

    if dry_run:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, city_slug
                FROM facilities
                WHERE state_code = 'CA'
                  AND license_status = 'LICENSED'
                  AND name ~* %s
                  AND mc_signal_chain_curated = false
            """, (regex,))
            rows = cur.fetchall()
            print(f"  Would update {len(rows)} facilities")
            for row in rows:
                print(f"    {row[1]} ({row[2]})")
            return len(rows)
    else:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE facilities
                SET mc_signal_chain_curated = true,
                    updated_at = now()
                WHERE state_code = 'CA'
                  AND license_status = 'LICENSED'
                  AND name ~* %s
                  AND mc_signal_chain_curated = false
            """, (regex,))
            count = cur.rowcount
            print(f"  Updated {count} facilities")
            return count


def update_chain_curated_facilities(matches: List[Tuple[Dict[str, Any], Optional[str]]], conn: psycopg.Connection, dry_run: bool = False) -> int:
    """Update mc_signal_chain_curated for matched facilities."""
    updated_count = 0
    
    for community, facility_id in matches:
        if facility_id:
            if dry_run:
                print(f"  Would update facility {facility_id} for {community['name']}")
                updated_count += 1
            else:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE facilities
                        SET mc_signal_chain_curated = true,
                            updated_at = now()
                        WHERE id = %s AND mc_signal_chain_curated = false
                    """, (facility_id,))
                    if cur.rowcount > 0:
                        updated_count += 1
                        print(f"  ✓ Updated {community['name']} ({community.get('city', 'unknown city')})")
    
    return updated_count


def process_chain(chain: Dict[str, Any], conn: psycopg.Connection, dry_run: bool = False) -> Tuple[int, int, int]:
    """Process a single chain - either auto-confirm or scrape and match."""
    label = chain["label"]
    
    if chain.get("auto_confirm"):
        updated = auto_confirm_chain(chain, conn, dry_run)
        return updated, 0, updated  # scraped=0, matched=updated for auto-confirm
    
    # Scrape page + Haiku extraction (replaces firecrawl agent)
    if dry_run:
        print(f"Would scrape {label} from {chain.get('find_url', 'unknown URL')}")
        return 0, 0, 0

    extracted_data = extract_chain_communities_scrape_llm(chain)
    if not extracted_data:
        print(f"Failed to extract data for {label}")
        return 0, 0, 0
    
    communities = extracted_data.get("communities", [])
    scraped = len(communities)
    print(f"  Extracted {scraped} communities")
    
    if scraped == 0:
        return 0, 0, 0
    
    # Match to CDSS facilities
    matches = find_facility_matches(communities, chain["name_regex"], conn)
    matched = len([m for m in matches if m[1] is not None])
    
    # Update database
    updated = update_chain_curated_facilities(matches, conn, dry_run)
    
    print(f"  Matched {matched}/{scraped} to CDSS facilities, updated {updated}")
    
    return scraped, matched, updated


def generate_audit_report(all_results: Dict[str, Tuple[int, int, int]], conn: psycopg.Connection) -> str:
    """Generate audit report of the scraping run."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    
    report_lines = [
        f"Chain-curated MC scraper audit report - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * 80,
        "",
    ]
    
    total_scraped = 0
    total_matched = 0  
    total_updated = 0
    
    # Per-chain results
    for chain_label, (scraped, matched, updated) in all_results.items():
        chain_config = next(c for c in CHAIN_CONFIGS if c["label"] == chain_label)
        if chain_config.get("auto_confirm"):
            report_lines.append(f"{chain_label:20} (auto-confirm): {updated} facilities updated")
        else:
            report_lines.append(f"{chain_label:20}: scraped {scraped}, matched {matched}, updated {updated}")
        
        total_scraped += scraped
        total_matched += matched
        total_updated += updated
    
    report_lines.extend([
        "",
        f"TOTAL: scraped {total_scraped}, matched {total_matched}, updated {total_updated}",
        "",
    ])
    
    # Check for unmatched extractions and unconfirmed CDSS rows
    report_lines.append("AUDIT FINDINGS:")
    report_lines.append("-" * 40)
    
    # This would require storing extraction results to analyze unmatched items
    # For now, just note that this analysis should be added
    report_lines.append("Note: Detailed unmatched analysis not yet implemented")
    report_lines.append("Consider adding extraction result storage for full audit")
    
    report_content = "\n".join(report_lines)
    
    # Write to log file
    log_file = Path(f"logs/chain-curated-{timestamp}.log")
    log_file.parent.mkdir(exist_ok=True)
    log_file.write_text(report_content)
    
    return report_content


def check_db_schema(conn: psycopg.Connection) -> bool:
    """Check if required database columns exist."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'facilities' 
                  AND column_name = 'mc_signal_chain_curated'
            """)
            return cur.fetchone() is not None
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(description="Chain-curated memory care scraper")
    parser.add_argument("--chain", help="Process only specific chain (e.g., 'atria')")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be done without DB writes")
    parser.add_argument("--skip-scrape", action="store_true", help="Only process auto-confirm chains")
    
    args = parser.parse_args()
    
    # Load environment and connect to database
    database_url = load_env()
    
    try:
        with psycopg.connect(database_url) as conn:
            # Check if migration 0010 has been applied
            if not check_db_schema(conn):
                print("Error: Database schema not ready. Please apply migration 0010 first.")
                print("The mc_signal_chain_curated column is required.")
                sys.exit(1)
            # Setup firecrawl directory
            setup_firecrawl_dir()
            
            # Filter chains based on arguments
            chains_to_process = CHAIN_CONFIGS
            
            if args.chain:
                chains_to_process = [c for c in CHAIN_CONFIGS if c["label"] == args.chain]
                if not chains_to_process:
                    print(f"Error: Chain '{args.chain}' not found")
                    sys.exit(1)
            
            if args.skip_scrape:
                chains_to_process = [c for c in chains_to_process if c.get("auto_confirm")]
            
            print(f"Processing {len(chains_to_process)} chain(s)...")
            
            # Process each chain
            all_results = {}
            
            for chain in chains_to_process:
                label = chain["label"]
                print(f"\n=== Processing {label} ===")
                
                try:
                    scraped, matched, updated = process_chain(chain, conn, args.dry_run)
                    all_results[label] = (scraped, matched, updated)
                except Exception as e:
                    print(f"Error processing {label}: {e}")
                    all_results[label] = (0, 0, 0)
            
            # Generate and display audit report
            if not args.dry_run:
                conn.commit()
                audit_report = generate_audit_report(all_results, conn)
                print(f"\n{audit_report}")
            else:
                print(f"\nDry run completed - no changes made")
                
    except Exception as e:
        print(f"Database error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()