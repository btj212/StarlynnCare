#!/usr/bin/env python3
"""Classify one CMS nursing-home row without merging it into a Colorado assisted living residence.

A CCN match is the only identity. A normalized name and street can be recorded as
a candidate for a person to review. It never becomes the same facility.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from scrapers._mc_signals import score_name
from scrapers.cms_nh_deficiencies_ingest import (
    _SCOPE_LABELS,
    _SCOPE_SEVERITY_MAP,
    _is_ij,
    _scope_severity_label,
)

CARE_COMPARE_URL = "https://www.medicare.gov/care-compare/details/nursing-home/{ccn}/view-all/"
SOURCE_DIRECTORY = "cms_directory"
SOURCE_DEFICIENCIES = "cms_deficiencies"
CMS_AGENCY = "CMS"

# Only a column whose name has been checked against the current CMS file may
# count as a dementia unit. An unseen header is printed by the dry-run and is
# not a signal.
DEMENTIA_UNIT_COLUMNS: tuple[str, ...] = ()


def cms_external_id(ccn: str) -> str:
    """Keep the CMS id off the CDPHE facility-id key."""
    return f"cms-{ccn.strip()}"


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _digits(value: Any) -> str:
    return re.sub(r"\D", "", _text(value))


def match_key(name: str, street: str) -> tuple[str, str]:
    def norm(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()

    return norm(name), norm(street)


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return re.sub(r"-+", "-", slug)


def _int(value: Any) -> int | None:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _rating(value: Any) -> int | None:
    number = _int(value)
    if number is None or not 1 <= number <= 5:
        return None
    return number


def _phone(value: Any) -> str | None:
    digits = _digits(value)
    if len(digits) != 10:
        return None
    return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"


def _coord(value: Any, low: float, high: float) -> float | None:
    try:
        number = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    if not low <= number <= high:
        return None
    return number


def has_dementia_unit(row: dict[str, Any]) -> bool:
    """True only for an allowlisted CMS column with a positive unit count or an explicit yes."""
    for column in DEMENTIA_UNIT_COLUMNS:
        raw = _text(row.get(column)).lower()
        if not raw or raw in {"0", "n", "no", "false", "null"}:
            continue
        number = _int(raw)
        if number is not None and number > 0:
            return True
        if raw in {"y", "yes", "true"}:
            return True
    return False


@dataclass
class CmsDirectoryDecision:
    source_key: str
    ccn: str
    disposition: str
    reason: str | None
    facility: dict[str, Any] | None
    candidate_alr_ids: list[str] = field(default_factory=list)


def classify_cms_provider(
    row: dict[str, Any],
    *,
    alr_by_address: dict[tuple[str, str], list[str]] | None = None,
) -> CmsDirectoryDecision:
    ccn = _text(row.get("CMS Certification Number (CCN)"))
    name = _text(row.get("Provider Name"))
    street = _text(row.get("Provider Address"))
    city = _text(row.get("City/Town") or row.get("Provider City"))
    source_key = ccn or "missing-ccn"
    if not ccn:
        return CmsDirectoryDecision(source_key, "", "quarantined", "missing_ccn", None)
    if not name or not city:
        return CmsDirectoryDecision(source_key, ccn, "quarantined", "missing_location", None)

    candidates: list[str] = []
    if alr_by_address:
        candidates = list(alr_by_address.get(match_key(name, street), []))
    city_slug = _slug(city) or "unknown-city"
    slug = _slug(f"{name}-{city}-{ccn}") or f"nursing-home-{ccn}"
    dementia_unit = has_dementia_unit(row)
    signals = score_name(name)
    facility = {
        "state_code": "CO",
        "external_id": cms_external_id(ccn),
        "cms_ccn": ccn,
        "name": name,
        "slug": slug,
        "city": city.title() if city.isupper() else city,
        "city_slug": city_slug,
        "street": street or None,
        "zip": _text(row.get("ZIP Code") or row.get("Provider Zip Code"))[:10] or None,
        "county": _text(row.get("County/Parish")).title() or None,
        "phone": _phone(row.get("Telephone Number") or row.get("Phone Number")),
        "beds": _int(row.get("Number of Certified Beds")),
        "latitude": _coord(row.get("Latitude"), 36.0, 42.0),
        "longitude": _coord(row.get("Longitude"), -110.0, -101.0),
        "facility_type": "Nursing Home",
        "license_status": "LICENSED",
        "care_category": "snf_dementia_scu" if dementia_unit else "snf_general",
        "serves_memory_care": dementia_unit,
        "publishable": False,
        "mc_signal_explicit_name": signals.explicit_name,
        "mc_signal_chain_name": signals.chain_name,
        "mc_review_status": "auto_published" if dementia_unit else "needs_review",
        "memory_care_disclosure_filed": dementia_unit,
        "memory_care_disclosure_source": "CMS dementia unit" if dementia_unit else None,
        "cms_overall_rating": _rating(row.get("Overall Rating")),
        "source_url": CARE_COMPARE_URL.format(ccn=ccn),
        "co_care_setting": "NH",
        "co_operating_status": "Active",
    }
    return CmsDirectoryDecision(ccn, ccn, "normalized", None, facility, candidates)


def cms_tag_code(prefix: str, tag: str) -> str:
    """Store F584, not F0584. The file zero-pads the public tag number."""
    prefix_text = (prefix or "F").strip().upper() or "F"
    number = tag.strip()
    if number.upper().startswith(prefix_text):
        number = number[len(prefix_text):]
    if number.isdigit():
        return f"{prefix_text}{int(number)}"
    return f"{prefix_text}{number}"


def classify_cms_deficiency(row: dict[str, Any]) -> dict[str, Any] | None:
    """Map one CMS tag.

    The current file's description is the standard tag statement, not the
    facility-specific inspector writeup. It is stored as the cited rule.
    inspector_narrative stays empty so a page does not call it a finding.
    """
    tag = _text(row.get("Deficiency Tag Number") or row.get("F-Tag Number") or row.get("Tag Number"))
    if not tag:
        return None
    letter = _text(row.get("Scope Severity Code") or row.get("Scope/Severity Code")).upper()
    scope_label = _SCOPE_LABELS.get(letter)
    statement = _text(row.get("Deficiency Description") or row.get("Narrative")) or None
    return {
        "code": cms_tag_code(_text(row.get("Deficiency Prefix")) or "F", tag),
        "scope": scope_label.lower() if scope_label else None,
        "severity": _SCOPE_SEVERITY_MAP.get(letter),
        "scope_severity_code": letter if len(letter) == 1 else None,
        "state_severity_raw": _scope_severity_label(letter),
        "immediate_jeopardy": _is_ij(letter),
        "description": statement,
        "complaint_deficiency": _text(row.get("Complaint Deficiency")).upper() == "Y",
    }
