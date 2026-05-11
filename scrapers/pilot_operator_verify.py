#!/usr/bin/env python3
"""
Pilot 3 — Operator website scrape + claim verification.

For the top 5 chain operators in Alameda County:
1. Find their corporate website via Firecrawl search
2. Crawl the site (depth=2, limit=20)
3. Extract facility-level claims from property pages
4. Match to production facilities (fuzzy name+city or address)
5. Run Claude Sonnet to flag claims uncorroborated or contradicted by inspections

Usage:
  python3 scrapers/pilot_operator_verify.py --smoke    # first 2 operators
  python3 scrapers/pilot_operator_verify.py             # top 5
  python3 scrapers/pilot_operator_verify.py --run-id my_run
"""

import argparse
import difflib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic
import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
sys.path.insert(0, str(Path(__file__).parent))
from _firecrawl import fc_crawl, fc_extract, fc_search, current_spend_usd

DB_URL = os.environ["DATABASE_URL"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

ALAMEDA_CITIES = (
    "Alameda", "Albany", "Berkeley", "Castro Valley", "Dublin", "Emeryville",
    "Fremont", "Hayward", "Livermore", "Newark", "Oakland", "Piedmont",
    "Pleasanton", "San Leandro", "San Lorenzo", "Union City",
)

PROPERTY_SCHEMA = {
    "type": "object",
    "properties": {
        "property_name": {"type": "string"},
        "address": {"type": "string"},
        "city": {"type": "string"},
        "state": {"type": "string"},
        "memory_care_offered": {"type": "boolean"},
        "memory_care_program_name": {"type": "string"},
        "staffing_claims": {"type": "array", "items": {"type": "string"}},
        "certifications_claimed": {"type": "array", "items": {"type": "string"}},
        "monthly_pricing": {"type": "string"},
        "special_programs": {"type": "array", "items": {"type": "string"}},
    },
}

FUZZY_THRESHOLD = 0.85


def get_top_operators(conn: psycopg.Connection, limit: int = 5) -> list[dict]:
    city_list = ", ".join(f"'{c}'" for c in ALAMEDA_CITIES)
    q = f"""
        SELECT operator_name, COUNT(*) as n,
               array_agg(DISTINCT name) as facility_names,
               array_agg(DISTINCT city) as cities
        FROM facilities
        WHERE state_code='CA' AND publishable=true
          AND city IN ({city_list})
          AND operator_name IS NOT NULL
        GROUP BY operator_name ORDER BY n DESC LIMIT {limit}
    """
    with conn.cursor() as cur:
        cur.execute(q)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def get_production_facilities(conn: psycopg.Connection) -> list[dict]:
    city_list = ", ".join(f"'{c}'" for c in ALAMEDA_CITIES)
    q = f"""
        SELECT id, name, city, street, operator_name, slug
        FROM facilities
        WHERE state_code='CA' AND publishable=true
          AND city IN ({city_list})
    """
    with conn.cursor() as cur:
        cur.execute(q)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def get_inspection_summary(conn: psycopg.Connection, facility_id: str) -> str:
    """Pull deficiency/inspection summary for a facility."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT d.description, d.severity, i.inspection_date
            FROM deficiencies d
            JOIN inspections i ON i.id = d.inspection_id
            WHERE i.facility_id=%s
            ORDER BY d.severity DESC NULLS LAST, i.inspection_date DESC NULLS LAST
            LIMIT 10
            """,
            (facility_id,),
        )
        rows = cur.fetchall()
    if not rows:
        return "No deficiencies on record."
    lines = []
    for desc, sev, dt in rows:
        lines.append(f"- Severity {sev or 'N/A'} ({dt or 'unknown date'}): {(desc or '')[:200]}")
    return "\n".join(lines)


def fuzzy_match_facility(
    claims_name: str,
    claims_city: str,
    production: list[dict],
    threshold: float = FUZZY_THRESHOLD,
) -> dict | None:
    """Match extracted property to production facility using name+city fuzzy match."""
    best_score = 0.0
    best_fac = None
    cn = (claims_name or "").lower()
    cc = (claims_city or "").lower()

    for fac in production:
        pn = (fac["name"] or "").lower()
        pc = (fac["city"] or "").lower()

        name_score = difflib.SequenceMatcher(None, cn, pn).ratio()
        city_score = 1.0 if cc == pc else 0.5 if cc[:4] == pc[:4] else 0.0
        combined = name_score * 0.7 + city_score * 0.3

        if combined > best_score:
            best_score = combined
            best_fac = fac

    if best_score >= threshold:
        return best_fac
    return None


def verify_claims_with_claude(
    client: anthropic.Anthropic,
    claims: dict,
    inspection_summary: str,
) -> list[dict]:
    """Use Claude Sonnet to flag uncorroborated or contradicted claims."""
    claims_text = json.dumps(claims, indent=2)
    prompt = (
        f"A memory care facility's website makes these claims:\n{claims_text}\n\n"
        f"The state inspection record shows:\n{inspection_summary}\n\n"
        "Identify any claims that are (a) not corroborated by any source, or "
        "(b) contradicted by the inspection record. "
        "Return JSON: {\"surprises\": [{\"type\": \"uncorroborated|contradicted\", "
        "\"claim\": \"...\", \"evidence\": \"...\"}]}"
    )
    msg = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=800,
        system="You are a precise claims auditor. Return ONLY valid JSON.",
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()
    try:
        result = json.loads(raw)
        return result.get("surprises", [])
    except json.JSONDecodeError:
        import re
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group()).get("surprises", [])
            except json.JSONDecodeError:
                pass
    return []


