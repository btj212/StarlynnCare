#!/usr/bin/env python3
"""Search Console coverage audit.

Reads the two Google exports (the coverage chart, and the crawled-but-not-indexed
validation table) and compares them with the October 27 baseline. With a
database connection it classifies facility and hub URLs the same way the site
does: noindex, retain, or enrich.

The predicates mirror src/lib/seo/indexability.ts. A noindex facility must not
be in the sitemap. A photo-only home with no inspection may stay indexable if
Google finds it, but the sitemap does not request it.

Usage:
    python3 scripts/validate/search_console_coverage.py \
      --coverage-zip ~/Downloads/starlynncare.com-Coverage-2026-10-27.zip \
      --validation-zip ~/Downloads/starlynncare.com-Coverage-Validation-2026-10-27.zip

    python3 scripts/validate/search_console_coverage.py \
      --coverage-zip ... --validation-zip ... --check-live --url https://preview.example
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import subprocess
import sys
import zipfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]
AUDIT_PATH = REPO_ROOT / "docs" / "audits" / "search-console-coverage.md"
AZ_SMALL_BED_LIMIT = 10
STATE_SLUGS = {
    "california": "CA",
    "texas": "TX",
    "oregon": "OR",
    "washington": "WA",
    "minnesota": "MN",
    "utah": "UT",
    "illinois": "IL",
    "pennsylvania": "PA",
    "arizona": "AZ",
    "missouri": "MO",
    "colorado": "CO",
}
# Two- and three-segment editorial URLs are not city hubs or facility profiles.
EDITORIAL_SEGMENTS = {
    "facilities",
    "guides",
    "insights",
    "glossary",
    "cost-guide",
    "cost-by-city",
    "memory-care-licensing",
    "memory-care-vs-nursing-home",
    "type-a-b-c-licensing",
    "why-dshs-contract-isnt-a-quality-badge",
    "how-to-read-our-inspection-data",
    "37-questions-to-ask-on-a-tour",
    "personal-care-home-cost",
    "personal-care-home-vs-assisted-living",
    "what-is-a-personal-care-home",
}

# Chart date and counts from the October 27, 2026 Search Console export.
# Later exports are compared with these numbers. They are not a target to hit
# by noindexing cited homes.
OCTOBER_27_BASELINE = {
    "chart_date": "2026-10-22",
    "indexed": 1637,
    "not_indexed": 4773,
    "crawled_not_indexed": 3684,
    "validation_rows": 1162,
    "validation_failed": 162,
    "validation_pending": 1000,
    "validation_issue": "Crawled - currently not indexed",
}

SITEMAP_BLOCK_RE = re.compile(
    r"<sitemap>\s*<loc>([^<]+)</loc>(?:\s*<lastmod>([^<]+)</lastmod>)?",
    re.IGNORECASE,
)
URL_BLOCK_RE = re.compile(
    r"<url>\s*<loc>([^<]+)</loc>(?:\s*<lastmod>([^<]+)</lastmod>)?",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class FacilityFacts:
    state_code: str
    city_slug: str
    slug: str
    beds: int | None
    inspections: int
    deficiencies: int
    reviews: int
    tour_questions: int
    photos: int
    has_narrative: bool
    publishable: bool = True

    @property
    def key(self) -> tuple[str, str]:
        return (self.state_code, self.slug)


def az_small_home_without_citations(
    state_code: str,
    beds: int | None,
    deficiency_count: int,
) -> bool:
    return (
        state_code == "AZ"
        and beds is not None
        and beds <= AZ_SMALL_BED_LIMIT
        and deficiency_count == 0
    )


def facility_marked_noindex(facts: FacilityFacts) -> bool:
    """Same rule as facilityMarkedNoindex in src/lib/seo/indexability.ts."""
    no_record = (
        facts.inspections == 0
        and facts.reviews == 0
        and facts.tour_questions == 0
        and facts.photos == 0
    )
    return az_small_home_without_citations(
        facts.state_code, facts.beds, facts.deficiencies
    ) or no_record


def facility_listed_in_sitemap(facts: FacilityFacts) -> bool:
    """Sitemap request list. Photo-only homes with no inspection stay off it."""
    if not facts.publishable or facts.inspections < 1:
        return False
    return not az_small_home_without_citations(
        facts.state_code, facts.beds, facts.deficiencies
    )


def listing_hub_marked_noindex(facilities: list[FacilityFacts]) -> bool:
    return bool(facilities) and all(
        az_small_home_without_citations(item.state_code, item.beds, item.deficiencies)
        for item in facilities
    )


def facility_cohort(facts: FacilityFacts | None) -> str:
    """retain keeps a real record. enrich is a real record with nothing to quote. noindex cannot justify a listing."""
    if facts is None or not facts.publishable:
        return "missing"
    if facility_marked_noindex(facts):
        return "noindex"
    if facts.inspections > 0 and not facts.has_narrative:
        return "enrich"
    if facts.inspections == 0:
        return "enrich"
    return "retain"


def hub_cohort(facilities: list[FacilityFacts]) -> str:
    if not facilities:
        return "missing"
    if listing_hub_marked_noindex(facilities):
        return "noindex"
    indexable = [item for item in facilities if not facility_marked_noindex(item)]
    if indexable and all(not item.has_narrative for item in indexable):
        return "enrich"
    return "retain"


def classify_path(path: str) -> tuple[str, str | None]:
    """Return (kind, state slug). Build files are not content failures."""
    clean = urlparse(path).path
    parts = [part for part in clean.split("/") if part]
    if (
        clean.startswith("/_next/")
        or "opengraph-image" in clean
        or (parts and parts[0] == "favicon.ico")
        or clean.endswith((".js", ".css", ".woff2", ".ico"))
    ):
        return "asset", None
    if not parts or parts[0] not in STATE_SLUGS:
        return "other", None
    state = parts[0]
    if len(parts) >= 2 and parts[1] in EDITORIAL_SEGMENTS:
        return "editorial", state
    if len(parts) == 1:
        return "state", state
    if len(parts) == 2:
        return "hub", state
    if len(parts) == 3 and parts[2] == "facilities":
        return "hub", state
    if len(parts) == 3:
        return "facility", state
    return "other", state


def _norm_issue(value: str) -> str:
    return value.replace("–", "-").replace("—", "-").strip()


def _read_zip_csv(path: Path, name: str) -> list[dict[str, str]]:
    with zipfile.ZipFile(path) as archive:
        text = archive.read(name).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def parse_coverage_zip(path: Path) -> dict[str, Any]:
    chart = _read_zip_csv(path, "Chart.csv")
    issues = _read_zip_csv(path, "Critical issues.csv")
    dated = [row for row in chart if (row.get("Indexed") or "").strip()]
    if not dated:
        raise ValueError(f"{path} has no indexed counts")
    last = dated[-1]
    crawled = 0
    parsed_issues: list[tuple[str, int]] = []
    for row in issues:
        reason = (row.get("Reason") or "").strip()
        pages = int((row.get("Pages") or "0").strip() or "0")
        parsed_issues.append((reason, pages))
        if _norm_issue(reason).startswith("Crawled - currently not indexed"):
            crawled = pages
    return {
        "chart_date": last["Date"],
        "indexed": int(last["Indexed"]),
        "not_indexed": int(last["Not indexed"]),
        "crawled_not_indexed": crawled,
        "issues": parsed_issues,
    }


def parse_validation_zip(path: Path) -> dict[str, Any]:
    rows = _read_zip_csv(path, "Table.csv")
    metadata = {row["Property"]: row["Value"] for row in _read_zip_csv(path, "Metadata.csv")}
    parsed = []
    for row in rows:
        url = row["URL"].strip()
        kind, state = classify_path(urlparse(url).path)
        parsed.append(
            {
                "url": url,
                "path": urlparse(url).path,
                "status": (row.get("Status") or "").strip(),
                "kind": kind,
                "state": state,
            }
        )
    return {
        "issue": metadata.get("Issue", ""),
        "rows": parsed,
    }


def baseline_delta(coverage: dict[str, Any], validation: dict[str, Any]) -> dict[str, int]:
    statuses = Counter(row["status"] for row in validation["rows"])
    return {
        "indexed": coverage["indexed"] - int(OCTOBER_27_BASELINE["indexed"]),
        "not_indexed": coverage["not_indexed"] - int(OCTOBER_27_BASELINE["not_indexed"]),
        "crawled_not_indexed": coverage["crawled_not_indexed"] - int(OCTOBER_27_BASELINE["crawled_not_indexed"]),
        "validation_rows": len(validation["rows"]) - int(OCTOBER_27_BASELINE["validation_rows"]),
        "validation_failed": statuses.get("Failed", 0) - int(OCTOBER_27_BASELINE["validation_failed"]),
        "validation_pending": statuses.get("Pending", 0) - int(OCTOBER_27_BASELINE["validation_pending"]),
    }


def _places_user_photo(source: dict[str, Any]) -> bool:
    attribution = str(source.get("attribution") or "")
    name = str(source.get("source") or "")
    if attribution in {"© Google", "© Google Street View"}:
        return False
    return name == "Google Places" or " · " in attribution


def visible_photo_count(photo_url: Any, photo_urls: Any, photo_sources: Any) -> int:
    urls = [item for item in (photo_urls or []) if isinstance(item, str) and item]
    if not urls and isinstance(photo_url, str) and photo_url:
        urls = [photo_url]
    sources = photo_sources if isinstance(photo_sources, list) else []
    kept = 0
    for index, _url in enumerate(urls):
        source = sources[index] if index < len(sources) and isinstance(sources[index], dict) else None
        if source and _places_user_photo(source):
            continue
        kept += 1
    return kept


def tour_question_count(content: Any) -> int:
    if not isinstance(content, dict):
        return 0
    questions = content.get("tour_questions") or []
    if not isinstance(questions, list):
        return 0
    return sum(1 for question in questions if isinstance(question, str) and question.strip())


def load_county_cities() -> dict[tuple[str, str], tuple[str, ...]]:
    script = REPO_ROOT / "scripts" / "validate" / "list_county_regions.ts"
    result = subprocess.run(
        ["npx", "tsx", str(script)],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "county region list failed")
    payload = json.loads(result.stdout)
    return {
        (row["state"], row["slug"]): tuple(row["cities"])
        for row in payload
    }


def load_facilities(state_codes: list[str]) -> list[FacilityFacts]:
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from validate._lib import get_conn

    sql = """
        SELECT
            f.state_code,
            f.city_slug,
            f.slug,
            f.beds,
            f.publishable,
            f.photo_url,
            f.photo_urls,
            f.photo_sources,
            f.content,
            COUNT(DISTINCT i.id) AS inspections,
            COUNT(DISTINCT d.id) AS deficiencies,
            COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'published') AS reviews,
            bool_or(
                length(btrim(coalesce(i.narrative_summary, ''))) >= 100
                OR length(btrim(coalesce(i.raw_data->>'narrative', ''))) >= 100
            ) AS has_narrative
        FROM facilities f
        LEFT JOIN inspections i ON i.facility_id = f.id
        LEFT JOIN deficiencies d ON d.inspection_id = i.id
        LEFT JOIN reviews r ON r.facility_id = f.id
        WHERE f.publishable = true
          AND f.state_code = ANY(%s)
        GROUP BY f.id
    """
    facts: list[FacilityFacts] = []
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (state_codes,))
            for row in cur.fetchall():
                facts.append(
                    FacilityFacts(
                        state_code=row["state_code"],
                        city_slug=row["city_slug"] or "",
                        slug=row["slug"],
                        beds=row["beds"],
                        inspections=row["inspections"] or 0,
                        deficiencies=row["deficiencies"] or 0,
                        reviews=row["reviews"] or 0,
                        tour_questions=tour_question_count(row["content"]),
                        photos=visible_photo_count(
                            row["photo_url"], row["photo_urls"], row["photo_sources"]
                        ),
                        has_narrative=bool(row["has_narrative"]),
                        publishable=bool(row["publishable"]),
                    )
                )
    return facts


def facilities_for_hub(
    state_slug: str,
    hub_slug: str,
    facilities: list[FacilityFacts],
    counties: dict[tuple[str, str], tuple[str, ...]],
) -> tuple[str, list[FacilityFacts]]:
    state_code = STATE_SLUGS[state_slug]
    cities = counties.get((state_slug, hub_slug))
    kind = "county" if cities is not None else "city"
    city_set = set(cities) if cities is not None else {hub_slug}
    matched = [
        item
        for item in facilities
        if item.state_code == state_code and item.city_slug in city_set
    ]
    return kind, matched


def parity_counts(facilities: list[FacilityFacts]) -> dict[str, int]:
    """noindex-but-listed is a bug. indexable-but-unlisted is the photo-only exception."""
    counts = Counter()
    for facts in facilities:
        noindex = facility_marked_noindex(facts)
        listed = facility_listed_in_sitemap(facts)
        if noindex and listed:
            counts["noindex_but_listed"] += 1
        elif not noindex and not listed:
            counts["indexable_but_unlisted"] += 1
        elif noindex:
            counts["noindex_and_unlisted"] += 1
        else:
            counts["indexable_and_listed"] += 1
    return dict(counts)


def _examples(urls: list[str], limit: int = 12) -> list[str]:
    return urls[:limit]


def excluded_city_hubs(facilities: list[FacilityFacts]) -> list[str]:
    """City hubs whose every publishable home is an excluded Arizona small home."""
    by_city: dict[tuple[str, str], list[FacilityFacts]] = {}
    for facts in facilities:
        if facts.state_code != "AZ" or not facts.city_slug:
            continue
        by_city.setdefault((facts.state_code, facts.city_slug), []).append(facts)
    paths = []
    for (_state, city), homes in sorted(by_city.items()):
        if listing_hub_marked_noindex(homes):
            paths.append(f"/arizona/{city}")
    return paths


def capacity_band(beds: int | None) -> str:
    if beds is None:
        return "beds unknown"
    if beds <= 6:
        return "6 beds or fewer"
    if beds <= AZ_SMALL_BED_LIMIT:
        return "7 to 10 beds"
    return "11 beds or more"


def rejected_facility_facts(
    validation: dict[str, Any],
    facilities: list[FacilityFacts] | None,
) -> list[FacilityFacts | None]:
    """Failed facility URLs only. Google declined these after a crawl."""
    if facilities is None:
        return []
    by_key = {(item.state_code, item.slug): item for item in facilities}
    found: list[FacilityFacts | None] = []
    for row in validation["rows"]:
        if row["status"] != "Failed" or row["kind"] != "facility":
            continue
        if row["state"] not in STATE_SLUGS:
            continue
        parts = [part for part in row["path"].split("/") if part]
        if len(parts) < 3:
            continue
        found.append(by_key.get((STATE_SLUGS[row["state"]], parts[2])))
    return found


def _count_lines(title: str, counts: Counter[str]) -> list[str]:
    lines = [f"### {title}", ""]
    if not counts:
        lines.append("None.")
        lines.append("")
        return lines
    for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"- {label}: {count}")
    lines.append("")
    return lines


def rejected_breakdown_lines(
    validation: dict[str, Any],
    facilities: list[FacilityFacts] | None,
) -> list[str]:
    """State, size, inspection, citation, and narrative splits for declined facility URLs."""
    if facilities is None:
        return ["Database check skipped, so rejected facilities were not split.", ""]
    facts = rejected_facility_facts(validation, facilities)
    known = [item for item in facts if item is not None]
    missing = len(facts) - len(known)
    lines = [
        "## Rejected facilities",
        "",
        "These are facility URLs in the validation export whose status is Failed. "
        "A cited home stays indexable. A home with no bed count stays indexable. "
        "A missing narrative is an enrich job, not a noindex rule.",
        "",
        f"Failed facility URLs matched to a publishable row: {len(known)}. Unmatched: {missing}.",
        "",
    ]
    lines.extend(_count_lines("By state", Counter(item.state_code for item in known)))
    lines.extend(_count_lines("By capacity", Counter(capacity_band(item.beds) for item in known)))
    lines.extend(
        _count_lines(
            "By inspection",
            Counter("has an inspection" if item.inspections > 0 else "no inspection" for item in known),
        )
    )
    lines.extend(
        _count_lines(
            "By citation",
            Counter("has a citation" if item.deficiencies > 0 else "no citation" for item in known),
        )
    )
    lines.extend(
        _count_lines(
            "By content",
            Counter(
                "inspection with a stored narrative"
                if item.inspections > 0 and item.has_narrative
                else "inspection without a stored narrative"
                if item.inspections > 0
                else "no inspection"
                for item in known
            ),
        )
    )
    by_state: dict[str, list[FacilityFacts]] = {}
    for item in known:
        by_state.setdefault(item.state_code, []).append(item)
    lines.append("### Would a small-home rule fit any other state?")
    lines.append("")
    supported: list[str] = []
    for state, items in sorted(by_state.items()):
        small_uncited = [
            item
            for item in items
            if item.beds is not None and item.beds <= AZ_SMALL_BED_LIMIT and item.deficiencies == 0
        ]
        cited = [item for item in items if item.deficiencies > 0]
        unknown_beds = [item for item in items if item.beds is None]
        share = len(small_uncited) / len(items) if items else 0
        lines.append(
            f"- {state}: {len(items)} failed, {len(small_uncited)} are 10 beds or fewer with no citation, "
            f"{len(cited)} have a citation, {len(unknown_beds)} have no bed count."
        )
        # A new state rule needs the failed set to be mostly known-bed, uncited, small homes,
        # with no cited home in that failed set. Arizona already has the rule.
        if (
            state != "AZ"
            and items
            and not cited
            and not unknown_beds
            and share >= 0.8
            and len(small_uncited) >= 15
        ):
            supported.append(state)
    lines.append("")
    if supported:
        lines.append(
            "This export would support a small-home exclusion for: " + ", ".join(supported) + "."
        )
    else:
        lines.append(
            "This export supports Arizona's existing rule and does not support a new state exclusion. "
            "Other states stay indexable, including homes with unknown bed counts and homes that have been cited."
        )
    lines.append("")
    return lines


def render_report(
    coverage: dict[str, Any],
    validation: dict[str, Any],
    cohorts: dict[tuple[str, str, str], list[str]],
    parity: dict[str, int] | None,
    hub_notes: list[str],
    not_found_note: str,
    excluded_hubs: list[str],
    rejected_lines: list[str] | None = None,
) -> str:
    delta = baseline_delta(coverage, validation)
    statuses = Counter(row["status"] for row in validation["rows"])
    kinds = Counter((row["status"], row["kind"]) for row in validation["rows"])
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# Search Console coverage audit",
        "",
        f"Generated: {now}",
        "",
        "## October 27 baseline",
        "",
        "These are the counts in the October 27, 2026 export. A later export is a change from this point, not a new starting line.",
        "",
        f"- Chart date: {OCTOBER_27_BASELINE['chart_date']}",
        f"- Indexed: {OCTOBER_27_BASELINE['indexed']}",
        f"- Not indexed: {OCTOBER_27_BASELINE['not_indexed']}",
        f"- Crawled, currently not indexed: {OCTOBER_27_BASELINE['crawled_not_indexed']}",
        f"- Validation sample: {OCTOBER_27_BASELINE['validation_rows']} rows, {OCTOBER_27_BASELINE['validation_failed']} failed, {OCTOBER_27_BASELINE['validation_pending']} pending",
        "",
        "## This export",
        "",
        f"- Chart date: {coverage['chart_date']}",
        f"- Indexed: {coverage['indexed']} ({delta['indexed']:+d} from the baseline)",
        f"- Not indexed: {coverage['not_indexed']} ({delta['not_indexed']:+d})",
        f"- Crawled, currently not indexed: {coverage['crawled_not_indexed']} ({delta['crawled_not_indexed']:+d})",
        f"- Validation issue: {validation['issue'] or 'not recorded'}",
        f"- Validation rows: {len(validation['rows'])} ({dict(statuses)})",
        "",
        "### Critical issues",
        "",
    ]
    for reason, pages in coverage["issues"]:
        lines.append(f"- {reason}: {pages}")
    lines.extend(["", "### Validation URLs", ""])
    for (status, kind), count in sorted(kinds.items()):
        lines.append(f"- {status} / {kind}: {count}")
    lines.extend(
        [
            "",
            "## Cohorts",
            "",
            "Failed validation is Google declining a URL it already crawled. Pending has not been decided. Assets are ignored. A cited home stays indexable even when the narrative is missing; that gap is enrich, not removal. Narrative here means 100 characters of stored prose, which is the page's own bar.",
            "",
        ]
    )
    for key in sorted(cohorts):
        status, kind, cohort = key
        urls = cohorts[key]
        lines.append(f"### {status} / {kind} / {cohort}: {len(urls)}")
        lines.append("")
        for url in _examples(urls):
            lines.append(f"- `{url}`")
        if len(urls) > 12:
            lines.append(f"- … and {len(urls) - 12} more")
        lines.append("")
    if rejected_lines:
        lines.extend(rejected_lines)
    lines.extend(["## Indexability parity", ""])
    if parity is None:
        lines.append("Database check skipped.")
    else:
        lines.append(f"- Indexable and listed: {parity.get('indexable_and_listed', 0)}")
        lines.append(f"- Noindex and unlisted: {parity.get('noindex_and_unlisted', 0)}")
        lines.append(
            f"- Noindex but still listed (must be 0): {parity.get('noindex_but_listed', 0)}"
        )
        lines.append(
            "- Indexable but unlisted: "
            f"{parity.get('indexable_but_unlisted', 0)}. "
            "These are homes with no inspection that still have a review, tour question, or photo. "
            "The page can be indexed if found. The sitemap does not request them, because the not-indexed pile is already the problem."
        )
    lines.extend(["", "## Hub notes", ""])
    lines.append(
        "A hub stays indexable when it has one home worth ranking. A county URL that lists a single city also stays. The county name is its own page. A hub is noindex only when every home on it is an excluded Arizona small home."
    )
    lines.append("")
    if excluded_hubs:
        lines.append(
            f"{len(excluded_hubs)} Arizona city hubs have no indexable home and are omitted from the sitemap:"
        )
        lines.append("")
        for path in excluded_hubs:
            lines.append(f"- `{path}`")
    else:
        lines.append("No loaded Arizona city is made only of excluded homes.")
    lines.append("")
    lines.append(
        "URLs in the missing cohort are not publishable under that slug. They are not redirects."
    )
    if hub_notes:
        lines.append("")
        lines.extend(hub_notes)
    lines.extend(
        [
            "",
            "## Not found (404)",
            "",
            not_found_note,
            "",
            "No redirect or removal is proposed from the coverage total alone.",
            "",
        ]
    )
    return "\n".join(lines)


def assign_cohorts(
    validation: dict[str, Any],
    facilities: list[FacilityFacts] | None,
    counties: dict[tuple[str, str], tuple[str, ...]] | None,
) -> tuple[dict[tuple[str, str, str], list[str]], list[str]]:
    by_key = {}
    if facilities is not None:
        by_key = {(item.state_code, item.slug): item for item in facilities}
    cohorts: dict[tuple[str, str, str], list[str]] = {}
    hub_notes: list[str] = []
    single_city_counties = 0
    for row in validation["rows"]:
        kind = row["kind"]
        status = row["status"] or "unknown"
        if kind == "asset":
            cohort = "ignore"
        elif kind == "facility" and facilities is not None and row["state"] in STATE_SLUGS:
            parts = [part for part in row["path"].split("/") if part]
            facts = by_key.get((STATE_SLUGS[row["state"]], parts[2]))
            cohort = facility_cohort(facts)
        elif kind == "hub" and facilities is not None and counties is not None and row["state"]:
            hub_kind, matched = facilities_for_hub(
                row["state"], row["path"].rstrip("/").split("/")[-1], facilities, counties
            )
            cohort = hub_cohort(matched)
            if hub_kind == "county" and matched:
                cities = {item.city_slug for item in matched}
                if len(cities) == 1:
                    single_city_counties += 1
        elif kind in {"editorial", "state", "other"}:
            cohort = "retain"
        else:
            cohort = "unclassified"
        cohorts.setdefault((status, kind, cohort), []).append(row["url"])
    if single_city_counties:
        hub_notes.append(
            f"- {single_city_counties} county URLs in this sample list homes from only one city. "
            "They stay indexable. The county name is its own page, and this pass only drops a hub when every home on it is an excluded Arizona small home."
        )
    return cohorts, hub_notes


def _date_only(value: str | None) -> str:
    return (value or "").strip()[:10]


def live_sitemap_checks(base_url: str) -> list[str]:
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from validate._lib import fetch_page

    failures: list[str] = []
    status, index_xml = fetch_page(f"{base_url.rstrip('/')}/sitemap.xml", timeout=90)
    if status != 200:
        return [f"sitemap index returned {status}"]
    children = SITEMAP_BLOCK_RE.findall(index_xml)
    seen_locs: list[str] = []
    for loc, lastmod in children:
        child_status, child_xml = fetch_page(loc, timeout=90)
        if child_status != 200:
            failures.append(f"{loc} returned {child_status}")
            continue
        urls = URL_BLOCK_RE.findall(child_xml)
        locs = [item[0] for item in urls]
        seen_locs.extend(locs)
        duplicates = [url for url, count in Counter(locs).items() if count > 1]
        if duplicates:
            failures.append(f"{loc} repeats {len(duplicates)} URLs")
        content_dates = [_date_only(item[1]) for item in urls if _date_only(item[1])]
        newest = max(content_dates) if content_dates else ""
        index_date = _date_only(lastmod)
        if index_date and index_date != newest:
            failures.append(
                f"{loc} index lastmod {index_date or 'missing'} does not match newest page date {newest or 'none'}"
            )
        if index_date and not newest:
            failures.append(f"{loc} has an index date but no page dates")
    if len(seen_locs) != len(set(seen_locs)):
        failures.append("a URL appears in more than one sitemap")
    return failures


def live_page_checks(base_url: str, samples: list[dict[str, Any]], sitemap_locs: set[str]) -> list[str]:
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from validate._html_parse import (
        count_href_matches,
        extract_canonical,
        extract_jsonld_blocks,
        find_nodes_by_type,
        is_noindex,
    )
    from validate._lib import fetch_page

    failures: list[str] = []
    origin = base_url.rstrip("/")
    for sample in samples:
        url = sample["url"].replace("https://www.starlynncare.com", origin)
        status, html = fetch_page(url, timeout=60)
        path = urlparse(sample["url"]).path
        if status != 200:
            failures.append(f"{path} returned {status}")
            continue
        canonical = extract_canonical(html)
        expected = f"https://www.starlynncare.com{path}"
        if canonical and canonical != expected and not canonical.endswith(path):
            failures.append(f"{path} canonical is {canonical}")
        noindex = is_noindex(html)
        if sample["expect_noindex"] != noindex:
            failures.append(f"{path} noindex={noindex}, expected {sample['expect_noindex']}")
        blocks = extract_jsonld_blocks(html)
        if not find_nodes_by_type(blocks, "BreadcrumbList"):
            failures.append(f"{path} has no BreadcrumbList")
        if sample["kind"] == "facility":
            parts = [part for part in path.split("/") if part]
            hub = f"/{parts[0]}/{parts[1]}"
            if count_href_matches(html, hub) < 1:
                failures.append(f"{path} does not link to {hub}")
        listed = any(loc.rstrip("/").endswith(path.rstrip("/")) for loc in sitemap_locs)
        if sample["expect_listed"] != listed:
            failures.append(f"{path} sitemap listed={listed}, expected {sample['expect_listed']}")
    return failures


def select_samples(validation: dict[str, Any], cohorts: dict[tuple[str, str, str], list[str]]) -> list[dict[str, Any]]:
    wanted = [
        ("Failed", "facility", "noindex", True, False),
        ("Failed", "facility", "enrich", False, True),
        ("Failed", "facility", "retain", False, True),
        ("Pending", "hub", "noindex", True, False),
        ("Pending", "hub", "retain", False, True),
    ]
    samples = []
    for status, kind, cohort, expect_noindex, expect_listed in wanted:
        urls = cohorts.get((status, kind, cohort), [])
        if not urls:
            continue
        samples.append(
            {
                "url": urls[0],
                "kind": kind,
                "expect_noindex": expect_noindex,
                "expect_listed": expect_listed,
            }
        )
    return samples


def assert_index_policy() -> None:
    """Same table as scripts/test_indexability.ts. Cited, unknown-bed, and non-Arizona homes stay in."""
    cases = [
        ("AZ", 6, 2, 3, 0, 0, 0, False, True),
        ("IL", None, 0, 2, 0, 0, 0, False, True),
        ("AZ", 8, 0, 1, 0, 0, 1, True, False),
        ("OR", 6, 0, 2, 0, 0, 0, False, True),
        ("WA", 40, 0, 4, 0, 0, 0, False, True),
        ("TX", 80, 0, 0, 0, 0, 0, True, False),
        ("CA", 20, 0, 0, 0, 0, 2, False, False),
    ]
    for state, beds, deficiencies, inspections, reviews, tours, photos, noindex, listed in cases:
        facts = FacilityFacts(
            state_code=state,
            city_slug="city",
            slug="home",
            beds=beds,
            inspections=inspections,
            deficiencies=deficiencies,
            reviews=reviews,
            tour_questions=tours,
            photos=photos,
            has_narrative=inspections > 0,
        )
        assert facility_marked_noindex(facts) is noindex, state
        assert facility_listed_in_sitemap(facts) is listed, state
        assert not (facility_marked_noindex(facts) and facility_listed_in_sitemap(facts))


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit Search Console coverage exports")
    parser.add_argument("--coverage-zip", required=True, type=Path)
    parser.add_argument("--validation-zip", required=True, type=Path)
    parser.add_argument("--not-found-zip", type=Path, default=None)
    parser.add_argument("--check-live", action="store_true")
    parser.add_argument("--url", default="https://www.starlynncare.com")
    parser.add_argument("--skip-db", action="store_true")
    args = parser.parse_args()
    assert_index_policy()

    coverage = parse_coverage_zip(args.coverage_zip)
    validation = parse_validation_zip(args.validation_zip)
    facilities = None
    counties = None
    parity = None
    if not args.skip_db:
        state_codes = sorted(
            {
                STATE_SLUGS[row["state"]]
                for row in validation["rows"]
                if row["state"] in STATE_SLUGS
            }
        )
        counties = load_county_cities()
        facilities = load_facilities(state_codes)
        parity = parity_counts(facilities)
        if parity.get("noindex_but_listed", 0):
            print(
                f"FAIL  {parity['noindex_but_listed']} noindex facilities are still sitemap-eligible",
                file=sys.stderr,
            )
    cohorts, hub_notes = assign_cohorts(validation, facilities, counties)
    excluded_hubs = excluded_city_hubs(facilities or [])
    if args.not_found_zip:
        not_found_rows = _read_zip_csv(args.not_found_zip, "Table.csv")
        not_found_note = (
            f"The not-found export has {len(not_found_rows)} URLs. "
            "Classify them with this audit before proposing a redirect. None are proposed here."
        )
    else:
        not_found_note = (
            "These coverage files do not include the not-found URL table. "
            f"The issue total is {next((pages for reason, pages in coverage['issues'] if '404' in reason or 'Not found' in reason), 'unknown')}. "
            "Export that table before proposing a redirect or a removal."
        )
    report = render_report(
        coverage,
        validation,
        cohorts,
        parity,
        hub_notes,
        not_found_note,
        excluded_hubs,
        rejected_breakdown_lines(validation, facilities),
    )
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_PATH.write_text(report, encoding="utf-8")
    print(f"Wrote {AUDIT_PATH}")
    for key in sorted(cohorts):
        print(f"  {key[0]} / {key[1]} / {key[2]}: {len(cohorts[key])}")

    if not args.check_live:
        if parity and parity.get("noindex_but_listed", 0):
            sys.exit(1)
        return

    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from validate._html_parse import extract_sitemap_locs
    from validate._lib import fetch_page

    failures = live_sitemap_checks(args.url)
    status, index_xml = fetch_page(f"{args.url.rstrip('/')}/sitemap.xml", timeout=90)
    locs: set[str] = set()
    if status == 200:
        for loc in extract_sitemap_locs(index_xml):
            if loc.endswith(".xml"):
                child_status, child_xml = fetch_page(loc, timeout=90)
                if child_status == 200:
                    locs.update(extract_sitemap_locs(child_xml))
    samples = select_samples(validation, cohorts)
    if excluded_hubs:
        samples.append(
            {
                "url": f"https://www.starlynncare.com{excluded_hubs[0]}",
                "kind": "hub",
                "expect_noindex": True,
                "expect_listed": False,
            }
        )
    failures.extend(live_page_checks(args.url, samples, locs))
    if failures:
        print("Live checks failed:")
        for failure in failures:
            print(f"  - {failure}")
        sys.exit(1)
    print("Live checks passed")


if __name__ == "__main__":
    main()
