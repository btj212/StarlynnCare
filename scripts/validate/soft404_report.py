#!/usr/bin/env python3
"""
Soft-404 detection — pages in sitemap that render not-found or empty hub states.

Writes docs/audits/soft404-report.md (read-only; no fixes).

Usage:
    python3 scripts/validate/soft404_report.py --env production
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._html_parse import (  # noqa: E402
    extract_sitemap_locs,
    is_noindex,
)
from validate._lib import REPO_ROOT, fetch_page, get_conn  # noqa: E402

PRODUCTION_URL = "https://starlynn.care"
AUDIT_PATH = REPO_ROOT / "docs/audits/soft404-report.md"

NOT_FOUND_MARKERS = (
    "that page doesn't exist",
    "that page doesn&rsquo;t exist",
    "404 · page not found",
    "404 · not found",
    "facility not found",
    "region not found",
)
EMPTY_HUB_MARKERS = (
    "no memory care facilities",
    "no facilities in",
    "0 facilities",
    "coming soon",
)


def _get_base_url(args: argparse.Namespace) -> str:
    if args.env == "preview":
        if not args.url:
            print("ERROR: --url is required when --env=preview", file=sys.stderr)
            sys.exit(1)
        return args.url.rstrip("/")
    return PRODUCTION_URL


def _fetch_all_sitemap_urls(base_url: str) -> list[str]:
    index_status, index_xml = fetch_page(f"{base_url}/sitemap.xml")
    if index_status != 200:
        print(f"WARN: sitemap index returned {index_status}", file=sys.stderr)
        return []
    child_locs = extract_sitemap_locs(index_xml)
    urls: list[str] = []
    for loc in child_locs:
        status, xml = fetch_page(loc)
        if status == 200:
            urls.extend(extract_sitemap_locs(xml))
    return urls


def _classify_page(body: str) -> list[str]:
    lower = body.lower()
    issues: list[str] = []
    for m in NOT_FOUND_MARKERS:
        if m.lower() in lower or m in body:
            issues.append(f"not-found marker: {m!r}")
            break
    for m in EMPTY_HUB_MARKERS:
        if m in lower:
            issues.append(f"empty-hub marker: {m!r}")
            break
    # Facility cards / ItemList proxy: hub with no profile links
    if re.search(r'href="/(california|oregon|washington|minnesota|texas)/[^"]+/[^"]+"', body) is None:
        if "memory care in" in lower and "facilities" in lower:
            if "0 " in body or "no " in lower[:3000]:
                issues.append("possible empty facility list")
    return issues


def _known_offenders_from_db() -> list[str]:
    """Paths flagged in analytics audit — verify still problematic."""
    return [
        "/california/alameda-county",
        "/oregon/sweet-home",
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="StarlynnCare soft-404 report")
    parser.add_argument("--env", choices=["production", "preview"], default="production")
    parser.add_argument("--url", default=None)
    parser.add_argument("--limit", type=int, default=0, help="Max URLs to scan (0=all)")
    args = parser.parse_args()
    base_url = _get_base_url(args)

    print("=" * 60)
    print(f"StarlynnCare — Soft-404 report ({args.env})")
    print(f"Target: {base_url}")
    print("=" * 60)

    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)

    urls = _fetch_all_sitemap_urls(base_url)
    print(f"Loaded {len(urls)} URLs from sitemaps")

    # Always check known offenders + hub URLs first
    priority_paths = set(_known_offenders_from_db())
    for loc in urls:
        if "/sitemap-hubs" in loc or any(
            p in loc for p in ("-county", "/california/", "/oregon/", "/texas/", "/washington/", "/minnesota/")
        ):
            if loc.startswith(base_url):
                priority_paths.add(loc[len(base_url) :])

    scan_list = list(dict.fromkeys(list(priority_paths) + [u.replace(base_url, "") for u in urls]))
    if args.limit:
        scan_list = scan_list[: args.limit]

    offenders: list[dict] = []
    for i, path in enumerate(scan_list):
        if not path.startswith("/"):
            path = "/" + path.lstrip("/")
        url = f"{base_url}{path}"
        if i % 50 == 0:
            print(f"  scanning {i}/{len(scan_list)}…")
        status, body = fetch_page(url, timeout=15)
        if status != 200:
            offenders.append({"path": path, "status": status, "issues": ["non-200 HTTP"]})
            continue
        issues = _classify_page(body)
        indexable = not is_noindex(body)
        if issues and indexable:
            offenders.append({"path": path, "status": status, "issues": issues, "indexable": True})

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# Soft-404 audit report",
        "",
        f"Generated: {now}",
        f"Environment: {args.env} ({base_url})",
        f"URLs scanned: {len(scan_list)}",
        "",
        "## Known offenders (from analytics audit)",
        "",
    ]
    for path in _known_offenders_from_db():
        match = next((o for o in offenders if o["path"] == path), None)
        if match:
            lines.append(f"- `{path}` — **FLAGGED**: {', '.join(match['issues'])}")
        else:
            lines.append(f"- `{path}` — not flagged in this scan (may have been fixed or needs manual check)")

    lines.extend(["", "## All flagged URLs", ""])
    if not offenders:
        lines.append("_No indexable soft-404 / empty-state pages found in scan._")
    else:
        for o in offenders:
            lines.append(f"- `{o['path']}` (HTTP {o['status']}): {', '.join(o['issues'])}")

    lines.extend([
        "",
        "## Notes",
        "",
        "- This report is **read-only**. Populate-vs-noindex decisions are out of scope.",
        "- Re-run: `python3 scripts/validate/soft404_report.py --env production`",
        "",
    ])

    AUDIT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nWrote {AUDIT_PATH} ({len(offenders)} offenders)")


if __name__ == "__main__":
    main()
