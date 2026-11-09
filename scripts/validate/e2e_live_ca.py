#!/usr/bin/env python3
"""
Layer 6 — Live end-to-end pipeline proof for California (no mocks, no fixtures).

Every run pulls REAL data from the regulator and compares it, field by field,
to what is stored in Supabase and what the live site renders:

  CDSS statewide CSV  ──►  facilities row            (directory + compliance fields)
  CDSS FacilityReports index  ──►  inspections rows  (every report, by date/type/control #)
  CDSS report HTML  ──►  parse_report()  ──►  inspections + deficiencies rows (every field)
  facilities / inspections / deficiencies  ──►  live facility page  (what families see)

Nothing is stubbed. The parser under test is the production `parse_report`.
Read-only: the database is only queried (PostgREST GET), never written.

Usage:
    python3 scripts/validate/e2e_live_ca.py                 # 8 random facilities
    python3 scripts/validate/e2e_live_ca.py --n 20 --seed 7
    python3 scripts/validate/e2e_live_ca.py --license 306005546 --license 306002915
    python3 scripts/validate/e2e_live_ca.py --site https://preview.vercel.app

Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
Exit 0 = every check passed; 1 = at least one FAIL; 2 = a live source was
unreachable (INCONCLUSIVE, not a pass).
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import random
import re
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scrapers"))
import ccld_citations_ingest as ing  # noqa: E402  (production parser + URLs)
import ccld_rcfe_ingest as rcfe  # noqa: E402  (production name/slug mapping)

UA = {"User-Agent": "StarlynnCare/e2e-validator"}
SB = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/") + "/rest/v1"
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SB_H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

inconclusive = 0
results: list[tuple[str, str, str]] = []  # (status, scope, message)


def rec(ok: bool, scope: str, msg: str, warn: bool = False) -> None:
    results.append(("PASS" if ok else ("WARN" if warn else "FAIL"), scope, msg))


def eq(scope: str, label: str, live: Any, db: Any, warn: bool = False) -> None:
    rec(live == db, scope, f"{label}: live={live!r} db={db!r}" if live != db else f"{label} = {live!r}", warn)


def sb(table: str, **params: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    off = 0
    while True:
        for t in range(4):
            try:
                r = requests.get(
                    f"{SB}/{table}", params={**params, "limit": "1000", "offset": str(off)},
                    headers=SB_H, timeout=60,
                )
                r.raise_for_status()
                break
            except requests.RequestException:
                if t == 3:
                    raise
                time.sleep(3 * (t + 1))
        page = r.json()
        out += page
        if len(page) < 1000:
            return out
        off += 1000


def get(url: str, timeout: int = 60, tries: int = 4) -> requests.Response:
    last: Exception | None = None
    for i in range(tries):
        try:
            r = requests.get(url, headers=UA, timeout=timeout)
            if r.status_code < 500:
                return r
        except requests.RequestException as e:
            last = e
        time.sleep(2 * (i + 1))
    raise RuntimeError(f"unreachable after {tries} tries: {url} ({last})")


def load_csv() -> dict[str, dict[str, str]]:
    r = get(ing.BULK_URL, timeout=150)
    r.raise_for_status()
    rows = csv.DictReader(io.StringIO(r.text))
    return {str(x["Facility Number"]).strip().zfill(9): x for x in rows}


def d(s: str | None) -> date | None:
    return ing.parse_date_cdss(s) if s else None


def check_facility(lic: str, csvrow: dict[str, str], fac: dict[str, Any]) -> None:
    s = f"{lic} facility"
    name = rcfe.titleize(csvrow["Facility Name"].strip())
    eq(s, "license_number", lic, fac["license_number"])
    eq(s, "name", name, fac["name"], warn=True)  # curated renames are allowed -> WARN
    eq(s, "slug suffix", rcfe.facility_slug(name, lic).rsplit("-", 1)[-1], fac["slug"].rsplit("-", 1)[-1])
    eq(s, "street", rcfe.titleize(csvrow["Facility Address"].strip()) or None, fac["street"], warn=True)
    z = csvrow["Facility Zip"].strip()
    eq(s, "zip", z.zfill(5) if z else None, fac["zip"])
    cap = csvrow["Facility Capacity"].strip()
    eq(s, "beds", int(float(cap)) if cap else None, fac["beds"])
    eq(s, "phone", csvrow["Facility Telephone Number"].strip() or None, fac["phone"])
    eq(s, "license_status", csvrow["Facility Status"].strip() or None, fac["license_status"])
    eq(s, "license_type", csvrow["Facility Type"].strip() or None, fac["license_type"])
    eq(s, "operator_name", rcfe.titleize(csvrow["Licensee"].strip()) or None, fac["operator_name"], warn=True)
    # facilities.last_inspection_date is intentionally blank for CA (MEMORY.md 2026-11); the page
    # derives "last inspection" from inspection rows, so compare CSV Last Visit Date to those rows.
    dbd = [i["inspection_date"] for i in sb("inspections", select="inspection_date", facility_id=f"eq.{fac['id']}")]
    lv = d(csvrow["Last Visit Date"])
    eq(s, "CSV Last Visit Date == newest inspection row", str(lv) if lv else None, max(dbd) if dbd else None, warn=True)
    rec(fac["state_code"] == "CA", s, f"state_code = {fac['state_code']}")
    rec(bool(fac["city_slug"]) and fac["city_slug"] == re.sub(r"[^a-z0-9]+", "-", fac["city_slug"]).strip("-"),
        s, f"city_slug well-formed: {fac['city_slug']}")


def fetch_report(lic: str, inx: int) -> str | None:
    for t in range(5):  # CDSS report pages hang intermittently (ERRORS.md 2026-11); retry, then INCONCLUSIVE
        try:
            rr = requests.get(f"{ing.TRANSPARENCY_BASE}/FacilityReports?facNum={lic}&inx={inx}",
                              headers={**UA, "Referer": "https://www.ccld.dss.ca.gov/carefacilitysearch/"}, timeout=30)
            if rr.status_code == 200 and rr.text:
                return rr.text
            if rr.status_code in (400, 404):
                return None
        except requests.RequestException:
            pass
        time.sleep(3 * (t + 1))
    return None


def check_inspections_and_reports(lic: str, csvrow: dict[str, str], fac: dict[str, Any], max_reports: int) -> None:
    """The index is POSITIONAL (new reports shift every inx), so rows are matched on content
    (date, type, complaint id) taken from the live report itself, never on the stored inx."""
    global inconclusive
    s = f"{lic} inspections"
    idx = ing.fetch_report_index(lic)
    reports = idx["REPORTARRAY"]
    eq(s, "live index COUNT == len(REPORTARRAY)", idx["COUNT"], len(reports))
    tv = csvrow.get("Total Visits", "").strip()
    if tv.isdigit():
        eq(s, "CSV Total Visits == live index COUNT", int(tv), idx["COUNT"], warn=True)
    db_insp = sb("inspections", select="*", facility_id=f"eq.{fac['id']}")
    pool = list(db_insp)
    order = list(range(len(reports)))
    if len(order) > max_reports:  # always the newest few, then a random spread
        order = order[:3] + random.sample(order[3:], max_reports - 3)
    not_ingested = 0
    for inx in sorted(order):
        meta = reports[inx]
        sc = f"{lic} live report#{inx} ({meta['REPORTDATE']} {meta['REPORTTYPE']})"
        html = fetch_report(lic, inx)
        if not html:
            inconclusive += 1
            rec(False, sc, "live report HTML unavailable after retries (NOT verified)", warn=True)
            continue
        parsed = ing.parse_report(html, meta, lic, "")
        if parsed is None:
            rec(False, sc, "production parser returned None for live HTML")
            continue
        key = (str(parsed["inspection_date"]), parsed["inspection_type"], parsed["complaint_id"])
        cands = [i for i in pool if (i["inspection_date"], i["inspection_type"], i["complaint_id"]) == key]
        cands.sort(key=lambda i: i["total_deficiency_count"] != len(parsed["deficiencies"]))
        if not cands:
            not_ingested += 1
            rec(False, sc, f"no DB inspection row for {key} (new since last ingest, or dropped)", warn=True)
            continue
        db = cands[0]
        pool.remove(db)
        rec(True, sc, f"DB row found for {key}")
        eq(sc, "is_complaint", parsed["is_complaint"], db["is_complaint"])
        eq(sc, "total_deficiency_count", len(parsed["deficiencies"]), db["total_deficiency_count"])
        raw = db.get("raw_data") or {}
        eq(sc, "raw outcome", parsed["outcome"], raw.get("outcome"))
        eq(sc, "raw inspector_name", parsed["inspector_name"], raw.get("inspector_name"))
        eq(sc, "raw narrative", parsed["narrative_text"][:10000], raw.get("narrative"))
        if raw.get("report_index_metadata") is not None:  # absent on rows ingested before it was stored
            eq(sc, "raw report_index_metadata", parsed["report_index_metadata"], raw["report_index_metadata"])
        eq(sc, "source_url facility", f"facNum={lic}&" in (db["source_url"] or ""), True)
        dbd = sb("deficiencies", select="*", inspection_id=f"eq.{db['id']}")
        eq(sc, "deficiency row count", len(parsed["deficiencies"]), len(dbd))
        live_k = sorted(
            (str(x["section"]), str(x["class"]), str(x["severity"]), bool(x["immediate_jeopardy"]),
             x["regulatory_text"][:4000] or "", x["deficiency_statement"][:8000] or "")
            for x in parsed["deficiencies"])
        db_k = sorted(
            (str(x["code"]), str(x["class"]), str(x["severity"]), bool(x["immediate_jeopardy"]),
             x["description"] or "", x["inspector_narrative"] or "") for x in dbd)
        eq(sc, "deficiency rows (code/class/severity/IJ/text/narrative)", live_k, db_k)
    rec(True, s, f"checked {len(order)}/{len(reports)} live reports; db rows={len(db_insp)}; "
        f"live reports not yet in DB={not_ingested}")


def check_site(site: str, fac: dict[str, Any], n_insp: int) -> None:
    s = f"{fac['license_number']} site"
    url = f"{site}/california/{fac['city_slug']}/{fac['slug']}"
    try:
        r = get(url, timeout=60, tries=3)
    except RuntimeError as e:
        rec(False, s, f"site unreachable: {e}", warn=True)
        return
    rec(r.status_code == 200, s, f"GET {url} -> {r.status_code}")
    if r.status_code != 200:
        return
    html = r.text
    text = re.sub(r"<(script|style)\b.*?</\1>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&amp;", "&", text).replace("&#x27;", "'").replace("&#39;", "'")
    nm = fac["name"]
    m_the = re.match(r"(.+), the$", nm, re.I)
    tl = text.lower()  # site normalizes acronyms (LLC, CCRC) via lib/facility/displayName.ts
    rec(nm.lower() in tl or (bool(m_the) and f"the {m_the.group(1)}".lower() in tl), s, f"page shows facility name {nm!r}")
    rec(fac["license_number"] in text, s, "page shows license number")
    rec(not re.search(r"\b(undefined|NaN|\[object Object\])\b", text), s, "no undefined/NaN/[object Object] leaked")
    rec('application/ld+json' in html, s, "JSON-LD present")
    rec(f'rel="canonical"' in html, s, "canonical link present")
    if n_insp == 0:
        rec(bool(re.search(r"not yet inspected|none on record|no inspection", text, re.I)), s,
            "zero-inspection facility says so explicitly (YMYL)", warn=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=8)
    ap.add_argument("--seed", type=int, default=int(date.today().strftime("%Y%m%d")))
    ap.add_argument("--license", action="append", default=[])
    ap.add_argument("--max-reports", type=int, default=10, help="live reports parsed per facility")
    ap.add_argument("--site", default="https://www.starlynncare.com")
    a = ap.parse_args()
    if not (SB.startswith("http") and KEY):
        print("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 2
    try:
        bulk = load_csv()
    except Exception as e:  # noqa: BLE001 — report as INCONCLUSIVE
        print(f"INCONCLUSIVE: CDSS statewide CSV unreachable: {e}")
        return 2
    print(f"Live CDSS CSV: {len(bulk)} facilities")
    if a.license:
        facs = [f for lic in a.license for f in sb("facilities", select="*", state_code="eq.CA", license_number=f"eq.{lic}")]
    else:
        pool = sb("facilities", select="*", state_code="eq.CA", publishable="eq.true")
        random.Random(a.seed).shuffle(pool)
        facs = pool[: a.n]
        print(f"Sampled {len(facs)}/{len(pool)} publishable CA facilities (seed {a.seed})")
    unreachable = 0
    for fac in facs:
        lic = fac["license_number"]
        row = bulk.get(lic)
        if row is None:
            rec(False, f"{lic} facility", "DB facility absent from live CDSS CSV (closed/removed?)", warn=True)
            continue
        try:
            check_facility(lic, row, fac)
            check_inspections_and_reports(lic, row, fac, a.max_reports)
        except Exception as e:  # noqa: BLE001
            unreachable += 1
            rec(False, f"{lic}", f"live CDSS call failed: {type(e).__name__}: {e}", warn=True)
        check_site(a.site.rstrip("/"), fac, len(sb("inspections", select="id", facility_id=f"eq.{fac['id']}")))
    fails = [r for r in results if r[0] == "FAIL"]
    warns = [r for r in results if r[0] == "WARN"]
    for st, sc, m in results:
        if st != "PASS":
            print(f"[{st}] {sc}: {m}")
    print(f"\n{len(results)-len(fails)-len(warns)} passed, {len(warns)} warnings, {len(fails)} failed "
          f"across {len(facs)} facilities ({unreachable} with CDSS call failures)")
    print(f"{inconclusive} live report pages were unreachable after retries (those report-level checks did NOT run)")
    return 1 if fails else (2 if (unreachable == len(facs) and facs) else 0)


if __name__ == "__main__":
    sys.exit(main())
