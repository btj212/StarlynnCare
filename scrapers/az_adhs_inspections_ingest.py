#!/usr/bin/env python3
"""
Arizona ADHS Inspections Ingest — REST-only via AZ Care Check Aura API.

INVESTIGATION OUTCOME (2026-06-15):
  AZ Care Check (azcarecheck.azdhs.gov) DOES cover ALH/ALC under the
  "Health Care Facilities" program (not shown as a separate dropdown entry).
  Both the account search and the inspection history API work without auth.

  Aura endpoints (no session required):
    getAccountsMapData  → AZCCMapService
    getFacilityOrLicenseInspections → AZCCInspectionHistoryController

  Deficiency data (2026-06-22):
    No Aura endpoint found for per-inspection deficiencies (Salesforce blocks
    guest access). Data is available in the rendered DOM at:
      /s/inspection-details?inspectionId=<sf_id>&facilityId=<sf_fac_id>
    Scraped via Playwright (headless Chromium). Table columns: Rule, Evidence,
    Files, Plan of Correction. Rule code in <th> elements; data in gridcells.

MODES:
  --mode discover
    Calls getAccountsMapData for ALH + ALC types → 2,204 records.
    Matches to facilities table by name + city (fuzzy) or address.
    Writes az_sf_account_id to matched facility rows.
    Run once; re-run is idempotent.

  --mode inspect
    For each AZ facility with az_sf_account_id, calls
    getFacilityOrLicenseInspections, upserts into the inspections table,
    and sets has_inspection_text where initialComments is present.
    Rate-limited: ~2 req/s.

  --mode deficiencies
    For each AZ inspection with a sf_inspection_id, renders the
    inspection-details page with Playwright, parses the deficiency table,
    and upserts rows into the deficiencies table.
    Resumable: skips inspections that already have deficiency rows.
    Rate-limited by page render time (~5s/page, ~3 concurrent workers).
    Use --limit and --offset to run in chunks.

  --mode publish
    Re-runs recompute_publishable for AZ.

Usage:
    python3 -u scrapers/az_adhs_inspections_ingest.py --mode discover --dry-run
    python3 -u scrapers/az_adhs_inspections_ingest.py --mode discover
    python3 -u scrapers/az_adhs_inspections_ingest.py --mode inspect --dry-run
    python3 -u scrapers/az_adhs_inspections_ingest.py --mode inspect
    python3 -u scrapers/az_adhs_inspections_ingest.py --mode deficiencies --dry-run --limit 20
    python3 -u scrapers/az_adhs_inspections_ingest.py --mode deficiencies
    python3 -u scrapers/az_adhs_inspections_ingest.py --mode deficiencies --offset 1000
    python3 -u scrapers/az_adhs_inspections_ingest.py --mode publish

PREREQUISITES:
    Migration 0053 and 0054 applied.
    az_adhs_directory_ingest.py run (AZ facilities in DB).
    inspect mode run (inspections in DB with sf_inspection_id in raw_data).
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from typing import Any
from uuid import UUID

import psycopg
import requests
from dotenv import load_dotenv

load_dotenv(".env.local")

DATABASE_URL = os.environ["DATABASE_URL"]
AURA_URL = "https://azcarecheck.azdhs.gov/s/sfsites/aura"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Referer": "https://azcarecheck.azdhs.gov/s/",
    "Origin": "https://azcarecheck.azdhs.gov",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
}

# ── Aura helpers ──────────────────────────────────────────────────────────────

def _aura_post(
    classname: str,
    method: str,
    params: dict[str, Any],
    cacheable: bool = False,
    page_uri: str = "/s/",
) -> Any:
    """Call an AZ Care Check Aura endpoint. Returns the returnValue payload."""
    import json
    payload = {
        "message": json.dumps({"actions": [{"id": "1;a",
            "descriptor": "aura://ApexActionController/ACTION$execute",
            "callingDescriptor": "UNKNOWN",
            "params": {
                "namespace": "", "classname": classname, "method": method,
                "params": params, "cacheable": cacheable, "isContinuation": False,
            }}]}),
        "aura.context": json.dumps({"mode": "PROD", "fwuid": "",
            "app": "siteforce:communityApp", "loaded": {}, "dn": [], "globals": {}, "uad": False}),
        "aura.pageURI": page_uri,
        "aura.token": "null",
    }
    resp = requests.post(
        f"{AURA_URL}?r=1&aura.ApexAction.execute=1",
        data=payload,
        headers=HEADERS,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    for action in data.get("actions", []):
        if action.get("state") == "SUCCESS":
            rv = action.get("returnValue", {})
            return rv.get("returnValue") if isinstance(rv, dict) else rv
        elif action.get("state") in ("ERROR", "INCOMPLETE"):
            msg = action.get("error", [{}])[0].get("message", "unknown")
            raise RuntimeError(f"Aura {classname}.{method} error: {msg}")
    return None


# ── Name normalizer ───────────────────────────────────────────────────────────

_STOP = re.compile(
    r"\b(llc|inc|corp|co|ltd|the|of|at|and|an|a|dba|aka|assisted|living|"
    r"home|center|care|house|manor|gardens|estates|villa|place|inn)\b",
    re.IGNORECASE,
)
_SPACE = re.compile(r"\s+")


def _norm(s: str) -> str:
    """Normalize a facility name for fuzzy matching."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.upper()
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    s = _STOP.sub(" ", s)
    s = _SPACE.sub(" ", s).strip()
    return s


