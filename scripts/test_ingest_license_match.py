#!/usr/bin/env python3
"""License-before-slug ingest tests.

A regulator rename must update the facility families already have a URL for.
These tests fail if a new name inserts a second row, or if a stored slug moves.
"""

from __future__ import annotations

import csv
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SCRAPERS = ROOT / "scrapers"
if str(SCRAPERS) not in sys.path:
    sys.path.insert(0, str(SCRAPERS))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import _license_match
import az_adhs_directory_ingest as az_adhs
import mn_alrc_ingest
import mn_mdh_directory_ingest
import or_dhs_ltc_directory_ingest as or_dhs
import or_providers_ingest
import tx_alf_ingest
import wa_dshs_directory_ingest as wa_dshs
from _license_match import load_identity_map, reuse_identity

INGEST_FILES = (
    "scrapers/or_dhs_ltc_directory_ingest.py",
    "scrapers/or_providers_ingest.py",
    "scrapers/mn_mdh_directory_ingest.py",
    "scrapers/mn_alrc_ingest.py",
    "scrapers/tx_alf_ingest.py",
    "scrapers/wa_dshs_directory_ingest.py",
)


class SlugConflict(Exception):
    """The external-id insert collided with an existing slug, as Postgres would."""


def _columns(sql: str) -> list[str]:
    match = re.search(r"select\s+(.*?)\s+from\s+facilities", sql, re.I | re.S)
    if not match:
        raise AssertionError(f"not a facilities select: {sql[:80]!r}")
    cols: list[str] = []
    for part in match.group(1).split(","):
        token = re.sub(r"::\w+", "", part).strip()
        if not token:
            continue
        cols.append(token.split()[-1])
    return cols


def _update_parts(sql: str) -> list[str]:
    lowered = sql.lower()
    start = lowered.find("do update set")
    if start < 0:
        return []
    block = sql[start + len("do update set"):]
    returning = re.search(r"\breturning\b", block, re.I)
    if returning:
        block = block[:returning.start()]
    parts: list[str] = []
    buf: list[str] = []
    depth = 0
    for ch in block:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(" ".join("".join(buf).split()))
            buf = []
        else:
            buf.append(ch)
    tail = " ".join("".join(buf).split())
    if tail:
        parts.append(tail)
    return [part for part in parts if part]


def _assign_update(dest: dict[str, Any], src: dict[str, Any], sql: str) -> None:
    """Apply one DO UPDATE SET the way the SQL is written. Columns it omits stay."""
    for part in _update_parts(sql):
        excluded = re.match(r"(\w+)\s*=\s*excluded\.(\w+)$", part, re.I)
        if excluded:
            dest[excluded.group(1)] = src.get(excluded.group(2))
            continue
        coalesced = re.match(
            r"(\w+)\s*=\s*coalesce\(\s*(excluded|facilities)\.(\w+)\s*,\s*"
            r"(excluded|facilities)\.(\w+)\s*\)$",
            part,
            re.I,
        )
        if coalesced:
            dest_col = coalesced.group(1)

            def _val(side: str, col: str) -> Any:
                return src.get(col) if side.lower() == "excluded" else dest.get(col)

            primary = _val(coalesced.group(2), coalesced.group(3))
            dest[dest_col] = primary if primary is not None else _val(
                coalesced.group(4), coalesced.group(5)
            )
            continue
        cased = re.match(r"(\w+)\s*=\s*case\b", part, re.I)
        if cased:
            col = cased.group(1)
            if dest.get(col) not in ("reviewed_publish", "reviewed_reject"):
                dest[col] = src.get(col)
            continue
        if re.match(r"\w+\s*=\s*now\(\)$", part, re.I):
            continue
        raise AssertionError(f"unparsed update assignment: {part}")


