"""Extractive split-and-merge for long reports (v7). No model calls in this module.

Per chunk, the model returns a JSON array of items copied from that chunk:
  {"tag": "0510" | null, "kind": "finding|outcome|fine|correction|statement", "quote": "<verbatim text>", "speaker": "<role>" | null}
The merge step is deterministic:
  1. keep an item only if its quote is a verbatim substring of its own chunk, or of that chunk
     joined to the previous or next chunk with nothing inserted (a finding often starts at the
     end of one chunk and finishes in the next);
  2. if a chunk ends on a tag and the next chunk's finding is verbatim only across that seam
     and came back untagged, attach it to the open tag;
  3. dedupe on (tag, normalised quote); for the same tag, drop a quote contained in another kept quote;
  4. order by first appearance; render as a plain list. Nothing is dropped for length.
Counts are NEVER taken from model output: the final prompt gets the count from parsed D rows / the report's own
stated total ("Cited deficiencies on file"), and the rendered list carries no numbers of its own.
"""
from __future__ import annotations

import json
import re

_WS = re.compile(r"\s+")
_QUOTES = str.maketrans({"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2013": "-", "\u2014": "-"})

def norm(t):
    return _WS.sub(" ", (t or "").translate(_QUOTES)).strip().lower()

def norm_tag(t):
    if t in (None, "", "null", "none"): return None
    s = re.sub(r"[\s\-]", "", str(t)).upper()
    if re.fullmatch(r"0{2}\d{3}", s): s = "0" + s[2:]    # MN layout B prints 00470 for 0470
    return s or None


def tag_key(t):
    """Compare key: letter prefix plus the number with leading zeros removed.

    "C 513" and "C0513" are the same key. "800" and "0800" are the same key.
    A different number is a different key. The stored tag text is still norm_tag.
    """
    s = norm_tag(t)
    if not s:
        return None
    match = re.fullmatch(r"([A-Z]*)(\d+)", s)
    if not match:
        return s
    num = match.group(2).lstrip("0") or "0"
    return match.group(1) + num


def tag_pattern(t):
    """A source may print the tag with spaces or extra leading zeros."""
    key = tag_key(t)
    if not key:
        return None
    match = re.fullmatch(r"([A-Z]*)(\d+)", key)
    if not match:
        return rf"(?<![A-Za-z0-9]){re.escape(key)}(?![A-Za-z0-9])"
    prefix, num = match.group(1), match.group(2)
    if prefix:
        return rf"(?<![A-Za-z0-9]){prefix}\s*0*{re.escape(num)}(?![0-9])"
    return rf"(?<![A-Za-z0-9])0*{re.escape(num)}(?![0-9])"

def parse_items(raw):
    """Parse the model's JSON array; tolerate a fenced block or text around it. Bad output -> []."""
    if not raw: return []
    m = re.search(r"\[.*\]", raw, re.S)
    if not m: return []
    try: arr = json.loads(m.group(0))
    except Exception: return []
    out = []
    for x in arr if isinstance(arr, list) else []:
        if isinstance(x, dict) and isinstance(x.get("quote"), str) and x["quote"].strip():
            out.append({"tag": norm_tag(x.get("tag")), "kind": str(x.get("kind") or "finding").lower(),
                        "quote": x["quote"].strip(), "speaker": x.get("speaker") or None})
    return out

def verbatim(item, chunk_norm):
    q = norm(item["quote"])
    return len(q) >= 12 and q in chunk_norm

_TAG_AT = re.compile(r"\b(0\s?\d{3,4})\b")

def _windows(chunks, i):
    """Normalised text the quote may be copied from: this chunk, or this chunk joined to a neighbor."""
    texts = [chunks[i]]
    if i > 0:
        texts.append(chunks[i - 1] + chunks[i])
    if i + 1 < len(chunks):
        texts.append(chunks[i] + chunks[i + 1])
    return [norm(t) for t in texts]

def _open_tag(chunk):
    """A tag printed at the end of a chunk whose finding sentence has not started yet."""
    matches = list(_TAG_AT.finditer(chunk or ""))
    if not matches:
        return None
    last = matches[-1]
    tail = chunk[last.end():]
    if re.search(r"failed to\s+\S{3,}", tail, re.I):
        return None
    if len(tail.strip()) > 160:
        return None
    return norm_tag(last.group(1))

