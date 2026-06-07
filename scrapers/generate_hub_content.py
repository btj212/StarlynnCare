#!/usr/bin/env python3
"""
AI content generation chain for StarlynnCare city/county HUB pages.

For each region (state + city_slug) with enough publishable facilities this
script:
  1. Loads region-level aggregate stats from the DB (the only numbers the
     prose is allowed to cite).
  2. Calls Claude to draft an editorial intro/body as constrained HTML, with
     every data-derived number wrapped in <span data-stat="KEY">VALUE</span>.
  3. Verifies those stat tokens deterministically against the snapshot
     (plain code — no model needed for numbers; CLAUDE.md Rule 5).
  4. Runs an LLM quality gate (tone / no fabrication / no staffing claims).
  5. If both gates pass, writes a DRAFT row to hub_content.

Nothing is published here. A human reviews + approves drafts in
/admin/hub-content (TipTap), and the post-ingest drift audit
(scripts/validate/hub_content_drift_check.py) re-verifies the snapshot
against the DB on every ingest.

NOTE: this uses psycopg over DATABASE_URL (raw Postgres), so — like every
other scraper in this repo — it runs from Cursor or GitHub Actions, NOT from
Claude Code on the web (the web sandbox proxies HTTP/HTTPS only).

Usage
-----
  python generate_hub_content.py --state CA                 # all eligible CA cities
  python generate_hub_content.py --state CA --dry-run       # print, no DB writes
  python generate_hub_content.py --state CA --smoke         # first city only
  python generate_hub_content.py --state CA --city-slug oakland
  python generate_hub_content.py --state CA --min-facilities 5
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import anthropic
import psycopg
from bs4 import BeautifulSoup
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STATE = "CA"
DEFAULT_MIN_FACILITIES = 3
CONTENT_MODEL = "claude-sonnet-4-5"
QUALITY_GATE_MODEL = "claude-haiku-4-5-20251001"

# Numeric metrics the prose may cite. Keys are the allowed data-stat tokens.
STAT_KEYS = (
    "facility_count",
    "facilities_with_serious",
    "pct_with_serious",
    "total_beds",
)


# ---------------------------------------------------------------------------
# Env + DB helpers
# ---------------------------------------------------------------------------


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def load_regions(
    conn: psycopg.Connection,
    *,
    state_code: str,
    city_slugs: list[str] | None,
    min_facilities: int,
) -> list[dict[str, Any]]:
    """Return one row per eligible city_slug with its display name + facility count."""
    query = """
        SELECT f.city_slug, MIN(f.city) AS city, COUNT(*)::int AS facility_count
        FROM facilities f
        WHERE f.state_code = %(state)s
          AND f.publishable = true
          AND f.city_slug IS NOT NULL
    """
    params: dict[str, Any] = {"state": state_code.upper()}
    if city_slugs:
        query += " AND f.city_slug = ANY(%(city_slugs)s)"
        params["city_slugs"] = city_slugs
    query += """
        GROUP BY f.city_slug
        HAVING COUNT(*) >= %(min_fac)s
        ORDER BY COUNT(*) DESC, f.city_slug
    """
    params["min_fac"] = min_facilities
    with conn.cursor() as cur:
        cur.execute(query, params)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def compute_stats(
    conn: psycopg.Connection, *, state_code: str, city_slug: str
) -> dict[str, Any]:
    """Aggregate the region's grounded numbers. These — and only these — may appear in prose."""
    query = """
        WITH fac AS (
            SELECT f.id, f.beds
            FROM facilities f
            WHERE f.state_code = %(state)s
              AND f.city_slug = %(city)s
              AND f.publishable = true
        ),
        sev AS (
            SELECT i.facility_id,
                   COUNT(*) FILTER (WHERE COALESCE(d.severity, 0) >= 3) AS serious
            FROM inspections i
            JOIN deficiencies d ON d.inspection_id = i.id
            WHERE i.facility_id IN (SELECT id FROM fac)
            GROUP BY i.facility_id
        )
        SELECT
            (SELECT COUNT(*)::int FROM fac)                                  AS facility_count,
            (SELECT COUNT(*)::int FROM sev WHERE serious > 0)                AS facilities_with_serious,
            (SELECT COALESCE(SUM(f.beds), 0)::int FROM fac f)                AS total_beds,
            (SELECT MAX(i.inspection_date)::text
               FROM inspections i
               WHERE i.facility_id IN (SELECT id FROM fac)
                 AND NOT i.is_complaint)                                     AS last_inspection_date
    """
    with conn.cursor() as cur:
        cur.execute(query, {"state": state_code.upper(), "city": city_slug})
        row = dict(zip([d[0] for d in cur.description], cur.fetchone()))

    fc = row["facility_count"] or 0
    ws = row["facilities_with_serious"] or 0
    snapshot: dict[str, Any] = {
        "facility_count": fc,
        "facilities_with_serious": ws,
        "pct_with_serious": round(100 * ws / fc) if fc else 0,
        "total_beds": row["total_beds"] or 0,
        # Non-numeric context (not a data-stat token; allowed in prose as a date).
        "last_inspection_date": row["last_inspection_date"] or "(none on record)",
    }
    return snapshot


