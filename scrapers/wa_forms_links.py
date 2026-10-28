"""Parse document links on a Washington DSHS forms page.

AFHForms and BHForms both use relative links with spaces, and the link text
carries the month and the category ("10/2026 - Enforcement Letters").
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit

_LABEL_RE = re.compile(
    r"^\s*(\d{1,2})/(\d{4})\s*-\s*(.+?)\s*$",
    re.IGNORECASE,
)

_CATEGORY_TO_TYPE = (
    ("enforcement letter", "enforcement_letter"),
    ("fire inspection", "fire_inspection"),
    ("investigation", "investigation"),
    ("inspection", "inspection"),
)


@dataclass(frozen=True)
class FormLink:
    url: str
    label: str
    filename: str
    doc_type: str
    posted_month: str | None


def absolutize(page_url: str, href: str) -> str:
    absolute = urljoin(page_url, href)
    parts = urlsplit(absolute)
    path = quote(unquote(parts.path), safe="/%")
    return urlunsplit((parts.scheme, parts.netloc, path, parts.query, ""))


def _doc_type(label: str, href: str) -> str:
    blob = f"{label} {unquote(href)}".lower()
    for needle, doc_type in _CATEGORY_TO_TYPE:
        if needle in blob:
            return doc_type
    return "other"


def _posted_month(label: str) -> str | None:
    match = _LABEL_RE.match(label)
    if not match:
        return None
    month = int(match.group(1))
    year = int(match.group(2))
    if month < 1 or month > 12:
        return None
    return f"{year:04d}-{month:02d}"


def parse_forms_links(html: str, page_url: str) -> list[FormLink]:
    """Return one link per posted PDF. Ignores the page's navigation."""
    found: dict[str, FormLink] = {}
    for href, raw_text in re.findall(
        r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        if "RCSForms" not in href or not href.lower().endswith(".pdf"):
            continue
        label = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", raw_text)).strip()
        url = absolutize(page_url, href)
        filename = unquote(urlsplit(url).path.rsplit("/", 1)[-1])
        found[url] = FormLink(
            url=url,
            label=label,
            filename=filename,
            doc_type=_doc_type(label, href),
            posted_month=_posted_month(label),
        )
    return sorted(found.values(), key=lambda link: (link.posted_month or "", link.filename))
