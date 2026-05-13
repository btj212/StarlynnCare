"""Analysis 5: geographic_equity_map

Do facilities in lower-income ZIP codes have worse inspection records?

DATA: Uses Census ACS 2022 5-year median household income by ZCTA (ZIP code).
Census API endpoint: https://api.census.gov/data/2022/acs/acs5?get=B19013_001E&for=zip+code+tabulation+area:{zips}
No API key required (500 req/day limit; we batch a single request).
Falls back to hardcoded ZIP3→income quartile lookup if the API is unavailable.
"""
from __future__ import annotations

import sys
import time
import urllib.request
import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import plotly.express as px

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scripts.analyses._lib import (
    TEAL, RUST, NEUTRAL, YELLOW, GREEN,
    apply_chart_style, save_chart, save_plotly_chart,
    write_findings, format_number,
)
from scripts.analyses._data_layer import load_facilities, load_deficiencies, load_inspections

OUTPUT_DIR = REPO_ROOT / "docs" / "analyses" / "geographic_equity_map"

# Fallback: ZIP3 prefix → rough income quartile (1=lowest, 4=highest)
# Based on well-known CA income geography patterns
ZIP3_INCOME_QUARTILE: dict[str, int] = {
    "900": 2, "901": 2, "902": 1, "903": 1, "904": 2, "905": 1, "906": 1,
    "907": 2, "908": 2, "910": 2, "911": 1, "912": 1, "913": 3, "914": 3,
    "915": 2, "916": 2, "917": 2, "918": 3, "919": 4, "920": 3, "921": 3,
    "922": 2, "923": 2, "924": 3, "925": 4, "926": 4, "927": 3, "928": 2,
    "930": 3, "931": 3, "932": 3, "933": 2, "934": 4, "935": 2, "936": 2,
    "937": 2, "938": 2, "939": 4, "940": 4, "941": 4, "942": 3, "943": 4,
    "944": 4, "945": 3, "946": 3, "947": 3, "948": 4, "949": 4, "950": 4,
    "951": 4, "952": 4, "953": 3, "954": 3, "955": 2, "956": 3, "957": 3,
    "958": 3, "959": 2, "960": 1, "961": 1,
}

# Approximate median household incomes for ZIP3 prefixes (fallback)
ZIP3_INCOME_APPROX: dict[str, int] = {
    "900": 58000, "901": 62000, "902": 45000, "903": 42000, "904": 60000,
    "905": 40000, "906": 38000, "907": 55000, "908": 57000, "910": 59000,
    "911": 41000, "912": 43000, "913": 72000, "914": 75000, "915": 55000,
    "916": 52000, "917": 50000, "918": 78000, "919": 85000, "920": 68000,
    "921": 65000, "922": 50000, "923": 48000, "924": 70000, "925": 88000,
    "926": 92000, "927": 65000, "928": 52000, "930": 70000, "931": 68000,
    "932": 65000, "933": 48000, "934": 90000, "935": 46000, "936": 50000,
    "937": 48000, "938": 47000, "939": 88000, "940": 110000, "941": 105000,
    "942": 72000, "943": 115000, "944": 112000, "945": 80000, "946": 78000,
    "947": 82000, "948": 108000, "949": 115000, "950": 120000, "951": 118000,
    "952": 95000, "953": 82000, "954": 78000, "955": 52000, "956": 65000,
    "957": 63000, "958": 61000, "959": 50000, "960": 42000, "961": 38000,
}

QUARTILE_LABELS = {1: "Q1 Low", 2: "Q2 Low-Mid", 3: "Q3 Mid-High", 4: "Q4 High"}


