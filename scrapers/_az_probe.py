#!/usr/bin/env python3
"""
Arizona ADHS data-source probe — read-only, no DB writes.

Answers three questions before any schema work:
  1. Directory: Does the ADHS ArcGIS / data portal publish a clean directory
     with license level (Directed/Personal/Supervisory) and MC subclass?
  2. MC signal: How many facilities carry the Directed Care flag or the new
     HB2764 Memory Care subclass?
  3. Inspections: Is AZ Care Check (Salesforce) machine-readable, or is there
     a secondary enforcement dataset on data.azdhs.gov?

GO/NO-GO output: script exits 0 and prints VERDICT at the end.

Usage:
    python3 -u scrapers/_az_probe.py
"""

from __future__ import annotations

import json
import re
import sys
import time

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ---------------------------------------------------------------------------
# Known ADHS endpoints to probe
# ---------------------------------------------------------------------------

# 1. ADHS ArcGIS Open Data Hub — Long Term Care Facilities layer
#    Discovered via: azgeo-open-data-agic.hub.arcgis.com
#    Standard ArcGIS FeatureServer — try several candidate service IDs.
ARCGIS_CANDIDATES = [
    # ADHS GIS internal server (confirmed from web search)
    "https://gis.azdhs.gov/arcgis/rest/services/Arizona/LicensedFacilities/FeatureServer/0/query",
    "https://gis.azdhs.gov/arcgis/rest/services/Arizona/AssistedLiving/FeatureServer/0/query",
    "https://gis.azdhs.gov/arcgis/rest/services/Arizona/HealthFacilities/FeatureServer/0/query",
    # ArcGIS Online hosted layer (ADHS organisation)
    "https://services.arcgis.com/TxjGqTkWnkFCBFGn/arcgis/rest/services/LTC_Facilities/FeatureServer/0/query",
    # AGIC open-data hub (common AZ government GIS host)
    "https://azgeo-open-data-agic.hub.arcgis.com/datasets/ADHSGIS::state-licensed-long-term-care-facilities-in-arizona/api",
    "https://services.arcgis.com/pRWPDeOCkl89qGJA/arcgis/rest/services/State_Licensed_Long_Term_Care_Facilities_in_Arizona/FeatureServer/0/query",
]

# 2. data.azdhs.gov — Licensing facility database monthly export
ADHS_DATA_PORTAL = "https://data.azdhs.gov"
ADHS_PROVIDER_DB_CANDIDATES = [
    "https://data.azdhs.gov/reports-and-catalogs/home",
    "https://data.azdhs.gov/api/views.json?tags=licensing&limit=20",
    "https://data.azdhs.gov/resource/assisted-living.json?$limit=5",
    "https://data.azdhs.gov/resource/a9tc-9nkf.json?$limit=5",  # common ADHS datasets
]

# 3. AZ Care Check — Salesforce Experience Cloud (inspection data)
AZCARECHECK_BASE = "https://azcarecheck.azdhs.gov"
AZCARECHECK_CANDIDATES = [
    f"{AZCARECHECK_BASE}/s/",
    f"{AZCARECHECK_BASE}/services/data/",
    f"{AZCARECHECK_BASE}/services/apexrest/FacilitySearch?limit=5",
    f"{AZCARECHECK_BASE}/services/apexrest/Inspections?limit=5",
    f"{AZCARECHECK_BASE}/s/sfsites/aura",
    f"{AZCARECHECK_BASE}/s/global-search/00000000000000000000000000000001",
]

