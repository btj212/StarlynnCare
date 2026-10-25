#!/usr/bin/env python3
"""
Fetch CDSS Transparency API inspection and complaint reports for Alameda County
RCFE facilities, parse deficiencies, and populate `inspections` + `deficiencies`.

Secondary function: promote additional facilities to serves_memory_care = true
if they have citations under California Title 22 §87705 (dementia care) or
§87706 (dementia advertising), which are definitive proof of a memory-care program.

Data source
-----------
    CDSS Transparency API
    https://www.ccld.dss.ca.gov/transparencyapi/api/FacilityReports/{facNum}
      → JSON index: {COUNT, REPORTARRAY: [{REPORTTYPE, REPORTDATE, CONTROLNUMBER}]}
    https://www.ccld.dss.ca.gov/transparencyapi/api/FacilityReports?facNum=X&inx=N
      → HTML of one inspection or complaint report

Report types
------------
    Inspection (FACILITY EVALUATION REPORT)  — routine annual visit
    Complaint  (COMPLAINT INVESTIGATION REPORT) — complaint-driven
    Other      (various: re-inspection, follow-up, LIC9099) — also ingested

Deficiency severity mapping
---------------------------
    CDSS Type A → severity 3  (actual harm / significant risk)
    CDSS Type B → severity 2  (potential for harm)
    Type A + "immediate" in narrative → severity 4 (immediate jeopardy)

Run modes
---------
    python ccld_citations_ingest.py                   # all CA facilities in DB
    python ccld_citations_ingest.py --publishable     # only publishable=true
    python ccld_citations_ingest.py --smoke           # first 3 facilities
    python ccld_citations_ingest.py --dry-run         # parse only, no DB writes
    python ccld_citations_ingest.py --region bay-area # priority Bay Area counties (see COUNTY_CITY_SLUGS)
    python ccld_citations_ingest.py --county ALAMEDA  # one county by city_slug list
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import random
import re
import subprocess
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
import requests

# City slugs per county — keep in sync with `src/lib/regions.ts` county city lists.
COUNTY_CITY_SLUGS: dict[str, tuple[str, ...]] = {
    "ALAMEDA": (
        "alameda",
        "albany",
        "berkeley",
        "castro-valley",
        "dublin",
        "emeryville",
        "fremont",
        "hayward",
        "livermore",
        "newark",
        "oakland",
        "piedmont",
        "pleasanton",
        "san-leandro",
        "san-lorenzo",
        "sunol",
        "union-city",
    ),
    "CONTRA_COSTA": (
        "alamo",
        "antioch",
        "bay-point",
        "brentwood",
        "clayton",
        "concord",
        "danville",
        "el-cerrito",
        "el-sobrante",
        "hercules",
        "lafayette",
        "martinez",
        "moraga",
        "oakley",
        "orinda",
        "pinole",
        "pittsburg",
        "pleasant-hill",
        "richmond",
        "rodeo",
        "san-martin",
        "san-pablo",
        "san-ramon",
        "walnut-creek",
    ),
    "SAN_MATEO": (
        "atherton",
        "belmont",
        "brisbane",
        "burlingame",
        "colma",
        "daly-city",
        "east-palo-alto",
        "emerald-hills",
        "foster-city",
        "half-moon-bay",
        "hillsborough",
        "menlo-park",
        "millbrae",
        "montara",
        "pacifica",
        "portola-valley",
        "redwood-city",
        "s-san-francisco",
        "san-bruno",
        "san-carlos",
        "san-mateo",
        "south-san-francisco",
        "woodside",
    ),
    "SANTA_CLARA": (
        "campbell",
        "cupertino",
        "gilroy",
        "los-altos",
        "los-altos-hills",
        "los-gatos",
        "milpitas",
        "monte-sereno",
        "morgan-hill",
        "mountain-view",
        "palo-alto",
        "san-jose",
        "santa-clara",
        "saratoga",
        "sunnyvale",
    ),
    "SAN_FRANCISCO": ("san-francisco",),
    "VENTURA": (
        "camarillo",
        "fillmore",
        "moorpark",
        "ojai",
        "oxnard",
        "port-hueneme",
        "santa-paula",
        "simi-valley",
        "thousand-oaks",
        "ventura",
    ),
    "ORANGE": (
        "aliso-viejo",
        "anaheim",
        "brea",
        "buena-park",
        "costa-mesa",
        "cypress",
        "dana-point",
        "fountain-valley",
        "fullerton",
        "garden-grove",
        "huntington-beach",
        "irvine",
        "la-habra",
        "la-palma",
        "laguna-beach",
        "laguna-hills",
        "laguna-niguel",
        "laguna-woods",
        "lake-forest",
        "los-alamitos",
        "mission-viejo",
        "newport-beach",
        "orange",
        "placentia",
        "rancho-santa-margarita",
        "san-clemente",
        "san-juan-capistrano",
        "santa-ana",
        "seal-beach",
        "stanton",
        "tustin",
        "villa-park",
        "westminster",
        "yorba-linda",
    ),
}


def _bay_area_city_slugs() -> tuple[str, ...]:
    """Alameda + Contra Costa + San Mateo + Santa Clara + San Francisco city."""
    s: set[str] = set()
    for key in ("ALAMEDA", "CONTRA_COSTA", "SAN_MATEO", "SANTA_CLARA", "SAN_FRANCISCO"):
        s.update(COUNTY_CITY_SLUGS[key])
    return tuple(sorted(s))
from bs4 import BeautifulSoup
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "CA"
SCRAPER_NAME = "cdss_ccld_citations_alameda"

TRANSPARENCY_BASE = "https://www.ccld.dss.ca.gov/transparencyapi/api"
SOURCE_AGENCY = "California CDSS / Community Care Licensing Division"
BULK_SOURCE = "ca_ccld_bulk_compliance_v1"
BULK_URL = f"{TRANSPARENCY_BASE}/DownloadStateData/ResidentialElderCareFacility"

REQUEST_DELAY_SECS = 0.25

# Network hardening. Adaptive runs stay between one and four workers.
# An explicit --workers override may still use the wider diagnostic range.
HTTP_TIMEOUT_SECS = 20
HTTP_MAX_RETRIES = 3
ADAPTIVE_WORKER_MIN = 1
ADAPTIVE_WORKER_MAX = 4
INDEX_FAILURE_THRESHOLD = 12
DEFAULT_MAX_MINUTES = 30
BULK_FALLBACK_LICENSES = frozenset({"372004436", "331880722"})
KEYCHAIN_SERVICE = "starlynncare-database-url"
KEYCHAIN_ACCOUNT = "starlynncare"
SUPPORT_DIR = Path.home() / "Library/Application Support/StarlynnCare"
WEATHER_PATH = SUPPORT_DIR / "cdss-weather.json"
VAULT_ROOT = SUPPORT_DIR / "regulator-vault"
_HTTP_LOCAL = threading.local()
_CLIENT_GUID = str(uuid.uuid4())
WEATHER_RETRY_SCALE = 1.0


class RequestPacer:
    """Space regulator calls so parallel workers cannot retry in lockstep."""

    def __init__(self, min_interval: float = 0.0) -> None:
        self.min_interval = min_interval
        self._lock = threading.Lock()
        self._next_at = 0.0
        self.requests = 0
        self.successes = 0
        self.timeouts = 0
        self.latency_ms: list[float] = []

    def acquire(self) -> None:
        with self._lock:
            now = time.monotonic()
            wait = max(0.0, self._next_at - now)
            spread = random.uniform(0.0, self.min_interval)
            self._next_at = max(now, self._next_at) + self.min_interval + spread
        if wait:
            time.sleep(wait)

    def record(self, *, ok: bool, latency_ms: float, timed_out: bool) -> None:
        with self._lock:
            self.requests += 1
            self.latency_ms.append(latency_ms)
            if ok:
                self.successes += 1
            if timed_out:
                self.timeouts += 1
                self.min_interval = min(2.0, max(self.min_interval, 0.35) * 1.5)
            elif ok and latency_ms < 1500 and self.min_interval > 0.2:
                self.min_interval = max(0.2, self.min_interval * 0.95)


PACER = RequestPacer()
_PREFLIGHT_INDEX: dict[str, dict[str, Any]] = {}


def retry_sleep_seconds(attempt: int, retry_after: str | None = None) -> float:
    """Exponential backoff with jitter, widened when this hour has been unhealthy."""
    if retry_after and str(retry_after).isdigit():
        base = min(60.0, float(retry_after))
        sleep = base + random.uniform(0.0, min(5.0, base * 0.25))
    else:
        base = min(20.0, 0.8 * (2 ** attempt))
        sleep = base * random.uniform(0.5, 1.5)
    return sleep * WEATHER_RETRY_SCALE


def recommend_worker_count(samples: list[dict[str, Any]]) -> int:
    """Choose 1–4 workers from recent CDSS latency and timeout rate."""
    recent = samples[-8:]
    requests_made = sum(int(sample.get("requests") or 0) for sample in recent)
    if requests_made < 5:
        return ADAPTIVE_WORKER_MIN
    timeouts = sum(int(sample.get("timeouts") or 0) for sample in recent)
    latencies = [
        float(sample["latency_ms"])
        for sample in recent
        if sample.get("latency_ms") is not None
    ]
    average_latency = sum(latencies) / len(latencies) if latencies else 10_000.0
    timeout_rate = timeouts / requests_made
    if timeout_rate > 0.2 or average_latency > 8_000:
        return 1
    if timeout_rate < 0.05 and average_latency < 2_500:
        return ADAPTIVE_WORKER_MAX
    return 2


def retry_scale_for_hour(samples: list[dict[str, Any]], hour: int) -> float:
    relevant = [sample for sample in samples if sample.get("hour") == hour]
    requests_made = sum(int(sample.get("requests") or 0) for sample in relevant)
    if requests_made < 3:
        return 1.0
    timeouts = sum(int(sample.get("timeouts") or 0) for sample in relevant)
    if timeouts / requests_made > 0.3:
        return 1.75
    return 1.0


def best_observed_hour(samples: list[dict[str, Any]]) -> int | None:
    by_hour: dict[int, dict[str, int]] = {}
    for sample in samples:
        if sample.get("hour") is None:
            continue
        bucket = by_hour.setdefault(int(sample["hour"]), {"requests": 0, "timeouts": 0})
        bucket["requests"] += int(sample.get("requests") or 0)
        bucket["timeouts"] += int(sample.get("timeouts") or 0)
    ranked = [
        (bucket["timeouts"] / bucket["requests"], hour)
        for hour, bucket in by_hour.items()
        if bucket["requests"] >= 3
    ]
    if not ranked:
        return None
    ranked.sort()
    return ranked[0][1]


def load_weather() -> dict[str, Any]:
    try:
        data = json.loads(WEATHER_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return {"samples": []}
    if not isinstance(data, dict) or not isinstance(data.get("samples"), list):
        return {"samples": []}
    return data


def record_weather(workers: int) -> None:
    samples = list(load_weather().get("samples") or [])
    latencies = sorted(PACER.latency_ms)
    median = latencies[len(latencies) // 2] if latencies else None
    samples.append(
        {
            "ts": datetime.now(timezone.utc).isoformat(),
            "hour": datetime.now().astimezone().hour,
            "requests": PACER.requests,
            "timeouts": PACER.timeouts,
            "successes": PACER.successes,
            "latency_ms": median,
            "workers": workers,
        }
    )
    WEATHER_PATH.parent.mkdir(parents=True, exist_ok=True)
    WEATHER_PATH.write_text(json.dumps({"samples": samples[-48:]}))


def stage_regulator_original(report_key: str, html: str) -> None:
    """Optional content-addressed copy. Off unless explicitly requested."""
    if os.environ.get("STARLYNN_REGULATOR_VAULT") != "1":
        return
    try:
        destination = VAULT_ROOT / report_key[:2] / f"{report_key}.html"
        if destination.is_file():
            return
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(html, encoding="utf-8")
        manifest = VAULT_ROOT / "manifest.jsonl"
        digest = hashlib.sha256(html.encode()).hexdigest()
        with manifest.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"key": report_key, "sha256": digest}) + "\n")
    except OSError as exc:
        print(f"    regulator vault stage skipped: {exc}", file=sys.stderr)


def publish_regulator_vault() -> None:
    if os.environ.get("STARLYNN_REGULATOR_VAULT") != "1" or not VAULT_ROOT.is_dir():
        return
    try:
        subprocess.run(
            [
                "rclone",
                "copy",
                str(VAULT_ROOT),
                "starlynn-gdrive:StarlynnCare Data Archive/CDSS Report Vault",
                "--retries",
                "2",
            ],
            check=False,
            timeout=120,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"Regulator vault upload skipped: {exc}", file=sys.stderr)


def _http_session() -> requests.Session:
    """Reuse TLS connections within each worker without sharing sessions."""
    session = getattr(_HTTP_LOCAL, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update(
            {
                "DSS-Transparency-Config": json.dumps(
                    {
                        "Version": "11.18.0R",
                        "deviceReady": 0,
                        "GUID": _CLIENT_GUID,
                        "DocProtocol": "https://",
                    }
                ),
                "Accept": "application/json, text/plain, */*",
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 Chrome/120 Safari/537.36"
                ),
                "Referer": "https://www.ccld.dss.ca.gov/carefacilitysearch/",
            }
        )
        _HTTP_LOCAL.session = session
    return session


def _get_with_retries(
    url: str,
    *,
    timeout: int = HTTP_TIMEOUT_SECS,
    max_retries: int = HTTP_MAX_RETRIES,
) -> requests.Response:
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        started = time.monotonic()
        try:
            PACER.acquire()
            response = _http_session().get(url, timeout=timeout)
            elapsed_ms = (time.monotonic() - started) * 1000
            # Some facilities return 400 for invalid inx; callers handle it.
            if response.status_code in (429, 500, 502, 503, 504):
                PACER.record(
                    ok=False,
                    latency_ms=elapsed_ms,
                    timed_out=response.status_code >= 500,
                )
                raise requests.HTTPError(
                    f"HTTP {response.status_code}",
                    response=response,
                )
            PACER.record(ok=True, latency_ms=elapsed_ms, timed_out=False)
            return response
        except Exception as exc:  # noqa: BLE001 - intentional broad retry boundary
            last_exc = exc
            if not isinstance(exc, requests.HTTPError):
                PACER.record(
                    ok=False,
                    latency_ms=(time.monotonic() - started) * 1000,
                    timed_out=isinstance(
                        exc, (requests.Timeout, requests.ConnectionError)
                    ),
                )
            if attempt == max_retries - 1:
                break
            retry_after = None
            if isinstance(exc, requests.HTTPError) and getattr(exc, "response", None) is not None:
                retry_after = exc.response.headers.get("Retry-After")
            sleep = retry_sleep_seconds(attempt, retry_after)
            print(
                f"Retrying request ({attempt + 1}/{max_retries}) after {sleep:.1f}s: {url}",
                file=sys.stderr,
            )
            time.sleep(sleep)
    raise RuntimeError(f"Request failed after {max_retries} attempts: {url}") from last_exc


def fingerprint(payload: dict[str, Any]) -> str:
    normalized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(normalized.encode()).hexdigest()


def report_key(report_meta: dict[str, Any]) -> str:
    """Return the stable Lotus document id exposed in REPORTPAGE."""
    page = str(report_meta.get("REPORTPAGE") or "")
    match = re.search(r"/0/([0-9A-F]+)", page, re.IGNORECASE)
    if match:
        return match.group(1).lower()
    return fingerprint(
        {
            "facility": report_meta.get("FACILITYNUMBER"),
            "type": report_meta.get("REPORTTYPE"),
            "date": report_meta.get("REPORTDATE"),
            "control": report_meta.get("CONTROLNUMBER"),
            "page": page,
        }
    )


def normalize_report_inventory(report_array: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "key": report_key(meta),
            "index": index,
            "report_type": meta.get("REPORTTYPE"),
            "report_date": meta.get("REPORTDATE"),
            "control_number": meta.get("CONTROLNUMBER") or None,
            "report_page": meta.get("REPORTPAGE"),
        }
        for index, meta in enumerate(report_array)
    ]


def fetch_bulk_compliance() -> dict[str, dict[str, Any]]:
    """Fetch one statewide CSV and fingerprint compliance fields per facility."""
    response = _get_with_retries(BULK_URL, timeout=120)
    response.raise_for_status()
    reader = csv.DictReader(io.StringIO(response.text))
    if not reader.fieldnames or "Last Visit Date" not in reader.fieldnames:
        raise RuntimeError("CDSS bulk CSV is missing compliance columns")
    compliance_start = reader.fieldnames.index("Last Visit Date")
    compliance_fields = reader.fieldnames[compliance_start:]
    result: dict[str, dict[str, Any]] = {}
    for row in reader:
        facility_number = str(row.get("Facility Number") or "").strip().zfill(9)
        if not facility_number or facility_number == "000000000":
            continue
        payload = {
            field: str(row.get(field) or "").strip()
            for field in compliance_fields
        }
        result[facility_number] = {
            "fingerprint": fingerprint(payload),
            "payload": payload,
        }
    return result


class IndexCircuitBreaker:
    """Stop a run quickly when CDSS is broadly unavailable."""

    def __init__(self, failure_threshold: int = INDEX_FAILURE_THRESHOLD) -> None:
        self.failure_threshold = failure_threshold
        self._consecutive_failures = 0
        self._open = threading.Event()
        self._opened_at = 0.0
        self._lock = threading.Lock()

    @property
    def is_open(self) -> bool:
        return self._open.is_set()

    def allow_attempt(self) -> bool:
        """After a cool-down, let one facility try so a short outage can recover."""
        with self._lock:
            if not self._open.is_set():
                return True
            if time.monotonic() - self._opened_at < 45:
                return False
            self._open.clear()
            self._consecutive_failures = 0
            return True

    def record_success(self) -> None:
        with self._lock:
            self._consecutive_failures = 0
            self._open.clear()

    def record_failure(self) -> None:
        with self._lock:
            self._consecutive_failures += 1
            if self._consecutive_failures >= self.failure_threshold:
                self._open.set()
                self._opened_at = time.monotonic()

# Regex that detects dementia-care regulation citations in section numbers
DEMENTIA_SECTION_RE = re.compile(r"8770[56]")
IMMEDIATE_JEOPARDY_RE = re.compile(
    r"\bimmediate\s+(danger|jeopardy|threat|risk)\b", re.IGNORECASE
)

# Matches citations referenced in complaint narratives before "is being cited on the attached LIC 9099D"
# e.g. "California Code of Regulations, Title 22 Sec 87468.1(11) Personal Rights ... is being cited"
NARRATIVE_CITATION_RE = re.compile(
    r"(?:California Code of Regulations[,\s]+Title 22[,\s]+)?Sec(?:tion)?s?\s+"
    r"([\d]+(?:\.[0-9]+)*(?:\([a-zA-Z0-9]+\))*)"
    r"[^\n]{0,200}?is being cited",
    re.IGNORECASE | re.DOTALL,
)


# ---------------------------------------------------------------------------
# Env
# ---------------------------------------------------------------------------


def load_keychain_database_url() -> None:
    """Read the local DSN without writing an env file or printing the secret."""
    if os.environ.get("DATABASE_URL"):
        return
    try:
        result = subprocess.run(
            [
                "security",
                "find-generic-password",
                "-s",
                KEYCHAIN_SERVICE,
                "-a",
                KEYCHAIN_ACCOUNT,
                "-w",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return
    value = result.stdout.strip()
    if result.returncode == 0 and value:
        os.environ["DATABASE_URL"] = value


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
    load_keychain_database_url()


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def parse_date_cdss(val: str | None) -> date | None:
    if not val or str(val).strip() in ("", "None"):
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(str(val).strip(), fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# HTML parsing helpers
# ---------------------------------------------------------------------------


def table_text(tbl: Any) -> str:
    """Flatten a BeautifulSoup table to a single stripped string."""
    return tbl.get_text(" ", strip=True)


def cells(tbl: Any) -> list[str]:
    """Return a list of stripped cell texts from a table."""
    return [td.get_text(" ", strip=True) for td in tbl.find_all(["td", "th"])]


def find_cell_after(tbl_cells: list[str], label: str) -> str | None:
    """Return the cell immediately following the one containing label."""
    lower = [c.lower() for c in tbl_cells]
    for i, c in enumerate(lower):
        if label.lower() in c and i + 2 < len(tbl_cells):
            # Skip the ':' separator cell if present
            nxt = tbl_cells[i + 1].strip(":")
            return nxt if nxt and nxt != ":" else (tbl_cells[i + 2] if i + 2 < len(tbl_cells) else None)
    return None


# ---------------------------------------------------------------------------
# Report index
# ---------------------------------------------------------------------------


def _fetch_report_index_network(
    fac_num: str,
    *,
    max_retries: int = HTTP_MAX_RETRIES,
) -> dict[str, Any]:
    url = f"{TRANSPARENCY_BASE}/FacilityReports/{fac_num}"
    response = _get_with_retries(url, timeout=20, max_retries=max_retries)
    response.raise_for_status()
    return response.json()


def fetch_report_index(
    fac_num: str,
    *,
    max_retries: int = HTTP_MAX_RETRIES,
) -> dict[str, Any]:
    """Return {COUNT, REPORTARRAY}, reusing the startup probe when it matches."""
    key = str(fac_num).zfill(9)
    cached = _PREFLIGHT_INDEX.pop(key, None)
    if cached is not None:
        return cached
    return _fetch_report_index_network(key, max_retries=max_retries)


def wait_for_report_api(
    fac_num: str,
    *,
    alternates: list[str] | None = None,
    attempts: int = 4,
    pause_seconds: float = 15.0,
    deadline: float | None = None,
) -> bool:
    """Warm the bursty CDSS report service before releasing concurrent work."""
    candidates = [fac_num, *(alternates or [])]
    for attempt in range(1, attempts + 1):
        if deadline is not None and time.monotonic() >= deadline:
            return False
        target = candidates[(attempt - 1) % len(candidates)]
        try:
            probed = fetch_report_index(target, max_retries=1)
            _PREFLIGHT_INDEX[str(target).zfill(9)] = probed
            print(f"CDSS report API ready (probe {attempt}/{attempts}).", flush=True)
            return True
        except Exception as exc:
            print(
                f"CDSS report API probe {attempt}/{attempts} failed: {exc}",
                flush=True,
            )
            if attempt < attempts:
                time.sleep(pause_seconds)
    print(
        "CDSS report API unavailable after bounded startup probes",
        flush=True,
    )
    return False


# ---------------------------------------------------------------------------
# Individual report HTML fetch + parse
# ---------------------------------------------------------------------------


def fetch_report_html(fac_num: str, inx: int) -> str | None:
    """Fetch HTML for report at position inx. Returns None on 4xx."""
    url = f"{TRANSPARENCY_BASE}/FacilityReports?facNum={fac_num}&inx={inx}"
    r = _get_with_retries(url, timeout=15, max_retries=1)
    if r.status_code == 400:
        return None
    r.raise_for_status()
    return r.text


def parse_report(
    html: str,
    report_meta: dict[str, Any],
    fac_num: str,
    source_url: str,
) -> dict[str, Any] | None:
    """
    Parse a CDSS report HTML into a structured dict:
    {
        inspection_date, inspection_type, is_complaint, complaint_id,
        outcome, inspector_name, narrative_text,
        deficiencies: [{type, section, regulatory_text, deficiency_statement, severity, immediate_jeopardy}],
        has_dementia_citation, source_url, raw_html_len
    }
    Returns None if the HTML is clearly not a valid report.
    """
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    if not tables:
        return None

    report_type = report_meta.get("REPORTTYPE", "Other")
    report_date_str = report_meta.get("REPORTDATE", "")
    inspection_date = parse_date_cdss(report_date_str)
    is_complaint = report_type == "Complaint"
    complaint_id = report_meta.get("CONTROLNUMBER") or None
    if complaint_id == "":
        complaint_id = None

    outcome: str | None = None
    outcomes_seen: list[str] = []   # tracks each allegation outcome for mixed detection
    inspector_name: str | None = None
    narrative_parts: list[str] = []
    deficiencies: list[dict[str, Any]] = []
    # Actual visit date extracted from the HTML header table (DATE: MM/DD/YYYY)
    visit_date: date | None = None

    for i, tbl in enumerate(tables):
        txt = table_text(tbl)
        c = cells(tbl)

        # ── Actual visit date from the header table ──────────────────────
        # CDSS header tables contain a standalone "DATE:" cell followed by
        # MM/DD/YYYY — this is when the inspector was on site, distinct from
        # "Report Date:" (the report completion/signing date).
        #
        # Bug: r"\bDATE:" matches the "Date:" inside "Report Date: 10/06/2025"
        # because \b is a word-boundary, not a start-of-word assertion.
        # Fix: use a negative lookbehind so we only match when DATE is NOT
        # preceded by a letter (i.e. it IS standalone).
        if visit_date is None and "DATE" in txt.upper():
            m_date = re.search(
                r"(?<![A-Za-z])DATE:\s*(\d{1,2}/\d{1,2}/\d{4})",
                txt, re.IGNORECASE
            )
            if m_date:
                visit_date = parse_date_cdss(m_date.group(1))

        # ── Outcome (complaints) ─────────────────────────────────────────
        if txt.strip() in ("Substantiated", "Unsubstantiated", "Inconclusive"):
            o = txt.strip()
            if o not in outcomes_seen:
                outcomes_seen.append(o)
            outcome = o   # last one wins for backward compat; resolved below

        # ── Outcome embedded in cell (e.g. "Unsubstantiated | Est...") ──
        if c and c[0].strip() in ("Substantiated", "Unsubstantiated", "Inconclusive"):
            o = c[0].strip()
            if o not in outcomes_seen:
                outcomes_seen.append(o)
            outcome = o

        # ── Inspector name ───────────────────────────────────────────────
        if "LICENSING EVALUATOR NAME" in txt and inspector_name is None:
            for cell in c:
                m = re.search(
                    r"LICENSING EVALUATOR NAME\s*[:\|]?\s*(.+?)(?:\s+LICENSING EVALUATOR SIGNATURE|$)",
                    cell, re.IGNORECASE
                )
                if m:
                    candidate = m.group(1).strip().strip(":")
                    if candidate and "SIGNATURE" not in candidate.upper():
                        inspector_name = candidate
                        break

        # ── Narrative blocks ─────────────────────────────────────────────
        # NARRATIVE tables start with "NARRATIVE" followed by page numbers
        if c and c[0] == "NARRATIVE":
            # Collect all text that isn't just numbers (the page-number columns)
            for cell_txt in c[1:]:
                if not re.match(r"^\d+$", cell_txt):
                    narrative_parts.append(cell_txt)

        # ── Deficiency tables (new CDSS format) ─────────────────────────
        # Modern CDSS format: one table per deficiency *page*, identified by
        # c[0] == "Deficiency Type POC Due Date / Section Number".
        # Each deficiency occupies 10 cells (2 rows × 5 cols) starting at c[3],
        # with a second deficiency at c[13], third at c[23], etc.
        #
        # Cell layout within each 10-cell block (0-indexed from block start):
        #   +0  "Type A/B MM/DD/YYYY Section Cited CCR XXXXX"
        #   +1  line numbers (skip)
        #   +2  regulatory text (the rule that was violated)
        #   +3  line numbers (skip)
        #   +4  POC text (skip)
        #   +5  empty spacer
        #   +6  line numbers (skip)
        #   +7  deficiency statement ("This requirement is not met because...")
        #   +8  line numbers (skip)
        #   +9  empty spacer
        if c and re.match(r"^Deficiency Type\b", c[0], re.IGNORECASE):
            TYPE_SECTION_RE = re.compile(
                r"^(Type [AB])\s+\d{1,2}/\d{1,2}/\d{4}\s+Section Cited\s+CCR\s+"
                r"([\d]+(?:\.[0-9]+)*(?:\([a-zA-Z0-9]+\))*)",
                re.IGNORECASE,
            )
            BLOCK_SIZE = 10
            BLOCK_START = 3  # data starts after the 3-cell header row

            for block_offset in range(BLOCK_START, len(c), BLOCK_SIZE):
                type_sec_raw = c[block_offset] if block_offset < len(c) else ""
                m_ts = TYPE_SECTION_RE.match(type_sec_raw)
                if not m_ts:
                    break  # no more deficiency blocks in this table

                deficiency_type = m_ts.group(1)   # "Type A" or "Type B"
                section = m_ts.group(2)            # e.g. "87465(g)"

                reg_idx  = block_offset + 2
                stmt_idx = block_offset + 7

                # Strip Lotus line-number sequences ("1 2 3 4 5 6 7")
                LINE_NUM_RE = re.compile(r"^\d+(?:\s+\d+)*$")

                def clean_cell(val: str) -> str:
                    return "" if LINE_NUM_RE.match(val.strip()) else val.strip()

                regulatory_text = clean_cell(c[reg_idx]) if reg_idx < len(c) else ""
                raw_stmt = clean_cell(c[stmt_idx]) if stmt_idx < len(c) else ""

                # Strip the standard CDSS divider preamble when present
                split_marker = "This requirement is not met as evidenced by:"
                if split_marker in raw_stmt:
                    deficiency_statement = raw_stmt.split(split_marker, 1)[1].strip()
                else:
                    deficiency_statement = raw_stmt

                immediate = bool(
                    IMMEDIATE_JEOPARDY_RE.search(regulatory_text)
                    or IMMEDIATE_JEOPARDY_RE.search(deficiency_statement)
                )
                severity = (4 if immediate else 3) if deficiency_type == "Type A" else 2

                deficiencies.append({
                    "type": deficiency_type,
                    "section": section,
                    "regulatory_text": regulatory_text,
                    "deficiency_statement": deficiency_statement,
                    "severity": severity,
                    "immediate_jeopardy": immediate,
                    "class": deficiency_type,
                })

        # ── Deficiency tables (legacy format fallback) ───────────────────
        # Older reports may have a separate table per deficiency where
        # c[0] or c[1] is exactly "Type A" or "Type B".
        LEGACY_DEF_RE = re.compile(r"^(Type [AB])$")
        legacy_type = None
        if c and LEGACY_DEF_RE.match(c[0]):
            legacy_type = c[0]
        elif len(c) > 1 and LEGACY_DEF_RE.match(c[1]):
            legacy_type = c[1]

        if legacy_type is not None:
            section = None
            for j, cell in enumerate(c):
                if cell.strip() == "CCR" and j + 1 < len(c):
                    section = c[j + 1].strip()
                    break

            regulatory_text = ""
            deficiency_statement = ""
            if i + 1 < len(tables):
                desc_cells = [
                    x for x in cells(tables[i + 1])
                    if not re.match(r"^\d+$", x)
                ]
                desc_full = " ".join(desc_cells)
                split_marker = "This requirement is not met as evidenced by:"
                if split_marker in desc_full:
                    parts = desc_full.split(split_marker, 1)
                    regulatory_text = parts[0].strip()
                    deficiency_statement = re.sub(
                        r"^\s*Deficient Practice Statement(\s+\d+)*\s*", "",
                        parts[1]
                    ).strip()
                else:
                    deficiency_statement = re.sub(
                        r"^\s*Deficient Practice Statement(\s+\d+)*\s*", "",
                        desc_full
                    ).strip()

            immediate = bool(
                IMMEDIATE_JEOPARDY_RE.search(regulatory_text)
                or IMMEDIATE_JEOPARDY_RE.search(deficiency_statement)
            )
            severity = (4 if immediate else 3) if legacy_type == "Type A" else 2

            deficiencies.append({
                "type": legacy_type,
                "section": section,
                "regulatory_text": regulatory_text,
                "deficiency_statement": deficiency_statement,
                "severity": severity,
                "immediate_jeopardy": immediate,
                "class": legacy_type,
            })

    narrative_text = " ".join(narrative_parts).strip()

    # ── Resolve mixed-outcome complaints ────────────────────────────────────
    # When a single CDSS report has multiple allegations with different outcomes,
    # store "Mixed" so the UI can display an honest label instead of whichever
    # allegation outcome happened to be parsed last.
    unique_outcomes = list(dict.fromkeys(outcomes_seen))  # preserve order, dedupe
    if len(unique_outcomes) > 1:
        outcome = "Mixed"
    elif unique_outcomes:
        outcome = unique_outcomes[0]

    # ── Use actual visit date when available ─────────────────────────────────
    # Primary source: standalone "DATE: MM/DD/YYYY" field in the HTML header.
    # Fallback: "On MM/DD/YYYY" at the start of the inspector narrative —
    # present in nearly all CDSS reports and reflects the actual visit date even
    # when the header only carries a "Report Date:" (completion date).
    if visit_date is not None:
        inspection_date = visit_date
    else:
        # Derive from narrative: "On MM/DD/YYYY ..." or "On MM/DD/YY ..."
        full_narrative = " ".join(narrative_parts)
        m_narr = re.search(
            r"\bOn\s+(\d{1,2}/\d{1,2}/\d{2,4})",
            full_narrative, re.IGNORECASE
        )
        if m_narr:
            narrative_date = parse_date_cdss(m_narr.group(1))
            if narrative_date is not None:
                inspection_date = narrative_date

    # ── Narrative-derived citations (Substantiated complaints) ───────────────
    # When a complaint is substantiated, the formal deficiency is on a separate
    # LIC 9099D sub-page not yet fetched by this scraper. The main narrative
    # always references the cited section with "is being cited on the attached
    # LIC 9099D". Extract those so the deficiency isn't silently lost.
    if outcome in ("Substantiated", "Mixed") and not deficiencies:
        for m in NARRATIVE_CITATION_RE.finditer(narrative_text):
            section = m.group(1).strip()
            deficiencies.append({
                "type": "Type B",          # conservative default; 9099D would have the true class
                "section": section,
                "regulatory_text": f"CCR Title 22 §{section}",
                "deficiency_statement": (
                    f"Cited on LIC 9099D — extracted from complaint narrative. "
                    f"Full deficiency text available on the state CCLD website."
                ),
                "severity": None,
                "immediate_jeopardy": False,
                "class": "Type B",
                "narrative_derived": True,
            })

    # §87705/87706 detection
    has_dementia_citation = any(
        DEMENTIA_SECTION_RE.search(d.get("section") or "")
        for d in deficiencies
    )

    return {
        "inspection_date": inspection_date,
        "inspection_type": report_type.lower(),  # 'inspection', 'complaint', 'other'
        "is_complaint": is_complaint,
        "complaint_id": complaint_id,
        "outcome": outcome,
        "outcomes_seen": unique_outcomes,  # per-allegation outcomes for raw_data
        "inspector_name": inspector_name,
        "narrative_text": narrative_text,
        "deficiencies": deficiencies,
        "has_dementia_citation": has_dementia_citation,
        "report_index_metadata": {
            "report_type": report_meta.get("REPORTTYPE"),
            "report_date": report_meta.get("REPORTDATE"),
            "control_number": report_meta.get("CONTROLNUMBER"),
            "report_page": report_meta.get("REPORTPAGE"),
            "report_key": report_key(report_meta),
        },
        "source_url": source_url,
        "raw_html_len": len(html),
    }


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


def get_already_ingested_urls(
    conn: psycopg.Connection, facility_id: str
) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT source_url FROM inspections WHERE facility_id = %s",
            (facility_id,),
        )
        return {row[0] for row in cur.fetchall()}


def load_ingested_urls(
    conn: psycopg.Connection,
    facility_ids: list[str],
) -> dict[str, set[str]]:
    """Load existing report URLs once instead of querying once per facility."""
    by_facility = {facility_id: set() for facility_id in facility_ids}
    if not facility_ids:
        return by_facility

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT facility_id::text, source_url
            FROM inspections
            WHERE facility_id = ANY(%s::uuid[])
              AND source_url IS NOT NULL
            """,
            (facility_ids,),
        )
        for facility_id, source_url in cur.fetchall():
            by_facility[facility_id].add(source_url)
    return by_facility


