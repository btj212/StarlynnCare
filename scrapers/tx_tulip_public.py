#!/usr/bin/env python3
"""Public Texas HHSC TULIP guest API — search by license, parse visits and penalties.

Verified 2026-11-27 against the live portal. The page still loads a reCAPTCHA
script, but these guest Aura methods answer with ``aura.token=null``.

Endpoints
---------
Search page
    GET https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-search
Detail page (source URL stored on each inspection)
    https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-detail?c__accountidparam=<Account Id>
Aura
    POST https://tulip.hhs.texas.gov/TULIP/s/sfsites/aura?r=1&aura.ApexAction.execute=1

Methods
-------
``RS_LTCProviderController.searchAccounts``
    licenseNumber, programType="Assisted Living Facilities", plus empty
    serviceType / facilityName / postalCode / city / counties / pageNumber / isClosed.
    Rows use ``LIcense_Number__c`` (capital I) and ``Id`` (Salesforce Account Id).
    The Account Id is not the license number and is not stable across HHSC
    re-keys. Match on the license field.

``RS4_LTCSearchResultHandler.retrieveInspectionsInfo``  params ``{accId}``
    ``visitType`` ``yesData`` means a comprehensive visit with no violation
    rows. ``mostRecentExitDate`` ("October 02, 2015") is the visit date when
    HHSC sends one. ``noData`` means the tab has no visit. When HHSC does
    return rows, ``visitType`` is ``Health Visit`` or ``Life Safety Code`` /
    ``Life Safty Code``, with ``exitDate``, ``correctedDate``, and
    ``stateViolationCited``.

``RS4_LTCSearchResultHandler.retrieveRSEventForEnfAction``  params ``{accId}``
    Enforcement the portal still publishes as citations: ``action``,
    ``imposedDate``, ``imposedAmount``, ``rsEventId``, ``penaltyWrapperLst[]``
    of ``regulationCited`` and ``stateValCited``.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any

import requests

from tx_inspections_ingest import pad_license_tx
from tx_tulip_to_bundle import _parse_long_date, parse_us_date

SEARCH_PAGE = "https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-search"
AURA_URL = "https://tulip.hhs.texas.gov/TULIP/s/sfsites/aura"
DETAIL_URL = (
    "https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-detail?c__accountidparam={account_id}"
)
USER_AGENT = "Mozilla/5.0 (compatible; StarlynnCare-research/1.0; +https://starlynncare.com)"
PROGRAM_TYPE_ALF = "Assisted Living Facilities"
SEARCH_CLASS = "RS_LTCProviderController"
SEARCH_METHOD = "searchAccounts"
DETAIL_CLASS = "RS4_LTCSearchResultHandler"
INSPECTIONS_METHOD = "retrieveInspectionsInfo"
ENFORCEMENT_METHOD = "retrieveRSEventForEnfAction"

_FWUID_RE = re.compile(r'fwuid(?:%22%3A%22|":")([A-Za-z0-9]+)')
_LOADED_RE = re.compile(r"(1919_p_[A-Za-z0-9]+)")


def detail_url(account_id: str) -> str:
    return DETAIL_URL.format(account_id=account_id)


def read_aura_context(html: str) -> tuple[str, str]:
    """Pull fwuid and the communityApp loaded hash out of the search-page HTML."""
    fwuid = _FWUID_RE.search(html or "")
    loaded = _LOADED_RE.search(html or "")
    if not fwuid or not loaded:
        raise RuntimeError("TULIP search page did not include the Aura fwuid.")
    return fwuid.group(1), loaded.group(1)


def license_from_search_hit(hit: dict[str, Any]) -> str | None:
    """License on a searchAccounts row. Never the Salesforce Account Id."""
    raw = hit.get("LIcense_Number__c")
    if raw is None:
        raw = hit.get("License_Number__c")
    if raw is None or str(raw).strip() == "":
        return None
    return pad_license_tx(raw)


def pick_search_hit(
    hits: list[dict[str, Any]] | None,
    license_number: str,
) -> dict[str, Any] | None:
    """Keep the row whose license equals this facility. Prefer LICENSED."""
    want = pad_license_tx(license_number)
    matches = [hit for hit in (hits or []) if license_from_search_hit(hit) == want]
    if not matches:
        return None
    for hit in matches:
        if str(hit.get("License_Status__c") or "").upper() == "LICENSED":
            return hit
    return matches[0]


def _date_any(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return parse_us_date(text) or _parse_long_date(text)


def _money(value: Any) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(str(value).replace(",", "").replace("$", ""))
    except ValueError:
        return None


def parse_inspection_payload(
    rows: list[dict[str, Any]] | None,
    account_id: str,
) -> list[dict[str, Any]]:
    """Turn retrieveInspectionsInfo rows into inspection dicts.

    A ``yesData`` sentinel with ``mostRecentExitDate`` is one comprehensive
    visit and zero citations — that is what the public page prints. ``noData``,
    and ``yesData`` with no date, produce no inspection. Violation rows, when
    HHSC sends them, become one inspection per exit date and visit type.
    """
    source = detail_url(account_id)
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    header: str | None = None
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        visit_type = str(row.get("visitType") or "").strip()
        if visit_type == "noData" or not visit_type:
            continue
        if row.get("mostRecentExitDate"):
            header = header or _date_any(row.get("mostRecentExitDate"))
        if visit_type == "yesData":
            continue
        exit_date = _date_any(row.get("exitDate"))
        if not exit_date:
            continue
        grouped.setdefault((exit_date, visit_type), []).append(row)

    inspections: list[dict[str, Any]] = []
    dates: set[str] = set()
    for (exit_date, visit_type), items in sorted(grouped.items(), reverse=True):
        deficiencies = []
        for item in items:
            narrative = str(item.get("stateViolationCited") or "").strip()
            deficiencies.append(
                {
                    "code": None,
                    "state_severity_raw": visit_type,
                    "description": narrative or None,
                    "inspector_narrative": narrative or None,
                    "cited_date": exit_date,
                    "corrected_date": _date_any(item.get("correctedDate")),
                    "immediate_jeopardy": False,
                }
            )
        inspections.append(
            {
                "inspection_date": exit_date,
                "inspection_type": visit_type,
                "is_complaint": "complaint" in visit_type.lower(),
                "source_url": source,
                "source_event_id": f"tulip-visit:{account_id}:{exit_date}:{visit_type}",
                "total_deficiency_count": len(deficiencies),
                "civil_money_penalty_total": None,
                "deficiencies": deficiencies,
                "raw_data": {
                    "tulip_account_id": account_id,
                    "method": INSPECTIONS_METHOD,
                    "items": items,
                },
            }
        )
        dates.add(exit_date)

    if header and header not in dates:
        inspections.append(
            {
                "inspection_date": header,
                "inspection_type": "comprehensive",
                "is_complaint": False,
                "source_url": source,
                "source_event_id": f"tulip-header:{account_id}:{header}",
                "total_deficiency_count": 0,
                "civil_money_penalty_total": None,
                "deficiencies": [],
                "raw_data": {
                    "tulip_account_id": account_id,
                    "method": INSPECTIONS_METHOD,
                    "synthesized_from": "mostRecentExitDate",
                    "mostRecentExitDate": header,
                    "note": (
                        "TULIP reported this comprehensive visit and did not "
                        "return violation rows for it."
                    ),
                },
            }
        )
    return inspections


def parse_enforcement_payload(
    rows: list[dict[str, Any]] | None,
    account_id: str,
) -> list[dict[str, Any]]:
    """Turn retrieveRSEventForEnfAction rows into dated citation records.

    The public inspections tab is not currently returning violation lines.
    The enforcement tab is where HHSC still publishes a date, a rule, and
    the citation text. ``inspection_type`` stays the portal's ``action``
    (for example "Administrative Penalty"), so a penalty is not labeled as
    a health survey.
    """
    source = detail_url(account_id)
    inspections: list[dict[str, Any]] = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        imposed = _date_any(row.get("imposedDate"))
        if not imposed:
            continue
        action = str(row.get("action") or "enforcement").strip() or "enforcement"
        penalties = row.get("penaltyWrapperLst") or []
        if not isinstance(penalties, list):
            penalties = []
        deficiencies = []
        for penalty in penalties:
            if not isinstance(penalty, dict):
                continue
            rule = str(penalty.get("regulationCited") or "").strip()
            narrative = str(penalty.get("stateValCited") or "").strip()
            deficiencies.append(
                {
                    "code": rule or None,
                    "category": action,
                    "state_severity_raw": action,
                    "description": narrative or rule or None,
                    "inspector_narrative": narrative or None,
                    "cited_date": imposed,
                    "corrected_date": None,
                    "immediate_jeopardy": False,
                }
            )
        event_id = row.get("rsEventId") or row.get("name")
        inspections.append(
            {
                "inspection_date": imposed,
                "inspection_type": action,
                "is_complaint": False,
                "source_url": source,
                "source_event_id": str(event_id) if event_id else None,
                "total_deficiency_count": len(deficiencies),
                "civil_money_penalty_total": _money(row.get("imposedAmount")),
                "deficiencies": deficiencies,
                "raw_data": {
                    "tulip_account_id": account_id,
                    "method": ENFORCEMENT_METHOD,
                    "event_name": row.get("name"),
                    "imposed_amount": row.get("imposedAmount"),
                    "agency_name": row.get("agenyName"),
                },
            }
        )
    return inspections


class TulipClient:
    """One guest session. ``open()`` reads fwuid from the live search page."""

    def __init__(self, delay: float = 0.0, session: requests.Session | None = None) -> None:
        self.delay = delay
        self.session = session or requests.Session()
        self.session.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Origin": "https://tulip.hhs.texas.gov",
                "Referer": SEARCH_PAGE,
            }
        )
        self.fwuid: str | None = None
        self.loaded: str | None = None

    def open(self) -> None:
        response = self.session.get(SEARCH_PAGE, timeout=45)
        response.raise_for_status()
        self.fwuid, self.loaded = read_aura_context(response.text)

    def _call(self, classname: str, method: str, params: dict[str, Any], page_uri: str) -> Any:
        if not self.fwuid or not self.loaded:
            raise RuntimeError("Call TulipClient.open() before fetching.")
        if self.delay:
            time.sleep(self.delay)
        message = {
            "actions": [
                {
                    "id": "1;a",
                    "descriptor": "aura://ApexActionController/ACTION$execute",
                    "callingDescriptor": "UNKNOWN",
                    "params": {
                        "namespace": "",
                        "classname": classname,
                        "method": method,
                        "params": params,
                        "cacheable": False,
                        "isContinuation": False,
                    },
                }
            ]
        }
        context = {
            "mode": "PROD",
            "fwuid": self.fwuid,
            "app": "siteforce:communityApp",
            "loaded": {"APPLICATION@markup://siteforce:communityApp": self.loaded},
            "dn": [],
            "globals": {},
            "uad": True,
        }
        response = self.session.post(
            f"{AURA_URL}?r=1&aura.ApexAction.execute=1",
            data={
                "message": json.dumps(message),
                "aura.context": json.dumps(context),
                "aura.pageURI": page_uri,
                "aura.token": "null",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"},
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
        action = (payload.get("actions") or [{}])[0]
        if action.get("state") != "SUCCESS":
            err = action.get("error")
            raise RuntimeError(f"TULIP {classname}.{method} failed: {err}")
        returned = action.get("returnValue")
        if isinstance(returned, dict) and "returnValue" in returned:
            return returned.get("returnValue")
        return returned

    def search_license(self, license_number: str) -> list[dict[str, Any]]:
        rows = self._call(
            SEARCH_CLASS,
            SEARCH_METHOD,
            {
                "programType": PROGRAM_TYPE_ALF,
                "serviceType": "",
                "facilityName": "",
                "licenseNumber": str(license_number).strip(),
                "postalCode": "",
                "city": "",
                "counties": [],
                "pageNumber": 1,
                "isClosed": False,
            },
            "/TULIP/s/ltc-provider-search",
        )
        return rows if isinstance(rows, list) else []

    def inspections(self, account_id: str) -> list[dict[str, Any]]:
        page = f"/TULIP/s/ltc-provider-detail?c__accountidparam={account_id}"
        rows = self._call(DETAIL_CLASS, INSPECTIONS_METHOD, {"accId": account_id}, page)
        return rows if isinstance(rows, list) else []

    def enforcement(self, account_id: str) -> list[dict[str, Any]]:
        page = f"/TULIP/s/ltc-provider-detail?c__accountidparam={account_id}"
        rows = self._call(DETAIL_CLASS, ENFORCEMENT_METHOD, {"accId": account_id}, page)
        return rows if isinstance(rows, list) else []
