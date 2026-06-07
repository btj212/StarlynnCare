#!/usr/bin/env bash
# OR Data Rebuild — Full Universe Overnight Sequential Run
# Run from repo root: bash scripts/or_overnight_run.sh
# Logs to logs/or_overnight_<timestamp>.log
#
# Prerequisites:
#   1. Migration 0033_or_universe.sql applied in Supabase
#   2. CSV exports downloaded from ltclicensing.oregon.gov:
#        data/or_providers.csv
#        data/or_inspections.csv
#        data/or_violations.csv
#        data/or_regulatory_actions.csv
#   3. DATABASE_URL set in .env.local
#   4. ANTHROPIC_API_KEY set in .env.local (for PDF parse step)
#
# Phase sequencing per plan Section 9:
#   Phase 1: Bulk CSV → facilities + inspections + deficiencies + regulatory actions
#   Phase 2: CMS NF overlay, Signal scrapers
#   Phase 3: PDF pipeline
#   Final:   recompute_publishable (2× — before PDF for serves_mc; after for has_inspection_text)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
LOGFILE="$LOG_DIR/or_overnight_$(date +%Y%m%d_%H%M%S).log"
DATA_DIR="$REPO_ROOT/data"

mkdir -p "$LOG_DIR" "$DATA_DIR"

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

# ─── Step 1: OR Providers CSV → facilities ──────────────────────────────────
step 1 "OR Providers CSV — upsert facilities (external_id verbatim)"
if [[ -f "$DATA_DIR/or_providers.csv" ]]; then
  python3 scrapers/or_providers_ingest.py --input "$DATA_DIR/or_providers.csv" \
    || warn "or_providers_ingest failed (continuing)"
  ok "Providers done"
else
  skip "or_providers.csv not found — download from ltclicensing.oregon.gov/Providers"
fi

# ─── Step 2: CMS NH Directory — OR nursing homes ────────────────────────────
step 2 "CMS NH Directory — OR nursing homes"
python3 scrapers/cms_nh_directory_ingest.py --state OR \
  || warn "cms_nh_directory_ingest failed (continuing)"
ok "CMS NH directory done"

# ─── Step 3: CMS NH Deficiencies — F-tags + scope/severity ─────────────────
step 3 "CMS NH Deficiencies — F-tags for OR nursing homes"
python3 scrapers/cms_nh_deficiencies_ingest.py --state OR \
  || warn "cms_nh_deficiencies_ingest failed (continuing)"
ok "CMS NH deficiencies done"

# ─── Step 4: OR Inspections CSV → inspections + seed or_pdf_inventory ───────
step 4 "OR Inspections CSV — seed inspections + or_pdf_inventory"
if [[ -f "$DATA_DIR/or_inspections.csv" ]]; then
  python3 scrapers/or_inspections_ingest.py --input "$DATA_DIR/or_inspections.csv" \
    || warn "or_inspections_ingest failed (continuing)"
  ok "Inspections done"
else
  skip "or_inspections.csv not found"
fi

# ─── Step 5: OR Violations CSV → deficiencies ───────────────────────────────
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
step 7 "OR Signal: MCE endorsement (CSS portal + name pattern)"
python3 scrapers/or_signal_mce.py \
  || warn "or_signal_mce failed (continuing)"
ok "MCE signal done"

# ─── Step 8: Enhanced Oversight Signal ──────────────────────────────────────
step 8 "OR Signal: Enhanced Oversight (APD Updates page)"
python3 scrapers/or_signal_enhanced_oversight.py \
  || warn "or_signal_enhanced_oversight failed (continuing)"
ok "Enhanced oversight signal done"

# ─── Step 9: AFH Detail Pages — afh_class + detail_url_id ───────────────────
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
step 11 "PDF Download — walk or_pdf_inventory, cache to .firecrawl/or-pdfs/"
python3 scrapers/or_pdf_download.py \
  || warn "or_pdf_download failed (continuing)"
ok "PDF download done"

# ─── Step 12: PDF Parse (OCR + Claude Haiku) ────────────────────────────────
step 12 "PDF Parse — triage digital/scanned, OCR, Claude Haiku normalization (OR vocab)"
python3 scrapers/or_pdf_parse.py \
  || warn "or_pdf_parse failed (continuing)"
ok "PDF parse done"

# ─── Step 13: PDF Backfill — write deficiencies from sidecars ───────────────
step 13 "PDF Backfill — replace placeholder deficiencies, write OR severity integers"
python3 scrapers/or_pdf_backfill.py \
  || warn "or_pdf_backfill failed (continuing)"
ok "PDF backfill done"

# ─── Step 14: Unendorsed MC Flag ────────────────────────────────────────────
step 14 "ORS 443.886(6) flag — 'Memory Care' in name without MCE endorsement"
python3 scrapers/or_flag_unendorsed_mc.py \
  || warn "or_flag_unendorsed_mc failed (continuing)"
ok "Unendorsed MC flag done"

# ─── Step 15: Final recompute_publishable ───────────────────────────────────
step 15 "Final recompute — OR (picks up has_inspection_text from backfill)"
python3 scrapers/recompute_publishable.py --state OR \
  || warn "final recompute failed (continuing)"
ok "Final recompute done"

# ─── Done ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  OVERNIGHT RUN COMPLETE"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Log: $LOGFILE"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Verify with:"
echo "  select count(*) from facilities where state_code='OR' and publishable=true;"
echo "  select state_severity_raw, severity, count(*) from deficiencies d"
echo "    join inspections i on i.id=d.inspection_id"
echo "    join facilities f on f.id=i.facility_id"
echo "    where f.state_code='OR' group by 1,2 order by 2 desc;"
echo ""
echo "Reference facility — Crystal Terrace (external_id=50M300, MCE-endorsed):"
echo "  select id, name, mce_endorsed, mce_evidence, publishable"
echo "    from facilities where state_code='OR' and external_id='50M300';"
echo ""
echo "If PDFs are newly parsed, also apply migration 0034_or_severity_backfill.sql"
echo "to backfill severity integers on any deficiencies written before this run."
