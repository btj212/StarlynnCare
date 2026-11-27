#!/usr/bin/env python3
"""Campus-key matching and SDC-summary post-check."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scrapers"))

from _wa_directory import campus_key, dementia_specialty_from_attrs  # noqa: E402
from _wa_summary_guard import strip_unfounded_dementia_contract  # noqa: E402


def test_campus_key() -> None:
    a = campus_key("24004 114TH PLACE SE", "(253) 856-1600", 60)
    b = campus_key("24004 114th Place SE", "2538561600", 60)
    c = campus_key("24004 114TH PLACE SE", "1-253-856-1600", 60)
    assert a == b == c
    assert campus_key("24004 114TH PLACE SE", "(253) 856-1600", 40) != a
    assert campus_key("", "(253) 856-1600", 60) is None
    assert campus_key("24004 114TH PLACE SE", None, 60) is None


def test_specialty() -> None:
    assert dementia_specialty_from_attrs({"SpecialityCode": "SPDE"}) is True
    assert dementia_specialty_from_attrs({"Speciality": "Mental Health, Dementia"}) is True
    assert dementia_specialty_from_attrs({"Speciality": "Mental Health"}) is None


def test_sdc_strip() -> None:
    fields = (
        "A routine inspection conducted in June 2025 found no deficiencies cited at this facility. "
        "The inspection verified compliance with Washington DSHS Specialized Dementia Care "
        "requirements for residential care services."
    )
    cleaned = strip_unfounded_dementia_contract(fields, False)
    assert cleaned is not None
    assert "Specialized Dementia Care" not in cleaned
    assert "no deficiencies" in cleaned
    assert strip_unfounded_dementia_contract(fields, True) == fields
    assert (
        strip_unfounded_dementia_contract(
            "The visit verified Specialized Dementia Care requirements.",
            False,
        )
        is None
    )


if __name__ == "__main__":
    test_campus_key()
    test_specialty()
    test_sdc_strip()
    print("test_wa_successor_and_summaries: ok")
