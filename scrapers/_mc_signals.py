#!/usr/bin/env python3
"""
_mc_signals.py — Shared memory care signal detection logic for all states.

This module is a pure library — no DB access, no CLI. Import it from any
state-specific ingest script to get consistent signal detection.

Signal Tiers
------------
Tier 1 — Explicit name keywords (mc_signal_explicit_name)
  Sole signal sufficient to auto-publish. Patterns match the facility or
  operator name and indicate a primary dementia/memory-care mission.

Tier 2 — Known chain operators (mc_signal_chain_name)
  National and regional chains whose CA (and multi-state) portfolios include
  dedicated memory-care units at SOME properties. A hit alone is NOT sufficient
  to auto-publish — routes to mc_review_status='needs_review' for human review.
  When a curated chain match is confirmed via chain_curated.csv it upgrades to
  mc_signal_chain_curated=true (Tier 1).

Usage
-----
    from _mc_signals import score_name

    signals = score_name(facility_name, operator_name)
    # signals.explicit_name  → bool
    # signals.chain_name     → bool
    # signals.chain_matched  → str | None  (the chain operator name matched)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# ─────────────────────────────────────────────────────────────────────────────
# Tier 1 — Explicit memory care keywords
# ─────────────────────────────────────────────────────────────────────────────

_EXPLICIT_RE = re.compile(
    r"\b("
    r"memory\s*care|memory[-\s]care|memory[-\s]support"
    r"|dementia|alzheimer"
    r"|reminiscence"
    r"|cognitive\s+care|cognitive\s+memory"
    r")\b",
    re.IGNORECASE,
)

# ─────────────────────────────────────────────────────────────────────────────
# Tier 2 — Known chain operators
# ─────────────────────────────────────────────────────────────────────────────
#
# National and regional chains that consistently include memory care at their
# senior living properties (but not exclusively — e.g., Atria has standalone AL
# properties without MC programs). A name match alone routes to needs_review.
#
# Guidelines for additions:
#   - Include ONLY chains with ≥3 confirmed MC properties in the StarlynnCare
#     coverage area (CA, OR, WA, MN, TX).
#   - Use a distinctive name fragment that avoids false positives on generic words.
#   - Prefer right-anchored patterns (e.g., "sunrise of" catches "Sunrise of Poway").
#

_CHAIN_RE = re.compile(
    r"\b("
    # National operators
    r"silverado"
    r"|aegis"
    r"|brookdale"
    r"|atria"
    r"|sunrise\s+(senior\s+living|of|at)"
    r"|holiday\s+by\s+atria"
    r"|five\s+star\s+senior"
    r"|benchmark\s+senior"
    r"|capital\s+senior\s+living"
    r"|senior\s+lifestyle"
    r"|pacific\s+care"
    # Regional — California
    r"|belmont\s+village"
    r"|watermark\s+at|the\s+watermark"
    r"|oakmont\s+of|oakmont\s+gardens"
    r"|merrill\s+gardens"
    r"|ivy\s+park"
    r"|pacifica\s+senior\s+living"
    r"|eskaton"
    r"|cogir"
    r"|carlton\s+senior\s+living"
    r"|pegasus\s+senior\s+living"
    r"|activcare"
    r"|front\s+porch"
    r"|episcopal\s+senior\s+communities"
    r"|generations\s+at"
    r"|spectrum\s+senior\s+living"
    r"|elegance\s+\w+"
    # Regional — Pacific Northwest (OR, WA)
    r"|emerald\s+city\s+senior\s+living"
    r"|senior\s+services\s+of\s+america"
    r"|regency\s+park"
    r"|prestige\s+(care\s+center|senior\s+living)"
    r"|lodgestone\s+senior"
    # Regional — Minnesota / Midwest
    r"|ecumen"
    r"|good\s+samaritan\s+society"
    r"|presbyterian\s+homes"
    r"|walker\s+methodist"
    r"|fairview"
    r"|benedictine"
    r"|essentia"
    # Regional — Texas
    r"|atrium\s+(senior|at)"
    r"|legacy\s+(oaks|ranch|senior|place)"
    r"|heritage\s+of"
    r"|cantex\s+continuing\s+care"
    r")\b",
    re.IGNORECASE,
)

# ─────────────────────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class MCSignals:
    """Signal detection results for a single facility name/operator pair."""

    explicit_name: bool = False
    """True if the name contains Tier-1 explicit memory care keywords."""

    chain_name: bool = False
    """True if the name matches a known multi-state chain operator."""

    chain_matched: str | None = None
    """The specific chain name fragment that matched (for audit/display)."""

    def to_dict(self) -> dict[str, bool | str | None]:
        return {
            "mc_signal_explicit_name": self.explicit_name,
            "mc_signal_chain_name": self.chain_name,
            # chain_matched is metadata, not a DB column; callers can log it
        }


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────


def score_name(
    facility_name: str | None,
    operator_name: str | None = None,
) -> MCSignals:
    """
    Score a facility name (and optional operator name) against the MC signal patterns.

    Parameters
    ----------
    facility_name:
        The primary facility name (required).
    operator_name:
        The operator/licensee name. Concatenated with facility_name for matching.

    Returns
    -------
    MCSignals
        Signal detection result with explicit_name, chain_name, chain_matched.

    Examples
    --------
    >>> score_name("Sunrise of Poway", "Sunrise Senior Living").explicit_name
    False
    >>> score_name("Sunrise of Poway", "Sunrise Senior Living").chain_name
    True
    >>> score_name("Memories at Maple Grove").explicit_name
    True
    """
    parts = [p for p in (facility_name, operator_name) if p]
    combined = " ".join(parts).strip()

    if not combined:
        return MCSignals()

    explicit_match = bool(_EXPLICIT_RE.search(combined))
    chain_m = _CHAIN_RE.search(combined)
    chain_match = bool(chain_m)

    return MCSignals(
        explicit_name=explicit_match,
        chain_name=chain_match,
        chain_matched=chain_m.group() if chain_m else None,
    )


def score_batch(
    rows: list[dict],
    *,
    name_key: str = "name",
    operator_key: str | None = "operator_name",
) -> list[MCSignals]:
    """
    Score a list of facility dicts.

    Parameters
    ----------
    rows:
        List of facility dicts.
    name_key:
        Dict key for facility name (default: "name").
    operator_key:
        Dict key for operator/licensee name (default: "operator_name"). Pass None
        to skip operator matching.

    Returns
    -------
    list[MCSignals]
        One MCSignals per row, in the same order as `rows`.
    """
    results = []
    for row in rows:
        facility_name = row.get(name_key)
        operator_name = row.get(operator_key) if operator_key else None
        results.append(score_name(facility_name, operator_name))
    return results


# ─────────────────────────────────────────────────────────────────────────────
# CLI (smoke test / batch audit)
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    test_cases = [
        ("Sunrise of Poway", "Sunrise Senior Living"),
        ("Memory Care at Maple Grove", None),
        ("Brookdale San Jose", "Brookdale Senior Living"),
        ("Riverside Assisted Living", "Smith Family LLC"),
        ("Ecumen Prairie Lodge", None),
        ("The Watermark at Brooklyn Heights", None),
        ("Legacy Oaks of Austin", None),
        ("Alzheimer's Care Center", None),
    ]

    print(f"{'Name':<45} {'Operator':<30} {'explicit':>8} {'chain':>6} {'matched'}")
    print("-" * 110)
    for name, op in test_cases:
        sig = score_name(name, op)
        print(
            f"{name:<45} {(op or ''):<30} "
            f"{'YES' if sig.explicit_name else 'no':>8} "
            f"{'YES' if sig.chain_name else 'no':>6} "
            f"{sig.chain_matched or ''}"
        )
