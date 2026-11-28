"""Read-only spot check for the accuracy PR.

Prints counts and pass/fail only. Never prints a connection string or a key.
"""
from __future__ import annotations

import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _lib import check, fetch_page, get_conn, run_all_checks

CA_SLUGS = [
    "harbor-heights-assisted-living-and-memory-care-6452",
    "legacy-oaks-of-sacramento-702896",
    "carlton-senior-living-sacramento-701213",
    "amistad-assisted-living-and-memory-care-home-530157",
    "ivy-park-at-otay-ranch-604455",
    "valle-verde-care-home-iii-601199",
    "everest-at-oceanside-604806",
    "lincoln-villa-201495",
    "ivy-park-at-huntington-beach-6456",
    "oakmont-of-fair-oaks-2797",
]
WA_SLUGS = [
    "amani-of-marysville-afh-llc-marysville-0000753998",
    "amazing-love-adult-family-home-everett-0000752589",
    "aegis-living-ballard-2689",
    "aegis-living-greenwood-2617",
    "centralia-point-assisted-living-and-memory-care-2609",
    "6th-avenue-senior-living-llc-2552",
    "aegis-of-bellevue-2491",
    "amazinggrace-palace-afh-kent-0000756159",
    "amani-peace-afh-llc-puyallup-0000758437",
]
OR_SLUGS = [
    "arbor-senior-living-50r369",
    "autumn-garden-memory-rcf-50m006",
    "fircrest-senior-living-50r358",
    "hillside-memory-support-50r277",
    "brookdale-redmond-clare-bridge-50r344",
    "firwood-gardens-rcf-50m037",
]
AZ_PATHS = [
    "/arizona/tucson/113-north-senior-care-center-llc-al12914",
    "/arizona/surprise/abigail-s-assisted-living-home-llc-al11719",
    "/arizona/scottsdale/acoya-shea-al12692",
]
BANNED = re.compile(r"Immediate Jeopardy|\bIJ\b|Sev(?:erity)? ?4|CMS [A-L]\b")


def format_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        return None
    return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"


def format_date(iso: str, precision: str) -> str:
    day = datetime.strptime(iso[:10], "%Y-%m-%d")
    if precision == "month":
        return day.strftime("%B %Y")
    return day.strftime("%B %-d, %Y") if sys.platform != "win32" else day.strftime("%B %#d, %Y")


def precision_for(iso: str, raw) -> str:
    payload = raw if isinstance(raw, dict) else {}
    if payload.get("posted_month"):
        return "month"
    if payload.get("washington") is True and iso[:10].endswith("-01"):
        return "month"
    return "day"


def page_url(base: str, path: str) -> str:
    return base.rstrip("/") + path


def main() -> None:
    base = sys.argv[1] if len(sys.argv) > 1 else "https://www.starlynncare.com"
    print(f"base {base}")
    print(f"as of {datetime.now().astimezone().isoformat(timespec='seconds')}")
    conn = get_conn()
    try:
        check_california(conn, base)
        check_washington(conn, base)
        check_oregon(conn, base)
    finally:
        conn.close()
    check_arizona(base)
    run_all_checks("PR A spot check")


def check_california(conn, base: str) -> None:
    sql = """
        select f.slug, f.city_slug,
               count(distinct i.id) filter (
                 where i.inspection_date >= current_date - interval '3 years'
                   and i.inspection_date <= current_date
               ) insp_window,
               count(d.id) filter (
                 where d.class = 'Type A'
                   and i.inspection_date >= current_date - interval '3 years'
                   and i.inspection_date <= current_date
               ) type_a,
               count(d.id) filter (
                 where d.class = 'Type B'
                   and i.inspection_date >= current_date - interval '3 years'
                   and i.inspection_date <= current_date
               ) type_b
        from facilities f
        left join inspections i on i.facility_id = f.id
        left join deficiencies d on d.inspection_id = i.id
        where f.state_code = 'CA' and f.slug = %s
        group by f.slug, f.city_slug
    """
    with conn.cursor() as cur:
        for slug in CA_SLUGS:
            cur.execute(sql, (slug,))
            row = cur.fetchone()
            if not row:
                check(f"CA {slug} row", False, "missing")
                continue
            insp = int(row["insp_window"])
            citations = int(row["type_a"]) + int(row["type_b"])
            path = f"/california/{row['city_slug']}/{slug}"
            status, html = fetch_page(page_url(base, path), timeout=30)
            print(
                f"  COUNT CA {slug} insp={insp} a={row['type_a']} b={row['type_b']} "
                f"bytes={len(html) if status == 200 else 0}"
            )
            check(f"CA {slug} http", status == 200, f"status {status}")
            if status != 200:
                continue
            check(f"CA {slug} no IJ label", BANNED.search(html) is None, "banned label")
            if slug == "oakmont-of-fair-oaks-2797":
                check(f"CA {slug} no banner row", "Revocation Action Pending" not in html, "banner text present")
                continue
            check(
                f"CA {slug} inspections",
                f"{insp} inspection" in html,
                f"looked for {insp} inspection",
            )
            citation_ok = (
                f"{citations} citation" in html
                or f"{citations} deficiencies" in html
                or (citations == 0 and "no citations" in html.lower())
            )
            check(f"CA {slug} citations", citation_ok, f"looked for {citations}")
            check(f"CA {slug} window phrase", "in the last three years" in html or "in the last 3 years" in html, "")