def load_bulk_snapshots(
    conn: psycopg.Connection,
    facility_ids: list[str],
) -> dict[str, dict[str, Any]]:
    if not facility_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT facility_id::text, fingerprint, payload
            FROM facility_watch_snapshots
            WHERE source = %s
              AND facility_id = ANY(%s::uuid[])
            """,
            (BULK_SOURCE, facility_ids),
        )
        return {
            facility_id: {"fingerprint": snapshot_fingerprint, "payload": payload}
            for facility_id, snapshot_fingerprint, payload in cur.fetchall()
        }


def upsert_bulk_snapshots(
    dsn: str,
    updates: list[tuple[str, str, dict[str, Any]]],
) -> None:
    if not updates:
        return
    with psycopg.connect(dsn, connect_timeout=30) as conn:
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO facility_watch_snapshots (
                    facility_id, source, fingerprint, payload, scanned_at
                )
                VALUES (%s::uuid, %s, %s, %s::jsonb, now())
                ON CONFLICT (facility_id, source) DO UPDATE SET
                    fingerprint = EXCLUDED.fingerprint,
                    payload = EXCLUDED.payload,
                    scanned_at = now()
                """,
                [
                    (
                        facility_id,
                        BULK_SOURCE,
                        snapshot_fingerprint,
                        psycopg.types.json.Jsonb(payload),
                    )
                    for facility_id, snapshot_fingerprint, payload in updates
                ],
            )
        conn.commit()


