#!/usr/bin/env python3
"""
ut_narrative_probe.py — Discover whether Utah CCL surfaces full inspection
narrative text (plain-English "what happened" prose) in any public endpoint.

Runs four probes against 3 sample UT facilities fetched from the DB:

  A) CCL JSON API depth  — dump the raw response and look for any long-text fields
  B) Public CCL portal   — probe ccl.utah.gov for per-facility / per-inspection pages
  C) Per-inspection IDs  — try URL patterns against known inspection IDs
  D) PDF discovery       — look for .pdf links in HTML responses

Writes a findings report to scrapers/_ut_narrative_probe_findings.md.
No DB writes are performed.

Usage:
    python3 scrapers/ut_narrative_probe.py
    python3 scrapers/ut_narrative_probe.py --ccl-ids 106874 107200  # specific IDs
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
CCL_BASE = "https://cclapi.dlbc.utah.gov/api/public"
CCL_PORTAL = "https://ccl.utah.gov"
REQUEST_DELAY = 0.6

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "StarlynnCare/research (contact@starlynncare.com)",
    "Accept": "application/json, text/html, */*",
})

FINDINGS_PATH = Path(__file__).parent / "_ut_narrative_probe_findings.md"

# Minimum length to flag a string as "narrative-rich" (not just a title)
NARRATIVE_MIN_LEN = 120


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


def get_db_url() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit("DATABASE_URL or SUPABASE_DB_URL not set.")
    return url


def fetch_sample_facilities(db_url: str, limit: int = 3) -> list[dict]:
    """Return UT facilities that have inspections and an external_id (CCL id)."""
    q = """
        SELECT f.id, f.name, f.external_id, f.city,
               COUNT(i.id) AS insp_count
        FROM facilities f
        JOIN inspections i ON i.facility_id = f.id
        WHERE f.state_code = 'UT'
          AND f.external_id IS NOT NULL
          AND i.source_agency = 'UT-CCL'
        GROUP BY f.id, f.name, f.external_id, f.city
        HAVING COUNT(i.id) >= 1
        ORDER BY COUNT(i.id) DESC
        LIMIT %s
    """
    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.execute(q, (limit,))
        rows = cur.fetchall()
    return [
        {"id": r[0], "name": r[1], "external_id": r[2], "city": r[3], "insp_count": r[4]}
        for r in rows
    ]


def ccl_id_from_external(external_id: str) -> int | None:
    """'F23-106874' → 106874"""
    m = re.search(r"(\d+)$", external_id or "")
    return int(m.group(1)) if m else None


def safe_get(url: str, params: dict | None = None, accept: str = "application/json") -> requests.Response | None:
    try:
        headers = {"Accept": accept}
        r = SESSION.get(url, params=params, headers=headers, timeout=15, allow_redirects=True)
        time.sleep(REQUEST_DELAY)
        return r
    except Exception as e:
        print(f"  [ERROR] GET {url}: {e}")
        return None


def find_long_strings(obj: Any, min_len: int = NARRATIVE_MIN_LEN, path: str = "") -> list[tuple[str, str]]:
    """Recursively find all string values longer than min_len in a JSON structure."""
    results = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            results.extend(find_long_strings(v, min_len, f"{path}.{k}" if path else k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            results.extend(find_long_strings(v, min_len, f"{path}[{i}]"))
    elif isinstance(obj, str) and len(obj) >= min_len:
        results.append((path, obj))
    return results


def find_pdf_links(html: str, base_url: str = "") -> list[str]:
    """Extract all .pdf hrefs from HTML."""
    raw = re.findall(r'href=["\']([^"\']*\.pdf[^"\']*)["\']', html, re.IGNORECASE)
    urls = []
    for u in raw:
        if u.startswith("http"):
            urls.append(u)
        elif u.startswith("/"):
            urls.append(base_url.rstrip("/") + u)
        else:
            urls.append(u)
    return list(set(urls))


# ─── Probe A ────────────────────────────────────────────────────────────────

def probe_a(ccl_id: int) -> dict:
    """Hit the CCL JSON API and look for any long/narrative fields."""
    url = f"{CCL_BASE}/facilities/{ccl_id}"
    print(f"  [A] GET {url}")
    r = safe_get(url)
    result: dict = {"url": url, "status": None, "long_fields": [], "all_keys": [], "sample": {}}

    if r is None:
        result["status"] = "error"
        return result

    result["status"] = r.status_code

    if r.status_code != 200:
        return result

    try:
        data = r.json()
    except Exception:
        result["status"] = "json_parse_error"
        result["raw_preview"] = r.text[:500]
        return result

    # Collect all top-level keys
    if isinstance(data, dict):
        result["all_keys"] = list(data.keys())

    long_strings = find_long_strings(data)
    result["long_fields"] = [(p, v[:300]) for p, v in long_strings]

    # Also look at inspection-level keys specifically
    inspections = data.get("inspections") or (data if isinstance(data, list) else [])
    if inspections:
        first_insp = inspections[0] if isinstance(inspections, list) else {}
        result["inspection_keys"] = list(first_insp.keys()) if isinstance(first_insp, dict) else []
        findings = first_insp.get("findings") or []
        if findings:
            result["finding_keys"] = list(findings[0].keys()) if findings else []
            result["finding_sample"] = findings[0]

    return result


# ─── Probe B ────────────────────────────────────────────────────────────────

def probe_b(ccl_id: int, license_number: str) -> dict:
    """Probe the ccl.utah.gov portal for facility/inspection pages."""
    result: dict = {"probes": []}

    candidates = [
        f"{CCL_PORTAL}",
        f"{CCL_PORTAL}/facility/{ccl_id}",
        f"{CCL_PORTAL}/facilities/{ccl_id}",
        f"{CCL_PORTAL}/search?facilityId={ccl_id}",
        f"{CCL_PORTAL}/search?licenseNumber={license_number}",
    ]

    for url in candidates:
        print(f"  [B] GET {url}")
        r = safe_get(url, accept="text/html,application/xhtml+xml,*/*")
        entry: dict = {"url": url, "status": None}
        if r is None:
            entry["status"] = "error"
            result["probes"].append(entry)
            continue

        entry["status"] = r.status_code
        entry["final_url"] = r.url
        ct = r.headers.get("content-type", "")
        entry["content_type"] = ct

        if r.status_code == 200:
            text = r.text
            # Check for API endpoint hints in SPA
            api_refs = re.findall(r'(cclapi|api/public|api/v\d)[^\s"\'<]{0,80}', text, re.IGNORECASE)
            entry["api_hints"] = list(set(api_refs))[:10]
            # PDF links
            entry["pdf_links"] = find_pdf_links(text, CCL_PORTAL)[:10]
            # Is it a SPA?
            entry["is_spa"] = bool(re.search(r'<div id="(app|root)"', text, re.IGNORECASE))
            # Any navigation to inspection detail?
            detail_hints = re.findall(r'(?:inspection|survey|visit|report)[s]?[/\-][^\s"\'<]{0,60}', text, re.IGNORECASE)
            entry["detail_hints"] = list(set(detail_hints))[:10]

        result["probes"].append(entry)

    return result


# ─── Probe C ────────────────────────────────────────────────────────────────

def probe_c(ccl_id: int) -> dict:
    """Try per-inspection URL patterns against the CCL API."""
    result: dict = {"probes": []}

    # First get real inspection IDs from the facility endpoint
    url = f"{CCL_BASE}/facilities/{ccl_id}"
    r = safe_get(url)
    inspection_ids: list[int] = []

    if r and r.status_code == 200:
        try:
            data = r.json()
            inspections = data.get("inspections") or []
            for insp in inspections[:3]:
                iid = insp.get("id") or insp.get("inspectionId") or insp.get("surveyId")
                if iid:
                    inspection_ids.append(int(iid))
        except Exception:
            pass

    if not inspection_ids:
        result["note"] = "No inspection IDs found in facility response"
        return result

    result["inspection_ids_found"] = inspection_ids

    for iid in inspection_ids[:2]:
        candidates = [
            f"{CCL_BASE}/inspections/{iid}",
            f"{CCL_BASE}/facilities/{ccl_id}/inspections/{iid}",
            f"{CCL_BASE}/findings/{iid}",
            f"{CCL_PORTAL}/inspection/{iid}",
            f"{CCL_PORTAL}/inspections/{iid}",
            f"{CCL_PORTAL}/facility/{ccl_id}/inspection/{iid}",
        ]

        for url in candidates:
            print(f"  [C] GET {url}")
            r = safe_get(url)
            entry: dict = {"url": url, "status": None, "inspection_id": iid}
            if r is None:
                entry["status"] = "error"
                result["probes"].append(entry)
                continue

            entry["status"] = r.status_code
            if r.status_code == 200:
                try:
                    data = r.json()
                    long_fields = find_long_strings(data)
                    entry["long_fields"] = [(p, v[:300]) for p, v in long_fields]
                    entry["keys"] = list(data.keys()) if isinstance(data, dict) else []
                except Exception:
                    entry["html_preview"] = r.text[:400]
            result["probes"].append(entry)

    return result


# ─── Probe D ────────────────────────────────────────────────────────────────

def probe_d(ccl_id: int, license_number: str) -> dict:
    """Try to find PDF inspection reports."""
    result: dict = {"probes": []}

    # Try direct PDF URL patterns
    candidates = [
        f"{CCL_PORTAL}/reports/{ccl_id}.pdf",
        f"{CCL_PORTAL}/documents/{ccl_id}.pdf",
        f"https://cclapi.dlbc.utah.gov/api/public/facilities/{ccl_id}/report",
        f"https://cclapi.dlbc.utah.gov/api/public/facilities/{ccl_id}/documents",
        f"https://cclapi.dlbc.utah.gov/api/public/facilities/{ccl_id}/files",
        f"{CCL_PORTAL}/api/report?id={ccl_id}",
    ]

    for url in candidates:
        print(f"  [D] GET {url}")
        r = safe_get(url)
        entry: dict = {"url": url, "status": None}
        if r is None:
            entry["status"] = "error"
            result["probes"].append(entry)
            continue

        entry["status"] = r.status_code
        entry["content_type"] = r.headers.get("content-type", "")
        if r.status_code == 200:
            if "pdf" in entry["content_type"].lower():
                entry["note"] = "PDF FOUND"
            elif "json" in entry["content_type"].lower():
                try:
                    data = r.json()
                    entry["keys"] = list(data.keys()) if isinstance(data, dict) else str(type(data))
                    entry["sample"] = str(data)[:400]
                except Exception:
                    pass
        result["probes"].append(entry)

    return result


# ─── Report writer ───────────────────────────────────────────────────────────

def write_report(facilities: list[dict], results: list[dict]) -> None:
    lines = [
        "# Utah Narrative Probe Findings",
        f"\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "\nProbes run against 3 sample UT facilities with UT-CCL inspections.",
        "\n---\n",
    ]

    for fac, res in zip(facilities, results):
        lines.append(f"## Facility: {fac['name']} ({fac['city']})")
        lines.append(f"- DB id: `{fac['id']}`")
        lines.append(f"- external_id: `{fac['external_id']}`")
        lines.append(f"- CCL id used: `{res['ccl_id']}`")
        lines.append(f"- Inspections in DB: {fac['insp_count']}")
        lines.append("")

        # Probe A
        a = res["probe_a"]
        lines.append(f"### Probe A — CCL JSON API (`{a['url']}`)")
        lines.append(f"- Status: **{a['status']}**")
        if a.get("all_keys"):
            lines.append(f"- Top-level keys: `{a['all_keys']}`")
        if a.get("inspection_keys"):
            lines.append(f"- Inspection-level keys: `{a['inspection_keys']}`")
        if a.get("finding_keys"):
            lines.append(f"- Finding-level keys: `{a['finding_keys']}`")
        if a.get("finding_sample"):
            lines.append(f"- Finding sample:")
            lines.append(f"  ```json\n  {json.dumps(a['finding_sample'], indent=2)[:800]}\n  ```")
        if a.get("long_fields"):
            lines.append(f"- **Long text fields found ({len(a['long_fields'])}):**")
            for path, val in a["long_fields"][:5]:
                lines.append(f"  - `{path}`: \"{val[:200]}...\"")
        else:
            lines.append("- No long text fields found (all strings < 120 chars)")
        lines.append("")

        # Probe B
        b = res["probe_b"]
        lines.append("### Probe B — Public CCL portal")
        for p in b.get("probes", []):
            lines.append(f"- `{p['url']}` → **{p['status']}** (final: {p.get('final_url', p['url'])})")
            if p.get("is_spa"):
                lines.append("  - SPA detected (`<div id=\"app\">` or similar)")
            if p.get("api_hints"):
                lines.append(f"  - API hints in page: `{p['api_hints']}`")
            if p.get("pdf_links"):
                lines.append(f"  - PDF links: {p['pdf_links']}")
            if p.get("detail_hints"):
                lines.append(f"  - Inspection detail hints: `{p['detail_hints']}`")
        lines.append("")

        # Probe C
        c = res["probe_c"]
        lines.append("### Probe C — Per-inspection URL patterns")
        if c.get("note"):
            lines.append(f"- {c['note']}")
        if c.get("inspection_ids_found"):
            lines.append(f"- Inspection IDs found in API: `{c['inspection_ids_found']}`")
        for p in c.get("probes", []):
            lines.append(f"- `{p['url']}` → **{p['status']}**")
            if p.get("long_fields"):
                lines.append(f"  - Long text fields: {[(x, y[:100]) for x, y in p['long_fields'][:3]]}")
            if p.get("keys"):
                lines.append(f"  - Response keys: `{p['keys']}`")
        lines.append("")

        # Probe D
        d = res["probe_d"]
        lines.append("### Probe D — PDF discovery")
        for p in d.get("probes", []):
            status = p.get("status")
            ct = p.get("content_type", "")
            note = p.get("note", "")
            lines.append(f"- `{p['url']}` → **{status}** ({ct}) {note}")
            if p.get("keys"):
                lines.append(f"  - Keys: `{p['keys']}`")
        lines.append("")
        lines.append("---\n")

    # Summary + recommendation
    lines.append("## Summary and Recommendation")
    lines.append("")
    lines.append("_(Fill in after reviewing above)_")
    lines.append("")
    lines.append("**Recommended next step:**")
    lines.append("")
    lines.append("- [ ] If Probe A revealed `narrativeText` / long fields → patch `ut_ccl_inspections_scraper.py` to ingest them; no separate scraper needed.")
    lines.append("- [ ] If Probe B/C found per-inspection HTML pages → build `ut_inspection_narratives.py` modeled on `or_inspection_narratives.py`.")
    lines.append("- [ ] If Probe D found PDFs → build a PDF-download + text-extract pipeline.")
    lines.append("- [ ] If nothing found → document gap; update `profileConfig.ts` to remove the broken report link CTA and add a note explaining UT doesn't publish inspection-level reports publicly.")

    FINDINGS_PATH.write_text("\n".join(lines))
    print(f"\nFindings written to {FINDINGS_PATH}")


# ─── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ccl-ids", nargs="+", type=int, help="Override sample with specific CCL ids")
    args = parser.parse_args()

    load_env()
    db_url = get_db_url()

    if args.ccl_ids:
        facilities = [{"id": None, "name": f"CCL-{i}", "external_id": f"F00-{i}", "city": "?", "insp_count": "?"}
                      for i in args.ccl_ids]
    else:
        print("Fetching 3 sample UT facilities from DB...")
        facilities = fetch_sample_facilities(db_url, limit=3)
        if not facilities:
            sys.exit("No UT facilities with UT-CCL inspections found in DB.")
        for f in facilities:
            print(f"  {f['name']} ({f['city']}) — external_id={f['external_id']} insp={f['insp_count']}")

    results = []
    for fac in facilities:
        ccl_id = ccl_id_from_external(fac["external_id"]) if not args.ccl_ids else ccl_id_from_external(fac["external_id"])
        if args.ccl_ids:
            ccl_id = int(fac["external_id"].split("-")[-1])

        if ccl_id is None:
            print(f"  [SKIP] Cannot extract CCL id from {fac['external_id']}")
            continue

        print(f"\n=== {fac['name']} (CCL id: {ccl_id}) ===")

        license_number = fac.get("external_id", "")

        res: dict = {"ccl_id": ccl_id}
        res["probe_a"] = probe_a(ccl_id)
        res["probe_b"] = probe_b(ccl_id, license_number)
        res["probe_c"] = probe_c(ccl_id)
        res["probe_d"] = probe_d(ccl_id, license_number)
        results.append(res)

    write_report(facilities, results)


if __name__ == "__main__":
    main()
