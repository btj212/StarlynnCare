#!/usr/bin/env python3
"""Tests for the Pennsylvania inspection-PDF pipeline.

Each test names the family-facing mistake it prevents: a citation that
never becomes a row, a 2026 report sent to an OCR tool the runner does
not have, or a second pass that double-counts the same finding.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Any
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pdfplumber

from scrapers.pa_pdf_backfill import (
    backfill_one,
    dedupe_key,
    empty_backfill_is_failure,
)
from scrapers.pa_pdf_download import row_needs_download
from scrapers.pa_pdf_parse import (
    chunk_blocks,
    ensure_local_pdf,
    extract_report_text,
    needs_ocr,
    ocr_is_false_zero,
    ocr_pdf,
    ocr_requirements_conflict,
    page_footer_date,
    page_texts,
    pages_for_visit,
    pages_requiring_ocr,
    pages_without_text,
    parse_deficiencies_from_text,
    prepare_pages,
    should_fail,
    split_violation_blocks,
    violation_marker_count,
    visit_text,
)

FIXTURE_DIR = ROOT / "scrapers" / "fixtures" / "pa_pdf"

# Public DHS Licensing Inspection Summary files. `markers` is this visit:
# pages whose footer date matches the inventory inspection date. `file_markers`
# is every marker in the PDF, including a survey stapled on from another date.
FIXTURES = (
    {
        "name": "spring_mill_pointe_20260811.pdf",
        "sha256": "be24297b4e157306",
        "markers": 19,
        "file_markers": 19,
        "inspection_date": date(2026, 8, 11),
        "textless_pages": [1, 2, 3],
    },
    {
        "name": "symphony_square_20260605.pdf",
        "sha256": "67c80ed2bdc94177",
        "markers": 10,
        "file_markers": 10,
        "inspection_date": date(2026, 6, 5),
        "textless_pages": [1, 2, 3],
    },
    {
        "name": "atria_lafayette_hill_20240325.pdf",
        "sha256": "d245aaa86efd5ff8",
        "markers": 15,
        "file_markers": 18,
        "inspection_date": date(2024, 3, 25),
        "textless_pages": [],
    },
)


def pdfplumber_text(path: Path) -> str:
    parts: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text:
                parts.append(text)
    return "\n".join(parts)


def one_stub_per_block(text: str) -> list[dict[str, object]]:
    """The model stand-in: one object per marker, never a shorter list."""
    count = violation_marker_count(text)
    return [
        {
            "date": None,
            "code": f"55 Pa Code § 2600.{index}",
            "description": f"stub {index}",
            "severity": "Citation",
            "poc_text": None,
            "corrected": None,
        }
        for index in range(count)
    ]


def regulation_code(block: str) -> str:
    """The 55 Pa Code cite printed under the section heading."""
    chapter = "2600"
    lines = block.splitlines()
    start = 0
    for index, line in enumerate(lines):
        match = re.match(r"^(2600|2800)\.\s*$", line.strip())
        if match:
            chapter = match.group(1)
            start = index + 1
            break
    for line in lines[start:]:
        stripped = line.strip()
        if re.match(r"^\d+\.\s*Requirements\s*$", stripped, re.I):
            continue
        letter = re.match(r"(\d+)\.([a-z])(?:\.(\d+))?\.\s", stripped, re.I)
        if letter:
            section, let, sub = letter.group(1), letter.group(2), letter.group(3)
            if sub:
                return f"55 Pa Code § {chapter}.{section}({let})({sub})"
            return f"55 Pa Code § {chapter}.{section}({let})"
        plain = re.match(r"(\d+)\.\s+[A-Za-z]", stripped)
        if plain:
            return f"55 Pa Code § {chapter}.{plain.group(1)}"
    return ""


def violation_description(block: str) -> str:
    """The inspector's account, without the page header that repeats mid-sentence."""
    match = re.search(
        r"Description of Violation\s*(.*?)(?:\n\s*Plan of Correction|\Z)",
        block,
        re.S,
    )
    body = match.group(1) if match else ""
    kept: list[str] = []
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if re.search(r"\d{2}/\d{2}/\d{4}\s+\d+\s+of\s+\d+", stripped):
            continue
        if re.search(r"\(continued\)\s*$", stripped, re.I):
            continue
        if re.match(r"^[A-Z0-9][A-Z0-9 .'’-]{6,}\s+\d{4,6}$", stripped):
            continue
        kept.append(stripped)
    return re.sub(r"\s+", " ", " ".join(kept)).strip()


