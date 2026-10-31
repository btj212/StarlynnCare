#!/usr/bin/env python3
"""Turn one CDPHE ArcGIS assisted-living feature into a facility row or a quarantine reason.

The address city is provisional. Census physical-city reconciliation owns the
published city after coordinates are stored. HCPF certification is not a CDPHE
license. A memory-care word in the name is a signal, not a public claim.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scrapers._mc_signals import score_name
from scrapers.co_hfq_parse import canonical_id, text_piece

FIND_AND_COMPARE_URL = "https://cdphe.colorado.gov/health-facilities/find-and-compare-facilities"
SOURCE_ARCGIS = "cdphe_arcgis"
ALR_TYPE_CODES = frozenset({"SA1", "SA2", "SA5"})

_ADDRESS_RE = re.compile(
    r"^(?P<street>.*),\s*(?P<city>[^,]+),\s*CO\s+(?P<zip>\d{5})(?:-\d{4})?\s*$",
    re.IGNORECASE,
)


@dataclass
class DirectoryDecision:
    source_key: str
    external_id: str
    disposition: str
    reason: str | None
    facility: dict[str, Any] | None
    raw: dict[str, Any] = field(default_factory=dict)


def slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def facility_slug(name: str, facility_id: str) -> str:
    """Stable public slug. The facility id keeps two homes with one name apart."""
    base = slugify(name) or "facility"
    suffix = slugify(facility_id)
    if not suffix or base.endswith(f"-{suffix}") or base == suffix:
        return base
    return f"{base}-{suffix}"


def title_city(city: str) -> str:
    return " ".join(part.capitalize() for part in city.split())


def parse_address(address: str) -> tuple[str | None, str | None, str | None]:
    """Split 'STREET, CITY, CO ZIP'. The street may itself contain a comma."""
    match = _ADDRESS_RE.match(address.strip())
    if not match:
        return None, None, None
    return match.group("street").strip(), title_city(match.group("city").strip()), match.group("zip")


def license_status(operating: str, hfems: str) -> str | None:
    """Active + Licensed is a CDPHE license. HCPF Certified is not. Pending is not."""
    if operating == "Pending":
        return "PENDING"
    if operating == "Active" and hfems == "Licensed":
        return "LICENSED"
    if operating == "Active" and hfems == "HCPF Certified":
        return "CERTIFIED"
    return None


def phone_value(value: Any) -> str | None:
    text = text_piece(value).strip()
    digits = re.sub(r"\D", "", text)
    if len(digits) < 10:
        return None
    return text


def beds_value(value: Any) -> int | None:
    """A reported bed count of 0 is unknown, not a claim that the home has no beds."""
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    if number <= 0:
        return None
    return number


def colorado_coords(latitude: Any, longitude: Any) -> tuple[float | None, float | None]:
    try:
        lat = float(latitude)
        lon = float(longitude)
    except (TypeError, ValueError):
        return None, None
    if not (36.0 <= lat <= 42.0 and -110.0 <= lon <= -101.0):
        return None, None
    return lat, lon


def arcgis_date(value: Any) -> date | None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    if value < 10_000_000_000:
        return None
    parsed = datetime.fromtimestamp(value / 1000, timezone.utc).date()
    if parsed.year < 2020 or parsed.year > 2035:
        return None
    return parsed


def classify_directory_feature(attrs: dict[str, Any]) -> DirectoryDecision:
    external_id = canonical_id(attrs.get("Facility_ID"))
    source_key = external_id or f"object-{attrs.get('OBJECTID')}"
    type_code = str(attrs.get("Facility_Type_Code") or "").strip()
    if not external_id:
        return DirectoryDecision(source_key, "", "quarantined", "missing_facility_id", None)
    if type_code not in ALR_TYPE_CODES:
        return DirectoryDecision(source_key, external_id, "quarantined", "not_alr", None)

    operating = str(attrs.get("Operating_Status") or "").strip()
    hfems = str(attrs.get("CDPHE_HFEMS_Licensed") or "").strip()
    status = license_status(operating, hfems)
    if status is None:
        return DirectoryDecision(source_key, external_id, "quarantined", "unrecognized_status", None)

    street, city, zip_code = parse_address(str(attrs.get("Address_Full") or ""))
    latitude, longitude = colorado_coords(attrs.get("Latitude"), attrs.get("Longitude"))
    if city is None and (latitude is None or longitude is None):
        return DirectoryDecision(source_key, external_id, "quarantined", "missing_location", None)
    if city is None:
        city = "Unknown"

    name = text_piece(attrs.get("Facility_Name")).strip() or f"Facility {external_id}"
    signals = score_name(name)
    review_status = "needs_review" if signals.chain_name and not signals.explicit_name else "auto_published"
    facility = {
        "state_code": "CO",
        "external_id": external_id,
        "license_number": external_id,
        "name": name,
        "slug": facility_slug(name, external_id),
        "city": city,
        "city_slug": slugify(city) or "unknown",
        "street": street,
        "zip": zip_code,
        "county": title_city(str(attrs.get("County") or "").strip()) or None,
        "phone": phone_value(attrs.get("Telephone")),
        "beds": beds_value(attrs.get("Licensed_Beds_Total")),
        "latitude": latitude,
        "longitude": longitude,
        "facility_type": "Assisted Living Residence",
        "license_type": str(attrs.get("Facility_Type_Detail") or "").strip() or None,
        "license_subtype": str(attrs.get("Facility_Type_Abbreviation") or "").strip() or None,
        "license_status": status,
        "care_category": "alf_general",
        "serves_memory_care": False,
        "publishable": False,
        "mc_review_status": review_status,
        "mc_signal_explicit_name": signals.explicit_name,
        "mc_signal_chain_name": signals.chain_name,
        "memory_care_disclosure_filed": False,
        "source_url": FIND_AND_COMPARE_URL,
        "co_facility_type_code": type_code,
        "co_facility_type_detail": str(attrs.get("Facility_Type_Detail") or "").strip() or None,
        "co_facility_type_abbreviation": str(attrs.get("Facility_Type_Abbreviation") or "").strip() or None,
        "co_operating_status": operating,
        "co_hfems_status": hfems or None,
        "co_care_setting": "ALR",
        "co_directory_updated_on": arcgis_date(attrs.get("Date_Data_Updated")),
    }
    return DirectoryDecision(source_key, external_id, "normalized", None, facility)
