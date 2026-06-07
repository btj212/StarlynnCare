"""Preview what buildFacilitySnippet would output for real facilities.

Picks a handful of facilities with grade data and prints the meta description
that the new helper would produce.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

import psycopg
from psycopg.rows import dict_row


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


REGULATOR_ABBR = {
    "CA": "CDSS",
    "TX": "HHSC",
    "OR": "OR DHS",
    "WA": "DSHS",
    "MN": "MDH",
}

STATE_NAMES = {
    "CA": "California",
    "TX": "Texas",
    "OR": "Oregon",
    "WA": "Washington",
    "MN": "Minnesota",
}


def short_month_year(iso: str | None) -> str | None:
    if not iso:
        return None
    d = datetime.fromisoformat(str(iso))
    return d.strftime("%b %Y")


def build_facility_snippet(*, facility_name: str, state_name: str, state_code: str,
                           grade: str | None, percentile: int | None,
                           citation_count: int, last_inspection_date: str | None,
                           variant: str = "meta") -> str:
    reg = REGULATOR_ABBR.get(state_code, "state")
    rank_frag = None
    if grade and percentile is not None:
        if percentile >= 50:
            rank_frag = f"Grade {grade}, ranked in the top {100 - percentile}% of {state_name} memory care"
        else:
            rank_frag = f"Grade {grade}, ranked in the bottom {percentile}% of {state_name} memory care"
    cite_frag = (
        f"{citation_count} {reg} citation{'' if citation_count == 1 else 's'} on record"
        if citation_count > 0
        else f"no {reg} citations on record"
    )
    insp_frag = f"last inspected {short_month_year(last_inspection_date)}" if last_inspection_date else None
    parts = [p for p in (rank_frag, cite_frag, insp_frag) if p]
    if variant == "prose":
        if rank_frag:
            tail = "; ".join(p for p in (cite_frag, insp_frag) if p)
            return f"{facility_name} is {rank_frag} with {tail}."
        tail = f"; {insp_frag}" if insp_frag else ""
        return f"{facility_name} has {cite_frag}{tail}."
    return f"What {facility_name}'s website won't show you: {' · '.join(parts)}."


def clip(text: str, max_len: int = 160) -> str:
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def main() -> int:
    load_dotenv(Path(".env.local"))
    url = os.environ["DATABASE_URL"]

    states = ["CA", "TX", "OR", "WA", "MN"]
    picks_per_state = 2

    facility_sql = """
      SELECT f.id, f.name, f.state_code, f.city, f.city_slug, f.slug
      FROM facilities f
      WHERE f.publishable = true
        AND f.state_code = %(code)s
      ORDER BY random()
      LIMIT %(n)s;
    """

    insp_sql = """
      SELECT inspection_date
      FROM inspections
      WHERE facility_id = %(fid)s AND is_complaint = false
      ORDER BY inspection_date DESC
      LIMIT 1;
    """

    insp_total_sql = """
      SELECT COUNT(d.*) AS n
      FROM inspections i
      LEFT JOIN deficiencies d ON d.inspection_id = i.id
      WHERE i.facility_id = %(fid)s;
    """

    with psycopg.connect(url, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            print("Sample buildFacilitySnippet output (meta + prose variants):\n")
            print("=" * 80)
            sample_count = 0
            for code in states:
                cur.execute(facility_sql, {"code": code, "n": 10})  # we'll filter for grade
                rows = cur.fetchall()
                picked = 0
                for row in rows:
                    if picked >= picks_per_state:
                        break
                    fid = row["id"]
                    cur.execute("SELECT facility_snapshot(%(fid)s) AS snap;", {"fid": fid})
                    snap_row = cur.fetchone()
                    snap = snap_row["snap"] if snap_row else None
                    grade = snap.get("grade") if snap else None
                    letter = grade.get("letter") if grade else None
                    pct = grade.get("composite_percentile") if grade else None

                    cur.execute(insp_total_sql, {"fid": fid})
                    insp_total = cur.fetchone()["n"]

                    cur.execute(insp_sql, {"fid": fid})
                    last_row = cur.fetchone()
                    last_date = str(last_row["inspection_date"]) if last_row else None

                    state_name = STATE_NAMES[code]
                    meta = build_facility_snippet(
                        facility_name=row["name"],
                        state_name=state_name,
                        state_code=code,
                        grade=letter,
                        percentile=pct,
                        citation_count=insp_total,
                        last_inspection_date=last_date,
                        variant="meta",
                    )
                    prose = build_facility_snippet(
                        facility_name=row["name"],
                        state_name=state_name,
                        state_code=code,
                        grade=letter,
                        percentile=pct,
                        citation_count=insp_total,
                        last_inspection_date=last_date,
                        variant="prose",
                    )
                    meta_clipped = clip(meta)
                    title = f"{row['name']} — Quality Score & Inspection Record | StarlynnCare"
                    print(f"\n[{code}] {row['name']}  (grade={letter}, pct={pct}, cites={insp_total}, last={last_date})")
                    print(f"  URL: /{code.lower()}/{row['city_slug']}/{row['slug']}")
                    print(f"  TITLE ({len(title)}c): {title}")
                    print(f"  META  ({len(meta_clipped)}c): {meta_clipped}")
                    print(f"  PROSE ({len(prose)}c): {prose}")
                    sample_count += 1
                    picked += 1
            print(f"\n{sample_count} samples shown")
    return 0


if __name__ == "__main__":
    sys.exit(main())