# 4. data.azdhs.gov enforcement / inspection datasets
ADHS_INSPECTION_CANDIDATES = [
    "https://data.azdhs.gov/api/views.json?tags=inspections&limit=20",
    "https://data.azdhs.gov/api/views.json?tags=enforcement&limit=20",
    "https://data.azdhs.gov/api/views.json?tags=assisted+living&limit=20",
    "https://data.azdhs.gov/resource/deficiencies.json?$limit=5",
]

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html, */*",
})


def probe(url: str, params: dict | None = None, method: str = "GET",
          verify: bool = True, timeout: int = 15) -> tuple[int, str, str]:
    """Single request → (status_code, content_type, body_preview)."""
    try:
        r = SESSION.request(method, url, params=params, timeout=timeout, verify=verify,
                            allow_redirects=True)
        ct = r.headers.get("Content-Type", "")
        return r.status_code, ct, r.text[:1200]
    except requests.RequestException as exc:
        return 0, "", str(exc)


def arcgis_query(url: str, limit: int = 5) -> tuple[int, list[dict], list[str]]:
    """
    Query an ArcGIS FeatureServer with outFields=* and return
    (feature_count, first_feature_attrs_sample, all_field_names).
    Returns (-1, [], []) on error.
    """
    params = {
        "where": "1=1",
        "outFields": "*",
        "returnGeometry": "false",
        "resultRecordCount": limit,
        "f": "json",
    }
    try:
        r = SESSION.post(url, data=params, timeout=20)
        r.raise_for_status()
        data = r.json()
        if "error" in data:
            return -1, [], []
        features = data.get("features", [])
        fields = [f["name"] for f in data.get("fields", [])]
        attrs = [f.get("attributes", {}) for f in features]
        return len(features), attrs, fields
    except Exception:
        return -1, [], []


# ---------------------------------------------------------------------------
# Section 1: ArcGIS directory probe
# ---------------------------------------------------------------------------

def probe_directory() -> dict:
    print("\n" + "=" * 70)
    print("SECTION 1 — ArcGIS facility directory")
    print("=" * 70)

    result = {"found": False, "url": None, "fields": [], "sample_attrs": [], "mc_fields": []}

    for url in ARCGIS_CANDIDATES:
        print(f"\n  Trying: {url}")
        count, attrs, fields = arcgis_query(url, limit=3)
        if count >= 0 and fields:
            print(f"  ✓ OK — {len(fields)} fields, {count} sample records")
            print(f"    Fields: {fields[:25]}")
            if attrs:
                print(f"    Sample[0]: {json.dumps(attrs[0], default=str)[:500]}")

            # Find MC-relevant fields
            mc_fields = [f for f in fields if any(kw in f.upper() for kw in
                         ["MEMORY", "DIRECT", "PERSONAL", "SUPERVIS", "MC", "DEMENTIA",
                          "ALZHEIMER", "SUBCLASS", "LEVEL", "CARE_TYPE", "LICENSE_LEVEL"])]
            print(f"    MC-candidate fields: {mc_fields}")
            result.update({"found": True, "url": url, "fields": fields,
                           "sample_attrs": attrs, "mc_fields": mc_fields})
            return result
        else:
            status, ct, body = probe(url.replace("/query", ""), verify=True)
            print(f"  ✗ ArcGIS error — service status: {status}  CT: {ct[:40]}")
            if "html" in ct.lower():
                title = re.search(r"<title>(.*?)</title>", body, re.I)
                if title:
                    print(f"    HTML title: {title.group(1)[:80]}")
        time.sleep(0.5)

    # Try the ADHS GIS REST root to discover available services
    print("\n  Enumerating ADHS GIS REST service tree …")
    for path in [
        "https://gis.azdhs.gov/arcgis/rest/services/Arizona?f=pjson",
        "https://gis.azdhs.gov/arcgis/rest/services?f=pjson",
    ]:
        status, ct, body = probe(path)
        print(f"  {status}  {ct[:40]:40s}  {path}")
        if status == 200 and "json" in ct:
            try:
                data = json.loads(body)
                services = data.get("services", [])
                print(f"    → {len(services)} services: {[s['name'] for s in services[:10]]}")
            except Exception:
                print(f"    → {body[:400]}")
        time.sleep(0.5)

    return result


# ---------------------------------------------------------------------------
# Section 2: data.azdhs.gov Socrata portal
# ---------------------------------------------------------------------------

def probe_adhs_portal() -> dict:
    print("\n" + "=" * 70)
    print("SECTION 2 — data.azdhs.gov provider/facility databases")
    print("=" * 70)

    result = {"found": False, "dataset_id": None, "fields": [], "sample": []}

    # Try Socrata API catalog discovery
    catalog_urls = [
        "https://data.azdhs.gov/api/views.json?limit=50&category=Licensing",
        "https://data.azdhs.gov/api/views.json?limit=50",
        "https://data.azdhs.gov/api/catalog/v1?q=assisted+living&limit=10",
        "https://data.azdhs.gov/api/catalog/v1?q=licensed+facilities&limit=10",
    ]
    for url in catalog_urls:
        print(f"\n  Trying catalog: {url}")
        status, ct, body = probe(url)
        print(f"  {status}  {ct[:40]}")
        if status == 200:
            try:
                data = json.loads(body)
                if isinstance(data, list):
                    for ds in data[:5]:
                        name = ds.get("name", ds.get("title", "?"))
                        uid = ds.get("id", "?")
                        print(f"    → {uid}  {name[:70]}")
                    result["found"] = True
                elif isinstance(data, dict):
                    results = data.get("results", data.get("items", []))
                    for ds in results[:10]:
                        name = ds.get("name", ds.get("title", "?"))
                        uid = ds.get("id", ds.get("uid", "?"))
                        print(f"    → {uid}  {name[:70]}")
                    if results:
                        result["found"] = True
            except Exception:
                print(f"    → (non-JSON) {body[:300]}")
        time.sleep(0.5)

    # Try direct candidate dataset IDs
    for url in ADHS_DATA_PORTAL_DATASETS:
        print(f"\n  Trying dataset: {url}")
        status, ct, body = probe(url)
        print(f"  {status}  {ct[:40]}")
        if status == 200 and "json" in ct:
            try:
                data = json.loads(body)
                if isinstance(data, list) and data:
                    print(f"    → {len(data)} rows — keys: {list(data[0].keys())[:15]}")
                    result.update({"found": True, "sample": data[:2]})
            except Exception:
                pass
        time.sleep(0.5)

    return result


ADHS_DATA_PORTAL_DATASETS = [
    # Common Socrata resource IDs for AZ DHS (try known patterns)
    "https://data.azdhs.gov/resource/b3h5-2d7s.json?$limit=5",
    "https://data.azdhs.gov/resource/pjg7-m5dh.json?$limit=5",
    "https://data.azdhs.gov/resource/enfa-xnqn.json?$limit=5",
    "https://data.azdhs.gov/resource/g5gt-23vb.json?$limit=5",
]


# ---------------------------------------------------------------------------
# Section 3: AZ Care Check (Salesforce) — inspection data probe
# ---------------------------------------------------------------------------

def probe_azcarecheck() -> dict:
    print("\n" + "=" * 70)
    print("SECTION 3 — AZ Care Check inspection data (azcarecheck.azdhs.gov)")
    print("=" * 70)

    result = {"accessible": False, "surface": None, "notes": []}

    sf_session = requests.Session()
    sf_session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
        ),
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": f"{AZCARECHECK_BASE}/s/",
    })

    print("\n  Probing AZ Care Check endpoints …")
    for url in AZCARECHECK_CANDIDATES:
        try:
            r = sf_session.get(url, timeout=15, verify=False, allow_redirects=True)
            ct = r.headers.get("Content-Type", "")
            print(f"  {r.status_code}  {ct[:45]:45s}  {url}")

            if r.status_code == 200:
                if "json" in ct:
                    try:
                        data = r.json()
                        print(f"    → JSON keys: {list(data.keys())[:8]}")
                        result.update({"accessible": True, "surface": url})
                        result["notes"].append(f"JSON accessible: {url}")
                    except Exception:
                        pass
                elif "html" in ct:
                    aura_token = re.search(r'"token"\s*:\s*"([^"]{10,})"', r.text)
                    org_id = re.search(r'"orgId"\s*:\s*"([^"]{15,})"', r.text)
                    api_ver = re.search(r'/services/data/v([\d.]+)/', r.text)
                    if aura_token:
                        print(f"    → Aura token: {aura_token.group(1)[:40]}…")
                        result["notes"].append(f"Aura token found at {url}")
                    if org_id:
                        print(f"    → Salesforce orgId: {org_id.group(1)}")
                        result["notes"].append(f"orgId={org_id.group(1)}")
                    if api_ver:
                        print(f"    → API version hint: v{api_ver.group(1)}")
                    title = re.search(r"<title>(.*?)</title>", r.text, re.I)
                    print(f"    → HTML {len(r.text)}B title: {title.group(1)[:80] if title else 'n/a'}")

            elif r.status_code in (401, 403):
                print(f"    → Auth required: {r.text[:200]}")
                result["notes"].append(f"Auth wall at {url}")
        except requests.RequestException as exc:
            print(f"  ERROR  {url}: {exc}")
        time.sleep(1.0)

    # Try Salesforce REST data API
    print("\n  Trying Salesforce REST API queries …")
    sf_api_base = f"{AZCARECHECK_BASE}/services/data/v57.0"
    soql_probes = [
        "SELECT Id,Name FROM Account LIMIT 3",
        "SELECT Id,Name,License_Number__c FROM Account WHERE RecordType.Name LIKE '%Facilit%' LIMIT 3",
        "SELECT Id,Name FROM Inspection__c LIMIT 3",
    ]
    import urllib.parse as up
    for soql in soql_probes:
        url = f"{sf_api_base}/query?q={up.quote(soql)}"
        try:
            r = sf_session.get(url, timeout=12, verify=False)
            ct = r.headers.get("Content-Type", "")
            print(f"  {r.status_code}  {url[:80]}")
            if r.status_code == 200 and "json" in ct:
                data = r.json()
                print(f"    → totalSize={data.get('totalSize')} rows={json.dumps(data.get('records', [])[:1])[:300]}")
                result.update({"accessible": True, "surface": "Salesforce REST"})
                break
            else:
                print(f"    → {r.text[:150]}")
        except Exception as exc:
            print(f"  ERROR: {exc}")
        time.sleep(0.8)

    # Try Aura POST (public Experience Cloud pattern)
    print("\n  Trying Salesforce Aura POST …")
    aura_url = f"{AZCARECHECK_BASE}/s/sfsites/aura"
    aura_payload = {
        "message": json.dumps({"actions": [{"id": "1;a",
            "descriptor": "serviceComponent://ui.communities.components.forceCommunity.communityNavigation.CommunityNavigationController/ACTION$getNavItems",
            "callingDescriptor": "UNKNOWN", "params": {}}]}),
        "aura.context": json.dumps({"mode": "PROD", "fwuid": "unknown",
            "app": "siteforce:communityApp", "loaded": {}, "dn": [],
            "globals": {}, "uad": False}),
        "aura.pageURI": "/s/",
        "aura.token": "null",
    }
    try:
        r = sf_session.post(aura_url, data=aura_payload, timeout=15, verify=False)
        ct = r.headers.get("Content-Type", "")
        print(f"  POST {r.status_code}  {ct[:50]}")
        if r.status_code == 200:
            print(f"    → {r.text[:600]}")
            if "actions" in r.text or "returnValue" in r.text:
                result["notes"].append("Aura POST returned action data")
    except Exception as exc:
        print(f"  ERROR: {exc}")

    return result


# ---------------------------------------------------------------------------
# Section 4: data.azdhs.gov enforcement / inspection datasets
# ---------------------------------------------------------------------------

def probe_inspection_datasets() -> dict:
    print("\n" + "=" * 70)
    print("SECTION 4 — data.azdhs.gov enforcement / inspection datasets")
    print("=" * 70)

    result = {"found": False, "datasets": []}

    search_urls = [
        "https://data.azdhs.gov/api/catalog/v1?q=inspection&limit=15",
        "https://data.azdhs.gov/api/catalog/v1?q=deficiency&limit=10",
        "https://data.azdhs.gov/api/catalog/v1?q=enforcement&limit=10",
        "https://data.azdhs.gov/api/catalog/v1?q=assisted+living+violation&limit=10",
        "https://data.azdhs.gov/api/views.json?q=inspection&limit=20",
        "https://data.azdhs.gov/api/views.json?q=assisted+living&limit=20",
    ]

    for url in search_urls:
        print(f"\n  {url}")
        status, ct, body = probe(url)
        print(f"  {status}  {ct[:40]}")
        if status == 200:
            try:
                data = json.loads(body)
                items = []
                if isinstance(data, list):
                    items = data
                elif isinstance(data, dict):
                    items = data.get("results", data.get("items", []))
                if items:
                    for ds in items[:8]:
                        name = ds.get("name", ds.get("title", "?"))
                        uid = ds.get("id", ds.get("uid", "?"))
                        print(f"    → [{uid}] {name[:70]}")
                    result["found"] = True
                    result["datasets"].extend([
                        {"id": ds.get("id", ds.get("uid")),
                         "name": ds.get("name", ds.get("title"))}
                        for ds in items[:8]
                    ])
            except Exception:
                print(f"    → {body[:300]}")
        time.sleep(0.5)

    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("Arizona ADHS data-source probe")
    print("Read-only — no DB writes")
    print()

    dir_result = probe_directory()
    portal_result = probe_adhs_portal()
    carecheck_result = probe_azcarecheck()
    insp_result = probe_inspection_datasets()

    # ── VERDICT ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("VERDICT")
    print("=" * 70)

    dir_ok = dir_result["found"]
    insp_ok = carecheck_result["accessible"] or insp_result["found"]

    print(f"\n  [{'✓' if dir_ok else '✗'}] Facility directory machine-readable: {dir_ok}")
    if dir_result.get("url"):
        print(f"       Source: {dir_result['url']}")
        print(f"       MC fields found: {dir_result.get('mc_fields', [])}")

    print(f"\n  [{'✓' if insp_ok else '✗'}] Inspection data accessible: {insp_ok}")
    if carecheck_result["notes"]:
        print(f"       AZ Care Check: {carecheck_result['notes']}")
    if insp_result["found"]:
        print(f"       data.azdhs.gov datasets: {[d['name'] for d in insp_result['datasets'][:5]]}")

    print()
    if dir_ok and insp_ok:
        print("GO — proceed to Phase 1 (migration + directory ingest).")
    elif dir_ok and not insp_ok:
        print("PARTIAL GO — directory accessible, inspections blocked.")
        print("  Options:")
        print("  A. Submit ADHS public records request for bulk inspection export (like TX PIA).")
        print("  B. Check if AZ Care Check renders inspection PDFs linkable (scrape PDF inventory).")
        print("  C. CMS Care Compare covers AZ nursing facilities — usable for NH subset only.")
        print("  Under YMYL rules, do NOT publish facility profiles without inspection history.")
        print("  Recommended: submit records request, build directory ingest in parallel.")
    else:
        print("NO-GO — directory not accessible. Investigate source manually before building.")

    sys.exit(0 if (dir_ok and insp_ok) else 1)


if __name__ == "__main__":
    main()
