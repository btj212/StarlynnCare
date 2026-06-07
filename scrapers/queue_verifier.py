#!/usr/bin/env python3
"""
For each facility in mc_review_status='needs_review', run a lightweight verification pass:

1. firecrawl search (limit 1)
2. firecrawl scrape top URL → markdown
3. Sonnet JSON verdict: mc_yes | mc_no | uncertain + evidence snippet + confidence

Writes rows to mc_queue_evidence (does NOT change mc_review_status).

Usage:
  python queue_verifier.py --dry-run
  python queue_verifier.py --limit 10
  python queue_verifier.py
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

import anthropic
import psycopg
from dotenv import load_dotenv

from firecrawl_markdown import parse_json_from_llm, scrape_url_to_markdown

REPO_ROOT = Path(__file__).resolve().parent.parent
# Sonnet: site-level judgment for queue triage (bulk extraction uses Haiku elsewhere).
MODEL = "claude-sonnet-4-5"

VERDICT_SYSTEM = """You help verify whether a California RCFE offers memory care (dementia / Alzheimer's / secured memory care unit).

You receive:
- Facility metadata from the state license roster (name, city, address).
- Markdown from a web page found by search (may be wrong site).

Reply with ONE JSON object only (no markdown fences):
{
  "verdict": "mc_yes" | "mc_no" | "uncertain",
  "confidence": 0.0,
  "evidence_snippet": "1-3 short sentences quoting or paraphrasing only what the page states."
}

Rules:
- mc_yes only if the page clearly indicates this location offers memory care, dementia care, Alzheimer's care, reminiscence, memory support unit, or similar for this site.
- mc_no if the page is clearly about a different business, state, only independent living, or explicitly says no memory care.
- uncertain if the page is generic, wrong facility, or insufficient information.
- Never invent services not supported by the snippet."""


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def _first_http_url(obj: Any) -> str | None:
    """Recursively find first http(s) URL string in nested dict/list JSON."""
    if isinstance(obj, dict):
        for k in ("url", "link", "href"):
            v = obj.get(k)
            if isinstance(v, str) and v.startswith("http"):
                return v
        for v in obj.values():
            found = _first_http_url(v)
            if found:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _first_http_url(item)
            if found:
                return found
    elif isinstance(obj, str) and obj.startswith("http"):
        return obj
    return None


def run_search_top_url(query: str, out_json: Path) -> str | None:
    """Return first result URL from firecrawl search JSON, or None."""
    out_json.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "firecrawl",
        "search",
        query,
        "--limit",
        "1",
        "--json",
        "-o",
        str(out_json),
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        data = None
        if out_json.exists():
            try:
                data = json.loads(out_json.read_text())
            except json.JSONDecodeError:
                data = None
        if data is None and r.stdout.strip():
            try:
                data = json.loads(r.stdout)
            except json.JSONDecodeError:
                pass
        if data is None:
            return None
        # Shape may vary — try common paths then recurse
        if "data" in data:
            d = data["data"]
            if isinstance(d, list) and d and isinstance(d[0], dict):
                u = d[0].get("url") or d[0].get("link")
                if u:
                    return u
            if isinstance(d, dict) and "results" in d:
                res = d["results"]
                if isinstance(res, list) and res:
                    u = res[0].get("url") or res[0].get("link")
                    if u:
                        return u
        if "results" in data and data["results"]:
            u = data["results"][0].get("url") or data["results"][0].get("link")
            if u:
                return u
        return _first_http_url(data)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, OSError):
        return None


def judge_page(
    facility_name: str,
    city: str,
    street: str | None,
    markdown: str,
    page_url: str,
) -> dict[str, Any]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    client = anthropic.Anthropic(api_key=api_key)
    clip = markdown[:120000]
    user = (
        f"Facility (CDSS): {facility_name}\n"
        f"City: {city}\n"
        f"Street: {street or '(unknown)'}\n\n"
        f"Page URL: {page_url}\n\n"
        f"--- PAGE MARKDOWN ---\n{clip}"
    )
    msg = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=VERDICT_SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    block = msg.content[0]
    if block.type != "text":
        raise RuntimeError("unexpected block")
    return parse_json_from_llm(block.text)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    load_env()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL required", file=sys.stderr)
        sys.exit(1)

    sql = """
            SELECT id::text, name, city, street
            FROM facilities
            WHERE state_code = 'CA'
              AND license_status = 'LICENSED'
              AND mc_review_status = 'needs_review'
            ORDER BY name
            """
    params: list[Any] = []
    if args.limit:
        sql += " LIMIT %s"
        params.append(args.limit)

    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    print(f"Queue facilities to verify: {len(rows)}")
    processed = 0
    for fid, name, city, street in rows:
        query = f'"{name}" {city} California memory care assisted living'
        search_out = Path(f".firecrawl/queue-verify/search-{fid[:8]}.json")
        url = run_search_top_url(query, search_out)
        if not url:
            print(f"[skip] no search URL: {name}")
            continue

        md_path = Path(f".firecrawl/queue-verify/page-{fid[:8]}.md")
        md = scrape_url_to_markdown(url, md_path, wait_ms=5000)
        if not md:
            print(f"[skip] empty scrape: {name}")
            continue

        try:
            verdict_json = judge_page(name, city or "", street, md, url)
        except Exception as e:
            print(f"[error] LLM {name}: {e}")
            continue

        verdict = verdict_json.get("verdict", "uncertain")
        if verdict not in ("mc_yes", "mc_no", "uncertain"):
            verdict = "uncertain"
        conf = verdict_json.get("confidence")
        try:
            conf_f = float(conf) if conf is not None else None
        except (TypeError, ValueError):
            conf_f = None
        snippet = (verdict_json.get("evidence_snippet") or "")[:4000]

        print(f"{verdict:12} {conf_f} | {name[:50]}")

        if args.dry_run:
            processed += 1
            continue

        with psycopg.connect(dsn) as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO mc_queue_evidence
                  (facility_id, search_query, source_url, evidence_snippet, verdict, confidence, model)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (fid, query, url, snippet, verdict, conf_f, MODEL),
            )
            conn.commit()
        processed += 1

    print(f"Done. Processed {processed}.")


if __name__ == "__main__":
    main()
