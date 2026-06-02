#!/usr/bin/env python3
"""
Sitemap diff — listed URLs vs routable publishable pages from DB.

Writes docs/audits/sitemap-diff.md (read-only).

Usage:
    python3 scripts/validate/sitemap_diff.py --env production
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._html_parse import extract_sitemap_locs, path_from_url  # noqa: E402
from validate._lib import REPO_ROOT, fetch_page, get_conn  # noqa: E402

PRODUCTION_URL = "https://starlynn.care"
AUDIT_PATH = REPO_ROOT / "docs/audits/sitemap-diff.md"
STATE_SLUG = {
    "CA": "california",
    "OR": "oregon",
    "WA": "washington",
    "MN": "minnesota",
    "TX": "texas",
}


def _get_base_url(args: argparse.Namespace) -> str:
    if args.env == "preview":
        if not args.url:
            print("ERROR: --url is required when --env=preview", file=sys.stderr)
            sys.exit(1)
        return args.url.rstrip("/")
    return PRODUCTION_URL


def _fetch_sitemap_paths(base_url: str) -> set[str]:
    paths: set[str] = set()
    status, index_xml = fetch_page(f"{base_url}/sitemap.xml")
    if status != 200:
        return paths
    for loc in extract_sitemap_locs(index_xml):
        child_status, child_xml = fetch_page(loc)
        if child_status == 200:
            for u in extract_sitemap_locs(child_xml):
                paths.add(path_from_url(u))
    return paths


def _db_routable_paths() -> set[str]:
    paths: set[str] = set()
    with get_conn() as conn:
        with conn.cursor() as cur:
            for code, slug in STATE_SLUG.items():
                paths.add(f"/{slug}")
                paths.add(f"/{slug}/facilities")
                cur.execute(
                    """
                    SELECT city_slug, slug FROM facilities
                    WHERE publishable = true AND state_code = %s
                    """,
                    (code,),
                )
                for r in cur.fetchall():
                    paths.add(f"/{slug}/{r['city_slug']}/{r['slug']}")
                    paths.add(f"/{slug}/{r['city_slug']}")
    return paths


def main() -> None:
    parser = argparse.ArgumentParser(description="StarlynnCare sitemap diff")
    parser.add_argument("--env", choices=["production", "preview"], default="production")
    parser.add_argument("--url", default=None)
    args = parser.parse_args()
    base_url = _get_base_url(args)

    print("=" * 60)
    print(f"StarlynnCare — Sitemap diff ({args.env})")
    print("=" * 60)

    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)

    sitemap_paths = _fetch_sitemap_paths(base_url)
    db_paths = _db_routable_paths()

    # Static/editorial paths are in sitemap-static; DB set is facilities+hubs only
    listed_not_in_db = sorted(
        p for p in sitemap_paths
        if p not in db_paths and _looks_like_facility_or_hub(p)
    )
    in_db_not_listed = sorted(
        p for p in db_paths
        if p not in sitemap_paths
    )

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# Sitemap diff report",
        "",
        f"Generated: {now}",
        f"Environment: {args.env} ({base_url})",
        "",
        f"- Sitemap URLs total: **{len(sitemap_paths)}**",
        f"- DB routable facility/hub paths (sample set): **{len(db_paths)}**",
        "",
        "## Listed in sitemap but not in DB publishable set (facility/hub paths only)",
        "",
    ]
    if listed_not_in_db:
        for p in listed_not_in_db[:100]:
            lines.append(f"- `{p}`")
        if len(listed_not_in_db) > 100:
            lines.append(f"- … and {len(listed_not_in_db) - 100} more")
    else:
        lines.append("_None in facility/hub category._")

    lines.extend(["", "## Publishable in DB but missing from sitemap", ""])
    if in_db_not_listed:
        for p in in_db_not_listed[:100]:
            lines.append(f"- `{p}`")
        if len(in_db_not_listed) > 100:
            lines.append(f"- … and {len(in_db_not_listed) - 100} more")
    else:
        lines.append("_None — all sampled DB paths appear in sitemap._")

    lines.extend([
        "",
        "## Notes",
        "",
        "- Static/editorial URLs intentionally omitted from DB set.",
        "- Hub paths dedupe city_slug only; county hubs come from regions.ts not DB.",
        "",
    ])

    AUDIT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {AUDIT_PATH}")
    print(f"  listed-not-in-db (facility/hub): {len(listed_not_in_db)}")
    print(f"  db-not-listed: {len(in_db_not_listed)}")


def _looks_like_facility_or_hub(path: str) -> bool:
    parts = [p for p in path.split("/") if p]
    if len(parts) == 1 and parts[0] in STATE_SLUG.values():
        return True
    if len(parts) == 2 and parts[0] in STATE_SLUG.values():
        return True
    if len(parts) == 3 and parts[0] in STATE_SLUG.values():
        return True
    return False


if __name__ == "__main__":
    main()
