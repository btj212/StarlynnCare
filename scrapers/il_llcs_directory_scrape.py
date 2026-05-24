#!/usr/bin/env python3
"""
Illinois IDPH LLCS — MC-candidate ALE/SHE directory scrape.

llcs.dph.illinois.gov is a Salesforce Experience Cloud app (JavaScript-heavy).
This script provides three ingestion modes:

  --from-csv PATH       Ingest from a manually downloaded CSV export.
                        On the LLCS portal, open the facility search, filter to
                        ALE/SHE and Active status, export to CSV/Excel, then
                        convert to CSV and pass here.

  --bootstrap-from-foia PATH
                        Bootstrap stub records from the FOIA workbook
                        ("FOIA AL Visits-2024 to present.xlsx").
                        Creates a row per unique (name, license_number) pair
                        from the workbook — no addresses, but enough to land
                        the inspection data from il_foia_visits_ingest.py.

  --probe               Attempt direct HTTP probe against the LLCS API.
                        Salesforce Community APIs are often accessible without
                        auth for public data. Outputs raw JSON to stdout.
                        Run this first to see if machine-readable data is
                        available before resorting to manual CSV export.

MC-candidate filter (applied in all modes):
  Tier 1 (name-match):  regex \\b(memory.?care|dementia|alzheimer|reminiscence|cognitive)\\b
  Tier 2 (portal flag): il_dementia_program_flag = true (set when portal page
                        indicates a dementia/special-care unit program)

Usage:
  python3 -u scrapers/il_llcs_directory_scrape.py --bootstrap-from-foia \\
      "$HOME/Downloads/FOIA AL Visits-2024 to present.xlsx"

  python3 -u scrapers/il_llcs_directory_scrape.py --from-csv path/to/facilities.csv

  python3 -u scrapers/il_llcs_directory_scrape.py --probe

  python3 -u scrapers/il_llcs_directory_scrape.py --bootstrap-from-foia ... --dry-run
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "IL"
SOURCE_BASE = "https://llcs.dph.illinois.gov/s/?language=en_US"
REQUEST_DELAY = 1.0

# Salesforce community API base — public read endpoints for Experience Cloud
_SF_BASE = "https://llcs.dph.illinois.gov"
_SF_QUERY_PATH = "/s/sfsites/aura"

_MC_PATTERN = re.compile(
    r"\b(memory[\s\-]?care|dementia|alzheimer|reminiscence|cognitive)\b",
    re.IGNORECASE,
)

# IL IDPH 8-digit license number format
_LICENSE_RE = re.compile(r"^\d{8}$")


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
            return


def get_conn() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    return psycopg.connect(url)


def polite_sleep() -> None:
    time.sleep(REQUEST_DELAY + random.random() * 0.5)


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "facility"


def titleize(text: str) -> str:
    if not text:
        return text
    stop = {"and", "or", "of", "in", "the", "a", "at", "by", "for", "to"}
    words = text.lower().split()
    return " ".join(w if (i > 0 and w in stop) else w.capitalize() for i, w in enumerate(words))


def pad_il_license(raw: Any) -> str | None:
    """Normalize to 8-digit zero-padded string; return None if not parseable."""
    if raw is None:
        return None
    digits = re.sub(r"\D", "", str(raw).strip())
    if not digits:
        return None
    return digits.zfill(8)


def is_mc_candidate(name: str) -> bool:
    return bool(_MC_PATTERN.search(name))


def make_slug(name: str, license_number: str) -> str:
    base = slugify(name)
    tail = license_number.lstrip("0") or license_number[-4:]
    return f"{base}-{tail}" if tail else base


def build_record(
    name: str,
    license_number: str,
    *,
    city: str | None = None,
    street: str | None = None,
    zip_code: str | None = None,
    phone: str | None = None,
    license_subtype: str | None = None,   # 'ALE' | 'SHE'
    license_status: str = "LICENSED",
    il_dementia_program_flag: bool = False,
) -> dict[str, Any]:
    clean_name = titleize(name) if name.isupper() else name
    city_slug = slugify(city) if city else "unknown-city"
    slug = make_slug(clean_name, license_number)
    mc_name = is_mc_candidate(name)

    # serves_memory_care = Tier1 (name) OR Tier2 (portal flag); recompute_publishable
    # will re-evaluate from these two columns per the IL gate.
    serves_mc = mc_name or il_dementia_program_flag
    mc_status = "auto_published" if serves_mc else "needs_review"

    return {
        "state_code": STATE_CODE,
        "name": clean_name,
        "license_number": license_number,
        "license_type": license_subtype or "ALE",
        "il_license_subtype": license_subtype,
        "il_mc_name_match": mc_name,
        "il_dementia_program_flag": il_dementia_program_flag,
        "street": titleize(street) if street else None,
        "city": titleize(city) if city else None,
        "city_slug": city_slug,
        "zip": zip_code[:10] if zip_code else None,
        "phone": phone,
        "slug": slug,
        "license_status": license_status,
        "serves_memory_care": serves_mc,
        "mc_review_status": mc_status,
        "publishable": False,
        "source_url": f"{SOURCE_BASE}#license={license_number}",
    }


# ─────────────────────────────────────────────────────────────────────────────
# UPSERT SQL
# ─────────────────────────────────────────────────────────────────────────────

_UPSERT_SQL = """
INSERT INTO facilities (
    state_code, name, license_number, license_type,
    il_license_subtype, il_mc_name_match, il_dementia_program_flag,
    street, city, city_slug, zip, phone, slug,
    license_status, serves_memory_care, mc_review_status,
    publishable, source_url
) VALUES (
    %(state_code)s, %(name)s, %(license_number)s, %(license_type)s,
    %(il_license_subtype)s, %(il_mc_name_match)s, %(il_dementia_program_flag)s,
    %(street)s, %(city)s, %(city_slug)s, %(zip)s, %(phone)s, %(slug)s,
    %(license_status)s, %(serves_memory_care)s, %(mc_review_status)s,
    %(publishable)s, %(source_url)s
)
ON CONFLICT (state_code, license_number)
WHERE state_code = 'IL' AND license_number IS NOT NULL
DO UPDATE SET
    name                    = EXCLUDED.name,
    license_type            = COALESCE(EXCLUDED.license_type, facilities.license_type),
    il_license_subtype      = COALESCE(EXCLUDED.il_license_subtype, facilities.il_license_subtype),
    il_mc_name_match        = EXCLUDED.il_mc_name_match,
    il_dementia_program_flag= CASE
                                WHEN EXCLUDED.il_dementia_program_flag THEN true
                                ELSE facilities.il_dementia_program_flag
                              END,
    street                  = COALESCE(EXCLUDED.street, facilities.street),
    city                    = COALESCE(EXCLUDED.city, facilities.city),
    city_slug               = COALESCE(EXCLUDED.city_slug, facilities.city_slug),
    zip                     = COALESCE(EXCLUDED.zip, facilities.zip),
    phone                   = COALESCE(EXCLUDED.phone, facilities.phone),
    license_status          = EXCLUDED.license_status,
    serves_memory_care      = EXCLUDED.serves_memory_care,
    mc_review_status        = COALESCE(EXCLUDED.mc_review_status, facilities.mc_review_status),
    source_url              = EXCLUDED.source_url,
    updated_at              = now()
