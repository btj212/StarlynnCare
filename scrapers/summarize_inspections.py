#!/usr/bin/env python3
"""
summarize_inspections.py — Generate plain-English summaries for CDSS inspection
narratives using Anthropic Claude.

Each inspection report narrative is dense bureaucratic prose ("LPA arrived
unannounced … Title 22 §87705(c)(2) …"). This script turns them into 2-3
sentence plain-English summaries that families can read at a glance, stored in
inspections.narrative_summary.

Usage:
    python summarize_inspections.py                 # process all unsummarized
    python summarize_inspections.py --smoke         # first 3 records only
    python summarize_inspections.py --dry-run       # print output, no DB writes
    python summarize_inspections.py --refetch       # re-generate existing summaries
    python summarize_inspections.py --facility-id X # one facility only

Requires:
    ANTHROPIC_API_KEY in .env.local
    DATABASE_URL in .env.local
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from datetime import date

import anthropic
import psycopg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

MODEL = "claude-haiku-4-5-20251001"  # fast + cheap for summarization
TODAY = date.today().strftime("%B %d, %Y")

# ---------------------------------------------------------------------------
# Page-number strip (mirrors the UI-side fix)
# ---------------------------------------------------------------------------
PAGE_NUM_RE = re.compile(r"^(\d+\s+)+")
CONTINUES_RE = re.compile(r"^\*\*\*report continues from LIC9099\*\*\*\s*", re.IGNORECASE)
BOILERPLATE_RE = re.compile(
    r"^(Facility Type:.*?(?=\n\n|\Z)|"
    r"COMP II by CAB.*?(?=\n\n|\Z))",
    re.DOTALL | re.IGNORECASE,
)


def clean_narrative(raw: str) -> str:
    text = PAGE_NUM_RE.sub("", raw)
    text = CONTINUES_RE.sub("", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = f"""You summarize California CDSS inspection and complaint reports for a senior care
transparency website. Today is {TODAY}.

Your summaries are read by families researching memory care facilities — write for them, not for
regulators. Use plain English. Avoid jargon, acronyms (LPA, RCFE, ADL, etc.), and regulatory
citation numbers unless they are the key fact.

Rules:
1. Write exactly 2-3 sentences. No bullet points. No headers.
2. State what kind of visit it was (routine inspection, complaint investigation, follow-up, etc.)
   if clear from the text.
3. State what was found — or, for unsubstantiated complaints, clearly say no violation was found.
4. If a death, serious injury, or substantiated harm is described, say so plainly. Do not soften it.
5. Do NOT invent facts not in the source text.
6. Do NOT name specific residents (R1, R2), staff (S1, S2), or inspector names.
7. Do NOT use phrases like "the report states" or "according to the document". Just state the facts.
8. Dates that appear to be in 2025 or 2026 are real — do not flag them as future events."""

USER_TEMPLATE = """Inspection type: {inspection_type}
Is complaint: {is_complaint}
Outcome (if complaint): {outcome}

Narrative:
{narrative}

Write a 2-3 sentence plain-English summary for families."""


# ---------------------------------------------------------------------------
# Claude call
# ---------------------------------------------------------------------------


def summarize(
    client: anthropic.Anthropic,
    inspection_type: str,
    is_complaint: bool,
    outcome: str | None,
    narrative: str,
) -> str | None:
    user_msg = USER_TEMPLATE.format(
        inspection_type=inspection_type or "visit",
        is_complaint="Yes" if is_complaint else "No",
        outcome=outcome or "N/A",
        narrative=narrative[:6000],  # stay well within context
    )
    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=300,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )
        return resp.content[0].text.strip()
    except Exception as e:
        print(f"    Claude error: {e}")
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="Process first 3 records only")
    parser.add_argument("--dry-run", action="store_true", help="Print summaries, no DB writes")
    parser.add_argument("--refetch", action="store_true", help="Re-generate existing summaries")
    parser.add_argument("--facility-id", help="Only process inspections for this facility UUID")
    args = parser.parse_args()

    if not ANTHROPIC_API_KEY and not args.dry_run:
        print("ERROR: ANTHROPIC_API_KEY not set in .env.local")
        sys.exit(1)
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if not args.dry_run else None

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            where_parts = [
                "raw_data->>'narrative' IS NOT NULL",
                "raw_data->>'narrative' != ''",
            ]
            params: list = []

            if not args.refetch:
                where_parts.append("narrative_summary IS NULL")
            if args.facility_id:
                where_parts.append("facility_id = %s")
                params.append(args.facility_id)

            where_clause = " AND ".join(where_parts)
            cur.execute(
                f"""
                SELECT i.id, i.inspection_type, i.is_complaint,
                       i.raw_data->>'outcome', i.raw_data->>'narrative',
                       f.name
                FROM inspections i
                JOIN facilities f ON f.id = i.facility_id
                WHERE {where_clause}
                ORDER BY f.name, i.inspection_date DESC
                """,
                params,
            )
            rows = cur.fetchall()

    print(f"Records to summarize: {len(rows)}")
    if not rows:
        print("Nothing to do.")
        return

    processed = 0
    succeeded = 0
    failed = 0

    with psycopg.connect(DATABASE_URL) as conn:
        for insp_id, insp_type, is_complaint, outcome, raw_narrative, fac_name in rows:
            print(f"\n→ {fac_name[:45]} | {insp_type} | {'complaint' if is_complaint else 'routine'}")

            narrative = clean_narrative(raw_narrative)
            if not narrative:
                print("  — Empty after cleaning, skipping")
                processed += 1
                if args.smoke and processed >= 3:
                    break
                continue

            if args.dry_run:
                print(f"  [dry-run] Narrative ({len(narrative)} chars): {narrative[:150]}…")
                processed += 1
                if args.smoke and processed >= 3:
                    break
                continue

            summary = summarize(client, insp_type or "visit", is_complaint, outcome, narrative)
            if not summary:
                print("  ✗ Summary generation failed")
                failed += 1
                processed += 1
                if args.smoke and processed >= 3:
                    break
                time.sleep(0.5)
                continue

            print(f"  ✓ {summary[:120]}{'…' if len(summary) > 120 else ''}")

            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE inspections SET narrative_summary = %s WHERE id = %s",
                    (summary, insp_id),
                )
                conn.commit()

            succeeded += 1
            processed += 1

            if args.smoke and processed >= 3:
                print("\n[smoke] Stopping after 3 records.")
                break

            time.sleep(0.15)  # stay well under rate limit

    print(f"\nDone. {succeeded} summarized, {failed} failed, {processed} processed.")


if __name__ == "__main__":
    main()
