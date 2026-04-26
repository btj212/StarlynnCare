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
# Scale model: tour-questions only (fast + cheap)
CONTENT_MODEL = "claude-haiku-4-5-20251001"
QUALITY_GATE_MODEL = "claude-haiku-4-5-20251001"

# ---------------------------------------------------------------------------
# Hand-written gold-standard seed for Silverado Berkeley
# (never overwritten by the AI chain)
# ---------------------------------------------------------------------------
SILVERADO_BERKELEY_SLUG = "silverado-senior-living-berkeley-200938"

SILVERADO_SEED_CONTENT: dict = {
    "tour_questions": [
        "The April 2024 inspection cited a delay in annual medical reassessments under "
        "§87705(c)(5) — what is the current process for ensuring care plans are reviewed "
        "on schedule, and who is responsible for tracking deadlines?",
        "Six complaints were filed with CDSS during the inspection period on file — what "
        "were the subjects of those complaints, and which were substantiated?",
        "California Title 22 §87705 requires dementia-specific staff training — how do you "
        "verify that all staff who interact with residents have completed the required "
        "training, including overnight and weekend staff?",
        "What is the staff-to-resident ratio on evening and weekend shifts, and how does "
        "staffing change when a primary caregiver calls out sick?",
        "What is the process for notifying families within 24 hours when a resident's "
        "condition, medication, or care plan changes between scheduled reviews?",
    ],
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
             WHERE i.facility_id = f.id AND COALESCE(d.severity,0) >= 3)
                AS serious_citation_count,
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
        query += " AND LOWER(f.name) LIKE LOWER(%(name_filter)s)"
        params = {"name_filter": f"%{name_filter}%"}
    else:
        params = {}
    query += " ORDER BY f.city, f.name"

    with conn.cursor() as cur:
        cur.execute(query, params)
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
You generate tour questions for StarlynnCare — a consumer health-information site built from
California CDSS public licensing and inspection data.

Write for families researching memory care. Plain English. No jargon. No marketing language.

Tour questions rules (critical — violations will fail the quality gate):
- Generate 4-5 questions. Prefer exactly 4 unless 5 naturally follows from distinct facts
  in the source data. NEVER write a 5th question just to reach a higher count — it will
  always come out generic and fail the quality gate. Stop at 4 if you have used all the
  specific facts available.
- Each question MUST reference at least one concrete fact from the source data — a specific
  Title 22 section cited, a substantiated complaint, the number of serious citations,
  inspection recency, bed count, operator name, or memory-care designation.
- NO generic questions. Every question must only make sense for THIS specific facility. A
  question that could apply to any facility will fail the quality gate.
- Order by urgency: serious citations first, then substantiated complaints, then recent
  deficiencies, then operational gaps, then strengths-verification questions last.
- Each question is a single sentence ending in "?". No preamble, no follow-up sub-bullets.
- If the facility has zero deficiencies and zero complaints, generate 4 questions that probe
  the state of compliance and care practices — still grounded in source data
  (e.g., license status, beds, memory-care designation, inspection recency).
- Do NOT end any question with "before making a placement decision" or similar generic closes.
- Do NOT reference the LIC 809 form, the LIC 810 form, or any state form by number.
- Do NOT generate a question about family notification or communication protocols
  unless there is a specific complaint in the data explicitly related to a communication
  failure. A generic "how do you notify families" question will fail the quality gate.
- Do NOT generate a question about fall management or fall prevention unless there is
  a specific deficiency or complaint about falls in the source data.
- Do NOT generate ANY question about staffing ratios, staff counts, number of caregivers,
  overnight coverage, supervisor availability, or caregiver-to-resident ratios. These topics
  require staffing data that is never in state inspection records. This ban is absolute —
  not even "how do you handle staffing if a caregiver is sick?" is acceptable.
- Do NOT generate a question about care plan updates, care plan reviews, or supervision
  continuity unless such a topic is specifically cited in the deficiency or complaint data.
"""

GENERATION_HUMAN_TEMPLATE = """\
Generate tour questions for the following facility. Return ONLY valid JSON with these exact keys:
tour_questions, generated_at, model.

tour_questions must be a JSON array of 4-5 strings (questions), not a prose paragraph.

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
  Serious citations      : {serious_citation_count}  (severity 3–4)
  Dementia-care citations: {dementia_citation_count}  (§87705 or §87706)
  Complaints on file     : {complaint_count}
  Most recent inspection : {last_inspection_date}  ← CRITICAL: use this EXACT date. Do NOT change the year. Today is {today}.

GOLD-STANDARD EXAMPLE (Silverado Berkeley — do not reproduce directly, use as style/tone guide)
-----------------------------------------------------------------------------------------------
{example_json}
-----------------------------------------------------------------------------------------------

Now generate the content block for {name}. Output JSON only, no markdown fences.
"""

QUALITY_GATE_SYSTEM = f"""\
You are a fact-checker for StarlynnCare. Today's date is {datetime.now(timezone.utc).strftime("%B %d, %Y")}.
Your task is to review a generated tour_questions block and flag any claims that:
  1. Are factually inconsistent with the source data provided.
  2. Are promotional, unverifiable, or misleading.
  3. Violate StarlynnCare's honesty rules (no made-up citations, no pricing,
     no staffing ratios, no staffing coverage questions, no superlatives).
  4. Reference form numbers (LIC 809, LIC 810, etc.).

Additionally, validate the tour_questions array:
  5. Each question must reference at least one concrete fact from the source data
     (a specific Title 22 section, a serious citation count, a complaint count, inspection
     date, bed count, operator name, or memory-care designation). Flag any question
     that could apply to any facility without modification.
  6. Each question must end in "?".
  7. There must be between 4 and 5 questions.
  8. No question may close with "before making a placement decision" or similar generic phrases.

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


def _format_operator(raw: str | None) -> str:
    """Convert 'Last, First' DB format to 'First Last' for readable prompts."""
    if not raw:
        return "(not in data)"
    # If it looks like "Last, First Middle" flip it; otherwise return as-is
    if "," in raw:
        parts = [p.strip() for p in raw.split(",", 1)]
        if len(parts) == 2 and parts[1]:
            return f"{parts[1]} {parts[0]}"
    return raw


def build_source_context(fac: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": fac["name"],
        "street": fac["street"] or "(not in data)",
        "city": fac["city"] or "",
        "zip": fac["zip"] or "",
        "phone": fac["phone"] or "(not in data)",
        "beds": fac["beds"] or "(not in data)",
        "operator": _format_operator(fac["operator_name"]),
        "license_number": fac["license_number"] or "(not in data)",
        "license_status": fac["license_status"] or "(not in data)",
        "license_expiration": fac["license_expiration"] or "(not in data)",
        "serves_mc": "Yes" if fac.get("care_category") == "rcfe_memory_care" else "No",
        "mc_designation": fac["memory_care_designation"] or "(none — memory care is operator-advertised, not formally designated in CDSS licensing data)",
        "inspection_count": fac["inspection_count"],
        "deficiency_count": fac["deficiency_count"],
        "serious_citation_count": fac["serious_citation_count"],
        "dementia_citation_count": fac["dementia_citation_count"],
        "complaint_count": fac["complaint_count"],
        "last_inspection_date": fac["last_inspection_date"] or "(none on record)",
        "today": datetime.now(timezone.utc).strftime("%B %d, %Y"),
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
            max_tokens=1024,
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
            tqs = content.get("tour_questions", [])
            print(f"  tour_questions ({len(tqs)}):")
            for q in tqs:
                print(f"    - {q[:100]}…" if len(q) > 100 else f"    - {q}")
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
