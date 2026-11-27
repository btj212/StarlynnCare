#!/usr/bin/env python3
"""Washington recompute SQL must not treat the dementia specialty as memory care.

The specialty is a staff-training flag on about 98.5% of adult family homes.
Putting it back in this SQL would mark 6,199 AFHs as serving memory care
on the next Sunday scan. Operator confirmation is the AFH signal instead.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "scrapers" / "recompute_publishable.py"


def serves_memory_care_sql() -> str:
    text = SOURCE.read_text()
    match = re.search(
        r"def recompute_serves_memory_care\(.*?sql = \"\"\"(.*?)\"\"\"",
        text,
        re.S,
    )
    assert match, "recompute_serves_memory_care SQL not found"
    return match.group(1)


def test_sql_ignores_dementia_specialty() -> None:
    sql = serves_memory_care_sql()
    assert "wa_dementia_specialty" not in sql
    assert "mc_program_confirmed" in sql
    assert "wa_memory_care_certified" in sql
    assert "wa_earc_sdc_contracted" in sql


if __name__ == "__main__":
    test_sql_ignores_dementia_specialty()
    print("test_recompute_no_wa_specialty: ok")
