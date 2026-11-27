"""Read a Washington DSHS inspection report that already has a text layer.

The forms page (AFHForms / BHForms) posts the month and the PDF address.
The citation count and the day are inside the PDF. A scanned page with no
text is left unknown. A consultation that the letter says was not cited is
a count of zero. A guessed zero is not used for a file we could not read.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime


_WAC_HEADER = re.compile(r"^WAC\s+(\d{3}-\d{2}-\d+)\b\s*(.*)$", re.IGNORECASE)
_NOT_MET = re.compile(r"This requirement was not met", re.IGNORECASE)
_LICENSE_LABEL = re.compile(r"License\s*#\s*:?\s*(\d{4,10})", re.IGNORECASE)
_RE_LICENSE = re.compile(r"\bRE:.*#\s*(\d{4,10})")
_INSPECTION_ON = re.compile(
    r"completed (?:a |an )?(?:[\w/-]+ ){0,4}inspection of your .{0,120}? on (\d{2}/\d{2}/\d{4})",
    re.IGNORECASE | re.DOTALL,
)
_LICENSEE_DATE = re.compile(r"Licensee:.{0,120}?(\d{2}/\d{2}/\d{4})")
_VISIT_ON = re.compile(r"During a visit on (\d{2}/\d{2}/\d{4})", re.IGNORECASE)
_BOILERPLATE = re.compile(
    r"This\s+document\s+was\s+prepared\s+by\s+Residential\s+Care\s+Services\s+"
    r"for\s+the\s+Locator\s+website\.?",
    re.IGNORECASE,
)
_FOLDER_LICENSE = re.compile(r"/(?:AF|BH)/(\d+)/", re.IGNORECASE)


@dataclass(frozen=True)
class WaReport:
    license_digits: str | None
    inspection_date: date | None
    citation_count: int | None
    citations: tuple[tuple[str, str], ...]


def _parse_us_date(raw: str) -> date | None:
    try:
        return datetime.strptime(raw, "%m/%d/%Y").date()
    except ValueError:
        return None


def license_digits(value: str | None) -> str:
    return re.sub(r"\D", "", value or "").lstrip("0")


def same_license(stored: str | None, found: str | None) -> bool:
    """True when two Washington license strings are the same number.

    DSHS prints 754592 on the report and stores 0000754592 on the roster.
    """
    left = license_digits(stored)
    right = license_digits(found)
    return bool(left) and left == right


def license_in_pdf_url(url: str) -> str | None:
    match = _FOLDER_LICENSE.search(url or "")
    return match.group(1) if match else None


def _readable_body(text: str) -> str:
    body = _BOILERPLATE.sub(" ", text or "")
    return re.sub(r"\s+", " ", body).strip()


def _cited_wacs(text: str) -> tuple[tuple[str, str], ...]:
    lines = text.splitlines()
    headers: list[tuple[int, str, str]] = []
    for index, line in enumerate(lines):
        match = _WAC_HEADER.match(line.strip())
        if match:
            headers.append((index, match.group(1), match.group(2).strip()))
    cited: list[tuple[str, str]] = []
    for position, (index, code, title) in enumerate(headers):
        end = headers[position + 1][0] if position + 1 < len(headers) else len(lines)
        block = "\n".join(lines[index:end])
        if _NOT_MET.search(block):
            cited.append((f"WAC {code}", title[:300]))
    return tuple(cited)


def _inspection_date(text: str) -> date | None:
    inspected = _INSPECTION_ON.search(text)
    if inspected:
        found = _parse_us_date(inspected.group(1))
        if found:
            return found
    licensee = _LICENSEE_DATE.search(text)
    if licensee:
        found = _parse_us_date(licensee.group(1))
        if found:
            return found
    visit = _VISIT_ON.search(text)
    if visit:
        return _parse_us_date(visit.group(1))
    return None


def _license(text: str) -> str | None:
    labeled = _LICENSE_LABEL.search(text)
    if labeled:
        return labeled.group(1)
    named = _RE_LICENSE.search(text)
    if named:
        return named.group(1)
    return None


def _count(text: str, citations: tuple[tuple[str, str], ...]) -> int | None:
    if len(_readable_body(text)) < 180:
        return None
    if citations:
        return len(citations)
    not_cited = re.search(r"not cited", text, re.IGNORECASE)
    # The colon sits against a line break, so a trailing word boundary never matches.
    consultation = re.search(r"\bConsultation:", text)
    if consultation and not_cited:
        return 0
    if re.search(
        r"in compliance|no deficiencies were cited|meets the .{0,80}licensing requirements",
        text,
        re.IGNORECASE | re.DOTALL,
    ):
        return 0
    return None


def parse_wa_report(text: str) -> WaReport:
    """Date, license, and cited-WAC count from one report. Count is None when unread."""
    citations = _cited_wacs(text or "")
    return WaReport(
        license_digits=_license(text or ""),
        inspection_date=_inspection_date(text or ""),
        citation_count=_count(text or "", citations),
        citations=citations,
    )


def posted_month_date(posted_month: str | None) -> date | None:
    """DSHS labels a report with a month. The stored day is the first of that month."""
    if not posted_month or not re.fullmatch(r"\d{4}-\d{2}", posted_month):
        return None
    year, month = int(posted_month[:4]), int(posted_month[5:7])
    if month < 1 or month > 12:
        return None
    return date(year, month, 1)
