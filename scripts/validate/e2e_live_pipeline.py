#!/usr/bin/env python3
"""
Layer 6 — live end-to-end pipeline parity. NO mocks, NO fixtures, NO fake data.

Every run pulls the *current* raw payload from the real upstream regulator
services, reads the *current* rows out of the production database (read-only),
and fetches the *current* rendered page from the live site. It then proves that
each hop preserved the data:

    regulator API  ──(S1/S2/S3/S4 ingest parity)──▶  Supabase rows
    Supabase rows  ──(S5 physical-city parity)────▶  Census geocoder
    Supabase rows  ──(S6 render parity)───────────▶  live HTML / JSON-LD

Stages
------
S1  CMS provider directory  (data.cms.gov 4pq5-n9py)  vs facilities   — every ingested field
S2  CMS health deficiencies (data.cms.gov r5ix-sfxw)  vs inspections + deficiencies
S3  CA CDSS Transparency API report index             vs inspections  — completeness, type, dates, ids
S4  CA CDSS report HTML (parsed by the real ingest parser) vs inspections + deficiencies,
    plus a parser-independent check that DB narrative text exists in the raw HTML
S5  Census Geocoder (lat/lon → place)                 vs facilities.city_slug (physical-city rule)
S6  DB → live page: identity, address, phone, license, counts, dates, JSON-LD, canonical,
    no placeholder tokens, no fabricated aggregateRating/geo

Read-only: the DB is accessed through PostgREST GETs only. Nothing is written.

Usage
-----
    python3 scripts/validate/e2e_live_pipeline.py                  # all stages, default sample
    python3 scripts/validate/e2e_live_pipeline.py --stage S3 S4    # subset
    python3 scripts/validate/e2e_live_pipeline.py --per-state 8 --seed 7
    python3 scripts/validate/e2e_live_pipeline.py --json out.json  # machine-readable findings
    python3 scripts/validate/e2e_live_pipeline.py --site https://preview.vercel.app

Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (env or .env.local).
Exit code 1 if any check fails. A failure means upstream and downstream disagree —
it is a finding to triage, not noise to be tuned away.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "scrapers"))

from validate._lib import _load_env  # noqa: E402
from validate._html_parse import (  # noqa: E402
    CANONICAL_RE,
    CANONICAL_RE_ALT,
    extract_jsonld_blocks,
    iter_schema_nodes,
)

_load_env()

DEFAULT_SITE = "https://www.starlynncare.com"
CMS_DIR_DS = "4pq5-n9py"
CMS_DEF_DS = "r5ix-sfxw"
CMS_QUERY = "https://data.cms.gov/provider-data/api/1/datastore/query/{ds}/0"
CCLD_API = "https://www.ccld.dss.ca.gov/transparencyapi/api"
CENSUS = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"
DISPLAY_YEARS = 3  # INSPECTION_DISPLAY_YEARS in src/lib/facility/loadFacilityProfile.ts
STATE_SLUG = {
    "CA": "california", "WA": "washington", "OR": "oregon", "TX": "texas", "AZ": "arizona",
    "UT": "utah", "MN": "minnesota", "MO": "missouri", "IL": "illinois", "PA": "pennsylvania",
}
UA = {"User-Agent": "Mozilla/5.0 (StarlynnCare-E2E-Validator)"}

# CMS scope/severity letter → severity (mirror of scrapers/cms_nh_deficiencies_ingest.py)
CMS_SEV = {**{c: 1 for c in "ABC"}, **{c: 2 for c in "DEF"}, **{c: 3 for c in "GHI"}, **{c: 4 for c in "JKL"}}


# ── recorder ──────────────────────────────────────────────────────────────────

class Recorder:
    def __init__(self) -> None:
        self.passes = 0
        self.fails: list[dict[str, Any]] = []
        self.notes: list[dict[str, Any]] = []
        self.stage = "?"

    def check(self, subject: str, name: str, ok: bool, detail: str = "") -> bool:
        if ok:
            self.passes += 1
        else:
            self.fails.append({"stage": self.stage, "subject": subject, "check": name, "detail": detail})
            print(f"  FAIL  [{self.stage}] {subject} :: {name}  ← {detail[:300]}")
        return ok

    def note(self, subject: str, detail: str) -> None:
        self.notes.append({"stage": self.stage, "subject": subject, "detail": detail})
        print(f"  note  [{self.stage}] {subject}: {detail[:300]}")


R = Recorder()


# ── IO helpers (all GET, all live) ────────────────────────────────────────────

def _get(url: str, *, params: dict | None = None, headers: dict | None = None,
         timeout: int = 60, tries: int = 4) -> requests.Response:
    last: Exception | None = None
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=timeout)
            if r.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(f"HTTP {r.status_code}")
            return r
        except Exception as e:  # noqa: BLE001 - retry boundary
            last = e
            time.sleep(min(15, 1.5 * 2 ** i))
    raise RuntimeError(f"GET failed after {tries} tries: {url} ({last})")


class Db:
    """Read-only PostgREST client."""

    def __init__(self) -> None:
        self.base = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/rest/v1"
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def get(self, path: str, **params: str) -> list[dict[str, Any]]:
        r = _get(f"{self.base}/{path}", params=params, headers=self.h)
        if r.status_code != 200:
            raise RuntimeError(f"PostgREST {r.status_code} on {path} {params}: {r.text[:200]}")
        return r.json()


def cms_rows(dataset: str, ccn: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    offset = 0
    while True:
        r = _get(
            CMS_QUERY.format(ds=dataset),
            params={
                "conditions[0][property]": "cms_certification_number_ccn",
                "conditions[0][value]": ccn,
                "limit": 500,
                "offset": offset,
            },
            headers=UA,
        )
        res = r.json().get("results", [])
        out.extend(res)
        if len(res) < 500:
            return out
        offset += 500


def digits(s: Any) -> str:
    return re.sub(r"\D", "", str(s or ""))


def norm(s: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()


def norm_ws(s: Any) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


# ── sampling ──────────────────────────────────────────────────────────────────

def sample_facilities(db: Db, rng: random.Random, state: str, n: int, extra: str = "") -> list[dict[str, Any]]:
    """Random sample of publishable facilities in a state (deterministic for a given seed)."""
    cols = ("id,state_code,name,slug,city,city_slug,street,zip,phone,license_number,cms_ccn,beds,"
            "latitude,longitude,facility_type,wa_facility_type,publishable,last_inspection_date")
    q = {"select": cols, "state_code": f"eq.{state}", "publishable": "eq.true", "limit": "1"}
    total = int(_get(f"{db.base}/facilities", params={**q, "select": "id"},
                    headers={**db.h, "Prefer": "count=exact", "Range": "0-0"}).headers["content-range"].split("/")[-1])
    if total == 0:
        return []
    picks = sorted(rng.sample(range(total), min(n, total)))
    rows: list[dict[str, Any]] = []
    for off in picks:
        rows += db.get("facilities", select=cols, state_code=f"eq.{state}", publishable="eq.true",
                       order="id.asc", limit="1", offset=str(off))
    return rows


# ── S1 / S2: CMS ──────────────────────────────────────────────────────────────

def sample_cms_facilities(db: Db, rng: random.Random, n: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for st in ("WA", "OR", "PA", "UT"):
        cols = "id,state_code,name,street,city,zip,phone,beds,cms_ccn,cms_overall_rating,latitude,longitude,facility_type"
        rows = db.get("facilities", select=cols, state_code=f"eq.{st}", cms_ccn="not.is.null",
                      facility_type="eq.Nursing Home", order="id.asc", limit="400")
        out += rng.sample(rows, min(n, len(rows)))
    return out


def stage_s1(db: Db, rng: random.Random, n: int) -> None:
    R.stage = "S1"
    print("\n── S1 CMS directory vs facilities ──")
    for f in sample_cms_facilities(db, rng, n):
        ccn = f["cms_ccn"]
        subj = f"{f['state_code']} {ccn} {f['name']}"
        up = cms_rows(CMS_DIR_DS, ccn)
        if not R.check(subj, "ccn exists upstream", len(up) == 1, f"{len(up)} rows"):
            continue
        u = up[0]
        R.check(subj, "state", u["state"] == f["state_code"], f"cms={u['state']} db={f['state_code']}")
        R.check(subj, "name", norm(u["provider_name"]) == norm(f["name"]), f"cms={u['provider_name']!r} db={f['name']!r}")
        R.check(subj, "street", norm(u["provider_address"]) == norm(f["street"]), f"cms={u['provider_address']!r} db={f['street']!r}")
        R.check(subj, "city", norm(u["citytown"]) == norm(f["city"]), f"cms={u['citytown']!r} db={f['city']!r}")
        R.check(subj, "zip", str(u["zip_code"])[:5] == str(f["zip"] or "")[:5], f"cms={u['zip_code']} db={f['zip']}")
        R.check(subj, "phone", digits(u["telephone_number"]) == digits(f["phone"]), f"cms={u['telephone_number']} db={f['phone']}")
        R.check(subj, "beds", str(u["number_of_certified_beds"] or "").strip() == str(f["beds"] if f["beds"] is not None else ""),
                f"cms={u['number_of_certified_beds']} db={f['beds']}")
        up_rating = u.get("overall_rating") or ""
        R.check(subj, "overall rating", str(up_rating) == str(f["cms_overall_rating"] if f["cms_overall_rating"] is not None else ""),
                f"cms={up_rating!r} db={f['cms_overall_rating']}")
        for ck, uk in (("latitude", "latitude"), ("longitude", "longitude")):
            uv, dv = u.get(uk), f.get(ck)
            if uv not in (None, "") and dv is not None:
                R.check(subj, ck, abs(float(uv) - float(dv)) < 0.01, f"cms={uv} db={dv}")


def sample_cms_inspected(db: Db, rng: random.Random, n: int) -> list[dict[str, Any]]:
    """Facilities the CMS-deficiency pipeline has actually written to (>=1 CMS-sourced inspection)."""
    out: list[dict[str, Any]] = []
    for st in ("WA", "PA", "UT"):
        rows = db.get("facilities", select="id,state_code,name,cms_ccn,inspections!inner(id)", state_code=f"eq.{st}",
                      cms_ccn="not.is.null", **{"inspections.source_agency": "eq.CMS"}, order="id.asc", limit="400")
        out += rng.sample(rows, min(n, len(rows)))
    return out


def stage_s2(db: Db, rng: random.Random, n: int) -> None:
    R.stage = "S2"
    print("\n── S2 CMS deficiencies vs inspections/deficiencies ──")
    for st in ("OR",):
        n_nh = len(db.get("facilities", select="id", state_code=f"eq.{st}", cms_ccn="not.is.null", limit="1000"))
        n_cms = len(db.get("facilities", select="id,inspections!inner(id)", state_code=f"eq.{st}", cms_ccn="not.is.null",
                           **{"inspections.source_agency": "eq.CMS"}, limit="1000"))
        R.note(f"{st} coverage", f"{n_cms}/{n_nh} CMS-id facilities have CMS-sourced inspections (CMS deficiency ingest not run for {st})")
    for f in sample_cms_inspected(db, rng, n):
        ccn = f["cms_ccn"]
        subj = f"{f['state_code']} {ccn} {f['name']}"
        up = cms_rows(CMS_DEF_DS, ccn)
        insp = db.get(
            "inspections",
            select="id,inspection_date,source_url,deficiencies(code,scope_severity_code,severity,immediate_jeopardy,corrected_date,description)",
            facility_id=f"eq.{f['id']}",
            source_agency="eq.CMS",
        )
        urls = [i["source_url"] for i in insp]
        R.check(subj, "each CMS inspection has its own citation URL (not a shared search page)",
                len(set(urls)) == len(urls), f"{len(urls)} inspections share {len(set(urls))} distinct source_url(s): {urls[0] if urls else ''}")
        want: dict[tuple[str, str], dict[str, Any]] = {}
        for r in up:
            tag = str(r.get("deficiency_tag_number") or "").strip()
            if not tag or not r.get("survey_date"):
                continue
            want[(r["survey_date"], tag if tag.startswith("F") else f"F{tag}")] = r
        have: dict[tuple[str, str], dict[str, Any]] = {}
        for i in insp:
            for d in i["deficiencies"]:
                have[(i["inspection_date"], d["code"])] = d
        missing = sorted(set(want) - set(have))
        R.check(subj, f"every upstream deficiency ingested ({len(want)} upstream)", not missing,
                f"{len(missing)} missing e.g. {missing[:3]}")
        stale = sorted(set(have) - set(want))
        if stale:
            R.note(subj, f"{len(stale)} DB deficiencies no longer in the live CMS window (retained history) e.g. {stale[:2]}")
        for key in sorted(set(want) & set(have)):
            u, d = want[key], have[key]
            tag = f"{subj} {key[0]} {key[1]}"
            letter = (u.get("scope_severity_code") or "").strip().upper()
            R.check(tag, "scope/severity letter", (d["scope_severity_code"] or "") == letter, f"cms={letter!r} db={d['scope_severity_code']!r}")
            R.check(tag, "severity level", d["severity"] == CMS_SEV.get(letter), f"letter={letter} db_sev={d['severity']}")
            R.check(tag, "immediate jeopardy flag", bool(d["immediate_jeopardy"]) == (letter in ("J", "K", "L")),
                    f"letter={letter} ij={d['immediate_jeopardy']}")
            desc = (u.get("deficiency_description") or "").strip()
            R.check(tag, "description text", (d["description"] or "") == desc[:4000], f"cms={desc[:60]!r} db={(d['description'] or '')[:60]!r}")
            cd = (u.get("correction_date") or "").strip()
            R.check(tag, "correction date", (d["corrected_date"] or "") == cd, f"cms={cd!r} db={d['corrected_date']!r}")


# ── S3 / S4: CA CCLD ──────────────────────────────────────────────────────────

_HTML_CACHE: dict[tuple[str, int], str | None] = {}


def _ccld_index(fac_num: str) -> dict[str, Any]:
    return _get(f"{CCLD_API}/FacilityReports/{fac_num}", headers=UA, timeout=30).json()


def _ccld_html(fac_num: str, inx: int) -> str | None:
    key = (fac_num, inx)
    if key not in _HTML_CACHE:
        r = _get(f"{CCLD_API}/FacilityReports", params={"facNum": fac_num, "inx": inx}, headers=UA, timeout=30)
        _HTML_CACHE[key] = r.text if r.status_code == 200 else None
        time.sleep(0.4)
    return _HTML_CACHE[key]


def _ca_sample(db: Db, rng: random.Random, n: int) -> list[dict[str, Any]]:
    return [f for f in sample_facilities(db, rng, "CA", n) if f.get("license_number")]


def _db_by_inx(db: Db, fid: str, fac_num: str, select: str) -> dict[int, dict[str, Any]]:
    rows = db.get("inspections", select=select, facility_id=f"eq.{fid}", source_url=f"like.*FacilityReports?facNum={fac_num}&inx=*")
    return {int(re.search(r"inx=(\d+)", r["source_url"]).group(1)): r for r in rows}


def stage_s3(db: Db, rng: random.Random, n: int) -> list[dict[str, Any]]:
    """
    The CCLD `inx` query parameter is the 0-based position into REPORTARRAY. S3 *proves that from the raw
    HTML on every run* (report header must equal REPORTARRAY[inx]) and then checks that the DB row stored
    under each inx carries that report's metadata, and that no report was skipped.
    """
    R.stage = "S3"
    print("\n── S3 CCLD report index (+ raw HTML binding) vs inspections ──")
    facs = _ca_sample(db, rng, n)
    for f in facs:
        fac_num = f["license_number"].zfill(9)
        subj = f"CA {fac_num} {f['name']}"
        arr = _ccld_index(fac_num).get("REPORTARRAY", [])
        by_inx = _db_by_inx(db, f["id"], fac_num, "inspection_date,inspection_type,is_complaint,complaint_id,source_url")
        R.check(subj, f"inx=COUNT is out of range (so inx is 0-based; COUNT={len(arr)})",
                len(arr) == 0 or _ccld_html(fac_num, len(arr)) is None)
        for k, meta in enumerate(arr):
            html = _ccld_html(fac_num, k)
            tag = f"{subj} inx={k}"
            if not R.check(tag, "raw report retrievable for every REPORTARRAY position (0-based)", html is not None):
                continue
            text = _page_text(html)
            hdr = re.search(r"Report Date:\s*(\d{1,2}/\d{1,2}/\d{4})", text)
            R.check(tag, "raw HTML Report Date == REPORTARRAY[inx].REPORTDATE", bool(hdr) and
                    datetime.strptime(hdr.group(1), "%m/%d/%Y") == datetime.strptime(meta["REPORTDATE"], "%m/%d/%Y"),
                    f"html={hdr.group(1) if hdr else None} index={meta['REPORTDATE']}")
            want_title = "COMPLAINT INVESTIGATION REPORT" if meta["REPORTTYPE"] == "Complaint" else None
            if want_title:
                R.check(tag, "raw HTML title matches Complaint type", want_title in text.upper())
            d = by_inx.get(k)
            if not R.check(tag, "report ingested into DB under same inx", d is not None, "no inspections row"):
                continue
            R.check(tag, "is_complaint == REPORTTYPE", d["is_complaint"] == (meta["REPORTTYPE"] == "Complaint"),
                    f"report type={meta['REPORTTYPE']} db.is_complaint={d['is_complaint']}")
            R.check(tag, "inspection_type == REPORTTYPE", d["inspection_type"] == meta["REPORTTYPE"].lower(),
                    f"report type={meta['REPORTTYPE']} db={d['inspection_type']}")
            R.check(tag, "complaint_id == CONTROLNUMBER", (d["complaint_id"] or "") == (meta.get("CONTROLNUMBER") or ""),
                    f"report control#={meta.get('CONTROLNUMBER')} db={d['complaint_id']}")
        orphans = [k for k in by_inx if k >= len(arr)]
        R.check(subj, "no DB inspection beyond live index", not orphans, f"inx {orphans[:8]}")
    return facs


def stage_s4(db: Db, facs: list[dict[str, Any]], reports_each: int) -> None:
    R.stage = "S4"
    print("\n── S4 CCLD report HTML (real parser) vs inspections/deficiencies ──")
    from ccld_citations_ingest import parse_report, TRANSPARENCY_BASE  # the real production parser

    for f in facs:
        fac_num = f["license_number"].zfill(9)
        arr = _ccld_index(fac_num).get("REPORTARRAY", [])
        by_inx = _db_by_inx(
            db, f["id"], fac_num,
            "id,inspection_date,total_deficiency_count,source_url,raw_data,"
            "deficiencies(code,class,severity,immediate_jeopardy,description,inspector_narrative)")
        with_def = [k for k, i in by_inx.items() if i["deficiencies"]]
        picks = list(dict.fromkeys([len(arr) - 1, 0] + with_def[:max(0, reports_each - 2)]))[:reports_each]
        for k in picks:
            if k not in by_inx or not (0 <= k < len(arr)):
                continue
            subj = f"CA {fac_num} {f['name']} inx={k}"
            html = _ccld_html(fac_num, k)
            if html is None:
                continue
            url = f"{TRANSPARENCY_BASE}/FacilityReports?facNum={fac_num}&inx={k}"
            parsed = parse_report(html, arr[k], fac_num, url)
            if not R.check(subj, "raw HTML parses", parsed is not None):
                continue
            d = by_inx[k]
            R.check(subj, "inspection_date", d["inspection_date"] == str(parsed["inspection_date"]),
                    f"parsed={parsed['inspection_date']} db={d['inspection_date']}")
            R.check(subj, "total_deficiency_count", d["total_deficiency_count"] == len(parsed["deficiencies"]),
                    f"parsed={len(parsed['deficiencies'])} db={d['total_deficiency_count']}")
            R.check(subj, "deficiency rows == count", len(d["deficiencies"]) == d["total_deficiency_count"],
                    f"rows={len(d['deficiencies'])} count={d['total_deficiency_count']}")
            R.check(subj, "outcome", (d["raw_data"] or {}).get("outcome") == parsed["outcome"],
                    f"parsed={parsed['outcome']} db={(d['raw_data'] or {}).get('outcome')}")
            want = sorted(((x["section"], x["class"], x["severity"], x["immediate_jeopardy"]) for x in parsed["deficiencies"]), key=str)
            got = sorted(((x["code"], x["class"], x["severity"], x["immediate_jeopardy"]) for x in d["deficiencies"]), key=str)
            R.check(subj, "deficiency (code, class, severity, IJ) multiset", want == got, f"parsed={want[:3]} db={got[:3]}")
            # Parser-independent: the DB narrative must be literally present in the raw upstream HTML.
            flat = _page_text(html)
            for x in d["deficiencies"]:
                n = norm_ws(x["inspector_narrative"])
                if n and not n.startswith("Cited on LIC 9099D"):
                    R.check(subj, f"narrative for {x['code']} present in raw HTML", n[:70] in flat, f"probe={n[:70]!r}")


# ── S5: physical city ─────────────────────────────────────────────────────────

def stage_s5(db: Db, rng: random.Random, n: int) -> None:
    R.stage = "S5"
    print("\n── S5 Census place vs city_slug ──")
    for st in ("CA", "WA", "OR", "AZ", "MN"):
        for f in sample_facilities(db, rng, st, n):
            if f["latitude"] is None or f["longitude"] is None:
                continue
            subj = f"{st} {f['name']} ({f['latitude']},{f['longitude']})"
            r = _get(CENSUS, params={"x": f["longitude"], "y": f["latitude"], "benchmark": "Public_AR_Current",
                                     "vintage": "Current_Current", "layers": "Incorporated_Places,Census_Designated_Places",
                                     "format": "json"}, headers=UA, timeout=45)
            geos = (r.json().get("result", {}).get("geographies") or {})
            places: list[str] = []
            for layer in ("Incorporated Places", "Census Designated Places"):  # SEO rule: incorporated place wins over CDP
                if geos.get(layer):
                    nm = geos[layer][0]["NAME"].split(",")[0].strip()
                    places = [re.sub(r"\s+(city|town|village|borough|municipality|CDP)$", "", nm, flags=re.I)]
                    break
            slug = re.sub(r"[^a-z0-9]+", "-", (places[0] if places else "").lower()).strip("-")
            if not places:
                R.note(subj, "Census returned no place (unincorporated) — city_slug cannot be proven")
                continue
            R.check(subj, "city_slug is Census physical place or a recorded historical slug",
                    slug == f["city_slug"] or slug in _historical(db, f["id"]),
                    f"census={slug!r} db={f['city_slug']!r}")
            time.sleep(0.3)


def _historical(db: Db, fid: str) -> list[str]:
    rows = db.get("facilities", select="historical_city_slugs", id=f"eq.{fid}")
    return (rows[0].get("historical_city_slugs") or []) if rows else []


# ── S6: DB → live page ────────────────────────────────────────────────────────

def _page_text(html: str) -> str:
    t = re.sub(r"<(script|style)\b.*?</\1>", " ", html, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    from html import unescape
    return norm_ws(unescape(t))


def stage_s6(db: Db, rng: random.Random, n: int, site: str) -> None:
    R.stage = "S6"
    print("\n── S6 DB → live page ──")
    cutoff = (date.today().replace(year=date.today().year - DISPLAY_YEARS)).isoformat()
    for st, slug in STATE_SLUG.items():
        for f in sample_facilities(db, rng, st, n):
            path = f"/{slug}/{f['city_slug']}/{f['slug']}"
            subj = f"{st} {f['name']}"
            r = _get(site + path, headers=UA, timeout=90)
            if not R.check(subj, f"GET {path} == 200", r.status_code == 200, f"HTTP {r.status_code}"):
                continue
            html, text = r.text, _page_text(r.text)
            low = text.lower()

            # identity: every significant name token appears (display formatting moves articles/case)
            toks = [t for t in norm(f["name"]).split() if t not in ("the", "a", "an")]
            miss = [t for t in toks if t not in norm(text)]
            R.check(subj, "name tokens on page", not miss, f"missing {miss}")
            if f["street"]:
                R.check(subj, "street on page", norm(f["street"]) in norm(text), f"street={f['street']!r}")
            if f["zip"]:
                R.check(subj, "zip on page", str(f["zip"])[:5] in text, f"zip={f['zip']}")
            if f["phone"] and digits(f["phone"]):
                ph = digits(f["phone"])[-10:]
                R.check(subj, "phone on page", ph in digits(text), f"phone={f['phone']}")
            if f["license_number"] and st == "CA":
                R.check(subj, "license number on page", f["license_number"] in text, f"lic={f['license_number']}")

            # canonical + JSON-LD
            m = CANONICAL_RE.search(html) or CANONICAL_RE_ALT.search(html)
            R.check(subj, "canonical == requested path", bool(m) and m.group(1).rstrip("/").endswith(path), f"canonical={m.group(1) if m else None}")
            nodes = [n_ for b in extract_jsonld_blocks(html) for n_ in iter_schema_nodes(b)]
            R.check(subj, "JSON-LD parses (no __parse_error__)", not any(n_.get("__parse_error__") for n_ in nodes))
            types = {t for n_ in nodes for t in ([n_.get("@type")] if isinstance(n_.get("@type"), str) else (n_.get("@type") or []))}
            R.check(subj, "BreadcrumbList present", "BreadcrumbList" in types, f"types={sorted(types)}")
            R.check(subj, "no aggregateRating (no published reviews)", not any("aggregateRating" in n_ for n_ in nodes))
            for n_ in nodes:
                g = n_.get("geo")
                if g:
                    R.check(subj, "JSON-LD geo matches DB lat/lng",
                            f["latitude"] is not None and abs(float(g["latitude"]) - float(f["latitude"])) < 1e-4
                            and abs(float(g["longitude"]) - float(f["longitude"])) < 1e-4, f"geo={g} db=({f['latitude']},{f['longitude']})")
            for tok in ("undefined", "NaN", "[object Object]", "null null"):
                R.check(subj, f"no placeholder token {tok!r}", tok not in text, "found in rendered text")

            # inspection/deficiency counts + dates versus DB
            insp = db.get("inspections", select="id,inspection_date,is_complaint,raw_data,deficiencies(id)", facility_id=f"eq.{f['id']}",
                          order="inspection_date.desc", limit="1000")
            vis = [i for i in insp if i["inspection_date"] >= cutoff]
            gaps = [i for i in vis if i["is_complaint"] and (i["raw_data"] or {}).get("outcome") == "Substantiated" and not i["deficiencies"]]
            exp_def = sum(len(i["deficiencies"]) for i in vis) + len(gaps)
            if exp_def:
                label = "deficiency" if exp_def == 1 else "deficiencies"
                R.check(subj, f"'{exp_def} {label} on record' (3-yr window)", f"{exp_def} {label} on record" in text,
                        f"expected {exp_def} from DB over {len(vis)} visible inspections")
            else:
                R.check(subj, "no deficiency-count claim when DB has none", not re.search(r"\b[1-9]\d* deficienc(y|ies) on record", text))
            if vis:
                shown = [i["inspection_date"] for i in vis[:5] if i["inspection_date"] in text]
                R.check(subj, "newest inspections listed with ISO date", len(shown) >= min(len(vis), 3) or "Read full record" in text or len(shown) >= 1,
                        f"found {len(shown)}/{min(len(vis), 5)} of {[i['inspection_date'] for i in vis[:5]]}")
            else:
                R.check(subj, "empty-state copy when no visible inspections",
                        any(s in low for s in ("no inspection", "not yet", "none on record", "no citation")), "no empty-state wording")
            time.sleep(0.3)


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stage", nargs="*", default=["S1", "S2", "S3", "S4", "S5", "S6"])
    ap.add_argument("--per-state", type=int, default=4, help="facilities sampled per state per stage")
    ap.add_argument("--reports-each", type=int, default=4, help="CCLD reports parsed per facility in S4")
    ap.add_argument("--seed", type=int, default=int(date.today().strftime("%Y%m%d")))
    ap.add_argument("--site", default=os.environ.get("E2E_SITE", DEFAULT_SITE))
    ap.add_argument("--json", help="write findings to this path")
    a = ap.parse_args()

    for v in ("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if not os.environ.get(v):
            sys.exit(f"ERROR: {v} not set")
    rng, db = random.Random(a.seed), Db()
    print(f"E2E live pipeline — seed={a.seed} per-state={a.per_state} site={a.site}")

    ca_facs: list[dict[str, Any]] = []
    if "S1" in a.stage:
        stage_s1(db, rng, a.per_state)
    if "S2" in a.stage:
        stage_s2(db, rng, a.per_state)
    if "S3" in a.stage or "S4" in a.stage:
        ca_facs = stage_s3(db, rng, max(a.per_state, 3)) if "S3" in a.stage else _ca_sample(db, rng, max(a.per_state, 3))
    if "S4" in a.stage:
        stage_s4(db, ca_facs, a.reports_each)
    if "S5" in a.stage:
        stage_s5(db, rng, max(2, a.per_state // 2))
    if "S6" in a.stage:
        stage_s6(db, rng, a.per_state, a.site.rstrip("/"))

    total = R.passes + len(R.fails)
    print(f"\n{'─' * 60}\nE2E summary: {R.passes}/{total} checks passed, {len(R.fails)} failed, {len(R.notes)} notes")
    by: dict[str, int] = {}
    for f in R.fails:
        by[f"{f['stage']} {f['check']}"] = by.get(f"{f['stage']} {f['check']}", 0) + 1
    for k, v in sorted(by.items(), key=lambda kv: -kv[1]):
        print(f"  {v:4d} × {k}")
    if a.json:
        Path(a.json).write_text(json.dumps({"seed": a.seed, "passes": R.passes, "fails": R.fails, "notes": R.notes}, indent=1))
    sys.exit(1 if R.fails else 0)


if __name__ == "__main__":
    main()
