#!/usr/bin/env bash
# ut_overnight_run.sh — Full Utah data pipeline
#
# Phases:
#   1. UGRC ArcGIS facilities ingest (all 891 UT facilities, no auth needed)
#   2. CMS NF overlay (deficiencies for 21 NFs with secured beds)
#   3. CCL inspection scraper (Playwright; requires network to intercept token)
#   4. Recompute publishable flags
#
# Run from repo root:
#   bash scripts/ut_overnight_run.sh 2>&1 | tee logs/ut_run_$(date +%Y%m%d_%H%M%S).log
#
# Prerequisites:
#   pip install playwright && playwright install chromium

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

echo "========================================================"
echo " Utah Memory Care Pipeline — $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "========================================================"

# Phase 1: UGRC ArcGIS facilities (all 891)
echo ""
echo "--- Phase 1: UGRC ArcGIS Facilities Ingest ---"
python3 -u scrapers/ut_arcgis_facilities_ingest.py

# Phase 2: CMS NF overlay (21 NFs with secure beds)
echo ""
echo "--- Phase 2: CMS Nursing Home Overlay ---"
python3 -u scrapers/ut_cms_nh_overlay.py

# Phase 3: CCL inspection scraper
# NOTE: If the Playwright token capture fails (OAuth-gated), this step will
# exit with an informative message. CMS data from Phase 2 covers NF inspections.
# ALF inspection records require either a working CCL session token or a GRAMA request.
echo ""
echo "--- Phase 3: CCL Inspections Scraper ---"
python3 -u scrapers/ut_ccl_inspections_scraper.py || {
  echo "WARNING: CCL scraper failed or token not captured. Continuing without ALF inspections."
  echo "  - CMS NF deficiencies (Phase 2) are unaffected."
  echo "  - Submit GRAMA request for ALF inspection records if CCL API remains gated."
}

# Phase 4: Recompute publishable flags
echo ""
echo "--- Phase 4: Recompute Publishable ---"
python3 -u scrapers/recompute_publishable.py --state UT

echo ""
echo "========================================================"
echo " Utah pipeline complete — $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "========================================================"
