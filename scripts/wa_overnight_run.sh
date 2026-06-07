#!/usr/bin/env bash
# WA Data Capture Rebuild — Overnight Sequential Run
# Run from repo root: bash scripts/wa_overnight_run.sh
# Logs to logs/wa_overnight_<timestamp>.log

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
LOGFILE="$LOG_DIR/wa_overnight_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

# Tee everything to log + stdout
exec > >(tee -a "$LOGFILE") 2>&1

cd "$REPO_ROOT"

step() {
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "  STEP $1: $2"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "════════════════════════════════════════════════════════════"
}

ok() { echo "  ✓ $1"; }
warn() { echo "  ⚠ $1" >&2; }

# ─── 1. Universe: WA Geo (AFH/ALF/ESF) ─────────────────────────────────────
step 1 "WA Geo Open Data — AFH/ALF/ESF universe"
python3 scrapers/wa_geo_directory_ingest.py || warn "wa_geo_directory_ingest failed (continuing)"
ok "Geo universe done"

# ─── 2. Universe: CMS Nursing Homes ─────────────────────────────────────────
step 2 "CMS NH Directory — WA nursing homes"
python3 scrapers/cms_nh_directory_ingest.py --state WA || warn "cms_nh_directory_ingest failed (continuing)"
ok "CMS NH directory done"

# ─── 3. CMS NH Deficiencies (structured, no PDF needed) ─────────────────────
step 3 "CMS NH Deficiencies — F-tags + scope/severity"
python3 scrapers/cms_nh_deficiencies_ingest.py --state WA || warn "cms_nh_deficiencies_ingest failed (continuing)"
ok "CMS NH deficiencies done"

# ─── 4. MC Signals ──────────────────────────────────────────────────────────
step 4 "WA Signal: EARC-SDC / SDCP contract"
python3 scrapers/wa_signal_sdcp.py || warn "wa_signal_sdcp failed (continuing)"
ok "SDCP signal done"

step 5 "WA Signal: Dementia specialty designation (BH + AFH lookup)"
python3 scrapers/wa_signal_dementia_specialty.py || warn "wa_signal_dementia_specialty failed (continuing)"
ok "Dementia specialty signal done"

# Note: wa_signal_memory_care_cert.py requires a CSV from DSHS — skip for now
echo "  (wa_signal_memory_care_cert.py skipped — requires manual CSV from DSHS)"

# ─── 5. AFH directory + inspection PDF seeding ──────────────────────────────
step 6 "WA AFH directory ingest (skip Geo — already done in step 1)"
python3 scrapers/wa_afh_directory_ingest.py --skip-geo || warn "wa_afh_directory_ingest failed (continuing)"
ok "AFH directory done"

step 7 "WA AFH inspections scrape — seed wa_pdf_inventory"
python3 scrapers/wa_afh_inspections_scrape.py || warn "wa_afh_inspections_scrape failed (continuing)"
ok "AFH inspection PDF links seeded"

# ─── 6. ESF ingest ──────────────────────────────────────────────────────────
step 8 "WA ESF ingest (skip Geo — already done in step 1)"
python3 scrapers/wa_esf_ingest.py --skip-geo || warn "wa_esf_ingest failed (continuing)"
ok "ESF ingest done"

# ─── 7. Publishable recompute (with new signals) ────────────────────────────
step 9 "Recompute serves_memory_care + publishable — WA"
python3 scrapers/recompute_publishable.py --state WA || warn "recompute_publishable failed (continuing)"
ok "Publishable recompute done"

# ─── 8. PDF pipeline (longest step — existing ALFs + new AFHs/ESFs) ─────────
step 10 "PDF Download — walk wa_pdf_inventory, cache to .firecrawl/wa-pdfs/"
python3 scrapers/wa_pdf_download.py || warn "wa_pdf_download failed (continuing)"
ok "PDF download done"

step 11 "PDF Parse — triage digital/scanned, OCR, Claude Haiku normalization"
python3 scrapers/wa_pdf_parse.py || warn "wa_pdf_parse failed (continuing)"
ok "PDF parse done"

step 12 "PDF Backfill — replace placeholder deficiencies, rebuild narratives, rescore"
python3 scrapers/wa_pdf_backfill.py --rescore || warn "wa_pdf_backfill failed (continuing)"
ok "PDF backfill done"

# ─── 9. Final publishable recompute (has_inspection_text updated by backfill) ─
step 13 "Final recompute — WA (picks up has_inspection_text from backfill)"
python3 scrapers/recompute_publishable.py --state WA || warn "final recompute failed (continuing)"
ok "Final recompute done"

# ─── Done ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  OVERNIGHT RUN COMPLETE"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Log: $LOGFILE"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Next: apply migration 0029 in Supabase SQL Editor (if not done),"
echo "then open the log to review any warnings."
echo ""
echo "Verify with:"
echo "  python3 scripts/audit/facility_data_validity.py --state WA --write-report"
