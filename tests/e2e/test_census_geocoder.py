"""Stage 4 — physical-city resolution against the real Census Geocoder.

Intent: AGENTS.md requires city to come from lat/lon via Census, not from a directory CSV.
For real stored coordinates, the live Census answer must equal the stored city_slug (or a
recorded historical slug), otherwise a facility is filed under the wrong city hub.
"""
from __future__ import annotations

import unittest

from tests.e2e import live

import recompute_physical_city as rpc  # noqa: E402

SAMPLE = 25


class CensusPhysicalCity(unittest.TestCase):
    def test_stored_city_matches_live_census_place(self) -> None:
        pool = live.sb_select("facilities", {
            "select": "name,state_code,city,city_slug,historical_city_slugs,latitude,longitude",
            "publishable": "eq.true", "latitude": "not.is.null", "longitude": "not.is.null",
            "order": "id.asc", "limit": "4000"})
        self.assertGreater(len(pool), SAMPLE)
        sample = pool[:: len(pool) // SAMPLE][:SAMPLE]
        wrong = []
        for f in sample:
            place = rpc._fetch_census_place(f["latitude"], f["longitude"])
            if place == rpc.NO_PLACE:
                continue  # unincorporated: ingest keeps the directory city by design
            if rpc.slugify(place) != f["city_slug"] and rpc.slugify(place) not in (f.get("historical_city_slugs") or []):
                wrong.append(f"{f['state_code']} {f['name']}: census={place!r} stored={f['city_slug']!r}")
        self.assertEqual(wrong, [], f"{len(wrong)}/{len(sample)} facilities filed under a different city than Census says")


if __name__ == "__main__":
    unittest.main()
