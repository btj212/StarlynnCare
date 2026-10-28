"""Read text out of a DSHS PDF. Text layer first, then the first two scanned pages."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path


def _pdftotext(path: Path) -> str:
    if not shutil.which("pdftotext"):
        return ""
    result = subprocess.run(
        ["pdftotext", "-q", "-layout", str(path), "-"],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    return result.stdout or ""


def _ocr_first_pages(path: Path) -> str:
    if not shutil.which("pdftoppm") or not shutil.which("tesseract"):
        return ""
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            ["pdftoppm", "-png", "-f", "1", "-l", "2", str(path), f"{tmp}/page"],
            capture_output=True,
            timeout=90,
            check=False,
        )
        pages = []
        for image in sorted(Path(tmp).glob("*.png")):
            result = subprocess.run(
                ["tesseract", str(image), "stdout"],
                capture_output=True,
                text=True,
                timeout=90,
                check=False,
            )
            pages.append(result.stdout or "")
        return "\n".join(pages)


def extract_pdf_text(path: Path) -> tuple[str, str]:
    """Return (text, method). method is 'unread' when both passes found nothing."""
    text = _pdftotext(path)
    if len(text.strip()) >= 80:
        return text, "pdftotext"
    ocr = _ocr_first_pages(path)
    if len(ocr.strip()) >= 80:
        return ocr, "tesseract"
    if text.strip():
        return text, "pdftotext"
    return "", "unread"