class FakeConn:
    """In-memory facilities table. Selects honor the identity ORDER BY."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def cursor(self) -> "FakeCursor":
        return FakeCursor(self)

    def commit(self) -> None:
        return None

    def __enter__(self) -> "FakeConn":
        return self

    def __exit__(self, *_exc: object) -> bool:
        return False

    def serve_select(self, sql: str, params: Any) -> list[tuple[Any, ...]]:
        state = params[0] if params else None
        rows = [row for row in self.rows if state is None or row.get("state_code") == state]
        lowered = " ".join(sql.split()).lower()
        if "license_number is not null or external_id is not null" in lowered:
            rows = [row for row in rows if row.get("license_number") or row.get("external_id")]
        if "order by publishable desc, created_at asc, id" in lowered:
            rows = sorted(
                rows,
                key=lambda row: (
                    0 if row.get("publishable") else 1,
                    str(row.get("created_at") or ""),
                    str(row.get("id") or ""),
                ),
            )
        cols = _columns(sql)
        return [tuple(row.get(col) for col in cols) for row in rows]

    def apply_upsert(self, sql: str, rec: dict[str, Any]) -> None:
        lowered = " ".join(sql.split()).lower()
        if "on conflict (state_code, external_id)" in lowered:
            ext = rec.get("external_id")
            hit = next(
                (
                    row for row in self.rows
                    if ext and row.get("state_code") == rec.get("state_code")
                    and row.get("external_id") == ext
                ),
                None,
            )
            if hit:
                _assign_update(hit, rec, sql)
                return
            if _find_slug(self.rows, rec):
                raise SlugConflict(rec.get("slug"))
            self.rows.append(_copy_row(rec, len(self.rows)))
            return
        if "on conflict (state_code, city_slug, slug)" in lowered:
            hit = _find_slug(self.rows, rec)
            if hit:
                _assign_update(hit, rec, sql)
                return
            self.rows.append(_copy_row(rec, len(self.rows)))
            return
        raise AssertionError(f"unhandled upsert: {lowered[:100]}")


def _find_slug(rows: list[dict[str, Any]], rec: dict[str, Any]) -> dict[str, Any] | None:
    for row in rows:
        if (
            row.get("state_code") == rec.get("state_code")
            and row.get("city_slug") == rec.get("city_slug")
            and row.get("slug") == rec.get("slug")
        ):
            return row
    return None


def _copy_row(rec: dict[str, Any], n: int) -> dict[str, Any]:
    row = {k: v for k, v in rec.items() if not str(k).startswith("_")}
    row.setdefault("id", f"new-{n + 1}")
    row.setdefault("publishable", False)
    row.setdefault("created_at", "2099-01-01")
    row.setdefault("external_id", None)
    return row


class _Column:
    def __init__(self, name: str) -> None:
        self.name = name


class FakeCursor:
    def __init__(self, conn: FakeConn) -> None:
        self.conn = conn
        self._fetched: list[tuple[Any, ...]] = []
        self.description: list[_Column] = []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *_exc: object) -> bool:
        return False

    def execute(self, sql: str, params: Any = None) -> None:
        lowered = " ".join(sql.split()).lower()
        if lowered.startswith(("savepoint", "release", "rollback")):
            return
        if lowered.startswith("select"):
            self._fetched = self.conn.serve_select(sql, params)
            self.description = [_Column(col) for col in _columns(sql)]
            return
        if "on conflict" in lowered:
            self.conn.apply_upsert(sql, params if isinstance(params, dict) else {})
            self._fetched = [(self.conn.rows[-1].get("id"),)]
            return
        raise AssertionError(f"unexpected SQL: {lowered[:120]}")

    def executemany(self, sql: str, seq: Any) -> None:
        for params in seq:
            self.execute(sql, params)

    def fetchall(self) -> list[tuple[Any, ...]]:
        return list(self._fetched)

    def fetchone(self) -> tuple[Any, ...]:
        if self._fetched:
            return self._fetched[0]
        return ("ok",)


def _do_update_blocks(text: str) -> list[str]:
    blocks: list[str] = []
    for match in re.finditer(r"DO UPDATE SET\b(.*?)(?:\"\"\"|''')", text, re.S | re.I):
        blocks.append(match.group(1))
    return blocks


def _oak_existing() -> dict[str, Any]:
    return {
        "id": "or-oak",
        "state_code": "OR",
        "name": "Oak Lane Residential Care Facility",
        "slug": "oak-lane-residential-care-facility-50m133",
        "city_slug": "grants-pass",
        "external_id": "50M133",
        "license_number": "50M133",
        "publishable": True,
        "created_at": "2020-01-01",
    }


def _oak_csv_record() -> dict[str, Any]:
    headers = ["ID", "Name", "City", "Status", "Licensed beds"]
    row = {
        "ID": "50M133",
        "Name": "OAK LANE SENIOR LIVING AND MEMORY CARE",
        "City": "Grants Pass",
        "Status": "Open",
        "Licensed beds": "12",
    }
    rec = or_dhs.row_to_record(headers, row)
    if rec is None:
        raise AssertionError("Oak Lane CSV row was dropped")
    return rec


class _ReviewTempMixin:
    """Keep the publishable review file out of scrapers/out during tests."""

    def setUp(self) -> None:
        self._review_dir = tempfile.TemporaryDirectory()
        self._review_patch = mock.patch.object(
            _license_match,
            "REVIEW_LOG_PATH",
            Path(self._review_dir.name) / "review.jsonl",
        )
        self._review_patch.start()

    def tearDown(self) -> None:
        self._review_patch.stop()
        self._review_dir.cleanup()


class OakLaneTests(_ReviewTempMixin, unittest.TestCase):
    def test_rename_reuses_slug_and_verbatim_license(self) -> None:
        """50M133 already has a URL. A new name must not insert a second Oregon home."""
        incoming = _oak_csv_record()
        self.assertEqual(incoming["license_number"], "50M133")
        self.assertEqual(incoming["slug"], "oak-lane-senior-living-and-memory-care-50m133")
        self.assertEqual(incoming["_raw_id"], "50M133")

        bare = dict(incoming)
        without = FakeConn([_oak_existing()])
        without.apply_upsert(or_dhs.OR_UPSERT_SQL, bare)
        self.assertEqual(len(without.rows), 2)

        conn = FakeConn([_oak_existing()])
        or_dhs.upsert_facilities(conn, [incoming])
        self.assertEqual(len(conn.rows), 1)
        row = conn.rows[0]
        self.assertEqual(row["slug"], "oak-lane-residential-care-facility-50m133")
        self.assertEqual(row["city_slug"], "grants-pass")
        self.assertEqual(row["license_number"], "50M133")
        self.assertEqual(row["name"], "Oak Lane Senior Living and Memory Care")


class OregonLicenseIdTests(unittest.TestCase):
    def test_alphanumeric_and_numeric_ids_stay_as_printed(self) -> None:
        """50M133 must not become 0000050133, and a numeric ID must not be padded."""
        self.assertEqual(or_dhs.pad_license_or("50M133"), "50M133")
        self.assertEqual(or_dhs.pad_license_or("50m133"), "50m133")
        self.assertEqual(or_dhs.pad_license_or("50133"), "50133")
        self.assertEqual(or_dhs.pad_license_or("000123"), "000123")
        self.assertEqual(
            or_dhs.facility_slug("Oak Lane Residential Care Facility", "50M133"),
            "oak-lane-residential-care-facility-50m133",
        )

    def test_slug_hit_keeps_an_existing_license(self) -> None:
        """A slug conflict must not replace a license that is already on the row."""
        existing = {
            "id": "or-1",
            "state_code": "OR",
            "name": "Oak Lane",
            "slug": "oak-lane-50m133",
            "city_slug": "grants-pass",
            "license_number": "50M133",
            "external_id": "50M133",
            "publishable": True,
            "created_at": "2020-01-01",
        }
        incoming = {
            "state_code": "OR",
            "name": "Oak Lane Senior Living",
            "slug": "oak-lane-50m133",
            "city_slug": "grants-pass",
            "license_number": "0000050133",
        }
        conn = FakeConn([existing])
        conn.apply_upsert(or_dhs.OR_UPSERT_SQL, incoming)
        self.assertEqual(len(conn.rows), 1)
        self.assertEqual(conn.rows[0]["license_number"], "50M133")
        self.assertEqual(conn.rows[0]["name"], "Oak Lane Senior Living")


class RenameInPlaceTests(_ReviewTempMixin, unittest.TestCase):
    def test_each_state_updates_the_licensed_row(self) -> None:
        """Same license, new name: one row, and the public slug does not move."""
        cases = [
            ("OR-numeric", "OR", "0000012345", or_dhs, or_dhs.OR_UPSERT_SQL, True),
            ("MN-hfid", "MN", "0000123456", mn_mdh_directory_ingest, mn_mdh_directory_ingest.MN_UPSERT_SQL, False),
            ("TX-six", "TX", "012345", tx_alf_ingest, tx_alf_ingest.UPSERT_SQL, False),
            ("WA-ten", "WA", "0000002528", wa_dshs, wa_dshs.WA_UPSERT_SQL, True),
        ]
        for label, state, lic, mod, sql, keep in cases:
            with self.subTest(label):
                old_slug = mod.facility_slug("Old Name Place", lic)
                new_slug = mod.facility_slug("New Name Place", lic)
                self.assertNotEqual(old_slug, new_slug)
                existing = {
                    "id": f"{state}-1",
                    "state_code": state,
                    "name": "Old Name Place",
                    "slug": old_slug,
                    "city_slug": "old-city",
                    "license_number": lic,
                    "external_id": lic,
                    "publishable": True,
                    "created_at": "2020-01-01",
                }
                incoming = {
                    "state_code": state,
                    "name": "New Name Place",
                    "slug": new_slug,
                    "city_slug": "new-city",
                    "license_number": lic,
                }
                bare = dict(incoming)
                without = FakeConn([dict(existing)])
                without.apply_upsert(sql, bare)
                self.assertEqual(len(without.rows), 2, label)

                conn = FakeConn([existing])
                if state == "OR":
                    or_dhs.upsert_facilities(conn, [incoming])
                elif state == "MN":
                    mn_mdh_directory_ingest.upsert_facilities(conn, [incoming])
                elif state == "TX":
                    tx_alf_ingest.upsert_facilities(conn, [incoming])
                else:
                    wa_dshs.upsert_facilities(conn, [incoming])
                self.assertEqual(len(conn.rows), 1)
                self.assertEqual(conn.rows[0]["slug"], old_slug)
                self.assertEqual(conn.rows[0]["city_slug"], "old-city")
                self.assertEqual(conn.rows[0]["name"], "New Name Place")
                self.assertTrue(keep or conn.rows[0]["license_number"] == lic)

    def test_or_alphanumeric_id_matches_raw_and_padded_forms(self) -> None:
        """Oregon 50M133 is stored verbatim. The padded form must still find that row."""
        existing = _oak_existing()
        incoming = {
            "state_code": "OR",
            "name": "Oak Lane Senior Living and Memory Care",
            "license_number": "0000050133",
            "slug": "oak-lane-senior-living-and-memory-care-50133",
            "city_slug": "somewhere-else",
            "_raw_id": "50M133",
        }
        conn = FakeConn([existing])
        or_dhs.upsert_facilities(conn, [incoming])
        self.assertEqual(len(conn.rows), 1)
        self.assertEqual(conn.rows[0]["slug"], existing["slug"])
        self.assertEqual(conn.rows[0]["license_number"], "50M133")

    def test_wa_hand_renumbered_slug_stays(self) -> None:
        """Rosario's URL still ends in 2528 after the license was corrected by hand."""
        existing = {
            "id": "wa-rosario",
            "state_code": "WA",
            "name": "Rosario Assisted Living",
            "slug": "rosario-assisted-living-2528",
            "city_slug": "seattle",
            "license_number": "0000002791",
            "external_id": None,
            "publishable": True,
            "created_at": "2020-06-01",
        }
        incoming = {
            "state_code": "WA",
            "name": "Rosario Senior Living",
            "slug": wa_dshs.facility_slug("Rosario Senior Living", "0000002791"),
            "city_slug": "tacoma",
            "license_number": "0000002791",
        }
        self.assertNotEqual(incoming["slug"], existing["slug"])
        conn = FakeConn([existing])
        wa_dshs.upsert_facilities(conn, [incoming])
        self.assertEqual(len(conn.rows), 1)
        self.assertEqual(conn.rows[0]["slug"], "rosario-assisted-living-2528")
        self.assertEqual(conn.rows[0]["city_slug"], "seattle")
        self.assertEqual(conn.rows[0]["license_number"], "0000002791")
        self.assertEqual(conn.rows[0]["name"], "Rosario Senior Living")

    def test_or_providers_null_external_id_hits_the_license(self) -> None:
        """A home filed before external_id was stored must not be inserted again."""
        existing = _oak_existing()
        existing["external_id"] = None
        incoming_row = {
            "ID": "50M133",
            "Name": "OAK LANE SENIOR LIVING AND MEMORY CARE",
            "Type": "RCF",
            "Address": "1 Oak Lane",
            "City": "Grants Pass",
            "Zip": "97526",
            "County": "Josephine",
            "Licensed beds": "12",
            "Accepts Medicaid": "No",
            "Memory Care": "Yes",
            "Status": "Open",
        }
        rec = or_providers_ingest.row_to_record(incoming_row)
        if rec is None:
            raise AssertionError("providers row dropped")
        self.assertNotEqual(rec["slug"], existing["slug"])

        without = FakeConn([dict(existing)])
        without.apply_upsert(or_providers_ingest.UPSERT_BY_EXT_ID_SQL, {
            k: v for k, v in rec.items() if not str(k).startswith("_")
        })
        self.assertEqual(len(without.rows), 2)

        conn = FakeConn([existing])
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "providers.csv"
            with path.open("w", newline="", encoding="utf-8") as fh:
                writer = csv.DictWriter(fh, fieldnames=list(incoming_row))
                writer.writeheader()
                writer.writerow(incoming_row)
            real_get_conn = or_providers_ingest.get_conn
            or_providers_ingest.get_conn = lambda: conn  # type: ignore[method-assign]
            review = Path(tmp) / "review.jsonl"
            try:
                with mock.patch.object(_license_match, "REVIEW_LOG_PATH", review):
                    or_providers_ingest.ingest(path, dry_run=False, limit=None)
            finally:
                or_providers_ingest.get_conn = real_get_conn
        self.assertEqual(len(conn.rows), 1)
        self.assertEqual(conn.rows[0]["slug"], "oak-lane-residential-care-facility-50m133")
        self.assertEqual(conn.rows[0]["city_slug"], "grants-pass")
        self.assertEqual(conn.rows[0]["license_number"], "50M133")
        self.assertEqual(conn.rows[0]["name"], "Oak Lane Senior Living and Memory Care")


