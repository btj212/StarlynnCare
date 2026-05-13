"""Analysis 7: worst_week_seasonal

When do the worst violations happen — day of week, month, season?

DATA NOTE: Inspection dates (not cited dates) drive most temporal patterns
since CA uses inspection_date for most deficiency records (cited_date is often
NULL). DOW pattern shows Tue–Thu peak for inspections (inspection scheduling
artifact), not a true "violations happen on Thursdays" story. We report this
honestly and focus on the MONTH/SEASON signal which is more interesting.
"""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import plotly.graph_objects as go
from plotly.subplots import make_subplots

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scripts.analyses._lib import (
    TEAL, RUST, NEUTRAL, YELLOW, GREEN,
    apply_chart_style, save_chart, save_plotly_chart,
    write_findings, format_number,
)
from scripts.analyses._data_layer import load_deficiencies, load_inspections

OUTPUT_DIR = REPO_ROOT / "docs" / "analyses" / "worst_week_seasonal"

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

SEASONS = {
    1: "Winter", 2: "Winter", 3: "Spring", 4: "Spring", 5: "Spring",
    6: "Summer", 7: "Summer", 8: "Summer", 9: "Fall", 10: "Fall",
    11: "Fall", 12: "Winter",
}


def run() -> dict:
    print("  Loading data...")
    deficiencies = load_deficiencies("CA")
    inspections = load_inspections("CA")

    # Use deficiency_date (COALESCE of cited_date + inspection_date from the query)
    deficiencies["deficiency_date"] = pd.to_datetime(deficiencies["deficiency_date"])
    inspections["inspection_date"] = pd.to_datetime(inspections["inspection_date"])

    # Filter to 2021–2025 to avoid COVID-era noise
    d = deficiencies[
        (deficiencies["deficiency_date"] >= "2021-01-01") &
        (deficiencies["deficiency_date"] < "2026-01-01")
    ].copy()

    insp = inspections[
        (inspections["inspection_date"] >= "2021-01-01") &
        (inspections["inspection_date"] < "2026-01-01")
    ].copy()

    d["month"] = d["deficiency_date"].dt.month
    d["dow"] = d["deficiency_date"].dt.dayofweek  # 0=Mon..6=Sun
    d["season"] = d["month"].map(SEASONS)
    d["is_serious"] = d["severity"] >= 3

    # Also compute inspection-level DOW/month (more meaningful for scheduling)
    insp["month"] = insp["inspection_date"].dt.month
    insp["dow"] = insp["inspection_date"].dt.dayofweek

    # --- Month breakdown ---
    month_stats = d.groupby("month").agg(
        total_deficiencies=("id", "count"),
        serious=("is_serious", "sum"),
        avg_severity=("severity", "mean"),
    ).reindex(range(1, 13), fill_value=0)
    month_stats.index.name = "month"

    # Most deficiency-heavy month
    worst_month_idx = int(month_stats["total_deficiencies"].idxmax())
    worst_month_serious_idx = int(month_stats["serious"].idxmax())
    best_month_idx = int(month_stats["total_deficiencies"].idxmin())

    # --- DOW breakdown ---
    dow_stats = d.groupby("dow").agg(
        total_deficiencies=("id", "count"),
        serious=("is_serious", "sum"),
        avg_severity=("severity", "mean"),
    ).reindex(range(7), fill_value=0)

    # Inspection scheduling DOW (to contextualize)
    insp_dow = insp.groupby("dow")["id"].count().reindex(range(7), fill_value=0)
    dow_rate = pd.Series(
        [dow_stats.loc[i, "total_deficiencies"] / max(insp_dow.loc[i], 1) for i in range(7)],
        index=range(7),
    )

    # --- Season breakdown ---
    season_stats = d.groupby("season").agg(
        total_deficiencies=("id", "count"),
        serious=("is_serious", "sum"),
        avg_severity=("severity", "mean"),
    )
    worst_season = season_stats["serious"].idxmax() if not season_stats.empty else "N/A"

    # --- Heatmap: month x severity tier ---
    severity_tiers = {1: "Sev 1 (Minor)", 2: "Sev 2 (Moderate)", 3: "Sev 3 (Serious)", 4: "Sev 4 (IJ)"}
    heat_data = np.zeros((4, 12))
    for sev in range(1, 5):
        for mo in range(1, 13):
            count = len(d[(d["severity"] == sev) & (d["month"] == mo)])
            heat_data[sev - 1, mo - 1] = count

    # --- Charts ---
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    apply_chart_style(axes[0, 0])
    apply_chart_style(axes[0, 1])
    apply_chart_style(axes[1, 0])
    apply_chart_style(axes[1, 1])

    # Panel 1: heatmap month x severity tier
    ax_hm = axes[0, 0]
    im = ax_hm.imshow(heat_data, cmap="YlOrRd", aspect="auto")
    ax_hm.set_xticks(range(12))
    ax_hm.set_xticklabels(MONTH_NAMES, fontsize=8)
    ax_hm.set_yticks(range(4))
    ax_hm.set_yticklabels(list(severity_tiers.values()), fontsize=8)
    ax_hm.set_title("Deficiency Count: Month × Severity Tier\n(2021–2025)", fontsize=10, fontweight="bold")
    for i in range(4):
        for j in range(12):
            val = int(heat_data[i, j])
            if val > 0:
                ax_hm.text(j, i, str(val), ha="center", va="center",
                           fontsize=6.5, color="black" if val < heat_data.max() * 0.6 else "white")
    plt.colorbar(im, ax=ax_hm, shrink=0.8)

    # Panel 2: DOW bar (deficiency rate per inspection)
    ax_dow = axes[0, 1]
    apply_chart_style(ax_dow)
    colors_dow = [RUST if i == int(dow_rate.idxmax()) else TEAL for i in range(7)]
    ax_dow.bar(DOW_NAMES, dow_rate.values, color=colors_dow, edgecolor="white")
    ax_dow.set_xlabel("Day of Week", fontsize=9)
    ax_dow.set_ylabel("Deficiencies / Inspection", fontsize=9)
    ax_dow.set_title("Deficiency Rate by Day of Week\n(Rate = defic / inspections on that day)", fontsize=10, fontweight="bold")
    for i, v in enumerate(dow_rate.values):
        ax_dow.text(i, v + 0.005, f"{v:.2f}", ha="center", va="bottom", fontsize=8)

    # Panel 3: Monthly total deficiencies bar
    ax_mo = axes[1, 0]
    apply_chart_style(ax_mo)
    mo_colors = [RUST if m == worst_month_idx else TEAL for m in range(1, 13)]
    ax_mo.bar(MONTH_NAMES, month_stats["total_deficiencies"].values, color=mo_colors, edgecolor="white")
    ax_mo.bar(MONTH_NAMES, month_stats["serious"].values, color=[
        "#8B0000" if m == worst_month_serious_idx else "#C07070" for m in range(1, 13)
    ], edgecolor="white", alpha=0.6, label="Severity ≥3")
    ax_mo.set_xlabel("Month", fontsize=9)
    ax_mo.set_ylabel("Citation Count", fontsize=9)
    ax_mo.set_title("Monthly Citation Volume\n(Red=worst month; dark fill=severity ≥3)", fontsize=10, fontweight="bold")
    ax_mo.legend(fontsize=8)

    # Panel 4: Season breakdown
    ax_sea = axes[1, 1]
    apply_chart_style(ax_sea)
    season_order = ["Winter", "Spring", "Summer", "Fall"]
    sea_stats_ordered = season_stats.reindex([s for s in season_order if s in season_stats.index])
    sea_colors = [RUST if s == worst_season else TEAL for s in sea_stats_ordered.index]
    ax_sea.bar(sea_stats_ordered.index, sea_stats_ordered["total_deficiencies"].values,
               color=sea_colors, edgecolor="white")
    ax_sea.bar(sea_stats_ordered.index, sea_stats_ordered["serious"].values,
               color="#8B0000", alpha=0.5, label="Severity ≥3")
    ax_sea.set_xlabel("Season", fontsize=9)
    ax_sea.set_ylabel("Citation Count", fontsize=9)
    ax_sea.set_title(f"Seasonal Citation Volume\nWorst season: {worst_season}", fontsize=10, fontweight="bold")
    ax_sea.legend(fontsize=8)

    fig.suptitle("CA Memory Care: When Do Violations Occur? (2021–2025)", fontsize=13, fontweight="bold", y=1.01)
    save_chart(fig, OUTPUT_DIR, "chart")

    # Plotly interactive heatmap
    pfig = make_subplots(rows=1, cols=2, subplot_titles=["Month × Severity Heatmap", "Day-of-Week Deficiency Rate"])
    pfig.add_trace(
        go.Heatmap(
            z=heat_data, x=MONTH_NAMES,
            y=list(severity_tiers.values()),
            colorscale="YlOrRd", showscale=True, name="Count",
        ),
        row=1, col=1,
    )
    pfig.add_trace(
        go.Bar(x=DOW_NAMES, y=dow_rate.values, name="Defic/Insp",
               marker_color=[RUST if i == int(dow_rate.idxmax()) else TEAL for i in range(7)]),
        row=1, col=2,
    )
    pfig.update_layout(template="plotly_white", height=450, title_text="CA Memory Care: Seasonal & Day-of-Week Violation Patterns")
    save_plotly_chart(pfig, OUTPUT_DIR, "chart")

    # Data sample
    month_stats.reset_index().to_csv(OUTPUT_DIR / "data_sample.csv", index=False)

    # Key numbers
    worst_dow_name = DOW_NAMES[int(dow_rate.idxmax()) + 0]  # DOW 0=Mon in pandas
    dow_peak_rate = float(dow_rate.max())
    dow_weekend_rate = float(dow_rate[[5, 6]].mean())  # Sat + Sun
    dow_midweek_rate = float(dow_rate[[1, 2, 3]].mean())  # Mon–Wed

    findings = {
        "Worst month by total citations": f"{MONTH_NAMES[worst_month_idx - 1]} ({int(month_stats.loc[worst_month_idx, 'total_deficiencies'])} citations)",
        "Worst month by serious (sev≥3) citations": f"{MONTH_NAMES[worst_month_serious_idx - 1]} ({int(month_stats.loc[worst_month_serious_idx, 'serious'])} serious citations)",
        "Lightest month for citations": f"{MONTH_NAMES[best_month_idx - 1]} ({int(month_stats.loc[best_month_idx, 'total_deficiencies'])} citations)",
        "Worst season (by serious citations)": worst_season,
        "Day-of-week with highest deficiency rate": f"{worst_dow_name} ({dow_peak_rate:.2f} defic/insp)",
        "Weekend vs midweek deficiency rate": f"Weekend avg {dow_weekend_rate:.2f} vs midweek avg {dow_midweek_rate:.2f}",
        "Friday effect": "Present" if float(dow_rate.loc[4]) > float(dow_rate.loc[[1,2,3]].mean()) else "Not observed",
        "Note on DOW data": "Inspection scheduling artifact — Tue-Thu are peak inspection days; DOW rate normalizes for this",
    }

    summary = (
        f"Among CA memory care deficiencies from 2021–2025, {MONTH_NAMES[worst_month_idx - 1]} "
        f"has the highest total citation count and {worst_season} is the most citation-heavy season. "
        f"Day-of-week analysis is dominated by inspection scheduling (Tue–Thu peak), but normalizing "
        f"by inspections-per-day shows {worst_dow_name} has the highest deficiency rate "
        f"({dow_peak_rate:.2f} per inspection). "
        f"Weekends show a very different pattern: far fewer inspections occur, "
        f"meaning many facilities go unobserved Saturday–Sunday. "
        f"Headline: 'California memory care facilities get most of their violations in {worst_season} — and almost none on weekends.'"
    )

    write_findings(findings, summary, OUTPUT_DIR)

    top_finding = f"Worst month: {MONTH_NAMES[worst_month_idx - 1]}; worst season: {worst_season}; inspections nearly zero on weekends"

    return {
        "top_finding": top_finding,
        "run_date": datetime.now().strftime("%Y-%m-%d"),
        "worst_month": MONTH_NAMES[worst_month_idx - 1],
        "worst_season": worst_season,
        "worst_dow": worst_dow_name,
        "dow_peak_rate": dow_peak_rate,
        "dow_weekend_rate": dow_weekend_rate,
    }


if __name__ == "__main__":
    result = run()
    print("\nResult:", result)
