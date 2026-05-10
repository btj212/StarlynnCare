"""One-off count of "thin" facility pages across the five active states.

A facility is "thin" when it has:
- No inspections
- No published reviews
- No tour_questions (NULL or empty array in content JSONB)
- No photos (photo_url NULL AND photo_urls NULL or empty)

This script informs whether the noindex guardrail in generateMetadata should ship
or whether to backfill content first.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg


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


def main() -> int:
    load_dotenv(Path(".env.local"))
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL not found", file=sys.stderr)
        return 1

    states = ("CA", "TX", "OR", "WA", "MN")

    sql = """
    WITH publishable AS (
      SELECT f.id, f.state_code, f.name, f.slug, f.city_slug,
             f.content, f.photo_url, f.photo_urls
      FROM facilities f
      WHERE f.publishable = true
        AND f.state_code = ANY(%(states)s)
    ),
    insp_counts AS (
      SELECT facility_id, COUNT(*) AS n
      FROM inspections
      GROUP BY facility_id
    ),
    rev_counts AS (
      SELECT facility_id, COUNT(*) AS n
      FROM reviews
      WHERE status = 'published'
      GROUP BY facility_id
    )
    SELECT
      p.state_code,
      COUNT(*) AS publishable_total,
      COUNT(*) FILTER (
        WHERE COALESCE(ic.n, 0) = 0
          AND COALESCE(rc.n, 0) = 0
          AND (
            p.content->'tour_questions' IS NULL
            OR jsonb_typeof(p.content->'tour_questions') = 'null'
            OR jsonb_array_length(p.content->'tour_questions') = 0
          )
          AND p.photo_url IS NULL
          AND (
            p.photo_urls IS NULL
            OR array_length(p.photo_urls, 1) IS NULL
          )
      ) AS thin_total
    FROM publishable p
    LEFT JOIN insp_counts ic ON ic.facility_id = p.id
    LEFT JOIN rev_counts rc ON rc.facility_id = p.id
    GROUP BY p.state_code
    ORDER BY p.state_code;
    """

    sample_sql = """
    WITH publishable AS (
      SELECT f.id, f.state_code, f.name, f.slug, f.city_slug
      FROM facilities f
      WHERE f.publishable = true
        AND f.state_code = ANY(%(states)s)
    ),
    insp_counts AS (
      SELECT facility_id, COUNT(*) AS n FROM inspections GROUP BY facility_id
    ),
    def_counts AS (
      SELECT i.facility_id, COUNT(d.*) AS n
      FROM inspections i
      LEFT JOIN deficiencies d ON d.inspection_id = i.id
      GROUP BY i.facility_id
    ),
    last_insp AS (
      SELECT i.facility_id, MAX(i.inspection_date) AS last_date
      FROM inspections i
      WHERE i.is_complaint = false
      GROUP BY i.facility_id
    )
    SELECT p.id, p.name, p.state_code, p.city_slug, p.slug,
           COALESCE(dc.n, 0) AS deficiencies,
           li.last_date AS last_inspection
    FROM publishable p
    LEFT JOIN insp_counts ic ON ic.facility_id = p.id
    LEFT JOIN def_counts dc ON dc.facility_id = p.id
    LEFT JOIN last_insp li ON li.facility_id = p.id
    WHERE COALESCE(ic.n, 0) > 0
      AND COALESCE(dc.n, 0) > 0
      AND li.last_date IS NOT NULL
    ORDER BY p.state_code, dc.n DESC
    LIMIT 30;
    """

    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {"states": list(states)})
            rows = cur.fetchall()
            grand_pub = 0
            grand_thin = 0
            print("Thin-page counts (publishable, no inspections/reviews/tour_questions/photos):\n")
            print(f"{'STATE':<6} {'PUBLISHABLE':>12} {'THIN':>8} {'%THIN':>8}")
            print("-" * 38)
            for code, pub, thin in rows:
                pct = (thin / pub * 100.0) if pub else 0.0
                print(f"{code:<6} {pub:>12} {thin:>8} {pct:>7.2f}%")
                grand_pub += pub
                grand_thin += thin
            grand_pct = (grand_thin / grand_pub * 100.0) if grand_pub else 0.0
            print("-" * 38)
            print(f"{'TOTAL':<6} {grand_pub:>12} {grand_thin:>8} {grand_pct:>7.2f}%")

            cur.execute(sample_sql, {"states": list(states)})
            sample_rows = cur.fetchall()
            print("\nSample facilities with grade-eligible data (for meta preview):\n")
            for r in sample_rows[:10]:
                fid, name, code, city_slug, slug, defs, last = r
                print(f"  [{code}] {name} (defs={defs}, last_insp={last}) -> /{code.lower()}/{city_slug}/{slug}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