# ── Mode: discover ────────────────────────────────────────────────────────────

def discover(dry_run: bool = False, limit: int | None = None) -> None:
    """
    Fetch all ALH/ALC from AZ Care Check, match to our facilities,
    write az_sf_account_id.
    """
    print("MODE: discover (AZ Care Check → az_sf_account_id)")

    # Pull both ALH and ALC from AZ Care Check
    sf_accounts: list[dict[str, Any]] = []
    for ftype in ("Assisted Living Home", "Assisted Living Center"):
        print(f"  Fetching {ftype}…")
        results = _aura_post(
            "AZCCMapService", "getAccountsMapData",
            params={
                "program": "Health Care",
                "programLabel": "Health Care Facilities",
                "facilityType": ftype,
                "facilityStatus": "Active",
                "licenseStatus": "Active",
                "searchQuery": "",
                "filterQueryParameters": '{"isEnforcement":false}',
            },
            cacheable=False,
        )
        if isinstance(results, list):
            sf_accounts.extend(results)
            print(f"    {len(results)} records")
        else:
            print(f"    unexpected response type: {type(results)}")

    print(f"Total SF accounts: {len(sf_accounts)}")
    if limit:
        sf_accounts = sf_accounts[:limit]
        print(f"  Limited to {limit}")

    # Build lookup: norm_name → sf_account
    sf_by_norm: dict[str, list[dict[str, Any]]] = {}
    for acct in sf_accounts:
        key = _norm(acct.get("facilityLegalName", ""))
        sf_by_norm.setdefault(key, []).append(acct)

    # Load AZ facilities from DB (with lat/lon for proximity matching)
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute("""
            SELECT id, name, city, street, latitude, longitude,
                   NULL::text AS az_sf_account_id
            FROM facilities
            WHERE state_code = 'AZ'
        """).fetchall()

    print(f"AZ facilities in DB: {len(rows)}")

    def _sf_latlon(acct: dict[str, Any]) -> tuple[float, float] | None:
        loc = acct.get("location") or {}
        try:
            la = float(loc.get("Latitude") or 0)
            lo = float(loc.get("Longitude") or 0)
            return (la, lo) if la != 0 else None
        except (TypeError, ValueError):
            return None

    def _latlon_dist_m(a: tuple[float, float], b: tuple[float, float]) -> float:
        import math
        R = 6_371_000
        lat1, lon1 = math.radians(a[0]), math.radians(a[1])
        lat2, lon2 = math.radians(b[0]), math.radians(b[1])
        dlat, dlon = lat2 - lat1, lon2 - lon1
        h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        return 2 * R * math.asin(math.sqrt(h))

    # Flat list of (latlon, acct) for proximity fallback
    sf_with_ll = [(ll, a) for a in sf_accounts if (ll := _sf_latlon(a))]

    matched = 0
    already = 0
    unmatched: list[tuple[str, str]] = []
    updates: list[tuple[str, UUID]] = []  # (sf_id, facility_id)

    for fac_id, name, city, street, lat, lon, existing_sf_id in rows:
        if existing_sf_id:
            already += 1
            continue

        fac_ll = (float(lat), float(lon)) if lat and lon else None
        norm_name = _norm(name or "")
        candidates = sf_by_norm.get(norm_name, [])

        if not candidates:
            # Broader prefix match within same city
            tokens = norm_name.split()[:3]
            prefix = " ".join(tokens)
            candidates = [
                v for k, vs in sf_by_norm.items()
                if k.startswith(prefix) and (city or "").upper() in (
                    v.get("location", {}).get("City", "").upper() for v in vs
                )
                for v in vs
            ]

        if len(candidates) == 1:
            updates.append((candidates[0]["facilityId"], fac_id))
            matched += 1
            continue

        if len(candidates) > 1:
            # Disambiguate by lat/lon proximity first
            if fac_ll:
                by_dist = sorted(
                    [(c, ll) for c in candidates if (ll := _sf_latlon(c))],
                    key=lambda x: _latlon_dist_m(fac_ll, x[1]),
                )
                if by_dist and _latlon_dist_m(fac_ll, by_dist[0][1]) < 200:
                    updates.append((by_dist[0][0]["facilityId"], fac_id))
                    matched += 1
                    continue
            # Fall back to city filter
            city_upper = (city or "").upper()
            city_m = [c for c in candidates
                      if (c.get("location") or {}).get("City", "").upper() == city_upper]
            if len(city_m) == 1:
                updates.append((city_m[0]["facilityId"], fac_id))
                matched += 1
                continue
            unmatched.append((name, city))
            continue

        # No name match — proximity fallback (within 100m)
        if fac_ll:
            by_dist = sorted(sf_with_ll, key=lambda x: _latlon_dist_m(fac_ll, x[0]))
            if by_dist and _latlon_dist_m(fac_ll, by_dist[0][0]) < 100:
                updates.append((by_dist[0][1]["facilityId"], fac_id))
                matched += 1
                continue

        unmatched.append((name, city))

    print(f"\nMatch results:")
    print(f"  Matched:  {matched}")
    print(f"  Already had SF ID: {already}")
    print(f"  Unmatched: {len(unmatched)}")
    if unmatched[:10]:
        print(f"  Sample unmatched:")
        for nm, ct in unmatched[:10]:
            print(f"    {nm!r}  ({ct})")

    if dry_run:
        print("\nDRY RUN — no writes.")
        return

    if not updates:
        print("Nothing to update.")
        return

    print(f"\nWriting {len(updates)} az_sf_account_id values…")
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.transaction():
            for sf_id, fac_id in updates:
                conn.execute(
                    "UPDATE facilities SET az_sf_account_id = %s WHERE id = %s",
                    (sf_id, fac_id),
                )
    print(f"Done. Wrote {len(updates)} SF account IDs.")


