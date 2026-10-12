"""Stage 3 — production database -> what a family actually sees on www.starlynncare.com.

Intent: the page is the product. For real facilities we load the live page and require every
stored fact (name, license, address, phone, citation count) to be present and consistent,
and the SEO/GEO contract in AGENTS.md (canonical + parsable JSON-LD) to hold.
"""
from __future__ import annotations

import json
import re
import unittest
from datetime import date

from tests.e2e import live

SAMPLE = 8


def _facilities() -> list[dict]:
    pool = live.sb_select("facilities", {
        "select": "id,name,license_number,street,city,city_slug,slug,zip,phone,beds,state_code",
        "state_code": "eq.CA", "publishable": "eq.true", "order": "license_number.asc", "limit": "3000"})
    step = max(1, len(pool) // SAMPLE)
    return pool[::step][:SAMPLE]


def _jsonld(html: str) -> list[dict]:
    out = []
    for m in re.finditer(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
        out.append(json.loads(m.group(1)))
    return out


class RenderedFacilityPages(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.pages = []
        for f in _facilities():
            url = f"{live.SITE_URL}/california/{f['city_slug']}/{f['slug']}"
            r = live.http_get(url, timeout=90)
            cls.pages.append((f, url, r.status_code, r.text))

    def test_pages_are_served(self) -> None:
        self.assertEqual([(u, c) for _, u, c, _ in self.pages if c != 200], [])

    def test_stored_facts_are_visible(self) -> None:
        missing = []
        for f, url, _, html in self.pages:
            text = " ".join(re.sub(r"<[^>]+>", " ", html).split()).lower()
            for field in ("license_number", "street", "zip", "phone"):
                if f[field] and f[field].lower() not in text:
                    missing.append(f"{url}: {field}={f[field]!r} not on page")
            if f["name"].lower() not in text:
                missing.append(f"{url}: name {f['name']!r} not on page")
        self.assertEqual(missing[:15], [])

    def test_canonical_and_jsonld_contract(self) -> None:
        problems = []
        for f, url, _, html in self.pages:
            canon = re.findall(r'rel="canonical" href="([^"]+)"', html)
            if canon != [url]:
                problems.append(f"{url}: canonical {canon}")
            blobs = _jsonld(html)
            types = set()
            for b in blobs:
                for node in b.get("@graph", [b]):
                    t = node.get("@type")
                    types |= set(t if isinstance(t, list) else [t])
                    if "aggregateRating" in node:
                        problems.append(f"{url}: fabricated aggregateRating")
            if "BreadcrumbList" not in types:
                problems.append(f"{url}: no BreadcrumbList")
        self.assertEqual(problems[:15], [])

    def test_page_citation_count_equals_database(self) -> None:
        """'N Citations' in the <title> must equal what the loader's documented rule yields from stored rows:
        deficiencies on inspections in the last INSPECTION_DISPLAY_YEARS (3) years, plus one for each
        substantiated complaint that has no parsed deficiency (loadFacilityProfile.ts)."""
        cutoff = date.today().replace(year=date.today().year - 3).isoformat()
        problems = []
        compared = 0
        for f, url, _, html in self.pages:
            m = re.search(r"<title>.*?(\d+) Citations?", html)
            insp = [i for i in live.sb_select("inspections", {
                "select": "id,inspection_date,is_complaint,raw_data", "facility_id": f"eq.{f['id']}",
                "order": "inspection_date.desc", "limit": "50"})
                    if i["inspection_date"] >= cutoff]
            defs = live.sb_select_in("deficiencies", "inspection_id", [i["id"] for i in insp], select="inspection_id") if insp else []
            with_defs = {d["inspection_id"] for d in defs}
            gaps = [i for i in insp if i["is_complaint"] and (i["raw_data"] or {}).get("outcome") == "Substantiated" and i["id"] not in with_defs]
            expected = len(defs) + len(gaps)
            if not m:
                continue  # top-half facilities lead the title with a rank, not a citation count
            compared += 1
            shown = int(m.group(1))
            if shown != expected:
                problems.append(f"{url}: page says {shown} citations, stored rows imply {expected}")
        self.assertEqual(problems[:15], [])
        self.assertGreaterEqual(compared, 2, "too few titles carried a citation count to prove anything")


if __name__ == "__main__":
    unittest.main()
