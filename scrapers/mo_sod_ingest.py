#!/usr/bin/env python3
"""
mo_sod_ingest.py — Missouri Statement-of-Deficiencies (SOD) narrative ingest.

WHY THIS EXISTS
---------------
The original Missouri ingest (mo_inspections_ingest.py) was fed a FOIA Excel
(missourirecords.xlsx) that is TAG-level only: per cited tag it carries the
standard *regulation* text, not the inspector's specific finding. So the public
profile could only show the verbatim rule ("Exits, Stairways, and Fire
Escapes...") — never what the facility actually did.

The real finding lives in DHSS's Statement of Deficiencies & Plan of Correction
(the CMS-2567-style form), published on the "Show Me Long Term Care" portal
(https://healthapps.dhss.mo.gov/showmeltc/) as a SCANNED image PDF. This script
crawls that portal, downloads each SOD/POC PDF, OCRs it, parses the per-tag
narrative ("This regulation is not met as evidenced by: ... Based on observation
and interview ..."), and writes it to deficiencies.inspector_narrative — which
the facility profile already prefers over the rule text.

PORTAL FLOW (reverse-engineered; ASP.NET WebForms, all postbacks to ./)
  1. Search by city: select #ContentPlaceHolder1_ddlCity, click btnShowMeResults.
  2. gvSearchResults grid -> each facility has a Select$N postback link.
  3. Facility detail -> gvInspections grid: per inspection a date link
     (-> inspection_detail.aspx?insid=...) and a "STATE POC" link that
     DOWNLOADS the SOD/POC PDF (filename ConvertedTiff.pdf, image-only).

JOIN STRATEGY (robust, no fragile tag-code mapping)
  The SOD header reliably yields the provider id (= facilities.external_id) and
  the survey date. Within an inspection, each SOD tag block opens with the same
  *requirement* text we already store in deficiencies.description, so we
  fuzzy-match (rapidfuzz) the SOD requirement to the right deficiency row and
  attach its narrative. No dependency on OCR'ing the narrow (X4) prefix-tag col.

THREE MODES (run in order)
  crawl : Playwright -> download SOD PDFs for facilities in the given cities,
          append rows to data/mo_sod/manifest.jsonl.
  ocr   : Tesseract OCR each PDF in the manifest -> parse per-tag narrative,
          write data/mo_sod/parsed.jsonl.
  load  : upsert narratives into deficiencies (+ inspections.raw_data.narrative).

USAGE
  # 1. crawl (downloads scanned PDFs locally; be polite — this hits a .gov site)
  python3 scrapers/mo_sod_ingest.py crawl --cities SPRINGFIELD
  python3 scrapers/mo_sod_ingest.py crawl --from-db            # all MO cities in DB
  python3 scrapers/mo_sod_ingest.py crawl --cities SPRINGFIELD --only-name FREMONT

  # 2. ocr (no network; pure local OCR + parse)
  python3 scrapers/mo_sod_ingest.py ocr

  # 3. load (writes to DB; --dry-run to preview matches)
  python3 scrapers/mo_sod_ingest.py load --dry-run
  python3 scrapers/mo_sod_ingest.py load

REQUIRES
  brew install tesseract poppler
  pip install playwright pytesseract pdf2image psycopg python-dotenv rapidfuzz
  python3 -m playwright install chromium
  DATABASE_URL (or SUPABASE_DB_URL) in .env.local for crawl --from-db and load.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Iterator

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = Path(__file__).resolve().parent / "data" / "mo_sod"
PDF_DIR = CACHE_DIR / "pdfs"
MANIFEST = CACHE_DIR / "manifest.jsonl"
PARSED = CACHE_DIR / "parsed.jsonl"

PORTAL = "https://healthapps.dhss.mo.gov/showmeltc/"
TESSERACT_CMD = "/opt/homebrew/bin/tesseract"

try:
    from dotenv import load_dotenv
    load_dotenv(REPO_ROOT / ".env.local")
except Exception:
    pass

DSN = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")


# ===========================================================================
# Shared helpers
# ===========================================================================

def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")[:60] or "x"


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    out = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if line:
            out.append(json.loads(line))
    return out


def _append_jsonl(path: Path, row: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as fh:
        fh.write(json.dumps(row) + "\n")


# ===========================================================================
# MODE: crawl  (Playwright)
# ===========================================================================

def _mo_cities_from_db() -> list[str]:
    import psycopg
    if not DSN:
        sys.exit("crawl --from-db needs DATABASE_URL / SUPABASE_DB_URL")
    with psycopg.connect(DSN) as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT upper(city) FROM facilities "
            "WHERE state_code='MO' AND city IS NOT NULL ORDER BY 1"
        )
        return [r[0] for r in cur.fetchall() if r[0]]


def _already_downloaded(manifest_rows: list[dict[str, Any]]) -> set[tuple[str, str]]:
    """Set of (facility_name, inspection_date) already in the manifest — resume support."""
    return {(r["facility_name"], r["inspection_date"]) for r in manifest_rows}


def _has_results(page: Any) -> bool:
    try:
        return page.query_selector("a[href*='Select$']") is not None
    except Exception:
        return False


def _search_city(page: Any, city: str) -> bool:
    """Search the portal for a city; return True if a results grid rendered.

    Selecting the city can itself fire an ASP.NET autopostback (which destroys
    the JS execution context), so every step is guarded and we only force-click
    the (JS-disabled) ShowMeResults button if results haven't already rendered.
    """
    page.goto(PORTAL, wait_until="domcontentloaded", timeout=60_000)
    try:
        page.select_option("#ContentPlaceHolder1_ddlCity", city)
    except Exception:
        pass
    page.wait_for_timeout(1_500)
    try:
        page.wait_for_load_state("networkidle", timeout=15_000)
    except Exception:
        pass

    if not _has_results(page):
        try:
            page.evaluate(
                "() => { const el = document.getElementById('ContentPlaceHolder1_btnShowMeResults');"
                " if (el) { el.disabled = false; el.classList.remove('aspNetDisabled'); } }"
            )
        except Exception:
            pass
        try:
            with page.expect_navigation(timeout=30_000):
                page.click("#ContentPlaceHolder1_btnShowMeResults")
        except Exception:
            pass

    for _ in range(12):
        if _has_results(page):
            return True
        page.wait_for_timeout(1_000)
    return False


def _grid_rows(page: Any) -> list[dict[str, Any]]:
    """Map gvSearchResults Select$N links -> {idx, name, level, city}."""
    return page.eval_on_selector_all(
        "a[href*='Select$']",
        """as => as.map(a => {
            const m = a.getAttribute('href').match(/Select\\$(\\d+)/);
            const cells = (a.closest('tr')
                ? Array.from(a.closest('tr').querySelectorAll('td')).map(td => td.innerText.trim())
                : []);
            return { idx: m ? m[1] : null, name: cells[1] || '', level: cells[2] || '', city: cells[3] || '' };
        }).filter(r => r.idx !== null)""",
    )


def _open_facility(page: Any, idx: str) -> None:
    with page.expect_navigation(timeout=30_000):
        page.click(f"a[href*=\"Select${idx}')\"]")
    page.wait_for_timeout(1_500)
    page.wait_for_selector("#ContentPlaceHolder1_gvInspections", timeout=20_000)


def _inspection_rows(page: Any) -> list[dict[str, Any]]:
    """gvInspections rows -> {date, type, has_poc}; index aligns with POC link order."""
    return page.eval_on_selector_all(
        "#ContentPlaceHolder1_gvInspections tr",
        """trs => trs.map(tr => {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (!tds.length) return null;
            const dateLink = tr.querySelector("a[href*='gvInspections']");
            const poc = Array.from(tr.querySelectorAll('a')).find(a => /POC/i.test(a.innerText));
            return {
                date: dateLink ? dateLink.innerText.trim() : (tds[0] ? tds[0].innerText.trim() : ''),
                type: tds[1] ? tds[1].innerText.trim() : '',
                has_poc: !!poc,
            };
        }).filter(r => r && r.date)""",
    )


_INSID_RE = re.compile(r"insid=([A-Za-z0-9]+)", re.IGNORECASE)


def _harvest_insids(page: Any, city: str, facility_name: str, dates: list[str]) -> dict[str, str]:
    """Resolve each inspection date -> ShowMeLTC insid (the stable deep-link key).

    The insid is only revealed after the date link's postback navigates to
    inspection_detail.aspx?insid=<insid>, so we click each date and read the
    URL, re-opening the facility between clicks. Best-effort: a miss just leaves
    that inspection without a deep link (better than the old 404)."""
    out: dict[str, str] = {}
    for date in dates:
        if not _search_city(page, city):
            continue
        match = next((g for g in _grid_rows(page) if g["name"] == facility_name), None)
        if not match:
            continue
        try:
            _open_facility(page, match["idx"])
            with page.expect_navigation(timeout=30_000):
                page.click(f"#ContentPlaceHolder1_gvInspections a:has-text(\"{date}\")")
            m = _INSID_RE.search(page.url)
            if m:
                out[date] = m.group(1)
        except Exception:
            continue
    return out


def _crawl_one_city(page: Any, city: str, only_name: str | None,
                    max_facilities: int | None, delay: float,
                    done: set[tuple[str, str]]) -> int:
    """Crawl every facility in one city; return the number of new PDFs saved.

    Raises on fatal page/navigation errors (net::ERR_ABORTED on a portal hiccup,
    or EPIPE when the browser process dies) so the caller can rebuild the browser
    and retry/skip the city. Facilities already written to the manifest persist,
    so a mid-city failure loses nothing on resume.
    """
    n_pdf = 0
    if not _search_city(page, city):
        print(f"  no results for {city}")
        return 0
    rows = _grid_rows(page)
    if only_name:
        rows = [r for r in rows if only_name.upper() in r["name"].upper()]
    if max_facilities:
        rows = rows[:max_facilities]
    print(f"  facilities: {len(rows)}")

    for r in rows:
        # Re-run the search each facility: opening a detail page mutates
        # the grid's ViewState, so we re-search to get a clean Select$N.
        if not _search_city(page, city):
            continue
        grid = _grid_rows(page)
        match = next((g for g in grid if g["name"] == r["name"]), None)
        if not match:
            continue
        try:
            _open_facility(page, match["idx"])
        except Exception as e:
            print(f"  [{r['name']}] open failed: {repr(e)[:80]}")
            continue

        insp = _inspection_rows(page)
        poc_links = page.query_selector_all("#ContentPlaceHolder1_gvInspections a:has-text('POC')")
        poc_rows = [row for row in insp if row["has_poc"]]
        print(f"  {r['name']}: {len(insp)} inspections, {len(poc_links)} POC docs")

        # Phase 1 — download every POC PDF (downloads don't navigate, so
        # the element handles stay valid through the loop).
        pending: list[dict[str, Any]] = []
        for i, link in enumerate(poc_links):
            date = poc_rows[i]["date"] if i < len(poc_rows) else f"row{i}"
            if (r["name"], date) in done:
                continue
            fname = f"{_slug(r['name'])}_{_slug(date)}_{i}.pdf"
            fpath = PDF_DIR / fname
            try:
                with page.expect_download(timeout=20_000) as di:
                    link.click()
                di.value.save_as(str(fpath))
            except Exception as e:
                print(f"    POC[{i}] {date} download failed: {repr(e)[:70]}")
                continue
            pending.append({
                "facility_name": r["name"],
                "city": r["city"] or city,
                "level": r["level"],
                "inspection_date": date,
                "inspection_type": poc_rows[i]["type"] if i < len(poc_rows) else "",
                "pdf": str(fpath.relative_to(REPO_ROOT)),
            })
            print(f"    saved {fname}")
            time.sleep(delay)

        # Phase 2 — harvest the deep-link insid for each downloaded
        # inspection (navigations; done after downloads so handles above
        # aren't invalidated mid-loop).
        insid_map = _harvest_insids(page, city, r["name"],
                                    [p["inspection_date"] for p in pending])
        for p in pending:
            p["insid"] = insid_map.get(p["inspection_date"])
            _append_jsonl(MANIFEST, p)
            done.add((r["name"], p["inspection_date"]))
            n_pdf += 1
    return n_pdf


def crawl(cities: list[str], only_name: str | None, max_facilities: int | None,
          delay: float, headless: bool) -> None:
    from playwright.sync_api import sync_playwright

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    done = _already_downloaded(_read_jsonl(MANIFEST))
    print(f"Cities to crawl: {len(cities)} | already in manifest: {len(done)} (facility,date) pairs")

    n_pdf = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        ctx = browser.new_context(accept_downloads=True)
        page = ctx.new_page()
        page.set_default_timeout(25_000)

        for city in cities:
            print(f"\n=== {city} ===", flush=True)
            # Each city is isolated: a transient portal error (net::ERR_ABORTED) or
            # a dead browser pipe (EPIPE) must not kill the whole multi-hour crawl.
            # Retry the city once on a fresh browser, then move on. Completed
            # facilities are already in the manifest, so resume covers any skips.
            for attempt in (1, 2):
                try:
                    n_pdf += _crawl_one_city(page, city, only_name,
                                             max_facilities, delay, done)
                    break
                except Exception as e:
                    print(f"  [{city}] error (attempt {attempt}/2): {repr(e)[:140]}",
                          flush=True)
                    try:
                        browser.close()
                    except Exception:
                        pass
                    browser = pw.chromium.launch(headless=headless)
                    ctx = browser.new_context(accept_downloads=True)
                    page = ctx.new_page()
                    page.set_default_timeout(25_000)

        try:
            browser.close()
        except Exception:
            pass
    print(f"\nCrawl done. New PDFs: {n_pdf}. Manifest: {MANIFEST}")
    print("Next: python3 scrapers/mo_sod_ingest.py ocr")


# ===========================================================================
# MODE: ocr  (Tesseract + per-tag parse)
# ===========================================================================

# Repeating page header/footer noise on every SOD page — stripped before parsing.
_NOISE_RE = re.compile(
    r"(?im)^\s*(?:"
    r"PRINTED:.*$|FORM APPROVED.*$|Missouri Department of Health.*$|"
    r"STATEMENT OF DEFICIENCIES.*$|AND PLAN OF CORRECTION.*$|"
    r"NAME OF PROVIDER OR SUPPLIER.*$|STREET ADDRESS.*$|"
    r"SUMMARY STATEMENT OF DEFICIENCIES.*$|\(EACH DEFICIENCY.*$|"
    r"REGULATORY OR LSC.*$|DEFICIENCY\)\s*$|CROSS-REFERENCED.*$|"
    r"\(X4\).*$|PREFIX.*$|TAG\s+REGULATORY.*$|"
    r"LABORATORY DIRECTOR.*$|STATE FORM.*$|If continuation sheet.*$|"
    r"Continued From page.*$|B\.?\s*WING.*$|A\.?\s*BUILDING.*$|"
    r"\(X[0-9]\).*$"
    r")"
)

# Provider id (= facilities.external_id) + survey date sit together in the
# header, but the column order OCRs two ways:
#   "28782 B. WING 05/22/2025"  (id ... WING ... date)   — newer scans
#   "B. WING\n\n28782 03/26/2019" (id immediately before date) — older scans
# Try both; never fall back to a bare number near "IDENTIFICATION NUMBER"
# because that catches the street number (1520 EAST BATES). If neither hits,
# leave provider_id None and let load resolve by facility name + city.
# MO provider ids (= facilities.external_id) are 5–6 digits (e.g. 28782); the
# {5,6} bound avoids capturing 4-digit years/street numbers (2022, 1520).
_PROVIDER_DATE_RES = [
    re.compile(r"\b(\d{5,6})\b\s+B\.?\s*WING\s+(\d{1,2}/\d{1,2}/\d{4})"),
    re.compile(r"\b(\d{5,6})\b\s+(\d{1,2}/\d{1,2}/\d{4})"),
]
_DATE_FALLBACK_RE = re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4})\b")

# Mirrors _SEV4_RE / _map_severity in mo_inspections_ingest.py. That script only
# ever sees deficiencies.description (boilerplate rule text) at ingest time; this
# one sees the real narrative, which is far more likely to actually name a
# high-harm concept, so severity is re-derived here whenever a narrative lands.
# See supabase/migrations/0058_mo_severity_remap.sql and 0061 (narrative-aware
# follow-up) for the one-time backfill this mirrors going forward.
_SEV4_RE = re.compile(
    r"\b(abuse|neglect|exploit|elopement|medication\s+error|evacuation"
    r"|immediate\s+jeopardy|ij\b|assault|mistreat)\b",
    re.IGNORECASE,
)

# Each tag block opens with a "19 CSR <section>" citation + a short title.
_TAG_HEADER_RE = re.compile(r"(19\s*CSR\s*\d+[-.]\d+[\d.\-]*(?:\([0-9A-Za-z]+\))*)\s*([^\n]*)")
# OCR mangles "This regulation is not met as evidenced by" (e.g. "me aes is
# not met..."), so anchor on the stable tail.
_EVIDENCE_RE = re.compile(r"is not met as evidenced by:?", re.IGNORECASE)
# Every SOD finding narrative opens with "Based on ..." — the most reliable anchor.
_NARRATIVE_START_RE = re.compile(r"Based on\b", re.IGNORECASE)
# Class I/II/III; tolerant of OCR turning "II" into "Il"/"ll"/"ii".
_CLASS_RE = re.compile(r"\bClass\s+([IVil1-4]{1,3})\b")
_RESIDENTS_SIMPLE_RE = re.compile(r"affects?\s+(\d+)\s+of\s+(\d+)\s+residents", re.IGNORECASE)
# Plan-of-Correction column text that OCR interleaves into older (filled) forms.
_POC_LINE_RE = re.compile(
    r"(?im)^\s*(?:Correction:|Plan to Prevent.*|Monitor:|Inservice.*|Contractor notified.*|"
    r"Responsible Party.*|Completion Date.*)$"
)


def _norm_class(raw: str | None) -> str | None:
    if not raw:
        return None
    # Normalise OCR'd roman numerals: l/i -> I.
    val = raw.upper().replace("L", "I")
    val = re.sub(r"[^IV1-4]", "", val)
    if val in {"I", "II", "III", "IV", "1", "2", "3", "4"}:
        roman = {"1": "I", "2": "II", "3": "III", "4": "IV"}.get(val, val)
        return f"Class {roman}"
    return None


def _ocr_pdf(pdf_path: Path) -> str:
    import pytesseract
    from pdf2image import convert_from_path
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    try:
        images = convert_from_path(str(pdf_path), dpi=300)
    except Exception as e:
        print(f"    pdf2image error: {e}")
        return ""
    pages = []
    for img in images:
        try:
            t = pytesseract.image_to_string(img, lang="eng")
            if t and t.strip():
                pages.append(t.strip())
        except Exception as e:
            print(f"    OCR page error: {e}")
    return "\n\n".join(pages)


def _clean(text: str) -> str:
    text = _NOISE_RE.sub("", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Join hard-wrapped lines inside a paragraph (single newline -> space),
    # keep paragraph breaks (blank line).
    return text.strip()


def _parse_tags(full_text: str) -> list[dict[str, Any]]:
    """Split cleaned OCR text into per-tag {rule_cite, title, requirement,
    class, narrative, residents_affected}, deduped by rule_cite (longest wins)."""
    cleaned = _clean(full_text)
    matches = list(_TAG_HEADER_RE.finditer(cleaned))
    raw_tags: list[dict[str, Any]] = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(cleaned)
        block = cleaned[start:end]
        rule_cite = re.sub(r"\s+", " ", m.group(1)).strip()
        title = re.sub(r"\s+", " ", (m.group(2) or "")).strip()

        ev = _EVIDENCE_RE.search(block)
        requirement = block[m.end() - start: ev.start()] if ev else block[m.end() - start:]

        klass_m = _CLASS_RE.search(block[ev.end():ev.end() + 60]) if ev else None
        klass = _norm_class(klass_m.group(1)) if klass_m else _norm_class(
            (_CLASS_RE.search(block).group(1) if _CLASS_RE.search(block) else None)
        )

        # The finding always opens with "Based on ..."; anchor there to skip the
        # "Class X" token and any interleaved Plan-of-Correction preamble.
        nm = _NARRATIVE_START_RE.search(block, ev.end() if ev else 0)
        narrative = block[nm.start():] if nm else (block[ev.end():] if ev else "")
        narrative = _POC_LINE_RE.sub("", narrative)
        narrative = re.sub(r"[ \t]+", " ", narrative)
        narrative = re.sub(r"\n{2,}", "\n\n", narrative).strip()

        res_m = _RESIDENTS_SIMPLE_RE.search(block)
        residents = int(res_m.group(1)) if res_m else None

        raw_tags.append({
            "rule_cite": rule_cite,
            "title": title,
            "requirement": re.sub(r"\s+", " ", requirement).strip(),
            "class": klass,
            "narrative": narrative,
            "residents_affected": residents,
        })

    # Dedupe: the same rule citation can appear twice (header + cross-reference).
    # Keep the entry with the longest narrative per rule_cite.
    best: dict[str, dict[str, Any]] = {}
    for t in raw_tags:
        key = t["rule_cite"]
        if key not in best or len(t["narrative"]) > len(best[key]["narrative"]):
            # Preserve a class/residents value if the longer one lost it.
            if key in best:
                t["class"] = t["class"] or best[key]["class"]
                t["residents_affected"] = t["residents_affected"] or best[key]["residents_affected"]
            best[key] = t
    return list(best.values())


def ocr(limit: int | None) -> None:
    rows = _read_jsonl(MANIFEST)
    if limit:
        rows = rows[:limit]
    already = {r["pdf"] for r in _read_jsonl(PARSED)}
    print(f"Manifest PDFs: {len(rows)} | already parsed: {len(already)}")

    ok = empty = 0
    for idx, r in enumerate(rows, 1):
        if r["pdf"] in already:
            continue
        pdf_path = REPO_ROOT / r["pdf"]
        if not pdf_path.exists():
            print(f"[{idx}] missing {r['pdf']}")
            continue
        print(f"[{idx}/{len(rows)}] {pdf_path.name}", flush=True)
        text = _ocr_pdf(pdf_path)
        if len(text.strip()) < 80:
            print("    < 80 chars OCR — skip")
            empty += 1
            continue

        pdm = next((mm for rx in _PROVIDER_DATE_RES if (mm := rx.search(text))), None)
        provider_id = pdm.group(1) if pdm else None
        survey_date = pdm.group(2) if pdm else (
            _DATE_FALLBACK_RE.search(text).group(1) if _DATE_FALLBACK_RE.search(text) else r["inspection_date"]
        )
        tags = _parse_tags(text)
        with_narr = sum(1 for t in tags if len(t["narrative"]) > 60)
        print(f"    provider={provider_id} date={survey_date} tags={len(tags)} w/narrative={with_narr}")

        _append_jsonl(PARSED, {
            "pdf": r["pdf"],
            "facility_name": r["facility_name"],
            "city": r["city"],
            "manifest_date": r["inspection_date"],
            "provider_id": provider_id,
            "survey_date": survey_date,
            "inspection_type": r.get("inspection_type", ""),
            "insid": r.get("insid"),
            "tags": tags,
            "full_text": text,
        })
        ok += 1
    print(f"\nOCR done. parsed={ok} empty={empty}. Output: {PARSED}")
    print("Next: python3 scrapers/mo_sod_ingest.py load --dry-run")


# ===========================================================================
# MODE: load  (DB upsert)
# ===========================================================================

def _to_iso(mdy: str) -> str | None:
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", mdy or "")
    if not m:
        return None
    return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"


def load(dry_run: bool, min_score: int) -> None:
    import psycopg
    from psycopg.rows import dict_row
    from rapidfuzz import fuzz

    if not DSN:
        sys.exit("load needs DATABASE_URL / SUPABASE_DB_URL")

    parsed = _read_jsonl(PARSED)
    print(f"Parsed records: {len(parsed)} | dry-run={dry_run}")

    matched_def = unmatched_def = no_insp = no_fac = updated = 0

    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        for rec in parsed:
            pid = rec.get("provider_id")
            # The portal's own gvInspections date (manifest_date) is the most
            # reliable inspection date; OCR'd survey_date is the fallback.
            iso = _to_iso(rec.get("manifest_date") or "") or _to_iso(rec.get("survey_date") or "")
            if not iso:
                continue

            frow = None
            with conn.cursor() as cur:
                if pid:
                    cur.execute(
                        "SELECT id FROM facilities WHERE state_code='MO' AND external_id=%s LIMIT 1",
                        (pid,),
                    )
                    frow = cur.fetchone()
                if not frow and rec.get("facility_name"):
                    # Fallback: match on name + city when the provider id didn't OCR.
                    words = [w for w in re.split(r"\W+", rec["facility_name"]) if len(w) > 2][:3]
                    pattern = "%" + "%".join(words) + "%" if words else rec["facility_name"]
                    cur.execute(
                        "SELECT id FROM facilities WHERE state_code='MO' AND name ILIKE %s "
                        "AND upper(city)=upper(%s) LIMIT 1",
                        (pattern, rec.get("city") or ""),
                    )
                    frow = cur.fetchone()
            if not frow:
                no_fac += 1
                continue
            fac_id = frow["id"]

            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM inspections WHERE facility_id=%s AND inspection_date::date=%s::date "
                    "ORDER BY id LIMIT 1",
                    (fac_id, iso),
                )
                irow = cur.fetchone()
            if not irow:
                no_insp += 1
                continue
            insp_id = irow["id"]

            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, code, description, inspector_narrative, immediate_jeopardy "
                    "FROM deficiencies WHERE inspection_id=%s",
                    (insp_id,),
                )
                defs = cur.fetchall()

            used: set[str] = set()
            for tag in rec["tags"]:
                if len(tag["narrative"]) < 60:
                    continue
                # Fuzzy-match the SOD requirement text to a deficiency.description.
                req = tag["requirement"]
                best, best_score = None, -1
                for d in defs:
                    if d["id"] in used:
                        continue
                    score = fuzz.token_set_ratio(req, d["description"] or "")
                    if score > best_score:
                        best, best_score = d, score
                if not best or best_score < min_score:
                    unmatched_def += 1
                    continue
                used.add(best["id"])
                matched_def += 1
                if dry_run:
                    print(f"  {rec['facility_name']} {iso} [{best_score}] "
                          f"{tag['rule_cite']} -> def {best['code']}: "
                          f"{tag['narrative'][:70]}...")
                    continue
                narrative = tag["narrative"]
                # OR with the existing flag/severity — a narrative that doesn't
                # happen to repeat "immediate jeopardy" must never downgrade a
                # row the original ingest already correctly flagged as IJ.
                ij = bool(best["immediate_jeopardy"]) or bool(
                    re.search(r"\bimmediate\s+jeopardy\b|\bij\b", narrative, re.IGNORECASE)
                )
                severity = 4 if (ij or _SEV4_RE.search(narrative)) else 2
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE deficiencies SET inspector_narrative=%s, class=COALESCE(%s, class), "
                        "residents_affected=COALESCE(%s, residents_affected), "
                        "severity=%s, immediate_jeopardy=%s WHERE id=%s",
                        (narrative, tag.get("class"), tag.get("residents_affected"),
                         severity, ij, best["id"]),
                    )
                updated += 1

            # Store the full SOD text + the real, working deep link on the
            # inspection (replaces the fabricated 404 source_url nulled by 0059).
            if not dry_run:
                insid = rec.get("insid")
                src_url = (
                    f"https://healthapps.dhss.mo.gov/ShowMeLTC/inspection_detail.aspx?insid={insid}"
                    if insid else None
                )
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE inspections SET raw_data = COALESCE(raw_data,'{}'::jsonb) "
                        "|| jsonb_build_object('narrative', %s::text, 'sod_source','ShowMeLTC'), "
                        "source_url = COALESCE(%s, source_url) "
                        "WHERE id=%s",
                        (rec["full_text"], src_url, insp_id),
                    )
        if not dry_run:
            conn.commit()

    print(f"\nLoad done. matched_def={matched_def} updated={updated} "
          f"unmatched_def={unmatched_def} no_insp={no_insp} no_fac={no_fac}")
    if not dry_run:
        print("Next: python3 scrapers/refresh_snapshot_cache.py --state MO  "
              "(and optionally scrapers/summarize_inspections.py for MO)")


# ===========================================================================
# CLI
# ===========================================================================

def main() -> None:
    p = argparse.ArgumentParser(description="Missouri SOD narrative ingest (crawl/ocr/load)")
    sub = p.add_subparsers(dest="mode", required=True)

    pc = sub.add_parser("crawl", help="Playwright crawl ShowMeLTC -> download SOD PDFs")
    pc.add_argument("--cities", help="comma-separated city names (UPPER), e.g. SPRINGFIELD")
    pc.add_argument("--from-db", action="store_true", help="crawl every MO city present in facilities")
    pc.add_argument("--only-name", help="only facilities whose name contains this (debug)")
    pc.add_argument("--max-facilities", type=int, default=None)
    pc.add_argument("--delay", type=float, default=1.0, help="seconds between PDF downloads")
    pc.add_argument("--no-headless", action="store_true")

    po = sub.add_parser("ocr", help="OCR + parse downloaded PDFs")
    po.add_argument("--limit", type=int, default=None)

    pl = sub.add_parser("load", help="write narratives into the DB")
    pl.add_argument("--dry-run", action="store_true")
    pl.add_argument("--min-score", type=int, default=70, help="rapidfuzz token_set_ratio threshold")

    args = p.parse_args()

    if args.mode == "crawl":
        if args.from_db:
            cities = _mo_cities_from_db()
        elif args.cities:
            cities = [c.strip().upper() for c in args.cities.split(",") if c.strip()]
        else:
            sys.exit("crawl needs --cities or --from-db")
        crawl(cities, args.only_name, args.max_facilities, args.delay, not args.no_headless)
    elif args.mode == "ocr":
        ocr(args.limit)
    elif args.mode == "load":
        load(args.dry_run, args.min_score)


if __name__ == "__main__":
    main()
