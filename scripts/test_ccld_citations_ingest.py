#!/usr/bin/env python3
"""Regression tests for the bounded, incremental California report scan."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scrapers import ccld_citations_ingest as ingest


FACILITY = {
    "id": "00000000-0000-0000-0000-000000000001",
    "name": "Test Home",
    "license_number": "123456",
    "serves_memory_care": True,
}


class CaliforniaIncrementalScanTests(unittest.TestCase):
    def test_preflight_waits_for_cold_report_api(self) -> None:
        """A cold CDSS service should warm before statewide concurrency starts."""
        with (
            patch.object(
                ingest,
                "fetch_report_index",
                side_effect=[RuntimeError("cold"), {"COUNT": 0, "REPORTARRAY": []}],
            ) as fetch_index,
            patch.object(ingest.time, "sleep") as sleep,
        ):
            ready = ingest.wait_for_report_api(
                "000123456",
                attempts=2,
                pause_seconds=0,
            )

        self.assertTrue(ready)
        self.assertEqual(fetch_index.call_count, 2)
        sleep.assert_called_once_with(0)

    def test_startup_probe_is_reused_for_that_facility(self) -> None:
        """The health gate must not cost an extra index call on the probed home."""
        calls = {"count": 0}

        def fake_index(_fac_num: str, **_kwargs: object) -> dict[str, object]:
            calls["count"] += 1
            return {"COUNT": 0, "REPORTARRAY": []}

        ingest._PREFLIGHT_INDEX.clear()
        with patch.object(ingest, "_fetch_report_index_network", fake_index):
            ready = ingest.wait_for_report_api("123456", attempts=1, pause_seconds=0)
            reused = ingest.fetch_report_index("000123456")

        self.assertTrue(ready)
        self.assertEqual(reused["COUNT"], 0)
        self.assertEqual(calls["count"], 1)

    def test_preflight_fails_bounded_when_source_stays_down(self) -> None:
        """A true outage must fail partial without releasing hundreds of calls."""
        with (
            patch.object(
                ingest,
                "fetch_report_index",
                side_effect=RuntimeError("down"),
            ) as fetch_index,
            patch.object(ingest.time, "sleep"),
        ):
            ready = ingest.wait_for_report_api(
                "000123456",
                attempts=3,
                pause_seconds=0,
            )

        self.assertFalse(ready)
        self.assertEqual(fetch_index.call_count, 3)

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

    def test_partial_progress_keeps_confirmed_reports_without_claiming_complete(self) -> None:
        """A saved baseline must not include a report the detail call never returned."""
        fac_num = "000123456"
        index = {
            "COUNT": 2,
            "REPORTARRAY": [
                {},
                {
                    "REPORTPAGE": (
                        "/WebReports/ABC.nsf/0/"
                        "1FDE0D06FF9530AE88258E79000019DE?OpenDocument"
                    )
                },
            ],
        }
        known_urls = {
            f"{ingest.TRANSPARENCY_BASE}/FacilityReports?facNum={fac_num}&inx=0"
        }
        bulk = {"fingerprint": "bulk-fp", "payload": {"Total Visits": "2"}}

        with (
            patch.object(ingest, "fetch_report_index", return_value=index),
            patch.object(ingest, "fetch_report_html", return_value=None),
        ):
            result = ingest.process_facility(
                FACILITY,
                None,
                "00000000-0000-0000-0000-000000000002",
                already_ingested=known_urls,
                dsn="unused",
                bulk_snapshot=bulk,
            )

        self.assertEqual(result["errors"], 1)
        snapshot = result["_snapshot_update"]
        self.assertTrue(snapshot[1].startswith("pending:"))
        self.assertNotEqual(snapshot[1], "bulk-fp")
        self.assertEqual(snapshot[2]["reconciliation"], "pending")
        self.assertEqual(len(snapshot[2]["reports"]), 1)
        self.assertNotIn(
            "1fde0d06ff9530ae88258e79000019de",
            {report["key"] for report in snapshot[2]["reports"]},
        )

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

    def test_outage_circuit_allows_one_retry_after_a_cool_down(self) -> None:
        """A later facility should get a chance if CDSS recovers."""
        breaker = ingest.IndexCircuitBreaker(failure_threshold=1)
        clock = {"now": 100.0}

        with (
            patch.object(ingest.time, "monotonic", lambda: clock["now"]),
            patch.object(
                ingest,
                "fetch_report_index",
                side_effect=[RuntimeError("down"), {"COUNT": 0, "REPORTARRAY": []}],
            ) as fetch_index,
        ):
            first = ingest.process_facility(
                FACILITY,
                None,
                "00000000-0000-0000-0000-000000000002",
                already_ingested=set(),
                dsn="unused",
                index_breaker=breaker,
            )
            self.assertEqual(first["index_checked"], 0)
            clock["now"] = 160.0
            second = ingest.process_facility(
                FACILITY,
                None,
                "00000000-0000-0000-0000-000000000002",
                already_ingested=set(),
                dsn="unused",
                index_breaker=breaker,
            )

        self.assertEqual(second["index_checked"], 1)
        self.assertFalse(breaker.is_open)
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

    def test_shifted_duplicate_does_not_block_reconciliation(self) -> None:
        """An already-stored report is a skip, even when its index URL moved."""
        duplicate = ingest.psycopg.errors.UniqueViolation("already stored")
        self.assertTrue(ingest.is_duplicate_inspection(duplicate))
        self.assertFalse(ingest.is_duplicate_inspection(RuntimeError("db down")))

    def test_unpublished_detail_still_baselines_a_fallback_home(self) -> None:
        """A 404 means CDSS has no document; it must not block the other reports."""
        maple = {
            **FACILITY,
            "name": "Maple Manor",
            "license_number": "372004436",
        }
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
        with (
            patch.object(ingest, "fetch_report_index", return_value=index),
            patch.object(ingest, "fetch_report_html", return_value=""),
        ):
            result = ingest.process_facility(
                maple,
                None,
                "00000000-0000-0000-0000-000000000002",
                already_ingested=set(),
                dsn="unused",
                bulk_snapshot=None,
            )

        self.assertEqual(result["errors"], 0)
        self.assertEqual(result["reports_skipped"], 1)
        self.assertTrue(result["_snapshot_update"][2]["bulk_fallback"])

    def test_retry_backoff_is_jittered(self) -> None:
        """Workers must not wake up and retry at the same instant."""
        with patch.object(ingest.random, "uniform", return_value=0.5):
            self.assertAlmostEqual(ingest.retry_sleep_seconds(0), 0.4)
        with patch.object(ingest.random, "uniform", return_value=1.5):
            self.assertAlmostEqual(ingest.retry_sleep_seconds(0), 1.2)

    def test_token_bucket_spaces_back_to_back_requests(self) -> None:
        """A shared pacer keeps concurrent report calls from bursting."""
        pacer = ingest.RequestPacer(min_interval=0.4)
        clock = {"now": 10.0}

        def monotonic() -> float:
            return clock["now"]

        def sleep(seconds: float) -> None:
            clock["now"] += seconds

        with (
            patch.object(ingest.time, "monotonic", monotonic),
            patch.object(ingest.time, "sleep", sleep),
            patch.object(ingest.random, "uniform", return_value=0.0),
        ):
            pacer.acquire()
            pacer.acquire()

        self.assertGreaterEqual(clock["now"], 10.4)

    def test_health_history_keeps_concurrency_low_after_timeouts(self) -> None:
        """Recent CDSS timeouts should hold the next run to one worker."""
        cold: list[dict[str, object]] = []
        unhealthy = [
            {"requests": 10, "timeouts": 4, "latency_ms": 9000}
            for _ in range(3)
        ]
        healthy = [
            {"requests": 20, "timeouts": 0, "latency_ms": 400}
            for _ in range(3)
        ]

        self.assertEqual(ingest.recommend_worker_count(cold), 1)
        self.assertEqual(ingest.recommend_worker_count(unhealthy), 1)
        self.assertEqual(ingest.recommend_worker_count(healthy), 4)

    def test_unchanged_facilities_need_no_report_calls_except_fallbacks(self) -> None:
        """A stable bulk fingerprint is the routine fast path."""
        stable = {
            **FACILITY,
            "license_number": "197608878",
        }
        maple = {
            **FACILITY,
            "id": "00000000-0000-0000-0000-000000000002",
            "name": "Maple Manor",
            "license_number": "372004436",
        }
        desert = {
            **FACILITY,
            "id": "00000000-0000-0000-0000-000000000003",
            "name": "Desert Hills Memory Care Center",
            "license_number": "331880722",
        }
        bulk = {
            stable["id"]: {"fingerprint": "same", "payload": {}},
        }
        previous = {stable["id"]: {"fingerprint": "same"}}

        selected = ingest.select_reconciliation_targets(
            [stable, maple, desert],
            bulk,
            previous,
            refetch=False,
        )

        self.assertEqual([facility["name"] for facility in selected["unchanged"]], ["Test Home"])
        self.assertEqual(
            {facility["license_number"] for facility in selected["deep"]},
            {"372004436", "331880722"},
        )
        self.assertEqual(selected["missing_bulk"], [])

    def test_fallback_without_bulk_row_still_gets_a_resumable_snapshot(self) -> None:
        """Maple Manor is absent from the CSV, but a clean index is still a baseline."""
        maple = {
            **FACILITY,
            "name": "Maple Manor",
            "license_number": "372004436",
        }
        with patch.object(
            ingest,
            "fetch_report_index",
            return_value={"COUNT": 0, "REPORTARRAY": []},
        ):
            result = ingest.process_facility(
                maple,
                None,
                "00000000-0000-0000-0000-000000000002",
                already_ingested=set(),
                dsn="unused",
                bulk_snapshot=None,
            )

        self.assertEqual(result["errors"], 0)
        self.assertIn("_snapshot_update", result)
        self.assertTrue(result["_snapshot_update"][2]["bulk_fallback"])

    def test_regulator_vault_stays_off_unless_requested(self) -> None:
        """Archiving originals must not become part of the normal crawl."""
        with tempfile.TemporaryDirectory() as tmp:
            with (
                patch.object(ingest, "VAULT_ROOT", Path(tmp)),
                patch.dict(os.environ, {"STARLYNN_REGULATOR_VAULT": "0"}),
            ):
                ingest.stage_regulator_original("abcdef", "<html>secret</html>")
            self.assertEqual(list(Path(tmp).rglob("*")), [])

    def test_regulator_vault_is_content_addressed(self) -> None:
        """The same Lotus id is stored once, even if CDSS is fetched again."""
        with tempfile.TemporaryDirectory() as tmp:
            with (
                patch.object(ingest, "VAULT_ROOT", Path(tmp)),
                patch.dict(os.environ, {"STARLYNN_REGULATOR_VAULT": "1"}),
            ):
                ingest.stage_regulator_original("abcdef", "<html>one</html>")
                ingest.stage_regulator_original("abcdef", "<html>two</html>")
            stored = (Path(tmp) / "ab" / "abcdef.html").read_text()

        self.assertEqual(stored, "<html>one</html>")


if __name__ == "__main__":
    unittest.main()
