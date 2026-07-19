#!/usr/bin/env python3
"""
Facility Watch — daily monitoring for facilities with active watchers.

Scans all regulator + news sources available per state, compares fingerprints
against the last snapshot, records change events, re-ingests when OR state
CSVs drift, and emails ADMIN_ALERT_EMAIL + confirmed watchers via Loops.

Oregon sources (Footsteps at Carman Oaks / license 50R398 exemplar):
  - ltclicensing.oregon.gov bulk CSV: Providers, Inspections, Violations, Regulatory Actions
  - Inspection detail pages (or_inspection_narratives.py) — full citation text
  - ODHS Enhanced Oversight list (or_signal_enhanced_oversight.py)
  - ODHS MCE endorsement cross-check (or_signal_mce.py)
  - News / legal search (Firecrawl — optional, requires FIRECRAWL_API_KEY)

Federal CMS Nursing Home Compare: only applies to licensed nursing facilities;
OR ALF/RCF facilities are flagged as N/A in scan payload.

City/county: no separate ALF inspection API in Lake Oswego / Clackamas County;
news search covers local enforcement reporting.

Usage:
  python3 scrapers/facility_watch_scan.py                    # all watched facilities
  python3 scrapers/facility_watch_scan.py --facility-id UUID  # single facility
  python3 scrapers/facility_watch_scan.py --dry-run           # detect only, no ingest/alerts
  python3 scrapers/facility_watch_scan.py --skip-news       # skip Firecrawl (no API cost)
  python3 scrapers/facility_watch_scan.py --baseline-only     # seed snapshots, no alerts

Cadence: .github/workflows/facility-watch-daily.yml (daily 14:00 UTC / 7am PT).
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = Path(__file__).resolve().parent
if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from _watch_alert import send_watch_change_alert  # noqa: E402

SITE_URL = os.environ.get("NEXT_PUBLIC_SITE_URL", "https://www.starlynncare.com").rstrip("/")

OR_SCRAPE_DIR = REPO_ROOT / ".firecrawl" / "or-scrape"
OR_PROVIDER_ID_COL = "Provider ID"
OR_PROVIDERS_ID_COL = "ID"


def load_env() -> None:
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if p.is_file():
            load_dotenv(p)
            return


def get_conn() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL / POSTGRES_URL not set")
    return psycopg.connect(url)


def fingerprint_rows(rows: list[dict[str, str]]) -> str:
    normalized = json.dumps(rows, sort_keys=True, default=str)
    return hashlib.sha256(normalized.encode()).hexdigest()


def filter_csv_by_id(csv_path: Path, id_col: str, external_id: str) -> list[dict[str, str]]:
    if not csv_path.is_file():
        return []
    out: list[dict[str, str]] = []
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw = (row.get(id_col) or "").strip()
            if raw.upper() == external_id.upper():
                out.append({k: (v or "").strip() for k, v in row.items()})
    out.sort(key=lambda r: json.dumps(r, sort_keys=True))
    return out


def latest_csv(prefix: str) -> Path | None:
    if not OR_SCRAPE_DIR.is_dir():
        return None
    matches = sorted(OR_SCRAPE_DIR.glob(f"{prefix}-*.csv"), reverse=True)
    return matches[0] if matches else None


def get_snapshot(cur: psycopg.Cursor, facility_id: str, source: str) -> tuple[str | None, dict]:
    cur.execute(
        "SELECT fingerprint, payload FROM facility_watch_snapshots WHERE facility_id = %s AND source = %s",
        (facility_id, source),
    )
    row = cur.fetchone()
    if not row:
        return None, {}
    return row[0], row[1] if isinstance(row[1], dict) else {}


def upsert_snapshot(
    cur: psycopg.Cursor,
    facility_id: str,
    source: str,
    fingerprint: str,
    payload: dict,
) -> None:
    cur.execute(
        """
        INSERT INTO facility_watch_snapshots (facility_id, source, fingerprint, payload)
        VALUES (%s, %s, %s, %s::jsonb)
        ON CONFLICT (facility_id, source) DO UPDATE SET
          fingerprint = EXCLUDED.fingerprint,
          payload = EXCLUDED.payload,
          scanned_at = now()
        """,
        (facility_id, source, fingerprint, json.dumps(payload)),
    )


def record_event(
    cur: psycopg.Cursor,
    *,
    facility_id: str,
    scan_run_id: str,
    source: str,
    event_type: str,
    summary: str,
    payload: dict,
) -> None:
    cur.execute(
        """
        INSERT INTO facility_watch_events
          (facility_id, scan_run_id, source, event_type, summary, payload)
        VALUES (%s, %s, %s, %s, %s, %s::jsonb)
        """,
        (facility_id, scan_run_id, source, event_type, summary, json.dumps(payload)),
    )


def detect_csv_source(
    conn: psycopg.Connection,
    *,
    facility: dict,
    scan_run_id: str,
    source: str,
    csv_prefix: str,
    id_col: str,
    event_type: str,
    dry_run: bool,
    baseline_only: bool,
) -> bool:
    """Return True if a change was detected (or baseline was seeded)."""
    csv_path = latest_csv(csv_prefix)
    rows = filter_csv_by_id(csv_path, id_col, facility["external_id"]) if csv_path else []
    fp = fingerprint_rows(rows)
    payload = {
        "csv_file": str(csv_path) if csv_path else None,
        "row_count": len(rows),
        "external_id": facility["external_id"],
        "rows_preview": rows[:5],
    }

    with conn.cursor() as cur:
        prev_fp, _prev_payload = get_snapshot(cur, facility["id"], source)
        if prev_fp is None:
            if not dry_run:
                upsert_snapshot(cur, facility["id"], source, fp, payload)
            print(f"  [{source}] baseline seeded ({len(rows)} rows)")
            conn.commit()
            return False

        if fp == prev_fp:
            print(f"  [{source}] unchanged ({len(rows)} rows)")
            if not dry_run:
                upsert_snapshot(cur, facility["id"], source, fp, payload)
                conn.commit()
            return False

        diff_summary = f"{source}: {len(rows)} rows (was fingerprint {prev_fp[:8]}…)"
        print(f"  [{source}] CHANGE DETECTED — {diff_summary}")
        if not dry_run:
            upsert_snapshot(cur, facility["id"], source, fp, payload)
            if not baseline_only:
                record_event(
                    cur,
                    facility_id=facility["id"],
                    scan_run_id=scan_run_id,
                    source=source,
                    event_type=event_type,
                    summary=diff_summary,
                    payload=payload,
                )
            conn.commit()
        return not baseline_only


def run_subprocess(cmd: list[str], label: str) -> bool:
    print(f"  → {label}: {' '.join(cmd)}")
    try:
        subprocess.run(cmd, cwd=REPO_ROOT, check=True)
        return True
    except subprocess.CalledProcessError as exc:
        print(f"  ⚠ {label} failed (exit {exc.returncode})", file=sys.stderr)
        return False


def refresh_or_state_csvs() -> bool:
    return run_subprocess(
        [sys.executable, "scrapers/or_ltc_csv_export.py"],
        "OR bulk CSV export",
    )


def reingest_or_exports() -> None:
    d = date.today().isoformat()
    mapping = [
        ("providers", f"scrapers/or_providers_ingest.py", f"providers-{d}.csv"),
        ("inspections", f"scrapers/or_inspections_ingest.py", f"inspections-{d}.csv"),
        ("violations", f"scrapers/or_violations_ingest.py", f"violations-{d}.csv"),
        (
            "regulatory_actions",
            "scrapers/or_regulatory_actions_ingest.py",
            f"regulatory_actions-{d}.csv",
        ),
    ]
    for _name, script, filename in mapping:
        path = OR_SCRAPE_DIR / filename
        if path.is_file():
            run_subprocess(
                [sys.executable, script, "--input", str(path)],
                f"re-ingest {filename}",
            )


def scan_or_facility(
    conn: psycopg.Connection,
    facility: dict,
    scan_run_id: str,
    *,
    dry_run: bool,
    baseline_only: bool,
    skip_news: bool,
    force_refresh: bool,
    full_signals: bool,
) -> int:
    changes = 0
    print(f"\n▸ OR scan: {facility['name']} ({facility['external_id']})")

    if not dry_run and (force_refresh or not latest_csv("inspections")):
        refresh_or_state_csvs()

    sources = [
        ("or_providers_csv", "providers", OR_PROVIDERS_ID_COL, "provider_record_change"),
        ("or_inspections_csv", "inspections", OR_PROVIDER_ID_COL, "new_inspection"),
        ("or_violations_csv", "violations", OR_PROVIDER_ID_COL, "new_violation"),
        (
            "or_regulatory_actions_csv",
            "regulatory_actions",
            OR_PROVIDER_ID_COL,
            "regulatory_action",
        ),
    ]
    any_csv_change = False
    for source, prefix, id_col, event_type in sources:
        if detect_csv_source(
            conn,
            facility=facility,
            scan_run_id=scan_run_id,
            source=source,
            csv_prefix=prefix,
            id_col=id_col,
            event_type=event_type,
            dry_run=dry_run,
            baseline_only=baseline_only,
        ):
            changes += 1
            any_csv_change = True

    if any_csv_change and not dry_run and not baseline_only:
        reingest_or_exports()
        run_subprocess(
            [
                sys.executable,
                "scrapers/or_inspection_narratives.py",
                "--facility-id",
                facility["id"],
            ],
            "OR inspection narratives",
        )
        run_subprocess(
            [sys.executable, "scrapers/recompute_publishable.py", "--state", "OR"],
            "recompute publishable OR",
        )
        run_subprocess(
            [
                sys.executable,
                "scrapers/summarize_inspections.py",
                "--facility-id",
                facility["id"],
            ],
            "summarize inspections",
        )

    # Portal narrative refresh on every run (cheap, 7 requests for this facility)
    if not dry_run and not baseline_only:
        run_subprocess(
            [
                sys.executable,
                "scrapers/or_inspection_narratives.py",
                "--facility-id",
                facility["id"],
            ],
            "OR portal narrative refresh",
        )

    # ODHS signal pages — state-wide; run weekly via --full-signals, not every daily pass
    if not dry_run and full_signals:
        run_subprocess(
            [sys.executable, "scrapers/or_signal_enhanced_oversight.py"],
            "OR enhanced oversight",
        )
        run_subprocess(
            [sys.executable, "scrapers/or_signal_mce.py"],
            "OR MCE endorsement",
        )

    # Lightweight per-facility signal fingerprint from DB (catches ingest-driven changes)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT license_status, mce_endorsed, enhanced_oversight, memory_care_disclosure_filed FROM facilities WHERE id = %s",
            (facility["id"],),
        )
        row = cur.fetchone()
        if row:
            sig_payload = {
                "license_status": row[0],
                "mce_endorsed": row[1],
                "enhanced_oversight": row[2],
                "memory_care_disclosure_filed": row[3],
            }
            sig_fp = fingerprint_rows([sig_payload])
            prev_fp, _ = get_snapshot(cur, facility["id"], "or_license_signals")
            if prev_fp is None:
                if not dry_run:
                    upsert_snapshot(cur, facility["id"], "or_license_signals", sig_fp, sig_payload)
                    conn.commit()
            elif prev_fp != sig_fp:
                print(f"  [or_license_signals] CHANGE — {sig_payload}")
                if not dry_run:
                    upsert_snapshot(cur, facility["id"], "or_license_signals", sig_fp, sig_payload)
                    if not baseline_only:
                        record_event(
                            cur,
                            facility_id=facility["id"],
                            scan_run_id=scan_run_id,
                            source="or_license_signals",
                            event_type="license_signal_change",
                            summary=f"License/signal change: {sig_payload}",
                            payload=sig_payload,
                        )
                    conn.commit()
                changes += 0 if baseline_only else 1
            else:
                if not dry_run:
                    upsert_snapshot(cur, facility["id"], "or_license_signals", sig_fp, sig_payload)
                    conn.commit()

    # Federal CMS — document N/A for ALF/RCF
    cms_payload = {
        "applicable": False,
        "reason": "OR ALF/RCF — CMS Nursing Home Compare applies to licensed nursing facilities only",
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
    cms_fp = fingerprint_rows([cms_payload])
    with conn.cursor() as cur:
        prev_fp, _ = get_snapshot(cur, facility["id"], "federal_cms_nh")
        if prev_fp != cms_fp and not dry_run:
            upsert_snapshot(cur, facility["id"], "federal_cms_nh", cms_fp, cms_payload)
            conn.commit()

    if not skip_news and os.environ.get("FIRECRAWL_API_KEY"):
        changes += scan_news(conn, facility, scan_run_id, dry_run=dry_run, baseline_only=baseline_only)
    elif not skip_news:
        print("  [news] skipped — FIRECRAWL_API_KEY not set")

    return changes


def scan_news(
    conn: psycopg.Connection,
    facility: dict,
    scan_run_id: str,
    *,
    dry_run: bool,
    baseline_only: bool,
) -> int:
    """Firecrawl news search — optional, budget-gated."""
    try:
        from _firecrawl import fc_search  # noqa: E402
    except EnvironmentError:
        print("  [news] skipped — Firecrawl not configured")
        return 0

    state = facility.get("state_code", "")
    city = facility.get("city", "")
    name = facility["name"]
    query = f'"{name}" "{city}" Oregon (lawsuit OR fined OR violation OR inspection OR "memory care")'
    print(f"  [news] searching: {query[:80]}…")
    try:
        results = fc_search(query, num_results=5)
    except Exception as exc:  # noqa: BLE001
        print(f"  [news] search failed: {exc}", file=sys.stderr)
        return 0

    hits = []
    for item in results or []:
        url = item.get("url") or item.get("link") or ""
        title = item.get("title") or ""
        if url:
            hits.append({"url": url, "title": title})

    fp = fingerprint_rows(hits)
    payload = {"query": query, "hit_count": len(hits), "hits": hits}
    with conn.cursor() as cur:
        prev_fp, _ = get_snapshot(cur, facility["id"], "news_search")
        if prev_fp is None:
            if not dry_run:
                upsert_snapshot(cur, facility["id"], "news_search", fp, payload)
                conn.commit()
            print(f"  [news] baseline seeded ({len(hits)} hits)")
            return 0
        if fp == prev_fp:
            print(f"  [news] unchanged ({len(hits)} hits)")
            return 0
        print(f"  [news] CHANGE — {len(hits)} hits")
        if not dry_run:
            upsert_snapshot(cur, facility["id"], "news_search", fp, payload)
            if not baseline_only:
                record_event(
                    cur,
                    facility_id=facility["id"],
                    scan_run_id=scan_run_id,
                    source="news_search",
                    event_type="news_hit",
                    summary=f"News search returned {len(hits)} results",
                    payload=payload,
                )
            conn.commit()
        return 0 if baseline_only else 1
    return 0


def load_watched_facilities(conn: psycopg.Connection, facility_id: str | None) -> list[dict]:
    where = "WHERE 1=1"
    params: list[Any] = []
    if facility_id:
        where += " AND f.id = %s"
        params.append(facility_id)
    else:
        where += (
            " AND EXISTS ("
            "SELECT 1 FROM facility_watchers w "
            "WHERE w.facility_id = f.id "
            "AND w.confirmed_at IS NOT NULL "
            "AND COALESCE(w.alerts_eligible, TRUE)"
            ")"
        )

    sql = f"""
        SELECT DISTINCT f.id::text, f.name, f.slug, f.city, f.state_code, f.external_id,
               f.city_slug
        FROM facilities f
        {where}
        ORDER BY f.name
    """
    with conn.cursor() as cur:
        cur.execute(sql, params)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


_STATE_SLUG = {
    "CA": "california",
    "OR": "oregon",
    "WA": "washington",
    "MN": "minnesota",
    "TX": "texas",
    "UT": "utah",
    "IL": "illinois",
    "PA": "pennsylvania",
}


def facility_profile_url(facility: dict) -> str:
    state = _STATE_SLUG.get(facility["state_code"].upper(), facility["state_code"].lower())
    city = facility.get("city_slug") or "unknown"
    return f"{SITE_URL}/{state}/{city}/{facility['slug']}"


def send_pending_alerts(conn: psycopg.Connection, dry_run: bool) -> int:
    if dry_run:
        return 0
    sent = 0
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT e.id::text, e.summary, e.payload, e.detected_at,
                   f.name, f.slug, f.city, f.state_code, f.id::text, f.city_slug
            FROM facility_watch_events e
            JOIN facilities f ON f.id = e.facility_id
            WHERE e.alert_status = 'pending'
            ORDER BY e.detected_at
            """
        )
        events = cur.fetchall()

    for event_id, summary, payload, detected_at, name, slug, city, state_code, fac_id, city_slug in events:
        fac = {
            "id": fac_id,
            "name": name,
            "slug": slug,
            "city": city,
            "state_code": state_code,
            "city_slug": city_slug,
        }
        url = facility_profile_url(fac)
        details = json.dumps(payload, indent=2)[:2000]
        ts = detected_at.isoformat() if hasattr(detected_at, "isoformat") else str(detected_at)

        recipients: list[str] = []
        admin = os.environ.get("ADMIN_ALERT_EMAIL", "").strip()
        if admin:
            recipients.append(admin)

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT email
                FROM facility_watchers
                WHERE facility_id = %s
                  AND confirmed_at IS NOT NULL
                  AND COALESCE(alerts_eligible, TRUE)
                """,
                (fac_id,),
            )
            recipients.extend(r[0] for r in cur.fetchall())

        unique_recipients = list(dict.fromkeys(recipients))
        if not unique_recipients:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE facility_watch_events SET alert_status = 'skipped', alert_error = 'no recipients' WHERE id = %s",
                    (event_id,),
                )
                conn.commit()
            continue

        err: str | None = None
        for email in unique_recipients:
            try:
                send_watch_change_alert(
                    to=email,
                    facility_name=name,
                    facility_url=url,
                    summary=summary,
                    details=details,
                    detected_at=ts,
                )
                sent += 1
            except Exception as exc:  # noqa: BLE001
                err = str(exc)
                print(f"  ⚠ alert to {email} failed: {exc}", file=sys.stderr)

        with conn.cursor() as cur:
            if err:
                cur.execute(
                    "UPDATE facility_watch_events SET alert_status = 'failed', alert_error = %s WHERE id = %s",
                    (err[:500], event_id),
                )
            else:
                cur.execute(
                    "UPDATE facility_watch_events SET alert_status = 'sent' WHERE id = %s",
                    (event_id,),
                )
            conn.commit()
    return sent


def ensure_tables(conn: psycopg.Connection) -> None:
    """Require migration 0049 applied manually — never auto-apply from the scanner."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'facility_watch_snapshots'"
        )
        if cur.fetchone() is None:
            raise RuntimeError(
                "facility_watch_snapshots missing — apply 0047_hub_content + 0048_submission_events "
                "from main first, then 0049_facility_watch_monitoring.sql"
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="Facility Watch daily scanner")
    parser.add_argument("--facility-id", help="Scan a single facility UUID")
    parser.add_argument("--dry-run", action="store_true", help="Detect only; no writes or alerts")
    parser.add_argument("--baseline-only", action="store_true", help="Seed snapshots without events/alerts")
    parser.add_argument("--skip-news", action="store_true", help="Skip Firecrawl news search")
    parser.add_argument("--force-refresh", action="store_true", help="Re-download OR CSVs even if present")
    parser.add_argument(
        "--full-signals",
        action="store_true",
        help="Run state-wide ODHS signal scrapers (MCE, Enhanced Oversight). "
        "Default off — use weekly workflow to avoid scanning 4k+ facilities daily.",
    )
    args = parser.parse_args()

    load_env()
    conn = get_conn()
    ensure_tables(conn)

    facilities = load_watched_facilities(conn, args.facility_id)
    if not facilities:
        print("No watched facilities found.")
        return 0

    print(f"Scanning {len(facilities)} watched facility(ies)…")

    scan_run_id: str | None = None
    total_changes = 0

    if not args.dry_run:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO facility_watch_scan_runs (status) VALUES ('running') RETURNING id::text"
            )
            scan_run_id = cur.fetchone()[0]
            conn.commit()

    try:
        for facility in facilities:
            state = (facility.get("state_code") or "").upper()
            if state == "OR":
                total_changes += scan_or_facility(
                    conn,
                    facility,
                    scan_run_id or "",
                    dry_run=args.dry_run,
                    baseline_only=args.baseline_only,
                    skip_news=args.skip_news,
                    force_refresh=args.force_refresh,
                    full_signals=args.full_signals,
                )
            else:
                print(f"\n▸ {state} scan not yet implemented for {facility['name']} — skipping")

        if not args.dry_run and not args.baseline_only:
            send_pending_alerts(conn, dry_run=False)

        if scan_run_id and not args.dry_run:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE facility_watch_scan_runs
                    SET status = 'completed', completed_at = now(),
                        facilities_scanned = %s, changes_detected = %s
                    WHERE id = %s
                    """,
                    (len(facilities), total_changes, scan_run_id),
                )
                conn.commit()

        print(f"\nDone — {total_changes} change(s) detected across {len(facilities)} facility(ies).")
        return 0

    except Exception as exc:
        if scan_run_id and not args.dry_run:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE facility_watch_scan_runs
                    SET status = 'failed', completed_at = now(), error = %s
                    WHERE id = %s
                    """,
                    (str(exc)[:500], scan_run_id),
                )
                conn.commit()
        raise


if __name__ == "__main__":
    raise SystemExit(main())