class IdentityHelperTests(_ReviewTempMixin, unittest.TestCase):
    def test_new_license_inserts_and_leaves_the_slug_alone(self) -> None:
        """A license we have never seen is a real new home, on today's slug."""
        rec = {
            "state_code": "TX",
            "name": "Brand New Home",
            "license_number": "999999",
            "slug": "brand-new-home-999999",
            "city_slug": "austin",
        }
        before = dict(rec)
        conn = FakeConn([])
        self.assertFalse(reuse_identity(rec, {}, [rec["license_number"]]))
        self.assertEqual(rec, before)
        tx_alf_ingest.upsert_facilities(conn, [rec])
        self.assertEqual(len(conn.rows), 1)
        self.assertEqual(conn.rows[0]["slug"], "brand-new-home-999999")

    def test_case_insensitive_license(self) -> None:
        """50m133 and 50M133 are the same Oregon provider."""
        conn = FakeConn([_oak_existing()])
        with conn.cursor() as cur:
            idmap = load_identity_map(cur, "OR")
        for candidate in ("50m133", "50M133", " 50M133 "):
            rec = {"slug": "new", "city_slug": "new", "license_number": "padded"}
            self.assertTrue(reuse_identity(rec, idmap, [candidate], keep_stored_license=True))
            self.assertEqual(rec["slug"], "oak-lane-residential-care-facility-50m133")
            self.assertEqual(rec["license_number"], "50M133")

    def test_duplicate_license_is_skipped_and_logged(self) -> None:
        """Two homes must not be merged because they share a license. Write to neither."""
        rows = [
            {
                "id": "late",
                "state_code": "MN",
                "publishable": True,
                "created_at": "2024-01-01",
                "slug": "late-slug",
                "city_slug": "minneapolis",
                "license_number": "DUP1",
                "external_id": None,
                "name": "Late",
            },
            {
                "id": "early",
                "state_code": "MN",
                "publishable": True,
                "created_at": "2020-01-01",
                "slug": "early-slug",
                "city_slug": "minneapolis",
                "license_number": "DUP1",
                "external_id": None,
                "name": "Early",
            },
            {
                "id": "unpub",
                "state_code": "MN",
                "publishable": False,
                "created_at": "2019-01-01",
                "slug": "unpub-slug",
                "city_slug": "minneapolis",
                "license_number": "DUP1",
                "external_id": None,
                "name": "Unpub",
            },
        ]
        conn = FakeConn(rows)
        incoming = {
            "state_code": "MN",
            "name": "Renamed Home",
            "license_number": "DUP1",
            "slug": "renamed-home-dup1",
            "city_slug": "duluth",
        }
        mn_mdh_directory_ingest.upsert_facilities(conn, [incoming])
        self.assertEqual(len(conn.rows), 3)
        self.assertTrue(all(row["name"] != "Renamed Home" for row in conn.rows))
        logged = [
            json.loads(line)
            for line in _license_match.REVIEW_LOG_PATH.read_text(encoding="utf-8").splitlines()
        ]
        ambiguous = [item for item in logged if item["reason"] == "ambiguous_license"]
        self.assertEqual(len(ambiguous), 1)
        self.assertEqual(set(ambiguous[0]["row_ids"]), {"early", "late", "unpub"})
        self.assertEqual(ambiguous[0]["db_result"], "skipped")
        self.assertTrue(ambiguous[0]["run_id"])
        self.assertIn("T", ambiguous[0]["timestamp"])

    def test_blank_license_does_not_change_the_record(self) -> None:
        """A missing license is not evidence, and must not attach the row to someone else."""
        rec = {"slug": "keep-me", "city_slug": "keep-city", "license_number": None, "name": "Same"}
        before = dict(rec)
        idmap = {"50M133": {"id": "x", "slug": "other", "city_slug": "other", "license_number": "50M133"}}
        self.assertFalse(reuse_identity(rec, idmap, [None, "", "   "]))
        self.assertEqual(rec, before)

    def test_alrc_key_matches_when_the_name_fallback_would_not(self) -> None:
        """MN-ALDC-<name> changes when the name changes. ALRC:<id> is the stable key."""
        existing = {
            "id": "mn-alrc",
            "state_code": "MN",
            "name": "Lakeside",
            "slug": "lakeside-mn4",
            "city_slug": "duluth",
            "license_number": "ALRC:4",
            "external_id": None,
            "publishable": True,
            "created_at": "2021-01-01",
        }
        record = {
            "state_code": "MN",
            "name": "Lakeside Senior Living",
            "license_number": "MN-ALDC-lakeside-senior-liv",
            "slug": mn_alrc_ingest.facility_slug("Lakeside Senior Living", 4),
            "city_slug": "duluth",
        }
        self.assertNotEqual(record["slug"], existing["slug"])
        conn = FakeConn([existing])
        with conn.cursor() as cur:
            idmap = load_identity_map(cur, "MN")
        self.assertFalse(reuse_identity(dict(record), idmap, [record["license_number"], None]))
        self.assertTrue(reuse_identity(record, idmap, [record["license_number"], "ALRC:4"]))
        self.assertEqual(record["slug"], "lakeside-mn4")
        conn.apply_upsert(
            """
            INSERT INTO facilities (state_code, city_slug, slug, name)
            VALUES (%(state_code)s, %(city_slug)s, %(slug)s, %(name)s)
            ON CONFLICT (state_code, city_slug, slug) DO UPDATE SET
                name = EXCLUDED.name
            """,
            record,
        )
        self.assertEqual(len(conn.rows), 1)
        self.assertEqual(conn.rows[0]["name"], "Lakeside Senior Living")


