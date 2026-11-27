"""Pure helpers for the WA geo directory ingest."""

from __future__ import annotations

import re
from typing import Any


def normalize_wa_street(street: str | None) -> str:
    text = re.sub(r"[^A-Z0-9]+", " ", (street or "").upper()).strip()
    return re.sub(r"\s+", " ", text)


def normalize_wa_phone(phone: str | None) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 11 and digits.startswith("1"):
        return digits[1:]
    return digits


def campus_key(street: str | None, phone: str | None, beds: int | None) -> tuple[str, str, int] | None:
    """Same campus = same street + phone + beds. None when any piece is missing."""
    st = normalize_wa_street(street)
    ph = normalize_wa_phone(phone)
    if not st or not ph or beds is None:
        return None
    return (st, ph, int(beds))


def dementia_specialty_from_attrs(attrs: dict[str, Any]) -> bool | None:
    """ArcGIS Speciality / SpecialityCode (SPDE). None when the layer is silent."""
    code = str(attrs.get("SpecialityCode") or attrs.get("SpecialtyCode") or "")
    label = str(attrs.get("Speciality") or attrs.get("Specialty") or "")
    blob = f"{code} {label}"
    if re.search(r"\bSPDE\b", blob, re.I) or re.search(r"dementia", blob, re.I):
        return True
    return None
