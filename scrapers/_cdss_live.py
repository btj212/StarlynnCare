"""Live California RCFE sources, in order of authority.

1. CDSS bulk file (primary)
   GET https://www.ccld.dss.ca.gov/transparencyapi/api/DownloadStateData/ResidentialElderCareFacility
   One ~8.7 MB CSV, every RCFE CDSS lists (LICENSED, PENDING, ON PROBATION,
   CLOSED), with status, closed date, capacity, licensee, address and visit
   counts. Measured 2026-11-26: 13,354 rows, newest Last Visit Date
   11/21/2026, newest Closed Date 11/20/2026. This is the same file
   ccld_citations_ingest.py already fingerprints for report reconciliation.

2. CDSS FacilityDetail (per-home second view)
   GET https://www.ccld.dss.ca.gov/transparencyapi/api/FacilityDetail/{license}
   The record behind the public FacDetail page. Has finer wording such as
   "Closed, Change of Ownership". Use it to confirm a change, never as the
   statewide sweep (one call per home).

3. CHHS GIS layer (cloud-reachable fallback, presence only)
   https://services.arcgis.com/XLPEppdz2H9dOiqp/arcgis/rest/services/CDSS_CCL_Facilities/FeatureServer/0
   Open facilities only (8,641 RCFEs on 2026-11-26, data edited 2026-11-25).
   Its integer STATUS codes do not map one-to-one to CDSS wording, so it is
   used only to say "still listed as open" or "no longer listed". It never
   writes a status.

Not used: the CHHS/CKAN "ccl-facilities" roster (resource 744d1583, every row
file_date 05252025) and data.ca.gov resource 6b2f5818 (datastore inactive,
404). Re-ingesting either reverted live corrections.

Reachability: ccld.dss.ca.gov refuses some cloud egress (GitHub runners time
out; some sandboxes fail TLS). Run the CDSS steps from the Mac launchd job.
"""

from __future__ import annotations

import csv
import io
import json
import random
import sys
import time
import urllib.parse
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests

CDSS_BASE = "https://www.ccld.dss.ca.gov/transparencyapi/api"
CDSS_BULK_RCFE_URL = f"{CDSS_BASE}/DownloadStateData/ResidentialElderCareFacility"
CDSS_FACILITY_DETAIL_URL = f"{CDSS_BASE}/FacilityDetail/{{}}"
GIS_LAYER_URL = (
    "https://services.arcgis.com/XLPEppdz2H9dOiqp/arcgis/rest/services/"
    "CDSS_CCL_Facilities/FeatureServer/0"
)

SOURCE_BULK = "cdss_bulk_rcfe"
SOURCE_DETAIL = "cdss_facility_detail"

USER_AGENT = "StarlynnCare/ca-live-status (contact@starlynncare.com)"
REQUIRED_BULK_COLUMNS = (
    "Facility Number",
    "Facility Name",
    "Facility Status",
    "Closed Date",
    "Facility Capacity",
    "Licensee",
    "Facility Address",
    "Facility City",
    "Facility Zip",
    "County Name",
)
# A real statewide file has ~13k rows. Anything far smaller is a partial or
# error body and must not drive status writes.
MIN_BULK_ROWS = 10_000

VALID_STATUSES = {"LICENSED", "PENDING", "ON PROBATION", "CLOSED", "REVOKED"}


def get_with_retries(
    url: str,
    *,
    params: dict[str, Any] | None = None,
    timeout: float = 60,
    max_retries: int = 5,
    base_sleep: float = 1.5,
    session: requests.Session | None = None,
) -> requests.Response:
    """GET with exponential backoff + jitter; honours Retry-After."""
    http = session or requests
    last: Exception | None = None
    for attempt in range(max_retries):
        try:
            resp = http.get(
                url,
                params=params,
                timeout=timeout,
                headers={"User-Agent": USER_AGENT},
            )
            if resp.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
            resp.raise_for_status()
            return resp
        except Exception as exc:  # noqa: BLE001 - deliberate retry boundary
            last = exc
            if attempt == max_retries - 1:
                break
            sleep = min(60.0, base_sleep * (2**attempt)) + random.uniform(0, 1)
            response = getattr(exc, "response", None)
            if response is not None:
                retry_after = response.headers.get("Retry-After", "")
                if retry_after.isdigit():
                    sleep = min(120.0, float(retry_after))
            print(
                f"  retry {attempt + 1}/{max_retries} in {sleep:.1f}s: {url} ({exc})",
                file=sys.stderr,
            )
            time.sleep(sleep)
    raise RuntimeError(f"GET failed after {max_retries} attempts: {url}") from last


def pad_license(value: Any) -> str:
    text = str(value or "").strip()
    return text.zfill(9) if text.isdigit() else text


def parse_mdy(value: str | None) -> date | None:
    text = (value or "").strip()
    if not text:
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


@dataclass(frozen=True)
class BulkSnapshot:
    rows: dict[str, dict[str, str]]
    fetched_at: datetime
    newest_visit: date | None
    newest_closed: date | None


