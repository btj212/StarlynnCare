#!/usr/bin/env python3
"""
AI content generation chain for StarlynnCare facility profiles.

For each publishable facility this script:
  1. Loads the facility + inspection summary from the DB.
  2. Calls Claude to generate a structured content block.
  3. Runs a quality gate (Claude reviews its own output against source data).
  4. If the quality gate passes, writes the content to facilities.content.

The script also embeds a hand-written, human-verified seed for
Silverado Senior Living–Berkeley, which serves as the gold-standard
template for the quality gate and for style calibration.

Usage
-----
  python generate_content.py               # all publishable facilities
  python generate_content.py --dry-run     # print content, no DB writes
  python generate_content.py --smoke       # first facility only
  python generate_content.py --seed-only   # write the Silverado seed only
  python generate_content.py --facility "oakmont of mariner point"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import anthropic
import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "CA"
CONTENT_MODEL = "claude-opus-4-5"
QUALITY_GATE_MODEL = "claude-opus-4-5"

# ---------------------------------------------------------------------------
# Hand-written gold-standard seed for Silverado Berkeley
# (never overwritten by the AI chain)
# ---------------------------------------------------------------------------
SILVERADO_BERKELEY_SLUG = "silverado-senior-living-berkeley-200938"

SILVERADO_SEED_CONTENT: dict[str, str] = {
    "headline": "Dedicated Memory Care in Berkeley's Elmwood District",
    "intro": (
        "Silverado Senior Living–Berkeley is a state-licensed residential care facility "
        "for the elderly (RCFE) at 2235 Sacramento Street in Berkeley's Elmwood neighborhood, "
        "operating as a dedicated memory-care community for adults living with Alzheimer's "
        "disease, Lewy body dementia, frontotemporal dementia, and related conditions. "
        "Licensed for 90 residents, it is one of the few facilities in Alameda County "
        "operated solely for memory care—meaning every staff member, program, and physical "
        "detail is designed around cognitive decline rather than general assisted living."
    ),
    "memory_care_approach": (
        "Silverado operates under what the company calls an Integrated Memory Care (IMC) "
        "philosophy, which prioritizes purposeful activity, family involvement, and a "
        "home-like physical environment. The facility is organized into \"neighborhoods\"—"
        "smaller clusters of rooms that reduce overstimulation and support a consistent "
        "daily routine. Secure outdoor courtyards allow residents to walk freely. "
        "California CDSS evaluators cited Silverado Berkeley under Title 22 §87705(c)(5) "
        "in April 2024 for delayed annual medical reassessments for some residents with "
        "dementia—a Type B citation (potential for harm). The facility corrected the "
        "deficiency; families should ask specifically about how the care-plan reassessment "
        "schedule is managed for their loved one."
    ),
    "neighborhood": (
        "The Sacramento Street address sits at the northern edge of the Elmwood shopping "
        "district, roughly halfway between the UC Berkeley campus and the Rockridge BART "
        "station (about 0.9 miles east). Street parking is generally available on Sacramento "
        "Street and adjacent residential blocks. By car the facility is a short drive from "
        "Highway 13 (Warren Freeway) and Highway 24. The East Bay's mild, year-round climate "
        "makes outdoor family visits on the courtyard comfortable most days."
    ),
    "what_families_should_know": (
        "Between 2021 and 2025, CDSS completed four annual inspections and investigated six "
        "complaints at Silverado Berkeley. The facility accumulated four deficiencies total "
        "across that period—all Type B (potential for harm rather than documented harm)—"
        "including one citation under the dementia-specific care standards (§87705). "
        "No Type A citations (actual harm) were issued. This record is below average for "
        "the county's memory-care facilities, where Type A citations are more common. "
        "StarlynnCare lists only what state records confirm; bed availability, current "
        "staffing ratios, and monthly costs are not in these records—always ask the "
        "facility directly and request a copy of the most recent LIC 809 inspection report "
        "before making a placement decision."
    ),
    "generated_at": "2026-04-19T00:00:00Z",
    "model": "human-authored",
}

# ---------------------------------------------------------------------------
# Env + DB helpers
# ---------------------------------------------------------------------------


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def load_facilities(
    conn: psycopg.Connection,
    name_filter: str | None = None,
) -> list[dict[str, Any]]:
    query = """
        SELECT
            f.id::text,
            f.name,
            f.slug,
            f.city,
            f.city_slug,
            f.street,
            f.zip,
            f.phone,
            f.beds,
            f.operator_name,
            f.license_number,
            f.license_status,
            f.license_expiration::text,
            f.care_category,
            f.memory_care_designation,
            f.content,
            -- Inspection summary subquery
            (SELECT COUNT(*)::int FROM inspections i WHERE i.facility_id = f.id)
                AS inspection_count,
            (SELECT COALESCE(SUM(i.total_deficiency_count),0)::int
             FROM inspections i WHERE i.facility_id = f.id)
                AS deficiency_count,
            (SELECT COUNT(*)::int
             FROM deficiencies d
             JOIN inspections i ON i.id = d.inspection_id
             WHERE i.facility_id = f.id AND d.class = 'Type A')
                AS type_a_count,
            (SELECT COUNT(*)::int
             FROM deficiencies d
             JOIN inspections i ON i.id = d.inspection_id
             WHERE i.facility_id = f.id AND d.code ~ '8770[56]')
                AS dementia_citation_count,
            (SELECT MAX(i.inspection_date)::text
             FROM inspections i
             WHERE i.facility_id = f.id AND NOT i.is_complaint)
                AS last_inspection_date,
            (SELECT COUNT(*)::int
             FROM inspections i WHERE i.facility_id = f.id AND i.is_complaint)
                AS complaint_count
        FROM facilities f
        WHERE f.publishable = true AND f.state_code = 'CA'
    """
    if name_filter:
        query += f" AND LOWER(f.name) LIKE LOWER('%{name_filter}%')"
    query += " ORDER BY f.city, f.name"

    with conn.cursor() as cur:
        cur.execute(query)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def save_content(
    conn: psycopg.Connection,
    facility_id: str,
    content: dict[str, str],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE facilities SET content = %s WHERE id = %s::uuid",
            (psycopg.types.json.Jsonb(content), facility_id),
        )
    conn.commit()


# ---------------------------------------------------------------------------
# Content generation prompt
# ---------------------------------------------------------------------------

GENERATION_SYSTEM = """\
You are the content editor for StarlynnCare, a consumer health-information site
that publishes evidence-based memory-care facility profiles built exclusively from
California CDSS public licensing and inspection data.