# ── Mode: inspect ─────────────────────────────────────────────────────────────

_INSP_UPSERT = """
INSERT INTO inspections (
    facility_id,
    inspection_date,
    inspection_type,
    is_complaint,
    complaint_id,
    total_deficiency_count,
    source_url,
    source_agency,
    narrative_summary,
    raw_data
)
VALUES (
    %(facility_id)s,
    %(inspection_date)s,
    %(inspection_type)s,
    %(is_complaint)s,
    %(complaint_id)s,
    %(total_deficiency_count)s,
    %(source_url)s,
    'AZ-ADHS',
    %(narrative_summary)s,
    %(raw_data)s::jsonb
)
ON CONFLICT (facility_id, inspection_date, inspection_type, COALESCE(source_agency, '')) DO UPDATE SET
    total_deficiency_count = EXCLUDED.total_deficiency_count,
    narrative_summary      = EXCLUDED.narrative_summary,
    raw_data               = EXCLUDED.raw_data,
    is_complaint           = EXCLUDED.is_complaint,
    complaint_id           = EXCLUDED.complaint_id,
    source_url             = EXCLUDED.source_url
RETURNING id
"""

_INSP_TYPES = {
    "Complaint": "complaint",
    "Compliance (Annual)": "routine",
    "Annual": "routine",
    "Licensure": "licensure",
    "Follow-Up": "follow_up",
    "Initial": "initial",
}


def _parse_insp_type(raw: str) -> str:
    for key, val in _INSP_TYPES.items():
        if key.lower() in raw.lower():
            return val
    return "other"


