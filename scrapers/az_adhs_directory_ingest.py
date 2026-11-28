#!/usr/bin/env python3
"""
Arizona ADHS Directory Ingest — ArcGIS FeatureServer (Residential Facilities Layer 12)

Pulls all active Assisted Living Homes and Assisted Living Centers from the ADHS
ArcGIS Open Data hub and upserts them into the facilities table.

Memory care gate:
  - PRIMARY:   LICENSE_SUBTYPE ending "-DIRECTED" (Directed Care license level)
               Directed Care = highest level, may serve residents with dementia/cognitive impairment.
  - SECONDARY: az_mc_subclass = true (HB2764 subclass, effective 2025-07-01 — not yet in source data)
  - TERTIARY:  Name-match (memory care / dementia / alzheimer in facility name)

ArcGIS source:
  https://services1.arcgis.com/mpVYz37anSdrK4d8/arcgis/rest/services/AZLicensedFacilities/FeatureServer/12/query
  Item: a14f94e433dc40d4a7c77bd79da10b24 (AGIC Open Data Hub)

Primary key: (state_code='AZ', external_id=FACID)

Usage:
    python3 -u scrapers/az_adhs_directory_ingest.py
    python3 -u scrapers/az_adhs_directory_ingest.py --mc-only   # only load Directed Care rows
    python3 -u scrapers/az_adhs_directory_ingest.py --dry-run   # print rows, no DB writes
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# ArcGIS FeatureServer layer 12 = Residential Facilities (Assisted Living)
ARCGIS_URL = (
    "https://services1.arcgis.com/mpVYz37anSdrK4d8/arcgis/rest/services"
    "/AZLicensedFacilities/FeatureServer/12/query"
)

# Only ingest these facility types — skip Behavioral Health, Adult Foster Care, etc.
ALF_TYPES = {
    "ASSISTED LIVING HOME",
    "ASSISTED LIVING CENTER",
}

# MC keyword match (Tier-3 signal, lower confidence than LICENSE_SUBTYPE)
_MC_KEYWORDS = re.compile(
    r"\b(memory.?care|dementia|alzheimer|reminiscence|cognitive)\b",
    re.IGNORECASE,
)

# Layer 12 RUN_DATE 1738540800000 is 2025-02-03 UTC. A Care Check row
# checked after that date, or sourced from azcarecheck, is newer than this file.
ADHS_MAP_AS_OF = date(2025, 2, 3)

# The Feb 2025 map must not replace these when Care Check is the newer source.
PROTECTED_FIELDS = (
    "license_number",
    "license_expiration",
    "license_status",
    "az_license_level",
    "az_mc_subclass",
    "az_memory_care_endorsed",
    "serves_memory_care",
    "memory_care_disclosure_filed",
    "memory_care_disclosure_source",
)

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))
from _license_match import (
    load_identity_map,
    note_kept_external_id,
    record_protected_diffs,
    report_review_log,
    reuse_identity,
)

# Left in place on conflict. A new insert still sets them.
# az_license_level still updates: it is the license level, not the memory-care decision.
PRESERVE_ON_UPDATE = (
    "publishable",
    "serves_memory_care",
    "mc_review_status",
    "memory_care_disclosure_filed",
    "memory_care_disclosure_source",
    "az_mc_subclass",
    "az_memory_care_endorsed",
)

STALE_LAYER_REFUSAL = (
    "Refusing to run: ADHS layer still shows pre-rename FACID/name/license "
    "for ~60 homes; see audit file az_renamed_homes_exposure.json. "
    "Pass --allow-stale-layer only with Blake's OK."
)


def _as_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    return date.fromisoformat(text[:10])


def parse_arcgis_date(value: Any) -> str | None:
    """ArcGIS dates are epoch milliseconds. Null stays null so a stored date survives."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        seconds = value / 1000 if abs(value) > 10_000_000_000 else value
        return datetime.fromtimestamp(seconds, timezone.utc).date().isoformat()
    text = str(value).strip()
    return text[:10] if text else None


def azcc_row_is_newer(existing: dict[str, Any]) -> bool:
    """True when Care Check, or a check date after the map, owns this row."""
    source = str(existing.get("license_status_source") or "").lower()
    if "azcarecheck" in source or "az care check" in source:
        return True
    checked = _as_date(existing.get("license_status_checked_at"))
    return checked is not None and checked > ADHS_MAP_AS_OF


