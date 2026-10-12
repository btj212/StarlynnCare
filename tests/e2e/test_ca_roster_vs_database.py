"""Stage 1b — live regulator roster vs production `facilities` table, every field, every facility.

Intent: the roster the state publishes today and the rows we serve must agree. Coverage gaps mean
a licensed home is invisible to families; field drift means we are showing stale facts.
"""
from __future__ import annotations

import collections
import unittest

from tests.e2e import live

import ccld_rcfe_ingest as ingest  # noqa: E402

OWNED_FIELDS = ("name", "license_type", "street", "zip", "beds", "phone", "operator_name",
                "management_company", "license_status", "slug", "city_slug", "city")


class AlamedaRosterVsDatabase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        roster = [r for r in live.rcfe_csv_rows() if r["county_name"] == "ALAMEDA" and r["facility_status"] == "LICENSED"]
        cls.built = [ingest.build_facility_row(r, None, ingest_county="NONE") for r in roster]
        lics = [b["license_number"] for b in cls.built]
        cls.db = {d["license_number"]: d for d in live.sb_select_in(
            "facilities", "license_number", lics, select=",".join(("license_number",) + OWNED_FIELDS),
            extra={"state_code": "eq.CA"})}

    def test_every_licensed_facility_on_the_roster_is_in_the_database(self) -> None:
        missing = [f"{b['license_number']} {b['name']}" for b in self.built if b["license_number"] not in self.db]
        self.assertEqual(missing, [], f"{len(missing)}/{len(self.built)} licensed roster facilities missing from production")

    def test_every_owned_field_matches(self) -> None:
        drift = collections.defaultdict(list)
        for b in self.built:
            d = self.db.get(b["license_number"])
            if d:
                for f in OWNED_FIELDS:
                    if b[f] != d[f]:
                        drift[f].append(f"{b['license_number']}: roster-derived={b[f]!r} stored={d[f]!r}")
        self.assertEqual(dict(drift), {})


if __name__ == "__main__":
    unittest.main()