def _count_deficiencies(narrative: str | None) -> int:
    """
    Estimate deficiency count from the initialComments text.
    Returns 0 for 'No deficiencies were found' or empty.
    """
    if not narrative:
        return 0
    if re.search(r"no deficien", narrative, re.IGNORECASE):
        return 0
    # Count instances of regulation citation patterns like "A.A.C. § R9-10" or "9 A.A.C."
    citations = re.findall(r"A\.A\.C\.|§\s*R\d|9\s+A\.A\.C\.", narrative)
    if citations:
        return len(citations)
    # Fallback: count numbered items "1." "2." etc.
    numbered = re.findall(r"^\s*\d+\.\s", narrative, re.MULTILINE)
    return len(numbered) if numbered else (1 if narrative.strip() else 0)


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    # Handle ranges like "M/D/YYYY - M/D/YYYY" → take the start portion.
    # Split only on " - " (with surrounding spaces) so ISO dates like "2026-04-21"
    # are not accidentally truncated to "2026".
    if " - " in s:
        s = s.split(" - ")[0].strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return date.fromisoformat(s) if fmt == "%Y-%m-%d" else __import__("datetime").datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def inspect_mode(dry_run: bool = False, limit: int | None = None) -> None:
    """Fetch inspection history for all AZ facilities with az_sf_account_id."""
    import json
    print("MODE: inspect (getFacilityOrLicenseInspections → inspections table)", flush=True)

    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute("""
            SELECT id, name, az_sf_account_id
            FROM facilities
            WHERE state_code = 'AZ'
              AND az_sf_account_id IS NOT NULL
            ORDER BY name
        """).fetchall()

    if limit:
        rows = rows[:limit]

    print(f"Facilities with SF Account ID: {len(rows)}", flush=True)

    ok = err = skip = 0
    insp_total = 0

    # autocommit=True so each upsert is immediately visible and durable;
    # idempotent ON CONFLICT means re-runs are safe.
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        for i, (fac_id, name, sf_id) in enumerate(rows, 1):
            if i % 50 == 0:
                print(f"  {i}/{len(rows)}  ok={ok} err={err} skip={skip} insp={insp_total}", flush=True)
            try:
                records = _aura_post(
                    "AZCCInspectionHistoryController",
                    "getFacilityOrLicenseInspections",
                    params={"facilityId": sf_id, "licenseId": None},
                    cacheable=True,
                    page_uri=f"/s/facility-details?facilityId={sf_id}&activeTab=Inspections",
                )
                time.sleep(0.5)  # ~2 req/s

                if not records:
                    skip += 1
                    continue

                for rec in records:
                    insp_date = _parse_date(rec.get("inspectionStartDate") or rec.get("inspectionDates"))
                    if not insp_date:
                        continue

                    narrative = rec.get("initialComments") or ""
                    insp_type_raw = rec.get("inspectionType") or ""
                    insp_type = _parse_insp_type(insp_type_raw)
                    deficiency_count = _count_deficiencies(narrative)

                    row_data = {
                        "facility_id": fac_id,
                        "inspection_date": insp_date,
                        "inspection_type": insp_type,
                        "is_complaint": insp_type == "complaint",
                        "complaint_id": rec.get("inspectionName") if insp_type == "complaint" else None,
                        "total_deficiency_count": deficiency_count,
                        "source_url": f"https://azcarecheck.azdhs.gov/s/facility-details?facilityId={sf_id}&activeTab=Inspections",
                        "narrative_summary": narrative if narrative else None,
                        "raw_data": json.dumps({
                            "sf_inspection_id": rec.get("Id"),
                            "inspection_name": rec.get("inspectionName"),
                            "inspection_type_raw": insp_type_raw,
                            "certificate_number": rec.get("certificateNumber"),
                            "worksheet_type": rec.get("worksheetType"),
                            "sod_sent_date": rec.get("inspectionSODSentDate"),
                            "status": rec.get("inspectionStatus"),
                        }),
                    }

                    if not dry_run:
                        try:
                            conn.execute(_INSP_UPSERT, row_data)
                        except Exception as e:
                            insp_name = rec.get("inspectionName") or rec.get("Id")
                            print(f"  Upsert error for {name} / {insp_name}: {e}", flush=True)
                    insp_total += 1

                ok += 1
            except Exception as e:
                print(f"  Error for {name} (sf={sf_id}): {e}", flush=True)
                err += 1
                time.sleep(2)

    print(f"\nDone. facilities ok={ok} err={err} skip={skip}  inspections={insp_total}", flush=True)
    if dry_run:
        print("DRY RUN — no writes.")


# ── Mode: deficiencies ────────────────────────────────────────────────────────

