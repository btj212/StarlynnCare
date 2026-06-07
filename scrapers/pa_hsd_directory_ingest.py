#!/usr/bin/env python3
"""
Pennsylvania Facilities Ingest — DHS Human Services Provider Directory.

Pulls the native XLSX bulk export from the DHS Human Services Provider
Directory and upserts the Office of Long-Term Living (OLTL) subset into the
facilities table.

Source: https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/ExportToExcel
        (no auth; one GET; refreshed daily)

Memory care gate (PA-specific):
  serves_memory_care = (mc_designation_type IS NOT NULL)
                       OR (license_type = 'ASSISTED LIVING - SPECIAL CARE')

The unified Tier-1 column `memory_care_disclosure_filed` is mirrored from the
PA flag so recompute_publishable.py picks it up without per-state branching
(see docs/SCRAPER_MODEL.md).

Primary key: (state_code='PA', external_id=License Number).

THE PA GOTCHA: the Azure inspection portal URL uses the License Number with
the last (check) digit stripped, e.g. License 223010 → id=22301. This script
asserts on three known reference cases at startup and exits non-zero if any
mismatch — see Section 4 + 13.2 of pa-memory-care-data-methodology.md.

Usage:
    python3 -u pa_hsd_directory_ingest.py --input scrapers/data/pa_hsd_full.xlsx
    python3 -u pa_hsd_directory_ingest.py --fetch-live
    python3 -u pa_hsd_directory_ingest.py --input scrapers/data/pa_hsd_full.xlsx --dry-run
    python3 -u pa_hsd_directory_ingest.py --input scrapers/data/pa_hsd_full.xlsx --mc-only
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import urllib.parse
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any

import openpyxl
import psycopg
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_CODE = "PA"

DHS_BASE = "https://www.humanservices.dhs.pa.gov"
DHS_DIRECTORY_HOME = f"{DHS_BASE}/HUMAN_SERVICE_PROVIDER_DIRECTORY/"
DHS_EXPORT_URL = f"{DHS_BASE}/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/ExportToExcel"
PROGRAM_OFFICE_OLTL = "Office of Long-Term Living"

# Known reference fixtures from pa-memory-care-data-methodology.md Section 4.
# Verified against the live 2026-05-24 export.
URL_ID_FIXTURES = [
    ("223010", "22301"),  # Rittenhouse Village at Lehigh Valley
    ("110780", "11078"),  # A Second Chance
    ("231010", "23101"),  # Serenity Gardens at Mount Carmel
    ("456560", "45656"),  # Cambridge Village PCH
]


# ---------------------------------------------------------------------------
# Env
# ---------------------------------------------------------------------------


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def clean_cell(v: Any) -> Any:
    """Strip right-padded whitespace from string cells; preserve None/numbers/dates."""
    if isinstance(v, str):
        return v.strip() or None
    return v


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "facility"


def titleize(text: str | None) -> str | None:
    if not text:
        return text
    stop = {"and", "or", "of", "in", "the", "a", "at", "by", "for", "to"}
    words = text.lower().split()
    return " ".join(
        w if (i > 0 and w in stop) else w.capitalize()
        for i, w in enumerate(words)
    )


def derive_url_id(license_number: str) -> str:
    """
    PA gotcha: DHS Azure inspection portal URL strips the last (check) digit.
    License 223010 → URL id=22301.
    """
    return str(license_number).strip()[:-1]


def inspection_url(license_number: str, facility_name: str) -> str:
    """Build the per-facility DHS Azure inspection summary URL."""
    url_id = derive_url_id(license_number)
    name_param = urllib.parse.quote(facility_name or "", safe=" ")
    return (
        f"{DHS_BASE}/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/"
        f"AzureInspVioltnReprtSearchResults?id={url_id}&facilityName={name_param}"
    )


def certificate_url(license_number: str, facility_name: str) -> str:
    url_id = derive_url_id(license_number)
    name_param = urllib.parse.quote(facility_name or "", safe=" ")
    return (
        f"{DHS_BASE}/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/"
        f"AzureCertificateSearchResults?id={url_id}&facilityName={name_param}"
    )


def assert_url_id_fixtures() -> None:
    """Fail loud if the license-number-to-URL-id helper breaks. See Section 10 gotcha #1."""
    for license_num, expected in URL_ID_FIXTURES:
        actual = derive_url_id(license_num)
        assert actual == expected, (
            f"URL-id derivation broken: license {license_num} → {actual!r}, expected {expected!r}. "
            "See scrapers/pa-memory-care-data-methodology.md Section 4 + 13.2."
        )
    print(f"  URL-id fixtures OK ({len(URL_ID_FIXTURES)} samples verified)", flush=True)