def insert_inspection(
    conn: psycopg.Connection,
    facility_id: str,
    parsed: dict[str, Any],
    scrape_run_id: str,
) -> str:
    """Insert one inspection row, return its uuid."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO inspections (
                facility_id, inspection_date, inspection_type,
                is_complaint, complaint_id,
                total_deficiency_count,
                source_url, source_agency, scrape_run_id,
                raw_data
            ) VALUES (
                %s, %s, %s,
                %s, %s,
                %s,
                %s, %s, %s::uuid,
                %s
            )
            RETURNING id::text
            """,
            (
                facility_id,
                parsed["inspection_date"],
                parsed["inspection_type"],
                parsed["is_complaint"],
                parsed["complaint_id"],
                len(parsed["deficiencies"]),
                parsed["source_url"],
                SOURCE_AGENCY,
                scrape_run_id,
                psycopg.types.json.Jsonb({
                    "outcome": parsed["outcome"],
                    "outcomes_seen": parsed.get("outcomes_seen", []),
                    "inspector_name": parsed["inspector_name"],
                    "narrative": parsed["narrative_text"][:10000],
                    "raw_html_len": parsed["raw_html_len"],
                    "report_index_metadata": parsed["report_index_metadata"],
                }),
            ),
        )
        return cur.fetchone()[0]