def merge_items(chunk_texts, chunk_items):
    """chunk_texts[i] is chunk i's text; chunk_items[i] the parsed items. Returns (merged, stats)."""
    stats = {"items_in": 0, "dropped_not_verbatim": 0, "dropped_duplicate": 0, "dropped_contained": 0}
    staged = []
    for i, (text, items) in enumerate(zip(chunk_texts, chunk_items)):
        windows = _windows(chunk_texts, i)
        own = norm(text)
        for src in items:
            stats["items_in"] += 1
            q = norm(src.get("quote"))
            if len(q) < 12 or not any(q in w for w in windows):
                stats["dropped_not_verbatim"] += 1
                continue
            it = {"tag": norm_tag(src.get("tag")), "kind": str(src.get("kind") or "finding").lower(),
                  "quote": (src.get("quote") or "").strip(), "speaker": src.get("speaker")}
            if it["tag"] is None and it["kind"] == "finding" and i > 0 and q not in own:
                opened = _open_tag(chunk_texts[i - 1])
                if opened and q in norm(chunk_texts[i - 1] + text):
                    it["tag"] = opened
            staged.append(it)
    kept, seen = [], set()
    for it in staged:
        key = (it["tag"], norm(it["quote"]))
        if key in seen: stats["dropped_duplicate"] += 1; continue
        seen.add(key); kept.append(it)
    out = []
    for it in kept:   # same tag + same kind: drop a quote contained in a longer kept quote
        q = norm(it["quote"])
        if any(o is not it and o["tag"] == it["tag"] and o["kind"] == it["kind"] and q != norm(o["quote"]) and q in norm(o["quote"]) for o in kept):
            stats["dropped_contained"] += 1; continue
        out.append(it)
    stats["items_out"] = len(out)
    stats["tags_out"] = sorted({it["tag"] for it in out if it["tag"]})
    return out, stats

def render_items(merged, max_chars=12000, per_tag=2):
    """Plain list for the final call, ONE line per tag (several quotes for a tag share its line, so the
    list never shows a tag twice); untagged items (outcomes, fines, statements) follow. Statements keep
    their speaker. The list carries no count of its own."""
    by_tag, order, other = {}, [], []
    for it in merged:
        if it["tag"]:
            if it["tag"] not in by_tag: by_tag[it["tag"]] = []; order.append(it["tag"])
            by_tag[it["tag"]].append(it)
        else: other.append(it)
    lines = []
    for t in order:
        qs = by_tag[t][:per_tag] if per_tag else by_tag[t]
        lines.append(f"- tag {t}: " + " | ".join(f"{q['kind']}: \"{q['quote']}\"" for q in qs))
    for it in other:
        who = f" [{it['speaker']} said]" if it["kind"] == "statement" and it["speaker"] else ""
        lines.append(f"- {it['kind']}{who}: \"{it['quote']}\"")
    # max_chars is ignored. Dropping a line here dropped real tags (a long complaint lost 02360).
    del max_chars
    return "\n".join(lines)

EXTRACT_SYSTEM_PROMPT = """You extract items from ONE part of a long state inspection report, for a later summary.
Return ONLY a JSON array, no prose. Each element:
  {"tag": "<the rule/tag number this item is under, exactly as printed, or null>",
   "kind": "finding" | "outcome" | "fine" | "correction" | "statement",
   "quote": "<text copied EXACTLY, word for word, from this part; one sentence or clause>",
   "speaker": "<role of the person, only for kind=statement, e.g. 'staff', 'the administrator', 'the resident'>"}
Include: for each tag cited (not met) in this part, the sentence that states the failure (e.g. "the licensee failed to ...");
complaint outcomes (substantiated / not substantiated / inconclusive / unfounded); assessed fine amounts as listed;
corrections only if the report says something was corrected; anything a person said that the findings rely on, as kind=statement.
Do not paraphrase, do not count, do not summarize, do not add anything that is not printed in this part.
If this part has only letters, instructions or boilerplate, return []."""
