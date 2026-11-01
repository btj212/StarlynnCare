#!/usr/bin/env python3
"""Corroborate Illinois homes against public directory pages.

A Place for Mom and Caring.com are advertising. A listing does not create a
license and does not prove the Alzheimer's Special Care Program. This script
reads the public memory-care pages and stamps mc_signal_apfm_listed or
mc_signal_caring_listed only when the listing name matches exactly one
Illinois facility, ignoring punctuation and spacing. Ambiguous names are
counted and left untouched. It does not change publishable.

Usage:
    python3 scrapers/il_directory_corroboration.py
    python3 scrapers/il_directory_corroboration.py --apply
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv
from rapidfuzz import fuzz

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / ".firecrawl" / "directory-match"
REPORT_PATH = REPO_ROOT / "scrapers" / "data" / "il_llcs" / "directory-corroboration.json"
APFM_STATE = "https://www.aplaceformom.com/alzheimers-care/illinois"
CARING_STATE = "https://www.caring.com/senior-living/memory-care-facilities/illinois"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; StarlynnCare/1.0; +https://www.starlynncare.com)",
}
_DROP = re.compile(r"\b(llc|llp|inc|nfp|the|a)\b")


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            return


def compact_name(name: str) -> str:
    text = _DROP.sub(" ", name.lower())
    text = re.sub(r"[^a-z0-9]", "", text)
    if text.endswith("mc") and len(text) > 4:
        text = text[:-2]
    return text


def slugify(text: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def fetch(session: requests.Session, url: str) -> str | None:
    for attempt in (1, 2):
        try:
            response = session.get(url, timeout=40)
        except requests.RequestException as exc:
            print(f"  fail {url} {exc}", flush=True)
            return None
        if response.status_code == 200:
            return response.text
        if response.status_code in {404}:
            return None
        print(f"  {response.status_code} {url}", flush=True)
        if attempt == 1 and response.status_code in {410, 429, 503}:
            time.sleep(1.5)
            continue
        return None
    return None


def json_ld_blocks(html: str) -> list[Any]:
    blocks = []
    for raw in re.findall(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        html,
        flags=re.I | re.S,
    ):
        try:
            blocks.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
    return blocks


def item_lists(payload: Any) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("@type") == "ItemList":
                found.append(node)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(payload)
    return found


def apfm_cities(session: requests.Session) -> list[str]:
    html = fetch(session, APFM_STATE)
    if not html:
        return []
    match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html,
    )
    if not match:
        return []
    data = json.loads(match.group(1))
    view = data["props"]["pageProps"]["viewData"]
    names = [row["cityName"] for row in view.get("NearByCities") or [] if row.get("cityName")]
    for row in view.get("topNCitiesByStateGeo") or []:
        if row.get("cityName"):
            names.append(row["cityName"])
    return sorted({slugify(name) for name in names})


def caring_city_urls(session: requests.Session) -> list[str]:
    html = fetch(session, CARING_STATE)
    if not html:
        return []
    paths = set(re.findall(r"/senior-living/memory-care-facilities/illinois/[a-z0-9\-]+", html))
    return sorted(f"https://www.caring.com{path}" for path in paths)


def parse_apfm_city(html: str, page_url: str) -> list[dict[str, str]]:
    listings = []
    for block in json_ld_blocks(html):
        for item_list in item_lists(block):
            for element in item_list.get("itemListElement") or []:
                item = element.get("item") or {}
                name = item.get("name")
                address = item.get("address") or {}
                if not name:
                    continue
                listings.append({
                    "name": name,
                    "city": address.get("addressLocality") or "",
                    "zip": address.get("postalCode") or "",
                    "source_url": item.get("url") or page_url,
                })
    return listings


def parse_caring_city(html: str, page_url: str) -> list[dict[str, str]]:
    city = page_url.rstrip("/").split("/")[-1].replace("-", " ").title()
    listings = []
    for block in json_ld_blocks(html):
        for item_list in item_lists(block):
            for element in item_list.get("itemListElement") or []:
                image = element.get("image") or {}
                name = image.get("name")
                if not name:
                    continue
                listings.append({
                    "name": name,
                    "city": city,
                    "zip": "",
                    "source_url": element.get("url") or page_url,
                })
    return listings


def collect(session: requests.Session, sources: list[str]) -> dict[str, list[dict[str, str]]]:
    found: dict[str, dict[str, dict[str, str]]] = {source: {} for source in sources}
    if "apfm" in found:
        cities = apfm_cities(session)
        print(f"APFM cities: {len(cities)}", flush=True)
        for index, city in enumerate(cities, start=1):
            url = f"{APFM_STATE}/{city}"
            html = fetch(session, url)
            for row in (parse_apfm_city(html, url) if html else []):
                found["apfm"][compact_name(row["name"]) + "|" + row["source_url"]] = row
            if index % 25 == 0:
                print(f"  APFM {index}/{len(cities)} unique {len(found['apfm'])}", flush=True)
            time.sleep(0.15)

    if "caring" in found:
        saved = OUT_DIR / "caring-il-mc.json"
        if saved.is_file():
            for row in json.loads(saved.read_text(encoding="utf-8")).get("facilities") or []:
                found["caring"][compact_name(row["name"]) + "|" + row["source_url"]] = row
            print(f"Caring kept {len(found['caring'])} saved listings", flush=True)
        caring_urls = caring_city_urls(session)
        print(f"Caring city pages: {len(caring_urls)}", flush=True)
        for index, url in enumerate(caring_urls, start=1):
            html = fetch(session, url)
            rows = parse_caring_city(html, url) if html else []
            for row in rows:
                found["caring"][compact_name(row["name"]) + "|" + row["source_url"]] = row
            if index % 25 == 0:
                print(f"  Caring {index}/{len(caring_urls)} unique {len(found['caring'])}", flush=True)
            time.sleep(0.2)
    return {source: list(rows.values()) for source, rows in found.items()}


def match_listings(
    listings: list[dict[str, str]],
    facilities: list[tuple[str, str, bool]],
) -> dict[str, Any]:
    index: dict[str, list[str]] = {}
    flagged = {facility_id: flag for facility_id, _name, flag in facilities}
    for facility_id, name, _flag in facilities:
        key = compact_name(name)
        if not key:
            continue
        index.setdefault(key, []).append(facility_id)

    names = [(facility_id, name) for facility_id, name, _flag in facilities]
    matched: dict[str, str] = {}
    ambiguous = 0
    unmatched = 0
    for row in listings:
        key = compact_name(row["name"])
        ids = index.get(key) or []
        unique = list(dict.fromkeys(ids))
        if len(unique) == 1:
            matched[unique[0]] = row["source_url"]
            continue
        if len(unique) > 1:
            ambiguous += 1
            continue
        scored = sorted(
            ((fuzz.token_sort_ratio(row["name"], name), facility_id) for facility_id, name in names),
            reverse=True,
        )
        best_score, best_id = scored[0]
        second_score = scored[1][0] if len(scored) > 1 else 0
        # 93 with a clear gap keeps "Sunrise of River Forest" / "Sunrise River Forest"
        # and rejects Bellevue vs Belleville, which scored 90.
        if best_score >= 93 and best_score - second_score >= 4:
            matched[best_id] = row["source_url"]
            continue
        unmatched += 1

    yes = sum(1 for facility_id in matched if flagged.get(facility_id))
    return {
        "listings": len(listings),
        "matched_facilities": len(matched),
        "matched_program_yes": yes,
        "ambiguous": ambiguous,
        "unmatched": unmatched,
        "ids": matched,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--source", choices=["apfm", "caring", "all"], default="all")
    parser.add_argument(
        "--from-saved",
        action="store_true",
        help="Match the JSON already written, instead of downloading the pages again.",
    )
    args = parser.parse_args()
    load_env()
    session = requests.Session()
    session.headers.update(HEADERS)
    sources = ["apfm", "caring"] if args.source == "all" else [args.source]
    if args.from_saved:
        collected = {}
        for source in sources:
            path = OUT_DIR / f"{source}-il-mc.json"
            collected[source] = json.loads(path.read_text(encoding="utf-8"))["facilities"]
    else:
        collected = collect(session, sources)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for source, rows in collected.items():
        path = OUT_DIR / f"{source}-il-mc.json"
        path.write_text(
            json.dumps({"source": source, "facilities": rows}, indent=2),
            encoding="utf-8",
        )
        print(f"wrote {path} ({len(rows)})", flush=True)

    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    report: dict[str, Any] = {}
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id::text, name, COALESCE(il_dementia_program_flag, false)
                FROM facilities
                WHERE state_code = 'IL'
                """
            )
            facilities = [(row[0], row[1], bool(row[2])) for row in cur.fetchall()]
            columns = {
                "apfm": "mc_signal_apfm_listed",
                "caring": "mc_signal_caring_listed",
            }
            for source, column in columns.items():
                if source not in collected:
                    continue
                result = match_listings(collected[source], facilities)
                report[source] = {key: value for key, value in result.items() if key != "ids"}
                print(json.dumps({source: report[source]}), flush=True)
                if not args.apply:
                    continue
                for facility_id in result["ids"]:
                    cur.execute(
                        f"UPDATE facilities SET {column} = true WHERE id = %s AND {column} = false",
                        (facility_id,),
                    )
        if args.apply:
            conn.commit()
        both = 0
        if args.apply:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      count(*) FILTER (WHERE mc_signal_apfm_listed AND mc_signal_caring_listed) AS both,
                      count(*) FILTER (WHERE il_dementia_program_flag AND mc_signal_apfm_listed AND mc_signal_caring_listed) AS yes_both,
                      count(*) FILTER (WHERE il_dementia_program_flag AND (mc_signal_apfm_listed OR mc_signal_caring_listed)) AS yes_either
                    FROM facilities
                    WHERE state_code = 'IL'
                    """
                )
                both_row = cur.fetchone()
                report["after"] = {
                    "both_directories": both_row[0],
                    "program_yes_on_both": both_row[1],
                    "program_yes_on_either": both_row[2],
                }
                both = both_row[0]
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"both_directories_stamped": both, "report": str(REPORT_PATH)}), flush=True)


if __name__ == "__main__":
    main()
