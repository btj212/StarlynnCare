"""
Shared HTTP helpers for state regulator scrapers (OR / MN / WA).

Polite defaults: User-Agent with contact email, session reuse for CSRF cookies,
optional exponential backoff on transient failures.
"""

from __future__ import annotations

import random
import re
import time
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

DEFAULT_UA = "StarlynnCare-Research/1.0 (btj212@gmail.com)"

DEFAULT_BACKOFF_FACTOR = 0.5
DEFAULT_STATUS_FORCELIST = (429, 500, 502, 503, 504)


def make_session(
    *,
    user_agent: str = DEFAULT_UA,
    timeout_sec: float = 60.0,
    retry_total: int = 3,
) -> requests.Session:
    """Session with retries on transient HTTP errors + consistent User-Agent."""
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    retry = Retry(
        total=retry_total,
        connect=retry_total,
        read=retry_total,
        backoff_factor=DEFAULT_BACKOFF_FACTOR,
        status_forcelist=DEFAULT_STATUS_FORCELIST,
        allowed_methods=("GET", "POST"),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    s.request_timeout = timeout_sec  # type: ignore[attr-defined]
    return s


def session_get(
    session: requests.Session, url: str, **kwargs: Any
) -> requests.Response:
    timeout = kwargs.pop("timeout", getattr(session, "request_timeout", 60.0))
    return session.get(url, timeout=timeout, **kwargs)


def session_post(
    session: requests.Session, url: str, **kwargs: Any
) -> requests.Response:
    timeout = kwargs.pop("timeout", getattr(session, "request_timeout", 60.0))
    return session.post(url, timeout=timeout, **kwargs)


def extract_csrf_token(html: str) -> str | None:
    """Oregon DHS LTC: __RequestVerificationToken from hidden input."""
    m = re.search(
        r'name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"',
        html,
        re.I,
    )
    if m:
        return m.group(1)
    m = re.search(
        r'type="hidden"\s+name="__RequestVerificationToken"\s+value="([^"]+)"',
        html,
        re.I,
    )
    if m:
        return m.group(1)
    m = re.search(r'__RequestVerificationToken["\']?\s*value=["\']([^"\']+)["\']', html)
    return m.group(1) if m else None


def extract_aspnet_state(html: str) -> dict[str, str]:
    """ASP.NET WebForms: __VIEWSTATE, __EVENTVALIDATION, optional __VIEWSTATEGENERATOR."""
    out: dict[str, str] = {}

    def grab(name: str) -> None:
        mm = re.search(
            rf'id="{re.escape(name)}"\s+value="([^"]*)"',
            html,
            re.I | re.DOTALL,
        )
        if mm:
            out[name] = mm.group(1)
            return
        mm = re.search(
            rf'name="{re.escape(name)}"\s+value="([^"]*)"',
            html,
            re.I | re.DOTALL,
        )
        if mm:
            out[name] = mm.group(1)

    for key in ("__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"):
        grab(key)
    return out


def polite_sleep(min_sec: float = 1.0, jitter: float = 0.25) -> None:
    """Sleep between requests to state servers (random jitter reduces thundering herd)."""
    time.sleep(min_sec + random.uniform(0, jitter))

