"""
Thin Firecrawl wrapper for StarlynnCare pilots (firecrawl-py v4).

Tracks spend per call in .firecrawl/spend.json and hard-kills if cumulative
spend exceeds FIRECRAWL_PILOT_BUDGET_USD (default $50).

Credit pricing (Hobby plan):
  search  ≈ 1 credit/result
  scrape  ≈ 1 credit
  extract ≈ 5 credits/URL
  crawl   ≈ 1 credit/page

1 credit ≈ $0.001
"""

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from firecrawl import FirecrawlApp
from firecrawl.v2.types import ScrapeOptions

load_dotenv(Path(__file__).parent.parent / ".env.local")

FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY", "")
if not FIRECRAWL_API_KEY:
    raise EnvironmentError("FIRECRAWL_API_KEY not set in .env.local")

BUDGET_USD = float(os.environ.get("FIRECRAWL_PILOT_BUDGET_USD", "50"))
CREDITS_PER_USD = 1000  # 1 credit = $0.001 on Hobby plan

SPEND_FILE = Path(__file__).parent.parent / ".firecrawl" / "spend.json"
SPEND_FILE.parent.mkdir(exist_ok=True)

_app: FirecrawlApp | None = None


def _get_app() -> FirecrawlApp:
    global _app
    if _app is None:
        _app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)
    return _app


def _load_spend() -> dict:
    if SPEND_FILE.exists():
        return json.loads(SPEND_FILE.read_text())
    return {"total_credits": 0, "total_usd": 0.0, "calls": []}


def _save_spend(data: dict) -> None:
    SPEND_FILE.write_text(json.dumps(data, indent=2))


def _charge(operation: str, credits: int, meta: dict | None = None) -> None:
    data = _load_spend()
    data["total_credits"] += credits
    data["total_usd"] = round(data["total_credits"] / CREDITS_PER_USD, 4)
    data["calls"].append({
        "ts": datetime.now(timezone.utc).isoformat(),
        "op": operation,
        "credits": credits,
        "cumulative_usd": data["total_usd"],
        **(meta or {}),
    })
    _save_spend(data)

    if data["total_usd"] >= BUDGET_USD:
        raise RuntimeError(
            f"BUDGET EXCEEDED: ${data['total_usd']:.2f} >= ${BUDGET_USD:.2f}. "
            "Increase FIRECRAWL_PILOT_BUDGET_USD or stop the run."
        )


def current_spend_usd() -> float:
    return _load_spend().get("total_usd", 0.0)


def fc_search(query: str, num_results: int = 5) -> list[dict]:
    """Search the web. Returns list of {url, title, description}."""
    app = _get_app()
    result = app.search(query, limit=num_results)
    # result is SearchData with .web list of SearchResultWeb or Document
    items = result.web or []
    output = []
    for item in items:
        if hasattr(item, "url"):
            output.append({
                "url": item.url or "",
                "title": getattr(item, "title", "") or "",
                "description": getattr(item, "description", "") or "",
            })
    _charge("search", num_results, {"query": query[:80]})
    time.sleep(0.5)
    return output


def fc_scrape(url: str) -> dict:
    """Scrape a URL. Returns {markdown, metadata}."""
    app = _get_app()
    result = app.scrape(url, formats=["markdown"])
    data = {
        "markdown": result.markdown or "",
        "metadata": result.metadata.model_dump() if result.metadata else {},
    }
    _charge("scrape", 1, {"url": url[:80]})
    time.sleep(0.5)
    return data


def fc_extract(url: str, schema: dict, prompt: str | None = None) -> dict:
    """LLM-powered structured extraction. Returns {extract: {...}}."""
    app = _get_app()
    kwargs: dict[str, Any] = {
        "urls": [url],
        "schema": schema,
    }
    if prompt:
        kwargs["prompt"] = prompt
    result = app.extract(**kwargs)
    # result is ExtractResponse; .data contains the extracted content
    extracted: Any = None
    if hasattr(result, "data"):
        extracted = result.data
    elif isinstance(result, dict):
        extracted = result
    _charge("extract", 5, {"url": url[:80]})
    time.sleep(0.5)
    if isinstance(extracted, dict):
        return {"extract": extracted}
    # Sometimes it's a list with one item
    if isinstance(extracted, list) and extracted:
        return {"extract": extracted[0] if isinstance(extracted[0], dict) else {}}
    return {"extract": {}}


def fc_crawl(url: str, depth: int = 2, limit: int = 20) -> list[dict]:
    """Crawl a site up to depth/limit. Returns list of {url, markdown}."""
    app = _get_app()
    result = app.crawl(
        url,
        limit=limit,
        max_discovery_depth=depth,
        scrape_options=ScrapeOptions(formats=["markdown"]),
    )
    pages = result.data or []
    output = []
    for page in pages:
        md = page.markdown or ""
        meta = page.metadata.model_dump() if page.metadata else {}
        output.append({
            "url": meta.get("sourceURL", meta.get("url", "")),
            "markdown": md,
            "metadata": meta,
        })
    _charge("crawl", len(output), {"url": url[:80], "pages": len(output)})
    time.sleep(0.5)
    return output
