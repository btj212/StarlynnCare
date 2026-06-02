#!/usr/bin/env python3
"""
Source-level page QA — scans page.tsx and components for placeholder/dev markers.

No network required. Complements live page_qa when preview/production is reachable.

Usage:
    python3 scripts/validate/page_qa_source_scan.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._lib import REPO_ROOT, check, get_conn, run_all_checks  # noqa: E402

APP = REPO_ROOT / "src" / "app"
COMPONENTS = REPO_ROOT / "src" / "components"

# Dev/placeholder markers in user-visible copy (not input placeholder= attrs)
BAD_COPY_RE = re.compile(
    r"\b(lorem ipsum|TODO:|FIXME:|xxx|\bmock data\b|\[object Object\])\b",
    re.IGNORECASE,
)

# Image without alt= on same line (heuristic)
IMG_NO_ALT_RE = re.compile(r"<img\s+(?![^>]*\balt=)[^>]*>", re.IGNORECASE)


def _scan_files(root: Path, glob: str) -> list[Path]:
    return sorted(root.glob(glob))


def _scan_tsx(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    issues: list[str] = []
    rel = path.relative_to(REPO_ROOT)
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
            continue
        for m in BAD_COPY_RE.finditer(line):
            issues.append(f"{rel}:{i}: bad copy marker {m.group(0)!r}")
        for m in IMG_NO_ALT_RE.finditer(line):
            issues.append(f"{rel}:{i}: <img> without alt attribute")
    if "Coming Soon" in text and "unlock/page" not in str(rel):
        if re.search(r"[>\"']Coming Soon", text):
            issues.append(f"{rel}: 'Coming Soon' in visible copy")
    return issues


def _empty_hubs_from_db() -> list[dict]:
    """City slugs with zero publishable facilities (potential soft-404 if indexed)."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, city_slug, COUNT(*)::int AS n
                FROM facilities
                WHERE publishable = true
                GROUP BY state_code, city_slug
                HAVING COUNT(*) = 0
                LIMIT 5
                """
            )
            return cur.fetchall()


def main() -> None:
    print("=" * 60)
    print("StarlynnCare — Source page QA scan")
    print("=" * 60)

    all_issues: list[str] = []
    pages = _scan_files(APP, "**/page.tsx")
    check("found page.tsx files", len(pages) > 40, f"got {len(pages)}")

    for p in pages:
        all_issues.extend(_scan_tsx(p))

    for p in _scan_files(COMPONENTS, "**/*.tsx"):
        all_issues.extend(_scan_tsx(p))

    check("no bad copy markers in source", len(all_issues) == 0, "\n    ".join(all_issues[:10]))

    # Static page inventory for tier1
    static_pages = [p for p in pages if "[state]" not in str(p)]
    check("tier1 static page count", len(static_pages) >= 30, f"got {len(static_pages)}")

    print(f"\n  Static/editorial pages inventoried: {len(static_pages)}")
    print(f"  Dynamic template pages: {len(pages) - len(static_pages)}")

    run_all_checks("Source page QA")


if __name__ == "__main__":
    main()