def find_operator_website(operator_name: str) -> str | None:
    """Search for the operator's corporate website."""
    query = f'"{operator_name}" memory care senior living California official website'
    try:
        results = fc_search(query, num_results=3)
        for r in results:
            url = r.get("url", "") or r.get("link", "")
            # Skip directories, regulatory sites, review sites
            skip = {"yelp.com", "yellowpages.com", "caring.com", "seniorly.com",
                    "aplaceformom.com", "medicare.gov", "ca.gov", "yelp."}
            if url and not any(s in url for s in skip):
                return url
    except Exception as e:
        print(f"    Website search error: {e}")
    return None


def is_property_page(url: str, markdown: str) -> bool:
    """Heuristic: does this page look like an individual property/community page?"""
    signals = ["address", "our community", "floor plan", "pricing", "contact us",
               "schedule a tour", "virtual tour", "amenities", "memory care"]
    text_lower = (markdown or "").lower()
    score = sum(1 for s in signals if s in text_lower)
    return score >= 3


def process_operator(
    conn: psycopg.Connection,
    client: anthropic.Anthropic,
    operator: dict,
    production_facilities: list[dict],
    run_id: str,
) -> int:
    op_name = operator["operator_name"]
    print(f"\n  Operator: {op_name} ({operator['n']} facilities)")

    website = find_operator_website(op_name)
    if not website:
        print(f"    Could not find corporate website for {op_name}")
        return 0

    print(f"    Website: {website}")

    # Crawl the site
    print(f"    Crawling (depth=2, limit=20)...")
    try:
        pages = fc_crawl(website, depth=2, limit=20)
    except RuntimeError as e:
        raise
    except Exception as e:
        print(f"    Crawl error: {e}")
        return 0

    print(f"    Got {len(pages)} pages")

    claims_written = 0

    for page in pages:
        url = page.get("metadata", {}).get("sourceURL", "") or page.get("url", "")
        markdown = page.get("markdown", "") or ""

        if not is_property_page(url, markdown):
            continue

        print(f"    Property page: {url[:80]}")

        # Extract structured claims
        try:
            result = fc_extract(url, PROPERTY_SCHEMA)
            claims = result.get("extract", {}) or {}
        except Exception as e:
            print(f"      Extract error: {e}")
            continue

        if not claims or not claims.get("property_name"):
            continue

        # Fuzzy match to production facility
        matched = fuzzy_match_facility(
            claims.get("property_name", ""),
            claims.get("city", ""),
            production_facilities,
        )

        if not matched:
            print(f"      No production match for: {claims.get('property_name')} / {claims.get('city')}")
            continue

        print(f"      Matched to: {matched['name']} ({matched['city']})")

        # Get inspection summary
        inspection_summary = get_inspection_summary(conn, str(matched["id"]))

        # Verify with Claude
        surprises = verify_claims_with_claude(client, claims, inspection_summary)

        if surprises:
            print(f"      Surprises: {len(surprises)}")
            for s in surprises:
                print(f"        [{s.get('type')}] {s.get('claim', '')[:80]}")

        # Write to DB
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO pilot_operator_claims
                  (pilot_run_id, facility_id, operator_url, claims_jsonb, surprises_jsonb)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    run_id,
                    str(matched["id"]),
                    url,
                    json.dumps(claims),
                    json.dumps(surprises),
                ),
            )
        conn.commit()
        claims_written += 1

    return claims_written


def main() -> None:
    parser = argparse.ArgumentParser(description="Pilot 3: Operator claim verification")
    parser.add_argument("--smoke", action="store_true", help="First 2 operators only")
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--skip-if-matched", action="store_true")
    args = parser.parse_args()

    run_id = args.run_id or f"p3_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    limit = 2 if args.smoke else 5

    print(f"=== Pilot 3: Operator Verification ===")
    print(f"Run ID: {run_id}")
    print(f"Mode: {'smoke (2 operators)' if args.smoke else 'full (5 operators)'}")
    print(f"Spend so far: ${current_spend_usd():.3f}")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    with psycopg.connect(DB_URL) as conn:
        operators = get_top_operators(conn, limit=limit)
        print(f"Top operators: {len(operators)}")
        for op in operators:
            print(f"  - {op['operator_name']} ({op['n']} facilities)")

        production_facilities = get_production_facilities(conn)

        total_claims = 0
        for i, operator in enumerate(operators, 1):
            print(f"\n[{i}/{len(operators)}]", end="")
            try:
                claims = process_operator(conn, client, operator, production_facilities, run_id)
                total_claims += claims
            except RuntimeError as e:
                if "BUDGET" in str(e):
                    print(f"STOPPING: {e}")
                    break
                print(f"  Operator error: {e}")
                continue

    print(f"\n=== Pilot 3 Complete ===")
    print(f"Total claim records: {total_claims}")
    print(f"Total spend: ${current_spend_usd():.3f}")


if __name__ == "__main__":
    main()
