#!/usr/bin/env bash
set -euo pipefail

# Ingest one CA county end-to-end.
#
# Usage:
#   ./scripts/ingest_county.sh "CONTRA COSTA"
#
# Requires .env.local with DATABASE_URL, ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY.

COUNTY="${1:-}"
if [[ -z "$COUNTY" ]]; then
  echo "Usage: $0 \"COUNTY_NAME\" (e.g. \"CONTRA COSTA\")" >&2
  exit 1
fi

COUNTY_UPPER="$(echo "$COUNTY" | tr '[:lower:]' '[:upper:]')"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/ingest-${COUNTY_UPPER// /-}-${TS}.log"

echo "== StarlynnCare ingest: $COUNTY_UPPER ==" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 1) Roster
PYTHONUNBUFFERED=1 python3 -u scrapers/ccld_rcfe_ingest.py --county "$COUNTY_UPPER" --force-publish 2>&1 | tee -a "$LOG_FILE"

# 2) Geocode (statewide missing lat/lon)
PYTHONUNBUFFERED=1 python3 -u scrapers/geocode_facilities.py --state CA 2>&1 | tee -a "$LOG_FILE"

# 3) Inspections + deficiencies (statewide; skips already-ingested inspections by source_url)
PYTHONUNBUFFERED=1 python3 -u scrapers/ccld_citations_ingest.py --state CA 2>&1 | tee -a "$LOG_FILE"

# 4) Memory-care disclosure flags (from §87705/§87706 citations)
PYTHONUNBUFFERED=1 python3 -u scrapers/mc_disclosure_ingest.py 2>&1 | tee -a "$LOG_FILE"

# 5) Narrative summaries (only missing summaries by default)
PYTHONUNBUFFERED=1 python3 -u scrapers/summarize_inspections.py --state CA 2>&1 | tee -a "$LOG_FILE"

# 6) Tour questions (Haiku + quality gate; skips facilities with existing content by default)
PYTHONUNBUFFERED=1 python3 -u scrapers/generate_content.py 2>&1 | tee -a "$LOG_FILE"

# 7) Photos (Street View; only missing photo_url by default)
PYTHONUNBUFFERED=1 python3 -u scrapers/fetch_streetview.py --state CA 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "== Done: $COUNTY_UPPER ==" | tee -a "$LOG_FILE"