def parse_capacity(v: Any) -> int | None:
    """`Capacity` is typed as string in the XLSX; cast carefully."""
    if v is None:
        return None
    if isinstance(v, int):
        return v
    s = str(v).strip()
    if not s:
        return None
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None


def parse_secure_beds(v: Any) -> int | None:
    """Same shape as parse_capacity, but the column has more null cells."""
    return parse_capacity(v)


def parse_date(v: Any):
    """Returns a datetime.date or None. PA dates come through openpyxl as datetimes."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    s = str(v).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


# ---------------------------------------------------------------------------
# Fetch / load
# ---------------------------------------------------------------------------


def fetch_live_xlsx() -> bytes:
    """
    Live re-pull from DHS (Section 13.1 of brief): GET the home page first
    to seed cookies, then GET the export URL.
    """
    print(f"  Live fetch: seeding cookies from {DHS_DIRECTORY_HOME} …", flush=True)
    s = requests.Session()
    s.headers["User-Agent"] = "StarlynnCare-bot/1.0 (+https://starlynn.care)"
    r = s.get(DHS_DIRECTORY_HOME, timeout=30)
    r.raise_for_status()

    print(f"  Live fetch: downloading bulk export …", flush=True)
    r2 = s.get(DHS_EXPORT_URL, timeout=120)
    r2.raise_for_status()
    ct = r2.headers.get("content-type", "")
    if not (ct.startswith("application/octet-stream") or "spreadsheetml" in ct):
        raise RuntimeError(f"Unexpected content-type from DHS export: {ct!r}")
    print(f"  Live fetch: got {len(r2.content):,} bytes", flush=True)
    return r2.content


def load_xlsx_rows(input_bytes: bytes) -> tuple[list[str], list[tuple[Any, ...]]]:
    wb = openpyxl.load_workbook(BytesIO(input_bytes), read_only=True, data_only=True)
    ws = wb["Provider Directory Report"]
    rows = list(ws.iter_rows(values_only=True))
    header = [(h or "").strip() if isinstance(h, str) else h for h in rows[0]]
    if len(header) != 26:
        print(
            f"  WARN: expected 26 columns, found {len(header)}. Schema may have shifted.",
            file=sys.stderr,
            flush=True,
        )
    return header, rows[1:]


# ---------------------------------------------------------------------------
# Transform
# ---------------------------------------------------------------------------


def row_to_record(raw_row: tuple[Any, ...]) -> dict[str, Any] | None:
    """Map a raw XLSX row to a facilities dict. Returns None if non-LTL."""
    row = [clean_cell(v) for v in raw_row]
    # Bounds guard — short rows from a malformed XLSX
    if len(row) < 26:
        return None

    program_office = row[1]
    if program_office != PROGRAM_OFFICE_OLTL:
        return None

    service_type = row[0]
    facility_name = row[2]
    legal_entity_name = row[3]
    if not facility_name:
        return None

    license_number_raw = row[16]
    if license_number_raw is None:
        return None
    license_number = str(license_number_raw).strip()
    if not license_number:
        return None

    # Address composition — keep address line 1 only; brief notes lines 2/3 are often null
    address_line1 = row[4]
    address_line2 = row[5]
    address_line3 = row[6]
    street_parts = [p for p in (address_line1, address_line2, address_line3) if p]
    street = ", ".join(street_parts) if street_parts else None

    city_raw = row[7]
    state_raw = row[8]
    zip_raw = row[9]
    phone = row[10]
    county_raw = row[11]
    region = row[12]
    capacity = parse_capacity(row[13])
    ownership_raw = row[14]
    license_status_raw = row[15]
    license_subtype = row[17]
    license_effective = parse_date(row[18])
    license_expiration = parse_date(row[19])
    mc_designation_type = row[20]
    secure_beds = parse_secure_beds(row[21])
    inspection_index_url = row[22]
    certificate_url_value = row[23]
    qsr_url = row[24]
    # row[25] = Waiver Link — captured separately if needed; not surfaced for now

    if state_raw and str(state_raw).strip() != "PA":
        # Defensive — the bulk export should always be PA-only
        return None

    # Memory-care gate
    serves_memory_care = (mc_designation_type is not None) or (
        service_type == "ASSISTED LIVING - SPECIAL CARE"
    )

    # License status normalization. v1 publishable rules (Section 8 of brief):
    # only LICENSED rows go publishable; PDR-APPEAL PEND is flagged but excluded.
    license_status_norm = (license_status_raw or "").upper().strip()
    is_appeal_pending = license_status_norm == "PDR-APPEAL PEND"
    if license_status_norm == "LICENSED":
        license_status = "LICENSED"
    elif is_appeal_pending:
        # Treat appeal-pending as NOT LICENSED for publishable purposes; recompute_publishable
        # checks for the literal 'LICENSED'. Editorial flag below preserves context.
        license_status = "PDR-APPEAL PEND"
    else:
        license_status = license_status_norm or None

    # Editorial flag
    license_under_appeal = is_appeal_pending

    # Care category — mirrors the OR scheme so peer-rank logic works
    if serves_memory_care:
        care_category = "alf_memory_care"
    elif service_type in ("PERSONAL CARE HOMES", "ASSISTED LIVING"):
        care_category = "alf_general"
    else:
        care_category = "alf_general"

    # Ownership type → check constraint values: for-profit / non-profit / government
    ownership_type: str | None
    if ownership_raw:
        u = ownership_raw.upper()
        if "NON" in u and "PROFIT" in u:
            ownership_type = "non-profit"
        elif "PROFIT" in u:
            ownership_type = "for-profit"
        elif "GOVERNMENT" in u or "PUBLIC" in u:
            ownership_type = "government"
        else:
            ownership_type = None
    else:
        ownership_type = None

    # Bed-count ratio for editorial display (matches UT)
    secure_bed_ratio: float | None = None
    if secure_beds is not None and capacity and capacity > 0:
        secure_bed_ratio = round(secure_beds / capacity, 4)

    # Title-case city + name; capitalize county
    name = titleize(facility_name) or facility_name
    city = titleize(city_raw) if city_raw else None
    county = titleize(county_raw) if county_raw else None
    legal_entity_titled = titleize(legal_entity_name) if legal_entity_name else None
    region_norm = (region or "").upper().strip() or None

    # Slugs — required NOT NULL columns
    city_slug = slugify(city_raw) if city_raw else "unknown-city"
    name_slug = slugify(facility_name) if facility_name else "facility"
    # slug must be unique per (state_code, city_slug); append external_id for uniqueness
    slug = f"{name_slug}-{license_number.lower()}"

    return {
        "state_code": STATE_CODE,
        "external_id": license_number,
        "license_number": license_number,
        "name": name,
        "legal_entity_name": legal_entity_titled,
        "license_type": service_type,
        "license_subtype": license_subtype,
        "license_status": license_status,
        "license_under_appeal": license_under_appeal,
        "license_expiration": license_expiration,
        "initial_license_date": license_effective,
        "beds": capacity,
        "secure_beds": secure_beds,
        "secure_bed_ratio": secure_bed_ratio,
        "street": street,
        "city": city,
        "city_slug": city_slug,
        "slug": slug,
        "county": county,
        "zip": (str(zip_raw)[:10] if zip_raw else None),
        "phone": (str(phone).strip() if phone else None),
        "dhs_region": region_norm,
        "ownership_type": ownership_type,
        "care_category": care_category,
        # PA-specific memory-care signal columns
        "mc_designation_type": mc_designation_type,
        "serves_memory_care": serves_memory_care,
        # Unified Tier-1 mirror (recompute_publishable reads this) — see docs/SCRAPER_MODEL.md
        "memory_care_disclosure_filed": serves_memory_care,
        "memory_care_disclosure_source": (
            "PA DHS HSD bulk export"
            if serves_memory_care
            else None
        ),
        "mc_review_status": "auto_published",  # per MEMORY.md
        "publishable": False,  # recompute_publishable.py sets this
        # Pre-baked DHS portal URLs
        "inspection_index_url": (inspection_index_url
                                 or inspection_url(license_number, name)),
        "certificate_url": certificate_url_value or certificate_url(license_number, name),
        "qsr_url": qsr_url,
        # source_url is the per-facility inspection summary URL
        "source_url": (inspection_index_url
                       or inspection_url(license_number, name)),
    }


# ---------------------------------------------------------------------------
# Upsert
# ---------------------------------------------------------------------------

UPSERT_SQL = """
INSERT INTO facilities (
    state_code, external_id, license_number, name, legal_entity_name,
    license_type, license_subtype, license_status, license_under_appeal,
    license_expiration, initial_license_date,
    beds, secure_beds, secure_bed_ratio,
    street, city, city_slug, slug, county, zip, phone,
    dhs_region, ownership_type, care_category,
    mc_designation_type, serves_memory_care,
    memory_care_disclosure_filed, memory_care_disclosure_source,
    mc_review_status, publishable,
    inspection_index_url, certificate_url, qsr_url, source_url
) VALUES (
    %(state_code)s, %(external_id)s, %(license_number)s, %(name)s, %(legal_entity_name)s,
    %(license_type)s, %(license_subtype)s, %(license_status)s, %(license_under_appeal)s,
    %(license_expiration)s, %(initial_license_date)s,
    %(beds)s, %(secure_beds)s, %(secure_bed_ratio)s,
    %(street)s, %(city)s, %(city_slug)s, %(slug)s, %(county)s, %(zip)s, %(phone)s,
    %(dhs_region)s, %(ownership_type)s, %(care_category)s,
    %(mc_designation_type)s, %(serves_memory_care)s,
    %(memory_care_disclosure_filed)s, %(memory_care_disclosure_source)s,
    %(mc_review_status)s, %(publishable)s,
    %(inspection_index_url)s, %(certificate_url)s, %(qsr_url)s, %(source_url)s
)
ON CONFLICT (state_code, external_id) WHERE state_code = 'PA' AND external_id IS NOT NULL
DO UPDATE SET
    license_number          = EXCLUDED.license_number,
    name                    = EXCLUDED.name,
    legal_entity_name       = EXCLUDED.legal_entity_name,
    license_type            = EXCLUDED.license_type,
    license_subtype         = EXCLUDED.license_subtype,
    license_status          = EXCLUDED.license_status,
    license_under_appeal    = EXCLUDED.license_under_appeal,
    license_expiration      = EXCLUDED.license_expiration,
    initial_license_date    = COALESCE(EXCLUDED.initial_license_date, facilities.initial_license_date),
    beds                    = EXCLUDED.beds,
    secure_beds             = EXCLUDED.secure_beds,
    secure_bed_ratio        = EXCLUDED.secure_bed_ratio,
    street                  = COALESCE(EXCLUDED.street, facilities.street),
    city                    = COALESCE(EXCLUDED.city, facilities.city),
    city_slug               = EXCLUDED.city_slug,
    county                  = COALESCE(EXCLUDED.county, facilities.county),
    zip                     = COALESCE(EXCLUDED.zip, facilities.zip),
    phone                   = COALESCE(EXCLUDED.phone, facilities.phone),
    dhs_region              = EXCLUDED.dhs_region,
    ownership_type          = COALESCE(EXCLUDED.ownership_type, facilities.ownership_type),
    care_category           = EXCLUDED.care_category,
    mc_designation_type     = EXCLUDED.mc_designation_type,
    serves_memory_care      = EXCLUDED.serves_memory_care,
    memory_care_disclosure_filed = EXCLUDED.memory_care_disclosure_filed,
    memory_care_disclosure_source = COALESCE(EXCLUDED.memory_care_disclosure_source, facilities.memory_care_disclosure_source),
    mc_review_status        = COALESCE(facilities.mc_review_status, EXCLUDED.mc_review_status),
    inspection_index_url    = EXCLUDED.inspection_index_url,
    certificate_url         = EXCLUDED.certificate_url,
    qsr_url                 = EXCLUDED.qsr_url,
    source_url              = EXCLUDED.source_url,
    updated_at              = now()
