"""Analysis 2: chain_operator_scorecard_ca

Head-to-head quality scorecard for CA's top chain operators.

DATA NOTE: CA has very few large chains. The >=3 threshold yields only 5
named operators (Oakmont appears under multiple entity names). We normalize
operator names by extracting the management company mention and group by
the recognizable brand name. We also include operators with >=2 facilities
to give the chart more depth, noting the threshold in the output.

Metrics per chain:
  1. deficiency_rate = total deficiencies / total inspections
  2. severity_index = weighted deficiency score / total beds
  3. repeat_citation_rate = % of facilities with same regulation_id cited >=2x
  4. serious_deficiency_rate = % of deficiencies with severity >= 3
  5. inspection_count, facility_count
"""
from __future__ import annotations

import re
import sys
from datetime import datetime, date
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
    write_findings, format_number, severity_color,
)
from scripts.analyses._data_layer import load_facilities, load_deficiencies, load_inspections

OUTPUT_DIR = REPO_ROOT / "docs" / "analyses" / "chain_operator_scorecard_ca"

# Known CA chain brand → canonical name mapping
# Handles the complex LLC joint-venture naming in the raw data
BRAND_KEYWORDS: list[tuple[str, str]] = [
    ("oakmont", "Oakmont Senior Living"),
    ("aegis", "Aegis Senior Communities"),
    ("brookdale", "Brookdale Senior Living"),
    ("sunrise", "Sunrise Senior Living"),
    ("atria", "Atria Senior Living"),
    ("belmont village", "Belmont Village"),
    ("ivy park", "Ivy Park (Oakmont)"),
    ("activcare", "ActivCare Living"),
    ("front porch", "Front Porch Communities"),
    ("alara", "Alara Health Services"),
    ("eskaton", "Eskaton"),
    ("pacifica", "Pacifica Senior Living"),
    ("merrill gardens", "Merrill Gardens"),
    ("holiday", "Holiday Retirement"),
    ("five star", "Five Star Senior Living"),
    ("lifehouse", "LifeHouse"),
    ("prestige", "Prestige Senior Living"),
    ("sentient", "Sentient Healthcare"),
    ("wellpath", "WellPath"),
    ("roundhill", "Roundhill Care Homes"),
]


def normalize_operator(op: str | None, mgmt: str | None = None) -> str | None:
    """Map messy LLC names to a recognizable brand."""
    combined = " ".join(filter(None, [op, mgmt])).lower()
    for keyword, brand in BRAND_KEYWORDS:
        if keyword in combined:
            return brand
    return op  # keep original if no match


def severity_multiplier(sev: int | None) -> int:
    if sev is None:
        return 0
    return {1: 1, 2: 2, 3: 3, 4: 5}.get(int(sev), 1)