def synthetic_report(count: int, *, first_block_pad: int = 0) -> str:
    """count citation blocks in the DHS heading shape, none of them cut in half."""
    parts: list[str] = []
    for index in range(count):
        pad = "x" * first_block_pad if index == 0 else ""
        parts.append(
            f"{index + 10}a - Section {index}\n"
            f"{index + 1}. Requirements\n"
            "2600.\n"
            f"{index + 10}.a. The home shall do thing {index}.\n"
            "Description of Violation\n"
            f"The inspector saw issue {index}.\n"
            f"{pad}\n"
            "Plan of Correction\n"
            f"The home corrected issue {index}.\n"
        )
    return "\n".join(parts)


class PaPdfFixtureTests(unittest.TestCase):
    def test_marker_count_matches_the_dhs_summary(self) -> None:
        """A family should see one row per Description of Violation, including past the old 12k cut."""
        for fixture in FIXTURES:
            path = FIXTURE_DIR / fixture["name"]
            with self.subTest(fixture=fixture["name"]):
                data = path.read_bytes()
                self.assertTrue(data.startswith(b"%PDF"))
                self.assertTrue(hashlib.sha256(data).hexdigest().startswith(str(fixture["sha256"])))
                text = pdfplumber_text(path)
                self.assertEqual(violation_marker_count(text), fixture["file_markers"])
                self.assertGreater(len(text), 12_000)
                pages = page_texts(path)
                visit = "\n".join(pages_for_visit(pages, fixture["inspection_date"]))
                self.assertEqual(violation_marker_count(visit), fixture["markers"])
                if shutil.which("pdftotext"):
                    layout = subprocess.check_output(
                        ["pdftotext", "-layout", str(path), "-"],
                        text=True,
                        errors="replace",
                    )
                    self.assertEqual(violation_marker_count(layout), fixture["file_markers"])

    def test_image_covers_do_not_send_the_report_to_ocr(self) -> None:
        """2026 PDFs have blank pages 1-3 and the citations from page 4. Those are not scanned reports."""
        for fixture in FIXTURES:
            path = FIXTURE_DIR / str(fixture["name"])
            with self.subTest(fixture=fixture["name"]):
                self.assertEqual(pages_without_text(path), fixture["textless_pages"])
                with patch(
                    "scrapers.pa_pdf_parse.ocr_textless_pages",
                    side_effect=AssertionError("OCR should not run"),
                ):
                    text, method = extract_report_text(path)
                self.assertEqual(method, "pdfplumber")
                self.assertEqual(violation_marker_count(text), fixture["file_markers"])

    def test_mocked_model_keeps_every_block(self) -> None:
        """The old 12,000-character cut stored a short list and still marked the PDF done."""
        for fixture in FIXTURES:
            path = FIXTURE_DIR / str(fixture["name"])
            with self.subTest(fixture=fixture["name"]):
                pages = page_texts(path)
                text = "\n".join(pages_for_visit(pages, fixture["inspection_date"]))
                blocks = split_violation_blocks(text)
                self.assertEqual(len(blocks), fixture["markers"])
                self.assertEqual(
                    [block.count("Description of Violation") for block in blocks],
                    [1] * int(fixture["markers"]),
                )
                # call_claude splits the chunk again before a max_tokens retry.
                rejoined = split_violation_blocks("\n\n".join(blocks))
                self.assertEqual(len(rejoined), len(blocks))
                with patch("scrapers.pa_pdf_parse.call_claude", side_effect=one_stub_per_block):
                    parsed = parse_deficiencies_from_text(text)
                self.assertEqual(len(parsed), fixture["markers"])


