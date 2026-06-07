#!/usr/bin/env python3
"""
Generate per-batch narrative request files for HHSC LTCR records management.

Why this exists
---------------
The HHSC bulk PIA delivery (FVH + IntakeHistory; see [`tx_pia_to_bundle.py`](./tx_pia_to_bundle.py))
contains coded violation references and complaint outcomes — but no inspector
narrative text. To get narratives, HHSC requires individual records requests
keyed by **survey EXIT_DATE / EVENTID** (for visits) or **RS Case No.** (for
complaints), submitted via fax / email / mail to:

    Email: RSLTCR.RecordsMgmt@hhs.texas.gov
    Fax:   512-438-2738
    Mail:  HHSC — Regulatory Services — LTC — Regulatory
           Records Management — MC: E-349
           PO Box 149030, Austin TX 78714-9030

Records requests exceeding 100 pages incur a fee. This script splits the
narrative-request universe into batches sized to stay under the 100-page
threshold (configurable), and emits both a structured CSV (audit trail)
and a human-readable email body per batch.

Default scope
-------------
- **Memory-care facilities only**: filtered to `tx_alzheimer_certified = True`
  via the lookup CSV ([`scrapers/data/tx_facility_lookup.csv`](./data/tx_facility_lookup.csv)).
- **Severity floor**: only request narratives for FVH visits whose deficiency
  letters include at least one of `{B, C, D, E, F, G, H, I, J, K, L}` (CMS
  scope/severity grid). A and 0 (no harm / no finding) excluded.
- **Substantiated complaints**: any IntakeHistory event with `Findings`
  starting with `SUBSTANTIATED` (covers both `AND CITED` and `BUT NOT CITED`).

Override with `--severity-min`, `--include-unsubstantiated`, or `--license`.

Usage
-----
    # Default: all memory-care narrative requests, 25 events/batch
    python3 scrapers/tx_narrative_request_batch.py \\
      --bundle .firecrawl/tx-pia/2026-05-bulk/bundle.json \\
      --out-dir out/tx-narrative-requests/

    # Smoke test: one facility, single 8-event batch
    python3 scrapers/tx_narrative_request_batch.py \\
      --bundle .firecrawl/tx-pia/2026-05-bulk/bundle.json \\
      --license 100450 --batch-size 8 \\
      --out-dir out/tx-narrative-requests/smoke/

    # Dry-run: print universe size + batch count, write nothing
    python3 scrapers/tx_narrative_request_batch.py \\
      --bundle .firecrawl/tx-pia/2026-05-bulk/bundle.json --dry-run
"""

from __future__ import annotations

import argparse
import csv
import datetime
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ROSTER = Path(__file__).resolve().parent / "data" / "tx_facility_lookup.csv"
DEFAULT_BUNDLE = REPO_ROOT / ".firecrawl" / "tx-pia" / "2026-05-bulk" / "bundle.json"

# CMS scope/severity grid in increasing-severity order.
SS_LETTERS_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]
LETTER_RANK = {ltr: i for i, ltr in enumerate(SS_LETTERS_ORDER)}


# ─── Data shape ──────────────────────────────────────────────────────────────

@dataclass
class NarrativeRequest:
    """One row in a request batch."""
    event_kind: str         # "visit" | "complaint"
    license_no: str
    facility_id: str
    facility_name: str
    city: str
    county: str
    event_date: str         # ISO YYYY-MM-DD
    event_id: str           # EVENTID for visits, RS Case No. for complaints
    visit_type: str         # "Health" / "LSC" for visits, "Complaint"/"Incident" for complaints
    severity_letters: str   # space-separated A-L letters (visits) or outcome (complaints)
    deficiency_count: int   # # P-codes >= severity floor (visits) or 0/1 (complaints)


# ─── Roster loader ───────────────────────────────────────────────────────────

def load_roster_by_license(path: Path) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    if not path.is_file():
        print(f"ERROR: roster lookup not found at {path}.", file=sys.stderr)
        print(f"Generate it with: python3 scrapers/tx_export_facility_lookup.py", file=sys.stderr)
        sys.exit(1)
    with path.open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            lic = r.get("license_number", "").strip()
            if not lic:
                continue
            out[lic] = {
                "license_number": lic,
                "tx_facility_id": r.get("tx_facility_id", ""),
                "name": r.get("name", ""),
                "city": r.get("city", ""),
                "tx_county": r.get("tx_county", ""),
                "tx_alzheimer_certified": r.get("tx_alzheimer_certified") == "True",
            }
    return out