# AAC rule code: "R9-10-810.B.1. Resident Rights\nB. A manager…"
#   → code="R9-10-810.B.1", category="Resident Rights"
_RULE_CODE_RE = re.compile(r"^(R[\d]+-[\d]+-[\w.]+)\.\s*(.+?)(?:\n|$)", re.MULTILINE)

# High-severity rule categories (abuse, neglect, exploitation, elopement)
_SEVERITY4_CATEGORY_RE = re.compile(
    r"\b(abuse|exploit|neglect|elopement|immediate.jeopardy)\b", re.IGNORECASE
)


def _parse_az_rule(rule_text: str) -> tuple[str | None, str | None]:
    """Extract (code, category) from the AZ Care Check rule column text."""
    m = _RULE_CODE_RE.search(rule_text)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return None, None


def _map_az_severity(
    rule_text: str, evidence: str, insp_status: str
) -> tuple[int, bool]:
    """Return (severity, immediate_jeopardy).

    Severity mapping:
      2  — baseline (standard deficiency)
      4  — Immediate Jeopardy, abuse/neglect/exploitation/elopement category,
            or Enforcement-status inspection
    """
    combined = (rule_text + " " + evidence).lower()
    ij = "immediate jeopardy" in combined
    is_high = (
        ij
        or (insp_status or "").lower() == "enforcement"
        or bool(_SEVERITY4_CATEGORY_RE.search(rule_text))
    )
    return (4 if is_high else 2), ij


def _scrape_deficiencies_page(
    page: Any,  # playwright.sync_api.Page
    sf_insp_id: str,
    sf_fac_id: str,
    insp_status: str,
    insp_date: date | None,
) -> list[dict[str, Any]]:
    """Render one inspection-details page and return parsed deficiency dicts."""
    url = (
        f"https://azcarecheck.azdhs.gov/s/inspection-details"
        f"?inspectionId={sf_insp_id}&facilityId={sf_fac_id}"
    )
    page.goto(url, wait_until="networkidle", timeout=60_000)
    try:
        page.wait_for_selector("[role='grid']", timeout=15_000)
    except Exception:
        return []  # no deficiency grid — 0 deficiencies

    rows = page.query_selector_all("[role='row']")
    deficiencies: list[dict[str, Any]] = []
    for row in rows[1:]:  # skip header row
        # Rule column lives in <th> within each data row (Salesforce layout)
        rule_text = ""
        for th in row.query_selector_all("th"):
            t = th.inner_text().strip()
            if t:
                rule_text = t
                break

        data_cells = row.query_selector_all("[role='gridcell']")
        evidence = data_cells[0].inner_text().strip() if len(data_cells) > 0 else ""
        poc = data_cells[2].inner_text().strip() if len(data_cells) > 2 else ""

        row_html = row.inner_html()
        is_repeat = bool(
            re.search(r"repeat\s*deficien|Repeat\s*Deficien", row_html, re.I)
        )

        severity, ij = _map_az_severity(rule_text, evidence, insp_status)
        code, category = _parse_az_rule(rule_text)

        if not (rule_text or evidence):
            continue

        deficiencies.append(
            {
                "code": code,
                "category": category,
                "description": rule_text or None,
                "inspector_narrative": evidence or None,
                "plan_of_correction": poc or None,
                "is_repeat": is_repeat,
                "severity": severity,
                "immediate_jeopardy": ij,
                "cited_date": insp_date,
                "state_severity_raw": insp_status or None,
                "status": "cited",
            }
        )
    return deficiencies


_DEF_INSERT = """
INSERT INTO deficiencies (
    inspection_id, code, category, description,
    inspector_narrative, plan_of_correction,
    is_repeat, severity, immediate_jeopardy,
    cited_date, state_severity_raw, status
) VALUES (
    %(inspection_id)s, %(code)s, %(category)s, %(description)s,
    %(inspector_narrative)s, %(plan_of_correction)s,
    %(is_repeat)s, %(severity)s, %(immediate_jeopardy)s,
    %(cited_date)s, %(state_severity_raw)s, %(status)s
)
"""


