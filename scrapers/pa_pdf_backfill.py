#!/usr/bin/env python3
"""
PA PDF Backfill — read JSON sidecars from pa_pdf_parse.py and write into deficiencies.

Mirrors or_pdf_backfill.py but writes to the correct schema column names
(`code`, `total_deficiency_count`) per ERRORS.md entry #3 — and uses a
PA-specific severity vocabulary mapping (brief Section 5.2).

For each pa_pdf_inventory row with parse_status='done' and
backfill_status='pending':
  1. Read the .deficiencies.json sidecar next to the local PDF.
  2. For each deficiency in the sidecar, upsert into the deficiencies table.
  3. Map state_severity_raw → severity integer + immediate_jeopardy boolean.
  4. Update backfill_status='done'.

PA severity mapping (brief Section 5.2):
  "Citation"             → severity=1
  "Civil Money Penalty"  → severity=2  (escalate to 3 if amount ≥ $500 in narrative)
  "Provisional License"  → severity=3
  "Substantiated Abuse"  → severity=4, immediate_jeopardy=true
  "Immediate Jeopardy"   → severity=4, immediate_jeopardy=true
  "Revocation"           → severity=4, immediate_jeopardy=true

Usage:
  python3 -u scrapers/pa_pdf_backfill.py            # all pending
  python3 -u scrapers/pa_pdf_backfill.py --limit 50
  python3 -u scrapers/pa_pdf_backfill.py --dry-run
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

try:
    from pa_pdf_parse import classify_error, report_error_summary, should_fail
except ImportError:  # imported as scrapers.pa_pdf_backfill
    from scrapers.pa_pdf_parse import classify_error, report_error_summary, should_fail

REPO_ROOT = Path(__file__).resolve().parent.parent

# PA severity vocabulary (brief Section 5.2) — heuristic, similar to AZ/UT.
_PA_SEVERITY_MAP: dict[str, int] = {
    "citation":             1,
    "deficiency":           1,
    "civil money penalty":  2,
    "cmp":                  2,
    "provisional license":  3,
    "substantiated abuse":  4,
    "abuse":                4,
    "neglect":              4,
    "immediate jeopardy":   4,
    "ij":                   4,
    "revocation":           4,
    "license revocation":   4,
    "license refusal":      4,
}

_IJ_KEYS = {
    "immediate jeopardy",
    "ij",
    "substantiated abuse",
    "abuse",
    "neglect",
    "revocation",
    "license revocation",
    "license refusal",
}

# Match dollar amounts like "$500", "$1,250", "$25,000.00"
_DOLLAR_RE = re.compile(r"\$\s?([\d,]+)(?:\.\d+)?")
_NORM_RE = re.compile(r"[^a-z0-9]+")


def _normalize_token(value: str | None) -> str:
    """Lowercase and drop whitespace and punctuation so re-runs compare equal."""
    if not value:
        return ""
    return _NORM_RE.sub("", value.lower())


def dedupe_key(code: str | None, description: str | None) -> tuple[str, str]:
    """(normalized code, md5 of the normalized description).

    Two citations of the same 55 Pa Code section both insert when the
    description differs. The same wording on a second sidecar does not.
    The inspection id is paired with this key at insert time.
    """
    digest = hashlib.md5(_normalize_token(description).encode("utf-8")).hexdigest()
    return (_normalize_token(code), digest)


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
            return


def get_dsn() -> str:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    return url


def get_conn() -> psycopg.Connection:
    return psycopg.connect(get_dsn())


def _parse_dollar_amount(text: str | None) -> int | None:
    """Extract the largest dollar amount mentioned in text. Used to escalate CMP severity."""
    if not text:
        return None
    matches = _DOLLAR_RE.findall(text)
    if not matches:
        return None
    try:
        return max(int(m.replace(",", "")) for m in matches)
    except ValueError:
        return None


def map_pa_severity(raw: str | None, description: str | None = None) -> tuple[int | None, bool]:
    """
    Return (severity_int, immediate_jeopardy) from a raw severity string + optional
    description (used to escalate Civil Money Penalty rows when amount ≥ $500).
    """
    if not raw:
        return None, False
    key = raw.strip().lower()
    sev = _PA_SEVERITY_MAP.get(key)
    is_ij = key in _IJ_KEYS

    # CMP escalation: if amount ≥ $500 mentioned in description, bump to 3
    if sev == 2 and "civil money penalty" in key:
        amount = _parse_dollar_amount(description)
        if amount is not None and amount >= 500:
            sev = 3

    return sev, is_ij


def parse_date_str(raw: str | None) -> date | None:
    if not raw:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            pass
    return None


def backfill_one(
    conn: psycopg.Connection,
    inv_id: str,
    inspection_id: str | None,
    local_path: str,
    dry_run: bool,
) -> int:
    """Return count of deficiency rows written. Raises on sidecar parse error."""
    pdf_path = Path(local_path)
    sidecar = pdf_path.parent / f"{pdf_path.stem}.deficiencies.json"

    if not sidecar.exists():
        raise FileNotFoundError(f"Sidecar not found: {sidecar}")

    deficiencies: list[dict[str, Any]] = json.loads(sidecar.read_text())

    if not inspection_id:
        # Can't write deficiencies without an inspection FK
        return 0

    if dry_run:
        print(f"    {str(inv_id)[:8]}  {len(deficiencies)} deficiencies  (dry-run)", flush=True)
        return len(deficiencies)

    # One row per (inspection, normalized code, description hash). Repeat
    # citations of one section stay; a second pass of the same sidecar does not.
    existing: set[tuple[str, str]] = set()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT code, description FROM deficiencies WHERE inspection_id = %s",
            (inspection_id,),
        )
        for row_code, row_desc in cur.fetchall():
            existing.add(dedupe_key(row_code, row_desc))

    written = 0
    for d in deficiencies:
        sev_raw = d.get("severity") or ""
        desc = d.get("description") or ""
        sev_int, is_ij = map_pa_severity(sev_raw, desc)
        code = d.get("code") or None
        poc_text = d.get("poc_text") or None
        corrected = d.get("corrected")
        # Try to extract CMP amount for itemized penalty
        cmp_amount = _parse_dollar_amount(desc) if sev_raw and "penalty" in sev_raw.lower() else None
        stored_desc = desc[:1000] if desc else None
        key = dedupe_key(code, stored_desc)
        if key in existing:
            continue
        existing.add(key)

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO deficiencies (
                    inspection_id, code, description,
                    inspector_narrative, plan_of_correction,
                    severity, immediate_jeopardy,
                    civil_money_penalty,
                    status, cited_date, state_severity_raw
                ) VALUES (
                    %(inspection_id)s, %(code)s, %(description)s,
                    %(inspector_narrative)s, %(plan_of_correction)s,
                    %(severity)s, %(immediate_jeopardy)s,
                    %(civil_money_penalty)s,
                    %(status)s, %(cited_date)s, %(state_severity_raw)s
                )
                """,
                {
                    "inspection_id": inspection_id,
                    "code": code,
                    "description": desc[:1000] if desc else None,
                    "inspector_narrative": desc if desc else None,
                    "plan_of_correction": poc_text,
                    "severity": sev_int,
                    "immediate_jeopardy": is_ij,
                    "civil_money_penalty": cmp_amount,
                    "status": (
                        "corrected" if corrected is True
                        else ("open" if corrected is False else None)
                    ),
                    "cited_date": parse_date_str(d.get("date")),
                    "state_severity_raw": sev_raw if sev_raw else None,
                },
            )
        written += 1

    # Recount from the table. Adding the rows just written inflates the
    # total the next time this sidecar is applied.
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE inspections
            SET total_deficiency_count = (
                SELECT count(*) FROM deficiencies WHERE inspection_id = %s
            )
            WHERE id = %s
            """,
            (inspection_id, inspection_id),
        )

    return written


def run(dry_run: bool, limit: int | None) -> None:
    dsn = get_dsn()
    limit_sql = f"LIMIT {limit}" if limit else ""

    # Fetch work list with a short-lived connection
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, local_path, inspection_id
                FROM pa_pdf_inventory
                WHERE parse_status = 'done'
                  AND backfill_status = 'pending'
                  AND local_path IS NOT NULL
                ORDER BY created_at
                {limit_sql}
                """
            )
            rows = cur.fetchall()

    print(f"  {len(rows)} PDFs to backfill", flush=True)

    ok = err = total_defs = 0
    error_classes: dict[str, int] = {}
    for inv_id, local_path, inspection_id in rows:
        # Fresh connection per row — avoids session pooler idle-timeout disconnect
        with psycopg.connect(dsn) as conn:
            try:
                n = backfill_one(
                    conn,
                    str(inv_id),
                    str(inspection_id) if inspection_id else None,
                    local_path,
                    dry_run,
                )
                total_defs += n
                if not dry_run:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            UPDATE pa_pdf_inventory
                            SET backfill_status = 'done', backfilled_at = now()
                            WHERE id = %s
                            """,
                            (inv_id,),
                        )
                ok += 1
            except Exception as exc:
                if not dry_run:
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                UPDATE pa_pdf_inventory
                                SET backfill_status = 'error', backfill_error = %s
                                WHERE id = %s
                                """,
                                (str(exc)[:500], inv_id),
                            )
                    except Exception:
                        pass
                err += 1
                label = classify_error(exc)
                error_classes[label] = error_classes.get(label, 0) + 1
                print(f"  ERR {str(inv_id)[:8]}: {exc}", file=sys.stderr, flush=True)

    print(
        f"  Done — {ok} PDFs processed, {total_defs} deficiency rows written, {err} errors",
        flush=True,
    )
    report_error_summary("PA PDF backfill", error_classes)
    attempted = ok + err
    if not dry_run and should_fail(err, attempted):
        print(
            f"FAIL: {err} of {attempted} PDFs errored during backfill",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)

    # Fail loud: if we have parsed PDFs but wrote 0 deficiencies, the schema or
    # sidecar shape probably drifted (per CLAUDE.md Rule 12).
    if not dry_run and ok > 0 and total_defs == 0:
        print(
            "FAIL: 0 deficiency rows written across processed PDFs — check JSON sidecar shape and schema.",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill PA deficiencies from PDF JSON sidecars.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    load_env()
    run(args.dry_run, args.limit)


if __name__ == "__main__":
    main()