class PublishPreserveTests(_ReviewTempMixin, unittest.TestCase):
    def test_existing_row_keeps_publishable_and_logs_the_difference(self) -> None:
        """An update must not unpublish a home or clear a memory-care decision.
        The difference is written aside for a person to review."""
        existing = {
            "id": "wa-rosario",
            "state_code": "WA",
            "name": "Rosario Assisted Living",
            "slug": "rosario-assisted-living-2528",
            "city_slug": "seattle",
            "license_number": "0000002791",
            "external_id": None,
            "publishable": True,
            "serves_memory_care": True,
            "memory_care_designation": "Washington DSHS Dementia Care Contract",
            "mc_review_status": "reviewed_publish",
            "care_category": "alf_memory_care",
            "wa_dementia_care_contract": True,
            "created_at": "2020-06-01",
        }
        incoming = {
            "state_code": "WA",
            "name": "Rosario Senior Living",
            "slug": "rosario-senior-living-2791",
            "city_slug": "tacoma",
            "license_number": "0000002791",
            "publishable": False,
            "serves_memory_care": False,
            "memory_care_designation": None,
            "mc_review_status": "needs_review",
            "care_category": "alf_general",
            "wa_dementia_care_contract": False,
        }
        conn = FakeConn([existing])
        wa_dshs.upsert_facilities(conn, [incoming])
        self.assertEqual(len(conn.rows), 1)
        row = conn.rows[0]
        self.assertEqual(row["name"], "Rosario Senior Living")
        self.assertEqual(row["slug"], "rosario-assisted-living-2528")
        self.assertTrue(row["publishable"])
        self.assertTrue(row["serves_memory_care"])
        self.assertEqual(row["mc_review_status"], "reviewed_publish")
        self.assertEqual(row["care_category"], "alf_memory_care")
        self.assertEqual(
            row["memory_care_designation"],
            "Washington DSHS Dementia Care Contract",
        )
        self.assertTrue(row["wa_dementia_care_contract"])
        logged = [
            json.loads(line)
            for line in _license_match.REVIEW_LOG_PATH.read_text(encoding="utf-8").splitlines()
        ]
        by_field = {item["field"]: item for item in logged}
        self.assertEqual(by_field["publishable"]["facility_id"], "wa-rosario")
        self.assertIs(by_field["publishable"]["db_value"], True)
        self.assertIs(by_field["publishable"]["incoming_value"], False)
        self.assertIs(by_field["serves_memory_care"]["db_value"], True)
        self.assertIs(by_field["serves_memory_care"]["incoming_value"], False)
        self.assertEqual(by_field["mc_review_status"]["db_value"], "reviewed_publish")
        self.assertEqual(by_field["mc_review_status"]["incoming_value"], "needs_review")
        self.assertEqual(by_field["publishable"]["reason"], "field_diff")
        self.assertEqual(by_field["publishable"]["db_result"], "updated")
        self.assertTrue(by_field["publishable"]["run_id"])
        self.assertIn("T", by_field["publishable"]["timestamp"])

    def test_new_insert_still_sets_the_fields(self) -> None:
        """A home that is not already in the table still gets the values this script sets."""
        incoming = {
            "state_code": "WA",
            "name": "New Home",
            "slug": "new-home-9999",
            "city_slug": "seattle",
            "license_number": "0000009999",
            "publishable": False,
            "serves_memory_care": True,
            "mc_review_status": "auto_published",
        }
        conn = FakeConn([])
        wa_dshs.upsert_facilities(conn, [incoming])
        self.assertEqual(len(conn.rows), 1)
        self.assertIs(conn.rows[0]["publishable"], False)
        self.assertIs(conn.rows[0]["serves_memory_care"], True)
        self.assertFalse(_license_match.REVIEW_LOG_PATH.exists())

    def test_do_update_leaves_preserved_fields_alone(self) -> None:
        """Every directory script's conflict update omits publishable and memory-care columns.
        The insert column list still names publishable."""
        modules = {
            "scrapers/or_dhs_ltc_directory_ingest.py": or_dhs.PRESERVE_ON_UPDATE,
            "scrapers/or_providers_ingest.py": or_providers_ingest.PRESERVE_ON_UPDATE,
            "scrapers/mn_mdh_directory_ingest.py": mn_mdh_directory_ingest.PRESERVE_ON_UPDATE,
            "scrapers/mn_alrc_ingest.py": mn_alrc_ingest.PRESERVE_ON_UPDATE,
            "scrapers/tx_alf_ingest.py": tx_alf_ingest.PRESERVE_ON_UPDATE,
            "scrapers/wa_dshs_directory_ingest.py": wa_dshs.PRESERVE_ON_UPDATE,
            "scrapers/az_adhs_directory_ingest.py": az_adhs.PRESERVE_ON_UPDATE,
        }
        for rel, fields in modules.items():
            text = (ROOT / rel).read_text(encoding="utf-8")
            blocks = _do_update_blocks(text)
            self.assertTrue(blocks, rel)
            for block in blocks:
                for field in fields:
                    self.assertIsNone(
                        re.search(rf"^\s*{re.escape(field)}\s*=", block, re.M),
                        f"{rel} still assigns {field} on update",
                    )
            self.assertIn("publishable", text.split("DO UPDATE SET", 1)[0])


