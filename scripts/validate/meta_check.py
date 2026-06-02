#!/usr/bin/env python3
"""
Title and meta description validation — length, claim safety, uniqueness.

Usage:
    python3 scripts/validate/meta_check.py --env production
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._html_parse import extract_meta_description, extract_title  # noqa: E402
from validate._lib import check, fetch_page, get_conn, run_all_checks  # noqa: E402

PRODUCTION_URL = "https://www.starlynncare.com"
PUBLISHABLE_STATES = ("CA", "OR", "WA", "MN", "TX")
STATE_SLUG = {
    "CA": "california",
    "OR": "oregon",
    "WA": "washington",
    "MN": "minnesota",
    "TX": "texas",
}

# Unsupported superlatives unless data-backed (script flags; human verifies)
FORBIDDEN_CLAIM_TOKENS = (
    "top-rated",
    "best memory care",
    "#1",
    "0 violations",
)

# Brand suffixes appended by layout/static pages. The ≤60 SERP budget applies to
# the *core* title; the " | StarlynnCare" suffix is conventional and is what Google
# truncates last. Facility/hub titles (buildFacilityTitle) carry no suffix and are
# already ≤60 by construction, so stripping is a no-op for them.
BRAND_SUFFIXES = (" | StarlynnCare", " — StarlynnCare", " | Starlynn Care")
CORE_TITLE_MAX = 60
# Hard ceiling incl. brand suffix — catches genuinely runaway titles.
FULL_TITLE_MAX = 70


def _core_title(title: str) -> str:
    for suffix in BRAND_SUFFIXES:
        if title.endswith(suffix):
            return title[: -len(suffix)].strip()
    return title

STATIC_PATHS = [
    "/",
    "/states",
    "/methodology",
    "/about",
    "/data",
    "/editorial-policy",
    "/library",
    "/research",
    "/california",
    "/texas",
    "/oregon",
    "/washington",
    "/minnesota",
    "/reports/california-rcfe-repeat-citations-2026",
    "/memory-care-vs-assisted-living",
]


def _get_base_url(args: argparse.Namespace) -> str:
    if args.env == "preview":
        if not args.url:
            print("ERROR: --url is required when --env=preview", file=sys.stderr)
            sys.exit(1)
        return args.url.rstrip("/")
    return PRODUCTION_URL


def _sample_urls(base_url: str) -> list[tuple[str, str]]:
    """Return (label, path) pairs."""
    urls: list[tuple[str, str]] = [(p, p) for p in STATIC_PATHS]
    with get_conn() as conn:
        with conn.cursor() as cur:
            for state in PUBLISHABLE_STATES:
                slug = STATE_SLUG[state]
                urls.append((f"/{slug}/facilities", f"/{slug}/facilities"))
                cur.execute(
                    """
                    SELECT city_slug, slug FROM facilities
                    WHERE publishable = true AND state_code = %s
                    ORDER BY random() LIMIT 3
                    """,
                    (state,),
                )
                for r in cur.fetchall():
                    path = f"/{slug}/{r['city_slug']}/{r['slug']}"
                    urls.append((path, path))
                cur.execute(
                    """
                    SELECT city_slug FROM (
                        SELECT DISTINCT city_slug FROM facilities
                        WHERE publishable = true AND state_code = %s
                    ) AS t
                    ORDER BY random() LIMIT 2
                    """,
                    (state,),
                )
                for r in cur.fetchall():
                    path = f"/{slug}/{r['city_slug']}"
                    urls.append((path, path))
    return urls


def _unsupported_claim(meta: str) -> str | None:
    lower = meta.lower()
    for token in FORBIDDEN_CLAIM_TOKENS:
        if token in lower:
            return token
    # "best" alone is too noisy; only flag obvious marketing
    if re.search(r"\bbest\b", lower) and "starlynn" not in lower:
        return "best"
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="StarlynnCare meta validation")
    parser.add_argument("--env", choices=["production", "preview"], default="production")
    parser.add_argument("--url", default=None)
    args = parser.parse_args()
    base_url = _get_base_url(args)

    print("=" * 60)
    print(f"StarlynnCare — Meta validation ({args.env})")
    print(f"Target: {base_url}")
    print("=" * 60)
    print("\n[D4 — clipMetaDescription limit]")
    print("  NOTE: clipMetaDescription defaults to max=160; older brief targeted ≤155.")
    print("  This script gates at 160 to match current code. Human decides canonical limit.")

    titles: dict[str, list[str]] = defaultdict(list)
    metas: dict[str, list[str]] = defaultdict(list)

    for label, path in _sample_urls(base_url):
        url = f"{base_url}{path}"
        status, body = fetch_page(url)
        if status != 200:
            check(f"{label}: HTTP 200", False, f"got {status}")
            continue

        title = extract_title(body)
        core = _core_title(title)
        meta = extract_meta_description(body)

        check(f"{label}: title present", len(title) > 0, "empty title")
        # Core title (brand suffix stripped) is the SERP-budget unit.
        check(
            f"{label}: core title ≤ {CORE_TITLE_MAX} chars",
            len(core) <= CORE_TITLE_MAX,
            f"core len={len(core)}: {core[:70]}",
        )
        # Full title (with suffix) shouldn't run away.
        check(
            f"{label}: full title ≤ {FULL_TITLE_MAX} chars",
            len(title) <= FULL_TITLE_MAX,
            f"full len={len(title)}: {title[:80]}",
        )
        check(f"{label}: meta present", len(meta) > 0, "empty meta description")
        check(
            f"{label}: meta ≤ 160 chars",
            len(meta) <= 160,
            f"len={len(meta)}: {meta[:80]}…",
        )

        bad = _unsupported_claim(meta)
        if bad:
            # Top % claims are data-backed on facility pages — allow "top N%"
            if bad == "best" and re.search(r"top \d+%", meta.lower()):
                pass
            else:
                check(f"{label}: no unsupported claim token", False, f"found '{bad}' in meta")

        titles[title].append(label)
        metas[meta].append(label)

    print("\n[Uniqueness — sampled set]")
    dup_titles = {t: paths for t, paths in titles.items() if len(paths) > 1 and t}
    dup_metas = {m: paths for m, paths in metas.items() if len(paths) > 1 and m}
    check("no duplicate titles in sample", len(dup_titles) == 0, str(list(dup_titles.items())[:3]))
    check("no duplicate metas in sample", len(dup_metas) == 0, str(list(dup_metas.items())[:3]))

    run_all_checks("Meta validation")


if __name__ == "__main__":
    main()
