#!/usr/bin/env python3
"""Unit tests for the live CDSS California status pipeline (no network)."""

from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scrapers"))

import _cdss_live as live  # noqa: E402
import ca_status_refresh as refresh  # noqa: E402

HEADER = (
    '"Facility Type","Facility Number","Facility Name","Licensee","Facility Administrator",'
    '"Facility Telephone Number","Facility Address","Facility City","Facility State","Facility Zip",'
    '"County Name","Regional Office","Facility Capacity","Facility Status","License First Date",'
    '"Closed Date","Last Visit Date"\n'
)


def bulk_text(rows: list[tuple[str, str, str, str]]) -> str:
    lines = [HEADER]
    for number, name, status, closed in rows:
        lines.append(
            f'"RESIDENTIAL CARE ELDERLY","{number}","{name}","LICENSEE","ADMIN","(916) 555-0100",'
            f'"7548 GREENHAVEN DR","SACRAMENTO","CA","95831","SACRAMENTO","27","105","{status}",'
            f'"6/28/2013","{closed}","9/28/2026"\n'
        )
    return "".join(lines)


NOW = datetime(2026, 11, 26, tzinfo=timezone.utc)


class BulkParseTests(unittest.TestCase):
    def test_parses_and_pads(self) -> None:
        snap = live.parse_bulk_csv(
            bulk_text([("47005239", "GREENHAVEN ESTATES", "closed", "4/6/2026")]),
            fetched_at=NOW,
            min_rows=1,
        )
        row = snap.rows["047005239"]
        self.assertEqual(row["Facility Status"], "CLOSED")
        self.assertEqual(str(snap.newest_closed), "2026-04-06")

    def test_refuses_partial_file(self) -> None:
        with self.assertRaises(RuntimeError):
            live.parse_bulk_csv(bulk_text([("347005239", "X", "LICENSED", "")]), fetched_at=NOW)

    def test_refuses_missing_columns(self) -> None:
        with self.assertRaises(RuntimeError):
            live.parse_bulk_csv('"Facility Number","Facility Name"\n"1","x"\n', fetched_at=NOW, min_rows=1)


class DetailStatusTests(unittest.TestCase):
    def test_change_of_ownership_is_closed(self) -> None:
        self.assertEqual(live.detail_status({"STATUS": "Closed, Change of Ownership"}), "CLOSED")

    def test_probation(self) -> None:
        self.assertEqual(live.detail_status({"STATUS": "Probationary License"}), "ON PROBATION")

    def test_withdrawn_application_matches_bulk_closed(self) -> None:
        self.assertEqual(live.detail_status({"STATUS": "Application Withdrawn"}), "CLOSED")
        self.assertEqual(live.detail_status({"STATUS": "Application Denied"}), "CLOSED")

    def test_pending_increase_is_licensed(self) -> None:
        self.assertEqual(live.detail_status({"STATUS": "Licensed/Pending Increase"}), "LICENSED")

    def test_blank_is_unknown(self) -> None:
        self.assertEqual(live.detail_status({"STATUS": ""}), "")

    def test_licensed(self) -> None:
        self.assertEqual(live.detail_status({"STATUS": "Licensed"}), "LICENSED")


class CompareTests(unittest.TestCase):
    def test_abbreviations_are_not_mismatches(self) -> None:
        db = {"license_status": "LICENSED", "name": "Rosegate", "street": "3003 Fruitvale Avenue",
              "city": "Oakland", "zip": "94602", "beds": 6, "operator_name": "A & B, Llc"}
        cdss = {"Facility Status": "LICENSED", "Facility Name": "ROSEGATE", "Facility Address": "3003 FRUITVALE AVE",
                "Facility City": "OAKLAND", "Facility Zip": "94602-1111", "Facility Capacity": "6", "Licensee": "A AND B LLC"}
        self.assertEqual(refresh.compare_row(db, cdss), [])

    def test_status_and_direction_mismatch(self) -> None:
        db = {"license_status": "LICENSED", "name": "X", "street": "125 E. Sierra Madre Ave", "city": "Glendora",
              "zip": "91741", "beds": 6, "operator_name": "Y"}
        cdss = {"Facility Status": "CLOSED", "Facility Name": "X", "Facility Address": "125 W SIERRA MADRE AVE",
                "Facility City": "GLENDORA", "Facility Zip": "91741", "Facility Capacity": "6", "Licensee": "Y"}
        fields = {f for f, _, _ in refresh.compare_row(db, cdss)}
        self.assertEqual(fields, {"license_status", "street"})

    def test_confirmation_rule(self) -> None:
        self.assertTrue(refresh.needs_detail_confirmation("LICENSED", "CLOSED"))
        self.assertTrue(refresh.needs_detail_confirmation("CLOSED", "LICENSED"))
        self.assertFalse(refresh.needs_detail_confirmation("PENDING", "LICENSED"))


class ClosedUnpublishTests(unittest.TestCase):
    def test_confirmed_closed_unpublishes(self) -> None:
        self.assertTrue(refresh.closes_listing({"new": "CLOSED", "detail_status": "CLOSED"}))

    def test_unconfirmed_closed_does_not_unpublish(self) -> None:
        self.assertFalse(refresh.closes_listing({"new": "CLOSED"}))
        self.assertFalse(refresh.closes_listing({"new": "CLOSED", "detail_status": "LICENSED"}))

    def test_probation_and_reopen_do_not_unpublish(self) -> None:
        self.assertFalse(refresh.closes_listing({"new": "ON PROBATION", "detail_status": "ON PROBATION"}))
        self.assertFalse(refresh.closes_listing({"new": "LICENSED", "detail_status": "LICENSED"}))


class IngestRowTests(unittest.TestCase):
    def test_new_rows_are_unpublished_and_carry_provenance(self) -> None:
        try:
            import ccld_rcfe_ingest as ingest
        except ImportError as exc:  # psycopg not installed locally
            self.skipTest(str(exc))
        roster = ingest.bulk_row_to_roster({
            "Facility Type": "RESIDENTIAL CARE ELDERLY", "Facility Number": "342702020",
            "Facility Name": "SPANISH VINES AL AND MEMORY CARE", "Licensee": "L", "Facility Administrator": "A",
            "Facility Telephone Number": "", "Facility Address": "7548 GREENHAVEN DR", "Facility City": "SACRAMENTO",
            "Facility Zip": "95831-1234", "County Name": "SACRAMENTO", "Facility Capacity": "105",
            "Facility Status": "LICENSED", "License First Date": "4/6/2026", "Closed Date": "", "Last Visit Date": "",
        })
        row = ingest.build_facility_row(roster, None, ingest_county="SACRAMENTO")
        self.assertIsNotNone(row)
        self.assertFalse(row["publishable"])
        self.assertEqual(row["zip"], "95831")
        self.assertEqual(row["license_status_source"], live.SOURCE_BULK)
        self.assertIn("publishable", ingest.INSERT_SQL)
        self.assertNotIn("publishable = true", ingest.UPDATE_SQL)
        self.assertIn("THEN false ELSE publishable END", ingest.UPDATE_SQL)


if __name__ == "__main__":
    unittest.main()
