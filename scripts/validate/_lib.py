"""Shared helpers for StarlynnCare validation scripts."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

# ── Environment ────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_env() -> None:
    """Load .env.local into os.environ (does not overwrite existing vars)."""
    env_file = REPO_ROOT / ".env.local"
    if not env_file.exists():
        return
    for raw in env_file.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def get_conn():
    """Return a psycopg connection using DATABASE_URL from .env.local or env."""
    import psycopg
    from psycopg.rows import dict_row

    _load_env()
    url = os.environ.get("DATABASE_URL")
    if not url:
        print(
            "ERROR: DATABASE_URL not set. Add it to .env.local or export it.",
            file=sys.stderr,
        )
        sys.exit(1)
    return psycopg.connect(url, row_factory=dict_row)


# ── Check accumulator ──────────────────────────────────────────────────────────

_failures: list[str] = []
_passes: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> bool:
    """Print PASS/FAIL for a named check and accumulate failures."""
    if condition:
        _passes.append(name)
        print(f"  PASS  {name}" + (f"  ({detail})" if detail else ""))
    else:
        _failures.append(name)
        print(f"  FAIL  {name}" + (f"  ← {detail}" if detail else ""))
    return condition


def run_all_checks(label: str = "Validation") -> None:
    """Print summary and exit 1 if any check failed."""
    total = len(_passes) + len(_failures)
    print()
    print(f"{'─' * 60}")
    print(f"{label} summary: {len(_passes)}/{total} passed")
    if _failures:
        print(f"  Failed checks ({len(_failures)}):")
        for name in _failures:
            print(f"    • {name}")
        print(f"{'─' * 60}")
        sys.exit(1)
    print(f"{'─' * 60}")


# ── HTTP helper ────────────────────────────────────────────────────────────────

def fetch_page(url: str, timeout: int = 10) -> tuple[int, str]:
    """
    GET url and return (status_code, body_text).
    Returns (-1, error_message) on network error.
    """
    import urllib.request
    import urllib.error

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "StarlynnCare-Validator/1.0 "
                "(https://starlynn.care; validation bot)"
            )
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, str(e)
    except Exception as e:
        print(f"    fetch error: {type(e).__name__}: {e}", file=sys.stderr)
        return -1, str(e)
