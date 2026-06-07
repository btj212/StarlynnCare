#!/usr/bin/env python3
"""
Minnesota DHS Assisted Living Report Card — ALDC roster scraper.

Alternative to the MDH bulk download (mdhprovidercontent.web.health.state.mn.us)
when that server is unavailable.

Fetches all Minnesota counties via the ALRC search, downloads the Excel results,
and saves ALDC-only rows to .firecrawl/mn-scrape/mn-alrc-YYYY-MM-DD.xlsx.

The ALRC site (alreportcard.dhs.mn.gov) is a DHS-operated .NET/Razor Pages app
with standard anti-forgery tokens. The flow:
  1. GET /Search → session cookies + CSRF token
  2. POST /Search?handler=Geo (all 87 MN counties) → populates session results
  3. POST /Search?handler=DownLoadExcelResultsList → downloads Excel

The Excel License column contains "Approved for dementia care" / "New for dementia
care" for ALDC facilities, vs "Approved" / "New" for standard ALFs.

Usage:
  python3 scrapers/mn_alrc_scrape.py
  python3 scrapers/mn_alrc_scrape.py --out-dir .firecrawl/mn-scrape
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import make_session, polite_sleep

BASE_URL = "https://alreportcard.dhs.mn.gov"
# MN has 87 counties; IDs 1–87 in the ALRC dropdown
MN_COUNTY_IDS = list(range(1, 88))


def _get_csrf_token(html: str) -> str:
    """Extract the first anti-forgery token from page HTML."""
    matches = re.findall(
        r'name="__RequestVerificationToken"[^>]+value="([^"]+)"', html
    )
    if not matches:
        raise ValueError("No CSRF token found in page HTML")
    return matches[0]


def parse_addresses_from_html(html: str) -> list[dict]:
    """Extract facility name, street, city, zip, alrc_id from Google Maps contentStrings."""
    pattern = re.compile(
        r"contentString\s*=\s*\"<b>([^<]+)</b><br>([^<]+)<br>([^,]+),\s*MN\s+(\d{5})[^\"]*"
        r"name='FacIdNum' value='(\d+)'"
    )
    records = []
    for m in pattern.finditer(html):
        records.append({
            "alrc_id": int(m.group(5)),
            "name": m.group(1).strip(),
            "street": m.group(2).strip(),
            "city": m.group(3).strip(),
            "zip": m.group(4),
            "state": "MN",
        })
    return records


def parse_facilities_from_html(html: str) -> list[dict]:
    """Extract facility data including ALRC ID from table rows."""
    import json as _json

    tr_pattern = re.compile(r"<tr[^>]*>.*?</tr>", re.DOTALL)
    fac_id_re = re.compile(r'name="FacIdNum"\s+value="(\d+)"')
    name_re = re.compile(r'type="submit"[^>]+value="([^"]+)"')
    td_re = re.compile(r"<td[^>]*>(.*?)</td>", re.DOTALL)

    records = []
    for tr in tr_pattern.finditer(html):
        tr_text = tr.group(0)
        fac_id_m = fac_id_re.search(tr_text)
        if not fac_id_m:
            continue
        alrc_id = int(fac_id_m.group(1))
        name_m = name_re.search(tr_text)
        name = name_m.group(1) if name_m else ""
        tds = td_re.findall(tr_text)
        city = re.sub(r"<[^>]+>", "", tds[1]).strip() if len(tds) > 1 else ""
        lic_text = re.sub(r"<[^>]+>", "", tds[2]).strip() if len(tds) > 2 else ""
        cap_m = re.search(r'<td[^>]*align="center"[^>]*>(\d+)</td>', tr_text)
        capacity = int(cap_m.group(1)) if cap_m else None
        records.append({
            "alrc_id": alrc_id,
            "name": name,
            "city": city,
            "license_status": lic_text,
            "capacity": capacity,
            "is_aldc": "dementia" in lic_text.lower(),
        })
    return records


def download_alrc_excel(out_dir: Path) -> Path:
    """Run the 3-step ALRC flow and return path to saved Excel file."""
    sess = make_session()

    # Step 1: Load Search page — establishes session + gets CSRF token
    print("  GET /Search (establishing session)…")
    r1 = sess.get(f"{BASE_URL}/Search")
    r1.raise_for_status()
    token1 = _get_csrf_token(r1.text)

    polite_sleep(1.0)

    # Step 2: POST to Geo handler with all 87 MN counties
    print(f"  POST /Search?handler=Geo ({len(MN_COUNTY_IDS)} counties)…")
    payload: list[tuple[str, str]] = [
        ("__RequestVerificationToken", token1),
        ("LocationSource", "county"),
        ("Miles", "0"),
        ("CityOrZip", ""),
    ]
    for cid in MN_COUNTY_IDS:
        payload.append(("SelectedCounties", str(cid)))

    r2 = sess.post(
        f"{BASE_URL}/Search?handler=Geo",
        data=payload,
        headers={"Referer": f"{BASE_URL}/Search"},
    )
    r2.raise_for_status()
    print(f"  Response size: {len(r2.content):,} bytes")
    token2 = _get_csrf_token(r2.text)

    # Save enriched HTML (contains Google Maps markers with addresses + facility IDs)
    html_path = out_dir / f"mn-alrc-geo-{date.today().isoformat()}.html"
    html_path.write_bytes(r2.content)
    print(f"  Saved HTML → {html_path}")

    # Parse and save address JSON
    import json as _json  # noqa: PLC0415
    addrs = parse_addresses_from_html(r2.text)
    addr_path = out_dir / f"mn-alrc-addresses-{date.today().isoformat()}.json"
    addr_path.write_text(_json.dumps(addrs, indent=2))
    print(f"  Saved {len(addrs)} address records → {addr_path}")

    # Parse and save facility JSON (with ALRC IDs and is_aldc flag)
    facs = parse_facilities_from_html(r2.text)
    fac_path = out_dir / f"mn-alrc-facilities-{date.today().isoformat()}.json"
    fac_path.write_text(_json.dumps(facs, indent=2))
    aldc_count = sum(1 for f in facs if f["is_aldc"])
    print(f"  Saved {len(facs)} facility records ({aldc_count} ALDC) → {fac_path}")

    polite_sleep(1.0)

    # Step 3: Download Excel of current session results
    print("  POST /Search?handler=DownLoadExcelResultsList…")
    r3 = sess.post(
        f"{BASE_URL}/Search?handler=DownLoadExcelResultsList",
        data={"__RequestVerificationToken": token2},
        headers={"Referer": f"{BASE_URL}/Search"},
    )
    r3.raise_for_status()

    content_type = r3.headers.get("content-type", "")
    if "spreadsheetml" not in content_type and len(r3.content) < 10_000:
        raise ValueError(
            f"Unexpected response (content-type={content_type!r}, "
            f"size={len(r3.content)}): {r3.text[:200]}"
        )

    out_path = out_dir / f"mn-alrc-{date.today().isoformat()}.xlsx"
    out_path.write_bytes(r3.content)
    print(f"  Saved {len(r3.content):,} bytes → {out_path}")
    return out_path


def filter_aldc_rows(xlsx_path: Path) -> int:
    """Print a summary of ALDC vs total rows in the downloaded Excel."""
    try:
        import openpyxl  # noqa: PLC0415
    except ImportError:
        print("  [skip] openpyxl not installed — cannot count ALDC rows")
        return -1

    wb = openpyxl.load_workbook(xlsx_path)
    ws = wb.active
    total = 0
    aldc = 0
    for row in ws.iter_rows(min_row=4, values_only=True):
        if not row[0]:
            continue
        total += 1
        lic = str(row[4] or "").lower()
        if "dementia" in lic:
            aldc += 1
    print(f"  Excel summary: {total} total ALFs, {aldc} ALDC ('dementia care' license)")
    return aldc


def main() -> int:
    ap = argparse.ArgumentParser(description="MN DHS ALRC — ALDC Excel download")
    ap.add_argument("--out-dir", type=Path,
                    default=REPO_ROOT / ".firecrawl" / "mn-scrape")
    args = ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    try:
        xlsx = download_alrc_excel(args.out_dir)
        filter_aldc_rows(xlsx)
        print(f"\nDone. Next step:")
        print(f"  python3 scrapers/mn_alrc_ingest.py --input {xlsx}")
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
