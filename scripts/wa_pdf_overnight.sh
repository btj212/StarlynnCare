#!/usr/bin/env bash
# Run the full WA PDF pipeline: download → parse → backfill → recompute
# Expected runtime: ~45-60 min for ~1835 PDFs at 1 req/sec
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO/.firecrawl/wa-pdfs/logs"
mkdir -p "$LOG_DIR"
TS=$(date +%Y%m%d_%H%M%S)

cd "$REPO"

echo "=== WA PDF overnight run $TS ===" | tee "$LOG_DIR/run_$TS.log"

echo "[1/3] Downloading remaining PDFs…" | tee -a "$LOG_DIR/run_$TS.log"
python3 -u scrapers/wa_pdf_download.py 2>&1 | tee -a "$LOG_DIR/run_$TS.log"

echo "[2/3] Parsing downloaded PDFs…" | tee -a "$LOG_DIR/run_$TS.log"
python3 -u scrapers/wa_pdf_parse.py 2>&1 | tee -a "$LOG_DIR/run_$TS.log"

echo "[3/3] Backfilling deficiencies + recomputing publishable…" | tee -a "$LOG_DIR/run_$TS.log"
python3 -u scrapers/wa_pdf_backfill.py 2>&1 | tee -a "$LOG_DIR/run_$TS.log"
python3 -u scrapers/recompute_publishable.py 2>&1 | tee -a "$LOG_DIR/run_$TS.log"

echo "Done at $(date)" | tee -a "$LOG_DIR/run_$TS.log"
