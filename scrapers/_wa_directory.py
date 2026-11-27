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
    """ArcGIS Speciality / SpecialityCode (SPDE).

    True when the layer lists Dementia or SPDE.
    False when Speciality (or Specialty) is present and does not list Dementia,
    so a later ingest can clear a stale true.
    None only when that field is absent. Do not overwrite the stored value.
    """
    code = str(attrs.get("SpecialityCode") or attrs.get("SpecialtyCode") or "")
    speciality_key = None
    if "Speciality" in attrs and attrs.get("Speciality") is not None:
        speciality_key = "Speciality"
    elif "Specialty" in attrs and attrs.get("Specialty") is not None:
        speciality_key = "Specialty"
    label = str(attrs.get(speciality_key) or "") if speciality_key else ""
    blob = f"{code} {label}"
    if re.search(r"\bSPDE\b", blob, re.I) or re.search(r"dementia", blob, re.I):
        return True
    if speciality_key is not None:
        return False
    return None