def is_duplicate_inspection(exc: Exception) -> bool:
    """A shifted report index can point at a row the database already stored."""
    return isinstance(exc, psycopg.errors.UniqueViolation)


def inspection_already_exists(
    conn: psycopg.Connection,
    facility_id: str,
    parsed: dict[str, Any],
) -> bool:
    """Guard bootstrap reconciliation against shifted report indexes."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM inspections
            WHERE facility_id = %s
              AND inspection_date IS NOT DISTINCT FROM %s
              AND COALESCE(inspection_type, '') = COALESCE(%s, '')
              AND complaint_id IS NOT DISTINCT FROM %s
            LIMIT 1
            """,
            (
                facility_id,
                parsed["inspection_date"],
                parsed["inspection_type"],
                parsed["complaint_id"],
            ),
        )
        return cur.fetchone() is not None


def insert_deficiencies(
    conn: psycopg.Connection,
    inspection_id: str,
    deficiencies: list[dict[str, Any]],
) -> None:
    with conn.cursor() as cur:
        for d in deficiencies:
            cur.execute(
                """
                INSERT INTO deficiencies (
                    inspection_id,
                    code, category,
                    severity, class,
                    immediate_jeopardy,
                    description, inspector_narrative,
                    cited_date
                ) VALUES (
                    %s,
                    %s, %s,
                    %s, %s,
                    %s,
                    %s, %s,
                    %s
                )
                """,
                (
                    inspection_id,
                    d["section"],          # code = regulation section
                    d["section"],          # category = same (will enrich later)
                    d["severity"],
                    d["class"],            # "Type A" or "Type B"
                    d["immediate_jeopardy"],
                    d["regulatory_text"][:4000] or None,
                    d["deficiency_statement"][:8000] or None,
                    None,                  # cited_date — set from report date in update below
                ),
            )


