#!/usr/bin/env python3
"""Regression tests for the bounded, incremental California report scan."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from scrapers import ccld_citations_ingest as ingest


FACILITY = {
    "id": "00000000-0000-0000-0000-000000000001",
    "name": "Test Home",
    "license_number": "123456",
    "serves_memory_care": True,
}


class CaliforniaIncrementalScanTests(unittest.TestCase):
    def test_known_report_urls_require_no_report_download_or_db_connection(self) -> None:
        """Routine scans should use the index to skip records already stored."""
        fac_num = "000123456"
        known_urls = {
            f"{ingest.TRANSPARENCY_BASE}/FacilityReports?facNum={fac_num}&inx=0",
            f"{ingest.TRANSPARENCY_BASE}/FacilityReports?facNum={fac_num}&inx=1",
        }
        index = {"COUNT": 2, "REPORTARRAY": [{}, {}]}

        with (
            patch.object(ingest, "fetch_report_index", return_value=index),
            patch.object(ingest, "fetch_report_html") as fetch_html,
            patch.object(ingest.psycopg, "connect") as connect,
        ):
            result = ingest.process_facility(
                FACILITY,
                None,
                "00000000-0000-0000-0000-000000000002",
                already_ingested=known_urls,
                dsn="unused",
            )

        self.assertEqual(result["index_checked"], 1)
        self.assertEqual(result["reports_skipped"], 2)
        self.assertEqual(result["reports_ingested"], 0)
        fetch_html.assert_not_called()
        connect.assert_not_called()

    def test_report_inventory_is_zero_based_and_uses_stable_document_id(self) -> None:
        """Report identity must survive CDSS array reordering."""
        reports = ingest.normalize_report_inventory(
            [
                {
                    "REPORTPAGE": (
                        "/WebReports/ABC.nsf/0/"
                        "1FDE0D06FF9530AE88258E79000019DE?OpenDocument"
                    )
                },
                {"REPORTPAGE": ""},
            ]
        )

        self.assertEqual([report["index"] for report in reports], [0, 1])
        self.assertEqual(
            reports[0]["key"],
            "1fde0d06ff9530ae88258e79000019de",
        )

    def test_failed_listed_detail_does_not_advance_snapshot(self) -> None:
        """A partial facility reconciliation must remain eligible for retry."""
        index = {
            "COUNT": 1,
            "REPORTARRAY": [
                {
                    "REPORTPAGE": (
                        "/WebReports/ABC.nsf/0/"
                        "1FDE0D06FF9530AE88258E79000019DE?OpenDocument"
                    )
                }
            ],
        }
        bulk = {"fingerprint": "new", "payload": {"Total Visits": "1"}}

        with (
            patch.object(ingest, "fetch_report_index", return_value=index),
            patch.object(ingest, "fetch_report_html", return_value=None),
        ):
            result = ingest.process_facility(
                FACILITY,
                None,
                "00000000-0000-0000-0000-000000000002",
                already_ingested=set(),
                dsn="unused",
                bulk_snapshot=bulk,
            )

        self.assertEqual(result["errors"], 1)
        self.assertNotIn("_snapshot_update", result)

    def test_repeated_index_failures_open_the_outage_circuit(self) -> None:
        """A CDSS outage should fail partial quickly instead of hanging for hours."""
        breaker = ingest.IndexCircuitBreaker(failure_threshold=2)

        with patch.object(
            ingest,
            "fetch_report_index",
            side_effect=RuntimeError("CDSS timed out"),
        ) as fetch_index:
            for _ in range(3):
                result = ingest.process_facility(
                    FACILITY,
                    None,
                    "00000000-0000-0000-0000-000000000002",
                    already_ingested=set(),
                    dsn="unused",
                    index_breaker=breaker,
                )
                self.assertEqual(result["errors"], 1)

        self.assertTrue(breaker.is_open)
        self.assertEqual(fetch_index.call_count, 2)

    def test_expired_scan_budget_marks_home_unchecked_without_request(self) -> None:
        """The routine crawl must not turn a source slowdown into an afternoon."""
        with (
            patch.object(ingest.time, "monotonic", return_value=100.0),
            patch.object(ingest, "fetch_report_index") as fetch_index,
        ):
            result = ingest.process_facility(
                FACILITY,
                None,
                "00000000-0000-0000-0000-000000000002",
                already_ingested=set(),
                dsn="unused",
                deadline=99.0,
            )

        self.assertEqual(result["index_checked"], 0)
        self.assertEqual(result["errors"], 1)
        fetch_index.assert_not_called()


if __name__ == "__main__":
    unittest.main()
