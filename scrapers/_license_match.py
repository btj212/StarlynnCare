"""Reuse an existing facility row's identity (slug, city_slug, stored license) when a
real regulator license already exists, so a renamed facility updates in place.

Synthetic keys (MN-ALDC-<truncated name>, and anything else that is not a
regulator license) are not match keys. A key that belongs to more than one row,
or a license that points at a different row than the record's own slug, is
skipped and written to the review log. Nothing in that log is read back into
the database.

scrapers/out/ is gitignored, which is the same place as
wa_license_successor_review.jsonl. scripts/out/ is not a directory this repo
uses. The review file stays local so facility differences are not committed.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

# Review notes only. Nothing reads this file back into the database.
REVIEW_LOG_PATH = Path(__file__).resolve().parent / "out" / "directory_publish_review.jsonl"
RUN_ID = uuid.uuid4().hex
_review_count = 0
# Held until flush_review_log, which the ingests call only after commit.
_pending: list[tuple[Path, dict[str, Any]]] = []


class IdentityIndex:
    """License keys that identify exactly one row, plus the keys that do not."""

    def __init__(self) -> None:
        self.by_key: dict[str, dict[str, str]] = {}
        self.ambiguous: dict[str, list[str]] = {}
        self.by_place: dict[tuple[str, str], list[str]] = {}


def comparison_keys(raw: Any) -> list[str]:
    """Forms of a regulator ID that may be compared. Empty for a synthetic key.

    Leading zeros are a comparison alias only. The stored value is never rewritten
    here. An all-zero ID (0, 000000) is compared verbatim, so it does not meet a
    different all-zero placeholder. ALRC:n is a DHS report-card id, not an MDH
    HFID, and is not turned into a bare number. Letter IDs such as 50M133 are
    compared verbatim, so they do not meet a zero-padded number.
    """
    if raw is None:
        return []
    text = str(raw).strip()
    if not text:
        return []
    upper = text.upper()
    if upper.startswith("MN-ALDC-"):
        return []
    keys = [upper]
    if upper.isdigit():
        bare = upper.lstrip("0") or "0"
        # "0" would join every all-zero placeholder (incoming 0 vs stored 000000).
        if bare != "0" and bare not in keys:
            keys.append(bare)
    return keys


def load_identity_map(cur: Any, state_code: str) -> IdentityIndex:
    """Index real regulator IDs. A key shared by two homes is ambiguous, not a winner."""
    cur.execute(
        """
        SELECT id::text, slug, city_slug, license_number, external_id
        FROM facilities
        WHERE state_code = %s AND (license_number IS NOT NULL OR external_id IS NOT NULL)
        ORDER BY publishable DESC, created_at ASC, id
        """,
        (state_code,),
    )
    index = IdentityIndex()
    seen: dict[str, list[dict[str, str]]] = {}
    for fid, slug, city_slug, lic, ext in cur.fetchall():
        info = {
            "id": fid,
            "slug": slug,
            "city_slug": city_slug,
            "license_number": lic or "",
            "external_id": ext or "",
        }
        place = (city_slug, slug)
        places = index.by_place.setdefault(place, [])
        if fid not in places:
            places.append(fid)
        for key in comparison_keys(lic) + comparison_keys(ext):
            bucket = seen.setdefault(key, [])
            if any(item["id"] == fid for item in bucket):
                continue
            bucket.append(info)
    for key, infos in seen.items():
        if len(infos) > 1:
            index.ambiguous[key] = [item["id"] for item in infos]
        else:
            index.by_key[key] = infos[0]
    return index


def _views(idmap: Any) -> tuple[dict[str, dict[str, str]], dict[str, list[str]], dict[tuple[str, str], list[str]]]:
    if isinstance(idmap, IdentityIndex):
        return idmap.by_key, idmap.ambiguous, idmap.by_place
    return idmap, {}, {}


def reuse_identity(
    rec: dict[str, Any],
    idmap: Any,
    candidates: Iterable[str | None],
    *,
    keep_stored_license: bool = False,
    keep_stored_external_id: bool = False,
) -> bool | None:
    """Point rec at an existing row when one regulator ID matches.

    True: the record now carries that row's slug and city. False: no match, so
    the caller keeps today's slug path. None: do not write this record. That is
    an ambiguous ID, or a license that belongs to a different row than the slug.
    """
    by_key, ambiguous, by_place = _views(idmap)
    for candidate in candidates:
        keys = comparison_keys(candidate)
        ambiguous_key = next((key for key in keys if key in ambiguous), None)
        if ambiguous_key is not None:
            ids = ambiguous[ambiguous_key]
            print(
                f"  ! more than one row shares license/id {ambiguous_key}; "
                f"skipping {', '.join(ids)}"
            )
            _append([{
                "reason": "ambiguous_license",
                "field": "license_number",
                "facility_id": None,
                "other_facility_id": None,
                "row_ids": ids,
                "db_value": ids,
                "incoming_value": str(candidate).strip(),
                "db_result": "skipped",
            }])
            return None
        hit = next((by_key[key] for key in keys if key in by_key), None)
        if hit is None:
            continue
        place_ids = by_place.get((rec.get("city_slug"), rec.get("slug")), [])
        others = [row_id for row_id in place_ids if row_id != hit["id"]]
        if others:
            print(
                f"  ! license {keys[0]} is row {hit['id']} but the slug belongs to "
                f"{', '.join(others)}; skipping"
            )
            _append([{
                "reason": "license_slug_conflict",
                "field": "slug",
                "facility_id": hit["id"],
                "other_facility_id": others[0] if len(others) == 1 else others,
                "row_ids": [hit["id"], *others],
                "db_value": hit["slug"],
                "incoming_value": rec.get("slug"),
                "db_result": "skipped",
            }])
            return None
        rec["slug"] = hit["slug"]
        rec["city_slug"] = hit["city_slug"]
        if keep_stored_license and hit.get("license_number"):
            rec["license_number"] = hit["license_number"]
        if keep_stored_external_id and hit.get("external_id"):
            incoming_ext = rec.get("external_id")
            stored_ext = hit["external_id"]
            if incoming_ext and incoming_ext != stored_ext:
                rec["_kept_external_id_from"] = incoming_ext
                rec["_identity_id"] = hit["id"]
            rec["external_id"] = stored_ext
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


def _append(entries: list[dict[str, Any]], *, path: Path | None = None) -> int:
    """Queue review lines. The file is written by flush_review_log after commit."""
    if not entries:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    dest = path or REVIEW_LOG_PATH
    for item in entries:
        _pending.append((dest, {"run_id": RUN_ID, "timestamp": now, **item}))
    return len(entries)


def discard_review_log() -> None:
    """Drop queued lines. Used when the commit did not happen."""
    _pending.clear()


def flush_review_log() -> int:
    """Write queued lines. Call only after the database commit has succeeded."""
    global _review_count
    if not _pending:
        print(f"  review log: {REVIEW_LOG_PATH} (0 entries, run_id={RUN_ID})")
        return 0
    by_dest: dict[Path, list[dict[str, Any]]] = {}
    for dest, item in _pending:
        by_dest.setdefault(dest, []).append(item)
    _pending.clear()
    written = 0
    for dest, items in by_dest.items():
        dest.parent.mkdir(parents=True, exist_ok=True)
        with dest.open("a", encoding="utf-8") as fh:
            for item in items:
                fh.write(json.dumps(item, default=str) + "\n")
        written += len(items)
    _review_count += written
    print(f"  review log: {REVIEW_LOG_PATH} ({written} entries, run_id={RUN_ID})")
    return written


def note_protected_diffs(
    index: dict[tuple[str, str], dict[str, Any]],
    rows: list[dict[str, Any]],
    fields: tuple[str, ...],
    *,
    path: Path | None = None,
) -> int:
    """Queue each difference on an existing row. Inserts (no index hit) are skipped.

    The line is written by flush_review_log after commit. It describes a value
    that was left in place.
    """
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
                    "reason": "field_diff",
                    "facility_id": hit["id"],
                    "field": field,
                    "db_value": old,
                    "incoming_value": new,
                    "db_result": "updated",
                })
    return _append(diffs, path=path)


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


def note_kept_external_id(rec: dict[str, Any]) -> None:
    """Log a FACID we did not write, after the database accepted the row."""
    kept = rec.get("_kept_external_id_from")
    if not kept:
        return
    _append([{
        "reason": "kept_stored_external_id",
        "facility_id": rec.get("_identity_id"),
        "field": "external_id",
        "db_value": rec.get("external_id"),
        "incoming_value": kept,
        "db_result": "updated",
    }])


def report_review_log() -> None:
    """Write the queued review notes. Call this only after commit."""
    flush_review_log()