def license_key(facility: dict[str, Any]) -> str:
    return str(facility.get("license_number") or "").zfill(9)


def select_reconciliation_targets(
    facilities: list[dict[str, Any]],
    bulk_by_id: dict[str, dict[str, Any]],
    previous_snapshots: dict[str, dict[str, Any]],
    *,
    refetch: bool,
) -> dict[str, list[dict[str, Any]]]:
    """Bulk comparison decides deep work. Named fallbacks are always included."""
    fallbacks = [
        facility
        for facility in facilities
        if license_key(facility) in BULK_FALLBACK_LICENSES
    ]
    fallback_ids = {facility["id"] for facility in fallbacks}
    missing_bulk = [
        facility
        for facility in facilities
        if facility["id"] not in bulk_by_id and facility["id"] not in fallback_ids
    ]
    unchanged: list[dict[str, Any]] = []
    pending: list[dict[str, Any]] = []
    for facility in facilities:
        if facility["id"] not in bulk_by_id or facility["id"] in fallback_ids:
            continue
        if (
            not refetch
            and previous_snapshots.get(facility["id"], {}).get("fingerprint")
            == bulk_by_id[facility["id"]]["fingerprint"]
        ):
            unchanged.append(facility)
        else:
            pending.append(facility)
    return {
        "unchanged": unchanged,
        "missing_bulk": missing_bulk,
        "fallbacks": fallbacks,
        "deep": pending + missing_bulk + fallbacks,
    }


