#!/usr/bin/env python3
"""Apply a saved Illinois LLCS roster without inventing licenses.

The roster file comes from il_llcs_live_roster.py. Every row is written to
il_source_rows. An existing facility is updated only when its normalized name
matches an Active lookup row: the Alzheimer's Special Care Program flag and
the public facility id are stored, and the fake visit-id URL fragment is
replaced. The stored license number and slug stay as they are.

A new facility row is inserted only for an Active home whose lookup field
Alzheimer's Special Care Program is Yes, and whose name is not already on
file. The license number is the lookup's licId. Probationary licenses are
stored and left unpublished. Inactive and change-of-ownership rows stay in
the ledger.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.types.json import Jsonb

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ROSTER = REPO_ROOT / "scrapers" / "data" / "il_llcs" / "live-roster.json"
LOOKUP_URL = "https://llcs.dph.illinois.gov/s/facility-lookup?language=en_US"

_spec = importlib.util.spec_from_file_location(
    "il_llcs_directory_scrape",
    Path(__file__).with_name("il_llcs_directory_scrape.py"),
)
if _spec is None or _spec.loader is None:
    raise RuntimeError("Could not load il_llcs_directory_scrape.py")
_directory = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_directory)


def normalize_facility_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = REPO_ROOT / name
        if path.is_file():
            load_dotenv(path)
            return


def parse_mdy(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%m/%d/%Y").date().isoformat()
    except ValueError:
        return None


def reason_token(status: str) -> str:
    token = re.sub(r"[^a-z0-9]+", "_", status.lower()).strip("_")
    return token or "inactive"


_NAME_STOP = {"and", "or", "of", "in", "the", "a", "at", "by", "for", "to"}
_NAME_UPPER = {
    "llc": "LLC",
    "llp": "LLP",
    "nfp": "NFP",
    "lc": "LC",
    "mc": "MC",
    "al": "AL",
    "usa": "USA",
    "pc": "PC",
}
_NAME_ROMAN = {
    "ii": "II",
    "iii": "III",
    "iv": "IV",
    "vi": "VI",
    "vii": "VII",
    "viii": "VIII",
    "ix": "IX",
}


def _title_piece(core: str, index: int) -> str:
    if core in _NAME_UPPER:
        return _NAME_UPPER[core]
    if core == "inc":
        return "Inc."
    if core in _NAME_ROMAN:
        return _NAME_ROMAN[core]
    if core.startswith("mc") and len(core) > 3 and core[2:].isalpha():
        return "Mc" + core[2:].capitalize()
    if index > 0 and core in _NAME_STOP:
        return core
    return core.capitalize()


def better_titleize(text: str) -> str:
    """Title-case an all-caps portal name without turning MC, LLC, or II into words."""
    words: list[str] = []
    for index, word in enumerate(text.split()):
        match = re.match(r"^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$", word)
        if match is None:
            words.append(word)
            continue
        prefix, body, suffix = match.group(1), match.group(2), match.group(3)
        if not body:
            words.append(word)
            continue
        parts = []
        part_index = 0
        for part in re.split(r"([-/])", body):
            if part in "-/":
                parts.append(part)
                continue
            core = re.sub(r"[^a-z0-9]", "", part.lower())
            parts.append(_title_piece(core, index if part_index == 0 else 1) if core else part)
            part_index += 1
        piece = "".join(parts)
        if piece.endswith(".") and suffix.startswith("."):
            suffix = suffix[1:]
        words.append(f"{prefix}{piece}{suffix}")
    return " ".join(words)


def display_name(name: str) -> str:
    if name.isupper():
        return better_titleize(name)
    return name


def repair_display_names(conn: psycopg.Connection, roster_path: Path, apply: bool) -> None:
    """Fix title case on rows this roster inserted. Leave the original license numbers alone."""
    payload = json.loads(roster_path.read_text(encoding="utf-8"))
    changes = []
    for row in payload["facilities"]:
        portal_name = row.get("name") or ""
        if not portal_name.isupper():
            continue
        if str(row.get("status") or "").lower() != "active":
            continue
        if str(row.get("alzheimer_special_care_program") or "").lower() != "yes":
            continue
        lic = _directory.pad_il_license((row.get("license") or {}).get("licId"))
        if not lic:
            continue
        old = _directory.titleize(portal_name)
        new = better_titleize(portal_name)
        if old == new:
            continue
        changes.append((lic, old, new, row.get("facility_id")))

    print(f"name repairs to consider: {len(changes)}", flush=True)
    updated = 0
    with conn.cursor() as cur:
        cur.execute("SELECT state_code, city_slug, slug, id::text FROM facilities")
        taken = {(state, city, slug) for state, city, slug, _id in cur.fetchall()}
        for lic, old, new, facility_public_id in changes:
            cur.execute(
                """
                SELECT id::text, name, slug, city_slug, publishable
                FROM facilities
                WHERE state_code = 'IL' AND license_number = %s
                """,
                (lic,),
            )
            found = cur.fetchone()
            if found is None or found[1] != old or found[4]:
                continue
            facility_id, _name, _slug, city_slug, _publishable = found
            slug = _directory.make_slug(new, lic)
            key = ("IL", city_slug, slug)
            if key in taken and slug != _slug:
                slug = f"{slug}-{facility_public_id}"
                key = ("IL", city_slug, slug)
            if key in taken and slug != _slug:
                print(f"  skip slug collision: {new}", flush=True)
                continue
            print(f"  {old} → {new}", flush=True)
            if not apply:
                continue
            cur.execute(
                """
                UPDATE facilities
                SET name = %s, slug = %s
                WHERE id = %s AND state_code = 'IL' AND publishable = false
                """,
                (new, slug, facility_id),
            )
            if cur.rowcount:
                taken.discard(("IL", city_slug, _slug))
                taken.add(key)
                updated += 1
    if apply:
        conn.commit()
        print(f"renamed {updated}", flush=True)
    else:
        conn.rollback()
        print("dry-run only", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--roster", default=str(DEFAULT_ROSTER))
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--repair-names",
        action="store_true",
        help="Retitle all-caps portal names on unpublished rows this roster inserted.",
    )
    args = parser.parse_args()
    load_env()
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")

    if args.repair_names:
        conn = psycopg.connect(url)
        conn.autocommit = False
        try:
            repair_display_names(conn, Path(args.roster), args.apply)
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        return

    payload = json.loads(Path(args.roster).read_text(encoding="utf-8"))
    facilities = payload["facilities"]
    active_by_name: dict[str, dict[str, Any]] = {}
    for row in facilities:
        if str(row.get("status") or "").lower() != "active":
            continue
        active_by_name.setdefault(normalize_facility_name(row["name"]), row)

    conn = psycopg.connect(url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, license_number, slug, source_url
                FROM facilities
                WHERE state_code = 'IL'
                """
            )
            existing = cur.fetchall()
            cur.execute("SELECT slug FROM facilities")
            slugs = {row[0] for row in cur.fetchall()}
            cur.execute("SELECT license_number FROM facilities WHERE license_number IS NOT NULL")
            licenses = {row[0] for row in cur.fetchall()}

        existing_by_name: dict[str, list[tuple]] = {}
        for row in existing:
            existing_by_name.setdefault(normalize_facility_name(row[1]), []).append(row)

        flag_updates = []
        inserts = []
        skipped_probationary_names = 0
        for key, row in active_by_name.items():
            program_yes = str(row.get("alzheimer_special_care_program") or "").lower() == "yes"
            matches = existing_by_name.get(key, [])
            if len(matches) == 1:
                facility_id, _name, _license, _slug, source_url = matches[0]
                flag_updates.append((program_yes, row.get("facility_id"), facility_id, source_url))
                continue
            if len(matches) > 1 or not program_yes:
                continue
            license_status = str((row.get("license") or {}).get("license_status") or "")
            if license_status not in {"Active", "Probationary"}:
                continue
            if license_status == "Probationary":
                skipped_probationary_names += 0
            lic = _directory.pad_il_license((row.get("license") or {}).get("licId"))
            if not lic or lic in licenses:
                print(f"skip insert, license unusable: {row['name']} {lic}", flush=True)
                continue
            name = display_name(row["name"])
            slug = _directory.make_slug(name, lic)
            if slug in slugs:
                slug = f"{slug}-{row['facility_id']}"
            slugs.add(slug)
            licenses.add(lic)
            inserts.append({
                "name": name,
                "license_number": lic,
                "slug": slug,
                "external_id": row.get("facility_id"),
                "il_dementia_program_flag": True,
                "il_mc_name_match": _directory.is_mc_candidate(row["name"]),
                "street": _directory.titleize(row["street"]) if row.get("street") and str(row["street"]).isupper() else row.get("street"),
                "city": _directory.titleize(row["city"]) if row.get("city") else None,
                "city_slug": _directory.slugify(row["city"]) if row.get("city") else "unknown-city",
                "zip": (row.get("zip") or "")[:10] or None,
                "phone": row.get("phone"),
                "license_status": "LICENSED" if license_status == "Active" else "PROBATIONARY",
                "license_expiration": parse_mdy((row.get("license") or {}).get("expiration_date")),
                "serves_memory_care": True,
            })

        chosen: dict[str, dict[str, Any]] = {}
        for row in facilities:
            source_key = str(row.get("facility_id") or row.get("salesforce_id") or "")
            if not source_key:
                continue
            current = chosen.get(source_key)
            incoming_active = str(row.get("status") or "").lower() == "active"
            if current is None:
                chosen[source_key] = {**row, "prior_names": []}
                continue
            current_active = str(current.get("status") or "").lower() == "active"
            if incoming_active and not current_active:
                chosen[source_key] = {
                    **row,
                    "prior_names": [*current.get("prior_names", []), current.get("name")],
                }
                continue
            current.setdefault("prior_names", []).append(row.get("name"))

        ledger_rows = []
        for source_key, row in chosen.items():
            active = str(row.get("status") or "").lower() == "active"
            ledger_rows.append((
                "llcs_directory",
                source_key,
                "normalized" if active else "quarantined",
                None if active else reason_token(str(row.get("status") or "inactive")),
                row.get("facility_id"),
                Jsonb({
                    "name": row.get("name"),
                    "status": row.get("status"),
                    "alzheimer_special_care_program": row.get("alzheimer_special_care_program"),
                    "alzheimer_units": row.get("alzheimer_units"),
                    "city": row.get("city"),
                    "street": row.get("street"),
                    "zip": row.get("zip"),
                    "county": row.get("county"),
                    "salesforce_id": row.get("salesforce_id"),
                    "licId": (row.get("license") or {}).get("licId"),
                    "license_status": (row.get("license") or {}).get("license_status"),
                    "expiration_date": (row.get("license") or {}).get("expiration_date"),
                    "prior_names": [name for name in row.get("prior_names") or [] if name],
                    "lookup_url": LOOKUP_URL,
                }),
            ))

        print(
            json.dumps({
                "active_lookup_rows": len(active_by_name),
                "existing_flag_updates": len(flag_updates),
                "flag_yes": sum(1 for item in flag_updates if item[0]),
                "new_program_yes_rows": len(inserts),
                "new_licensed": sum(1 for item in inserts if item["license_status"] == "LICENSED"),
                "new_probationary": sum(1 for item in inserts if item["license_status"] == "PROBATIONARY"),
                "ledger_rows": len(ledger_rows),
                "ledger_active": sum(1 for row in chosen.values() if str(row.get("status") or "").lower() == "active"),
            }),
            flush=True,
        )
        if not args.apply:
            print("dry-run only", flush=True)
            conn.rollback()
            return

        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO il_source_rows (
                    source, source_key, disposition, reason, facility_external_id, raw
                ) VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (source, source_key) DO UPDATE SET
                    disposition = EXCLUDED.disposition,
                    reason = EXCLUDED.reason,
                    facility_external_id = EXCLUDED.facility_external_id,
                    raw = EXCLUDED.raw,
                    ingested_at = now()
                """,
                ledger_rows,
            )
            for program_yes, facility_public_id, facility_uuid, source_url in flag_updates:
                next_url = source_url
                if source_url and "#license=" in source_url:
                    next_url = LOOKUP_URL
                cur.execute(
                    """
                    UPDATE facilities
                    SET il_dementia_program_flag = %s,
                        external_id = %s,
                        source_url = %s,
                        state_records_checked_at = now()
                    WHERE id = %s
                      AND state_code = 'IL'
                    """,
                    (program_yes, facility_public_id, next_url, facility_uuid),
                )
            cur.executemany(
                """
                INSERT INTO facilities (
                    state_code, name, license_number, license_type,
                    il_mc_name_match, il_dementia_program_flag,
                    street, city, city_slug, zip, phone, slug,
                    license_status, license_expiration, serves_memory_care,
                    mc_review_status, publishable, source_url, external_id,
                    state_records_checked_at
                ) VALUES (
                    'IL', %(name)s, %(license_number)s, 'ALE',
                    %(il_mc_name_match)s, %(il_dementia_program_flag)s,
                    %(street)s, %(city)s, %(city_slug)s, %(zip)s, %(phone)s, %(slug)s,
                    %(license_status)s, %(license_expiration)s, %(serves_memory_care)s,
                    'auto_published', false, %(source_url)s, %(external_id)s,
                    now()
                )
                ON CONFLICT (state_code, license_number)
                WHERE state_code = 'IL' AND license_number IS NOT NULL
                DO NOTHING
                """,
                [{**row, "source_url": LOOKUP_URL} for row in inserts],
            )
        conn.commit()
        print(f"applied flag updates {len(flag_updates)} inserts {len(inserts)} ledger {len(ledger_rows)}", flush=True)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"roster apply failed: {exc}", file=sys.stderr)
        raise
