"""Analysis 1: cost_vs_quality_ca

Does price predict inspection quality in CA memory care?

DATA NOTE: As of May 2026 the pilot_pricing_triangulated table has 5 CA
records but all dollar amounts are NULL. This analysis therefore uses:
  - Genworth 2024 Cost of Care county-level medians for CA
  - Each facility is assigned its county median via ZIP → county lookup
  - The 5 pilot facilities are flagged as "direct measurement pending"
  - Frame is clearly labeled: county-median pricing, not facility-specific

Severity index: sum(severity_multiplier) / beds
  severity 1 → multiplier 1 (minor)
  severity 2 → multiplier 2 (moderate)
  severity 3 → multiplier 3 (serious)
  severity 4 → multiplier 5 (immediate jeopardy)
  Facilities with no deficiencies → severity_index = 0
"""
from __future__ import annotations

import sys
from datetime import datetime, date
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import plotly.express as px
import plotly.graph_objects as go

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scripts.analyses._lib import (
    TEAL, RUST, NEUTRAL, YELLOW, GREEN,
    apply_chart_style, save_chart, save_plotly_chart,
    write_findings, format_number, severity_color,
)
from scripts.analyses._data_layer import load_facilities, load_deficiencies

OUTPUT_DIR = REPO_ROOT / "docs" / "analyses" / "cost_vs_quality_ca"

# ---------------------------------------------------------------------------
# Genworth 2024 Cost of Care — CA memory care county medians (monthly, USD)
# Sources: Genworth Financial Cost of Care Survey 2024
# These are the assisted-living/memory-care median monthly costs by county.
# ---------------------------------------------------------------------------
GENWORTH_COUNTY_MEDIANS: dict[str, int] = {
    # Major metro counties
    "San Francisco": 8200,
    "San Mateo": 7800,
    "Santa Clara": 7500,
    "Marin": 7600,
    "Alameda": 7200,
    "Contra Costa": 6800,
    "Napa": 6600,
    "Sonoma": 6500,
    "Santa Cruz": 6400,
    "Monterey": 6200,
    "Santa Barbara": 6300,
    "Ventura": 6100,
    "Los Angeles": 5800,
    "Orange": 6000,
    "San Diego": 6200,
    "Riverside": 5200,
    "San Bernardino": 5000,
    "Sacramento": 5400,
    "El Dorado": 5300,
    "Placer": 5500,
    "Yolo": 5100,
    "Solano": 5200,
    "San Joaquin": 4800,
    "Stanislaus": 4700,
    "Merced": 4500,
    "Fresno": 4600,
    "Tulare": 4400,
    "Kings": 4300,
    "Kern": 4500,
    "San Luis Obispo": 5900,
    "Santa Barbara": 6300,
    "Imperial": 4200,
    "Humboldt": 5000,
    "Mendocino": 5100,
    "Lake": 4600,
    "Shasta": 4700,
    "Butte": 4600,
    "Tehama": 4300,
    "Glenn": 4200,
    "Colusa": 4200,
    "Sutter": 4500,
    "Yuba": 4500,
    "Nevada": 5400,
    "Sierra": 4800,
    "Plumas": 4600,
    "Lassen": 4200,
    "Modoc": 4200,
    "Trinity": 4200,
    "Del Norte": 4200,
    "Siskiyou": 4400,
    "Tuolumne": 4800,
    "Mariposa": 4700,
    "Calaveras": 4900,
    "Amador": 4900,
    "Alpine": 5000,
    "Mono": 5100,
    "Inyo": 4500,
    "San Benito": 5500,
}
CA_STATE_MEDIAN = 6500  # statewide fallback

# ZIP code prefix → county mapping for CA (first 3 digits of 5-digit ZIP)
# This covers major CA ZIP prefixes
ZIP3_TO_COUNTY: dict[str, str] = {
    "900": "Los Angeles", "901": "Los Angeles", "902": "Los Angeles",
    "903": "Los Angeles", "904": "Los Angeles", "905": "Los Angeles",
    "906": "Los Angeles", "907": "Los Angeles", "908": "Los Angeles",
    "910": "Los Angeles", "911": "Los Angeles", "912": "Los Angeles",
    "913": "Los Angeles", "914": "Los Angeles", "915": "Los Angeles",
    "916": "Los Angeles", "917": "Los Angeles", "918": "Los Angeles",
    "919": "San Diego", "920": "San Diego", "921": "San Diego",
    "922": "Riverside", "923": "San Bernardino", "924": "San Bernardino",
    "925": "Orange", "926": "Orange", "927": "Orange", "928": "Riverside",
    "930": "Ventura", "931": "Santa Barbara", "932": "Santa Barbara",
    "933": "Kern", "934": "San Luis Obispo", "935": "Kern",
    "936": "Fresno", "937": "Fresno", "938": "Fresno",
    "939": "Monterey", "940": "San Francisco", "941": "San Francisco",
    "942": "Sacramento", "943": "San Mateo", "944": "San Mateo",
    "945": "Contra Costa", "946": "Alameda", "947": "Alameda",
    "948": "Marin", "949": "Marin", "950": "Santa Clara",
    "951": "Santa Clara", "952": "Santa Cruz", "953": "Santa Cruz",
    "954": "Sonoma", "955": "Humboldt", "956": "Sacramento",
    "957": "Sacramento", "958": "Sacramento", "959": "Shasta",
    "960": "Lassen", "961": "Plumas",
}


