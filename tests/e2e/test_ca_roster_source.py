"""Stage 1 — CA RCFE roster: live regulator payload -> the ingest's real transform.

Intent: families see what we build from this payload, so (a) the source must still be
reachable the way production ingest reaches it, (b) every field the regulator sends must
be either consumed or consciously ignored, and (c) the transform must be sane on every
real record, not a hand-picked one.
"""
from __future__ import annotations

import re
import unittest

from tests.e2e import live  # noqa: I001  (adds scrapers/ to sys.path)

import ccld_rcfe_ingest as ingest  # noqa: E402

EXPECTED_COLUMNS = {
    "facility_type", "facility_number", "facility_name", "licensee", "facility_administrator",
    "facility_telephone_number", "facility_address", "facility_city", "facility_state",
    "facility_zip", "county_name", "regional_office", "facility_capacity", "facility_status",
    "license_first_date", "closed_date", "file_date",
}
# Columns the ingest deliberately does not store. If one of these starts mattering, move it out.
CONSCIOUSLY_IGNORED = {
    "facility_state",      # always CA
    "county_name",         # used only by the fetch filter, not stored
    "regional_office",
    "license_first_date",  # documented in build_facility_row: not stored
    "closed_date",
    "file_date",
}
# A perturbed value per column, chosen to flip every downstream branch that reads it.
PERTURB = {
    "facility_type": "RCFE-CONTINUING CARE RETIREMENT COMMUNITY",
    "facility_number": "123456789",
    "facility_name": "Zzperturb Dementia Care Home",
    "licensee": "Zzperturb Licensee Memory Care",
    "facility_administrator": "ZZ ADMIN",
    "facility_telephone_number": "(999) 000-1111",
    "facility_address": "1 ZZ STREET",
    "facility_city": "ZZ CITY",
    "facility_zip": "99999",
    "facility_capacity": "7",
    "facility_status": "PENDING",
}


class RosterSourceReachable(unittest.TestCase):
    def test_ingest_fetch_path_still_works(self) -> None:
        """The exact API call scrapers/ccld_rcfe_ingest.py makes must return records.

        Regression guard for 2026-10: data.ca.gov switched the datastore off
        (datastore_active=false) and datastore_search began returning 404, which
        silently stops every CA roster refresh.
        """
        r = live.http_get(
            ingest.CKAN_DATASTORE_URL,
            params={"resource_id": ingest.CKAN_RESOURCE_ID, "limit": 1},
        )
        self.assertEqual(r.status_code, 200, f"CKAN datastore_search -> {r.status_code}: {r.text[:200]}")
        self.assertTrue(r.json().get("success"))
        self.assertGreaterEqual(len(r.json()["result"]["records"]), 1)

    def test_published_csv_is_the_fallback_and_matches_contract(self) -> None:
        rows = live.rcfe_csv_rows()
        self.assertGreater(len(rows), 10_000, "statewide RCFE roster implausibly small")
        self.assertEqual(set(rows[0].keys()), EXPECTED_COLUMNS,
                         "regulator changed the roster schema; update build_facility_row")


