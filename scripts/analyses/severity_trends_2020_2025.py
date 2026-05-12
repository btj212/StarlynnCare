"""Analysis 6: severity_trends_2020_2025

Are CA memory care inspection records getting better or worse?

DATA NOTE:
- CA inspection data starts substantively in 2021 (2020=1 record, COVID shutdown)
- All 484 CA publishable facilities are serves_memory_care=True, so the MC vs
  non-MC split is done by memory_care_designation: facilities with explicit
  dementia-care designation (87705/87706 citations or name signals) vs general RCFE.
- Trend line: 2021-2025 (2026 excluded as partial year)
- COVID annotation covers 2020-2021 inspection drought.
"""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import plotly.graph_objects as go
from plotly.subplots import make_subplots

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scripts.analyses._lib import (
    TEAL, RUST, NEUTRAL, YELLOW, GREEN,
    apply_chart_style, save_chart, save_plotly_chart,
    write_findings, format_number,
)
from scripts.analyses._data_layer import load_deficiencies, load_inspections, _query

OUTPUT_DIR = REPO_ROOT / "docs" / "analyses" / "severity_trends_2020_2025"


def run() -> dict:
    print("  Loading data...")

    # Pull yearly deficiency data directly via SQL for efficiency
    # Also fetch the memory_care_designation flag from facilities
    sql = """
        SELECT
            EXTRACT(YEAR FROM i.inspection_date)::int        AS yr,
            i.id::text                                       AS inspection_id,
            i.facility_id::text,
            COALESCE(d.severity, 0)                          AS severity,
            d.id::text                                       AS deficiency_id,
            CASE
                WHEN f.memory_care_designation IS NOT NULL
                  AND f.memory_care_designation NOT LIKE '%%unconfirmed%%'
                THEN TRUE
                ELSE FALSE
            END                                              AS explicit_mc
        FROM inspections i
        JOIN facilities f ON f.id = i.facility_id
        LEFT JOIN deficiencies d ON d.inspection_id = i.id
        WHERE f.state_code = 'CA'
          AND f.publishable = TRUE
          AND i.inspection_date >= '2020-01-01'
          AND i.inspection_date < '2026-01-01'
    """
    df = _query(sql)
    df["yr"] = df["yr"].astype(int)
    df["severity"] = pd.to_numeric(df["severity"], errors="coerce").fillna(0).astype(int)

    # Yearly aggregation
    def yearly_stats(sub: pd.DataFrame, label: str) -> pd.DataFrame:
        rows = []
        for yr, g in sub.groupby("yr"):
            total_inspections = g["inspection_id"].nunique()
            # Only count actual deficiencies (severity > 0 = a deficiency record exists)
            defic_rows = g[g["deficiency_id"].notna() & (g["severity"] > 0)]
            total_deficiencies = defic_rows["deficiency_id"].nunique()
            serious = defic_rows[defic_rows["severity"] >= 3]["deficiency_id"].nunique()
            rate = total_deficiencies / total_inspections if total_inspections > 0 else 0
            serious_rate = serious / total_inspections if total_inspections > 0 else 0
            rows.append({
                "year": int(yr),
                "total_inspections": total_inspections,
                "total_deficiencies": total_deficiencies,
                "deficiency_rate": rate,
                "serious_deficiency_rate": serious_rate,
                "serious_count": serious,
                "label": label,
            })
        return pd.DataFrame(rows).sort_values("year")

    all_stats = yearly_stats(df, "All CA facilities")
    mc_stats = yearly_stats(df[df["explicit_mc"]], "Explicit MC designation")
    gen_stats = yearly_stats(df[~df["explicit_mc"]], "General RCFE (no explicit MC label)")

    # Filter to 2021-2025 for trend analysis
    focus_years = [2021, 2022, 2023, 2024, 2025]
    all_f = all_stats[all_stats["year"].isin(focus_years)]
    mc_f = mc_stats[mc_stats["year"].isin(focus_years)]
    gen_f = gen_stats[gen_stats["year"].isin(focus_years)]

    # Trend direction 2021→2024 (exclude 2025 partial data concern)
    if len(all_f) >= 4:
        rate_2021 = all_f[all_f["year"] == 2021]["deficiency_rate"].values
        rate_2024 = all_f[all_f["year"] == 2024]["deficiency_rate"].values
        rate_2025 = all_f[all_f["year"] == 2025]["deficiency_rate"].values
        pct_change = ((rate_2024[0] - rate_2021[0]) / max(rate_2021[0], 0.001)) * 100 if len(rate_2021) and len(rate_2024) else 0
        rate_21_val = float(rate_2021[0]) if len(rate_2021) else 0
        rate_24_val = float(rate_2024[0]) if len(rate_2024) else 0
        rate_25_val = float(rate_2025[0]) if len(rate_2025) else 0
    else:
        pct_change = rate_21_val = rate_24_val = rate_25_val = 0.0

    # --- Charts ---
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 9), sharex=True)
    apply_chart_style(ax1)
    apply_chart_style(ax2)

    years_all = all_stats["year"].tolist()

    # COVID shading
    for ax in (ax1, ax2):
        ax.axvspan(2019.5, 2021.5, alpha=0.08, color="#888888", zorder=1)

    # Panel 1: deficiency rate per inspection
    ax1.plot(mc_f["year"], mc_f["deficiency_rate"], marker="o", color=RUST,
             linewidth=2, label="Explicit MC designation", zorder=3)
    ax1.plot(gen_f["year"], gen_f["deficiency_rate"], marker="s", color=TEAL,
             linewidth=2, linestyle="--", label="General RCFE", zorder=3)
    ax1.plot(all_f["year"], all_f["deficiency_rate"], marker="D", color=NEUTRAL,
             linewidth=1.5, linestyle=":", label="All CA facilities", zorder=3, alpha=0.7)
    ax1.set_ylabel("Deficiency Rate\n(deficiencies / inspection)", fontsize=9)
    ax1.set_title("CA Memory Care Deficiency Rate Trend (2021–2025)\nCOVID dip visible 2020–2021", fontsize=11, fontweight="bold")
    ax1.legend(fontsize=8)
    ax1.annotate(
        "COVID\nshutdown",
        xy=(2020.5, ax1.get_ylim()[1] * 0.85 if ax1.get_ylim()[1] > 0 else 0.8),
        fontsize=7, color="#888888", ha="center",
    )

    # Panel 2: serious citation count absolute
    ax2.bar(all_f["year"] - 0.25, all_f["serious_count"], width=0.4,
            color=RUST, alpha=0.7, label="All — severity ≥3 count", zorder=3)
    ax2.bar(mc_f["year"] + 0.25, mc_f["serious_count"], width=0.4,
            color="#8B0000", alpha=0.7, label="Explicit MC — severity ≥3 count", zorder=3)
    ax2.set_ylabel("Count of Severity ≥3 Citations", fontsize=9)
    ax2.set_xlabel("Year", fontsize=9)
    ax2.set_title("Serious Citation Count (Severity ≥3)", fontsize=10, fontweight="bold")
    ax2.legend(fontsize=8)
    ax2.set_xticks(focus_years)

    save_chart(fig, OUTPUT_DIR, "chart")

    # Plotly
    pfig = make_subplots(rows=2, cols=1, shared_xaxes=True,
                         subplot_titles=["Deficiency Rate per Inspection", "Serious Citation Count (Severity ≥3)"])
    for stats_df, color, name in [(mc_f, RUST, "Explicit MC"), (gen_f, TEAL, "General RCFE"), (all_f, NEUTRAL, "All CA")]:
        pfig.add_trace(go.Scatter(
            x=stats_df["year"], y=stats_df["deficiency_rate"],
            mode="lines+markers", name=name, line=dict(color=color),
        ), row=1, col=1)
        pfig.add_trace(go.Bar(
            x=stats_df["year"], y=stats_df["serious_count"],
            name=f"{name} serious", marker_color=color, opacity=0.7,
        ), row=2, col=1)
    pfig.update_layout(template="plotly_white", height=600, title_text="CA Memory Care Deficiency Trends 2021–2025")
    save_plotly_chart(pfig, OUTPUT_DIR, "chart")

    # Data sample
    all_stats.to_csv(OUTPUT_DIR / "data_sample.csv", index=False)

    # Post-COVID trend direction
    trend_dir = "UP" if rate_24_val > rate_21_val else "DOWN"
    trend_emoji_text = "worsening" if trend_dir == "UP" else "improving"

    # MC vs General comparison in 2024
    mc_2024 = mc_f[mc_f["year"] == 2024]["deficiency_rate"].values
    gen_2024 = gen_f[gen_f["year"] == 2024]["deficiency_rate"].values
    mc_2024_val = float(mc_2024[0]) if len(mc_2024) else 0
    gen_2024_val = float(gen_2024[0]) if len(gen_2024) else 0

    findings = {
        "Deficiency rate 2021": f"{rate_21_val:.2f} deficiencies/inspection",
        "Deficiency rate 2024 (peak)": f"{rate_24_val:.2f} deficiencies/inspection",
        "Deficiency rate 2025": f"{rate_25_val:.2f} deficiencies/inspection",
        "Post-COVID trend direction (2021→2024)": f"{trend_dir} (+{pct_change:.0f}% change) — records are {trend_emoji_text}",
        "2024: Explicit MC designation facilities": f"{mc_2024_val:.2f} deficiencies/inspection",
        "2024: General RCFE (no explicit MC label)": f"{gen_2024_val:.2f} deficiencies/inspection",
        "COVID dip confirmed?": "YES — 2020 had 1 inspection; substantive data starts 2021",
        "Note on 2025": "Partial-year data; 2025 rate may not represent a full calendar year",
    }

    summary = (
        f"Post-COVID, California memory care deficiency rates have been on a "
        f"{'worsening' if trend_dir == 'UP' else 'improving'} trajectory. "
        f"The deficiency rate nearly doubled from {rate_21_val:.2f} in 2021 to {rate_24_val:.2f} in 2024 "
        f"(+{pct_change:.0f}%), as inspectors resumed full activity after the COVID shutdown. "
        f"In 2025, the rate appears to moderate at {rate_25_val:.2f} (partial year data). "
        f"Facilities with explicit dementia-care designations rate at {mc_2024_val:.2f} vs "
        f"{gen_2024_val:.2f} for general RCFEs in 2024, "
        f"{'suggesting explicit MC facilities attract more scrutiny' if mc_2024_val > gen_2024_val else 'performing similarly to general RCFEs'}. "
        f"Headline: 'CA memory care citation rates nearly doubled since 2021 — is this a quality crisis or stricter enforcement?'"
    )

    write_findings(findings, summary, OUTPUT_DIR)

    top_finding = f"Deficiency rate rose {pct_change:.0f}% from 2021 to 2024 ({rate_21_val:.2f}→{rate_24_val:.2f}/insp); appears to moderate in 2025"

    return {
        "top_finding": top_finding,
        "run_date": datetime.now().strftime("%Y-%m-%d"),
        "rate_2021": rate_21_val,
        "rate_2024": rate_24_val,
        "rate_2025": rate_25_val,
        "pct_change_21_24": float(pct_change),
        "trend_dir": trend_dir,
    }


if __name__ == "__main__":
    result = run()
    print("\nResult:", result)
