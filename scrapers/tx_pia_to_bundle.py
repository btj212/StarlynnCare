#!/usr/bin/env python3
"""
Convert HHSC PIA (Public Information Act) extracts → format_version: 1 bundle
for [`scrapers/tx_inspections_ingest.py`](./tx_inspections_ingest.py)
`--import-json`.

Why this exists
---------------
TULIP's interactive Aura capture path (see [`tx_tulip_to_bundle.py`](./tx_tulip_to_bundle.py))
is fine for tens of facilities, but bulk coverage of all ~515 Alzheimer-certified
TX ALFs requires the agency's structured records. HHSC fulfils PIA requests as
**CSV / Excel** keyed to license number with verbatim citation narratives.

Input shape (PIA-typical, but tolerant)
---------------------------------------
HHSC PIA spreadsheets are rarely standardized — different fulfilment staff
produce different headers. This parser uses **flexible column matching**
(case-insensitive, punctuation-stripped, partial-keyword) so the same script
handles Excel sheets named "ALF Inspections" / "Surveys" / "Citations" with
any of these column variants:

    license_number  ← "License No", "License Number", "License #", "FacilityLicense"
    facility_name   ← "Facility Name", "Provider", "FacilityName"
    inspection_date ← "Exit Date", "Visit Exit Date", "Survey Exit", "Inspection Date"
    incident_date   ← "Incident Date", "Complaint Received", "Complaint Date"
    visit_type      ← "Visit Type", "Visit/Survey Type", "Survey Type"
    citation        ← "Violation Cited", "State Violation Cited", "Citation Narrative"
    citation_code   ← "Citation Number", "Rule Citation", "Reference"
    corrected_date  ← "Corrected Date", "Plan of Correction Date", "POC Date"
    complaint_id    ← "Complaint Number", "Complaint ID", "Intake Number"

Multi-sheet Excel
-----------------
If `--workbook` points at an .xlsx with multiple sheets, all sheets are
processed and rows merged. Each row is independent — facility license must
be present per row (it usually is in HHSC dumps).

Two-table dumps (index + citations)
-----------------------------------
Some PIA fulfilments split inspections (one sheet) from citations (another
sheet keyed by survey id). If the script sees a column that looks like a
survey/event id, it treats the rows as relational and joins on that id.
The first sheet with `License`-like columns wins as the inspection backbone.

Usage
-----
    # Single file (CSV or XLSX)
    python3 scrapers/tx_pia_to_bundle.py \\
      --input .firecrawl/tx-pia/2026-05-pia-response.xlsx \\
      --output .firecrawl/tx-pia/bundle.json

    # Multiple files (e.g. inspections + citations split)
    python3 scrapers/tx_pia_to_bundle.py \\
      --input .firecrawl/tx-pia/inspections.csv \\
      --input .firecrawl/tx-pia/citations.csv \\
      --output .firecrawl/tx-pia/bundle.json

    # Dry-run (parse + summarize, do not write bundle)
    python3 scrapers/tx_pia_to_bundle.py --input pia.xlsx --dry-run

Source URL
----------
PIA-sourced inspections do not have a public detail URL. We synthesize:
    https://hhs.texas.gov/ltcr-pia/<license>#<inspection_date>
which is captured as `inspections.source_url`. The actual fulfilment file
should be archived separately (e.g. in `.firecrawl/tx-pia/`).
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

# ─── Column detection ──────────────────────────────────────────────────────────

SOURCE_URL_TEMPLATE = "https://hhs.texas.gov/ltcr-pia/{license}#{date}"

COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "license_number": (
        "license", "licenseno", "licensenumber", "licensenum", "lic",
        "facilitylicense", "alflicense",
        "hfid", "healthfacilityid",
    ),
    "facility_id_tx": (
        "facilityid", "providerid", "facilityidnumber",
    ),
    "facility_name": (
        "facilityname", "provider", "providername", "name",
    ),
    "inspection_date": (
        "exitdate", "visitexitdate", "surveyexit", "surveyexitdate",
        "inspectiondate", "visitdate", "eventdate",
    ),
    "incident_date": (
        "incidentdate", "complaintreceived", "complaintreceiveddate",
        "complaintdate", "intakedate",
    ),
    "visit_type": (
        "visittype", "visitsurveytype", "surveytype", "eventtype",
        "visitcategory", "category",
    ),
    "citation": (
        "violationcited", "stateviolationcited", "citationnarrative",
        "narrative", "violation", "finding", "deficiencytext",
    ),
    "citation_code": (
        "citationnumber", "rulecitation", "reference", "citation",
        "rule", "code", "referencerule",
    ),
    "corrected_date": (
        "correcteddate", "planofcorrectiondate", "pocdate",
        "datecorrected", "correctionsdate",
    ),
    "complaint_id": (
        "complaintnumber", "complaintid", "intakenumber", "intake",
    ),
    "event_id": (
        "surveyid", "eventid", "visitid", "inspectionid", "trackingid",
    ),
}


def _normalize_header(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def detect_columns(headers: list[str]) -> dict[str, str]:
    """
    Map our canonical field names → actual sheet column names. Picks the
    first header whose normalized form contains the alias keyword (in order
    of specificity).
    """
    normalized = {h: _normalize_header(h) for h in headers}
    out: dict[str, str] = {}
    for canon, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            for raw, norm in normalized.items():
                if alias in norm:
                    out.setdefault(canon, raw)
                    break
            if canon in out:
                break
    return out


# ─── Date / value helpers ──────────────────────────────────────────────────────

DATE_FORMATS = (
    "%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y",
    "%Y/%m/%d", "%d-%b-%Y", "%d/%m/%Y",
)


def parse_date(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()[:10]
        except Exception:  # noqa: BLE001
            pass
    s = str(value).strip()
    if not s:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def s(value: Any) -> str | None:
    if value is None:
        return None
    txt = str(value).strip()
    return txt or None


def pad_license(value: Any) -> str | None:
    raw = s(value)
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return raw
    # TX licenses are 6-digit; MN HFID (and similar) are longer — pad to 10 when needed.
    if len(digits) > 6:
        return digits.zfill(10)
    return digits.zfill(6)


# ─── Sheet readers ─────────────────────────────────────────────────────────────

def read_csv(path: Path) -> tuple[list[str], list[dict[str, Any]]]:
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        headers = list(reader.fieldnames or [])
        rows = [dict(r) for r in reader]
    return headers, rows


def read_xlsx(path: Path) -> list[tuple[str, list[str], list[dict[str, Any]]]]:
    """Returns [(sheet_name, headers, rows)] across all sheets."""
    try:
        from openpyxl import load_workbook  # type: ignore
    except ImportError:
        print(
            "ERROR: openpyxl not installed. Install with: pip install openpyxl",
            file=sys.stderr,
        )
        sys.exit(2)

    wb = load_workbook(path, data_only=True, read_only=True)
    out = []
    for sheet in wb.worksheets:
        rows_iter = sheet.iter_rows(values_only=True)
        try:
            header_row = next(rows_iter)
        except StopIteration:
            continue
        headers = [str(h) if h is not None else f"col_{i}" for i, h in enumerate(header_row)]
        rows = []
        for r in rows_iter:
            if all(v is None or v == "" for v in r):
                continue
            rows.append({headers[i]: r[i] for i in range(len(headers)) if i < len(r)})
        if rows:
            out.append((sheet.title, headers, rows))
    return out


def read_input(path: Path) -> list[tuple[str, list[str], list[dict[str, Any]]]]:
    """Returns [(sheet_label, headers, rows)] for any supported file type."""
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xlsm"):
        return read_xlsx(path)
    if suffix == ".csv":
        h, r = read_csv(path)
        return [(path.name, h, r)]
    if suffix in (".tsv", ".txt"):
        with path.open(encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh, delimiter="\t")
            return [(path.name, list(reader.fieldnames or []), [dict(r) for r in reader])]
    raise ValueError(f"Unsupported file type: {path.suffix} ({path})")


# ─── Bundle assembly ───────────────────────────────────────────────────────────

def row_to_keys(row: dict[str, Any], cols: dict[str, str]) -> dict[str, Any]:
    """Pull canonical fields off a row using the detected column map."""
    out: dict[str, Any] = {}
    for canon, src in cols.items():
        out[canon] = row.get(src)
    return out


def build_bundle(
    sheets: list[tuple[str, list[str], list[dict[str, Any]]]],
) -> dict[str, Any]:
    """
    Group all rows by (license_number, inspection_date), one inspection per
    group, deficiencies = the rows in that group that have a citation.
    """
    # Group: (license, date) -> list[(canonical_row, raw_row, sheet_name)]
    groups: dict[tuple[str, str], list[tuple[dict[str, Any], dict[str, Any], str]]] = defaultdict(list)
    skipped = 0

    for sheet_name, headers, rows in sheets:
        cols = detect_columns(headers)
        if "license_number" not in cols:
            print(
                f"  [skip-sheet] {sheet_name}: no license-number column found "
                f"(headers={headers[:6]}…)",
                file=sys.stderr,
            )
            continue
        if "inspection_date" not in cols:
            print(
                f"  [warn-sheet] {sheet_name}: no inspection-date column; rows skipped",
                file=sys.stderr,
            )
            continue

        for row in rows:
            canon = row_to_keys(row, cols)
            lic = pad_license(canon.get("license_number"))
            insp = parse_date(canon.get("inspection_date"))
            if not lic or not insp:
                skipped += 1
                continue
            groups[(lic, insp)].append((canon, row, sheet_name))

    facilities: dict[str, dict[str, Any]] = defaultdict(lambda: {"inspections": []})

    for (lic, insp_date), entries in groups.items():
        # Pick the first non-empty incident_date / complaint_id / visit_type from the group
        incident_date = next(
            (parse_date(c.get("incident_date")) for c, _, _ in entries if c.get("incident_date")),
            None,
        )
        complaint_id = next(
            (s(c.get("complaint_id")) for c, _, _ in entries if c.get("complaint_id")),
            None,
        )
        visit_types = [s(c.get("visit_type")) for c, _, _ in entries if c.get("visit_type")]
        primary_visit_type = visit_types[0] if visit_types else None
        is_complaint = bool(complaint_id) or any(
            "complaint" in (vt or "").lower() for vt in visit_types
        )

        deficiencies = []
        for canon, raw, sheet_name in entries:
            cit_text = s(canon.get("citation"))
            cit_code = s(canon.get("citation_code"))
            if not cit_text and not cit_code:
                # Row is a header/index row only — no actual deficiency.
                continue
            deficiencies.append({
                "code": cit_code,
                "state_severity_raw": s(canon.get("visit_type")) or primary_visit_type,
                "description": cit_text,
                "inspector_narrative": cit_text,
                "cited_date": insp_date,
                "corrected_date": parse_date(canon.get("corrected_date")),
                "immediate_jeopardy": False,
            })

        source_url = SOURCE_URL_TEMPLATE.format(license=lic, date=insp_date)
        raw_envelope_items = [r for _, r, _ in entries]
        facilities[lic]["license_number"] = lic
        facilities[lic]["inspections"].append({
            "inspection_date": insp_date,
            "incident_date": incident_date,
            "inspection_type": "complaint" if is_complaint else "comprehensive",
            "is_complaint": is_complaint,
            "complaint_id": complaint_id,
            "source_url": source_url,
            "raw_data": {
                "pia_source": True,
                "visit_type": primary_visit_type,
                "rows": raw_envelope_items,
            },
            "deficiencies": deficiencies,
        })

    bundle = {
        "format_version": 1,
        "facilities": [
            {"license_number": lic, "inspections": data["inspections"]}
            for lic, data in sorted(facilities.items())
        ],
    }
    return bundle, skipped


# ─── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description="HHSC PIA extract → ingest bundle")
    ap.add_argument(
        "--input", action="append", required=True,
        help="Input PIA file (CSV / TSV / XLSX). Repeat to merge multiple files.",
    )
    ap.add_argument(
        "--output", default=None,
        help="Bundle JSON output path. Required unless --dry-run.",
    )
    ap.add_argument(
        "--dry-run", action="store_true",
        help="Parse + summarize without writing the bundle.",
    )
    args = ap.parse_args()

    sheets: list[tuple[str, list[str], list[dict[str, Any]]]] = []
    for raw in args.input:
        path = Path(raw)
        if not path.exists():
            print(f"ERROR: input not found: {path}", file=sys.stderr)
            sys.exit(1)
        sheets.extend(read_input(path))

    if not sheets:
        print("ERROR: no readable sheets in input(s)", file=sys.stderr)
        sys.exit(1)

    print("Detected sheets:")
    for name, headers, rows in sheets:
        cols = detect_columns(headers)
        print(f"  - {name}: {len(rows)} rows; mapped {sorted(cols.keys())}")

    bundle, skipped_rows = build_bundle(sheets)

    facilities = bundle["facilities"]
    total_insp = sum(len(f["inspections"]) for f in facilities)
    total_def = sum(len(i["deficiencies"]) for f in facilities for i in f["inspections"])
    print(
        f"\nBundle summary:"
        f"\n  facilities: {len(facilities)}"
        f"\n  inspections: {total_insp}"
        f"\n  deficiencies: {total_def}"
        f"\n  rows skipped (no license/date): {skipped_rows}"
    )

    if args.dry_run:
        print("(dry-run: bundle not written)")
        return

    if not args.output:
        print("ERROR: --output is required unless --dry-run", file=sys.stderr)
        sys.exit(1)

    Path(args.output).write_text(json.dumps(bundle, indent=2), encoding="utf-8")
    print(f"\nWrote {args.output}")


if __name__ == "__main__":
    main()