def snapshot_update_for(
    facility: dict[str, Any],
    inventory: list[dict[str, Any]],
    bulk_snapshot: dict[str, Any] | None,
) -> tuple[str, str, dict[str, Any]] | None:
    """Persist a baseline only after the facility's report list reconciled."""
    is_fallback = license_key(facility) in BULK_FALLBACK_LICENSES
    if bulk_snapshot is not None:
        snapshot_fingerprint = bulk_snapshot["fingerprint"]
        bulk_payload = bulk_snapshot["payload"]
    elif is_fallback:
        snapshot_fingerprint = fingerprint(
            {"fallback_reports": [report["key"] for report in inventory]}
        )
        bulk_payload = None
    else:
        return None
    return (
        facility["id"],
        snapshot_fingerprint,
        {
            "schema_version": 1,
            "bulk": bulk_payload,
            "reports": inventory,
            "bulk_fallback": is_fallback,
        },
    )


def promote_memory_care(
    conn: psycopg.Connection, facility_id: str, fac_name: str
) -> None:
    """Mark a facility as memory-care based on §87705/87706 citation evidence."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE facilities SET
                serves_memory_care      = true,
                care_category           = CASE
                    WHEN care_category IN ('ccrc') THEN care_category
                    ELSE 'rcfe_memory_care'
                END,
                memory_care_designation = COALESCE(
                    memory_care_designation,
                    ''
                ) || ' | Cited under §87705/§87706 (dementia care)',
                publishable             = CASE
                    WHEN license_status = 'LICENSED' THEN true
                    ELSE publishable
                END,
                updated_at              = now()
            WHERE id = %s
            AND (serves_memory_care = false OR serves_memory_care IS NULL)
            """,
            (facility_id,),
        )
    print(f"    ⇧ Promoted to memory-care: {fac_name}")


# ---------------------------------------------------------------------------
# Per-facility processing
# ---------------------------------------------------------------------------


