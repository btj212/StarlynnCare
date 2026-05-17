#!/usr/bin/env bash
# OR Data Rebuild — Repair Run (steps 4–15)
#
# Run this after or_overnight_run.sh has completed steps 1–3 successfully:
#   - Providers upserted (facilities table populated for OR)
#   - CMS NH directory overlay done
#   - CMS NH deficiencies done
#
# This script runs ONLY the failed/pending steps in the correct order.
# Safe to re-run: providers/CMS steps are not repeated.
#
# Usage:
#   bash scripts/or_repair_run.sh
#
# Prerequisites:
#   data/or_inspections.csv
#   data/or_violations.csv
#   data/or_regulatory_actions.csv

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
LOGFILE="$LOG_DIR/or_repair_$(date +%Y%m%d_%H%M%S).log"
DATA_DIR="$REPO_ROOT/data"

mkdir -p "$LOG_DIR"

exec > >(tee -a "$LOGFILE") 2>&1

cd "$REPO_ROOT"

step() {
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "  STEP $1: $2"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "════════════════════════════════════════════════════════════"
}

ok()   { echo "  ✓ $1"; }
warn() { echo "  ⚠ $1" >&2; }
skip() { echo "  — $1 (skipped — file not found)"; }

# ─── Step 4: OR Inspections CSV ─────────────────────────────────────────────
step 4 "OR Inspections CSV — seed inspections"
if [[ -f "$DATA_DIR/or_inspections.csv" ]]; then
  python3 scrapers/or_inspections_ingest.py --input "$DATA_DIR/or_inspections.csv" \
    || warn "or_inspections_ingest failed (continuing)"
  ok "Inspections done"
else
  skip "or_inspections.csv not found"
fi

# ─── Step 5: OR Violations CSV ──────────────────────────────────────────────
step 5 "OR Violations CSV → deficiencies"
if [[ -f "$DATA_DIR/or_violations.csv" ]]; then
  python3 scrapers/or_violations_ingest.py --input "$DATA_DIR/or_violations.csv" \
    || warn "or_violations_ingest failed (continuing)"
  ok "Violations done"
else
  skip "or_violations.csv not found"
fi

# ─── Step 6: OR Regulatory Actions CSV ──────────────────────────────────────
step 6 "OR Regulatory Actions CSV — civil penalties + enhanced oversight"
if [[ -f "$DATA_DIR/or_regulatory_actions.csv" ]]; then
  python3 scrapers/or_regulatory_actions_ingest.py --input "$DATA_DIR/or_regulatory_actions.csv" \
    || warn "or_regulatory_actions_ingest failed (continuing)"
  ok "Regulatory actions done"
else
  skip "or_regulatory_actions.csv not found"
fi

# ─── Step 7: MCE Signal ─────────────────────────────────────────────────────
step 7 "OR Signal: MCE endorsement cross-reference"
python3 scrapers/or_signal_mce.py \
  || warn "or_signal_mce failed (continuing)"
ok "MCE signal done"

# ─── Step 8: Enhanced Oversight Signal ──────────────────────────────────────
step 8 "OR Signal: Enhanced Oversight (APD Updates page)"
python3 scrapers/or_signal_enhanced_oversight.py \
  || warn "or_signal_enhanced_oversight failed (continuing)"
ok "Enhanced oversight signal done"

# ─── Step 9: AFH Detail Pages ────────────────────────────────────────────────
step 9 "OR AFH Detail pages — afh_class via AJAX"
python3 scrapers/or_afh_detail.py \
  || warn "or_afh_detail failed (continuing)"
ok "AFH detail done"

# ─── Step 10: First recompute_publishable (pre-PDF) ─────────────────────────
step 10 "Recompute serves_memory_care + publishable — OR (pre-PDF pass)"
python3 scrapers/recompute_publishable.py --state OR \
  || warn "recompute_publishable pre-PDF failed (continuing)"
ok "Pre-PDF recompute done"

# ─── Step 11: PDF Download ───────────────────────────────────────────────────
step 11 "PDF Download — walk or_pdf_inventory"
python3 scrapers/or_pdf_download.py \
  || warn "or_pdf_download failed (continuing)"
ok "PDF download done"

# ─── Step 12: PDF Parse ──────────────────────────────────────────────────────
step 12 "PDF Parse — Claude Haiku normalization"
python3 scrapers/or_pdf_parse.py \
  || warn "or_pdf_parse failed (continuing)"
ok "PDF parse done"

# ─── Step 13: PDF Backfill ───────────────────────────────────────────────────
step 13 "PDF Backfill — write severity integers from sidecars"
python3 scrapers/or_pdf_backfill.py \
  || warn "or_pdf_backfill failed (continuing)"
ok "PDF backfill done"

# ─── Step 14: Unendorsed MC Flag ────────────────────────────────────────────
step 14 "ORS 443.886(6) flag — 'Memory Care' in name without MCE endorsement"
python3 scrapers/or_flag_unendorsed_mc.py \
  || warn "or_flag_unendorsed_mc failed (continuing)"
ok "Unendorsed MC flag done"

# ─── Step 15: Final recompute ────────────────────────────────────────────────
step 15 "Final recompute — OR"
python3 scrapers/recompute_publishable.py --state OR \
  || warn "final recompute failed (continuing)"
ok "Final recompute done"

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  REPAIR RUN COMPLETE"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Log: $LOGFILE"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Verify in Supabase:"
echo "  select count(*) from facilities where state_code='OR' and publishable=true;"
echo "  select count(*) from inspections i join facilities f on f.id=i.facility_id where f.state_code='OR';"
echo "  select count(*) from deficiencies d join inspections i on i.id=d.inspection_id join facilities f on f.id=i.facility_id where f.state_code='OR';"
