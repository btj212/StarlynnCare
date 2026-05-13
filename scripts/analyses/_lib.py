"""Shared helpers for StarlynnCare offline analyses."""
from __future__ import annotations

import os
from pathlib import Path
from datetime import datetime

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

TEAL = "#1B6B62"
RUST = "#C0392B"
NEUTRAL = "#6B6B6B"
YELLOW = "#E8A838"
GREEN = "#2ECC71"

PALETTE = {
    "primary": TEAL,
    "secondary": RUST,
    "neutral": NEUTRAL,
    "yellow": YELLOW,
    "green": GREEN,
}

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_env() -> None:
    env_file = REPO_ROOT / ".env.local"
    if not env_file.exists():
        return
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key not in os.environ:
                os.environ[key] = value


def get_conn():
    """Return a psycopg connection using DATABASE_URL from .env.local."""
    import psycopg

    _load_env()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not found in .env.local or environment")
    return psycopg.connect(db_url)


def apply_chart_style(ax: plt.Axes) -> None:
    """Apply consistent editorial styling to a matplotlib Axes."""
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#DDDDDD")
    ax.spines["bottom"].set_color("#DDDDDD")
    ax.tick_params(colors="#444444", labelsize=9)
    ax.yaxis.label.set_color("#444444")
    ax.xaxis.label.set_color("#444444")
    ax.title.set_color("#1A1A1A")
    ax.set_facecolor("#FAFAFA")
    ax.figure.patch.set_facecolor("white")


def save_chart(fig: plt.Figure, output_dir: Path, name: str) -> None:
    """Save a matplotlib figure as both PNG and HTML (via plotly fallback)."""
    output_dir.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    png_path = output_dir / f"{name}.png"
    fig.savefig(png_path, dpi=150, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def save_plotly_chart(fig, output_dir: Path, name: str) -> None:
    """Save a plotly figure as HTML."""
    import plotly.io as pio

    output_dir.mkdir(parents=True, exist_ok=True)
    html_path = output_dir / f"{name}.html"
    pio.write_html(fig, str(html_path), include_plotlyjs="cdn")


def write_findings(findings: dict, summary: str, output_dir: Path) -> None:
    """Write a structured findings.md into output_dir."""
    output_dir.mkdir(parents=True, exist_ok=True)
    lines = ["## Key Findings\n"]
    for key, value in findings.items():
        lines.append(f"- **{key}**: {value}")
    lines.append("")
    lines.append("## Editorial Summary")
    lines.append("")
    lines.append(summary)
    lines.append("")
    lines.append(f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
    path = output_dir / "findings.md"
    path.write_text("\n".join(lines))
    print(f"  Findings written → {path}")


def format_number(n: int | float, prefix: str = "", suffix: str = "") -> str:
    """Format a number as '1,234' or '$1.2K' etc."""
    if n is None:
        return "N/A"
    try:
        n = float(n)
    except (TypeError, ValueError):
        return str(n)
    if abs(n) >= 1_000_000:
        return f"{prefix}{n / 1_000_000:.1f}M{suffix}"
    if abs(n) >= 1_000:
        return f"{prefix}{n / 1_000:.1f}K{suffix}"
    if n == int(n):
        return f"{prefix}{int(n):,}{suffix}"
    return f"{prefix}{n:,.1f}{suffix}"


def severity_color(index: float) -> str:
    """Return a color based on a severity_index value."""
    if index == 0:
        return GREEN
    if index < 1:
        return "#A8D5A2"
    if index < 3:
        return YELLOW
    if index < 6:
        return RUST
    return "#8B0000"