class ReviewFixTests(_ReviewTempMixin, unittest.TestCase):
    def test_mn_aldc_fallback_does_not_merge_two_cities(self) -> None:
        """MN-ALDC-<name> is a truncated name, not a license. Minneapolis must not
        become the St. Louis Park row. Live rows 69968bfe and 810b02e7 share one."""
        rows = [
            {
                "id": "69968bfe",
                "state_code": "MN",
                "name": "H & H Group Home Llc",
                "slug": "h-h-group-home-llc-mn0",
                "city_slug": "st-louis-park",
                "license_number": "MN-ALDC-h-h-group-home-llc",
                "external_id": None,
                "created_at": "1",
                "publishable": False,
            },
            {
                "id": "810b02e7",
                "state_code": "MN",
                "name": "H & H Group Home Llc",
                "slug": "h-h-group-home-llc-mn0",
                "city_slug": "minneapolis",
                "license_number": "MN-ALDC-h-h-group-home-llc",
                "external_id": None,
                "created_at": "1",
                "publishable": False,
            },
        ]
        conn = FakeConn(rows)
        with conn.cursor() as cur:
            idmap = load_identity_map(cur, "MN")
        mpls = {
            "state_code": "MN",
            "name": "H & H Group Home Llc",
            "license_number": "MN-ALDC-h-h-group-home-llc",
            "slug": "h-h-group-home-llc-mn0",
            "city_slug": "minneapolis",
        }
        self.assertFalse(reuse_identity(mpls, idmap, [mpls["license_number"], None]))
        self.assertEqual(mpls["city_slug"], "minneapolis")
        conn.apply_upsert(
            """
            INSERT INTO facilities (state_code, city_slug, slug, name)
            VALUES (%(state_code)s, %(city_slug)s, %(slug)s, %(name)s)
            ON CONFLICT (state_code, city_slug, slug) DO UPDATE SET
                name = EXCLUDED.name
            """,
            {**mpls, "name": "H & H Group Home Updated"},
        )
        by_id = {row["id"]: row for row in conn.rows}
        self.assertEqual(by_id["810b02e7"]["name"], "H & H Group Home Updated")
        self.assertEqual(by_id["810b02e7"]["city_slug"], "minneapolis")
        self.assertEqual(by_id["69968bfe"]["city_slug"], "st-louis-park")
        self.assertEqual(by_id["69968bfe"]["name"], "H & H Group Home Llc")
        self.assertEqual(len(conn.rows), 2)

    def test_license_and_slug_on_different_rows_writes_neither(self) -> None:
        """The license is row A and the slug is row B. Do not update either one."""
        rows = [
            {
                "id": "A",
                "state_code": "TX",
                "name": "Alpha",
                "slug": "alpha-111111",
                "city_slug": "austin",
                "license_number": "111111",
                "external_id": None,
                "created_at": "1",
                "publishable": True,
            },
            {
                "id": "B",
                "state_code": "TX",
                "name": "Bravo",
                "slug": "bravo-222222",
                "city_slug": "austin",
                "license_number": "222222",
                "external_id": None,
                "created_at": "2",
                "publishable": True,
            },
        ]
        conn = FakeConn(rows)
        rec = {
            "state_code": "TX",
            "name": "Should Not Land",
            "slug": "bravo-222222",
            "city_slug": "austin",
            "license_number": "111111",
        }
        tx_alf_ingest.upsert_facilities(conn, [rec])
        self.assertEqual(rec["slug"], "bravo-222222")
        by_id = {row["id"]: row for row in conn.rows}
        self.assertEqual(by_id["A"]["name"], "Alpha")
        self.assertEqual(by_id["B"]["name"], "Bravo")
        self.assertEqual(len(conn.rows), 2)
        logged = [
            json.loads(line)
            for line in _license_match.REVIEW_LOG_PATH.read_text(encoding="utf-8").splitlines()
        ]
        conflicts = [item for item in logged if item["reason"] == "license_slug_conflict"]
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["facility_id"], "A")
        self.assertEqual(conflicts[0]["other_facility_id"], "B")
        self.assertEqual(conflicts[0]["row_ids"], ["A", "B"])
        self.assertEqual(conflicts[0]["db_result"], "skipped")
        self.assertTrue(conflicts[0]["run_id"])
        self.assertIn("T", conflicts[0]["timestamp"])

    def test_or_leading_zeros_match_for_comparison_only(self) -> None:
        """CSV 15 is the same home as stored 0000000015. The stored id stays padded."""
        row = {
            "id": "7dcc990b",
            "state_code": "OR",
            "name": "Hazel Gutierrez",
            "slug": "hazel-gutierrez-15",
            "city_slug": "milwaukie",
            "license_number": "0000000015",
            "external_id": "0000000015",
            "created_at": "1",
            "publishable": False,
        }
        conn = FakeConn([row])
        incoming = {
            "state_code": "OR",
            "name": "Hazel G Smith",
            "slug": "hazel-g-smith-15",
            "city_slug": "milwaukie",
            "license_number": or_dhs.pad_license_or("15"),
            "_raw_id": "15",
        }
        self.assertEqual(incoming["license_number"], "15")
        or_dhs.upsert_facilities(conn, [incoming])
        self.assertEqual(len(conn.rows), 1)
        self.assertEqual(conn.rows[0]["slug"], "hazel-gutierrez-15")
        self.assertEqual(conn.rows[0]["license_number"], "0000000015")
        self.assertEqual(conn.rows[0]["name"], "Hazel G Smith")

    def test_letter_id_does_not_match_a_zero_padded_number(self) -> None:
        """50M133 and 0000050133 are different Oregon ids. Stripping zeros must not join them."""
        conn = FakeConn([_oak_existing()])
        with conn.cursor() as cur:
            idmap = load_identity_map(cur, "OR")
        rec = {"license_number": "0000050133", "slug": "new-slug", "city_slug": "new-city"}
        self.assertFalse(reuse_identity(rec, idmap, ["0000050133", rec["license_number"]]))
        self.assertEqual(rec["slug"], "new-slug")

    def test_mn_alrc_license_matches_an_mdh_hfid(self) -> None:
        """Live MN licenses are ALRC:n. The MDH number n must find that row and leave ALRC:n stored."""
        existing = {
            "id": "mn-alrc-15",
            "state_code": "MN",
            "name": "Old Home",
            "slug": "old-home-15",
            "city_slug": "duluth",
            "license_number": "ALRC:15",
            "external_id": None,
            "publishable": True,
            "created_at": "2020-01-01",
        }
        incoming = {
            "state_code": "MN",
            "name": "New Home",
            "slug": "new-home-0000000015",
            "city_slug": "minneapolis",
            "license_number": "0000000015",
        }
        conn = FakeConn([existing])
        mn_mdh_directory_ingest.upsert_facilities(conn, [incoming])
        self.assertEqual(len(conn.rows), 1)
        self.assertEqual(conn.rows[0]["slug"], "old-home-15")
        self.assertEqual(conn.rows[0]["city_slug"], "duluth")
        self.assertEqual(conn.rows[0]["license_number"], "ALRC:15")
        self.assertEqual(conn.rows[0]["name"], "New Home")

    def test_field_diff_is_written_only_after_the_update_succeeds(self) -> None:
        """A review line describes a write that happened. A failed write leaves no field diff."""
        existing = {
            "id": "wa-1",
            "state_code": "WA",
            "name": "Old",
            "slug": "old-1",
            "city_slug": "seattle",
            "license_number": "0000000001",
            "external_id": None,
            "publishable": True,
            "created_at": "2020-01-01",
        }
        incoming = {
            "state_code": "WA",
            "name": "New",
            "slug": "new-1",
            "city_slug": "seattle",
            "license_number": "0000000001",
            "publishable": False,
        }
        conn = FakeConn([existing])
        real_execute = FakeCursor.execute

        def execute(cursor: FakeCursor, sql: str, params: Any = None) -> None:
            lowered = " ".join(sql.split()).lower()
            if "on conflict" in lowered:
                raise RuntimeError("db down")
            return real_execute(cursor, sql, params)

        with mock.patch.object(FakeCursor, "execute", execute):
            with self.assertRaises(RuntimeError):
                wa_dshs.upsert_facilities(conn, [incoming])
        self.assertFalse(_license_match.REVIEW_LOG_PATH.exists())
        self.assertEqual(conn.rows[0]["name"], "Old")

    def test_retired_or_dhs_exits_on_import(self) -> None:
        """Importing the retired Oregon script stops, the way it did before this PR.
        The unit tests are allowed to import it; a normal import is not."""
        proc = subprocess.run(
            [sys.executable, "-c", "import or_dhs_ltc_directory_ingest"],
            cwd=SCRAPERS,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 1)
        self.assertIn("retired", proc.stderr.lower())
        script = subprocess.run(
            [sys.executable, str(SCRAPERS / "or_dhs_ltc_directory_ingest.py")],
            capture_output=True,
            text=True,
        )
        self.assertEqual(script.returncode, 1)
        self.assertIn("retired", script.stderr.lower())