Your writing style:
- Honest and understated. Never use promotional superlatives like "best," "award-winning,"
  "top-rated," or "luxury."
- Precise and factual. Every claim must be traceable to the source data you are given.
- Helpful to families in crisis. Address the real anxieties: safety, staff quality,
  inspection history, how to visit, what to ask.
- Plain English. No jargon, no legalese.
- Length targets: headline ≤ 80 chars; each prose field 80-180 words.

Honesty rules (never violate these):
1. Do not invent any fact not present in the source data.
2. If the inspection count or deficiency count is 0, say so—do not imply the absence
   of records is a sign of quality.
3. When describing a citation or deficiency, name the Title 22 section and the
   CDSS severity type (Type A = actual harm; Type B = potential for harm).
4. Do not state or imply pricing, bed availability, staffing ratios, or awards
   unless they appear in the source data (they almost never do).
5. Always close `what_families_should_know` with a sentence encouraging families
   to contact the facility directly and request the most recent LIC 809 report.

Neighborhood section rules (critical — violations will fail the quality gate):
- Only state facts directly supported by the street address and city provided.
- You may say the facility is "in [city]" or "on [street name]" and nothing more geographic.
- Do NOT invent distances to airports, BART stations, highways, landmarks, shopping
  districts, parks, or any other points of interest. Do NOT describe the surrounding
  area with adjectives like "quiet," "suburban," "walkable," "marina," or similar
  unless those exact words appear in the source data.
- You may note that the East Bay generally has mild weather year-round.
- Keep to 2-3 sentences. If you have nothing factual to add beyond city and street, say so plainly.

Additional rules:
- Do NOT make comparative claims ("one of the largest," "among the few," "higher than average")
  unless you have been given explicit comparative data.
- Do NOT speculate or use words like "likely," "probably," "appears to," or "suggests" to
  infer facts not directly in the source data.

Memory care approach section rules (critical — violations will fail the quality gate):
- Do NOT name proprietary care programs (e.g., "Traditions," "Connections," "Reminiscence,"
  "Bridge to Rediscovery," "Clare Bridge," "Vitality"). You do not have source data confirming
  which program this specific facility uses.
- Do NOT describe specific activities, room layouts, secured environments, or staffing models
  unless they appear in the source data.
- DO write about: (1) what an RCFE is in California and that this one is licensed for memory
  care, (2) what California Title 22 requires of RCFEs serving dementia residents generally,
  (3) any specific §87705 or §87706 citations from the inspection data as evidence of the
  facility's regulated dementia-care obligations, (4) the inspection history as a measure
  of compliance. This is enough for a factual, useful paragraph.
