"""Analysis 3: repeat_offender_report

Which CA facilities have been cited for the exact same regulatory violation 3+ times?

Approach:
  - Group by (facility_id, regulation_id) where regulation_id = deficiencies.code
  - Filter to groups with count >= 3
  - Sort by count DESC, then max_severity DESC
  - Chart: top 20 facility+regulation pairs
  - Compute: % of CA publishable facilities on the repeat-offender list
"""
from __future__ import annotations

import re
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import plotly.express as px

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scripts.analyses._lib import (
    TEAL, RUST, NEUTRAL, YELLOW, GREEN,
    apply_chart_style, save_chart, save_plotly_chart,
    write_findings, format_number,
)
from scripts.analyses._data_layer import load_facilities, load_deficiencies

OUTPUT_DIR = REPO_ROOT / "docs" / "analyses" / "repeat_offender_report"

# Plain-English translations for the most commonly repeated CA reg codes
REG_CODE_PLAIN: dict[str, str] = {
    "87303(a)": "General Facility Maintenance",
    "87309(a)": "Personnel Records — General",
    "87465(h)(2)": "Medications — Self-Administration",
    "87468.2(a)(4)": "Residents' Rights — Personal Privacy",
    "87411(a)": "Staff — Direct Care Hours / Staffing Ratio",
    "87411(f)": "Staff Training Records",
    "87465(a)(4)": "Medications — Storage",
    "87468.1(a)(2)": "Residents' Rights — Dignity & Respect",
    "87465(c)(2)": "Medications — Controlled Substances",
    "87608(a)(3)": "Dementia Care — Structured Activities",
    "87411(c)(1)": "Staff — Personal Care Competency",
    "87705(c)(5)": "Dementia Care — Supervision",
    "87506(a)": "Admission Agreement Requirements",
    "87211(a)(1)": "Physical Plant — Clean & Sanitary",
    "87464(f)(1)": "Residents' Rights — Grievance Procedure",
    "87705(f)(1)": "Dementia Care — Environment Safety",
    "87705(f)(2)": "Dementia Care — Hazardous Items",
    "87463(a)": "Resident Appraisal — Initial Assessment",
    "87412(a)": "Personnel — Criminal Background Checks",
    "87303(e)(2)": "Maintenance — Broken/Unsafe Equipment",
    "87555(b)(27)": "Resident Records — Care Plan",
    "87555(b)(8)": "Resident Records — Physician Orders",
    "87303(b)(1)": "Maintenance — Pest Control",
    "87705(b)(2)": "Dementia Care — Admission Criteria",
    "87465(h)(4)": "Medications — Medication Administration Record",
}


def severity_bar_color(max_sev: int | None) -> str:
    """Color by max severity (red=4 IJ, orange=3, yellow=2, green=1)."""
    if max_sev is None:
        return NEUTRAL
    if max_sev >= 4:
        return "#8B0000"
    if max_sev == 3:
        return RUST
    if max_sev == 2:
        return YELLOW
    return GREEN