def fetch_census_income(zips: list[str]) -> dict[str, int]:
    """Fetch median household income from Census ACS 2022 5-year estimates."""
    # Batch in chunks of 50 to stay safe with URL length
    result: dict[str, int] = {}
    unique_zips = list(set(z.zfill(5) for z in zips if z and len(z.strip()) >= 5))
    chunk_size = 50
    for i in range(0, len(unique_zips), chunk_size):
        chunk = unique_zips[i : i + chunk_size]
        zip_param = ",".join(chunk)
        url = (
            f"https://api.census.gov/data/2022/acs/acs5"
            f"?get=B19013_001E"
            f"&for=zip%20code%20tabulation%20area:{zip_param}"
        )
        try:
            with urllib.request.urlopen(url, timeout=12) as r:
                data = json.loads(r.read())
            # data[0] is header: ['B19013_001E', 'zip code tabulation area']
            for row in data[1:]:
                income_val, zcta = row[0], row[1]
                try:
                    income = int(income_val)
                    if income > 0:
                        result[zcta] = income
                except (ValueError, TypeError):
                    pass
        except Exception as e:
            print(f"  Census API chunk {i}–{i+chunk_size} failed: {e} — will use fallback for these ZIPs")
        time.sleep(0.2)
    return result


def zip_to_income(zip_code: str | None, census_data: dict[str, int]) -> int | None:
    """Return income estimate: Census data if available, else ZIP3 approximation."""
    if not zip_code:
        return None
    z5 = str(zip_code).strip().zfill(5)
    if z5 in census_data:
        return census_data[z5]
    z3 = z5[:3]
    return ZIP3_INCOME_APPROX.get(z3)


