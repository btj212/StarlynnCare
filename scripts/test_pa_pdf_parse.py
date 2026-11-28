#!/usr/bin/env python3
"""Tests for the Pennsylvania inspection-PDF pipeline.

Each test names the family-facing mistake it prevents: a citation that
never becomes a row, a 2026 report sent to an OCR tool the runner does
not have, or a second pass that double-counts the same finding.
"""

from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pdfplumber

from scrapers.pa_pdf_backfill import dedupe_key
from scrapers.pa_pdf_parse import (
    chunk_blocks,
    ensure_local_pdf,
    extract_report_text,
    needs_ocr,
    pages_without_text,
    parse_deficiencies_from_text,
    should_fail,
    split_violation_blocks,
    violation_marker_count,
)

FIXTURE_DIR = ROOT / "scrapers" / "fixtures" / "pa_pdf"

# Public DHS Licensing Inspection Summary files. Counts are the number of
# "Description of Violation" markers, which is the citation count families see.
FIXTURES = (
    {
        "name": "spring_mill_pointe_20260811.pdf",
        "sha256": "be24297b4e157306",
        "markers": 19,
        "textless_pages": [1, 2, 3],
    },
    {
        "name": "symphony_square_20260605.pdf",
        "sha256": "67c80ed2bdc94177",
        "markers": 10,
        "textless_pages": [1, 2, 3],
    },
    {
        "name": "atria_lafayette_hill_20240325.pdf",
        "sha256": "d245aaa86efd5ff8",
        "markers": 18,
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
                self.assertEqual(violation_marker_count(text), fixture["markers"])
                self.assertGreater(len(text), 12_000)
                if shutil.which("pdftotext"):
                    layout = subprocess.check_output(
                        ["pdftotext", "-layout", str(path), "-"],
                        text=True,
                        errors="replace",
                    )
                    self.assertEqual(violation_marker_count(layout), fixture["markers"])

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
                self.assertEqual(violation_marker_count(text), fixture["markers"])

    def test_mocked_model_keeps_every_block(self) -> None:
        """The old 12,000-character cut stored a short list and still marked the PDF done."""
        for fixture in FIXTURES:
            path = FIXTURE_DIR / str(fixture["name"])
            with self.subTest(fixture=fixture["name"]):
                text = pdfplumber_text(path)
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
        self.assertFalse(needs_ocr([cover, cover, letter]))
        self.assertFalse(needs_ocr([letter]))
        self.assertTrue(needs_ocr([cover, cover]))
        self.assertTrue(needs_ocr([letter, cover]))


class PaDedupeTests(unittest.TestCase):
    def test_atria_repeat_sections_stay_distinct_and_a_rerun_does_not(self) -> None:
        """Atria 3/25/2024 cites 187(a) twice. The same wording on a second pass is one row."""
        text = pdfplumber_text(FIXTURE_DIR / "atria_lafayette_hill_20240325.pdf")
        blocks = split_violation_blocks(text)
        stubs = [(regulation_code(block), violation_description(block)) for block in blocks]
        self.assertEqual(len(stubs), 18)
        self.assertTrue(all(code and description for code, description in stubs))
        codes = [code for code, _description in stubs]
        self.assertEqual(codes.count("55 Pa Code § 2600.187(a)"), 2)
        self.assertIn("55 Pa Code § 2600.51", codes)
        keys = [dedupe_key(code, description) for code, description in stubs]
        self.assertEqual(len(set(keys)), 18)
        self.assertEqual(len(set(keys + keys)), 18)
        repeated = [code for code in codes if codes.count(code) > 1]
        self.assertTrue(repeated)
        for code in repeated:
            descriptions = [description for found, description in stubs if found == code]
            self.assertEqual(len(descriptions), len(set(descriptions)))
            self.assertNotEqual(dedupe_key(code, descriptions[0]), dedupe_key(code, descriptions[1]))

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


if __name__ == "__main__":
    unittest.main()
