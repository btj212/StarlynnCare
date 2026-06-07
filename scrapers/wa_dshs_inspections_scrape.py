#!/usr/bin/env python3
"""
Fetch WA DSHS ALF report pages (BHForms.aspx) per facility license.

Reads license numbers (and optional Reports Location URLs) from the CSV produced
by wa_dshs_directory_scrape.py and fetches each facility's BHForms page:
  https://fortress.wa.gov/dshs/adsaapps/lookup/BHForms.aspx?Lic=<LICENSE>

Caches HTML under .firecrawl/wa-scrape/details/<license>.html for offline parsing.

Usage:
  python3 scrapers/wa_dshs_inspections_scrape.py \\
    --from-csv .firecrawl/wa-scrape/adv-lookup-2026-05-08.csv
  python3 scrapers/wa_dshs_inspections_scrape.py \\
    --from-csv .firecrawl/wa-scrape/adv-lookup-2026-05-08.csv --limit 10
  python3 scrapers/wa_dshs_inspections_scrape.py --licenses 2325,2511
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _http_helpers import make_session, polite_sleep, session_get

FORMS_TMPL = "https://fortress.wa.gov/dshs/adsaapps/lookup/BHForms.aspx?Lic={lic}"


def pad_wa_license(raw: Any) -> str:
    if raw is None or str(raw).strip() == "":
        return "0000000000"
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return str(raw).strip()[:32]
    return digits.zfill(10)


def licenses_from_csv(path: Path) -> list[str]:
    """Read raw license numbers from the directory CSV."""
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        headers = list(reader.fieldnames or [])
        col = None
        for h in headers:
            nk = re.sub(r"[^a-z0-9]", "", (h or "").lower())
            if nk == "licensenumber":
                col = h
                break
        if not col:
            for h in headers:
                nk = re.sub(r"[^a-z0-9]", "", (h or "").lower())
                if "license" in nk:
                    col = h
                    break
        if not col:
            raise ValueError("Could not detect license column in CSV")
        out: list[str] = []
        for row in reader:
            v = row.get(col)
            if v and str(v).strip():
                out.append(str(v).strip())
    return out


def fetch_details(
    licenses: list[str],
    out_dir: Path,
    *,
    delay_sec: float = 1.2,
    skip_cached: bool = True,
) -> list[Path]:
    sess = make_session()
    out_dir.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    for lic_raw in licenses:
        raw_digits = re.sub(r"\D", "", lic_raw) or lic_raw
        lic_padded = pad_wa_license(lic_raw)
        fn = out_dir / f"{lic_padded}.html"
        if skip_cached and fn.exists() and fn.stat().st_size > 500:
            saved.append(fn)
            continue
        url = FORMS_TMPL.format(lic=raw_digits)
        r = session_get(sess, url)
        if r.status_code != 200:
            print(f"[warn] {lic_padded} HTTP {r.status_code} {url}", file=sys.stderr)
        fn.write_bytes(r.content)
        saved.append(fn)
        print(f"Saved {fn.name} ({len(r.content)} bytes)")
        polite_sleep(delay_sec)
    return saved


def main() -> int:
    ap = argparse.ArgumentParser(description="WA DSHS ALF BHForms HTML cache")
    ap.add_argument("--from-csv", type=Path, default=None)
    ap.add_argument("--licenses", type=str, default=None, help="Comma-separated raw license numbers")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--no-cache", action="store_true", help="Re-fetch even if cached")
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=REPO_ROOT / ".firecrawl" / "wa-scrape" / "details",
    )
    args = ap.parse_args()

    lic_list: list[str] = []
    if args.from_csv:
        lic_list.extend(licenses_from_csv(args.from_csv))
    if args.licenses:
        lic_list.extend([x.strip() for x in args.licenses.split(",") if x.strip()])

    if not lic_list:
        print("Provide --from-csv or --licenses", file=sys.stderr)
        return 1

    if args.limit is not None:
        lic_list = lic_list[: args.limit]

    print(f"Fetching {len(lic_list)} WA facilities → {args.out_dir}")
    try:
        paths = fetch_details(lic_list, args.out_dir, skip_cached=not args.no_cache)
        print(f"Done. {len(paths)} HTML files in {args.out_dir}")
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