def process_facility(
    facility: dict[str, Any],
    conn: psycopg.Connection | None,
    scrape_run_id: str,
    dry_run: bool = False,
    refetch: bool = False,
    already_ingested: set[str] | None = None,
    dsn: str = "",
    index_breaker: IndexCircuitBreaker | None = None,
    deadline: float | None = None,
    previous_snapshot: dict[str, Any] | None = None,
    bulk_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    fac_id = facility["id"]
    fac_name = facility["name"]
    lic_num = facility["license_number"] or ""
    fac_num = lic_num.zfill(9)

    stats = {
        "reports_seen": 0,
        "reports_ingested": 0,
        "reports_skipped": 0,
        "deficiencies": 0,
        "dementia_citations": 0,
        "errors": 0,
        "index_checked": 0,
    }

    if not fac_num or fac_num == "000000000":
        print(f"  Skipping — no license number: {fac_name}")
        return stats

    if deadline is not None and time.monotonic() >= deadline:
        print(f"  Scan time budget exhausted — not checked: {fac_name}")
        stats["errors"] += 1
        return stats

    # Fetch report index. If CDSS is broadly down, leave the remaining homes
    # unchecked and fail the run instead of waiting hours on identical retries.
    if index_breaker is not None and not index_breaker.allow_attempt():
        print(f"  CDSS unavailable — not checked: {fac_name}")
        stats["errors"] += 1
        return stats

    try:
        index_data = fetch_report_index(fac_num)
    except Exception as e:
        print(f"  ERROR fetching report index for {fac_name}: {e}")
        if index_breaker is not None:
            index_breaker.record_failure()
        stats["errors"] += 1
        return stats
    if index_breaker is not None:
        index_breaker.record_success()
    stats["index_checked"] = 1

    count = int(index_data.get("COUNT", 0))
    report_array = index_data.get("REPORTARRAY", [])
    if count != len(report_array):
        print(
            f"  ERROR {fac_name}: index count {count} != array length "
            f"{len(report_array)}"
        )
        stats["errors"] += 1
        return stats
    stats["reports_seen"] = count
    inventory = normalize_report_inventory(report_array)
    previous_payload = (previous_snapshot or {}).get("payload") or {}
    previous_reports = previous_payload.get("reports") or []
    previous_keys = {
        str(report.get("key"))
        for report in previous_reports
        if report.get("key")
    }

    if count == 0:
        print(f"  {fac_name}: no reports")
        if not dry_run:
            snapshot_update = snapshot_update_for(facility, [], bulk_snapshot)
            if snapshot_update is not None:
                stats["_snapshot_update"] = snapshot_update
        return stats

    print(f"  {fac_name}: {count} reports")

    known_urls = already_ingested or set()
    if not dry_run:
        if refetch:
            if conn is None:
                raise ValueError("refetch requires an open database connection")
            # Delete all existing inspections (cascades to deficiencies) and start clean
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM inspections WHERE facility_id = %s",
                    (fac_id,),
                )
            conn.commit()
            print(f"  -- Cleared existing inspections for refetch")
            known_urls = set()
        elif already_ingested is None:
            if conn is None:
                raise ValueError("database connection or preloaded URLs required")
            known_urls = get_already_ingested_urls(conn, fac_id)

    promoted = False
    parsed_reports: list[dict[str, Any]] = []
    confirmed_keys: set[str] = set()
    for inx, meta in enumerate(report_array):
        if deadline is not None and time.monotonic() >= deadline:
            print(f"    Scan time budget exhausted during {fac_name}")
            stats["errors"] += 1
            break
        source_url = (
            f"{TRANSPARENCY_BASE}/FacilityReports?facNum={fac_num}&inx={inx}"
        )
        stable_key = report_key(meta)

        if stable_key in previous_keys or (
            previous_snapshot is None and source_url in known_urls
        ):
            stats["reports_skipped"] += 1
            confirmed_keys.add(stable_key)
            continue

        time.sleep(REQUEST_DELAY_SECS)

        try:
            html = fetch_report_html(fac_num, inx)
        except Exception as e:
            print(f"    inx={inx} fetch error: {e}")
            stats["errors"] += 1
            continue

        if html is None:
            print(f"    inx={inx} listed by index but detail returned 400")
            stats["errors"] += 1
            continue

        stage_regulator_original(stable_key, html)
        parsed = parse_report(html, meta, fac_num, source_url)
        if not parsed:
            print(f"    inx={inx} could not be parsed")
            stats["errors"] += 1
            continue

        n_def = len(parsed["deficiencies"])
        rtype = parsed["inspection_type"]
        rdate = parsed["inspection_date"]

        if dry_run:
            print(
                f"    [{inx:2d}] {rtype:<12} {rdate}  "
                f"{n_def} deficiencies"
                + (" §87705/6!" if parsed["has_dementia_citation"] else "")
            )
            stats["reports_ingested"] += 1
            stats["deficiencies"] += n_def
            if parsed["has_dementia_citation"]:
                stats["dementia_citations"] += 1
            continue

        parsed_reports.append(parsed)

    if dry_run:
        return stats

    def store_reports(write_conn: psycopg.Connection) -> None:
        nonlocal promoted
        for parsed in parsed_reports:
            n_def = len(parsed["deficiencies"])
            try:
                report_identity = str(
                    parsed["report_index_metadata"]["report_key"]
                )
                if (
                    previous_snapshot is None
                    and inspection_already_exists(write_conn, fac_id, parsed)
                ):
                    stats["reports_skipped"] += 1
                    confirmed_keys.add(report_identity)
                    continue
                inspection_id = insert_inspection(
                    write_conn, fac_id, parsed, scrape_run_id
                )
                insert_deficiencies(
                    write_conn, inspection_id, parsed["deficiencies"]
                )
                write_conn.commit()
                stats["reports_ingested"] += 1
                confirmed_keys.add(report_identity)
                stats["deficiencies"] += n_def

                if parsed["has_dementia_citation"]:
                    stats["dementia_citations"] += 1
                    if not promoted and not facility.get("serves_memory_care"):
                        promote_memory_care(write_conn, fac_id, fac_name)
                        write_conn.commit()
                        promoted = True
            except Exception as e:
                write_conn.rollback()
                if is_duplicate_inspection(e):
                    stats["reports_skipped"] += 1
                    confirmed_keys.add(report_identity)
                    continue
                print(f"    DB error: {e}")
                stats["errors"] += 1

    # Network requests happen before opening a write connection. This avoids
    # holding an idle transaction while CDSS is slow or retrying.
    if parsed_reports:
        if conn is not None:
            store_reports(conn)
        else:
            with psycopg.connect(dsn, connect_timeout=30) as write_conn:
                store_reports(write_conn)

    if (
        previous_snapshot is not None
        and bulk_snapshot is not None
        and previous_snapshot.get("fingerprint") != bulk_snapshot["fingerprint"]
        and not parsed_reports
        and not (set(report["key"] for report in inventory) - previous_keys)
    ):
        print(
            f"  ERROR {fac_name}: bulk compliance changed without a new report id"
        )
        stats["errors"] += 1

    if not stats["errors"]:
        snapshot_update = snapshot_update_for(facility, inventory, bulk_snapshot)
        if snapshot_update is not None:
            stats["_snapshot_update"] = snapshot_update
    else:
        # Keep confirmed report ids so the next pass retries only the gaps.
        # The fingerprint stays pending, so this cannot look like "no change".
        confirmed = [
            report for report in inventory if report["key"] in confirmed_keys
        ]
        if confirmed and bulk_snapshot is not None:
            stats["_snapshot_update"] = (
                fac_id,
                "pending:" + fingerprint(
                    {"confirmed": [report["key"] for report in confirmed]}
                ),
                {
                    "schema_version": 1,
                    "bulk": bulk_snapshot["payload"],
                    "reports": confirmed,
                    "reconciliation": "pending",
                    "bulk_fallback": license_key(facility) in BULK_FALLBACK_LICENSES,
                },
            )

    return stats

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="CDSS CCLD citation scraper → inspections + deficiencies"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Parse reports but do not write to DB.",
    )
    parser.add_argument(
        "--publishable", action="store_true",
        help="Only process facilities where publishable = true.",
    )
    parser.add_argument(
        "--smoke", action="store_true",
        help="Process only the first 3 facilities.",
    )
    parser.add_argument(
        "--license", type=str, default=None,
        help="Process only the facility with this license number.",
    )
    parser.add_argument(
        "--city",
        type=str,
        default=None,
        help='Process only facilities in this city (exact match to facilities.city, e.g. "San Francisco").',
    )
    parser.add_argument(
        "--county",
        type=str,
        choices=sorted(COUNTY_CITY_SLUGS.keys()),
        default=None,
        help="Process only facilities whose city_slug is in this county’s beachhead list (see regions.ts).",
    )
    parser.add_argument(
        "--region",
        type=str,
        choices=("bay-area",),
        default=None,
        help="Process only Bay Area priority counties (Alameda, Contra Costa, San Mateo, Santa Clara, San Francisco).",
    )
    parser.add_argument(
        "--refetch", action="store_true",
        help=(
            "Re-parse and overwrite already-ingested reports. "
            "Deletes existing inspections + deficiencies for targeted facilities "
            "and re-inserts from scratch. Use with --license to limit scope."
        ),
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=None,
        help=(
            "Facilities checked concurrently. Omit to choose 1–4 from "
            "observed CDSS health. Explicit values may be 1–12."
        ),
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Stage a bootstrap by reconciling only the first N matched facilities.",
    )
    parser.add_argument(
        "--max-minutes",
        type=int,
        default=DEFAULT_MAX_MINUTES,
        help=(
            "Maximum routine scan duration before failing partial "
            f"(default: {DEFAULT_MAX_MINUTES})."
        ),
    )
    args = parser.parse_args()

    geo_filters = sum(
        1 for x in (args.city, args.county, args.region) if x is not None
    )
    if geo_filters > 1:
        parser.error("Use only one of --city, --county, --region")
    if args.workers is not None and (args.workers < 1 or args.workers > 12):
        parser.error("--workers must be between 1 and 12")
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be at least 1")
    if args.max_minutes < 1 or args.max_minutes > 180:
        parser.error("--max-minutes must be between 1 and 180")
    if args.refetch and args.workers != 1:
        print("--refetch is destructive; using one worker.", flush=True)
        args.workers = 1

    load_env()
    global WEATHER_RETRY_SCALE
    weather_samples = list(load_weather().get("samples") or [])
    if args.workers is None:
        args.workers = recommend_worker_count(weather_samples)
        print(f"Adaptive CDSS workers: {args.workers}", flush=True)
    elif args.workers > ADAPTIVE_WORKER_MAX:
        print(
            f"Explicit worker override: {args.workers} "
            f"(adaptive ceiling is {ADAPTIVE_WORKER_MAX})",
            flush=True,
        )
    WEATHER_RETRY_SCALE = retry_scale_for_hour(
        weather_samples,
        datetime.now().astimezone().hour,
    )
    PACER.min_interval = 0.35

    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print(
            "DATABASE_URL is not set. Store it in Keychain service "
            f"{KEYCHAIN_SERVICE} or export it for this process.",
            file=sys.stderr,
        )
        sys.exit(1)

    dsn = os.environ.get("DATABASE_URL", "")

    # ── Load facilities ──────────────────────────────────────────────────
    print("Loading California facilities...", flush=True)
    ingested_urls: dict[str, set[str]] = {}
    previous_snapshots: dict[str, dict[str, Any]] = {}
    with psycopg.connect(dsn, connect_timeout=30) as conn:
        conn.execute("SET statement_timeout = '120s'")
        query = """
            SELECT id::text, name, license_number, city,
                   serves_memory_care, publishable, license_status
            FROM facilities
            WHERE state_code = 'CA'
            AND license_number IS NOT NULL
        """
        params: list[Any] = []
        if args.publishable:
            query += " AND publishable = true"
        if args.license:
            query += " AND license_number = %s"
            params.append(args.license)
        if args.city:
            query += " AND city = %s"
            params.append(args.city)
        elif args.county:
            query += " AND city_slug = ANY(%s)"
            params.append(list(COUNTY_CITY_SLUGS[args.county]))
        elif args.region == "bay-area":
            query += " AND city_slug = ANY(%s)"
            params.append(list(_bay_area_city_slugs()))
        query += " ORDER BY city, name"

        with conn.cursor() as cur:
            cur.execute(query, params)
            cols = [d[0] for d in cur.description]
            facilities = [dict(zip(cols, row)) for row in cur.fetchall()]

    if args.smoke:
        facilities = facilities[:3]
    if args.limit is not None:
        facilities = facilities[: args.limit]

    if not args.dry_run and not args.refetch:
        print("Loading existing California report inventory...", flush=True)
        with psycopg.connect(dsn, connect_timeout=30) as conn:
            conn.execute("SET statement_timeout = '120s'")
            ingested_urls = load_ingested_urls(
                conn, [facility["id"] for facility in facilities]
            )
            previous_snapshots = load_bulk_snapshots(
                conn, [facility["id"] for facility in facilities]
            )

    print("Downloading statewide CDSS compliance data...", flush=True)
    bulk_by_license = fetch_bulk_compliance()
    bulk_snapshots = {
        facility["id"]: bulk_by_license[facility["license_number"]]
        for facility in facilities
        if facility["license_number"] in bulk_by_license
    }
    selected = select_reconciliation_targets(
        facilities,
        bulk_snapshots,
        previous_snapshots,
        refetch=args.refetch,
    )
    missing_bulk = selected["missing_bulk"]
    unchanged_facilities = selected["unchanged"]
    api_facilities = selected["deep"]

    print(
        f"Bulk rows matched: {len(bulk_snapshots)}/{len(facilities)}; "
        f"unchanged: {len(unchanged_facilities)}; "
        f"report indexes to reconcile: {len(api_facilities)} "
        f"({args.workers} concurrent workers)",
        flush=True,
    )
    if selected["fallbacks"]:
        print(
            "Permanent bulk-fallback indexes: "
            + ", ".join(facility["name"] for facility in selected["fallbacks"]),
            flush=True,
        )
    if missing_bulk:
        print(
            "Unexpected facilities absent from bulk export: "
            + ", ".join(facility["name"] for facility in missing_bulk),
            flush=True,
        )
    if args.dry_run:
        print("(DRY RUN — no DB writes)\n")

    # ── Open scrape_run ──────────────────────────────────────────────────
    scrape_run_id = "00000000-0000-0000-0000-000000000000"
    started_at = datetime.now(timezone.utc)
    started_monotonic = time.monotonic()
    deadline = started_monotonic + (args.max_minutes * 60)

    if not args.dry_run:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO scrape_runs
                        (state_code, scraper_name, status, started_at)
                    VALUES (%s, %s, 'running', %s)
                    RETURNING id::text
                    """,
                    (STATE_CODE, SCRAPER_NAME, started_at),
                )
                scrape_run_id = cur.fetchone()[0]
            conn.commit()

    # ── Process each facility ────────────────────────────────────────────
    totals: dict[str, int] = {
        "reports_seen": 0,
        "reports_ingested": 0,
        "reports_skipped": 0,
        "deficiencies": 0,
        "dementia_citations": 0,
        "errors": 0,
        "index_checked": 0,
        "facilities_processed": 0,
        "bulk_checked": len(bulk_snapshots),
        "facilities_unchanged": len(unchanged_facilities),
        "snapshots_updated": 0,
    }

    error_log_parts: list[str] = []
    index_breaker = IndexCircuitBreaker()
    pending_snapshot_updates: list[tuple[str, str, dict[str, Any]]] = []

    probe_targets = [
        str(facility["license_number"]).zfill(9)
        for facility in api_facilities[:4]
        if facility.get("license_number")
    ]
    if probe_targets and not wait_for_report_api(
        probe_targets[0],
        alternates=probe_targets[1:],
        deadline=deadline,
    ):
        error_log_parts.append(
            "CDSS report API unavailable after bounded startup probes"
        )
        totals["errors"] += 1
        api_facilities = []

    def process_one(fac: dict[str, Any]) -> dict[str, Any]:
        if args.dry_run:
            return process_facility(
                fac,
                None,
                scrape_run_id,
                dry_run=True,
                deadline=deadline,
                previous_snapshot=previous_snapshots.get(fac["id"]),
                bulk_snapshot=bulk_snapshots.get(fac["id"]),
            )
        if args.refetch:
            with psycopg.connect(dsn) as conn:
                return process_facility(
                    fac,
                    conn,
                    scrape_run_id,
                    dry_run=False,
                    refetch=True,
                    deadline=deadline,
                    bulk_snapshot=bulk_snapshots.get(fac["id"]),
                )
        return process_facility(
            fac,
            None,
            scrape_run_id,
            dry_run=False,
            already_ingested=ingested_urls.get(fac["id"], set()),
            dsn=dsn,
            index_breaker=index_breaker,
            deadline=deadline,
            previous_snapshot=previous_snapshots.get(fac["id"]),
            bulk_snapshot=bulk_snapshots.get(fac["id"]),
        )

    def flush_snapshot_updates() -> None:
        if args.dry_run or not pending_snapshot_updates:
            return
        updates = list(pending_snapshot_updates)
        upsert_bulk_snapshots(dsn, updates)
        totals["snapshots_updated"] += len(updates)
        pending_snapshot_updates.clear()

    def record_result(fac: dict[str, Any], stats: dict[str, Any]) -> None:
        for k in totals:
            if k in stats and isinstance(stats[k], int):
                totals[k] += stats[k]
        totals["facilities_processed"] += 1
        snapshot_update = stats.get("_snapshot_update")
        if snapshot_update is not None:
            pending_snapshot_updates.append(snapshot_update)
            if len(pending_snapshot_updates) >= 25:
                flush_snapshot_updates()

        if stats["errors"]:
            error_log_parts.append(
                f"{fac['name']}: {stats['errors']} errors"
            )
        print(
            f"Progress {totals['facilities_processed']}/"
            f"{len(api_facilities)}: "
            f"{fac['name']} — {stats['reports_ingested']} new, "
            f"{stats['errors']} errors",
            flush=True,
        )

    if args.workers == 1:
        for fac in api_facilities:
            record_result(fac, process_one(fac))
    else:
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {
                executor.submit(process_one, fac): fac
                for fac in api_facilities
            }
            for future in as_completed(futures):
                fac = futures[future]
                try:
                    stats = future.result()
                except Exception as e:
                    print(f"  ERROR processing {fac['name']}: {e}")
                    stats = {
                        "reports_seen": 0,
                        "reports_ingested": 0,
                        "reports_skipped": 0,
                        "deficiencies": 0,
                        "dementia_citations": 0,
                        "errors": 1,
                        "index_checked": 0,
                    }
                record_result(fac, stats)
    flush_snapshot_updates()
    try:
        record_weather(args.workers)
    except OSError as exc:
        print(f"CDSS health history was not saved: {exc}", file=sys.stderr)
    publish_regulator_vault()

    # ── Close scrape_run ─────────────────────────────────────────────────
    run_status = "success" if not error_log_parts else "partial"
    if not args.dry_run:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE scrape_runs SET
                        completed_at    = now(),
                        status          = %s,
                        records_found   = %s,
                        records_new     = %s,
                        error_log       = %s
                    WHERE id = %s::uuid
                    """,
                    (
                        run_status,
                        totals["reports_seen"],
                        totals["reports_ingested"],
                        "\n".join(error_log_parts) or None,
                        scrape_run_id,
                    ),
                )
            conn.commit()

    # ── Summary ──────────────────────────────────────────────────────────
    summary_status = (
        "DRY RUN"
        if args.dry_run
        else ("PARTIAL" if totals["errors"] else "COMPLETE")
    )
    print(f"\n{'='*60}")
    print(f"Phase D citations ingest — {summary_status}")
    print(f"{'='*60}")
    print(f"  Facilities processed  : {totals['facilities_processed']}")
    print(f"  Bulk records checked  : {totals['bulk_checked']}")
    print(f"  Facilities unchanged  : {totals['facilities_unchanged']}")
    print(f"  Facility indexes checked: {totals['index_checked']}")
    print(f"  Snapshots updated     : {totals['snapshots_updated']}")
    print(f"  Reports seen          : {totals['reports_seen']}")
    print(f"  Reports ingested      : {totals['reports_ingested']}")
    print(f"  Reports skipped       : {totals['reports_skipped']} (already in DB)")
    print(f"  Deficiencies stored   : {totals['deficiencies']}")
    print(f"  §87705/87706 citations: {totals['dementia_citations']}")
    print(f"  Errors                : {totals['errors']}")
    print(f"  HTTP requests         : {PACER.requests}")
    print(f"  HTTP timeouts         : {PACER.timeouts}")
    print(f"  Retry scale           : {WEATHER_RETRY_SCALE:.2f}")
    best_hour = best_observed_hour(load_weather().get("samples") or [])
    if best_hour is not None:
        print(f"  Healthiest observed hour: {best_hour:02d}:00 local")
    print(f"  Elapsed seconds       : {time.monotonic() - started_monotonic:.1f}")
    if not args.dry_run:
        print(f"  scrape_run id         : {scrape_run_id}")
    print(f"{'='*60}")
    return 1 if totals["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
