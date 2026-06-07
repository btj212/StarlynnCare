#!/usr/bin/env python3
"""
Read-only smoke test: public CDSS / data.ca.gov signals for memory care / §1569.627
for a single facility (default: 415600900 — Abigail Complete Care, Inc).

Re-runnable. Does not modify the database.

Usage:
  python scrapers/scratch/mc_disclosure_smoke.py
  python scrapers/scratch/mc_disclosure_smoke.py --fac-num 415600900

Requires (optional): DATABASE_URL in .env.local for P4/P5 (Postgres).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import requests

# scrapers/scratch/this_file.py → repo root is three levels up
REPO_ROOT = Path(__file__).resolve().parents[2]
CKAN_URL = "https://data.ca.gov/api/3/action/datastore_search"
CKAN_RESOURCE_RCFE = "6b2f5818-f60d-40b5-bc2a-94f995f9f8b0"
TRANSPARENCY_ANY = "https://www.ccld.dss.ca.gov/transparencyapi/api/Facility/any"
TRANSPARENCY_REPORTS = "https://www.ccld.dss.ca.gov/transparencyapi/api/FacilityReports"
FAC_DETAIL_TMPL = (
    "https://www.ccld.dss.ca.gov/carefacilitysearch/?rewrite=FacDetail&facNum={}"
)

TOKEN_PATTERNS = [
    "dementia",
    "memory care",
    "87705",
    "87706",
    "1569.627",
    "1569.696",
    "alzheimer",
    "cognitive",
    "lic9158",
    "special care",
    "hospice waiver",
]

# Subset used only for "memory care program" decision hints (excludes hospice-only).
MC_DECISION_TOKENS = [
    "dementia",
    "memory care",
    "87705",
    "87706",
    "1569.627",
    "1569.696",
    "alzheimer",
    "cognitive",
    "lic9158",
    "special care",
]


def load_dotenv_local() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def p1_ckan(fac_num: str) -> dict[str, Any]:
    params = {
        "resource_id": CKAN_RESOURCE_RCFE,
        "filters": json.dumps({"facility_number": int(fac_num)}),
        "limit": 5,
    }
    r = requests.get(
        CKAN_URL,
        params=params,
        timeout=45,
        headers={"User-Agent": "StarlynnCare/mc_disclosure_smoke"},
    )
    r.raise_for_status()
    data = r.json()
    recs = data.get("result", {}).get("records", [])
    fields = [f["id"] for f in data.get("result", {}).get("fields", [])]
    return {"record_count": len(recs), "field_names": fields, "records": recs}


def p2_transparency_facility_any(fac_num: str) -> dict[str, Any]:
    """Note: Facility/any is a large JSON array; historically childcare-heavy."""
    r = requests.get(
        TRANSPARENCY_ANY,
        timeout=120,
        headers={"User-Agent": "StarlynnCare/mc_disclosure_smoke"},
    )
    r.raise_for_status()
    raw = r.json()
    key = fac_num.zfill(9)
    types: dict[str, int] = {}
    hit = None
    for item in raw:
        ft = str(item.get("FacilityType") or "")
        types[ft] = types.get(ft, 0) + 1
        n = str(item.get("FacilityNumber") or "").strip().zfill(9)
        if n == key:
            hit = item
    elderlyish = sum(
        1
        for t in types
        if "RESIDENTIAL" in t.upper() or "ELDERLY" in t.upper() or "RCFE" in t.upper()
    )
    return {
        "array_len": len(raw),
        "unique_types_sample": dict(sorted(types.items(), key=lambda x: -x[1])[:8]),
        "residential_elderly_type_rows": elderlyish,
        "record_for_fac_num": hit,
    }


def p2b_facility_reports_html_scan(fac_num: str) -> dict[str, Any]:
    idx = requests.get(
        f"{TRANSPARENCY_REPORTS}/{fac_num}",
        timeout=45,
        headers={"User-Agent": "StarlynnCare/mc_disclosure_smoke"},
    )
    idx.raise_for_status()
    j = idx.json()
    arr = j.get("REPORTARRAY", [])
    count = int(j.get("COUNT") or len(arr))
    rows = []
    for inx in range(1, count + 1):
        url = f"{TRANSPARENCY_REPORTS}?facNum={fac_num}&inx={inx}"
        try:
            hr = requests.get(
                url,
                timeout=60,
                headers={"User-Agent": "StarlynnCare/mc_disclosure_smoke"},
            )
            if hr.status_code >= 400:
                rows.append(
                    {
                        "inx": inx,
                        "http_status": hr.status_code,
                        "url": url,
                        "error": "non-2xx",
                        "token_hits": [],
                        "memory_care_token_hits": [],
                    }
                )
                continue
            html = hr.text.lower()
            hits = [t for t in TOKEN_PATTERNS if t.lower() in html]
            mc_hits = [t for t in MC_DECISION_TOKENS if t.lower() in html]
            meta = arr[inx - 1] if inx - 1 < len(arr) else {}
            rows.append(
                {
                    "inx": inx,
                    "report_date": meta.get("REPORTDATE"),
                    "report_type": meta.get("REPORTTYPE"),
                    "url": url,
                    "html_len": len(hr.text),
                    "token_hits": hits,
                    "memory_care_token_hits": mc_hits,
                }
            )
        except requests.RequestException as e:
            rows.append(
                {
                    "inx": inx,
                    "url": url,
                    "error": str(e),
                    "token_hits": [],
                    "memory_care_token_hits": [],
                }
            )
    return {"count": count, "per_report": rows}


def p3_fac_detail_shell(fac_num: str) -> dict[str, Any]:
    url = FAC_DETAIL_TMPL.format(fac_num)
    r = requests.get(
        url,
        timeout=90,
        headers={"User-Agent": "StarlynnCare/mc_disclosure_smoke"},
    )
    r.raise_for_status()
    html = r.text
    low = html.lower()
    title_m = re.search(r"<title>([^<]+)", html, re.I)
    return {
        "url": url,
        "byte_len": len(html),
        "title": (title_m.group(1).strip() if title_m else None),
        "token_hits": [t for t in TOKEN_PATTERNS if t.lower() in low],
        "note": "Initial HTML is a SPA shell; facility fields load client-side.",
    }


def p4_p5_db(fac_num: str) -> dict[str, Any] | None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        return None
    try:
        import psycopg
    except ImportError:
        return {"error": "psycopg not installed"}

    out: dict[str, Any] = {"facility": None, "deficiency_keyword_hits": {}, "lic_mentions": []}
    with psycopg.connect(url) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, serves_memory_care, memory_care_disclosure_filed "
            "FROM facilities WHERE license_number = %s",
            (fac_num,),
        )
        row = cur.fetchone()
        if not row:
            return {"error": "facility not in DB"}
        fid, name, smc, mcd = row
        out["facility"] = {
            "id": str(fid),
            "name": name,
            "serves_memory_care": smc,
            "memory_care_disclosure_filed": mcd,
        }

        cur.execute(
            """
            SELECT COALESCE(d.description,'') || ' ' || COALESCE(d.inspector_narrative,'')
            FROM deficiencies d
            JOIN inspections i ON i.id = d.inspection_id
            WHERE i.facility_id = %s
            """,
            (fid,),
        )
        def_blob = " ".join(r[0] for r in cur.fetchall()).lower()
        for t in TOKEN_PATTERNS:
            out["deficiency_keyword_hits"][t] = t.lower() in def_blob

        cur.execute(
            "SELECT inspection_date, raw_data::text FROM inspections WHERE facility_id = %s",
            (fid,),
        )
        all_raw = " ".join(str(r[1] or "") for r in cur.fetchall())
        out["lic_mentions"] = sorted(
            set(re.findall(r"LIC\s*(\d{4,5}[A-Z]?)", all_raw, re.I))
        )

        cur.execute(
            """
            SELECT inspection_date, COALESCE(raw_data::text,'') || ' ' ||
                   COALESCE(narrative_summary,'')
            FROM inspections WHERE facility_id = %s
            """,
            (fid,),
        )
        blob = " ".join(str(r[1] or "") for r in cur.fetchall()).lower()
        out["inspection_combined_keyword_hits"] = {
            t: t.lower() in blob for t in TOKEN_PATTERNS
        }
    return out


def p6_package_search() -> dict[str, Any]:
    """CKAN package_search — no dedicated §1569.627 disclosure dataset expected."""
    queries = [
        "community care licensing facilities",
        "dementia residential care elderly",
        "87705 community care",
    ]
    out: dict[str, Any] = {"runs": []}
    for q in queries:
        r = requests.get(
            "https://data.ca.gov/api/3/action/package_search",
            params={"q": q, "rows": 10},
            timeout=30,
            headers={"User-Agent": "StarlynnCare/mc_disclosure_smoke"},
        )
        r.raise_for_status()
        payload = r.json()
        res = (payload.get("result") or {}).get("results") or []
        out["runs"].append(
            {
                "query": q,
                "count": (payload.get("result") or {}).get("count"),
                "packages": [(p.get("title"), p.get("name")) for p in res],
            }
        )
    return out


def main() -> int:
    load_dotenv_local()
    ap = argparse.ArgumentParser()
    ap.add_argument("--fac-num", default="415600900")
    ap.add_argument("--skip-reports-html", action="store_true", help="skip slow P2b")
    args = ap.parse_args()
    fac = args.fac_num.strip()

    report: dict[str, Any] = {"facility_number": fac, "probes": {}}

    print("P1 CKAN …")
    report["probes"]["p1_ckan"] = p1_ckan(fac)

    print("P2 Transparency Facility/any …")
    report["probes"]["p2_transparency_any"] = p2_transparency_facility_any(fac)

    if not args.skip_reports_html:
        print("P2b FacilityReports HTML (all indices) …")
        report["probes"]["p2b_facility_reports"] = p2b_facility_reports_html_scan(fac)

    print("P3 FacDetail shell …")
    report["probes"]["p3_fac_detail"] = p3_fac_detail_shell(fac)

    print("P4/P5 DB …")
    report["probes"]["p4_p5_db"] = p4_p5_db(fac)

    print("P6 data.ca.gov package_search …")
    report["probes"]["p6_package_search"] = p6_package_search()

    # Decision helper
    p1 = report["probes"]["p1_ckan"]
    mc_cols = [
        f
        for f in p1.get("field_names", [])
        if any(
            x in f.lower()
            for x in ("dementia", "memory", "disclosure", "special", "program", "waiver")
        )
    ]
    p2 = report["probes"]["p2_transparency_any"]
    has_structured = bool(mc_cols) or p2.get("record_for_fac_num")

    p2b_mc_hits: list[str] = []
    for row in report.get("probes", {}).get("p2b_facility_reports", {}).get("per_report", []):
        p2b_mc_hits.extend(row.get("memory_care_token_hits") or [])

    report["decision_hints"] = {
        "ckan_memory_related_columns": mc_cols,
        "transparency_any_has_facility_row": p2.get("record_for_fac_num") is not None,
        "facility_reports_memory_care_token_union": sorted(set(p2b_mc_hits)),
        "recommendation": (
            "structured_ckan_or_transparency_field"
            if has_structured
            else (
                "widen_citation_grep_or_facdetail_js"
                if p2b_mc_hits
                else "no_machine_readable_cdss_memory_signal_for_this_facility"
            )
        ),
    }

    out_path = REPO_ROOT / "scrapers" / "scratch" / "MEMORY_CARE_SMOKE_REPORT.json"
    out_path.write_text(json.dumps(report, indent=2, default=str))
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
