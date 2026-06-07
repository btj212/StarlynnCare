"""Shared Firecrawl CLI helper: scrape a URL to markdown text."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


def scrape_url_to_markdown(
    url: str,
    out_path: Path,
    *,
    wait_ms: int = 6000,
    timeout_sec: int = 180,
    only_main_content: bool = True,
) -> str | None:
    """Run `firecrawl scrape` and return markdown body (handles JSON bundle output)."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "firecrawl",
        "scrape",
        url,
        "--format",
        "markdown",
        "--wait-for",
        str(wait_ms),
    ]
    if only_main_content:
        cmd.append("--only-main-content")
    cmd.extend(["-o", str(out_path)])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec)
        if result.returncode != 0:
            return None
        if not out_path.exists():
            return None
        body = out_path.read_text(encoding="utf-8", errors="replace")
        if body.strip().startswith("{"):
            try:
                bundle = json.loads(body)
                if isinstance(bundle, dict):
                    if "markdown" in bundle:
                        return str(bundle["markdown"])
                    data = bundle.get("data")
                    if isinstance(data, dict) and "markdown" in data:
                        return str(data["markdown"])
            except json.JSONDecodeError:
                pass
        return body
    except (subprocess.TimeoutExpired, OSError):
        return None


def parse_json_from_llm(text: str) -> dict:
    """Extract first JSON object from model output."""
    raw = text.strip()
    if "```" in raw:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            raw = raw[start:end]
    decoder = json.JSONDecoder()
    for i, ch in enumerate(raw):
        if ch == "{":
            try:
                obj, _ = decoder.raw_decode(raw[i:])
                return obj
            except json.JSONDecodeError:
                continue
    return json.loads(raw)
