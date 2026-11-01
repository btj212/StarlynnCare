#!/usr/bin/env python3
"""Pull the current public Illinois LLCS assisted-living roster.

The facility lookup at llcs.dph.illinois.gov is a Salesforce Experience Cloud
page. A non-JavaScript fetch only sees the shell. The same guest session the
page uses answers two calls:

  FacilitySearchLookupHomePage.getFaciliyResult
      county + "Assisted Living/Shared Housing Establishment"
  RecordUi.getRecordUis
      Alzheimer's Special Care Program, facility id, status, address
  LLCS_LicensePageUnauth.getLicenseResult
      current licId, effective date, and expiration

This writes a JSON file. It does not insert facilities. The 2021 open-data
file is not a source. Inactive rows stay in the file and are labeled inactive.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "scrapers" / "data" / "il_llcs"
AURA = "https://llcs.dph.illinois.gov/s/sfsites/aura"
FWUID = "ZVYtV2g3NHN0UGNVNzBMbldfZ0ZwZ2tVMjdnTGFERUU2S3FfSVdrcU92bkExNS4zLjE2MDEw"
APP_LOADED = "1897_Qx6CsUG7r803A_23Hon_1g"
FACILITY_TYPE = "Assisted Living/Shared Housing Establishment"
PAGE_URI = "/s/facility-lookup?language=en_US"

COUNTIES = [
    "Adams", "Alexander", "Blair", "Bond", "Boone", "Brown", "Bureau", "Calhoun",
    "Carroll", "Cass", "Champaign", "Christian", "Clark", "Clay", "Clinton", "Coles",
    "Cook", "Crawford", "Cumberland", "DeKalb", "DeWitt", "Douglas", "DuPage", "Edgar",
    "Edwards", "Effingham", "Fayette", "Ford", "Franklin", "Fulton", "Gallatin",
    "Greene", "Grundy", "Hamilton", "Hancock", "Hardin", "Henderson", "Henry",
    "Iroquois", "Jackson", "Jasper", "Jefferson", "Jersey", "Jo Daviess", "Johnson",
    "Kane", "Kankakee", "Kendall", "Knox", "Lake", "LaSalle", "Lawrence", "Lee",
    "Livingston", "Logan", "Macon", "Macoupin", "Madison", "Marion", "Marshall",
    "Mason", "Massac", "McDonough", "McHenry", "McLean", "Menard", "Mercer", "Monroe",
    "Montgomery", "Morgan", "Moultrie", "Ogle", "Peoria", "Perry", "Piatt", "Pike",
    "Pope", "Pulaski", "Putnam", "Randolph", "Richland", "Rock Island", "Saint Clair",
    "Saline", "Sangamon", "Schuyler", "Scott", "Shelby", "Stark", "Stephenson",
    "Tazewell", "Union", "Vermilion", "Wabash", "Warren", "Washington", "Wayne",
    "White", "Whiteside", "Will", "Williamson", "Winnebago", "Woodford",
]

DETAIL_FIELDS = [
    "LLCS_Facility__c.Name",
    "LLCS_Facility__c.LLCS_Facility_ID__c",
    "LLCS_Facility__c.LLCS_Facility_ExternalID__c",
    "LLCS_Facility__c.LLCS_Facility_Status__c",
    "LLCS_Facility__c.LLCS_FacilityTypePick__c",
    "LLCS_Facility__c.LLCS_Alzheimer_s_Special_Care_Program__c",
    "LLCS_Facility__c.LLCS_Total_Number_of_Alzheimer_s_Units__c",
    "LLCS_Facility__c.LLCS_Total_number_of_AL_SH_units__c",
    "LLCS_Facility__c.LLCS_Street_Address__c",
    "LLCS_Facility__c.LLCS_City__c",
    "LLCS_Facility__c.LLCS_State__c",
    "LLCS_Facility__c.LLCS_Zip_Code__c",
    "LLCS_Facility__c.LLCS_Fac_County__c",
    "LLCS_Facility__c.LLCS_Facility_Telephone_Number__c",
    "LLCS_Facility__c.LLCS_Administrator__c",
]

LETTERS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]


def aura(session: requests.Session, descriptor: str, params: dict[str, Any]) -> dict[str, Any]:
    ctx = {
        "mode": "PROD",
        "fwuid": FWUID,
        "app": "siteforce:communityApp",
        "loaded": {"APPLICATION@markup://siteforce:communityApp": APP_LOADED},
        "dn": [],
        "globals": {},
        "uad": True,
    }
    message = {
        "actions": [{
            "id": "1;a",
            "descriptor": descriptor,
            "callingDescriptor": "UNKNOWN",
            "params": params,
        }]
    }
    response = session.post(
        AURA,
        data={
            "message": json.dumps(message),
            "aura.context": json.dumps(ctx),
            "aura.pageURI": PAGE_URI,
            "aura.token": "null",
        },
        timeout=90,
    )
    response.raise_for_status()
    payload = response.json()
    action = payload["actions"][0]
    if action.get("state") != "SUCCESS":
        raise RuntimeError(json.dumps(action.get("error"))[:500])
    return action["returnValue"]


def search_county(session: requests.Session, county: str, name: str = "") -> list[dict[str, Any]]:
    wrapper = {
        "cityWrap": "",
        "countyWrap": [county],
        "facilityAddressWrap": json.dumps({"street": "", "city": "", "state": "", "zip": ""}),
        "facilityNameWrap": name,
        "facilityTypeWrap": FACILITY_TYPE,
        "zipCodeWrap": "",
    }
    returned = aura(
        session,
        "aura://ApexActionController/ACTION$execute",
        {
            "namespace": "",
            "classname": "FacilitySearchLookupHomePage",
            "method": "getFaciliyResult",
            "params": {"facilityWrapper": wrapper},
            "cacheable": False,
            "isContinuation": False,
        },
    )
    rows = (returned.get("returnValue") or {}).get("facilityResult") or []
    return rows


def search_county_resilient(session: requests.Session, county: str) -> list[dict[str, Any]]:
    try:
        return search_county(session, county)
    except RuntimeError as exc:
        print(f"  {county} full search failed ({exc}); splitting by name", flush=True)
    found: dict[str, dict[str, Any]] = {}
    for letter in LETTERS:
        try:
            rows = search_county(session, county, letter)
        except RuntimeError as exc:
            print(f"  {county} prefix {letter} failed: {exc}", flush=True)
            continue
        for row in rows:
            found[row["Id"]] = row
        time.sleep(0.15)
    return list(found.values())


def fetch_details(session: requests.Session, ids: list[str]) -> dict[str, dict[str, Any]]:
    returned = aura(
        session,
        "aura://RecordUiController/ACTION$getRecordUis",
        {
            "recordIds": ids,
            "layoutTypes": ["Compact"],
            "modes": ["View"],
            "optionalFields": DETAIL_FIELDS,
        },
    )
    records = returned.get("records") or {}
    out: dict[str, dict[str, Any]] = {}
    for record_id, rec in records.items():
        fields = rec.get("fields") or {}
        flat: dict[str, Any] = {"salesforce_id": record_id}
        for key, value in fields.items():
            flat[key] = value.get("displayValue") if value.get("displayValue") is not None else value.get("value")
        out[record_id] = flat
    return out


def fetch_license(session: requests.Session, record_id: str) -> dict[str, Any] | None:
    returned = aura(
        session,
        "aura://ApexActionController/ACTION$execute",
        {
            "namespace": "",
            "classname": "LLCS_LicensePageUnauth",
            "method": "getLicenseResult",
            "params": {"objectApiName": "LLCS_Facility__c", "recordId": record_id},
            "cacheable": False,
            "isContinuation": False,
        },
    )
    rows = returned.get("returnValue") or []
    if not rows:
        return None
    row = rows[0]
    licenses = row.get("licenseList") or []
    current = None
    for item in licenses:
        if str(item.get("status") or "").lower() == "active":
            current = item
            break
    if current is None and licenses:
        current = licenses[0]
    if current is None:
        return {"licId": row.get("licId"), "licensee_name": row.get("accName")}
    return {
        "licId": row.get("licId"),
        "licensee_name": row.get("accName"),
        "effective_date": current.get("effectiveDate"),
        "expiration_date": current.get("expirationDate"),
        "license_status": current.get("status"),
        "facility_type": current.get("facilityType"),
        "units": current.get("facilityUnit") or [],
    }


def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--county", action="append", default=[])
    parser.add_argument("--skip-licenses", action="store_true")
    parser.add_argument("--out", default="")
    args = parser.parse_args()
    counties = args.county or COUNTIES

    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (compatible; StarlynnCare/1.0; +https://www.starlynncare.com)",
        "Referer": "https://llcs.dph.illinois.gov/s/facility-lookup?language=en_US",
    })

    by_id: dict[str, dict[str, Any]] = {}
    for county in counties:
        rows = search_county_resilient(session, county)
        for row in rows:
            by_id[row["Id"]] = row
        print(f"{county}: {len(rows)} search rows, {len(by_id)} unique", flush=True)
        time.sleep(0.2)

    ids = list(by_id)
    details: dict[str, dict[str, Any]] = {}
    for batch in chunked(ids, 15):
        try:
            details.update(fetch_details(session, batch))
        except RuntimeError as exc:
            print(f"  detail batch failed ({exc}); retrying one by one", flush=True)
            for record_id in batch:
                try:
                    details.update(fetch_details(session, [record_id]))
                except RuntimeError as one_exc:
                    print(f"  detail {record_id} failed: {one_exc}", flush=True)
                time.sleep(0.15)
        time.sleep(0.2)
    print(f"details: {len(details)} of {len(ids)}", flush=True)

    facilities = []
    for record_id, search_row in by_id.items():
        detail = details.get(record_id, {})
        facilities.append({
            "salesforce_id": record_id,
            "name": detail.get("Name") or search_row.get("Name"),
            "facility_id": detail.get("LLCS_Facility_ID__c"),
            "external_id": detail.get("LLCS_Facility_ExternalID__c"),
            "status": detail.get("LLCS_Facility_Status__c"),
            "facility_type": detail.get("LLCS_FacilityTypePick__c") or search_row.get("LLCS_FacilityType__c"),
            "alzheimer_special_care_program": detail.get("LLCS_Alzheimer_s_Special_Care_Program__c"),
            "alzheimer_units": detail.get("LLCS_Total_Number_of_Alzheimer_s_Units__c"),
            "al_sh_units": detail.get("LLCS_Total_number_of_AL_SH_units__c"),
            "street": detail.get("LLCS_Street_Address__c") or search_row.get("LLCS_Street_Address__c"),
            "city": detail.get("LLCS_City__c") or search_row.get("LLCS_City__c"),
            "state": detail.get("LLCS_State__c") or search_row.get("LLCS_State__c"),
            "zip": detail.get("LLCS_Zip_Code__c"),
            "county": detail.get("LLCS_Fac_County__c") or search_row.get("LLCS_Fac_County__c"),
            "phone": detail.get("LLCS_Facility_Telephone_Number__c") or search_row.get("LLCS_Facility_Telephone_Number__c"),
            "administrator": detail.get("LLCS_Administrator__c"),
            "portal_url": f"https://llcs.dph.illinois.gov/s/llcs-facility/{record_id}?language=en_US",
            "lookup_url": "https://llcs.dph.illinois.gov/s/facility-lookup?language=en_US",
        })

    if not args.skip_licenses:
        licensed = 0
        for row in facilities:
            status = str(row.get("status") or "")
            if status.lower() != "active":
                continue
            try:
                row["license"] = fetch_license(session, row["salesforce_id"])
                licensed += 1
            except RuntimeError as exc:
                row["license_error"] = str(exc)[:300]
            if licensed % 25 == 0:
                print(f"licenses: {licensed}", flush=True)
            time.sleep(0.15)
        print(f"licenses fetched: {licensed}", flush=True)

    active = [row for row in facilities if str(row.get("status") or "").lower() == "active"]
    program_yes = [
        row for row in active
        if str(row.get("alzheimer_special_care_program") or "").lower() == "yes"
    ]
    summary = {
        "source": "https://llcs.dph.illinois.gov/s/facility-lookup?language=en_US",
        "facility_type": FACILITY_TYPE,
        "search_rows": len(facilities),
        "active": len(active),
        "alzheimer_special_care_program_yes": len(program_yes),
        "alzheimer_special_care_program_no": sum(
            1 for row in active
            if str(row.get("alzheimer_special_care_program") or "").lower() == "no"
        ),
        "program_blank": sum(
            1 for row in active if not row.get("alzheimer_special_care_program")
        ),
        "inactive_or_other": len(facilities) - len(active),
    }
    payload = {"summary": summary, "facilities": facilities}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = Path(args.out) if args.out else OUT_DIR / "live-roster.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(summary), flush=True)
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"roster pull failed: {exc}", file=sys.stderr)
        raise