def save_draft(
    conn: psycopg.Connection,
    *,
    state_code: str,
    region_slug: str,
    region_kind: str,
    title: str | None,
    body_html: str,
    stats_snapshot: dict[str, Any],
    model: str,
) -> None:
    """Insert/refresh a DRAFT row. Never clobbers an in_review/published row (caller gates that)."""
    with conn.cursor() as cur:
        cur.execute("SAVEPOINT sp")
        try:
            cur.execute(
                """
                INSERT INTO hub_content
                    (state_code, region_slug, region_kind, title, body_html,
                     stats_snapshot, status, model, generated_at, updated_at)
                VALUES
                    (%(state)s, %(slug)s, %(kind)s, %(title)s, %(body)s,
                     %(snap)s, 'draft', %(model)s, now(), now())
                ON CONFLICT (state_code, region_slug) DO UPDATE SET
                    region_kind   = EXCLUDED.region_kind,
                    title         = EXCLUDED.title,
                    body_html     = EXCLUDED.body_html,
                    stats_snapshot = EXCLUDED.stats_snapshot,
                    status        = 'draft',
                    drift_detected = false,
                    drift_details = NULL,
                    model         = EXCLUDED.model,
                    generated_at  = now(),
                    updated_at    = now()
                """,
                {
                    "state": state_code.upper(),
                    "slug": region_slug,
                    "kind": region_kind,
                    "title": title,
                    "body": body_html,
                    "snap": psycopg.types.json.Jsonb(stats_snapshot),
                    "model": model,
                },
            )
            cur.execute("RELEASE SAVEPOINT sp")
        except Exception:
            cur.execute("ROLLBACK TO SAVEPOINT sp")
            raise
    conn.commit()


def existing_status(
    conn: psycopg.Connection, *, state_code: str, region_slug: str
) -> str | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT status FROM hub_content WHERE state_code = %s AND region_slug = %s",
            (state_code.upper(), region_slug),
        )
        row = cur.fetchone()
        return row[0] if row else None


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

GENERATION_SYSTEM = """\
You write the editorial intro for a StarlynnCare CITY hub page — the page a
family lands on when searching "memory care <city>". StarlynnCare is an
inspection-data directory: independent, no paid placement, every claim traceable
to a state regulator.

Voice: upscale, editorial, plain English. No marketing language. No hype. No
superlatives ("best", "top-rated"). Let the data speak.

HARD RULES — this is a YMYL (Your Money or Your Life) page:
- You may ONLY cite numbers that appear in the SNAPSHOT below. Invent nothing.
- Wrap EVERY snapshot number in <span data-stat="KEY">VALUE</span> using the
  exact KEY from the snapshot (e.g. <span data-stat="facility_count">93</span>).
  Numbers NOT from the snapshot (a year, a regulatory code) must NOT be wrapped
  and should be avoided unless clearly non-data context.
- Do NOT state a quality grade, ranking, star rating, or "X% are good/bad".
- Do NOT mention staffing ratios, caregiver counts, or coverage.
- Do NOT invent cost or pricing figures.

Output: JSON only (no markdown fences) with keys:
  title       — short page title fragment, e.g. "Memory care in Oakland"
  body_html   — 2-3 short <p> paragraphs of constrained HTML (<p>, <strong>,
                <em>, <a>; stat <span>s as specified). ~120-180 words.
  generated_at, model — leave as empty strings; the script fills them.
"""

GENERATION_HUMAN_TEMPLATE = """\
Write the city-hub intro for {city}, {state}.

SNAPSHOT (the only numbers you may cite; wrap each in a data-stat span)
----------------------------------------------------------------------
facility_count            : {facility_count}   (publishable memory-care facilities indexed here)
facilities_with_serious   : {facilities_with_serious}   (facilities with >=1 serious, severity 3-4, citation)
pct_with_serious          : {pct_with_serious}   (percent of indexed facilities with a serious citation; write as {pct_with_serious}%)
total_beds                : {total_beds}   (combined licensed beds)
last_inspection_date      : {last_inspection_date}   (most recent routine inspection on record; a date, not a data-stat span)

Write 2-3 paragraphs that orient a family to this city's memory-care landscape
using ONLY these numbers, then point them to compare inspection histories below.
Output JSON only.
"""