def run() -> dict:
    print("  Loading data...")
    facilities = load_facilities("CA")
    deficiencies = load_deficiencies("CA")

    # Filter to deficiencies with a known regulation_id
    d = deficiencies[deficiencies["regulation_id"].notna()].copy()

    # Group by facility+regulation
    groups = (
        d.groupby(["facility_id", "regulation_id"])
        .agg(
            count=("id", "count"),
            max_severity=("severity", "max"),
            sample_desc=("description", "first"),
        )
        .reset_index()
    )

    # Filter to 3+ repeats
    repeat = groups[groups["count"] >= 3].copy()

    # Join facility info
    fac_info = facilities[["id", "name", "city", "operator_name", "beds"]].rename(
        columns={"id": "facility_id"}
    )
    repeat = repeat.merge(fac_info, on="facility_id", how="left")

    # Sort: count DESC, max_severity DESC
    repeat = repeat.sort_values(["count", "max_severity"], ascending=[False, False]).reset_index(drop=True)

    # Add plain-English regulation label
    repeat["reg_plain"] = repeat["regulation_id"].map(
        lambda c: REG_CODE_PLAIN.get(str(c), str(c))
    )

    # --- Key metrics ---
    total_publishable_fac = len(facilities)
    fac_with_repeat = repeat["facility_id"].nunique()
    pct_repeat = fac_with_repeat / total_publishable_fac * 100

    # Most repeated regulation overall
    top_reg = (
        repeat.groupby("regulation_id")["count"]
        .sum()
        .sort_values(ascending=False)
        .head(1)
    )
    top_reg_code = top_reg.index[0] if not top_reg.empty else "N/A"
    top_reg_plain = REG_CODE_PLAIN.get(str(top_reg_code), str(top_reg_code))
    top_reg_total = int(top_reg.iloc[0]) if not top_reg.empty else 0

    # Multi-category offender: facility with most distinct repeat violations
    multi_offender = (
        repeat.groupby("facility_id")["regulation_id"]
        .count()
        .sort_values(ascending=False)
        .head(1)
    )
    if not multi_offender.empty:
        multi_fac_id = multi_offender.index[0]
        multi_fac_name = facilities[facilities["id"] == multi_fac_id]["name"].values
        multi_fac_name = multi_fac_name[0] if len(multi_fac_name) else "Unknown"
        multi_count = int(multi_offender.iloc[0])
    else:
        multi_fac_name = "N/A"
        multi_count = 0

    # Top 5 worst facilities
    top5_fac = (
        repeat.groupby(["facility_id", "name", "city"])
        .agg(total_repeat_citations=("count", "sum"), distinct_violations=("regulation_id", "count"))
        .sort_values("total_repeat_citations", ascending=False)
        .head(5)
        .reset_index()
    )

    # --- Chart: top 20 facility+regulation pairs ---
    top20 = repeat.head(20).copy()
    top20["label"] = top20.apply(
        lambda r: f"{str(r['name'])[:22]} — {str(r['reg_plain'])[:28]}",
        axis=1,
    )
    top20["bar_color"] = top20["max_severity"].apply(severity_bar_color)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(13, 9))
    apply_chart_style(ax)

    bars = ax.barh(
        top20["label"],
        top20["count"],
        color=top20["bar_color"],
        edgecolor="white",
        linewidth=0.5,
        height=0.7,
    )
    for bar, row in zip(bars, top20.itertuples()):
        ax.text(
            bar.get_width() + 0.1,
            bar.get_y() + bar.get_height() / 2,
            f"{row.count}× (sev {row.max_severity})",
            va="center",
            ha="left",
            fontsize=7.5,
            color="#333333",
        )

    ax.set_xlabel("Number of Times Cited (same regulation, same facility)", fontsize=10)
    ax.set_title(
        "CA Memory Care: Top 20 Repeat Violations\n(Same regulation cited ≥3× at the same facility)",
        fontsize=12, fontweight="bold", pad=12,
    )
    ax.invert_yaxis()
    ax.tick_params(axis="y", labelsize=8)

    patches = [
        mpatches.Patch(color="#8B0000", label="Severity 4 — Immediate Jeopardy"),
        mpatches.Patch(color=RUST, label="Severity 3 — Serious"),
        mpatches.Patch(color=YELLOW, label="Severity 2 — Moderate"),
        mpatches.Patch(color=GREEN, label="Severity 1 — Minor"),
    ]
    ax.legend(handles=patches, fontsize=8, loc="lower right")

    save_chart(fig, OUTPUT_DIR, "chart")

    # Plotly interactive
    top20_plot = top20.sort_values("count")
    pfig = px.bar(
        top20_plot,
        x="count",
        y="label",
        orientation="h",
        color="max_severity",
        color_continuous_scale=[[0, GREEN], [0.33, YELLOW], [0.66, RUST], [1.0, "#8B0000"]],
        hover_data={"name": True, "city": True, "regulation_id": True, "reg_plain": True},
        title="CA Memory Care: Top 20 Repeat Violations (Interactive)",
        labels={"count": "Times Cited", "label": "Facility — Violation"},
    )
    pfig.update_layout(template="plotly_white", yaxis_title="", coloraxis_showscale=False)
    save_plotly_chart(pfig, OUTPUT_DIR, "chart")

    # --- Data sample CSV: full repeat-offender list ---
    export_cols = ["name", "city", "operator_name", "regulation_id", "reg_plain", "count", "max_severity", "beds"]
    repeat[export_cols].to_csv(OUTPUT_DIR / "data_sample.csv", index=False)

    # --- Findings ---
    top5_str = "; ".join(
        f"{r.name} ({r.city}): {r.total_repeat_citations} repeat citations, {r.distinct_violations} distinct violations"
        for r in top5_fac.itertuples()
    )

    one_in_n = round(total_publishable_fac / max(fac_with_repeat, 1))

    findings = {
        "CA publishable facilities analyzed": str(total_publishable_fac),
        "Facilities with ≥1 repeat violation (3+ same code)": f"{fac_with_repeat} ({pct_repeat:.0f}% of all CA facilities)",
        "Headline 'one in N'": f"1 in {one_in_n} CA memory care facilities",
        "Most-repeated regulation statewide": f"{top_reg_code} — '{top_reg_plain}' ({top_reg_total} total repeat citations)",
        "Multi-category offender": f"{multi_fac_name} ({multi_count} distinct repeat violations)",
        "Top 5 repeat offenders": top5_str,
        "Total repeat-violation pairs (fac+reg, >=3x)": str(len(repeat)),
    }

    summary = (
        f"1 in {one_in_n} CA memory care facilities ({pct_repeat:.0f}%, N={fac_with_repeat}) "
        f"has been cited for the exact same regulatory violation three or more times. "
        f"The most-repeated rule statewide is {top_reg_code} ('{top_reg_plain}'), "
        f"indicating a systemic failure across operators to address basic {top_reg_plain.lower()} issues. "
        f"The worst multi-category offender is {multi_fac_name} with {multi_count} distinct violations "
        f"repeated three or more times. "
        f"Headline: '1 in {one_in_n} California memory care facilities has been cited for the same violation three or more times.'"
    )

    write_findings(findings, summary, OUTPUT_DIR)

    top_finding = f"1 in {one_in_n} CA facilities ({pct_repeat:.0f}%) has a pattern-of-failure violation; top repeated rule: '{top_reg_plain}'"

    return {
        "top_finding": top_finding,
        "run_date": datetime.now().strftime("%Y-%m-%d"),
        "pct_repeat": float(pct_repeat),
        "fac_with_repeat": int(fac_with_repeat),
        "one_in_n": one_in_n,
        "top_reg_code": top_reg_code,
        "top_reg_plain": top_reg_plain,
        "multi_fac_name": multi_fac_name,
        "multi_count": multi_count,
        "total_fac": total_publishable_fac,
    }


if __name__ == "__main__":
    result = run()
    print("\nResult:", result)
