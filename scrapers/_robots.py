"""robots.txt check and a polite GET for scripts that read third-party pages.

Google-style matching: * wildcard, $ anchor, longest rule wins, Allow wins a tie.
A site whose robots file cannot be read is treated as closed.
"""

import re
import time
import urllib.request
from functools import lru_cache
from urllib.parse import urlparse

# Some sites answer 403 to a bare bot name but serve pages to this form.
USER_AGENT = "Mozilla/5.0 (compatible; StarlynnCareBot/1.0)"

_last_request_at: dict[str, float] = {}


@lru_cache(maxsize=None)
def _robots_rules(origin: str) -> tuple[tuple[str, bool], ...]:
    """(pattern, allow) pairs for the `*` group of origin/robots.txt."""
    try:
        req = urllib.request.Request(f"{origin}/robots.txt", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8", "replace")
    except Exception:  # noqa: BLE001
        return (("/", False),)
    rules: list[tuple[str, bool]] = []
    in_star_group = False
    last_was_agent = False
    for raw in body.splitlines():
        line = raw.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        field, _, value = line.partition(":")
        field, value = field.strip().lower(), value.strip()
        if field == "user-agent":
            if not last_was_agent:
                in_star_group = False
            in_star_group = in_star_group or value == "*"
            last_was_agent = True
            continue
        last_was_agent = False
        if in_star_group and field in ("allow", "disallow") and value:
            rules.append((value, field == "allow"))
    return tuple(rules)


def robots_allows(url: str) -> bool:
    parsed = urlparse(url)
    target = parsed.path + (f"?{parsed.query}" if parsed.query else "")
    best_len, allowed = -1, True
    for pattern, allow in _robots_rules(f"{parsed.scheme}://{parsed.netloc}"):
        regex = "^" + re.escape(pattern).replace(r"\*", ".*").replace(r"\$", "$")
        if re.match(regex, target) and (
            len(pattern) > best_len or (len(pattern) == best_len and allow)
        ):
            best_len, allowed = len(pattern), allow
    return allowed


def polite_get(url: str, min_gap_s: float = 2.5) -> tuple[int, str]:
    """GET url after a robots check, at most one request per min_gap_s per host.

    Returns (status, body). Status 0 means robots.txt disallows the URL, so
    nothing was fetched. A network error returns (-1, "").
    """
    if not robots_allows(url):
        return 0, ""
    host = urlparse(url).netloc
    wait = _last_request_at.get(host, 0.0) + min_gap_s - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    _last_request_at[host] = time.monotonic()
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:  # noqa: BLE001
        return -1, ""