# ─── Filtering ───────────────────────────────────────────────────────────────

def deficiency_meets_floor(letter: str, floor_letter: str) -> bool:
    if not letter:
        return False
    rank = LETTER_RANK.get(letter.upper())
    floor = LETTER_RANK.get(floor_letter.upper(), LETTER_RANK["B"])
    return rank is not None and rank >= floor


def collect_visit_request(
    inspection: dict[str, Any],
    facility: dict[str, Any],
    floor_letter: str,
) -> NarrativeRequest | None:
    """Return a NarrativeRequest if this FVH visit has any deficiency >= floor."""
    if inspection.get("is_complaint"):
        return None
    qualifying_letters: list[str] = []
    for d in inspection.get("deficiencies", []):
        ltr = (d.get("state_severity_raw") or "").upper()
        if deficiency_meets_floor(ltr, floor_letter):
            qualifying_letters.append(ltr)
    if not qualifying_letters:
        return None
    raw = inspection.get("raw_data") or {}
    return NarrativeRequest(
        event_kind="visit",
        license_no=facility["license_number"],
        facility_id=facility["tx_facility_id"],
        facility_name=facility["name"],
        city=facility["city"],
        county=facility["tx_county"],
        event_date=inspection["inspection_date"],
        event_id=raw.get("fvh_event_id") or "",
        visit_type=raw.get("visit_type") or "",
        severity_letters=" ".join(sorted(set(qualifying_letters))),
        deficiency_count=len(qualifying_letters),
    )


def collect_complaint_request(
    inspection: dict[str, Any],
    facility: dict[str, Any],
    include_unsubstantiated: bool,
) -> NarrativeRequest | None:
    if not inspection.get("is_complaint"):
        return None
    findings = (inspection.get("outcome") or "").upper()
    if not include_unsubstantiated and not findings.startswith("SUBSTANTIATED"):
        return None
    if include_unsubstantiated and findings.startswith(("WITHDRAWN", "REFERRED")):
        return None
    raw = inspection.get("raw_data") or {}
    return NarrativeRequest(
        event_kind="complaint",
        license_no=facility["license_number"],
        facility_id=facility["tx_facility_id"],
        facility_name=facility["name"],
        city=facility["city"],
        county=facility["tx_county"],
        event_date=inspection["inspection_date"],
        event_id=inspection.get("complaint_id") or "",
        visit_type=raw.get("case_type") or "Complaint",
        severity_letters=findings or "(no outcome)",
        deficiency_count=1 if findings.startswith("SUBSTANTIATED AND CITED") else 0,
    )


def gather_requests(
    bundle: dict[str, Any],
    roster_by_license: dict[str, dict[str, Any]],
    *,
    memory_care_only: bool,
    license_whitelist: set[str] | None,
    severity_min: str,
    include_unsubstantiated: bool,
) -> tuple[list[NarrativeRequest], int]:
    """
    Returns (requests, dedup_drops). Complaint requests are deduplicated by
    (license, RS Case No.) — HHSC sometimes lists one complaint twice when it
    has multiple allegation categories. Visits are unique per EVENTID, so no
    visit dedup is applied.
    """
    raw: list[NarrativeRequest] = []
    for f in bundle.get("facilities", []):
        lic = f["license_number"]
        meta = roster_by_license.get(lic)
        if not meta:
            continue
        if memory_care_only and not meta["tx_alzheimer_certified"]:
            continue
        if license_whitelist and lic not in license_whitelist:
            continue
        for insp in f.get("inspections", []):
            if insp.get("is_complaint"):
                req = collect_complaint_request(insp, meta, include_unsubstantiated)
            else:
                req = collect_visit_request(insp, meta, severity_min)
            if req is not None:
                raw.append(req)

    # Dedupe complaints by (license, complaint_id). Merge allegations into
    # severity_letters so the email row still shows all allegation categories.
    by_complaint_key: dict[tuple[str, str], NarrativeRequest] = {}
    deduped: list[NarrativeRequest] = []
    drops = 0
    for r in raw:
        if r.event_kind == "complaint" and r.event_id:
            key = (r.license_no, r.event_id)
            existing = by_complaint_key.get(key)
            if existing is not None:
                drops += 1
                continue
            by_complaint_key[key] = r
        deduped.append(r)

    # Stable sort: facility, then event_kind (complaints first since they dominate),
    # then event_date ascending.
    deduped.sort(key=lambda r: (r.license_no, r.event_kind, r.event_date))
    return deduped, drops