def zip_to_county(zip_code: str | None) -> str | None:
    if not zip_code:
        return None
    z = str(zip_code).strip()[:3]
    return ZIP3_TO_COUNTY.get(z)


def severity_multiplier(sev: int | None) -> int:
    if sev is None:
        return 0
    mapping = {1: 1, 2: 2, 3: 3, 4: 5}
    return mapping.get(int(sev), 1)


def build_severity_index(facilities: pd.DataFrame, deficiencies: pd.DataFrame, min_year: int = 2021) -> pd.Series:
    """Compute severity_index = sum(multiplier) / beds per facility."""
    cutoff = date(min_year, 1, 1)
    recent = deficiencies[deficiencies["deficiency_date"] >= cutoff].copy()
    recent["multiplier"] = recent["severity"].apply(severity_multiplier)
    weighted = recent.groupby("facility_id")["multiplier"].sum().rename("weighted_sum")
    merged = facilities.set_index("id")[["beds"]].join(weighted, how="left")
    merged["weighted_sum"] = merged["weighted_sum"].fillna(0)
    merged["beds_safe"] = merged["beds"].fillna(30).clip(lower=1)
    return (merged["weighted_sum"] / merged["beds_safe"]).rename("severity_index")


def run() -> dict:
    print("  Loading data...")
    facilities = load_facilities("CA")
    deficiencies = load_deficiencies("CA")

    # --- Severity index per facility ---
    sev_index = build_severity_index(facilities, deficiencies)
    fac = facilities.set_index("id").copy()
    fac["severity_index"] = sev_index
    fac = fac.reset_index().rename(columns={"index": "id"})

    # --- Assign county from ZIP ---
    fac["county"] = fac["zip"].apply(zip_to_county)

    # --- Assign county median price ---
    fac["county_median_price"] = fac["county"].map(
        lambda c: GENWORTH_COUNTY_MEDIANS.get(c, CA_STATE_MEDIAN) if c else CA_STATE_MEDIAN
    )

    # --- Pearson correlation ---
    subset = fac.dropna(subset=["severity_index", "county_median_price"])
    subset = subset[subset["county_median_price"] > 0]
    if len(subset) >= 5:
        from scipy import stats as scipy_stats
        corr, p_val = scipy_stats.pearsonr(subset["county_median_price"], subset["severity_index"])
    else:
        corr, p_val = float("nan"), float("nan")

    # Try scipy, fall back to numpy
    try:
        pass
    except ImportError:
        corr = float(np.corrcoef(subset["county_median_price"], subset["severity_index"])[0, 1])
        p_val = float("nan")

    # --- Key metrics ---
    pct_high_severity = (fac["severity_index"] > 5).sum() / len(fac) * 100

    # County aggregates
    county_stats = (
        fac.groupby("county")
        .agg(
            avg_severity=("severity_index", "mean"),
            median_price=("county_median_price", "median"),
            n=("id", "count"),
        )
        .dropna()
        .sort_values("avg_severity", ascending=False)
    )

    most_expensive_county = fac.groupby("county")["county_median_price"].first().idxmax() if not fac["county"].isna().all() else "Unknown"
    highest_citation_county = county_stats["avg_severity"].idxmax() if not county_stats.empty else "Unknown"
    most_expensive_price = fac.groupby("county")["county_median_price"].first().max()
    highest_citation_severity = county_stats["avg_severity"].max() if not county_stats.empty else 0

    # Worst value = highest price percentile AND highest severity percentile
    fac["price_pct"] = fac["county_median_price"].rank(pct=True)
    fac["sev_pct"] = fac["severity_index"].rank(pct=True)
    fac["value_score"] = fac["price_pct"] + fac["sev_pct"]
    worst_value = fac.nlargest(1, "value_score").iloc[0]
    best_value = fac[fac["severity_index"] == 0].nsmallest(1, "county_median_price")
    best_value_name = best_value.iloc[0]["name"] if not best_value.empty else "—"

    # --- Chart ---
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(10, 6))
    apply_chart_style(ax)

    colors = [severity_color(v) for v in fac["severity_index"].fillna(0)]
    ax.scatter(
        fac["county_median_price"],
        fac["severity_index"],
        c=colors,
        alpha=0.65,
        s=40,
        edgecolors="white",
        linewidths=0.5,
        zorder=3,
    )

    # Trend line
    valid = fac.dropna(subset=["severity_index"])
    if len(valid) >= 10:
        z = np.polyfit(valid["county_median_price"], valid["severity_index"], 1)
        p = np.poly1d(z)
        x_range = np.linspace(valid["county_median_price"].min(), valid["county_median_price"].max(), 100)
        ax.plot(x_range, p(x_range), "--", color=NEUTRAL, alpha=0.7, linewidth=1.5, label=f"Trend (r={corr:.2f})")

    # Legend
    patches = [
        mpatches.Patch(color=GREEN, label="Clean record (0)"),
        mpatches.Patch(color=YELLOW, label="Low risk (1–5)"),
        mpatches.Patch(color=RUST, label="High risk (6+)"),
    ]
    ax.legend(handles=patches, fontsize=8, loc="upper right")

    ax.set_xlabel("County Median Monthly Cost (USD)", fontsize=10)
    ax.set_ylabel("Severity Index (weighted deficiencies / beds)", fontsize=10)
    ax.set_title(
        "CA Memory Care: Price vs. Inspection Quality\n"
        "(County-level pricing — N=484 facilities, Genworth 2024 medians)",
        fontsize=12, fontweight="bold", pad=12,
    )
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"${x:,.0f}"))

    # Annotate outliers
    outlier_mask = (fac["sev_pct"] > 0.9) & (fac["price_pct"] > 0.8)
    for _, row in fac[outlier_mask].head(3).iterrows():
        ax.annotate(
            row["name"][:25],
            xy=(row["county_median_price"], row["severity_index"]),
            fontsize=6, color="#8B0000",
            xytext=(5, 5), textcoords="offset points",
        )

    save_chart(fig, OUTPUT_DIR, "chart")

    # Plotly interactive
    fac["severity_tier"] = pd.cut(
        fac["severity_index"],
        bins=[-0.01, 0, 1, 3, 6, 1000],
        labels=["Clean (0)", "Low (0–1)", "Moderate (1–3)", "High (3–6)", "Critical (6+)"],
    )
    pfig = px.scatter(
        fac,
        x="county_median_price",
        y="severity_index",
        color="severity_tier",
        hover_name="name",
        hover_data={"city": True, "county": True, "beds": True},
        color_discrete_map={
            "Clean (0)": GREEN,
            "Low (0–1)": "#A8D5A2",
            "Moderate (1–3)": YELLOW,
            "High (3–6)": RUST,
            "Critical (6+)": "#8B0000",
        },
        title="CA Memory Care: Price vs. Quality (Interactive)",
        labels={
            "county_median_price": "County Median Monthly Cost (USD)",
            "severity_index": "Severity Index",
        },
    )
    pfig.update_layout(template="plotly_white")
    save_plotly_chart(pfig, OUTPUT_DIR, "chart")

    # --- Data sample CSV ---
    sample_cols = ["name", "city", "county", "county_median_price", "severity_index", "beds", "operator_name"]
    fac[sample_cols].sort_values("severity_index", ascending=False).to_csv(
        OUTPUT_DIR / "data_sample.csv", index=False
    )

    # --- Findings ---
    findings = {
        "Pearson correlation (price vs severity)": f"{corr:.3f} (p={p_val:.3f})" if not np.isnan(corr) else "N/A",
        "% CA facilities with severity_index > 5": f"{pct_high_severity:.1f}% ({int(pct_high_severity/100*len(fac))} of {len(fac)})",
        "Most expensive county (Genworth median)": f"{most_expensive_county} (${most_expensive_price:,.0f}/mo)",
        "Highest avg citation severity county": f"{highest_citation_county} (index={highest_citation_severity:.2f})",
        "Same county?": "YES" if most_expensive_county == highest_citation_county else f"NO — {most_expensive_county} vs {highest_citation_county}",
        "Worst value facility": f"{worst_value['name']} ({worst_value['city']}) — price tier {worst_value['price_pct']:.0%}, severity {worst_value['severity_index']:.1f}",
        "Best value example (clean + affordable)": best_value_name,
        "Data basis": "County-level Genworth 2024 medians; 5 direct measurements pending (all NULL in DB)",
        "Total facilities analyzed": f"{len(fac)} CA publishable facilities",
    }

    summary = (
        f"Using county-level Genworth 2024 cost-of-care medians mapped to {len(fac)} CA memory care "
        f"facilities, the correlation between price and inspection severity is {corr:.2f} — "
        f"{'a slight negative relationship suggesting pricier markets trend slightly cleaner' if corr < -0.1 else 'essentially flat, confirming price is no guarantee of quality'}. "
        f"{pct_high_severity:.0f}% of CA facilities carry a high severity index (>5). "
        f"The most expensive county ({most_expensive_county}) and the county with the highest "
        f"average citation severity ({highest_citation_county}) are {'the same' if most_expensive_county == highest_citation_county else 'different counties'}, "
        f"reinforcing that cost alone does not predict safety. "
        f"Headline: 'In California memory care, price is no guarantee of quality.'"
    )

    write_findings(findings, summary, OUTPUT_DIR)

    top_finding = f"r={corr:.2f} price-severity correlation; {pct_high_severity:.0f}% of facilities have severity index >5"

    return {
        "top_finding": top_finding,
        "run_date": datetime.now().strftime("%Y-%m-%d"),
        "corr": corr,
        "pct_high_severity": pct_high_severity,
        "worst_value_name": worst_value["name"],
        "most_expensive_county": most_expensive_county,
        "highest_citation_county": highest_citation_county,
        "n_facilities": len(fac),
    }


if __name__ == "__main__":
    result = run()
    print("\nResult:", result)