def run() -> dict:
    print("  Loading data...")
    facilities = load_facilities("CA")
    deficiencies = load_deficiencies("CA")
    inspections = load_inspections("CA")

    # Normalize operator names
    facilities["brand"] = facilities.apply(
        lambda r: normalize_operator(r["operator_name"], r.get("management_company")),
        axis=1,
    )

    # Count facilities per brand
    brand_counts = facilities.groupby("brand")["id"].count()

    # Use >=2 threshold (only 5 brands have >=3; >=2 gives a better scorecard)
    eligible_brands = brand_counts[brand_counts >= 2].index.tolist()
    fac_eligible = facilities[facilities["brand"].isin(eligible_brands)].copy()

    # deficiencies already has facility_id (joined via inspections in _data_layer)
    d_with_brand = deficiencies.merge(
        fac_eligible[["id", "brand", "beds"]],
        left_on="facility_id",
        right_on="id",
        how="inner",
    )

    # Merge inspections to facility brands
    i_with_brand = inspections.merge(
        fac_eligible[["id", "brand"]],
        left_on="facility_id",
        right_on="id",
        how="inner",
    )

    # Build scorecard per brand
    rows = []
    for brand in eligible_brands:
        fac_sub = fac_eligible[fac_eligible["brand"] == brand]
        d_sub = d_with_brand[d_with_brand["brand"] == brand]
        i_sub = i_with_brand[i_with_brand["brand"] == brand]

        facility_count = len(fac_sub)
        total_beds = fac_sub["beds"].fillna(30).sum()
        total_inspections = len(i_sub)
        total_deficiencies = len(d_sub)

        # deficiency_rate
        deficiency_rate = total_deficiencies / total_inspections if total_inspections > 0 else 0.0

        # severity_index
        d_sub = d_sub.copy()
        d_sub["multiplier"] = d_sub["severity"].apply(severity_multiplier)
        weighted_sum = d_sub["multiplier"].sum()
        severity_index = weighted_sum / max(total_beds, 1)

        # serious_deficiency_rate (severity >= 3)
        serious_count = (d_sub["severity"] >= 3).sum()
        serious_rate = serious_count / total_deficiencies if total_deficiencies > 0 else 0.0

        # repeat_citation_rate — % of facilities where any regulation_id cited >=2x
        repeat_fac_count = 0
        for fid in fac_sub["id"]:
            fac_defs = d_sub[d_sub["facility_id"] == fid]
            if fac_defs.empty:
                continue
            reg_counts = fac_defs.groupby("regulation_id").size()
            if (reg_counts >= 2).any():
                repeat_fac_count += 1
        repeat_citation_rate = repeat_fac_count / facility_count if facility_count > 0 else 0.0

        rows.append(
            {
                "brand": brand,
                "facility_count": facility_count,
                "total_beds": int(total_beds),
                "total_inspections": total_inspections,
                "total_deficiencies": total_deficiencies,
                "deficiency_rate": deficiency_rate,
                "severity_index": severity_index,
                "serious_deficiency_rate": serious_rate,
                "repeat_citation_rate": repeat_citation_rate,
            }
        )

    df = pd.DataFrame(rows).sort_values("severity_index", ascending=False).reset_index(drop=True)

    # --- Chart ---
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(11, max(6, len(df) * 0.55)))
    apply_chart_style(ax)

    colors = [severity_color(v) for v in df["severity_index"]]
    bars = ax.barh(
        df["brand"],
        df["severity_index"],
        color=colors,
        edgecolor="white",
        linewidth=0.5,
        height=0.65,
    )

    # Label each bar with facility count and severity value
    for bar, row in zip(bars, df.itertuples()):
        ax.text(
            bar.get_width() + 0.02,
            bar.get_y() + bar.get_height() / 2,
            f"{row.severity_index:.2f}  (n={row.facility_count})",
            va="center",
            ha="left",
            fontsize=8,
            color="#333333",
        )

    ax.set_xlabel("Severity Index (weighted deficiencies / beds)", fontsize=10)
    ax.set_title(
        "CA Memory Care Chain Operators — Ranked by Severity Index\n"
        "(Operators with ≥2 CA facilities; 2019–2026 data)",
        fontsize=12, fontweight="bold", pad=12,
    )
    ax.invert_yaxis()

    # Legend
    patches = [
        mpatches.Patch(color=GREEN, label="Clean (0)"),
        mpatches.Patch(color=YELLOW, label="Low (1–5)"),
        mpatches.Patch(color=RUST, label="High (6+)"),
    ]
    ax.legend(handles=patches, fontsize=8, loc="lower right")

    save_chart(fig, OUTPUT_DIR, "chart")

    # Plotly
    df_plot = df.sort_values("severity_index")
    pfig = px.bar(
        df_plot,
        x="severity_index",
        y="brand",
        orientation="h",
        color="severity_index",
        color_continuous_scale=["#2ECC71", "#E8A838", "#C0392B"],
        hover_data={
            "facility_count": True,
            "deficiency_rate": ":.2f",
            "serious_deficiency_rate": ":.1%",
            "repeat_citation_rate": ":.1%",
        },
        title="CA Memory Care Chain Scorecard (Interactive)",
        labels={
            "severity_index": "Severity Index",
            "brand": "Operator",
        },
    )
    pfig.update_layout(template="plotly_white", yaxis_title="")
    save_plotly_chart(pfig, OUTPUT_DIR, "chart")

    # --- Data sample CSV ---
    df.to_csv(OUTPUT_DIR / "data_sample.csv", index=False)

    # --- Findings ---
    worst_chain_any = df.iloc[0]  # worst across all chain sizes

    # For editorial purposes also identify worst/best among large chains (>=5 facilities)
    large = df[df["facility_count"] >= 5]
    if not large.empty:
        worst_large = large.nlargest(1, "severity_index").iloc[0]
        best_large = large.nsmallest(1, "severity_index").iloc[0]
    else:
        worst_large = df.iloc[0]
        best_large = df.iloc[-1]

    # Best/worst for spread uses large chains (more newsworthy)
    spread_ratio_large = worst_large["severity_index"] / max(best_large["severity_index"], 0.001)

    high_repeat = df[df["repeat_citation_rate"] > 0.3]
    high_repeat_names = ", ".join(high_repeat["brand"].tolist()) if not high_repeat.empty else "None"

    findings = {
        "Threshold used": "≥2 CA facilities (only 5 operators have ≥3 in CA dataset)",
        "Number of chains analyzed": str(len(df)),
        "Worst severity_index chain (any size)": f"{worst_chain_any['brand']} (index={worst_chain_any['severity_index']:.2f}, n={worst_chain_any['facility_count']} — micro-operator)",
        "Worst large chain (≥5 facilities)": f"{worst_large['brand']} (index={worst_large['severity_index']:.2f}, n={worst_large['facility_count']})",
        "Best large chain (≥5 facilities)": f"{best_large['brand']} (index={best_large['severity_index']:.2f}, n={best_large['facility_count']})",
        "Large-chain severity spread (worst/best)": f"{spread_ratio_large:.1f}x",
        "Chains with repeat_citation_rate > 30%": high_repeat_names,
        "Chains with serious_deficiency_rate > 10%": ", ".join(
            df[df["serious_deficiency_rate"] > 0.1]["brand"].tolist()
        ) or "None",
    }

    summary = (
        f"Among {len(df)} CA memory care chains (≥2 facilities), the editorial story is in the large operators: "
        f"{worst_large['brand']} ({worst_large['facility_count']} locations) ranks worst among chains with ≥5 CA facilities "
        f"with a severity index of {worst_large['severity_index']:.2f}, "
        f"versus {best_large['brand']} ({best_large['facility_count']} locations) at {best_large['severity_index']:.2f} — "
        f"a {spread_ratio_large:.0f}x spread. "
        f"Chains with systematic repeat-citation patterns include: {high_repeat_names}. "
        f"Headline: 'These California memory care chains have the worst inspection records — ranked.'"
    )

    write_findings(findings, summary, OUTPUT_DIR)

    top_finding = f"{worst_large['brand']} worst large chain (index={worst_large['severity_index']:.2f}); {spread_ratio_large:.0f}x spread vs {best_large['brand']}"

    return {
        "top_finding": top_finding,
        "run_date": datetime.now().strftime("%Y-%m-%d"),
        "worst_chain": worst_chain_any["brand"],
        "worst_severity": float(worst_chain_any["severity_index"]),
        "worst_large_chain": worst_large["brand"],
        "worst_large_severity": float(worst_large["severity_index"]),
        "best_chain": best_large["brand"],
        "best_severity": float(best_large["severity_index"]),
        "spread_ratio": float(spread_ratio_large),
        "n_chains": len(df),
    }


if __name__ == "__main__":
    result = run()
    print("\nResult:", result)