"""

GENERATION_HUMAN_TEMPLATE = """\
Generate a StarlynnCare content block for the following facility. Return ONLY valid
JSON with these exact keys: headline, intro, memory_care_approach, neighborhood,
what_families_should_know, generated_at, model.

SOURCE DATA
-----------
Facility name        : {name}
Address              : {street}, {city}, CA {zip}
Phone                : {phone}
Licensed beds        : {beds}
Operator             : {operator}
License number       : {license_number}
License status       : {license_status}
License expires      : {license_expiration}
Memory care flag     : {serves_mc}
Memory care note     : {mc_designation}

Inspection history (from CDSS Transparency API)
  Total reports on file  : {inspection_count}
  Total deficiencies     : {deficiency_count}
  Type A deficiencies    : {type_a_count}  (actual harm citations)
  Dementia-care citations: {dementia_citation_count}  (§87705 or §87706)
  Complaints on file     : {complaint_count}
  Most recent inspection : {last_inspection_date}

GOLD-STANDARD EXAMPLE (Silverado Berkeley — do not reproduce directly, use as style/tone guide)
-----------------------------------------------------------------------------------------------
{example_json}
-----------------------------------------------------------------------------------------------

Now generate the content block for {name}. Output JSON only, no markdown fences.
"""

QUALITY_GATE_SYSTEM = f"""\
You are a fact-checker for StarlynnCare. Today's date is {datetime.now(timezone.utc).strftime("%B %d, %Y")}.
Your task is to review a generated facility content block and flag any claims that:
  1. Are factually inconsistent with the source data provided.
  2. Are promotional, unverifiable, or misleading.
  3. Violate StarlynnCare's honesty rules (no made-up citations, no pricing,
     no staffing ratios not in the data, no superlatives).
  4. Invent geographic details (distances, landmarks, neighborhood descriptions)
     not directly present in the source data — the street address and city are
     the ONLY permitted geographic facts.

Do NOT flag:
- Inspection dates that appear to be in 2025 or 2026. These are real dates from
  California CDSS records; they are not future events.
- The general statement that East Bay cities have mild climates (this is universally true).

Respond with JSON: {{"pass": true/false, "issues": ["list of issues"]}}.
If there are no issues, issues should be an empty list and pass should be true.
"""

QUALITY_GATE_HUMAN_TEMPLATE = """\
SOURCE DATA:
{source_json}

GENERATED CONTENT:
{content_json}

