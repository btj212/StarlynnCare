"""Stage 2 — CA inspections/citations: live CDSS report HTML -> real parser -> production DB.

Intent: a family reading "3 Type A citations" must be reading what CDSS actually published.
For real facilities we re-fetch the regulator's own report at the exact URL we stored, run the
ingest's real parser on it, and require the stored inspection + deficiency rows to match, field by field.
"""
from __future__ import annotations

import collections
import re
import unittest
from datetime import date

from tests.e2e import live

import ccld_citations_ingest as cit  # noqa: E402

SAMPLE_FACILITIES = 6
REPORTS_PER_FACILITY = 6
TYPE_HEADER_RE = re.compile(r"Type [AB]\s+\d{1,2}/\d{1,2}/\d{4}\s+Section Cited\s+CCR", re.I)


def _sample_facilities() -> list[dict]:
    """Publishable CA facilities spread across the license-number range, deterministic."""
    pool = live.sb_select("facilities", {
        "select": "id,name,license_number,city_slug,slug",
        "state_code": "eq.CA", "publishable": "eq.true", "order": "license_number.asc", "limit": "2000",
    })
    pool = [f for f in pool if f["license_number"]]
    step = max(1, len(pool) // SAMPLE_FACILITIES)
    picked = pool[::step][:SAMPLE_FACILITIES]
    opal = [f for f in pool if f["license_number"] == "019200672"]
    return picked + [f for f in opal if f not in picked]


def _stored_inspections(fac_id: str) -> list[dict]:
    return live.sb_select("inspections", {
        "select": "id,inspection_date,inspection_type,is_complaint,complaint_id,total_deficiency_count,source_url,raw_data",
        "facility_id": f"eq.{fac_id}", "order": "inspection_date.desc", "limit": "500",
    })


def _inx(url: str) -> int:
    return int(re.search(r"inx=(\d+)", url).group(1))


def _raw_citation_count(html: str) -> int:
    """Citations as the regulator wrote them: modern 'Type X date Section Cited CCR' headers, else legacy 'Type X' cells."""
    soup = cit.BeautifulSoup(html, "html.parser")
    modern = len(TYPE_HEADER_RE.findall(" ".join(soup.get_text(" ").split())))
    if modern:
        return modern
    return sum(1 for td in soup.find_all(["td", "th"]) if re.fullmatch(r"Type [AB]", td.get_text(" ", strip=True)))


class _Row:
    """One stored inspection joined with what the regulator serves at its stored URL right now."""
    def __init__(self, fac: dict, stored: dict, meta: dict | None, html: str | None) -> None:
        self.fac, self.stored, self.meta, self.html = fac, stored, meta, html
        self.parsed = None
        if html is not None:
            self.parsed = cit.parse_report(html, meta or {}, fac["license_number"].zfill(9), stored["source_url"])
        self.tag = f"{fac['name']} (lic {fac['license_number']}) inx={_inx(stored['source_url'])}"

    @property
    def status(self) -> str:
        if self.html is None or self.parsed is None:
            return "dead"
        s, p = self.stored, self.parsed
        if bool(s["is_complaint"]) != p["is_complaint"] or s["complaint_id"] != p["complaint_id"]:
            return "shifted"
        if date.fromisoformat(s["inspection_date"]) != p["inspection_date"]:
            return "shifted"
        return "in_sync"


_ROWS: list[_Row] | None = None


def _rows() -> list[_Row]:
    """Every stored CDSS inspection of the sampled facilities, re-fetched live (cached on disk)."""
    global _ROWS
    if _ROWS is None:
        out: list[_Row] = []
        for fac in _sample_facilities():
            idx = cit.fetch_report_index(fac["license_number"].zfill(9))["REPORTARRAY"]
            for s in _stored_inspections(fac["id"]):
                if "FacilityReports" not in (s["source_url"] or ""):
                    continue
                inx = _inx(s["source_url"])
                meta = idx[inx - 1] if inx <= len(idx) else None
                html = live.cached_get_text(s["source_url"], timeout=60) if meta is not None else None
                out.append(_Row(fac, s, meta, html))
        _ROWS = out
    return _ROWS


class CitationLinkIntegrity(unittest.TestCase):
    """The link under every citation must still open the report we stored."""

    def test_live_report_index_shape(self) -> None:
        for fac in _sample_facilities():
            idx = cit.fetch_report_index(fac["license_number"].zfill(9))
            self.assertEqual(set(idx), {"COUNT", "REPORTARRAY"}, f"{fac['name']}: index keys")
            self.assertEqual(idx["COUNT"], len(idx["REPORTARRAY"]), f"{fac['name']}: COUNT != len(REPORTARRAY)")
            for r in idx["REPORTARRAY"]:
                self.assertIn(r.get("REPORTTYPE"), {"Inspection", "Complaint", "Other"}, r)
                self.assertRegex(r.get("REPORTDATE") or "", r"^\d{1,2}/\d{1,2}/\d{4}$", r)

    def test_no_stored_url_is_dead(self) -> None:
        dead = [r.tag for r in _rows() if r.status == "dead"]
        self.assertEqual(dead[:15], [], f"{len(dead)}/{len(_rows())} stored citation links no longer resolve")

    def test_no_stored_url_now_shows_a_different_report(self) -> None:
        """Ingest dedupes by positional `inx=N`; CDSS re-orders its index, so stored rows can lie."""
        shifted = [
            f"{r.tag}: stored {r.stored['inspection_date']}/{r.stored['inspection_type']} "
            f"but URL now serves {r.parsed['inspection_date']}/{r.parsed['inspection_type']}"
            for r in _rows() if r.status == "shifted"
        ]
        self.assertEqual(shifted[:15], [], f"{len(shifted)}/{len(_rows())} stored rows point at a different report")


class ParserFidelity(unittest.TestCase):
    """For reports still in sync: raw HTML -> parser -> stored rows must agree exactly."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.rows = [r for r in _rows() if r.status == "in_sync"]
        assert len(cls.rows) >= 10, f"only {len(cls.rows)} in-sync reports to test against"

    def test_inspection_fields_match(self) -> None:
        mismatches = []
        for r in self.rows:
            s, p, raw = r.stored, r.parsed, r.stored["raw_data"] or {}
            want = (s["inspection_type"], s["total_deficiency_count"], raw.get("outcome"),
                    raw.get("inspector_name"), raw.get("narrative"))
            got = (p["inspection_type"], len(p["deficiencies"]), p["outcome"],
                   p["inspector_name"], p["narrative_text"][:10000])
            for name, w, g in zip(("type", "deficiency_count", "outcome", "inspector", "narrative"), want, got):
                if w != g:
                    mismatches.append(f"{r.tag} {name}: stored={str(w)[:50]!r} parsed={str(g)[:50]!r}")
        self.assertEqual(mismatches[:15], [], f"{len(mismatches)} mismatches over {len(self.rows)} reports")

    def test_every_citation_in_the_raw_html_becomes_a_deficiency(self) -> None:
        problems = []
        for r in self.rows:
            text = " ".join(cit.BeautifulSoup(r.html, "html.parser").get_text(" ").split())
            real = [d for d in r.parsed["deficiencies"] if not d.get("narrative_derived")]
            raw_headers = _raw_citation_count(r.html)
            if raw_headers != len(real):
                problems.append(f"{r.tag}: raw HTML has {raw_headers} Type A/B citations, parser produced {len(real)}")
            for d in real:
                if not d["section"]:
                    problems.append(f"{r.tag}: {d['type']} citation parsed with no section number")
                elif d["section"] not in text:
                    problems.append(f"{r.tag}: parsed section {d['section']} is not in the raw HTML")
                if not d["deficiency_statement"]:
                    problems.append(f"{r.tag}: §{d['section']} has an empty deficiency statement")
        self.assertEqual(problems[:15], [], f"{len(problems)} raw-vs-parsed discrepancies")

    def test_stored_deficiency_rows_match_parser_output(self) -> None:
        problems = []
        for r in self.rows:
            stored = live.sb_select("deficiencies", {
                "select": "code,class,severity,immediate_jeopardy,description,inspector_narrative",
                "inspection_id": f"eq.{r.stored['id']}", "limit": "500"})
            key = lambda c, k, v, ij: (c, k, v, bool(ij))  # noqa: E731
            want = collections.Counter(key(d["section"], d["class"], d["severity"], d["immediate_jeopardy"]) for d in r.parsed["deficiencies"])
            have = collections.Counter(key(x["code"], x["class"], x["severity"], x["immediate_jeopardy"]) for x in stored)
            if want != have:
                problems.append(f"{r.tag}: parser {sorted(want.items(), key=str)} vs stored {sorted(have.items(), key=str)}")
            want_text = collections.Counter((d["deficiency_statement"][:8000] or None) for d in r.parsed["deficiencies"])
            have_text = collections.Counter(x["inspector_narrative"] for x in stored)
            if want_text != have_text:
                problems.append(f"{r.tag}: deficiency statement text differs between raw HTML and stored rows")
        self.assertEqual(problems[:15], [], f"{len(problems)} mismatches over {len(self.rows)} reports")

    def test_severity_mapping_is_the_documented_one(self) -> None:
        """Type A=3 (4 if immediate jeopardy), Type B=2, and never invent a class for 9099D-only citations."""
        for r in self.rows:
            for d in r.parsed["deficiencies"]:
                if d.get("narrative_derived"):
                    self.assertIsNone(d["severity"], r.tag)
                elif d["type"] == "Type B":
                    self.assertEqual(d["severity"], 2, r.tag)
                else:
                    self.assertEqual(d["severity"], 4 if d["immediate_jeopardy"] else 3, r.tag)


if __name__ == "__main__":
    unittest.main()
