"""Washington DSHS forms page -> letter text for one home."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from compliance.extract_text import extract_pdf_text
from wa_forms_links import FormLink, parse_forms_links

REPO_ROOT = Path(__file__).resolve().parents[2]
PDF_CACHE = REPO_ROOT / ".firecrawl" / "wa-pdfs"

_FORMS = {
    "AFH": "https://fortress.wa.gov/dshs/adsaapps/lookup/AFHForms.aspx?Lic={license}",
}


def forms_url(license_number: str, facility_type: str | None) -> str:
    template = _FORMS.get(facility_type or "", "")
    if not template:
        template = "https://fortress.wa.gov/dshs/adsaapps/lookup/BHForms.aspx?Lic={license}"
    return template.format(license=license_number)


def cache_path(url: str) -> Path:
    digest = hashlib.sha256(url.encode()).hexdigest()
    return PDF_CACHE / digest[:2] / f"{digest}.pdf"


def download_pdf(session: Any, link: FormLink) -> Path | None:
    path = cache_path(link.url)
    if path.is_file() and path.stat().st_size > 500:
        return path
    response = session.get(link.url, timeout=60)
    response.raise_for_status()
    if not response.content.startswith(b"%PDF"):
        return None
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(response.content)
    return path


def read_home(
    session: Any,
    license_number: str,
    facility_type: str | None,
) -> tuple[str, list[FormLink], list[tuple[FormLink, str, str]], list[dict]]:
    """Return the forms URL, the links, readable docs, and unread docs.

    Each readable doc is (link, text, method).
    """
    page_url = forms_url(license_number, facility_type)
    response = session.get(page_url, timeout=45)
    response.raise_for_status()
    links = parse_forms_links(response.text, response.url or page_url)
    readable: list[tuple[FormLink, str, str]] = []
    unread: list[dict] = []
    for link in links:
        try:
            path = download_pdf(session, link)
        except Exception as exc:  # noqa: BLE001
            unread.append({"url": link.url, "reason": str(exc)[:300]})
            continue
        if path is None:
            unread.append({"url": link.url, "reason": "not a pdf"})
            continue
        text, method = extract_pdf_text(path)
        if method == "unread":
            unread.append({"url": link.url, "reason": "no text after ocr"})
            readable.append((link, "", "unread"))
            continue
        readable.append((link, text, method))
    return page_url, links, readable, unread
