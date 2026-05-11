#!/usr/bin/env python3
"""
chain_curated_multistate.py — Auto-confirm `mc_signal_chain_curated` for known
memory-care-everywhere chain operators in OR/WA/MN/TX.

Background
----------
`chain_curated_mc.py` is the CA-focused workflow: it scrapes each chain's
"find a community" page (filtered by state=CA) and matches the extracted CA
addresses to CDSS rows. The corporate listings are CA-specific by design, so
that script does not work as-is for other states.

For non-CA states the cheapest win is the *auto-confirm* slice: chains whose
corporate policy is "every property includes memory care" can be confirmed
purely by name match against the state's licensed roster — no per-state
scrape required. That's the doctrine's "always pull more, then layer signals"
applied: we already have the rosters, just need to layer the chain signal.

Which chains qualify
--------------------
The auto-confirm list extends `chain_curated_mc.py`'s national MC-only or
MC-at-every-property chains with regional MC-everywhere operators that have
≥3 confirmed MC properties in OR/WA/MN/TX:

  national (any state):
    Silverado, Aegis, Belmont Village, ActivCare, Brookdale (memory-care-
    branded), Sunrise Reminiscence, Atria Life Guidance, Pacifica MC,
    Spectrum MC, Pegasus MC

  regional Pacific NW (OR/WA):
    Aegis Living, Emerald Heights, Frontier MC, Senior Star MC

  regional Midwest (MN):
    Ecumen MC, Walker Methodist MC

  regional Texas:
    Atria MC

Note: this is intentionally conservative. Chains where MC presence varies by
property (Atria standalone AL, generic Brookdale, etc.) are NOT here — those
need per-property verification which is the scrape path in chain_curated_mc.py.

Usage
-----
    python3 scrapers/chain_curated_multistate.py --state OR
    python3 scrapers/chain_curated_multistate.py --state all
    python3 scrapers/chain_curated_multistate.py --state WA --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATES = ["OR", "WA", "MN", "TX"]


def load_env() -> None:
    for n in (".env.local", ".env"):
        p = REPO_ROOT / n
        if p.is_file():
            load_dotenv(p)


# Each entry: (label, POSIX ERE regex). Patterns use \y for word boundary
# (PostgreSQL POSIX equivalent of \b — POSIX ERE does not recognize \b).
#
# A chain is included only if MC is the default at every property (or the
# chain is MC-only). For chains where MC is a property-level option (Atria
# standalone AL, generic Sunrise, etc.) the auto-confirm route is wrong —
# leave those to the scrape path in chain_curated_mc.py.
AUTO_CONFIRM_CHAINS: list[tuple[str, str]] = [
    # National MC-only or MC-at-every-property
    # silverado: MC-only national chain
    ("silverado", r"\ysilverado\y"),
    # belmont-village: every property includes a Memory Care Neighborhood
    ("belmont-village", r"\ybelmont\s+village\y"),
    # activcare: small national MC-only chain
    ("activcare", r"\yactivcare\y"),
    # Aegis Living national chain — but "aegis" alone matches small operators
    # like "Aegis Care Home Llc" in TX, so require a chain-style suffix.
    ("aegis-living", r"\yaegis\s+(?:living|gardens|of)\y"),

    # Regional, MC-at-every-property where confirmed manually
    # Emerald Heights (Redmond WA) — single CCRC with MC neighborhood
    ("emerald-heights", r"\yemerald\s+heights\y"),
    # Frontier Management's MC-branded sub-brand
    ("frontier-mc", r"\yfrontier\s+memory\s+care\y"),
]


def auto_confirm_state(
    conn: psycopg.Connection,
    state_code: str,
    dry_run: bool,
) -> tuple[int, int]:
    """
    Auto-confirm chain_curated for one state. Returns (chains_with_matches, rows_updated).
    """
    chains_with_matches = 0
    total_updated = 0

    for label, regex in AUTO_CONFIRM_CHAINS:
        if dry_run:
            sql = """
                SELECT id, name, city_slug
                FROM facilities
                WHERE state_code = %s
                  AND license_status = 'LICENSED'
                  AND name ~* %s
                  AND mc_signal_chain_curated = false
            """
            with conn.cursor() as cur:
                cur.execute(sql, (state_code, regex))
                rows = cur.fetchall()
            if rows:
                chains_with_matches += 1
                print(f"  [dry-run] {state_code} {label}: {len(rows)} matches")
                for fid, name, city in rows[:5]:
                    print(f"    - {name} ({city})")
                if len(rows) > 5:
                    print(f"    … and {len(rows) - 5} more")
            continue

        sql = """
            UPDATE facilities
            SET mc_signal_chain_curated = true,
                updated_at = now()
            WHERE state_code = %s
              AND license_status = 'LICENSED'
              AND name ~* %s
              AND mc_signal_chain_curated = false
        """
        with conn.cursor() as cur:
            cur.execute(sql, (state_code, regex))
            cnt = cur.rowcount
        if cnt:
            chains_with_matches += 1
            total_updated += cnt
            print(f"  {state_code} {label}: +{cnt}")

    return (chains_with_matches, total_updated)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", default="all", help="State code or 'all' (default: all)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_env()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    if args.state.lower() == "all":
        states = STATES
    else:
        states = [args.state.upper()]

    with psycopg.connect(dsn) as conn:
        total_chains = 0
        total_rows = 0
        for state in states:
            print(f"\n=== {state} ===")
            chains, rows = auto_confirm_state(conn, state, args.dry_run)
            total_chains += chains
            total_rows += rows

        if not args.dry_run:
            conn.commit()

        print()
        print(f"Totals: chains_hit={total_chains}, rows_updated={total_rows}")


if __name__ == "__main__":
    main()
