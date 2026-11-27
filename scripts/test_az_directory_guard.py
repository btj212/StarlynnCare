#!/usr/bin/env python3
"""The Feb 2025 ADHS map must not overwrite a newer AZ Care Check row.

A row whose license source is azcarecheck, or whose check date is after
2025-02-03, keeps its license number, expiration, status, and Directed Care
fields. An older row takes the map. A CLOSED row is not written at all.
The database trigger still blocks a stale status change; this guard is
stricter and leaves the whole closed row alone.
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scrapers.az_adhs_directory_ingest import (  # noqa: E402
    ADHS_MAP_AS_OF,
    apply_adhs_map_guard,
)


def _existing(**overrides: object) -> dict:
    row = {
        "license_number": "AL-NEW",
        "license_expiration": "2027-06-01",
        "license_status": "LICENSED",
        "license_status_source": "https://azcarecheck.azdhs.gov/slds/facility-details/1",
        "license_status_checked_at": "2026-11-27",
        "az_license_level": "Personal Care",
        "az_mc_subclass": None,
        "az_memory_care_endorsed": None,
        "serves_memory_care": True,
        "memory_care_disclosure_filed": False,
        "memory_care_disclosure_source": None,
        "name": "Stored Name",
    }
    row.update(overrides)
    return row


def _incoming(**overrides: object) -> dict:
    row = {
        "license_number": "AL-STALE",
        "license_expiration": "2025-01-01",
        "license_status": "LICENSED",
        "az_license_level": "Directed Care",
        "az_mc_subclass": False,
        "az_memory_care_endorsed": True,
        "serves_memory_care": True,
        "memory_care_disclosure_filed": True,
        "memory_care_disclosure_source": "ADHS Directed Care License",
        "name": "Map Name",
        "street": "1 Main St",
    }
    row.update(overrides)
    return row


def test_newer_azcc_row_keeps_license_fields() -> None:
    out, skipped = apply_adhs_map_guard(_incoming(), _existing())
    assert out is not None
    assert out["license_number"] == "AL-NEW"
    assert out["license_expiration"] == "2027-06-01"
    assert out["license_status"] == "LICENSED"
    assert out["az_license_level"] == "Personal Care"
    assert out["az_memory_care_endorsed"] is None
    assert out["memory_care_disclosure_source"] is None
    assert out["name"] == "Map Name"
    assert out["street"] == "1 Main St"
    assert "license_number" in skipped
    assert "license_expiration" in skipped
    assert "az_license_level" in skipped
    assert "license_status" not in skipped


def test_check_date_after_map_protects_without_azcc_source() -> None:
    out, skipped = apply_adhs_map_guard(
        _incoming(),
        _existing(
            license_status_source="https://example.gov/old",
            license_status_checked_at=date(2025, 2, 4),
        ),
    )
    assert out is not None
    assert out["license_number"] == "AL-NEW"
    assert "license_number" in skipped


def test_older_row_takes_the_map() -> None:
    out, skipped = apply_adhs_map_guard(
        _incoming(),
        _existing(
            license_number="AL-OLD",
            license_status_source="https://azgeo-open-data-agic.hub.arcgis.com/datasets/map",
            license_status_checked_at=None,
            az_license_level="Supervisory Care",
        ),
    )
    assert out is not None
    assert skipped == []
    assert out["license_number"] == "AL-STALE"
    assert out["license_expiration"] == "2025-01-01"
    assert out["az_license_level"] == "Directed Care"
    assert out["name"] == "Map Name"


def test_map_as_of_date_is_not_newer() -> None:
    assert ADHS_MAP_AS_OF == date(2025, 2, 3)
    out, skipped = apply_adhs_map_guard(
        _incoming(),
        _existing(
            license_status_source=None,
            license_status_checked_at="2025-02-03",
            license_number="AL-SAME-DAY",
        ),
    )
    assert out is not None
    assert skipped == []
    assert out["license_number"] == "AL-STALE"


def test_null_map_expiration_does_not_wipe_a_stored_date() -> None:
    out, skipped = apply_adhs_map_guard(
        _incoming(license_expiration=None),
        _existing(
            license_status_source=None,
            license_status_checked_at=None,
            license_expiration="2028-01-01",
        ),
    )
    assert out is not None
    assert skipped == []
    assert out["license_expiration"] == "2028-01-01"


def test_closed_row_is_not_written() -> None:
    out, skipped = apply_adhs_map_guard(
        _incoming(),
        _existing(license_status="CLOSED"),
    )
    assert out is None
    assert skipped == ["CLOSED"]
    closed = apply_adhs_map_guard(_incoming(), _existing(license_status="closed"))
    assert closed[0] is None


def test_new_row_is_written() -> None:
    incoming = _incoming()
    out, skipped = apply_adhs_map_guard(incoming, None)
    assert out == incoming
    assert skipped == []


if __name__ == "__main__":
    test_newer_azcc_row_keeps_license_fields()
    test_check_date_after_map_protects_without_azcc_source()
    test_older_row_takes_the_map()
    test_map_as_of_date_is_not_newer()
    test_null_map_expiration_does_not_wipe_a_stored_date()
    test_closed_row_is_not_written()
    test_new_row_is_written()
    print("test_az_directory_guard: ok")