class PaPdfBlockTests(unittest.TestCase):
    def test_forty_blocks_are_chunked_without_cutting_one(self) -> None:
        """A long report is several model calls. A call boundary never slices a citation."""
        text = synthetic_report(40, first_block_pad=9_000)
        blocks = split_violation_blocks(text)
        self.assertEqual(len(blocks), 40)
        self.assertGreater(len(blocks[0]), 8_000)
        chunks = chunk_blocks(blocks)
        self.assertEqual([block for chunk in chunks for block in chunk], blocks)
        self.assertEqual(chunks[0], [blocks[0]])
        for chunk in chunks:
            self.assertLessEqual(len(chunk), 6)
            self.assertEqual(sum(block.count("Description of Violation") for block in chunk), len(chunk))
            if len(chunk) > 1:
                self.assertLessEqual(sum(len(block) for block in chunk), 8_000)
        with patch("scrapers.pa_pdf_parse.call_claude", side_effect=one_stub_per_block):
            parsed = parse_deficiencies_from_text(text)
        self.assertEqual(len(parsed), 40)

    def test_a_short_model_reply_is_an_error(self) -> None:
        """Returning one fewer citation than the PDF contains must not be stored as success."""
        text = synthetic_report(3)

        def one_short(chunk: str) -> list[dict[str, object]]:
            return one_stub_per_block(chunk)[:-1]

        with patch("scrapers.pa_pdf_parse.call_claude", side_effect=one_short):
            with self.assertRaises(RuntimeError):
                parse_deficiencies_from_text(text)

    def test_a_letter_with_no_markers_is_a_real_zero(self) -> None:
        """Some DHS PDFs are a letter that says no regulatory citations were identified."""
        text = (
            "As a result of the licensing inspection, "
            "no regulatory citations have been identified. A regular license is enclosed."
        )
        with patch(
            "scrapers.pa_pdf_parse.call_claude",
            side_effect=AssertionError("model called for a letter with no citations"),
        ):
            self.assertEqual(parse_deficiencies_from_text(text), [])

    def test_ocr_runs_only_when_the_report_itself_has_no_text(self) -> None:
        """Cover scans in front of a text summary are skipped. A fully scanned report is not."""
        cover = ""
        summary = "Description of Violation\n" + ("The inspector saw a citation. " * 3)
        letter = "no regulatory citations have been identified. " * 2
        self.assertFalse(needs_ocr([cover, cover, summary]))
        self.assertEqual(pages_requiring_ocr([cover, cover, summary]), [])
        self.assertFalse(needs_ocr([cover, cover, letter]))
        self.assertFalse(needs_ocr([letter]))
        self.assertTrue(needs_ocr([cover, cover]))
        self.assertEqual(pages_requiring_ocr([cover, cover]), [1, 2])
        self.assertTrue(needs_ocr([letter, cover]))
        # A marker on an earlier page does not excuse a later page with no text.
        self.assertTrue(needs_ocr([summary, cover]))
        self.assertEqual(pages_requiring_ocr([summary, cover]), [2])


class PaDedupeTests(unittest.TestCase):
    def test_atria_march_visit_is_15_and_the_may_survey_is_separate(self) -> None:
        """The file has 18 markers. Three of them are dated 05/16/2024, not this visit.

        187(a) is cited once on 3/25 and once on 5/16. Counting the whole file
        would store both under the March visit.
        """
        pages = page_texts(FIXTURE_DIR / "atria_lafayette_hill_20240325.pdf")
        file_blocks = split_violation_blocks("\n".join(pages))
        self.assertEqual(len(file_blocks), 18)
        visit = "\n".join(pages_for_visit(pages, date(2024, 3, 25)))
        blocks = split_violation_blocks(visit)
        stubs = [(regulation_code(block), violation_description(block)) for block in blocks]
        self.assertEqual(len(stubs), 15)
        self.assertTrue(all(code and description for code, description in stubs))
        codes = [code for code, _description in stubs]
        self.assertEqual(codes.count("55 Pa Code § 2600.187(a)"), 1)
        self.assertIn("55 Pa Code § 2600.51", codes)
        keys = [dedupe_key(code, description) for code, description in stubs]
        self.assertEqual(len(set(keys)), 15)
        file_codes = [regulation_code(block) for block in file_blocks]
        self.assertEqual(file_codes.count("55 Pa Code § 2600.187(a)"), 2)
        may = "\n".join(pages_for_visit(pages, date(2024, 5, 16)))
        self.assertEqual(violation_marker_count(may), 3)

    def test_normalization_collapses_only_the_same_wording(self) -> None:
        """Punctuation and case are not a second citation. A different account is."""
        same = dedupe_key("55 Pa Code § 2600.42(s)", "Cameras in the unit.")
        also_same = dedupe_key("55 pa code § 2600.42(s)", "cameras in the unit")
        different = dedupe_key("55 Pa Code § 2600.42(s)", "No signs were posted by the cameras.")
        self.assertEqual(same, also_same)
        self.assertNotEqual(same, different)
        self.assertEqual(len({same, also_same}), 1)
        self.assertEqual(len({same, different}), 2)