class AzStaleLayerTests(unittest.TestCase):
    def test_without_flag_exits_and_makes_no_calls(self) -> None:
        """The February layer still has the old FACID, name, and license. Do not touch the network or the database."""
        buf = io.StringIO()
        with (
            mock.patch.object(az_adhs, "fetch_all_facilities") as fetch,
            mock.patch.object(az_adhs.psycopg, "connect") as connect,
            mock.patch.object(az_adhs, "load_env") as load_env,
            mock.patch.object(sys, "argv", ["az_adhs_directory_ingest.py"]),
            redirect_stderr(buf),
        ):
            with self.assertRaises(SystemExit) as ctx:
                az_adhs.main()
        self.assertEqual(ctx.exception.code, 1)
        self.assertIn(az_adhs.STALE_LAYER_REFUSAL, buf.getvalue())
        fetch.assert_not_called()
        connect.assert_not_called()
        load_env.assert_not_called()

    def test_allow_flag_proceeds(self) -> None:
        """With Blake's flag the script gets past the stop and continues the usual run."""
        conn = mock.MagicMock()
        conn.__enter__.return_value = conn
        with (
            mock.patch.object(az_adhs, "fetch_all_facilities", return_value=[]) as fetch,
            mock.patch.object(az_adhs.psycopg, "connect", return_value=conn) as connect,
            mock.patch.object(az_adhs, "load_env"),
            mock.patch.dict(os.environ, {"DATABASE_URL": "postgres://example.invalid/db"}),
            mock.patch.object(
                sys, "argv", ["az_adhs_directory_ingest.py", "--allow-stale-layer"]
            ),
        ):
            az_adhs.main()
        fetch.assert_called_once()
        connect.assert_called_once()


