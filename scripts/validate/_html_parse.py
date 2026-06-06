"""Shared HTML parsing helpers for live-page validation scripts."""
from __future__ import annotations

import json
import re
from html import unescape
from typing import Any
from urllib.parse import urljoin, urlparse

JSONLD_RE = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.DOTALL | re.IGNORECASE,
)
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.DOTALL | re.IGNORECASE)
META_DESC_RE = re.compile(
    r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']',
    re.IGNORECASE,
)
META_DESC_RE_ALT = re.compile(
    r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']description["\']',
    re.IGNORECASE,
)
CANONICAL_RE = re.compile(
    r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
CANONICAL_RE_ALT = re.compile(
    r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']canonical["\']',
    re.IGNORECASE,
)
ROBOTS_NOINDEX_RE = re.compile(
    r'<meta[^>]+name=["\']robots["\'][^>]+content=["\']([^"\']*)["\']',
    re.IGNORECASE,
)
LOC_RE = re.compile(r"<loc>([^<]+)</loc>")


def strip_tags(html: str) -> str:
    return unescape(re.sub(r"<[^>]+>", "", html)).strip()


def extract_jsonld_blocks(html: str) -> list[Any]:
    """Parse every application/ld+json block; return list of decoded objects."""
    out: list[Any] = []
    for raw in JSONLD_RE.findall(html):
        text = raw.strip()
        if not text:
            continue
        try:
            out.append(json.loads(text))
        except json.JSONDecodeError:
            out.append({"__parse_error__": True, "raw": text[:200]})
    return out


def iter_schema_nodes(obj: Any) -> list[dict[str, Any]]:
    """Flatten @graph and nested nodes into a list of dict nodes."""
    nodes: list[dict[str, Any]] = []
    if isinstance(obj, list):
        for item in obj:
            nodes.extend(iter_schema_nodes(item))
        return nodes
    if not isinstance(obj, dict):
        return nodes
    if obj.get("__parse_error__"):
        nodes.append(obj)
        return nodes
    nodes.append(obj)
    graph = obj.get("@graph")
    if isinstance(graph, list):
        for item in graph:
            nodes.extend(iter_schema_nodes(item))
    return nodes


def node_types(node: dict[str, Any]) -> set[str]:
    t = node.get("@type")
    if t is None:
        return set()
    if isinstance(t, str):
        return {t}
    if isinstance(t, list):
        return {str(x) for x in t}
    return set()


def has_type(node: dict[str, Any], type_name: str) -> bool:
    return type_name in node_types(node)


def find_nodes_by_type(blocks: list[Any], type_name: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for block in blocks:
        for node in iter_schema_nodes(block):
            if has_type(node, type_name):
                found.append(node)
    return found


def extract_title(html: str) -> str:
    m = TITLE_RE.search(html)
    return strip_tags(m.group(1)) if m else ""


def extract_meta_description(html: str) -> str:
    m = META_DESC_RE.search(html) or META_DESC_RE_ALT.search(html)
    return unescape(m.group(1)).strip() if m else ""


def extract_canonical(html: str) -> str:
    m = CANONICAL_RE.search(html) or CANONICAL_RE_ALT.search(html)
    return unescape(m.group(1)).strip() if m else ""


def is_noindex(html: str) -> bool:
    m = ROBOTS_NOINDEX_RE.search(html)
    if not m:
        return False
    return "noindex" in m.group(1).lower()


def extract_sitemap_locs(xml: str) -> list[str]:
    return [unescape(m.group(1)).strip() for m in LOC_RE.finditer(xml)]


def count_href_matches(html: str, href: str) -> int:
    """Count anchor href occurrences for an exact path (quoted in HTML)."""
    path = href if href.startswith("/") else urlparse(href).path
    return len(re.findall(re.escape(f'href="{path}"'), html)) + len(
        re.findall(re.escape(f"href='{path}'"), html)
    )


def path_from_url(url: str) -> str:
    return urlparse(url).path.rstrip("/") or "/"


def absolute_path(base_url: str, path: str) -> str:
    return urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