"""


def upsert_batch(
    conn: psycopg.Connection,
    records: list[dict[str, Any]],
) -> tuple[int, int]:
    """Upsert with per-row savepoints (ERRORS.md entry #4)."""
    ok = err = 0
    with conn.cursor() as cur:
        for i, rec in enumerate(records):
            sp = f"sp_pa_{rec['external_id']}"
            try:
                cur.execute(f"SAVEPOINT {sp}")
                cur.execute(UPSERT_SQL, rec)
                cur.execute(f"RELEASE SAVEPOINT {sp}")
                ok += 1
            except Exception as exc:
                cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                print(
                    f"  ERROR {rec['external_id']} {rec['name'][:40]}: {exc}",
                    file=sys.stderr,
                    flush=True,
                )
                err += 1
            if (i + 1) % 100 == 0:
                print(f"  upserted {i + 1}/{len(records)} …", flush=True)
    return ok, err


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest PA DHS HSD bulk export")
    parser.add_argument(
        "--input",
        help="Path to a local pa_hsd_full.xlsx; defaults to scrapers/data/pa_hsd_full.xlsx",
        default=str(REPO_ROOT / "scrapers" / "data" / "pa_hsd_full.xlsx"),
    )
    parser.add_argument(
        "--fetch-live",
        action="store_true",
        help="Re-pull the XLSX from DHS instead of reading --input (Section 13.1).",
    )
    parser.add_argument("--mc-only", action="store_true", help="Skip non-memory-care rows")
    parser.add_argument("--dry-run", action="store_true", help="Parse and report, no DB writes")
    parser.add_argument("--limit", type=int, default=None, help="Cap number of upserted rows")
    args = parser.parse_args()

    load_env()

    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set. Add to .env.local.", file=sys.stderr)
        sys.exit(1)

    # Fail-loud assertion: license-number → URL-id derivation
    assert_url_id_fixtures()

    # Acquire XLSX bytes
    if args.fetch_live:
        xlsx_bytes = fetch_live_xlsx()
    else:
        in_path = Path(args.input)
        if not in_path.is_file():
            print(f"ERROR: input not found: {in_path}", file=sys.stderr)
            sys.exit(1)
        xlsx_bytes = in_path.read_bytes()
        print(f"  Loaded {in_path} ({len(xlsx_bytes):,} bytes)", flush=True)

    header, raw_rows = load_xlsx_rows(xlsx_bytes)
    print(f"  Parsed {len(raw_rows):,} total provider rows", flush=True)

    # Whitespace sanity check on first 10 string cells across first 5 rows
    unstripped_sample = 0
    for r in raw_rows[:5]:
        for v in r[:10]:
            if isinstance(v, str) and (v != v.strip()) and v.strip():
                unstripped_sample += 1
    if unstripped_sample:
        print(
            f"  NOTE: {unstripped_sample} right-padded cells in 50-cell sample — clean_cell() will strip on ingest.",
            flush=True,
        )

    records = []
    skipped_non_ltl = 0
    skipped_other = 0
    for r in raw_rows:
        try:
            rec = row_to_record(r)
        except Exception as exc:
            print(f"  TRANSFORM ERROR: {exc}", file=sys.stderr, flush=True)
            skipped_other += 1
            continue
        if rec is None:
            skipped_non_ltl += 1
        else:
            records.append(rec)

    print(
        f"  → {len(records):,} OLTL facilities; "
        f"skipped {skipped_non_ltl:,} non-OLTL + {skipped_other} parse-error rows",
        flush=True,
    )

    if args.mc_only:
        before = len(records)
        records = [r for r in records if r["serves_memory_care"]]
        print(f"  --mc-only: {before:,} → {len(records):,} memory-care rows", flush=True)

    # Summary counts
    licensed = sum(1 for r in records if r["license_status"] == "LICENSED")
    mc = sum(1 for r in records if r["serves_memory_care"])
    mc_licensed = sum(
        1 for r in records if r["serves_memory_care"] and r["license_status"] == "LICENSED"
    )
    by_service: dict[str, int] = {}
    for r in records:
        by_service[r["license_type"]] = by_service.get(r["license_type"], 0) + 1
    by_designation: dict[str, int] = {}
    for r in records:
        key = r["mc_designation_type"] or "(none)"
        by_designation[key] = by_designation.get(key, 0) + 1
    appeal = sum(1 for r in records if r["license_under_appeal"])
    total_secure_beds = sum((r["secure_beds"] or 0) for r in records)

    print()
    print(f"  Service Type breakdown:")
    for k, v in sorted(by_service.items(), key=lambda kv: -kv[1]):
        print(f"    {v:>5}  {k}")
    print(f"  MC designation breakdown:")
    for k, v in sorted(by_designation.items(), key=lambda kv: -kv[1]):
        print(f"    {v:>5}  {k}")
    print()
    print(
        f"  Totals: {len(records):,} facilities | {licensed:,} LICENSED | "
        f"{mc:,} serves_memory_care | {mc_licensed:,} MC+LICENSED | "
        f"{appeal} appeal-pending | {total_secure_beds:,} total secure beds",
        flush=True,
    )

    if args.limit:
        records = records[: args.limit]
        print(f"  --limit: trimmed to first {len(records)} records", flush=True)

    if args.dry_run:
        print("\n--- DRY RUN sample (first 5 MC facilities) ---")
        for r in [x for x in records if x["serves_memory_care"]][:5]:
            print(
                f"  {r['external_id']:8s} {r['name'][:40]:40s} "
                f"beds={r['beds']} secure={r['secure_beds']} "
                f"designation={r['mc_designation_type']!r} status={r['license_status']}",
                flush=True,
            )
        print("Dry run complete. No DB writes.")
        return

    dsn = os.environ["DATABASE_URL"]
    with psycopg.connect(dsn) as conn:
        print(f"\nUpserting {len(records)} records …", flush=True)
        ok, err = upsert_batch(conn, records)
        conn.commit()

    print(f"\nDone. ok={ok} err={err}", flush=True)
    if err and len(records) and (err / len(records)) > 0.05:
        sys.exit(1)


if __name__ == "__main__":
    main()