class AzUpdateProtectionTests(_ReviewTempMixin, unittest.TestCase):
    def test_license_hit_keeps_memory_care_and_the_stored_facid(self) -> None:
        """With the stale-layer flag, a matching license updates that home.
        The new FACID is not written, and memory-care fields stay as they are."""
        existing = {
            "id": "az-1",
            "state_code": "AZ",
            "external_id": "FAC-OLD",
            "license_number": "LIC1",
            "name": "Old Name",
            "slug": "old-name-fac-old",
            "city_slug": "phoenix",
            "publishable": True,
            "serves_memory_care": True,
            "mc_review_status": "reviewed_publish",
            "memory_care_disclosure_filed": True,
            "memory_care_disclosure_source": "facility",
            "az_mc_subclass": True,
            "az_memory_care_endorsed": True,
            "az_license_level": "Directed Care",
            "created_at": "2020-01-01",
        }
        incoming = {
            "state_code": "AZ",
            "external_id": "FAC-NEW",
            "license_number": "LIC1",
            "name": "New Name",
            "slug": "new-name-fac-new",
            "city_slug": "tucson",
            "publishable": False,
            "serves_memory_care": False,
            "mc_review_status": "needs_review",
            "memory_care_disclosure_filed": False,
            "memory_care_disclosure_source": None,
            "az_mc_subclass": False,
            "az_memory_care_endorsed": False,
            "az_license_level": "Personal Care",
            "license_type": "Assisted Living Home",
            "license_subtype": None,
            "license_status": "OPEN",
            "license_expiration": None,
            "beds": 10,
            "street": "1 Main",
            "city": "Tucson",
            "county": "Pima",
            "zip": "85701",
            "phone": None,
            "latitude": None,
            "longitude": None,
            "source_url": "https://example.invalid",
        }
        conn = FakeConn([existing])
        ok, errors = az_adhs.upsert_batch(conn, [incoming])
        self.assertEqual((ok, errors), (1, 0))
        self.assertEqual(len(conn.rows), 1)
        row = conn.rows[0]
        self.assertEqual(row["external_id"], "FAC-OLD")
        self.assertEqual(row["license_number"], "LIC1")
        self.assertEqual(row["slug"], "old-name-fac-old")
        self.assertEqual(row["city_slug"], "phoenix")
        self.assertEqual(row["name"], "New Name")
        self.assertTrue(row["publishable"])
        self.assertTrue(row["serves_memory_care"])
        self.assertEqual(row["mc_review_status"], "reviewed_publish")
        self.assertTrue(row["memory_care_disclosure_filed"])
        self.assertEqual(row["memory_care_disclosure_source"], "facility")
        self.assertTrue(row["az_mc_subclass"])
        self.assertTrue(row["az_memory_care_endorsed"])
        self.assertEqual(row["az_license_level"], "Personal Care")
        logged = [
            json.loads(line)
            for line in _license_match.REVIEW_LOG_PATH.read_text(encoding="utf-8").splitlines()
        ]
        kept = [item for item in logged if item["reason"] == "kept_stored_external_id"]
        self.assertEqual(len(kept), 1)
        self.assertEqual(kept[0]["db_value"], "FAC-OLD")
        self.assertEqual(kept[0]["incoming_value"], "FAC-NEW")
        self.assertEqual(kept[0]["db_result"], "updated")
        self.assertTrue(kept[0]["run_id"])
        by_field = {
            item["field"]: item for item in logged if item["reason"] == "field_diff"
        }
        self.assertIs(by_field["serves_memory_care"]["db_value"], True)
        self.assertIs(by_field["serves_memory_care"]["incoming_value"], False)


class SqlConstantTests(unittest.TestCase):
    def test_do_update_does_not_assign_slug_and_helper_skips_care_columns(self) -> None:
        """The pre-step rewrites the in-memory slug. The SQL must not assign slug,
        and the lookup must not read memory-care columns."""
        for rel in INGEST_FILES:
            text = (ROOT / rel).read_text(encoding="utf-8")
            blocks = _do_update_blocks(text)
            self.assertTrue(blocks, rel)
            for block in blocks:
                self.assertIsNone(re.search(r"^\s*slug\s*=", block, re.M), rel)

        helper = (SCRAPERS / "_license_match.py").read_text(encoding="utf-8")
        selects = [
            sql for sql in re.findall(r'"""(.*?)"""', helper, re.S)
            if re.search(r"\bselect\b", sql, re.I)
        ]
        self.assertTrue(selects)
        for sql in selects:
            match = re.search(r"select\s+(.*?)\s+from\b", sql, re.I | re.S)
            self.assertIsNotNone(match)
            cols = match.group(1).lower() if match else ""
            for banned in ("serves_memory_care", "care_category", "mc_", "publishable"):
                self.assertNotIn(banned, cols)
        self.assertIn("order by publishable", helper.lower())


if __name__ == "__main__":
    unittest.main()
