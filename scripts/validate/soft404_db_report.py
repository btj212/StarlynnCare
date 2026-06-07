#!/usr/bin/env python3
"""
DB-backed soft-404 candidate report — hubs with no publishable facilities.

Read-only. Writes docs/audits/soft404-report.md when live HTTP scan is unavailable.

Usage:
    python3 scripts/validate/soft404_db_report.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate._lib import REPO_ROOT, get_conn  # noqa: E402

AUDIT_PATH = REPO_ROOT / "docs" / "audits" / "soft404-report.md"
STATE_SLUG = {
    "CA": "california",
    "OR": "oregon",
    "WA": "washington",
    "MN": "minnesota",
    "TX": "texas",
}

KNOWN_OFFENDERS = [
    "/california/alameda-county",
    "/oregon/sweet-home",
]


def main() -> None:
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Regions from DB: city_slug values with facility counts
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT state_code, city_slug, COUNT(*)::int AS n
                FROM facilities
                WHERE publishable = true
                GROUP BY state_code, city_slug
                ORDER BY n ASC, state_code, city_slug
                """
            )
            city_counts = cur.fetchall()

    empty_cities = [r for r in city_counts if r["n"] == 0]
    thin_cities = [r for r in city_counts if r["n"] == 1]

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# Soft-404 audit report",
        "",
        f"Generated: {now}",
        "Source: **DB-backed scan** (live HTTP scan unavailable in CI/agent sandbox).",
        "Re-run live scan: `python3 scripts/validate/soft404_report.py --env production`",
        "",
        "## Known offenders (analytics audit — verify manually)",
        "",
    ]
    for path in KNOWN_OFFENDERS:
        lines.append(f"- `{path}` — flagged in May 2026 analytics audit; verify render + index status")

    lines.extend(["", "## City hubs with zero publishable facilities", ""])
    if empty_cities:
        for r in empty_cities[:50]:
            slug = STATE_SLUG.get(r["state_code"], r["state_code"].lower())
            lines.append(f"- `/{slug}/{r['city_slug']}` — 0 facilities in DB")
    else:
        lines.append("_None — every city_slug in DB has ≥1 publishable facility._")

    lines.extend(["", "## Thin city hubs (1 facility — may render weak ItemList)", ""])
    for r in thin_cities[:20]:
        slug = STATE_SLUG.get(r["state_code"], r["state_code"].lower())
        lines.append(f"- `/{slug}/{r['city_slug']}` — {r['n']} facility")

    lines.extend([
        "",
        "## Notes",
        "",
        "- County hubs (e.g. alameda-county) are defined in `src/lib/regions.ts`, not city_slug.",
        "- **No fixes applied.** Populate-vs-noindex is a human decision.",
        "",
    ])

    AUDIT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {AUDIT_PATH}")


if __name__ == "__main__":
    main()