# ─── Batching + output ───────────────────────────────────────────────────────

EMAIL_TEMPLATE = """\
Subject: Records request — assisted living survey/complaint narratives (batch {batch_num} of {batch_total})

To: HHSC Regulatory Services / LTC / Records Management
From: [your name + email]

Per your reply on the recent ALF facility visit history / intake history bulk
delivery, I am submitting a follow-up records request for inspector-narrative
records on the following events. Please provide the published narrative
(violation findings, inspector observations, and any Statement of Findings
text) for each event listed.

If this batch's total page count exceeds 100 pages, please notify me with a
cost estimate before processing so I can split or revise the request.

Note: I have excluded any events from the last 45 days, as your reply
indicated those may not yet be available.

Events ({n_events} total in this batch):

{table}

Identifiers in the table:
  - "EVENTID" matches the EVENTID column from the FVH (Facility Visit History)
    delivery; pair with the EXIT DATE for survey lookup.
  - "RS Case No." matches the IntakeHistory delivery for complaint records.

Please send the narratives by email to the address above as PDF or text
attachments. I am happy to provide additional context if helpful.

Thank you,

[your name]
[contact info]
"""


def render_email_body(batch_num: int, batch_total: int, requests: list[NarrativeRequest]) -> str:
    rows: list[list[str]] = [
        ["#", "Type", "License", "Facility", "City", "Date", "Identifier", "Detail"]
    ]
    for i, r in enumerate(requests, start=1):
        ident_label = "EVENTID" if r.event_kind == "visit" else "RS Case No."
        ident = f"{ident_label}: {r.event_id}" if r.event_id else "(no identifier)"
        detail = (
            f"S/S: {r.severity_letters}" if r.event_kind == "visit"
            else f"{r.visit_type}: {r.severity_letters}"
        )
        rows.append([
            str(i),
            r.event_kind,
            r.license_no,
            (r.facility_name or "")[:40],
            (r.city or "")[:18],
            r.event_date,
            ident,
            detail,
        ])
    widths = [max(len(row[c]) for row in rows) for c in range(len(rows[0]))]
    lines = []
    for row in rows:
        lines.append("  ".join(cell.ljust(widths[c]) for c, cell in enumerate(row)))
    table_str = "\n".join(lines)
    return EMAIL_TEMPLATE.format(
        batch_num=batch_num,
        batch_total=batch_total,
        n_events=len(requests),
        table=table_str,
    )


def write_batch(out_dir: Path, batch_num: int, batch_total: int, requests: list[NarrativeRequest]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    csv_path = out_dir / f"batch-{batch_num:03d}.csv"
    eml_path = out_dir / f"batch-{batch_num:03d}.email.txt"
    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(NarrativeRequest.__annotations__.keys()))
        w.writeheader()
        for r in requests:
            w.writerow(asdict(r))
    eml_path.write_text(render_email_body(batch_num, batch_total, requests), encoding="utf-8")