"""


def upsert_record(
    conn: psycopg.Connection,
    rec: dict[str, Any],
    dry_run: bool = False,
) -> bool:
    if dry_run:
        print(
            f"  [dry-run] {rec['license_number']} | {rec['name'][:45]:45s} | "
            f"mc={rec['serves_memory_care']} name_match={rec['il_mc_name_match']}"
        )
        return True

    sp = f"sp_il_{rec['license_number']}"
    with conn.cursor() as cur:
        try:
            cur.execute(f"SAVEPOINT {sp}")
            cur.execute(_UPSERT_SQL, rec)
            cur.execute(f"RELEASE SAVEPOINT {sp}")
            return True
        except Exception as exc:
            cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
            print(f"  ERROR {rec['license_number']}: {exc}", file=sys.stderr, flush=True)
            return False


# ─────────────────────────────────────────────────────────────────────────────
# Mode 1: bootstrap from FOIA workbook
# ─────────────────────────────────────────────────────────────────────────────


def _load_foia_records(xlsx_path: Path) -> list[dict[str, Any]]:
    """Read unique (name, license_number) pairs from the FOIA workbook."""
    try:
        import openpyxl
    except ImportError:
        print("ERROR: openpyxl not installed. Run: pip install openpyxl", file=sys.stderr)
        sys.exit(1)

    wb = openpyxl.load_workbook(str(xlsx_path), data_only=True, read_only=True)
    ws = wb.active

    seen: dict[str, str] = {}  # license_number → name
    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
        if not row or not row[0]:
            continue
        raw_name = str(row[0]).strip()
        raw_lic  = str(row[1]).strip() if row[1] is not None else ""
        lic = pad_il_license(raw_lic)
        if not lic or not raw_name:
            continue
        # Keep the first occurrence; names should be consistent
        if lic not in seen:
            seen[lic] = raw_name

    wb.close()
    print(f"  FOIA workbook: {len(seen)} unique facilities", flush=True)
    return [build_record(name, lic) for lic, name in seen.items()]


def run_bootstrap_foia(xlsx_path: Path, dry_run: bool) -> None:
    records = _load_foia_records(xlsx_path)
    mc_records = [r for r in records if r["serves_memory_care"]]
    print(
        f"  MC candidates (Tier 1 name-match): {len(mc_records)} of {len(records)}",
        flush=True,
    )

    if not mc_records:
        print("  No MC candidates found in FOIA workbook.", flush=True)
        return

    if dry_run:
        for r in mc_records[:10]:
            print(
                f"    {r['license_number']} | {r['name'][:50]:50s} | "
                f"slug={r['slug'][:30]}"
            )
        print(f"  ... ({len(mc_records)} total, dry-run no writes)")
        return

    conn = get_conn()
    ok = err = 0
    with conn:
        for rec in mc_records:
            if upsert_record(conn, rec):
                ok += 1
            else:
                err += 1
        conn.commit()

    print(f"\nDone. {ok} upserted, {err} errors.", flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# Mode 2: ingest from manually downloaded CSV
# ─────────────────────────────────────────────────────────────────────────────


def _parse_csv_record(row: dict[str, str]) -> dict[str, Any] | None:
    """
    Parse a row from the LLCS portal CSV export.

    Expected columns (case-insensitive):
      Facility Name / Name  →  name
      License Number / ID   →  license_number
      Facility Type         →  license_subtype (ALE / SHE)
      Address               →  street
      City                  →  city
      Zip / Zip Code        →  zip
      Phone                 →  phone
      Status                →  license_status
    """
    def _get(*keys: str) -> str:
        for k in keys:
            for col in row:
                if col.lower().replace(" ", "_") == k.lower().replace(" ", "_"):
                    return row[col].strip()
        return ""

    raw_name = _get("facility_name", "name", "facility")
    raw_lic  = _get("license_number", "id", "license_no", "license")
    lic = pad_il_license(raw_lic)
    if not lic or not raw_name:
        return None

    raw_status = _get("status", "license_status").lower()
    license_status = "LICENSED" if raw_status in ("active", "licensed", "open") else "CLOSED"

    raw_type = _get("facility_type", "type", "license_type").upper()
    subtype = "SHE" if "shared" in raw_type.lower() else "ALE"

    return build_record(
        raw_name,
        lic,
        city=_get("city") or None,
        street=_get("address", "street") or None,
        zip_code=_get("zip", "zip_code", "zipcode") or None,
        phone=_get("phone", "phone_number") or None,
        license_subtype=subtype,
        license_status=license_status,
    )


def run_from_csv(csv_path: Path, dry_run: bool, limit: int | None) -> None:
    import csv as _csv

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = _csv.DictReader(f)
        all_rows = list(reader)

    records = [r for row in all_rows if (r := _parse_csv_record(row)) is not None]
    mc_records = [r for r in records if r["serves_memory_care"]]
    print(
        f"  Parsed {len(records)} facilities — MC candidates: {len(mc_records)}",
        flush=True,
    )

    if limit:
        mc_records = mc_records[:limit]

    if dry_run:
        for r in mc_records[:10]:
            print(
                f"    {r['license_number']} | {r['name'][:45]:45s} | "
                f"mc={r['serves_memory_care']} name={r['il_mc_name_match']}"
            )
        print(f"  (dry-run, {len(mc_records)} MC candidates)")
        return

    conn = get_conn()
    ok = err = 0
    with conn:
        for rec in mc_records:
            if upsert_record(conn, rec):
                ok += 1
            else:
                err += 1
        conn.commit()

    print(f"\nDone. {ok} upserted, {err} errors.", flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# Mode 3: probe LLCS API endpoints
# ─────────────────────────────────────────────────────────────────────────────


def run_probe() -> None:
    """
    Attempt to discover machine-readable endpoints on the LLCS Salesforce portal.
    Prints what it finds; does not write to the DB.
    """
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    sess = requests.Session()
    sess.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
    })
    sess.verify = False

    import json as _json

    probes = [
        # Homepage — grab aura context and CSRF token embedded in HTML
        f"{_SF_BASE}/s/?language=en_US",
        # Salesforce REST API introspection (public endpoints sometimes open)
        f"{_SF_BASE}/services/data/",
        # Apex REST pattern for facility listings (common IDPH pattern)
        f"{_SF_BASE}/services/apexrest/Facilities?state=IL&type=ALE&limit=5",
        f"{_SF_BASE}/services/apexrest/FacilitySearch?facilityType=ALE&status=Active&limit=5",
        # Salesforce Aura — GET to see if community is configured
        f"{_SF_BASE}/s/sfsites/aura",
        # Experience Cloud search
        f"{_SF_BASE}/s/global-search/00000000000000000000000000000001",
    ]

    print("Probing LLCS endpoints (SSL verify=False) …\n", flush=True)
    for url in probes:
        try:
            r = sess.get(url, timeout=15, allow_redirects=True)
            ct = r.headers.get("Content-Type", "")
            body_preview = r.text[:600].replace("\n", " ")
            print(f"  {r.status_code}  {ct[:50]:50s}  {url}")
            if r.status_code == 200:
                if "json" in ct:
                    try:
                        data = r.json()
                        print("    →", _json.dumps(data, indent=2)[:500])
                    except Exception:
                        print(f"    → (body) {body_preview[:300]}")
                elif "html" in ct:
                    # Look for Aura context token or API hints in the page source
                    import re as _re
                    aura_ctx = _re.search(r'"token"\s*:\s*"([^"]{10,})"', r.text)
                    sf_org   = _re.search(r'"orgId"\s*:\s*"([^"]{15,})"', r.text)
                    api_ver  = _re.search(r'/services/data/v([\d.]+)/', r.text)
                    if aura_ctx:
                        print(f"    → Aura token found: {aura_ctx.group(1)[:40]}…")
                    if sf_org:
                        print(f"    → Salesforce orgId: {sf_org.group(1)}")
                    if api_ver:
                        print(f"    → API version hint: v{api_ver.group(1)}")
                    title_m = _re.search(r"<title>(.*?)</title>", r.text, _re.I)
                    print(f"    → HTML {len(r.text)} bytes; title: {title_m.group(1)[:80] if title_m else 'n/a'}")
            elif r.status_code in (401, 403):
                print(f"    → Auth required. Headers: {dict(list(r.headers.items())[:4])}")
            polite_sleep()
        except requests.RequestException as exc:
            print(f"  ERROR  {url}: {exc}", flush=True)

    # Try Salesforce REST API data queries — /services/data/ returned 200, so try actual SOQL
    print("\n--- Trying Salesforce REST API SOQL queries ---", flush=True)
    sf_api = f"{_SF_BASE}/services/data/v57.0"
    soql_tests = [
        "SELECT Id,Name,BillingStreet,BillingCity,BillingPostalCode,Phone FROM Account LIMIT 5",
        "SELECT Id,Name FROM Account WHERE RecordType.Name LIKE '%Facility%' LIMIT 5",
        "SELECT Id,Name,License_Number__c,Facility_Type__c,Status__c FROM Account LIMIT 5",
        "SELECT Id,Name FROM Account WHERE Type='Facility' LIMIT 5",
    ]
    for soql in soql_tests:
        import urllib.parse as _up
        url = f"{sf_api}/query?q={_up.quote(soql)}"
        try:
            r = sess.get(url, timeout=12)
            ct = r.headers.get("Content-Type", "")
            print(f"  {r.status_code}  {url[:90]}")
            if r.status_code == 200 and "json" in ct:
                data = r.json()
                print(f"    → totalSize={data.get('totalSize')} records: {_json.dumps(data.get('records', [])[:2], indent=2)[:400]}")
                break  # found working query, stop here
            elif r.status_code in (401, 403):
                print(f"    → Auth required: {r.text[:200]}")
                break
            else:
                print(f"    → {r.text[:150]}")
        except requests.RequestException as exc:
            print(f"  ERROR: {exc}")
        polite_sleep()

    # Also probe the Salesforce Tooling API and Connect API
    print("\n--- Probing Salesforce API resource list ---")
    try:
        r = sess.get(f"{sf_api}/", timeout=10)
        if r.status_code == 200 and "json" in r.headers.get("Content-Type", ""):
            data = r.json()
            # Print just the keys to see what resources are available
            print(f"    → API resources: {list(data.keys())[:20]}")
        else:
            print(f"    → {r.status_code} {r.text[:200]}")
    except requests.RequestException as exc:
        print(f"  ERROR: {exc}")

    # Try Aura POST with a generic component query (public Experience Cloud pattern)
    print("\n--- Trying Aura POST (public component query) ---", flush=True)
    aura_post_url = f"{_SF_BASE}/s/sfsites/aura"
    try:
        payload = {
            "message": _json.dumps({
                "actions": [{
                    "id": "1;a",
                    "descriptor": "serviceComponent://ui.communities.components.forceCommunity.communityNavigation.CommunityNavigationController/ACTION$getNavItems",
                    "callingDescriptor": "UNKNOWN",
                    "params": {},
                }]
            }),
            "aura.context": _json.dumps({
                "mode": "PROD",
                "fwuid": "unknown",
                "app": "siteforce:communityApp",
                "loaded": {},
                "dn": [],
                "globals": {},
                "uad": False,
            }),
            "aura.pageURI": "/s/?language=en_US",
            "aura.token": "null",
        }
        r = sess.post(aura_post_url, data=payload, timeout=15)
        ct = r.headers.get("Content-Type", "")
        print(f"  POST {r.status_code}  {ct[:50]:50s}")
        if r.status_code == 200:
            print(f"    → {r.text[:600]}")
        else:
            print(f"    → {r.text[:300]}")
    except requests.RequestException as exc:
        print(f"  Aura POST ERROR: {exc}", flush=True)

    print("\n--- Instructions if probe shows no accessible API ---")
    print("1. Open https://llcs.dph.illinois.gov/s/?language=en_US in a browser.")
    print("2. Use the facility search to list all ALE/SHE facilities.")
    print("3. Export to CSV (look for an Export button or use DevTools Network tab")
    print("   to capture the API call and replay it with requests).")
    print("4. Pass the downloaded CSV to:")
    print("   python3 -u scrapers/il_llcs_directory_scrape.py --from-csv <path>")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="IL IDPH LLCS — MC-candidate ALE/SHE directory ingest"
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--bootstrap-from-foia",
        metavar="XLSX_PATH",
        help="Bootstrap stub records from the FOIA workbook (fastest first run)",
    )
    mode.add_argument(
        "--from-csv",
        metavar="CSV_PATH",
        help="Ingest from a manually exported CSV from the LLCS portal",
    )
    mode.add_argument(
        "--probe",
        action="store_true",
        help="Probe LLCS API endpoints and print what is accessible",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print rows, no DB writes")
    parser.add_argument("--limit", type=int, default=None, help="Cap rows processed")
    args = parser.parse_args()

    load_env()

    if args.probe:
        run_probe()
        return

    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    if args.bootstrap_from_foia:
        p = Path(args.bootstrap_from_foia)
        if not p.is_file():
            print(f"File not found: {p}", file=sys.stderr)
            sys.exit(1)
        run_bootstrap_foia(p, dry_run=args.dry_run)

    elif args.from_csv:
        p = Path(args.from_csv)
        if not p.is_file():
            print(f"File not found: {p}", file=sys.stderr)
            sys.exit(1)
        run_from_csv(p, dry_run=args.dry_run, limit=args.limit)


if __name__ == "__main__":
    main()