class RosterTransformOnEveryRealRecord(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.rows = live.rcfe_csv_rows()
        cls.built = [(r, ingest.build_facility_row(r, None, ingest_county="NONE")) for r in cls.rows]

    def test_no_record_is_dropped_or_crashes(self) -> None:
        dropped = [r["facility_number"] for r, b in self.built if b is None]
        self.assertEqual(dropped, [], f"{len(dropped)} records dropped with no exclusion list")

    def test_identity_and_formatting_invariants(self) -> None:
        problems: list[str] = []
        seen: dict[tuple[str, str, str], str] = {}
        for raw, b in self.built:
            lic = b["license_number"]
            if not re.fullmatch(r"\d{9}", lic):
                problems.append(f"{lic}: license not 9 digits")
            if b["zip"] is not None and not re.fullmatch(r"\d{5}", b["zip"]):
                problems.append(f"{lic}: bad zip {b['zip']!r}")
            if b["beds"] is not None and b["beds"] < 0:
                problems.append(f"{lic}: negative beds")
            if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", b["slug"]):
                problems.append(f"{lic}: bad slug {b['slug']!r}")
            if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", b["city_slug"]):
                problems.append(f"{lic}: bad city_slug {b['city_slug']!r}")
            if b["source_url"] is None or lic not in b["source_url"]:
                problems.append(f"{lic}: source_url does not cite the license")
            if b["publishable"] and (b["license_status"] or "").upper() != "LICENSED":
                problems.append(f"{lic}: publishable but status {b['license_status']!r}")
            key = (b["state_code"], b["city_slug"], b["slug"])
            if key in seen and seen[key] != lic:
                problems.append(
                    f"{lic}: upsert key collision with {seen[key]} {key} — the second record "
                    f"silently overwrites the first (status {raw['facility_status']!r}, county {raw['county_name']!r})"
                )
            seen[key] = lic
        self.assertEqual(problems[:25], [], f"{len(problems)} invariant violations (first 25 shown)")

    def test_values_are_faithful_to_the_payload(self) -> None:
        """Stored value must be derivable from the raw value — no invention."""
        problems: list[str] = []
        for raw, b in self.built:
            lic = b["license_number"]
            if raw["facility_telephone_number"].strip() != (b["phone"] or ""):
                problems.append(f"{lic}: phone changed")
            if raw["facility_status"] != (b["license_status"] or ""):
                problems.append(f"{lic}: status changed")
            if raw["facility_type"] != (b["license_type"] or ""):
                problems.append(f"{lic}: license_type changed")
            cap = raw["facility_capacity"].strip()
            if cap.isdigit() and b["beds"] != int(cap):
                problems.append(f"{lic}: beds {cap}->{b['beds']}")
            if not cap and b["beds"] is not None:
                problems.append(f"{lic}: beds invented from blank capacity")
            if b["street"] and b["street"].lower() != " ".join(raw["facility_address"].split()).lower():
                problems.append(f"{lic}: street text altered")
            if b["city"] and b["city"].lower() != " ".join(raw["facility_city"].split()).lower():
                problems.append(f"{lic}: city text altered")
        self.assertEqual(problems[:25], [], f"{len(problems)} faithfulness violations")

    def test_memory_care_label_requires_evidence_in_the_payload(self) -> None:
        """YMYL: a facility is only called memory care if its own name/licensee says so (pass 1)."""
        problems = []
        for raw, b in self.built:
            text = f"{raw['facility_name']} {raw['licensee']}"
            evidence = bool(ingest.MC_EXPLICIT_RE.search(text))
            if (b["care_category"] == "rcfe_memory_care") != (evidence and "CONTINUING CARE" not in raw["facility_type"].upper()):
                problems.append(raw["facility_number"])
            if b["mc_signal_explicit_name"] != evidence:
                problems.append(raw["facility_number"] + ":signal")
        self.assertEqual(problems[:25], [])


class EveryPayloadColumnIsAccountedFor(unittest.TestCase):
    """Mutation test on a real record: change one source field, see if the output notices."""

    def test_each_column_is_consumed_or_consciously_ignored(self) -> None:
        base = next(r for r in live.rcfe_csv_rows() if r["county_name"] == "ALAMEDA" and r["facility_status"] == "LICENSED"
                    and "CONTINUING CARE" not in r["facility_type"].upper()
                    and not ingest.MC_EXPLICIT_RE.search(f"{r['facility_name']} {r['licensee']}")
                    and not ingest.MC_CHAIN_RE.search(f"{r['facility_name']} {r['licensee']}"))
        baseline = ingest.build_facility_row(base, None, ingest_county="NONE")
        silently_dropped = []
        for col in EXPECTED_COLUMNS - CONSCIOUSLY_IGNORED:
            mutated = {**base, col: PERTURB[col]}
            if ingest.build_facility_row(mutated, None, ingest_county="NONE") == baseline:
                silently_dropped.append(col)
        self.assertEqual(silently_dropped, [], "regulator fields that change nothing downstream")
        for col in CONSCIOUSLY_IGNORED:
            mutated = {**base, col: "zz-mutated"}
            self.assertEqual(ingest.build_facility_row(mutated, None, ingest_county="NONE"), baseline,
                             f"{col} is declared ignored but affects output")


if __name__ == "__main__":
    unittest.main()
