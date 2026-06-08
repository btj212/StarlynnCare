"""
Shared pytest fixtures and configuration for the StarlynnCare test suite.

Fixtures provided:
  - supabase_url / supabase_key  — loaded from .env.local or env
  - supabase_rest                — thin helper that wraps requests.Session for REST calls
  - http_session                 — requests.Session with UA header (for external API tests)

All DB fixtures skip gracefully when credentials are missing so external-API-only
CI pipelines can still run the government API tests.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pytest
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _load_dot_env() -> None:
    """Load .env.local / .env from repo root — non-fatal if absent."""
    try:
        from dotenv import load_dotenv  # type: ignore[import-untyped]
        for name in (".env.local", ".env"):
            p = REPO_ROOT / name
            if p.is_file():
                load_dotenv(p)
                return
    except ImportError:
        pass


_load_dot_env()


@pytest.fixture(scope="session")
def supabase_url() -> str:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    if not url:
        pytest.skip("NEXT_PUBLIC_SUPABASE_URL not set — skipping DB tests")
    return url


@pytest.fixture(scope="session")
def supabase_anon_key() -> str:
    key = (
        os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "").strip()
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "").strip()
    )
    if not key:
        pytest.skip(
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy ANON_KEY) not set — skipping DB tests"
        )
    return key


@pytest.fixture(scope="session")
def supabase_service_key() -> str:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not key:
        pytest.skip("SUPABASE_SERVICE_ROLE_KEY not set — skipping service-role DB tests")
    return key


class SupabaseRest:
    """
    Thin wrapper around requests.Session for Supabase PostgREST and RPC calls.

    Uses HTTPS (not TCP Postgres) so it works inside the Claude Code web sandbox
    where raw Postgres connections are blocked (ERRORS.md 2026-06).
    """

    def __init__(self, url: str, key: str, *, service_key: str | None = None) -> None:
        self.url = url.rstrip("/")
        self.key = key
        self.service_key = service_key
        self._session = requests.Session()
        self._session.headers.update(
            {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    # ── PostgREST table reads ──────────────────────────────────────────────

    def select(
        self,
        table: str,
        select: str = "*",
        filters: dict[str, str] | None = None,
        order: str | None = None,
        limit: int | None = None,
        *,
        count: bool = False,
        use_service_key: bool = False,
    ) -> dict[str, Any]:
        """
        Perform a SELECT on a PostgREST table endpoint.
        Returns {"data": [...], "count": N | None}.
        """
        params: dict[str, str] = {"select": select}
        if filters:
            for k, v in filters.items():
                params[k] = v
        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)

        headers: dict[str, str] = {}
        if count:
            headers["Prefer"] = "count=exact"
        if use_service_key and self.service_key:
            headers["apikey"] = self.service_key
            headers["Authorization"] = f"Bearer {self.service_key}"

        resp = self._session.get(
            f"{self.url}/rest/v1/{table}",
            params=params,
            headers=headers,
            timeout=30,
        )
        resp.raise_for_status()

        row_count: int | None = None
        cr = resp.headers.get("content-range", "")
        if cr and "/" in cr:
            try:
                row_count = int(cr.split("/")[1])
            except ValueError:
                pass

        return {"data": resp.json(), "count": row_count}

    # ── RPC calls ─────────────────────────────────────────────────────────

    def rpc(
        self,
        function_name: str,
        params: dict[str, Any] | None = None,
        *,
        use_service_key: bool = False,
    ) -> Any:
        """Call a Supabase RPC function. Returns the parsed response body."""
        headers: dict[str, str] = {}
        if use_service_key and self.service_key:
            headers["apikey"] = self.service_key
            headers["Authorization"] = f"Bearer {self.service_key}"

        resp = self._session.post(
            f"{self.url}/rest/v1/rpc/{function_name}",
            json=params or {},
            headers=headers,
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()


@pytest.fixture(scope="session")
def supabase_rest(supabase_url: str, supabase_anon_key: str) -> SupabaseRest:
    return SupabaseRest(supabase_url, supabase_anon_key)


@pytest.fixture(scope="session")
def supabase_rest_service(
    supabase_url: str, supabase_anon_key: str, supabase_service_key: str
) -> SupabaseRest:
    return SupabaseRest(supabase_url, supabase_anon_key, service_key=supabase_service_key)


@pytest.fixture(scope="session")
def http_session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = (
        "StarlynnCare-test-suite/1.0 (automated integration tests; "
        "contact btj212@gmail.com)"
    )
    return s
