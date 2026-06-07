#!/usr/bin/env bash
set -euo pipefail

# Overnight ingest for the 3-county Bay Area expansion.
#
# Important: only run the expensive downstream stages ONCE after all three
# county rosters are ingested, otherwise citations/summaries/content would
# re-scan the whole CA dataset three times.

TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/ingest-BAY-AREA-3COUNTIES-${TS}.log"

echo "== StarlynnCare ingest: Bay Area (3 counties) ==" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ── Rosters (county-scoped) ────────────────────────────────────────────────
PYTHONUNBUFFERED=1 python3 -u scrapers/ccld_rcfe_ingest.py --county "CONTRA COSTA" --force-publish 2>&1 | tee -a "$LOG_FILE"
PYTHONUNBUFFERED=1 python3 -u scrapers/ccld_rcfe_ingest.py --county "SAN MATEO" --force-publish 2>&1 | tee -a "$LOG_FILE"
PYTHONUNBUFFERED=1 python3 -u scrapers/ccld_rcfe_ingest.py --county "SANTA CLARA" --force-publish 2>&1 | tee -a "$LOG_FILE"

# ── Downstream stages (CA-wide, idempotent) ────────────────────────────────
PYTHONUNBUFFERED=1 python3 -u scrapers/geocode_facilities.py --state CA 2>&1 | tee -a "$LOG_FILE"
PYTHONUNBUFFERED=1 python3 -u scrapers/ccld_citations_ingest.py 2>&1 | tee -a "$LOG_FILE"
PYTHONUNBUFFERED=1 python3 -u scrapers/mc_disclosure_ingest.py 2>&1 | tee -a "$LOG_FILE"
PYTHONUNBUFFERED=1 python3 -u scrapers/summarize_inspections.py 2>&1 | tee -a "$LOG_FILE"
PYTHONUNBUFFERED=1 python3 -u scrapers/generate_content.py 2>&1 | tee -a "$LOG_FILE"
PYTHONUNBUFFERED=1 python3 -u scrapers/fetch_streetview.py --state CA 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "== Done: Bay Area (3 counties) ==" | tee -a "$LOG_FILE"

