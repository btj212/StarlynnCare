#!/usr/bin/env python3
"""License-before-slug ingest tests.

A regulator rename must update the facility families already have a URL for.
These tests fail if a new name inserts a second row, or if a stored slug moves.
"""

from __future__ import annotations

import csv
import io
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCRAPERS = ROOT / "scrapers"
if str(SCRAPERS) not in sys.path:
    sys.path.insert(0, str(SCRAPERS))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

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


class FakeCursor:
    def __init__(self, conn: FakeConn) -> None:
        self.conn = conn
        self._fetched: list[tuple[Any, ...]] = []

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


class OakLaneTests(unittest.TestCase):
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


class RenameInPlaceTests(unittest.TestCase):
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
            try:
                or_providers_ingest.ingest(path, dry_run=False, limit=None)
            finally:
                or_providers_ingest.get_conn = real_get_conn
        self.assertEqual(len(conn.rows), 1)
        self.assertEqual(conn.rows[0]["slug"], "oak-lane-residential-care-facility-50m133")
        self.assertEqual(conn.rows[0]["city_slug"], "grants-pass")
        self.assertEqual(conn.rows[0]["license_number"], "50M133")
        self.assertEqual(conn.rows[0]["name"], "Oak Lane Senior Living and Memory Care")


class IdentityHelperTests(unittest.TestCase):
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
        for candidate in ("50m133", "50M133"):
            rec = {"slug": "new", "city_slug": "new", "license_number": "padded"}
            self.assertTrue(reuse_identity(rec, idmap, [candidate], keep_stored_license=True))
            self.assertEqual(rec["slug"], "oak-lane-residential-care-facility-50m133")
            self.assertEqual(rec["license_number"], "50M133")

    def test_duplicate_license_keeps_the_earlier_publishable_row(self) -> None:
        """Two rows share a license: warn, update the publishable one, do not insert."""
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
        buf = io.StringIO()
        with conn.cursor() as cur:
            with redirect_stdout(buf):
                idmap = load_identity_map(cur, "MN")
        self.assertEqual(idmap["DUP1"]["id"], "early")
        self.assertIn("more than one row shares license/id DUP1", buf.getvalue())
        self.assertIn("using early", buf.getvalue())
        incoming = {
            "state_code": "MN",
            "name": "Renamed Home",
            "license_number": "DUP1",
            "slug": "renamed-home-dup1",
            "city_slug": "duluth",
        }
        mn_mdh_directory_ingest.upsert_facilities(conn, [incoming])
        self.assertEqual(len(conn.rows), 3)
        early = next(row for row in conn.rows if row["id"] == "early")
        self.assertEqual(early["slug"], "early-slug")
        self.assertEqual(early["name"], "Renamed Home")

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
