#!/usr/bin/env bash
set -euo pipefail

# StarlynnCare — Minnesota downstream parity orchestration.
#
# Runs the AI + photo enrichment stages that bring MN facilities to the same level
# as the CA pipeline (per docs/NEW_STATE_PLAYBOOK.md, "downstream parity").
#
# Upstream roster/inspection imports (run separately):
#
#     python3 scrapers/mn_mdh_directory_ingest.py --input .firecrawl/mn-scrape/facility-directory.xlsx
#     python3 scrapers/mn_inspections_ingest.py --import-json path/to/bundle.json
#
# Then run THIS script to fill in geocoding, AI summaries, AI tour questions, and photos.
#
# Usage:
#     ./scripts/ingest_mn.sh
#
# Requires .env.local with DATABASE_URL, ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY.

TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/ingest-MN-${TS}.log"

echo "== StarlynnCare ingest: Minnesota (downstream parity) ==" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 1) Geocode any MN facility missing lat/lon
PYTHONUNBUFFERED=1 python3 -u scrapers/geocode_facilities.py --state MN 2>&1 | tee -a "$LOG_FILE"

# 2) Recompute publishable from roster + inspection signals
PYTHONUNBUFFERED=1 python3 -u scrapers/recompute_publishable.py 2>&1 | tee -a "$LOG_FILE"

# 3) AI inspection summaries (MN system prompt; idempotent)
PYTHONUNBUFFERED=1 python3 -u scrapers/summarize_inspections.py --state MN 2>&1 | tee -a "$LOG_FILE"

# 4) AI tour questions + facility content (MN system prompt; idempotent)
PYTHONUNBUFFERED=1 python3 -u scrapers/generate_content.py --state MN 2>&1 | tee -a "$LOG_FILE"

# 5) Street View photos (MN; idempotent)
PYTHONUNBUFFERED=1 python3 -u scrapers/fetch_streetview.py --state MN 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "== Done: Minnesota downstream parity ==" | tee -a "$LOG_FILE"
