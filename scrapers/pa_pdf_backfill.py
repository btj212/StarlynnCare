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


def _column_name(desc: Any) -> str:
    name = getattr(desc, "name", None)
    if isinstance(name, str):
        return name
    return str(desc[0])


def _normalize_token(value: str | None) -> str:
    """Lowercase and drop whitespace and punctuation so re-runs compare equal."""
    if not value:
        return ""
    return _NORM_RE.sub("", value.lower())


def dedupe_key(code: str | None, description: str | None) -> tuple[str, str]:
    """(normalized code, md5 of the normalized description).

    Two citations of the same 55 Pa Code section both stay when the
    description differs. Used to collapse exact copies inside one sidecar.
    A re-run does not match on this key: the model rewrites the description
    every time, so the inspection's rows are replaced instead.
    """
    digest = hashlib.md5(_normalize_token(description).encode("utf-8")).hexdigest()
    return (_normalize_token(code), digest)


def rows_to_store(existing_count: int, incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The rows to write for one inspection.

    Exact copies inside the new list collapse. A new list shorter than the
    rows already stored is refused, so a bad parse cannot wipe a longer one.
    """
    kept: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for deficiency in incoming:
        desc = deficiency.get("description") or ""
        stored = desc[:1000] if desc else None
        key = dedupe_key(deficiency.get("code"), stored)
        if key in seen:
            continue
        seen.add(key)
        kept.append(deficiency)
    if len(kept) < existing_count:
        raise RuntimeError(
            f"holding inspection: new count {len(kept)} is below existing {existing_count}"
        )
    return kept


def empty_backfill_is_failure(ok: int, written: int, verified_zeros: int) -> bool:
    """A week of clean letters writes zero rows on purpose.

    The failure is a week that was supposed to write citations and wrote none.
    """
    if ok <= 0 or written != 0:
        return False
    return verified_zeros < ok


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
        raise RuntimeError(f"inventory row {inv_id} has no inspection_id")

    if dry_run:
        print(f"    {str(inv_id)[:8]}  {len(deficiencies)} deficiencies  (dry-run)", flush=True)
        return len(deficiencies)

    # Replace this inspection's rows in one transaction. The model rewrites
    # the description on every run, so matching old rows by that text inserts
    # a second copy. A shorter new list is held: the old rows stay.
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT code, description, inspector_narrative, plan_of_correction,
                   severity, immediate_jeopardy, civil_money_penalty, status,
                   cited_date, state_severity_raw
            FROM deficiencies
            WHERE inspection_id = %s
            """,
            (inspection_id,),
        )
        columns = [_column_name(desc) for desc in (cur.description or ())]
        existing_rows = [dict(zip(columns, row)) for row in cur.fetchall()]

    kept = rows_to_store(len(existing_rows), deficiencies)
    if existing_rows:
        backup = pdf_path.parent / f"{pdf_path.stem}.deficiencies.backup.json"
        backup.write_text(
            json.dumps(
                {"inspection_id": inspection_id, "rows": existing_rows},
                indent=2,
                default=str,
            )
        )

    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM deficiencies WHERE inspection_id = %s",
                (inspection_id,),
            )
        for d in kept:
            sev_raw = d.get("severity") or ""
            desc = d.get("description") or ""
            sev_int, is_ij = map_pa_severity(sev_raw, desc)
            code = d.get("code") or None
            poc_text = d.get("poc_text") or None
            corrected = d.get("corrected")
            cmp_amount = _parse_dollar_amount(desc) if sev_raw and "penalty" in sev_raw.lower() else None
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

    return len(kept)


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

    ok = err = total_defs = verified_zeros = 0
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
                if n == 0:
                    verified_zeros += 1
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

    # A week of letters that truly cite nothing writes zero rows. That is not
    # a schema failure. A week that claimed citations and wrote none still is.
    if not dry_run and empty_backfill_is_failure(ok, total_defs, verified_zeros):
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