class PaJobAndCacheTests(unittest.TestCase):
    def test_should_fail_threshold(self) -> None:
        """A handful of bad PDFs stays a warning. A systemic parse failure turns the job red."""
        cases = (
            (0, 100, False),
            (2, 10, False),
            (3, 10, True),
            (6, 100, True),
            (1, 1, False),
            (5, 5, True),
        )
        for errors, attempted, expected in cases:
            with self.subTest(errors=errors, attempted=attempted):
                self.assertEqual(should_fail(errors, attempted), expected)

    def test_ensure_local_pdf_redownloads_only_when_the_file_is_gone(self) -> None:
        """The runner disk is wiped between jobs. A path that is already here must not be fetched again."""
        body = b"%PDF-1.4 fixture bytes"

        class Response:
            def raise_for_status(self) -> None:
                return None

            def iter_content(self, _size: int) -> list[bytes]:
                return [body]

        class Session:
            def __init__(self) -> None:
                self.urls: list[str] = []

            def get(self, url: str, timeout: int = 60, stream: bool = True) -> Response:
                del timeout, stream
                self.urls.append(url)
                return Response()

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            present = root / "already.pdf"
            present.write_bytes(b"%PDF-1.4 present")
            session = Session()
            found = ensure_local_pdf(
                str(present),
                "https://example.test/present.pdf",
                session=session,  # type: ignore[arg-type]
                cache_dir=root / "cache",
            )
            self.assertEqual(found, present)
            self.assertEqual(session.urls, [])

            session = Session()
            downloaded = ensure_local_pdf(
                str(root / "missing.pdf"),
                "https://example.test/missing.pdf",
                session=session,  # type: ignore[arg-type]
                cache_dir=root / "cache",
            )
            digest = hashlib.sha256(body).hexdigest()
            self.assertEqual(session.urls, ["https://example.test/missing.pdf"])
            self.assertEqual(downloaded, root / "cache" / digest[:2] / f"{digest}.pdf")
            self.assertEqual(downloaded.read_bytes(), body)

            session = Session()
            again = ensure_local_pdf(
                str(downloaded),
                "https://example.test/missing.pdf",
                session=session,  # type: ignore[arg-type]
                cache_dir=root / "cache",
            )
            self.assertEqual(again, downloaded)
            self.assertEqual(session.urls, [])


def _survey_page(footer: str, markers: int) -> str:
    """One survey page: `markers` citations and a DHS footer."""
    body = []
    for index in range(1, markers + 1):
        body.append(
            f"{index}. Requirements\n"
            "2600.\n"
            f"{index}.a. The home shall do thing {index}.\n"
            "Description of Violation\n"
            f"The inspector saw issue {index} on {footer}.\n"
            "Plan of Correction\n"
            "The home corrected it.\n"
        )
    body.append(footer)
    return "\n".join(body)


def _pages_from_ocr_text(text: str) -> list[str]:
    """Split an OCR dump into pages on the survey footer. The tools are not run."""
    pages: list[str] = []
    buf: list[str] = []
    for line in text.splitlines(keepends=True):
        buf.append(line)
        if page_footer_date(line):
            pages.append("".join(buf))
            buf = []
    if any(part.strip() for part in buf):
        pages.append("".join(buf))
    return pages