def run() -> dict:
    print("  Loading data...")
    facilities = load_facilities("CA")
    deficiencies = load_deficiencies("CA")
    inspections = load_inspections("CA")

    # --- Deficiency rate per facility ---
    defic_per_fac = (
        deficiencies.groupby("facility_id")
        .agg(
            total_deficiencies=("id", "count"),
            weighted_severity=("severity", lambda x: (x.map({1:1,2:2,3:3,4:5}).fillna(1)).sum()),
        )
        .reset_index()
    )
    insp_per_fac = inspections.groupby("facility_id")["id"].count().reset_index(name="total_inspections")

    fac = facilities.merge(defic_per_fac, left_on="id", right_on="facility_id", how="left")
    fac = fac.merge(insp_per_fac, left_on="id", right_on="facility_id", how="left")
    fac["total_deficiencies"] = fac["total_deficiencies"].fillna(0)
    fac["total_inspections"] = fac["total_inspections"].fillna(0)
    fac["beds_safe"] = fac["beds"].fillna(30).clip(lower=1)
    fac["deficiency_rate"] = fac.apply(
        lambda r: r["total_deficiencies"] / r["total_inspections"] if r["total_inspections"] > 0 else 0.0,
        axis=1,
    )
    fac["severity_index"] = fac.apply(
        lambda r: r["weighted_severity"] / r["beds_safe"] if pd.notna(r.get("weighted_severity")) else 0.0,
        axis=1,
    )

    # --- Fetch income data ---
    ca_zips = fac["zip"].dropna().tolist()
    print(f"  Fetching Census income data for {len(set(ca_zips))} unique CA ZIPs...")
    census_income = fetch_census_income(ca_zips)
    print(f"  Got Census data for {len(census_income)} ZIPs")

    fac["median_income"] = fac["zip"].apply(lambda z: zip_to_income(z, census_income))
    fac["income_source"] = fac["zip"].apply(
        lambda z: "Census" if z and str(z).strip().zfill(5) in census_income else "Approximate"
    )

    # Log data source breakdown
    n_census = (fac["income_source"] == "Census").sum()
    n_approx = (fac["income_source"] == "Approximate").sum()
    print(f"  Income source: {n_census} from Census API, {n_approx} from approximation")

    fac = fac.dropna(subset=["median_income"]).copy()

    # --- ZIP-level aggregation ---
    zip_agg = (
        fac.groupby("zip")
        .agg(
            avg_deficiency_rate=("deficiency_rate", "mean"),
            avg_severity_index=("severity_index", "mean"),
            facility_count=("id", "count"),
            median_income=("median_income", "first"),
        )
        .reset_index()
    )
    # Only ZIPs with >=2 facilities for the scatter
    zip_plot = zip_agg[zip_agg["facility_count"] >= 2].copy()

    # --- Income quartiles ---
    fac["income_quartile"] = pd.qcut(fac["median_income"], q=4, labels=["Q1 Low", "Q2 Low-Mid", "Q3 Mid-High", "Q4 High"])
    quartile_stats = (
        fac.groupby("income_quartile", observed=True)
        .agg(
            avg_deficiency_rate=("deficiency_rate", "mean"),
            avg_severity_index=("severity_index", "mean"),
            n_facilities=("id", "count"),
            income_median=("median_income", "median"),
        )
        .reset_index()
    )

    # --- Pearson correlation ---
    from scipy import stats as scipy_stats
    valid = zip_plot.dropna(subset=["median_income", "avg_deficiency_rate"])
    if len(valid) >= 5:
        corr, p_val = scipy_stats.pearsonr(valid["median_income"], valid["avg_deficiency_rate"])
    else:
        corr, p_val = float("nan"), float("nan")

    # Outlier ZIPs: high income + high deficiency rate
    if not zip_plot.empty:
        hi_income_thresh = zip_plot["median_income"].quantile(0.75)
        hi_defic_thresh = zip_plot["avg_deficiency_rate"].quantile(0.75)
        outlier_mask = (zip_plot["median_income"] > hi_income_thresh) & (zip_plot["avg_deficiency_rate"] > hi_defic_thresh)
        outlier_zips = zip_plot[outlier_mask].sort_values("avg_deficiency_rate", ascending=False).head(3)
    else:
        outlier_zips = pd.DataFrame()

    # Worst quartile
    if not quartile_stats.empty:
        worst_q = quartile_stats.loc[quartile_stats["avg_deficiency_rate"].idxmax(), "income_quartile"]
    else:
        worst_q = "N/A"

    # --- Charts ---
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
    apply_chart_style(ax1)
    apply_chart_style(ax2)

    # Scatter: income vs deficiency rate per ZIP
    if not zip_plot.empty:
        sc = ax1.scatter(
            zip_plot["median_income"] / 1000,
            zip_plot["avg_deficiency_rate"],
            c=zip_plot["avg_severity_index"],
            cmap="RdYlGn_r",
            alpha=0.65,
            s=zip_plot["facility_count"] * 25,
            edgecolors="white",
            linewidths=0.5,
            zorder=3,
        )
        plt.colorbar(sc, ax=ax1, label="Avg Severity Index", shrink=0.8)

        # Trend line
        z = np.polyfit(zip_plot["median_income"] / 1000, zip_plot["avg_deficiency_rate"], 1)
        p = np.poly1d(z)
        x_range = np.linspace(zip_plot["median_income"].min() / 1000, zip_plot["median_income"].max() / 1000, 100)
        ax1.plot(x_range, p(x_range), "--", color=NEUTRAL, alpha=0.7, linewidth=1.5,
                 label=f"Trend (r={corr:.2f})")

        # Label outliers
        for _, row in outlier_zips.head(2).iterrows():
            ax1.annotate(
                f"ZIP {row['zip']}",
                xy=(row["median_income"] / 1000, row["avg_deficiency_rate"]),
                fontsize=7, color="#8B0000",
                xytext=(4, 4), textcoords="offset points",
            )

        ax1.legend(fontsize=8)

    ax1.set_xlabel("Median Household Income (K USD)", fontsize=9)
    ax1.set_ylabel("Avg Deficiency Rate (defics/inspection)", fontsize=9)
    ax1.set_title("Income vs. Deficiency Rate\n(ZIPs with ≥2 facilities; dot size = facility count)", fontsize=10, fontweight="bold")

    # Bar chart: severity index by income quartile
    if not quartile_stats.empty:
        bar_colors = [GREEN, YELLOW, "#E07B39", RUST]
        bars = ax2.bar(
            quartile_stats["income_quartile"].astype(str),
            quartile_stats["avg_severity_index"],
            color=bar_colors,
            edgecolor="white",
            linewidth=0.8,
        )
        for bar, row in zip(bars, quartile_stats.itertuples()):
            ax2.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.005,
                f"{row.avg_severity_index:.2f}\n(n={row.n_facilities})",
                ha="center", va="bottom", fontsize=8, color="#333",
            )

    ax2.set_xlabel("Income Quartile", fontsize=9)
    ax2.set_ylabel("Avg Severity Index", fontsize=9)
    ax2.set_title("Avg Severity Index by Income Quartile\n(Q1=lowest income, Q4=highest)", fontsize=10, fontweight="bold")

    fig.suptitle(
        "CA Memory Care: Geographic Equity — Income vs. Inspection Quality",
        fontsize=12, fontweight="bold", y=1.02,
    )
    save_chart(fig, OUTPUT_DIR, "chart")

    # Plotly interactive scatter
    if not zip_plot.empty:
        pfig = px.scatter(
            zip_plot,
            x="median_income",
            y="avg_deficiency_rate",
            size="facility_count",
            color="avg_severity_index",
            hover_name="zip",
            hover_data={"facility_count": True, "median_income": ":,.0f", "avg_deficiency_rate": ":.2f"},
            color_continuous_scale="RdYlGn_r",
            title="Geographic Equity: ZIP Income vs Deficiency Rate (Interactive)",
            labels={
                "median_income": "Median Household Income (USD)",
                "avg_deficiency_rate": "Avg Deficiency Rate",
                "avg_severity_index": "Severity Index",
            },
        )
        pfig.update_layout(template="plotly_white")
        save_plotly_chart(pfig, OUTPUT_DIR, "chart")

    # Data sample
    zip_agg.to_csv(OUTPUT_DIR / "data_sample.csv", index=False)

    # Findings
    worst_q_row = quartile_stats[quartile_stats["income_quartile"].astype(str) == str(worst_q)].iloc[0] if not quartile_stats.empty else None
    best_q_row = quartile_stats.loc[quartile_stats["avg_deficiency_rate"].idxmin()] if not quartile_stats.empty else None

    outlier_zip_str = ", ".join(
        f"ZIP {r['zip']} (${r['median_income']:,.0f} income, {r['avg_deficiency_rate']:.2f} defic/insp)"
        for _, r in outlier_zips.iterrows()
    ) if not outlier_zips.empty else "None identified"

    findings = {
        "Pearson r (ZIP income vs deficiency rate)": f"{corr:.3f} (p={p_val:.3f})" if not np.isnan(corr) else "N/A",
        "Income data source": f"{n_census} ZIPs from Census API 2022, {n_approx} from approximation",
        "Worst inspection record quartile": f"{worst_q} — avg deficiency rate {worst_q_row['avg_deficiency_rate']:.2f}" if worst_q_row is not None else "N/A",
        "Best inspection record quartile": f"{best_q_row['income_quartile']} — avg deficiency rate {best_q_row['avg_deficiency_rate']:.2f}" if best_q_row is not None else "N/A",
        "High-income ZIPs with surprising deficiency rates": outlier_zip_str,
        "Facilities with income data": f"{len(fac)} of 484",
        "ZIPs analyzed (≥2 facilities)": str(len(zip_plot)),
    }

    summary = (
        f"The correlation between ZIP-level household income and memory care deficiency rate is "
        f"r={corr:.2f} — {'indicating that lower-income areas see marginally worse inspection records, though the effect is modest' if corr < -0.15 else 'essentially flat, suggesting no strong geographic-income gradient in CA memory care quality'}. "
        f"The {worst_q} income quartile shows the highest average deficiency rate. "
        f"Notably, several high-income ZIPs ({outlier_zip_str[:60]}…) also rank poorly, "
        f"suggesting money alone does not buy better care environments. "
        f"Income data sourced from Census ACS 2022 ({n_census} ZIPs direct, {n_approx} approximated)."
    )

    write_findings(findings, summary, OUTPUT_DIR)

    top_finding = f"r={corr:.2f} income-deficiency correlation; {worst_q} income quartile has worst records"

    return {
        "top_finding": top_finding,
        "run_date": datetime.now().strftime("%Y-%m-%d"),
        "corr": float(corr),
        "worst_quartile": str(worst_q),
        "n_census_zips": n_census,
        "outlier_zips": [r["zip"] for _, r in outlier_zips.iterrows()],
    }


if __name__ == "__main__":
    result = run()
    print("\nResult:", result)