def write_manifest(out_dir: Path, requests: list[NarrativeRequest], batches: list[list[NarrativeRequest]], opts: dict[str, Any]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "options": opts,
        "totals": {
            "events": len(requests),
            "visits": sum(1 for r in requests if r.event_kind == "visit"),
            "complaints": sum(1 for r in requests if r.event_kind == "complaint"),
            "facilities": len({r.license_no for r in requests}),
            "batches": len(batches),
        },
        "batches": [
            {
                "n": i + 1,
                "events": len(b),
                "visits": sum(1 for r in b if r.event_kind == "visit"),
                "complaints": sum(1 for r in b if r.event_kind == "complaint"),
                "facilities": len({r.license_no for r in b}),
            }
            for i, b in enumerate(batches)
        ],
    }
    (out_dir / "MANIFEST.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description="Generate HHSC narrative request batches")
    ap.add_argument("--bundle", type=Path, default=DEFAULT_BUNDLE,
                    help=f"Path to bundle JSON (default: {DEFAULT_BUNDLE.relative_to(REPO_ROOT)})")
    ap.add_argument("--roster", type=Path, default=DEFAULT_ROSTER,
                    help=f"TX facility lookup CSV (default: {DEFAULT_ROSTER.relative_to(REPO_ROOT)})")
    ap.add_argument("--out-dir", type=Path, default=Path("out") / "tx-narrative-requests",
                    help="Output directory for batch CSVs + email bodies (default: out/tx-narrative-requests/)")
    ap.add_argument("--memory-care-only", action=argparse.BooleanOptionalAction, default=True,
                    help="Filter to tx_alzheimer_certified=True (default: on). Use --no-memory-care-only to include all metro facilities.")
    ap.add_argument("--license", action="append", default=None,
                    help="Restrict to specific license numbers (repeatable). 6-digit zero-padded.")
    ap.add_argument("--severity-min", type=str.upper, default="B",
                    choices=SS_LETTERS_ORDER,
                    help="Minimum CMS scope/severity letter for visit narratives (default: B; excludes A/0).")
    ap.add_argument("--include-unsubstantiated", action="store_true",
                    help="Also request narratives for unsubstantiated complaints (default: off).")
    ap.add_argument("--batch-size", type=int, default=25,
                    help="Events per batch (default: 25; targets ~100 pages at ~4 pages/event).")
    ap.add_argument("--limit-events", type=int, default=None,
                    help="Cap total events emitted across all batches (e.g. for a smoke test).")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print universe size + batch counts without writing files.")
    args = ap.parse_args()

    if not args.bundle.is_file():
        print(f"ERROR: bundle not found: {args.bundle}", file=sys.stderr)
        print("Run: python3 scrapers/tx_pia_to_bundle.py --input <FVH.xlsx> --input <Intake.xlsx> --output <bundle.json>", file=sys.stderr)
        sys.exit(1)

    bundle = json.loads(args.bundle.read_text(encoding="utf-8"))
    roster_by_license = load_roster_by_license(args.roster)

    license_whitelist = None
    if args.license:
        license_whitelist = {l.zfill(6) for l in args.license}

    requests, dedup_drops = gather_requests(
        bundle,
        roster_by_license,
        memory_care_only=args.memory_care_only,
        license_whitelist=license_whitelist,
        severity_min=args.severity_min,
        include_unsubstantiated=args.include_unsubstantiated,
    )

    if args.limit_events is not None:
        requests = requests[: args.limit_events]

    if not requests:
        print("No events match the current filters. Nothing to request.", file=sys.stderr)
        sys.exit(2)

    batches: list[list[NarrativeRequest]] = [
        requests[i : i + args.batch_size]
        for i in range(0, len(requests), args.batch_size)
    ]

    n_visits = sum(1 for r in requests if r.event_kind == "visit")
    n_complaints = sum(1 for r in requests if r.event_kind == "complaint")
    n_facilities = len({r.license_no for r in requests})

    print(f"Filters: memory_care_only={args.memory_care_only} severity_min={args.severity_min} "
          f"include_unsubstantiated={args.include_unsubstantiated} licenses={license_whitelist}")
    print(f"Universe: {len(requests)} events across {n_facilities} facilities "
          f"(deduped {dedup_drops} duplicate complaint allegations)")
    print(f"  visits (FVH, S/S >= {args.severity_min}): {n_visits}")
    print(f"  complaints: {n_complaints}")
    print(f"Batching: {len(batches)} batches of up to {args.batch_size} events each")
    if len(requests) > 1000:
        approx_pages = len(requests) * 4
        print(f"  WARNING: ~{approx_pages:,} estimated pages total. Consider tightening "
              f"--severity-min or --license filters.")

    if args.dry_run:
        print("(dry-run: no files written)")
        return

    for i, batch in enumerate(batches, start=1):
        write_batch(args.out_dir, i, len(batches), batch)

    write_manifest(args.out_dir, requests, batches, {
        "memory_care_only": args.memory_care_only,
        "severity_min": args.severity_min,
        "include_unsubstantiated": args.include_unsubstantiated,
        "license_whitelist": sorted(license_whitelist) if license_whitelist else None,
        "batch_size": args.batch_size,
        "limit_events": args.limit_events,
    })

    print(f"\nWrote {len(batches)} batch(es) to {args.out_dir}/")
    print(f"  - batch-NNN.csv      (audit trail / structured data)")
    print(f"  - batch-NNN.email.txt (paste into reply to RSLTCR.RecordsMgmt@hhs.texas.gov)")
    print(f"  - MANIFEST.json      (totals + per-batch counts)")


if __name__ == "__main__":
    main()
