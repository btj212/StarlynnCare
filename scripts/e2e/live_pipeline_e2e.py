#!/usr/bin/env python3
"""
Live end-to-end pipeline audit — NO mocks, NO fixtures, NO fake data.

Every check hits a real system: the real regulator/open-data endpoints the
scrapers use, the real Supabase database (read-only, via PostgREST), and the
real production website. Nothing is written anywhere.

Legs:
  1. SOURCE   the endpoints/resources hard-coded in scrapers still exist and
              serve the contract the scrapers rely on (the repo's own scraper
              functions are called, not re-implemented)
  2. DB       cross-table invariants on real rows (inspections <-> deficiencies,
              provenance URLs, dates)
  3. PAGE     sampled facilities render on the live site with matching name,
              canonical, and JSON-LD

Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
Usage: python3 scripts/e2e/live_pipeline_e2e.py [--site URL] [--sample N] [--seed N]
Exit 1 if any check fails. A check that cannot run (network blocked) is reported
as SKIP, never PASS.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import random
import re
import sys
from pathlib import Path
from urllib.parse import quote

import requests

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scrapers"))

SB = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")
STATE_PATH = {"CA": "california", "OR": "oregon", "WA": "washington", "MN": "minnesota",
              "TX": "texas", "AZ": "arizona", "MO": "missouri", "PA": "pennsylvania",
              "UT": "utah", "IL": "illinois"}

results: list[tuple[str, str, str]] = []


def record(status: str, name: str, detail: str = "") -> None:
    results.append((status, name, detail))
    print(f"  {status:<4}  {name}" + (f"  — {detail}" if detail else ""))


def check(name: str, ok: bool, detail: str = "") -> None:
    record("PASS" if ok else "FAIL", name, detail)


def rest(table: str, params: str) -> list[dict]:
    """GET all rows; PostgREST caps a response at 1000 rows, so page with offset."""
    out: list[dict] = []
    while True:
        r = requests.get(f"{SB}/rest/v1/{table}?{params}&limit=1000&offset={len(out)}",
                         headers={"apikey": KEY}, timeout=60)
        r.raise_for_status()
        page = r.json()
        out += page
        if len(page) < 1000:
            return out


# ── Leg 1: SOURCE ────────────────────────────────────────────────────────────
def leg_source() -> None:
    print("\n[1] SOURCE — endpoints the scrapers depend on")
    try:
        import ccld_rcfe_ingest as ca  # the repo's real scraper module
    except Exception as e:  # noqa: BLE001
        record("FAIL", "import ccld_rcfe_ingest", repr(e)[:200])
        return
    # CKAN datastore contract used by fetch_county_rcfe_roster()
    try:
        r = requests.get(ca.CKAN_DATASTORE_URL, timeout=30, params={
            "resource_id": ca.CKAN_RESOURCE_ID, "limit": 1,
            "filters": json.dumps({"county_name": "ALAMEDA"})})
    except requests.RequestException as e:
        record("SKIP", "CA CKAN datastore reachable", repr(e)[:120])
        return
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    check("CA CKAN datastore_search serves the RCFE resource",
          r.status_code == 200 and body.get("success") is True,
          f"HTTP {r.status_code} {(body.get('error') or {}).get('message', '')}")
    meta = requests.get("https://data.ca.gov/api/3/action/resource_show",
                        params={"id": ca.CKAN_RESOURCE_ID}, timeout=30).json().get("result", {})
    check("CA CKAN resource has datastore_active=True", meta.get("datastore_active") is True,
          f"datastore_active={meta.get('datastore_active')}; csv={meta.get('url', '')[:90]}")
    for name, url in (("CA Transparency API (Facility/any)", ca.TRANSPARENCY_ALL_URL),
                      ("CA Transparency API (FacilityReports)", ca.TRANSPARENCY_ALL_URL.replace("Facility/any", "FacilityReports/019200464"))):
        try:
            rr = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
            check(name, rr.status_code == 200, f"HTTP {rr.status_code}")
        except requests.RequestException as e:
            record("SKIP", name, f"unreachable from this host: {type(e).__name__}")


# ── Leg 2: DB ────────────────────────────────────────────────────────────────
def leg_db(sample: int, rng: random.Random) -> list[dict]:
    print("\n[2] DB — invariants on real rows (read-only)")
    states = sorted({r["state_code"] for r in rest(
        "facilities", "select=state_code&publishable=eq.true&state_code=in.(" + ",".join(STATE_PATH) + ")&order=state_code&limit=1")}
        | set(STATE_PATH))
    picked: list[dict] = []
    for st in states:
        rows = rest("facilities", "select=id,state_code,name,slug,city_slug,license_number"
                                  f"&publishable=eq.true&state_code=eq.{st}&order=slug")
        if rows:
            picked += rng.sample(rows, min(sample, len(rows)))
    check("publishable facilities readable via REST", len(picked) > 0,
          f"sampled {len(picked)} across {sorted({f['state_code'] for f in picked})}")
    ids = ",".join(f["id"] for f in picked)
    insp = rest("inspections", f"select=id,facility_id,inspection_date,source_url,total_deficiency_count&facility_id=in.({ids})")
    defs = rest("deficiencies", f"select=id,inspection_id&inspection_id=in.({','.join(i['id'] for i in insp)})") if insp else []
    counts: dict[str, int] = {}
    for d in defs:
        counts[d["inspection_id"]] = counts.get(d["inspection_id"], 0) + 1
    mismatch = [i for i in insp if i["total_deficiency_count"] is not None
                and i["total_deficiency_count"] != counts.get(i["id"], 0)]
    check("inspections.total_deficiency_count == actual deficiency rows", not mismatch,
          f"{len(mismatch)}/{len(insp)} mismatched" + (f"; e.g. {mismatch[0]['id']}" if mismatch else ""))
    check("every sampled inspection has a provenance source_url",
          all(i.get("source_url") for i in insp),
          f"{sum(1 for i in insp if not i.get('source_url'))} missing")
    today = dt.date.today().isoformat()
    future = [i for i in insp if i["inspection_date"] > today]
    check("no inspection dated in the future", not future, f"{len(future)} future-dated")
    return picked


# ── Leg 3: PAGE ──────────────────────────────────────────────────────────────
def leg_page(site: str, picked: list[dict]) -> None:
    print(f"\n[3] PAGE — live render of sampled facilities ({site})")
    for f in picked:
        url = f"{site}/{STATE_PATH.get(f['state_code'], f['state_code'].lower())}/{f['city_slug']}/{f['slug']}"
        try:
            r = requests.get(url, timeout=60)
        except requests.RequestException as e:
            record("SKIP", url, type(e).__name__)
            continue
        if r.status_code != 200:
            check(f"{f['state_code']} {f['slug']} renders", False, f"HTTP {r.status_code}")
            continue
        body = html.unescape(r.text)
        ld_blocks = re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', r.text, re.S)
        types: set[str] = set()
        for b in ld_blocks:
            try:
                j = json.loads(b)
                for node in (j if isinstance(j, list) else j.get("@graph", [j])):
                    types.add(str(node.get("@type")))
            except (ValueError, AttributeError):
                pass
        canon = re.search(r'<link rel="canonical" href="([^"]+)"', r.text)
        ok = bool(canon) and canon.group(1).rstrip("/") == url and "BreadcrumbList" in types
        check(f"{f['state_code']} {f['slug']}: 200 + canonical + BreadcrumbList", ok,
              f"canonical={canon.group(1) if canon else None} ld={sorted(types)}")
        # name is formatted at display (MEMORY 2026-07), so compare case/punct-insensitively on tokens
        toks = [t for t in re.findall(r"[a-z0-9]+", f["name"].lower()) if t not in {"the", "a", "an"}]
        text = " ".join(re.findall(r"[a-z0-9]+", body.lower()))
        check(f"{f['state_code']} {f['slug']}: name tokens present in page",
              all(t in text for t in toks), f["name"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default="https://www.starlynncare.com")
    ap.add_argument("--sample", type=int, default=2, help="facilities per state")
    ap.add_argument("--seed", type=int, default=None)
    a = ap.parse_args()
    if not (SB and KEY):
        sys.exit("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY required")
    seed = a.seed if a.seed is not None else random.randrange(1 << 30)
    print(f"seed={seed}")
    leg_source()
    picked = leg_db(a.sample, random.Random(seed))
    leg_page(a.site.rstrip("/"), picked)
    n = {s: sum(1 for r in results if r[0] == s) for s in ("PASS", "FAIL", "SKIP")}
    print(f"\nSummary: {n['PASS']} passed, {n['FAIL']} failed, {n['SKIP']} skipped")
    for s, name, d in results:
        if s == "FAIL":
            print(f"  FAIL • {name} — {d}")
    sys.exit(1 if n["FAIL"] else 0)


if __name__ == "__main__":
    main()