def check_washington(conn, base: str) -> None:
    home_sql = "select id, city_slug from facilities where state_code = 'WA' and slug = %s"
    row_sql = """
        select inspection_date::text as inspection_date, is_complaint, raw_data
        from inspections
        where facility_id = %s and inspection_date <= current_date
    """
    with conn.cursor() as cur:
        for slug in WA_SLUGS:
            cur.execute(home_sql, (slug,))
            home = cur.fetchone()
            if not home:
                check(f"WA {slug} row", False, "missing")
                continue
            cur.execute(row_sql, (home["id"],))
            rows = cur.fetchall()
            cur.execute("select wa_latest_posted_report(%s) as report", (home["id"],))
            report = cur.fetchone()["report"]
            posted = report if isinstance(report, dict) else None
            inspections = []
            complaints = []
            for row in rows:
                if not row["inspection_date"]:
                    continue
                label = format_date(row["inspection_date"], precision_for(row["inspection_date"], row["raw_data"]))
                bucket = complaints if row["is_complaint"] else inspections
                bucket.append((row["inspection_date"], label))
            if posted and posted.get("posted_month"):
                iso = f"{posted['posted_month']}-01"
                label = format_date(iso, "month")
                bucket = complaints if posted.get("doc_type") == "investigation" else inspections
                bucket.append((iso, label))
            inspections.sort(reverse=True)
            complaints.sort(reverse=True)
            path = f"/washington/{home['city_slug']}/{slug}"
            status, html = fetch_page(page_url(base, path), timeout=30)
            insp_label = inspections[0][1] if inspections else "Not on file"
            complaint_label = complaints[0][1] if complaints else None
            print(f"  COUNT WA {slug} inspection={insp_label} complaint={complaint_label or 'none'}")
            check(f"WA {slug} http", status == 200, f"status {status}")
            if status != 200:
                continue
            if inspections:
                check(f"WA {slug} last inspection", insp_label in html, insp_label)
            else:
                check(f"WA {slug} not on file", "Not on file" in html, "")
            if complaint_label:
                check(
                    f"WA {slug} complaint line",
                    f"Last complaint investigation {complaint_label}" in html,
                    complaint_label,
                )
            else:
                check(f"WA {slug} no complaint line", "Last complaint investigation" not in html, "")


def check_oregon(conn, base: str) -> None:
    sql = """
        select slug, city_slug, license_number, phone, phone_override
        from facilities
        where state_code = 'OR' and slug = %s
    """
    with conn.cursor() as cur:
        for slug in OR_SLUGS:
            cur.execute(sql, (slug,))
            row = cur.fetchone()
            if not row:
                check(f"OR {slug} row", False, "missing")
                continue
            shown = format_phone(row["phone_override"] or row["phone"])
            path = f"/oregon/{row['city_slug']}/{slug}"
            status, html = fetch_page(page_url(base, path), timeout=30)
            print(f"  COUNT OR {slug} phone={'set' if shown else 'missing'}")
            check(f"OR {slug} http", status == 200, f"status {status}")
            if status != 200:
                continue
            if shown:
                check(f"OR {slug} phone", shown in html, shown)
            else:
                license_number = quote(row["license_number"] or "", safe="")
                check(f"OR {slug} not on file", "Not on file" in html, "")
                check(
                    f"OR {slug} regulator",
                    f"https://ltclicensing.oregon.gov/Providers/Details/{license_number}" in html,
                    row["license_number"],
                )


def check_arizona(base: str) -> None:
    for path in AZ_PATHS:
        status, html = fetch_page(page_url(base, path), timeout=30)
        noindex = 'content="noindex' in html or "noindex, nofollow" in html
        print(f"  COUNT AZ {path} status={status} bytes={len(html) if status == 200 else 0}")
        check(f"AZ {path} http", status == 200, f"status {status}")
        check(f"AZ {path} not noindex", not noindex, "")


if __name__ == "__main__":
    main()