class PaBundledPdfTests(unittest.TestCase):
    def test_belle_reve_august_visit_is_not_in_the_pdf(self) -> None:
        """20260811_22513 has 47 citations, none of them dated 08/11/2026.

        19 are the 05/05/2026 survey and 28 are 02/18/2026. Storing 47 under
        the August visit would put another inspection's findings on that page.
        """
        path = FIXTURE_DIR / "20260811_22513.pdf"
        data = path.read_bytes()
        self.assertTrue(data.startswith(b"%PDF"))
        self.assertTrue(
            hashlib.sha256(data).hexdigest().startswith("1da616f40d14e4d6")
        )
        pages = page_texts(path)
        self.assertEqual(violation_marker_count("\n".join(pages)), 47)
        with self.assertRaises(RuntimeError) as caught:
            pages_for_visit(pages, date(2026, 8, 11))
        message = str(caught.exception)
        self.assertIn("2026-08-11", message)
        self.assertIn("2026-05-05", message)
        self.assertIn("2026-02-18", message)
        may = "\n".join(pages_for_visit(pages, date(2026, 5, 5)))
        february = "\n".join(pages_for_visit(pages, date(2026, 2, 18)))
        self.assertEqual(violation_marker_count(may), 19)
        self.assertEqual(violation_marker_count(february), 28)

    def test_one_bundle_filed_under_three_dates_is_not_tripled(self) -> None:
        """License 14141's pattern: one 83-citation bundle under three visits is 249 rows.

        Each visit keeps its own pages. The three counts add to 83, not 249.
        """
        pages = [
            _survey_page("04/08/2024 1 of 1", 20),
            _survey_page("07/10/2024 1 of 1", 30),
            _survey_page("08/05/2024 1 of 1", 33),
        ]
        self.assertEqual(violation_marker_count("\n".join(pages)), 83)
        counts = []
        for day in (date(2024, 4, 8), date(2024, 7, 10), date(2024, 8, 5)):
            text = "\n".join(pages_for_visit(pages, day))
            counts.append(violation_marker_count(text))
        self.assertEqual(counts, [20, 30, 33])
        self.assertEqual(sum(counts), 83)
        self.assertEqual(83 * 3, 249)


class PaOcrGuardTests(unittest.TestCase):
    def test_ocrmypdf_command_does_not_deskew(self) -> None:
        """--deskew makes ocrmypdf 16.7 skip these scans and return an empty report."""
        seen: dict[str, list[str]] = {}

        def fake_run(cmd: list[str], **_kwargs: object) -> subprocess.CompletedProcess[bytes]:
            seen["cmd"] = list(cmd)
            return subprocess.CompletedProcess(cmd, 0)

        with patch("scrapers.pa_pdf_parse.subprocess.run", side_effect=fake_run):
            ocr_pdf(Path("/tmp/scan.pdf"))
        self.assertEqual(seen["cmd"][:2], ["ocrmypdf", "--skip-text"])
        self.assertNotIn("--deskew", seen["cmd"])

    def test_harmony_tesseract_text_has_19_and_deskew_text_is_an_error(self) -> None:
        """Harmony at Harts Run 7/22/2024: tesseract recovers 19 markers; deskew recovers 0.

        The 19 are not one visit. 17 sit on 04/29/2024 pages and 2 on 07/22/2024.
        The July pages also contain a third Requirements line, so that OCR slice
        is held instead of stored short. This test reads the saved OCR text. It
        does not run ocrmypdf or tesseract.
        """
        tess = (FIXTURE_DIR / "20240722_45322.pdf.tess.txt").read_text()
        deskew = (FIXTURE_DIR / "20240722_45322.pdf.ocrmypdf.txt").read_text()
        self.assertEqual(violation_marker_count(tess), 19)
        self.assertEqual(violation_marker_count(deskew), 0)
        self.assertTrue(ocr_is_false_zero(deskew, 8))
        self.assertFalse(ocr_is_false_zero(tess, 20))
        pages = _pages_from_ocr_text(tess)
        april = "\n".join(pages_for_visit(pages, date(2024, 4, 29)))
        july = "\n".join(pages_for_visit(pages, date(2024, 7, 22)))
        self.assertEqual(violation_marker_count(april), 17)
        self.assertEqual(violation_marker_count(july), 2)
        self.assertIsNone(ocr_requirements_conflict(april))
        self.assertIsNotNone(ocr_requirements_conflict(july))
        with self.assertRaises(RuntimeError):
            visit_text(pages, date(2024, 7, 22), from_ocr=True)

    def test_artis_deskew_text_is_not_stored_as_zero(self) -> None:
        """Artis South Hills deskew output is a cover letter with 0 citations.

        The review measured 15 without --deskew and 16 with tesseract. Those
        texts are not in this fixture pack, so this test locks the failure
        we do have: a multi-page OCR with no marker and no clean-letter line.
        """
        text = (FIXTURE_DIR / "20250211_44916.pdf.ocrmypdf.txt").read_text()
        self.assertEqual(violation_marker_count(text), 0)
        self.assertNotIn("no regulatory citations have been identified", text.lower())
        self.assertTrue(ocr_is_false_zero(text, 10))
        self.assertIn("Artis Senior Living of South Hills", text)

    def test_a_two_page_clean_letter_is_a_real_ocr_zero(self) -> None:
        """Hickman 11/28/2023 says no citations were identified. That zero is real."""
        text = (FIXTURE_DIR / "20231128_14093.pdf.ocrmypdf.txt").read_text()
        self.assertEqual(violation_marker_count(text), 0)
        self.assertFalse(ocr_is_false_zero(text, 2))
        self.assertFalse(ocr_is_false_zero(text, 6))

    def test_prepare_pages_rejects_a_multipage_ocr_zero(self) -> None:
        """needs_ocr was true and the report is more than two pages. Zero markers is an error."""
        deskew = (FIXTURE_DIR / "20240722_45322.pdf.ocrmypdf.txt").read_text()
        pages = [deskew, "second page of the scan", "third page of the scan"]
        with patch("scrapers.pa_pdf_parse.page_texts", return_value=["", "", ""]):
            with patch("scrapers.pa_pdf_parse.ocr_textless_pages", return_value=pages):
                with self.assertRaises(RuntimeError) as caught:
                    prepare_pages(Path("/tmp/scan.pdf"))
        self.assertIn("0 citations", str(caught.exception))

    def test_ocr_cross_check_catches_a_dropped_citation(self) -> None:
        """15 markers against Requirements numbered through 16 is a miss, not a count."""
        short = synthetic_report(15)
        short += "\n16. Requirements\n2600.\nThe next citation was not read.\n"
        conflict = ocr_requirements_conflict(short)
        self.assertIsNotNone(conflict)
        self.assertIn("15", conflict or "")
        self.assertIn("16", conflict or "")
        self.assertIsNone(ocr_requirements_conflict(synthetic_report(15)))


