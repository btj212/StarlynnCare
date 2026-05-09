#!/usr/bin/env bash
set -euo pipefail

# StarlynnCare — Washington downstream parity orchestration.
#
# Runs the AI + photo enrichment stages that bring WA facilities to the same level
# as the CA pipeline (per docs/NEW_STATE_PLAYBOOK.md, "downstream parity").
#
# Upstream roster/inspection imports (run separately):
#
#     python3 scrapers/wa_dshs_directory_ingest.py --input .firecrawl/wa-scrape/adv-lookup.csv
#     python3 scrapers/wa_inspections_ingest.py --import-json path/to/bundle.json
#
# Then run THIS script to fill in geocoding, AI summaries, AI tour questions, and photos.
#
# Usage:
#     ./scripts/ingest_wa.sh
#
# Requires .env.local with DATABASE_URL, ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY.

TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/ingest-WA-${TS}.log"

echo "== StarlynnCare ingest: Washington (downstream parity) ==" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 1) Geocode any WA facility missing lat/lon
PYTHONUNBUFFERED=1 python3 -u scrapers/geocode_facilities.py --state WA 2>&1 | tee -a "$LOG_FILE"

# 2) Recompute publishable from roster + inspection signals
PYTHONUNBUFFERED=1 python3 -u scrapers/recompute_publishable.py 2>&1 | tee -a "$LOG_FILE"

# 3) AI inspection summaries (WA system prompt; idempotent)
PYTHONUNBUFFERED=1 python3 -u scrapers/summarize_inspections.py --state WA 2>&1 | tee -a "$LOG_FILE"

# 4) AI tour questions + facility content (WA system prompt; idempotent)
PYTHONUNBUFFERED=1 python3 -u scrapers/generate_content.py --state WA 2>&1 | tee -a "$LOG_FILE"

# 5) Street View photos (WA; idempotent)
PYTHONUNBUFFERED=1 python3 -u scrapers/fetch_streetview.py --state WA 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "== Done: Washington downstream parity ==" | tee -a "$LOG_FILE"