def _process_deficiency_batch(
    tasks: list[tuple[Any, ...]],  # (insp_id, fac_sf_id, sf_insp_id, status, insp_date, narrative)
    dry_run: bool,
    worker_id: int,
) -> tuple[int, int, int]:
    """Worker function: one Playwright browser + one DB connection per thread."""
    from playwright.sync_api import sync_playwright

    done = skip = err = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
            for insp_id, fac_sf_id, sf_insp_id, insp_status, insp_date, narrative in tasks:
                # Skip if narrative explicitly says no deficiencies
                if narrative and re.search(r"no deficien", narrative, re.IGNORECASE):
                    if not dry_run:
                        conn.execute(
                            "UPDATE inspections SET total_deficiency_count = 0 WHERE id = %s",
                            (insp_id,),
                        )
                    skip += 1
                    continue

                try:
                    defs = _scrape_deficiencies_page(
                        page, sf_insp_id, fac_sf_id, insp_status or "", insp_date
                    )
                    if not dry_run:
                        conn.execute(
                            "DELETE FROM deficiencies WHERE inspection_id = %s",
                            (insp_id,),
                        )
                        for d in defs:
                            conn.execute(_DEF_INSERT, {"inspection_id": insp_id, **d})
                        conn.execute(
                            "UPDATE inspections SET total_deficiency_count = %s WHERE id = %s",
                            (len(defs), insp_id),
                        )
                    done += 1
                except Exception as exc:
                    print(
                        f"  [worker {worker_id}] error insp={insp_id} sf={sf_insp_id}: {exc}",
                        flush=True,
                    )
                    err += 1

        browser.close()

    return done, skip, err


def deficiencies_mode(
    dry_run: bool = False,
    limit: int | None = None,
    offset: int = 0,
    workers: int = 3,
) -> None:
    """Backfill per-deficiency rows for all AZ inspections."""
    import json, math

    print(
        f"MODE: deficiencies  offset={offset} limit={limit} workers={workers} dry_run={dry_run}",
        flush=True,
    )

    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            """
            SELECT i.id,
                   f.az_sf_account_id,
                   i.raw_data->>'sf_inspection_id',
                   i.raw_data->>'status',
                   i.inspection_date,
                   i.narrative_summary
            FROM inspections i
            JOIN facilities f ON f.id = i.facility_id
            WHERE f.state_code = 'AZ'
              AND i.raw_data->>'sf_inspection_id' IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM deficiencies d WHERE d.inspection_id = i.id
              )
            ORDER BY i.inspection_date DESC
            OFFSET %s
            """,
            (offset,),
        ).fetchall()

    if limit:
        rows = rows[:limit]

    total = len(rows)
    print(f"Inspections to process: {total}", flush=True)
    if not total:
        print("Nothing to do.")
        return

    # Split into per-worker batches
    batch_size = math.ceil(total / workers)
    batches = [rows[i : i + batch_size] for i in range(0, total, batch_size)]

    total_done = total_skip = total_err = 0

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(_process_deficiency_batch, batch, dry_run, wid): wid
            for wid, batch in enumerate(batches)
        }
        for future in as_completed(futures):
            wid = futures[future]
            try:
                done, skip, err = future.result()
                total_done += done
                total_skip += skip
                total_err += err
                print(
                    f"  worker {wid} done  scraped={done} skipped={skip} err={err}",
                    flush=True,
                )
            except Exception as exc:
                print(f"  worker {wid} crashed: {exc}", flush=True)

    print(
        f"\nDone.  scraped={total_done}  skipped(no-deficien)={total_skip}  err={total_err}",
        flush=True,
    )
    if dry_run:
        print("DRY RUN — no writes.")


# ── Mode: publish ─────────────────────────────────────────────────────────────

def publish_mode() -> None:
    """Re-run recompute_publishable for AZ."""
    import subprocess
    result = subprocess.run(
        [sys.executable, "-u", "scrapers/recompute_publishable.py", "--state", "AZ"],
        capture_output=False,
    )
    sys.exit(result.returncode)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="AZ Care Check inspection ingest")
    parser.add_argument(
        "--mode", required=True,
        choices=["discover", "inspect", "deficiencies", "publish"],
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--workers", type=int, default=3,
                        help="Parallel Playwright workers (deficiencies mode only)")
    args = parser.parse_args()

    if args.mode == "discover":
        discover(dry_run=args.dry_run, limit=args.limit)
    elif args.mode == "inspect":
        inspect_mode(dry_run=args.dry_run, limit=args.limit)
    elif args.mode == "deficiencies":
        deficiencies_mode(
            dry_run=args.dry_run,
            limit=args.limit,
            offset=args.offset,
            workers=args.workers,
        )
    elif args.mode == "publish":
        publish_mode()


if __name__ == "__main__":
    main()