def parse_bulk_csv(text: str, *, fetched_at: datetime, min_rows: int = MIN_BULK_ROWS) -> BulkSnapshot:
    reader = csv.DictReader(io.StringIO(text))
    missing = [c for c in REQUIRED_BULK_COLUMNS if c not in (reader.fieldnames or [])]
    if missing:
        raise RuntimeError(f"CDSS bulk CSV is missing columns: {missing}")
    rows: dict[str, dict[str, str]] = {}
    newest_visit: date | None = None
    newest_closed: date | None = None
    for raw in reader:
        number = pad_license(raw.get("Facility Number"))
        if not number or set(number) == {"0"}:
            continue
        row = {k: (v or "").strip() for k, v in raw.items() if k}
        row["Facility Status"] = row.get("Facility Status", "").upper()
        rows[number] = row
        visit = parse_mdy(row.get("Last Visit Date"))
        closed = parse_mdy(row.get("Closed Date"))
        if visit and (newest_visit is None or visit > newest_visit):
            newest_visit = visit
        if closed and (newest_closed is None or closed > newest_closed):
            newest_closed = closed
    if len(rows) < min_rows:
        raise RuntimeError(
            f"CDSS bulk CSV has {len(rows)} facilities (< {min_rows}); refusing to use a partial file"
        )
    return BulkSnapshot(rows=rows, fetched_at=fetched_at, newest_visit=newest_visit, newest_closed=newest_closed)


def fetch_bulk_rcfe(
    *,
    cache_dir: Path | None = None,
    max_age_hours: float = 20,
    min_rows: int = MIN_BULK_ROWS,
) -> BulkSnapshot:
    """Download (or reuse a same-day cached copy of) the CDSS statewide RCFE CSV."""
    cache_path = None
    if cache_dir is not None:
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_path = cache_dir / "cdss_bulk_rcfe.csv"
        if cache_path.exists():
            age_h = (time.time() - cache_path.stat().st_mtime) / 3600
            if age_h < max_age_hours:
                fetched = datetime.fromtimestamp(cache_path.stat().st_mtime, tz=timezone.utc)
                return parse_bulk_csv(cache_path.read_text(encoding="utf-8", errors="replace"), fetched_at=fetched, min_rows=min_rows)
    resp = get_with_retries(CDSS_BULK_RCFE_URL, timeout=180)
    fetched_at = datetime.now(timezone.utc)
    text = resp.content.decode("utf-8", errors="replace")
    snapshot = parse_bulk_csv(text, fetched_at=fetched_at, min_rows=min_rows)
    if cache_path is not None:
        cache_path.write_text(text, encoding="utf-8")
    return snapshot


def fetch_facility_detail(license_number: str, *, session: requests.Session | None = None) -> dict[str, Any]:
    resp = get_with_retries(CDSS_FACILITY_DETAIL_URL.format(pad_license(license_number)), timeout=45, session=session)
    payload = resp.json()
    detail = payload.get("FacilityDetail") if isinstance(payload, dict) else None
    if not isinstance(detail, dict):
        raise RuntimeError(f"FacilityDetail for {license_number} has no FacilityDetail object")
    return detail


# FacilityDetail STATUS wording seen 2026-11-26 (1,209 homes) and the bulk-file
# status it corresponds to.
_DETAIL_STATUS_MAP = (
    ("PROBATION", "ON PROBATION"),          # "Probationary License"
    ("REVOK", "REVOKED"),
    ("CLOSED", "CLOSED"),                   # "Closed, Change of Ownership" / "..., Licensee Initiated" / "..., Agency Initiated" / ...
    ("APPLICATION WITHDRAWN", "CLOSED"),    # never licensed; bulk lists it as CLOSED
    ("APPLICATION DENIED", "CLOSED"),
    ("LICENSED", "LICENSED"),               # "Licensed", "Licensed/Pending Increase"
    ("PENDING", "PENDING"),
)


def detail_status(detail: dict[str, Any]) -> str:
    """Collapse FacilityDetail wording to the bulk-file vocabulary ('' if unknown)."""
    text = str(detail.get("STATUS") or "").strip().upper()
    for needle, status in _DETAIL_STATUS_MAP:
        if needle in text:
            return status
    return ""


CA_DEMENTIA_CLIENT_CODE = "983"  # "983 - RCFE / DEMENTIA"


def client_served(detail: dict[str, Any]) -> list[str]:
    """FacilityDetail CLIENTSERVED1..6, verbatim, blanks dropped, order kept."""
    out: list[str] = []
    for i in range(1, 7):
        value = str(detail.get(f"CLIENTSERVED{i}") or "").strip()
        if value and value not in out:
            out.append(value)
    return out


def has_dementia_client_code(values: Iterable[str]) -> bool:
    """True only for client type 983. 935 (ELDERLY) and 985 (HOSPICE) are not a dementia basis."""
    return any(v.strip().split("-")[0].strip() == CA_DEMENTIA_CLIENT_CODE for v in values)


def fetch_gis_open_rcfe_numbers(*, page_size: int = 1000) -> set[str]:
    """License numbers the CHHS GIS layer lists as open RCFEs (types 740/741)."""
    numbers: set[str] = set()
    offset = 0
    while True:
        params = {
            "where": "TYPE IN (740, 741)",
            "outFields": "FAC_NBR",
            "returnGeometry": "false",
            "resultOffset": offset,
            "resultRecordCount": page_size,
            "orderByFields": "ObjectId",
            "f": "json",
        }
        resp = get_with_retries(f"{GIS_LAYER_URL}/query", params=params, timeout=60)
        payload = resp.json()
        features = payload.get("features") or []
        for feature in features:
            numbers.add(pad_license((feature.get("attributes") or {}).get("FAC_NBR")))
        if len(features) < page_size and not payload.get("exceededTransferLimit"):
            break
        offset += page_size
    if len(numbers) < 5_000:
        raise RuntimeError(f"GIS layer returned only {len(numbers)} RCFEs; refusing to use it")
    return numbers
