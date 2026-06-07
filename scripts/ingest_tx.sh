#!/usr/bin/env bash
set -euo pipefail

# StarlynnCare — Texas downstream parity orchestration.
#
# Runs the AI + photo enrichment stages that bring TX facilities to the same level
# as the CA pipeline (per docs/NEW_STATE_PLAYBOOK.md, "downstream parity").
#
# This script intentionally DOES NOT run roster/inspection imports — those require
# manual Excel/JSON bundle inputs (HHSC ALF directory + TULIP/PIA inspection bundles).
# Run those upstream steps separately:
#
#     python3 scrapers/tx_alf_ingest.py --input ~/Desktop/al.xlsx
#     python3 scrapers/tx_inspections_ingest.py --import-json path/to/bundle.json
#
# Then run THIS script to fill in geocoding, AI summaries, AI tour questions, and photos.
#
# Usage:
#     ./scripts/ingest_tx.sh
#
# Requires .env.local with DATABASE_URL, ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY.

TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/ingest-TX-${TS}.log"

echo "== StarlynnCare ingest: Texas (downstream parity) ==" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 1) Geocode any TX facility missing lat/lon
PYTHONUNBUFFERED=1 python3 -u scrapers/geocode_facilities.py --state TX 2>&1 | tee -a "$LOG_FILE"

# 2) Recompute publishable from roster + inspection signals
PYTHONUNBUFFERED=1 python3 -u scrapers/recompute_publishable.py 2>&1 | tee -a "$LOG_FILE"

# 3) AI inspection summaries (TX system prompt; idempotent — only un-summarized rows)
PYTHONUNBUFFERED=1 python3 -u scrapers/summarize_inspections.py --state TX 2>&1 | tee -a "$LOG_FILE"

# 4) AI tour questions + facility content (TX system prompt; idempotent — only missing content)
PYTHONUNBUFFERED=1 python3 -u scrapers/generate_content.py --state TX 2>&1 | tee -a "$LOG_FILE"

# 5) Street View photos (TX; idempotent — only missing photo_url)
PYTHONUNBUFFERED=1 python3 -u scrapers/fetch_streetview.py --state TX 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "== Done: Texas downstream parity ==" | tee -a "$LOG_FILE"
