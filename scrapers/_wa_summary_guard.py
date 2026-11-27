"""Refuse inspection summaries that invent a WA dementia contract."""

from __future__ import annotations

import re

SDC_CLAIM_RE = re.compile(
    r"specialized dementia care|"
    r"\bsdc(?:p)?\b|"
    r"dementia care (?:program )?contract|"
    r"dementia care requirements|"
    r"memory[- ]care certified",
    re.I,
)


def strip_unfounded_dementia_contract(summary: str | None, holds_sdc: bool) -> str | None:
    """Drop sentences that invent an SDC contract the home does not hold."""
    if not summary or holds_sdc:
        return summary
    if not SDC_CLAIM_RE.search(summary):
        return summary
    parts = re.split(r"(?<=[.!?])\s+", summary.strip())
    kept = [part for part in parts if part and not SDC_CLAIM_RE.search(part)]
    return " ".join(kept).strip() or None
