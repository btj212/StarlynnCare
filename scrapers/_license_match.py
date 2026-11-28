"""Reuse an existing facility row's identity (slug, city_slug, stored license) when the
license already exists, so a renamed facility updates in place instead of inserting."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Iterable

# Review notes only. Nothing reads this file back into the database.
REVIEW_LOG_PATH = Path(__file__).resolve().parent / "out" / "directory_publish_review.jsonl"

def load_identity_map(cur: Any, state_code: str) -> dict[str, dict[str, str]]:
    """upper(license_number) and upper(external_id) -> {id, slug, city_slug, license_number}."""
    cur.execute(
        """
        SELECT id::text, slug, city_slug, license_number, external_id
        FROM facilities
        WHERE state_code = %s AND (license_number IS NOT NULL OR external_id IS NOT NULL)
        ORDER BY publishable DESC, created_at ASC, id
        """,
        (state_code,),
    )
    out: dict[str, dict[str, str]] = {}
    for fid, slug, city_slug, lic, ext in cur.fetchall():
        info = {"id": fid, "slug": slug, "city_slug": city_slug, "license_number": lic}
        for key in (lic, ext):
            if key:
                k = str(key).strip().upper()
                if k in out and out[k]["id"] != fid:
                    print(f"  ! more than one row shares license/id {k}; using {out[k]['id']}")
                    continue
                out.setdefault(k, info)
    return out

def reuse_identity(rec: dict[str, Any], idmap: dict[str, dict[str, str]],
                   candidates: Iterable[str | None], *, keep_stored_license: bool = False) -> bool:
    """If any candidate ID is already in the map, point rec at that row. Returns True on a hit."""
    for c in candidates:
        if not c:
            continue
        hit = idmap.get(str(c).strip().upper())
        if hit:
            rec["slug"] = hit["slug"]
            rec["city_slug"] = hit["city_slug"]
            if keep_stored_license and hit.get("license_number"):
                rec["license_number"] = hit["license_number"]
            return True
    return False


def load_review_index(
    cur: Any, state_code: str, fields: tuple[str, ...]
) -> dict[tuple[str, str], dict[str, Any]]:
    """(city_slug, slug) -> stored values an update must not clobber."""
    for name in fields:
        if not re.fullmatch(r"[a-z][a-z0-9_]*", name):
            raise ValueError(name)
    col_sql = ", ".join(fields)
    cur.execute(
        f"""
        SELECT id::text, city_slug, slug, {col_sql}
        FROM facilities
        WHERE state_code = %s
        """,
        (state_code,),
    )
    out: dict[tuple[str, str], dict[str, Any]] = {}
    for row in cur.fetchall():
        fid, city_slug, slug, *vals = row
        info: dict[str, Any] = {"id": fid, "city_slug": city_slug, "slug": slug}
        info.update(zip(fields, vals, strict=True))
        out.setdefault((city_slug, slug), info)
    return out


def note_protected_diffs(
    index: dict[tuple[str, str], dict[str, Any]],
    rows: list[dict[str, Any]],
    fields: tuple[str, ...],
    *,
    path: Path | None = None,
) -> int:
    """Append each difference on an existing row. Inserts (no index hit) are skipped."""
    diffs: list[dict[str, Any]] = []
    for rec in rows:
        hit = index.get((rec.get("city_slug"), rec.get("slug")))
        if not hit:
            continue
        for field in fields:
            if field not in rec:
                continue
            old = hit.get(field)
            new = rec.get(field)
            if old != new:
                diffs.append({
                    "facility_id": hit["id"],
                    "field": field,
                    "db_value": old,
                    "incoming_value": new,
                })
    if not diffs:
        return 0
    dest = path or REVIEW_LOG_PATH
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("a", encoding="utf-8") as fh:
        for item in diffs:
            fh.write(json.dumps(item, default=str) + "\n")
    return len(diffs)


def record_protected_diffs(
    cur: Any,
    state_code: str,
    rows: list[dict[str, Any]],
    fields: tuple[str, ...],
    *,
    path: Path | None = None,
) -> int:
    if not rows or not fields:
        return 0
    index = load_review_index(cur, state_code, fields)
    return note_protected_diffs(index, rows, fields, path=path)
