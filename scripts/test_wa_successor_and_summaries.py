#!/usr/bin/env python3
"""Campus-key matching and SDC-summary post-check."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scrapers"))

from _summary_guard import (  # noqa: E402
    claims_clean_visit,
    reject_false_clean_visit,
    source_cites_deficiency,
)
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
    assert dementia_specialty_from_attrs({"Speciality": "Mental Health"}) is False
    assert dementia_specialty_from_attrs({}) is None


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


def test_afh_prompt_does_not_claim_a_contract() -> None:
    from generate_content import (  # noqa: E402
        build_source_context,
        generation_human_template_for_state,
        generation_system_for_state,
        meta_for_facility,
    )

    fac = {
        "state_code": "WA",
        "wa_facility_type": "AFH",
        "name": "Amazing Hearts AFH",
        "street": "1 Main St",
        "city": "Vancouver",
        "zip": "98661",
        "phone": None,
        "beds": 6,
        "operator_name": None,
        "license_number": "756545",
        "license_status": "LICENSED",
        "license_expiration": None,
        "serves_memory_care": True,
        "wa_dementia_specialty": True,
        "memory_care_designation": None,
        "care_category": "alf_memory_care",
        "inspection_count": 0,
        "deficiency_count": 0,
        "serious_citation_count": 0,
        "dementia_citation_count": 0,
        "complaint_count": 0,
        "last_inspection_date": None,
    }
    meta = meta_for_facility("WA", fac)
    ctx = build_source_context(fac)
    prompt = generation_system_for_state("WA", meta) + "\n" + generation_human_template_for_state(
        "WA", meta
    ).format(**ctx)
    note = (
        "DSHS does not issue memory-care contracts or certification to adult family homes. "
        "Do not claim one. Do not describe the dementia specialty as memory care."
    )
    assert note in prompt
    assert "Adult Family Home (RCW 70.128)" in prompt
    assert "Specialized Dementia Care contract" not in prompt
    assert ctx["serves_mc"] == "No"


def test_false_clean_visit() -> None:
    fields_june = (
        "A routine inspection conducted in June 2025 found no deficiencies cited at this facility. "
        "The inspection verified compliance with Washington DSHS Specialized Dementia Care "
        "requirements for residential care services."
    )
    avamere_may = (
        "During a routine inspection in May 2025, the facility was evaluated against "
        "Washington's Specialized Dementia Care standards. The report does not specify "
        "whether deficiencies were cited or the facility met all requirements at the "
        "time of inspection."
    )
    fields_source = (
        "WAC 388-78A-2120: The facility failed to provide treatment for skin concerns "
        "for 1 of 9 residents.\n\nWAC 388-78A-24701: The facility failed to complete a "
        "character, competence and suitability review."
    )
    avamere_source = (
        "WAC 388-78A-2600(2)(f): The facility failed to ensure staff followed policies "
        "and procedures regarding life-sustaining treatments."
    )
    assert claims_clean_visit(fields_june)
    assert claims_clean_visit(avamere_may)
    assert source_cites_deficiency(fields_source)
    assert source_cites_deficiency(avamere_source)
    assert reject_false_clean_visit(fields_june, deficiency_count=2, source_text=fields_source)
    assert reject_false_clean_visit(avamere_may, deficiency_count=1, source_text=avamere_source)
    assert reject_false_clean_visit(
        "No deficiencies were cited.",
        deficiency_count=0,
        source_text=fields_source,
    )
    assert not reject_false_clean_visit(
        "A complaint investigation found no violation was substantiated.",
        deficiency_count=0,
        source_text="The allegation was not substantiated.",
    )
    assert not claims_clean_visit(
        "On this visit the file cites this requirement: homes must operate "
        "in compliance with all applicable State and local laws."
    )
    assert not claims_clean_visit(
        "This follow-up visit is in the public file. No citation text was included for this visit."
    )


if __name__ == "__main__":
    test_campus_key()
    test_specialty()
    test_sdc_strip()
    test_afh_prompt_does_not_claim_a_contract()
    test_false_clean_visit()
    print("test_wa_successor_and_summaries: ok")
