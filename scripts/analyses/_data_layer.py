"""Canonical data-access functions returning pandas DataFrames.

All functions accept optional state/filter params and return empty DataFrames
(never None) when no data matches.

NOTE on CA data shape:
  - deficiencies.scope is NULL for all CA records; severity is int 1–4
  - deficiencies.facility_id does NOT exist; join via inspections
  - regulation_id maps to deficiencies.code (CA state reg codes, e.g. 87303(a))
  - pilot_pricing_triangulated has no actual dollar values for CA (prices are NULL)
"""
from __future__ import annotations

import pandas as pd

from ._lib import get_conn


def _query(sql: str, params: list | None = None) -> pd.DataFrame:
    """Execute SQL and return a DataFrame without pandas SQLAlchemy warnings."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
            rows = cur.fetchall()
            cols = [desc[0] for desc in cur.description]
    if not rows:
        return pd.DataFrame(columns=cols)
    return pd.DataFrame(rows, columns=cols)


def load_facilities(state_code: str | None = None, publishable_only: bool = True) -> pd.DataFrame:
    """Load facilities with core fields.

    Returns columns: id, name, city, city_slug, slug, state_code, beds,
    operator_name, management_company, serves_memory_care, zip, last_inspection_date.
    """
    filters = []
    params: list = []
    if state_code:
        filters.append("f.state_code = %s")
        params.append(state_code)
    if publishable_only:
        filters.append("f.publishable = TRUE")

    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    sql = f"""
        SELECT
            f.id::text,
            f.name,
            f.city,
            f.city_slug,
            f.slug,
            f.state_code,
            f.beds,
            f.operator_name,
            f.management_company,
            f.serves_memory_care,
            f.zip,
            f.last_inspection_date
        FROM facilities f
        {where}
    """
    return _query(sql, params)


def load_inspections(state_code: str | None = None, min_year: int | None = None) -> pd.DataFrame:
    """Load inspections joined to facility state_code.

    Returns columns: id, facility_id, inspection_date, inspection_type,
    is_complaint, total_deficiency_count, narrative_summary, incident_date.
    """
    filters = []
    params: list = []
    if state_code:
        filters.append("f.state_code = %s")
        params.append(state_code)
    if min_year:
        filters.append("EXTRACT(YEAR FROM i.inspection_date) >= %s")
        params.append(min_year)

    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    sql = f"""
        SELECT
            i.id::text,
            i.facility_id::text,
            i.inspection_date,
            i.inspection_type,
            i.is_complaint,
            i.total_deficiency_count,
            i.narrative_summary,
            i.incident_date
        FROM inspections i
        JOIN facilities f ON f.id = i.facility_id
        {where}
    """
    return _query(sql, params)


def load_deficiencies(state_code: str | None = None, min_severity: int | None = None) -> pd.DataFrame:
    """Load deficiencies joined to inspections+facilities.

    Returns columns: id, inspection_id, facility_id, deficiency_date, severity,
    regulation_id (=code), description (first 300 chars), scope,
    scope_severity_code, immediate_jeopardy, category.
    """
    filters = []
    params: list = []
    if state_code:
        filters.append("f.state_code = %s")
        params.append(state_code)
    if min_severity is not None:
        filters.append("d.severity >= %s")
        params.append(min_severity)

    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    sql = f"""
        SELECT
            d.id::text,
            d.inspection_id::text,
            i.facility_id::text,
            COALESCE(d.cited_date, i.inspection_date)   AS deficiency_date,
            d.severity,
            d.code                                       AS regulation_id,
            LEFT(d.description, 300)                    AS description,
            d.scope,
            d.scope_severity_code,
            d.immediate_jeopardy,
            d.category,
            d.is_repeat
        FROM deficiencies d
        JOIN inspections i ON i.id = d.inspection_id
        JOIN facilities f ON f.id = i.facility_id
        {where}
    """
    return _query(sql, params)


def load_pricing() -> pd.DataFrame:
    """Load pilot triangulated pricing.

    Returns columns: facility_id, triangulated_starting_price_usd,
    triangulated_memory_care_price_usd, confidence, source_count.

    NOTE: As of May 2026 only 5 CA facilities have been priced and actual
    dollar amounts are NULL. Callers should handle this gracefully.
    """
    sql = """
        SELECT
            pt.facility_id::text,
            pt.triangulated_starting_price_usd,
            pt.triangulated_memory_care_price_usd,
            pt.confidence,
            pt.source_count
        FROM pilot_pricing_triangulated pt
    """
    return _query(sql)


def load_chains(state_code: str = "CA") -> pd.DataFrame:
    """Load chain operators (≥3 facilities) with quality metrics.

    Returns columns: operator_name, facility_count, total_beds,
    total_inspections, total_deficiencies, avg_deficiency_rate.
    """
    sql = """
        SELECT
            f.operator_name,
            COUNT(DISTINCT f.id)            AS facility_count,
            COALESCE(SUM(f.beds), 0)        AS total_beds,
            COUNT(DISTINCT i.id)            AS total_inspections,
            COUNT(DISTINCT d.id)            AS total_deficiencies
        FROM facilities f
        LEFT JOIN inspections i ON i.facility_id = f.id
        LEFT JOIN deficiencies d ON d.inspection_id = i.id
        WHERE f.state_code = %s
          AND f.publishable = TRUE
          AND f.operator_name IS NOT NULL
        GROUP BY f.operator_name
        HAVING COUNT(DISTINCT f.id) >= 3
        ORDER BY COUNT(DISTINCT f.id) DESC
    """
    df = _query(sql, [state_code])
    if df.empty:
        return df
    df["avg_deficiency_rate"] = df.apply(
        lambda r: r["total_deficiencies"] / r["total_inspections"] if r["total_inspections"] > 0 else 0.0,
        axis=1,
    )
    return df