class _Column:
    def __init__(self, name: str) -> None:
        self.name = name


class _FakeCursor:
    def __init__(self, conn: "_FakeConn") -> None:
        self.conn = conn
        self.description: list[_Column] | None = None
        self._result: list[tuple[Any, ...]] = []

    def __enter__(self) -> "_FakeCursor":
        return self

    def __exit__(self, *_exc: object) -> bool:
        return False

    def execute(self, sql: str, params: Any = None) -> None:
        compact = " ".join(sql.split())
        if compact.startswith("SELECT code, description"):
            inspection_id = params[0]
            columns = (
                "code",
                "description",
                "inspector_narrative",
                "plan_of_correction",
                "severity",
                "immediate_jeopardy",
                "civil_money_penalty",
                "status",
                "cited_date",
                "state_severity_raw",
            )
            self.description = [_Column(name) for name in columns]
            self._result = [
                tuple(row.get(name) for name in columns)
                for row in self.conn.rows
                if row["inspection_id"] == inspection_id
            ]
            return
        if compact.startswith("DELETE FROM deficiencies"):
            inspection_id = params[0]
            self.conn.rows = [
                row for row in self.conn.rows if row["inspection_id"] != inspection_id
            ]
            return
        if compact.startswith("INSERT INTO deficiencies"):
            self.conn.rows.append(dict(params))
            return
        if compact.startswith("UPDATE inspections"):
            inspection_id = params[0]
            self.conn.counts[inspection_id] = sum(
                1 for row in self.conn.rows if row["inspection_id"] == inspection_id
            )
            return
        raise AssertionError(compact)

    def fetchall(self) -> list[tuple[Any, ...]]:
        return list(self._result)


class _FakeConn:
    """In-memory stand-in. No database is opened."""

    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []
        self.counts: dict[str, int] = {}

    def cursor(self) -> _FakeCursor:
        return _FakeCursor(self)

    @contextmanager
    def transaction(self) -> Any:
        yield