def apply_adhs_map_guard(
    incoming: dict[str, Any],
    existing: dict[str, Any] | None,
) -> tuple[dict[str, Any] | None, list[str]]:
    """Decide what the Feb 2025 map may write.

    Returns (row, skipped field names). A CLOSED row returns (None, ...) so
    the upsert does not run. The database trigger still blocks a status
    change that is not strictly newer; this guard is stricter and leaves
    the whole row alone.
    """
    if existing is None:
        return dict(incoming), []
    if str(existing.get("license_status") or "").strip().upper() == "CLOSED":
        return None, ["CLOSED"]

    out = dict(incoming)
    if not azcc_row_is_newer(existing):
        if out.get("license_expiration") is None and existing.get("license_expiration") is not None:
            out["license_expiration"] = existing["license_expiration"]
        return out, []

    skipped: list[str] = []
    for field in PROTECTED_FIELDS:
        old = existing.get(field)
        new = out.get(field)
        differs = (
            _as_date(old) != _as_date(new)
            if field == "license_expiration"
            else old != new
        )
        if differs:
            skipped.append(field)
        out[field] = old
    return out, skipped


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------


def fetch_all_facilities() -> list[dict[str, Any]]:
    """Paginate the ArcGIS FeatureServer (maxRecordCount=1000) and return all features."""
    print("Fetching ADHS ArcGIS FeatureServer/12 (Residential Facilities) …", flush=True)
    all_features: list[dict[str, Any]] = []
    offset = 0
    limit = 1000
    while True:
        r = requests.post(
            ARCGIS_URL,
            data={
                "where": "1=1",
                "outFields": "*",
                "returnGeometry": "true",
                "resultRecordCount": limit,
                "resultOffset": offset,
                "f": "json",
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        if "error" in data:
            raise RuntimeError(f"ArcGIS error: {data['error']}")
        features = data.get("features", [])
        all_features.extend(features)
        print(f"  offset={offset}: fetched {len(features)} (total so far: {len(all_features)})", flush=True)
        if len(features) < limit:
            break
        offset += limit
    print(f"  Total raw features: {len(all_features)}", flush=True)
    return all_features


# ---------------------------------------------------------------------------
# Transform
# ---------------------------------------------------------------------------


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "facility"


def parse_license_level(subtype: str | None) -> str | None:
    """
    Extract the ADHS license level from the SUBTYPE / LICENSE_SUBTYPE field.

    Field values take the form: "ASSISTED LIVING HOME-DIRECTED"
                                  "ASSISTED LIVING CENTER-PERSONAL"
                                  "ASSISTED LIVING CENTER-SUPERVISORY"

    Returns one of: 'Directed Care' | 'Personal Care' | 'Supervisory Care' | None
    """
    if not subtype:
        return None
    upper = subtype.upper()
    if upper.endswith("-DIRECTED"):
        return "Directed Care"
    if upper.endswith("-PERSONAL"):
        return "Personal Care"
    if upper.endswith("-SUPERVISORY"):
        return "Supervisory Care"
    return None


def transform_feature(feature: dict[str, Any]) -> dict[str, Any] | None:
    """Map a single ArcGIS feature to our facilities columns.
    Returns None if the record should be skipped (non-ALF type).
    """
    attrs = feature.get("attributes", {})
    geom = feature.get("geometry") or {}

    # Filter to ALF types only
    fac_type: str = attrs.get("TYPE") or ""
    if fac_type not in ALF_TYPES:
        return None

    # Only active facilities
    if attrs.get("OPERATION_STATUS") != "ACTIVE":
        return None

    facid: str | None = attrs.get("FACID")          # e.g. "AL12963" — ADHS external ID
    license_num: str | None = attrs.get("LICENSE_NUMBER")  # e.g. "AL12963N"
    facility_name: str | None = attrs.get("FACILITY_NAME")

    # Geometry — ADHS GIS uses N_LAT / N_LON (CENTRUS-geocoded addresses, WGS84)
    lat: float | None = attrs.get("N_LAT")
    lon: float | None = attrs.get("N_LON")
    # Fall back to ArcGIS geometry if N_LAT is null
    if not lat and geom:
        lat = geom.get("y")
        lon = geom.get("x")

    # License level from SUBTYPE (more reliable) or LICENSE_SUBTYPE
    subtype_raw: str | None = attrs.get("SUBTYPE") or attrs.get("LICENSE_SUBTYPE")
    az_license_level = parse_license_level(subtype_raw)

    # HB2764 MC subclass — field not yet in dataset as of probe (2026-06-15)
    az_mc_subclass: bool | None = None

    # Memory care gates (in priority order):
    #   1. Directed Care license level (established proxy, highest confidence)
    #   2. HB2764 mc_subclass (not yet populated, future signal)
    #   3. Name match (Tier-3, lower confidence)
    directed_care = az_license_level == "Directed Care"
    name_mc_match = bool(_MC_KEYWORDS.search(facility_name or ""))
    serves_memory_care = directed_care or bool(az_mc_subclass) or name_mc_match

    # az_memory_care_endorsed = Tier-1 signal (Directed Care or future HB2764 subclass)
    az_memory_care_endorsed = directed_care or bool(az_mc_subclass) or None

    # memory_care_disclosure_filed mirrors OR/PA pattern:
    # set true when we have a Tier-1 regulatory signal, not just a name match
    memory_care_disclosure_filed = az_memory_care_endorsed or False
    memory_care_disclosure_source = "ADHS Directed Care License" if az_memory_care_endorsed else None

    # Address — prefer normalized N_ADDRESS fields (CENTRUS geocoded, better quality)
    address_line1 = attrs.get("N_ADDRESS") or attrs.get("ADDRESS") or None
    city_raw: str | None = attrs.get("N_CITY") or attrs.get("CITY")
    city = city_raw.title() if city_raw else None
    zip_raw = attrs.get("N_ZIP") or attrs.get("ZIP")
    zip_code = str(int(zip_raw)) if zip_raw else None
    county: str | None = attrs.get("N_COUNTY") or attrs.get("COUNTY")
    if county:
        county = re.sub(r"\s+COUNTY$", "", county, flags=re.IGNORECASE).strip()

    # Phone: strip to digits+extension
    phone_raw: str | None = attrs.get("Telephone")

    # Capacity
    capacity_raw = attrs.get("Capacity")
    beds: int | None = None
    if capacity_raw is not None:
        try:
            beds = int(float(capacity_raw))
        except (ValueError, TypeError):
            pass

    # Slugs — required NOT NULL columns
    ext_id = facid or license_num or "unknown"
    city_slug = slugify(city) if city else "unknown-city"
    name_slug = slugify(facility_name) if facility_name else "facility"
    slug = f"{name_slug}-{slugify(ext_id)}"

    return {
        "state_code": "AZ",
        "external_id": facid,
        "license_number": license_num,
        "name": facility_name,
        "license_type": fac_type.title() if fac_type else None,
        "license_subtype": subtype_raw,
        "license_status": "LICENSED",  # we filter to OPERATION_STATUS='ACTIVE'
        "license_expiration": parse_arcgis_date(
            attrs.get("license_expiration") if attrs.get("license_expiration") is not None
            else attrs.get("LICENSE_EXPIRATION")
        ),
        "beds": beds,
        "street": address_line1,
        "city": city,
        "city_slug": city_slug,
        "slug": slug,
        "county": county,
        "zip": zip_code,
        "phone": phone_raw,
        "latitude": lat,
        "longitude": lon,
        "serves_memory_care": serves_memory_care,
        "mc_review_status": "auto_published",
        "publishable": False,  # recompute_publishable.py sets this after inspections load
        "memory_care_disclosure_filed": memory_care_disclosure_filed,
        "memory_care_disclosure_source": memory_care_disclosure_source,
        # AZ-specific columns
        "az_license_level": az_license_level,
        "az_mc_subclass": az_mc_subclass,
        "az_memory_care_endorsed": az_memory_care_endorsed,
        "source_url": (
            "https://azgeo-open-data-agic.hub.arcgis.com/datasets/"
            "ADHSGIS::state-licensed-long-term-care-facilities-in-arizona"
        ),
    }


# ---------------------------------------------------------------------------
# Upsert
# ---------------------------------------------------------------------------

UPSERT_SQL = """
    INSERT INTO facilities (
        state_code, external_id, license_number,
        name, license_type, license_subtype, license_status, license_expiration,
        beds,
        street, city, city_slug, slug, county, zip, phone,
        latitude, longitude,
        serves_memory_care, mc_review_status, publishable,
        memory_care_disclosure_filed, memory_care_disclosure_source,
        az_license_level, az_mc_subclass, az_memory_care_endorsed,
        source_url
    ) VALUES (
        %(state_code)s, %(external_id)s, %(license_number)s,
        %(name)s, %(license_type)s, %(license_subtype)s, %(license_status)s, %(license_expiration)s,
        %(beds)s,
        %(street)s, %(city)s, %(city_slug)s, %(slug)s, %(county)s, %(zip)s, %(phone)s,
        %(latitude)s, %(longitude)s,
        %(serves_memory_care)s, %(mc_review_status)s, %(publishable)s,
        %(memory_care_disclosure_filed)s, %(memory_care_disclosure_source)s,
        %(az_license_level)s, %(az_mc_subclass)s, %(az_memory_care_endorsed)s,
        %(source_url)s
    )
    ON CONFLICT (state_code, external_id) WHERE state_code = 'AZ' AND external_id IS NOT NULL DO UPDATE SET
        license_number             = EXCLUDED.license_number,
        name                       = EXCLUDED.name,
        license_type               = EXCLUDED.license_type,
        license_subtype            = EXCLUDED.license_subtype,
        license_status             = EXCLUDED.license_status,
        license_expiration         = COALESCE(EXCLUDED.license_expiration, facilities.license_expiration),
        beds                       = EXCLUDED.beds,
        street                     = EXCLUDED.street,
        city                       = EXCLUDED.city,
        city_slug                  = EXCLUDED.city_slug,
        county                     = EXCLUDED.county,
        zip                        = EXCLUDED.zip,
        phone                      = EXCLUDED.phone,
        latitude                   = EXCLUDED.latitude,
        longitude                  = EXCLUDED.longitude,
        az_license_level           = EXCLUDED.az_license_level,
        source_url                 = EXCLUDED.source_url
"""


def load_existing_license_rows(
    conn: psycopg.Connection,
    external_ids: list[str],
) -> dict[str, dict[str, Any]]:
    """Read the columns the map is not allowed to clobber. No writes."""
    if not external_ids:
        return {}
    sql = """
        SELECT external_id, license_number, license_expiration, license_status,
               license_status_source, license_status_checked_at,
               az_license_level, az_mc_subclass, az_memory_care_endorsed,
               serves_memory_care, memory_care_disclosure_filed,
               memory_care_disclosure_source
        FROM facilities
        WHERE state_code = 'AZ' AND external_id = ANY(%s)
    """
    with conn.cursor() as cur:
        cur.execute(sql, (external_ids,))
        cols = [desc.name for desc in cur.description]
        return {row[0]: dict(zip(cols, row)) for row in cur.fetchall()}


def upsert_batch(
    conn: psycopg.Connection,
    records: list[dict[str, Any]],
) -> tuple[int, int]:
    """Upsert records with per-row savepoints; return (success_count, error_count).

    A license that already exists updates that row, even when the layer's FACID
    differs. Memory-care fields are not part of the update.
    """
    with conn.cursor() as cur:
        idmap = load_identity_map(cur, "AZ")
    pending: list[dict[str, Any]] = []
    for rec in records:
        if reuse_identity(
            rec,
            idmap,
            [rec.get("license_number"), rec.get("external_id")],
            keep_stored_license=True,
            keep_stored_external_id=True,
        ) is None:
            print(
                f"  skip {rec.get('license_number')}: license is ambiguous "
                "or belongs to a different row than the slug",
                flush=True,
            )
            continue
        pending.append(rec)
    existing = load_existing_license_rows(
        conn,
        [rec["external_id"] for rec in pending if rec.get("external_id")],
    )
    success = 0
    errors = 0
    written: list[dict[str, Any]] = []
    with conn.cursor() as cur:
        for rec in pending:
            guarded, skipped_fields = apply_adhs_map_guard(
                rec, existing.get(rec.get("external_id"))
            )
            if guarded is None:
                print(
                    f"  skip CLOSED {rec.get('external_id')}: row untouched",
                    flush=True,
                )
                continue
            if skipped_fields:
                print(
                    f"  kept newer license fields on {rec.get('external_id')}: "
                    f"{', '.join(skipped_fields)}",
                    flush=True,
                )
            rec = guarded
            db_rec = {k: v for k, v in rec.items() if not str(k).startswith("_")}
            sp = f"sp_{re.sub(r'[^a-z0-9]', '_', (rec.get('external_id') or 'unknown').lower())}"
            try:
                cur.execute(f"SAVEPOINT {sp}")
                cur.execute(UPSERT_SQL, db_rec)
                cur.execute(f"RELEASE SAVEPOINT {sp}")
                success += 1
                note_kept_external_id(rec)
                written.append(rec)
            except Exception as exc:
                cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                print(f"  ERROR {rec.get('external_id')}: {exc}", flush=True)
                errors += 1
        record_protected_diffs(cur, "AZ", written, PRESERVE_ON_UPDATE)
    report_review_log()
    return success, errors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest AZ ADHS ALF directory from ArcGIS")
    parser.add_argument("--mc-only", action="store_true",
                        help="Only load Directed Care (serves_memory_care=true) rows")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print transformed rows, no DB writes")
    parser.add_argument(
        "--allow-stale-layer",
        action="store_true",
        help="Run even though layer 12 still shows pre-rename ids. Blake's OK only.",
    )
    args = parser.parse_args()
    if not args.allow_stale_layer:
        print(STALE_LAYER_REFUSAL, file=sys.stderr)
        raise SystemExit(1)

    load_env()

    if not args.dry_run and not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set. Add to .env.local.", file=sys.stderr)
        sys.exit(1)

    features = fetch_all_facilities()
    records_raw = [transform_feature(f) for f in features]
    records = [r for r in records_raw if r is not None]
    skipped = len(records_raw) - len(records)
    print(f"  Filtered out {skipped} non-ALF / inactive records", flush=True)

    if args.mc_only:
        records = [r for r in records if r["serves_memory_care"]]
        print(f"  Filtered to {len(records)} serves_memory_care=true facilities", flush=True)

    # Summary
    total = len(records)
    mc = sum(1 for r in records if r["serves_memory_care"])
    directed = sum(1 for r in records if r["az_license_level"] == "Directed Care")
    personal = sum(1 for r in records if r["az_license_level"] == "Personal Care")
    supervisory = sum(1 for r in records if r["az_license_level"] == "Supervisory Care")
    no_level = sum(1 for r in records if r["az_license_level"] is None)
    with_lat = sum(1 for r in records if r["latitude"])
    homes = sum(1 for r in records if "Home" in (r["license_type"] or ""))
    centers = sum(1 for r in records if "Center" in (r["license_type"] or ""))
    print(
        f"\nRecords to upsert: {total} total "
        f"({homes} ALH / {centers} ALC) "
        f"| {with_lat} geocoded"
        f"\nserves_memory_care=true: {mc} "
        f"(Directed={directed} Personal={personal} Supervisory={supervisory} no-level={no_level})",
        flush=True,
    )

    if args.dry_run:
        print("\n--- DRY RUN: sample records ---")
        for r in records[:5]:
            print(
                f"  {(r['external_id'] or '?'):12s} "
                f"{(r['name'] or '?')[:40]:40s} "
                f"level={r['az_license_level']} "
                f"mc={r['serves_memory_care']} "
                f"city={r['city']}",
                flush=True,
            )
        print(f"\nDry run complete. {total} rows would be upserted. No DB writes.")
        return

    dsn = os.environ["DATABASE_URL"]
    with psycopg.connect(dsn) as conn:
        print(f"\nUpserting {total} records …", flush=True)
        success, errors = upsert_batch(conn, records)
        conn.commit()

    print(f"\nDone. success={success} errors={errors}", flush=True)
    if errors and total and (errors / total) > 0.05:
        sys.exit(1)


if __name__ == "__main__":
    main()