Does the generated content pass the StarlynnCare quality gate? Reply with JSON only.
"""


# ---------------------------------------------------------------------------
# Content chain
# ---------------------------------------------------------------------------


def build_source_context(fac: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": fac["name"],
        "street": fac["street"] or "(not in data)",
        "city": fac["city"] or "",
        "zip": fac["zip"] or "",
        "phone": fac["phone"] or "(not in data)",
        "beds": fac["beds"] or "(not in data)",
        "operator": fac["operator_name"] or "(not in data)",
        "license_number": fac["license_number"] or "(not in data)",
        "license_status": fac["license_status"] or "(not in data)",
        "license_expiration": fac["license_expiration"] or "(not in data)",
        "serves_mc": "Yes" if fac.get("care_category") == "rcfe_memory_care" else "No",
        "mc_designation": fac["memory_care_designation"] or "(none)",
        "inspection_count": fac["inspection_count"],
        "deficiency_count": fac["deficiency_count"],
        "type_a_count": fac["type_a_count"],
        "dementia_citation_count": fac["dementia_citation_count"],
        "complaint_count": fac["complaint_count"],
        "last_inspection_date": fac["last_inspection_date"] or "(none on record)",
        "example_json": json.dumps(SILVERADO_SEED_CONTENT, indent=2),
    }


def generate_content(
    client: anthropic.Anthropic, fac: dict[str, Any]
) -> dict[str, str] | None:
    ctx = build_source_context(fac)
    prompt = GENERATION_HUMAN_TEMPLATE.format(**ctx)

    try:
        msg = client.messages.create(
            model=CONTENT_MODEL,
            max_tokens=2048,
            system=GENERATION_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        # Strip markdown fences if the model included them
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:])
        if raw.endswith("```"):
            raw = "\n".join(raw.split("\n")[:-1])
        content = json.loads(raw)
        content["generated_at"] = datetime.now(timezone.utc).isoformat()
        content["model"] = CONTENT_MODEL
        return content
    except Exception as e:
        print(f"    Generation error: {e}")
        return None


def quality_gate(
    client: anthropic.Anthropic,
    fac: dict[str, Any],
    content: dict[str, str],
) -> tuple[bool, list[str]]:
    source = build_source_context(fac)
    # Remove example_json from source context for the gate (it's only for calibration)
    source.pop("example_json", None)

    prompt = QUALITY_GATE_HUMAN_TEMPLATE.format(
        source_json=json.dumps(source, indent=2),
        content_json=json.dumps(content, indent=2),
    )
    try:
        msg = client.messages.create(
            model=QUALITY_GATE_MODEL,
            max_tokens=512,
            system=QUALITY_GATE_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:])
        if raw.endswith("```"):
            raw = "\n".join(raw.split("\n")[:-1])
        result = json.loads(raw)
        return bool(result.get("pass", False)), result.get("issues", [])
    except Exception as e:
        print(f"    Quality gate error: {e}")
        return False, [f"Quality gate failed with exception: {e}"]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate AI content blocks for publishable facilities"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Print content, no DB writes.")
    parser.add_argument("--smoke", action="store_true",
                        help="Process only the first facility (after Silverado seed).")
    parser.add_argument("--seed-only", action="store_true",
                        help="Write the Silverado hand-written seed and exit.")
    parser.add_argument("--facility", type=str, default=None,
                        help="Process only facilities whose name contains this string.")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite existing content (default: skip if content already set).")
    args = parser.parse_args()

    load_env()

    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    # API key only needed when generating content
    if not args.seed_only and not args.dry_run and not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set. Add it to .env.local.", file=sys.stderr)
        sys.exit(1)

    dsn = os.environ["DATABASE_URL"]
    api_key = os.environ.get("ANTHROPIC_API_KEY", "placeholder")
    client = anthropic.Anthropic(api_key=api_key)

    with psycopg.connect(dsn) as conn:
        facilities = load_facilities(conn, name_filter=args.facility)

    print(f"Facilities loaded: {len(facilities)}")
    if args.dry_run:
        print("(DRY RUN — no DB writes)\n")

    stats = {"written": 0, "skipped": 0, "failed_gate": 0, "errors": 0}

    # ── Always write the Silverado hand-written seed first ───────────────
    silverado = next(
        (f for f in facilities if f["slug"] == SILVERADO_BERKELEY_SLUG), None
    )
    if silverado:
        if silverado.get("content") and not args.force and not args.seed_only:
            print(f"Silverado seed already set; skipping (use --force to overwrite).")
        else:
            if not args.dry_run:
                with psycopg.connect(dsn) as conn:
                    save_content(conn, silverado["id"], SILVERADO_SEED_CONTENT)
            print(f"✓ Silverado Berkeley seed {'(DRY RUN)' if args.dry_run else 'written'}.")
            stats["written"] += 1

    if args.seed_only:
        print("--seed-only: done.")
        return

    # ── Generate for other facilities ────────────────────────────────────
    others = [f for f in facilities if f["slug"] != SILVERADO_BERKELEY_SLUG]
    if args.smoke:
        others = others[:1]

    for i, fac in enumerate(others, 1):
        name = fac["name"]
        print(f"\n[{i}/{len(others)}] {name} ({fac['city']})")

        if fac.get("content") and not args.force:
            print(f"  → content already set; skipping (use --force)")
            stats["skipped"] += 1
            continue

        # Generate
        print("  Generating…")
        content = generate_content(client, fac)
        if not content:
            stats["errors"] += 1
            continue

        # Quality gate
        print("  Running quality gate…")
        passed, issues = quality_gate(client, fac, content)
        if not passed:
            print(f"  ✗ Quality gate FAILED:")
            for iss in issues:
                print(f"    - {iss}")
            stats["failed_gate"] += 1

            if args.dry_run:
                print("  (DRY RUN) Would skip this facility.")
            continue

        print(f"  ✓ Quality gate passed")
        if args.dry_run:
            print(f"  headline: {content.get('headline','')}")
            print(f"  intro (first 120): {content.get('intro','')[:120]}…")
            stats["written"] += 1
            continue

        # Write
        with psycopg.connect(dsn) as conn:
            save_content(conn, fac["id"], content)
        print(f"  ✓ Written to DB")
        stats["written"] += 1

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n{'='*55}")
    print(f"Content generation {'(DRY RUN) ' if args.dry_run else ''}complete")
    print(f"{'='*55}")
    print(f"  Written       : {stats['written']}")
    print(f"  Skipped       : {stats['skipped']} (already had content)")
    print(f"  Failed gate   : {stats['failed_gate']}")
    print(f"  Errors        : {stats['errors']}")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