class PaBackfillReplaceTests(unittest.TestCase):
    def test_running_backfill_twice_keeps_the_same_row_count(self) -> None:
        """The model rewrites each description. A second pass must replace, not append.

        A shorter second list is held: the first rows stay, and a backup of
        them was written before the successful replace.
        """
        inspection_id = "insp-1"
        first = [
            {
                "code": "55 Pa Code § 2600.51",
                "description": "First wording of the background check.",
                "severity": "Citation",
            },
            {
                "code": "55 Pa Code § 2600.85(a)",
                "description": "First wording of the sanitary finding.",
                "severity": "Citation",
            },
            {
                "code": "55 Pa Code § 2600.187(a)",
                "description": "First wording of the medication record.",
                "severity": "Citation",
            },
        ]
        second = [
            {
                "code": item["code"],
                "description": item["description"].replace("First wording", "Rewritten wording"),
                "severity": "Citation",
            }
            for item in first
        ]
        shorter = second[:2]
        conn = _FakeConn()
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "visit.pdf"
            pdf.write_bytes(b"%PDF-1.4")
            sidecar = pdf.parent / "visit.deficiencies.json"
            sidecar.write_text(json.dumps(first))
            written = backfill_one(conn, "inv-1", inspection_id, str(pdf), False)  # type: ignore[arg-type]
            self.assertEqual(written, 3)
            self.assertEqual(len(conn.rows), 3)
            self.assertEqual(conn.counts[inspection_id], 3)

            sidecar.write_text(json.dumps(second))
            written = backfill_one(conn, "inv-1", inspection_id, str(pdf), False)  # type: ignore[arg-type]
            self.assertEqual(written, 3)
            self.assertEqual(len(conn.rows), 3)
            self.assertEqual(conn.counts[inspection_id], 3)
            stored = {row["description"] for row in conn.rows}
            self.assertTrue(all(text.startswith("Rewritten wording") for text in stored))
            backup = json_backup(pdf)
            self.assertEqual(len(backup["rows"]), 3)
            self.assertTrue(
                all(row["description"].startswith("First wording") for row in backup["rows"])
            )

            sidecar.write_text(json.dumps(shorter))
            with self.assertRaises(RuntimeError) as caught:
                backfill_one(conn, "inv-1", inspection_id, str(pdf), False)  # type: ignore[arg-type]
            self.assertIn("holding inspection", str(caught.exception))
            self.assertEqual(len(conn.rows), 3)
            self.assertTrue(all(row["description"].startswith("Rewritten wording") for row in conn.rows))

    def test_a_week_of_clean_letters_is_not_a_failed_job(self) -> None:
        """Zero rows is a failure only when a PDF that cited something wrote nothing."""
        self.assertFalse(empty_backfill_is_failure(3, 0, 3))
        self.assertTrue(empty_backfill_is_failure(3, 0, 0))
        self.assertTrue(empty_backfill_is_failure(3, 0, 2))
        self.assertFalse(empty_backfill_is_failure(3, 5, 0))
        self.assertFalse(empty_backfill_is_failure(0, 0, 0))


def json_backup(pdf: Path) -> dict[str, Any]:
    path = pdf.parent / f"{pdf.stem}.deficiencies.backup.json"
    loaded = json.loads(path.read_text())
    if not isinstance(loaded, dict):
        raise AssertionError("backup was not an object")
    return loaded


class PaDownloadSelectionTests(unittest.TestCase):
    def test_completed_pdfs_are_not_downloaded_again(self) -> None:
        """A fresh runner is missing ~10k finished PDFs. Those are not the weekly download.

        A row still waiting on parse or backfill, whose file is gone, is.
        """
        self.assertFalse(row_needs_download("done", "done", "done", False))
        self.assertFalse(row_needs_download("done", "done", "done", True))
        self.assertTrue(row_needs_download("pending", "pending", "pending", False))
        self.assertTrue(row_needs_download("pending", "done", "done", True))
        self.assertTrue(row_needs_download("done", "pending", "pending", False))
        self.assertFalse(row_needs_download("done", "pending", "pending", True))
        self.assertTrue(row_needs_download("done", "done", "pending", False))
        self.assertFalse(row_needs_download("done", "error", "error", False))


if __name__ == "__main__":
    unittest.main()