QUALITY_GATE_SYSTEM = f"""\
You are a quality checker for a StarlynnCare city-hub editorial intro.
Today: {datetime.now(timezone.utc).strftime("%B %d, %Y")}.

Return JSON only: {{"pass": true/false, "issues": ["one sentence per issue"]}}.

FAIL (pass=false) if the body:
  1. States any number that is NOT in the snapshot, or misstates a snapshot value.
  2. Asserts a quality grade, ranking, star rating, or "best/top-rated" superlative.
  3. Mentions staffing ratios, caregiver counts, or coverage.
  4. Invents a cost or price figure.
  5. Reads as marketing copy rather than neutral, data-grounded editorial.
  6. Makes a claim about a specific named facility (city-level only here).

PASS neutral, data-grounded prose that cites only snapshot numbers and points
families to compare inspection histories.

Output the JSON object ONLY — no markdown fences.
"""

QUALITY_GATE_HUMAN_TEMPLATE = """\
SNAPSHOT:
{snapshot_json}

GENERATED BODY (HTML):
{body_html}

Does this pass the StarlynnCare city-hub quality gate? Reply with JSON only.
"""


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
    if raw.endswith("```"):
        raw = "\n".join(raw.split("\n")[:-1])
    return raw.strip()


def generate(
    client: anthropic.Anthropic, region: dict[str, Any], snapshot: dict[str, Any]
) -> dict[str, str] | None:
    ctx = {
        "city": region["city"] or region["city_slug"],
        "state": region["state_code"],
        **{k: snapshot.get(k) for k in STAT_KEYS},
        "last_inspection_date": snapshot["last_inspection_date"],
    }
    prompt = GENERATION_HUMAN_TEMPLATE.format(**ctx)
    try:
        msg = client.messages.create(
            model=CONTENT_MODEL,
            max_tokens=1024,
            system=GENERATION_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        content = json.loads(_strip_fences(msg.content[0].text))
        content["generated_at"] = datetime.now(timezone.utc).isoformat()
        content["model"] = CONTENT_MODEL
        return content
    except Exception as e:  # noqa: BLE001 — fail loud, skip this region
        print(f"    Generation error: {e}", flush=True)
        return None


def verify_stats(body_html: str, snapshot: dict[str, Any]) -> list[str]:
    """Deterministic numeric gate: every data-stat span must match the snapshot. Plain code, no model."""
    issues: list[str] = []
    soup = BeautifulSoup(body_html, "html.parser")
    spans = soup.find_all("span", attrs={"data-stat": True})
    seen: set[str] = set()
    for span in spans:
        key = span.get("data-stat")
        seen.add(key)
        if key not in STAT_KEYS:
            issues.append(f"Unknown data-stat key '{key}'.")
            continue
        shown = re.sub(r"[,%\s]", "", span.get_text())
        expected = str(snapshot.get(key))
        if shown != expected:
            issues.append(
                f"data-stat '{key}' shows '{span.get_text().strip()}' but snapshot says '{expected}'."
            )
    if "facility_count" not in seen:
        issues.append("Body does not cite facility_count (must ground in the facility total).")
    return issues


def quality_gate(
    client: anthropic.Anthropic, body_html: str, snapshot: dict[str, Any]
) -> tuple[bool, list[str]]:
    snap_for_gate = {k: snapshot[k] for k in snapshot if k != "model"}
    prompt = QUALITY_GATE_HUMAN_TEMPLATE.format(
        snapshot_json=json.dumps(snap_for_gate, indent=2), body_html=body_html
    )
    try:
        msg = client.messages.create(
            model=QUALITY_GATE_MODEL,
            max_tokens=512,
            system=QUALITY_GATE_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        decoder = json.JSONDecoder()
        result, _ = decoder.raw_decode(_strip_fences(msg.content[0].text).lstrip())
        return bool(result.get("pass", False)), result.get("issues", [])
    except Exception as e:  # noqa: BLE001
        print(f"    Quality gate error: {e}", flush=True)
        return False, [f"Quality gate exception: {e}"]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate draft city-hub content")
    parser.add_argument("--state", default=DEFAULT_STATE, help="State code (default: CA)")
    parser.add_argument("--city-slug", dest="city_slugs", action="append", default=None,
                        help="Limit to this city_slug (repeat for multiple).")
    parser.add_argument("--min-facilities", type=int, default=DEFAULT_MIN_FACILITIES,
                        help=f"Min publishable facilities for a city to qualify (default: {DEFAULT_MIN_FACILITIES}).")
    parser.add_argument("--dry-run", action="store_true", help="Print, no DB writes.")
    parser.add_argument("--smoke", action="store_true", help="First eligible city only.")
    parser.add_argument("--force", action="store_true",
                        help="Regenerate even if a draft exists (never touches in_review/published unless combined with care).")
    parser.add_argument("--skip-quality-gate", action="store_true",
                        help="Skip the LLM quality gate (the deterministic numeric check still runs).")
    args = parser.parse_args()

    load_env()
    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)
    if not args.dry_run and not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set.", file=sys.stderr)
        sys.exit(1)

    dsn = os.environ["DATABASE_URL"]
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", "placeholder"))

    with psycopg.connect(dsn) as conn:
        regions = load_regions(
            conn,
            state_code=args.state,
            city_slugs=args.city_slugs,
            min_facilities=args.min_facilities,
        )
    for r in regions:
        r["state_code"] = args.state.upper()

    if args.smoke:
        regions = regions[:1]
    print(f"Eligible cities: {len(regions)}", flush=True)
    if args.dry_run:
        print("(DRY RUN — no DB writes)\n", flush=True)

    stats = {"written": 0, "skipped": 0, "failed_gate": 0, "errors": 0}

    for i, region in enumerate(regions, 1):
        slug = region["city_slug"]
        print(f"\n[{i}/{len(regions)}] {region['city']} ({slug}) — {region['facility_count']} facilities", flush=True)

        # Protect human-touched rows.
        if not args.dry_run:
            with psycopg.connect(dsn) as conn:
                st = existing_status(conn, state_code=args.state, region_slug=slug)
            if st in ("in_review", "published") and not args.force:
                print(f"  → existing row is '{st}'; skipping (use --force to replace with a fresh draft).", flush=True)
                stats["skipped"] += 1
                continue
            if st == "draft" and not args.force:
                print("  → draft already exists; skipping (use --force).", flush=True)
                stats["skipped"] += 1
                continue

        with psycopg.connect(dsn) as conn:
            snapshot = compute_stats(conn, state_code=args.state, city_slug=slug)
        if not snapshot["facility_count"]:
            print("  → no publishable facilities; skipping.", flush=True)
            stats["skipped"] += 1
            continue

        print("  Generating…", flush=True)
        content = generate(client, region, snapshot)
        if not content or not content.get("body_html"):
            stats["errors"] += 1
            continue

        # Deterministic numeric gate (always runs).
        num_issues = verify_stats(content["body_html"], snapshot)
        if num_issues:
            print("  ✗ Numeric check FAILED:", flush=True)
            for iss in num_issues:
                print(f"    - {iss}", flush=True)
            stats["failed_gate"] += 1
            continue

        # LLM quality gate.
        if args.skip_quality_gate:
            passed, issues = True, []
        else:
            print("  Running quality gate…", flush=True)
            passed, issues = quality_gate(client, content["body_html"], snapshot)
        if not passed:
            print("  ✗ Quality gate FAILED:", flush=True)
            for iss in issues:
                print(f"    - {iss}", flush=True)
            stats["failed_gate"] += 1
            continue

        print("  ✓ Gates passed", flush=True)
        if args.dry_run:
            print(f"  title: {content.get('title')}", flush=True)
            print(f"  body_html:\n    {content['body_html']}", flush=True)
            stats["written"] += 1
            continue

        with psycopg.connect(dsn) as conn:
            save_draft(
                conn,
                state_code=args.state,
                region_slug=slug,
                region_kind="city",
                title=content.get("title"),
                body_html=content["body_html"],
                stats_snapshot=snapshot,
                model=content.get("model", CONTENT_MODEL),
            )
        print("  ✓ Draft written", flush=True)
        stats["written"] += 1
        time.sleep(0.5)

    print(f"\n{'='*55}", flush=True)
    print(f"Hub content generation {'(DRY RUN) ' if args.dry_run else ''}complete", flush=True)
    print(f"  Drafts written : {stats['written']}", flush=True)
    print(f"  Skipped        : {stats['skipped']}", flush=True)
    print(f"  Failed gate    : {stats['failed_gate']}", flush=True)
    print(f"  Errors         : {stats['errors']}", flush=True)
    print(f"{'='*55}", flush=True)


if __name__ == "__main__":
    main()
