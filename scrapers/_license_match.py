"""Reuse an existing facility row's identity (slug, city_slug, stored license) when the
license already exists, so a renamed facility updates in place instead of inserting."""
from __future__ import annotations
from typing import Any, Iterable

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
