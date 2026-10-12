"""Shared plumbing for the live end-to-end suite.

Nothing here fakes anything: every helper talks to the real regulator endpoint,
the real production Supabase REST API (read-only, publishable key, so RLS
applies), or the real production website. Responses are cached on disk only to
keep a full run polite to state servers; delete the cache dir to force a refresh.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRAPERS_DIR = REPO_ROOT / "scrapers"
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

CACHE_DIR = Path(os.environ.get("E2E_CACHE_DIR", "/tmp/starlynncare_e2e_cache"))
CACHE_TTL_SECS = int(os.environ.get("E2E_CACHE_TTL_SECS", str(6 * 3600)))
SITE_URL = os.environ.get("E2E_SITE_URL", "https://www.starlynncare.com").rstrip("/")
UA = {"User-Agent": "StarlynnCare-E2E/1.0 (+https://www.starlynncare.com; contact@starlynncare.com)"}


def _load_env_local() -> None:
    p = REPO_ROOT / ".env.local"
    if not p.is_file():
        return
    for raw in p.read_text().splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


_load_env_local()


def http_get(url: str, *, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None,
             timeout: int = 60, tries: int = 4) -> requests.Response:
    """GET with retry on transport errors / 429 / 5xx. 4xx is returned to the caller untouched."""
    last: Exception | None = None
    for attempt in range(tries):
        try:
            r = requests.get(url, params=params, headers={**UA, **(headers or {})}, timeout=timeout)
            if r.status_code in (429, 500, 502, 503, 504):
                last = RuntimeError(f"HTTP {r.status_code} from {url}")
            else:
                return r
        except requests.RequestException as e:
            last = e
        time.sleep(min(15, 1.5 * 2 ** attempt))
    raise RuntimeError(f"live source unreachable after {tries} tries: {url}") from last


def cached_bytes(key: str, fetch) -> bytes:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    p = CACHE_DIR / hashlib.sha1(key.encode()).hexdigest()
    if p.exists() and time.time() - p.stat().st_mtime < CACHE_TTL_SECS:
        return p.read_bytes()
    data = fetch()
    p.write_bytes(data)
    return data


def cached_get_text(url: str, **kw: Any) -> str | None:
    """Cached GET; returns None on HTTP 4xx (callers decide whether that is a failure)."""
    def _fetch() -> bytes:
        r = http_get(url, **kw)
        return b"" if r.status_code >= 400 else r.content
    data = cached_bytes(url + json.dumps(kw.get("params") or {}, sort_keys=True), _fetch)
    return data.decode("utf-8", errors="replace") if data else None


# ── CA RCFE roster (CDSS open data CSV) ──────────────────────────────────────
CKAN_PACKAGE = "https://data.ca.gov/api/3/action/package_show"
CKAN_RESOURCE_SHOW = "https://data.ca.gov/api/3/action/resource_show"
RCFE_RESOURCE_ID = "6b2f5818-f60d-40b5-bc2a-94f995f9f8b0"


def rcfe_csv_rows() -> list[dict[str, str]]:
    """Real statewide RCFE roster, parsed from the live published CSV."""
    meta = http_get(CKAN_RESOURCE_SHOW, params={"id": RCFE_RESOURCE_ID}).json()["result"]
    raw = cached_bytes("rcfe-csv:" + meta["url"], lambda: http_get(meta["url"], timeout=180).content)
    return list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))


# ── Production Supabase (read-only via PostgREST + publishable key) ──────────
def _sb() -> tuple[str, dict[str, str]]:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set")
    return url.rstrip("/"), {"apikey": key, "Authorization": f"Bearer {key}"}


def sb_select(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    url, headers = _sb()
    r = http_get(f"{url}/rest/v1/{table}", params=params, headers=headers, timeout=60)
    if r.status_code >= 400:
        raise RuntimeError(f"Supabase {table} {r.status_code}: {r.text[:300]}")
    return r.json()


def sb_select_in(table: str, column: str, values: list[str], select: str = "*",
                 extra: dict[str, str] | None = None, batch: int = 100) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i in range(0, len(values), batch):
        chunk = values[i:i + batch]
        params = {"select": select, column: "in.(" + ",".join(chunk) + ")", "limit": "5000", **(extra or {})}
        out.extend(sb_select(table, params))
    return out
