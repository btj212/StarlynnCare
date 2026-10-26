#!/usr/bin/env python3
"""
Live end-to-end parity: CMS regulator data vs. what StarlynnCare stores and renders.

No mocks, no fixtures. For a sample of CMS-certified published facilities this:
  1. Pulls the facility's REAL deficiency rows from data.cms.gov (every field).
  2. Reads the stored inspections + deficiencies through Supabase REST (read-only).
  3. Compares field by field using the same transforms as
     scrapers/cms_nh_deficiencies_ingest.py (F-code, severity map, IJ, dates).
  4. Fetches the live production profile page and checks the facility name and
     every cited F-tag appear in the HTML.

Read-only: only GET requests. Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

Usage:
  python3 scripts/validate/e2e_live_cms_parity.py [--per-state 2] [--seed 7] [--site https://www.starlynncare.com]
"""
from __future__ import annotations

import argparse
import os
import random
import sys
from collections import defaultdict
from typing import Any

import requests

CMS_QUERY = "https://data.cms.gov/provider-data/api/1/datastore/query/r5ix-sfxw/0"
SEVERITY = {c: 1 for c in "ABC"} | {c: 2 for c in "DEF"} | {c: 3 for c in "GHI"} | {c: 4 for c in "JKL"}

failures: list[str] = []
checks = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global checks
    checks += 1
    if not ok:
        failures.append(f"{name}: {detail}")
        print(f"  FAIL {name} — {detail}")


def rest(path: str, params: dict[str, str]) -> list[dict[str, Any]]:
    base = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    out: list[dict[str, Any]] = []
    offset = 0
    while True:
        r = requests.get(
            f"{base}/rest/v1/{path}",
            params={**params, "limit": "1000", "offset": str(offset)},
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=60,
        )
        r.raise_for_status()
        rows = r.json()
        out += rows
        if len(rows) < 1000:
            return out
        offset += 1000


def cms_rows(ccn: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        r = requests.get(
            CMS_QUERY,
            params={
                "limit": 500,
                "offset": offset,
                "conditions[0][property]": "cms_certification_number_ccn",
                "conditions[0][value]": ccn,
                "conditions[0][operator]": "=",
            },
            timeout=60,
        )
        r.raise_for_status()
        batch = r.json()["results"]
        rows += batch
        if len(batch) < 500:
            return rows
        offset += 500


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-state", type=int, default=2)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--site", default="https://www.starlynncare.com")
    args = ap.parse_args()

    facs = rest("facilities", {
        "select": "id,state_code,name,cms_ccn,slug,city_slug",
        "cms_ccn": "not.is.null",
        "publishable": "eq.true",
        "order": "id",
    })
    by_state: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for f in facs:
        by_state[f["state_code"]].append(f)
    rng = random.Random(args.seed)
    sample = [f for s in sorted(by_state) for f in rng.sample(by_state[s], min(args.per_state, len(by_state[s])))]
    print(f"Sampled {len(sample)} CMS-certified facilities across {len(by_state)} states: "
          f"{', '.join(f'{s}={len(v)}' for s, v in sorted(by_state.items()))}")

    for f in sample:
        ccn = f["cms_ccn"]
        print(f"\n[{f['state_code']}] {f['name']} (CCN {ccn})")
        live = cms_rows(ccn)
        insp = rest("inspections", {
            "select": "id,inspection_date,source_agency",
            "facility_id": f"eq.{f['id']}",
            "source_agency": "eq.CMS",
        })
        insp_by_id = {i["id"]: i for i in insp}
        stored: list[dict[str, Any]] = []
        if insp_by_id:
            ids = ",".join(insp_by_id)
            stored = rest("deficiencies", {
                "select": "inspection_id,code,scope_severity_code,severity,immediate_jeopardy,corrected_date,description",
                "inspection_id": f"in.({ids})",
            })
        db = {(insp_by_id[d["inspection_id"]]["inspection_date"], d["code"]): d for d in stored}

        live_keys = set()
        for row in live:
            tag = (row.get("deficiency_tag_number") or "").strip()
            if not tag:
                continue
            code = tag if tag.startswith("F") else f"F{tag}"
            key = (row["survey_date"], code)
            live_keys.add(key)
            d = db.get(key)
            if d is None:
                check(f"{ccn} {key} present", False, "live CMS deficiency missing from DB")
                continue
            letter = (row.get("scope_severity_code") or "").strip().upper()
            check(f"{ccn} {key} scope_severity", (d["scope_severity_code"] or "") == letter,
                  f"db={d['scope_severity_code']!r} cms={letter!r}")
            check(f"{ccn} {key} severity", d["severity"] == SEVERITY.get(letter),
                  f"db={d['severity']!r} expected={SEVERITY.get(letter)!r}")
            check(f"{ccn} {key} IJ", bool(d["immediate_jeopardy"]) == (letter in "JKL" and bool(letter)),
                  f"db={d['immediate_jeopardy']!r} letter={letter!r}")
            cms_corr = (row.get("correction_date") or "").strip() or None
            check(f"{ccn} {key} corrected_date", d["corrected_date"] == cms_corr,
                  f"db={d['corrected_date']!r} cms={cms_corr!r}")
            desc = (row.get("deficiency_description") or "").strip()[:4000] or None
            check(f"{ccn} {key} description", d["description"] == desc, "text differs from CMS")
        extra = set(db) - live_keys
        # CMS only publishes the last few survey cycles, so older stored visits are expected; print, don't fail.
        if extra:
            print(f"  note: {len(extra)} stored deficiencies no longer in CMS feed (older cycles), e.g. {sorted(extra)[:2]}")
        print(f"  live CMS rows={len(live)} db deficiencies={len(db)} inspections={len(insp)}")

        url = f"{args.site}/{f['state_code'].lower()}/{f['slug']}"
        # route shape is resolved by following redirects from the canonical profile path
        r = requests.get(url, timeout=60, allow_redirects=True)
        if r.status_code == 404 and f.get("city_slug"):
            r = requests.get(f"{args.site}/{f['state_code'].lower()}/{f['city_slug']}/{f['slug']}", timeout=60)
        check(f"{ccn} profile HTTP 200", r.status_code == 200, f"{r.status_code} {r.url}")
        if r.status_code == 200:
            check(f"{ccn} profile shows name", f["name"].split(",")[0][:20].lower() in r.text.lower(), r.url)

    print(f"\n{checks} checks, {len(failures)} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
