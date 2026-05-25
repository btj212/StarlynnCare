#!/usr/bin/env bash
# PA Data Rebuild — Full Universe Run
# Run from repo root: bash scripts/pa_overnight_run.sh
# Logs to logs/pa_overnight_<timestamp>.log
#
# Prerequisites:
#   1. Migration 0044_pa_universe.sql applied in Supabase
#   2. PA DHS HSD bulk export saved at scrapers/data/pa_hsd_full.xlsx
#      (re-pull with `python3 scrapers/pa_hsd_directory_ingest.py --fetch-live`)
#   3. DATABASE_URL set in .env.local
#   4. ANTHROPIC_API_KEY set in .env.local (for PDF parse step)
#
# Phase sequencing per scrapers/pa-memory-care-data-methodology.md Section 9:
#   Phase 1: DHS XLSX → facilities (1,057 OLTL, 365 publishable starting set)
#   Phase 2: CMS NF overlay (~666 PA nursing facilities)
#   Phase 3: Inspection portal scrape — seed inspections + pa_pdf_inventory
#   Phase 4: PDF pipeline — download → parse (Claude Haiku) → backfill deficiencies
#   Phase 5: recompute_publishable (PA gate: mc_designation_type OR ALR-SC + 36-mo freshness)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
LOGFILE="$LOG_DIR/pa_overnight_$(date +%Y%m%d_%H%M%S).log"
DATA_DIR="$REPO_ROOT/scrapers/data"

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

# ─── Step 1: PA DHS HSD bulk export → facilities ────────────────────────────
step 1 "PA DHS HSD bulk export — upsert OLTL facilities (1,057 rows, 365 MC)"
if [[ -f "$DATA_DIR/pa_hsd_full.xlsx" ]]; then
  python3 -u scrapers/pa_hsd_directory_ingest.py --input "$DATA_DIR/pa_hsd_full.xlsx" \
    || warn "pa_hsd_directory_ingest failed (continuing)"
  ok "PA DHS HSD directory done"
else
  warn "pa_hsd_full.xlsx not found — falling back to live DHS fetch"
  python3 -u scrapers/pa_hsd_directory_ingest.py --fetch-live \
    || warn "pa_hsd_directory_ingest --fetch-live failed (continuing)"
  ok "PA DHS HSD live fetch done"
fi

# ─── Step 2: CMS NH Directory — PA nursing homes ────────────────────────────
step 2 "CMS NH Directory — PA nursing homes (~666 NFs)"
python3 -u scrapers/cms_nh_directory_ingest.py --state PA \
  || warn "cms_nh_directory_ingest failed (continuing)"
ok "CMS NH directory done"

# ─── Step 3: CMS NH Deficiencies — F-tags + scope/severity ─────────────────
step 3 "CMS NH Deficiencies — F-tags for PA nursing homes"
python3 -u scrapers/cms_nh_deficiencies_ingest.py --state PA \
  || warn "cms_nh_deficiencies_ingest failed (continuing)"
ok "CMS NH deficiencies done"

# ─── Step 4: PA inspection portal scrape — seed inspections + pa_pdf_inventory ──
step 4 "PA DHS inspection portal — scrape per-facility HTML, seed pa_pdf_inventory"
python3 -u scrapers/pa_dhs_inspections_scraper.py \
  || warn "pa_dhs_inspections_scraper failed (continuing)"
ok "Inspection portal scrape done"

# ─── Step 5: First recompute_publishable (pre-PDF) ──────────────────────────
step 5 "Recompute serves_memory_care + publishable — PA (pre-PDF pass)"
python3 -u scrapers/recompute_publishable.py --state PA \
  || warn "recompute_publishable pre-PDF failed (continuing)"
ok "Pre-PDF recompute done"

# ─── Step 6: PDF Download ───────────────────────────────────────────────────
step 6 "PDF Download — walk pa_pdf_inventory, cache to .firecrawl/pa-pdfs/"
python3 -u scrapers/pa_pdf_download.py \
  || warn "pa_pdf_download failed (continuing)"
ok "PDF download done"

# ─── Step 7: PDF Parse (OCR + Claude Haiku) ─────────────────────────────────
step 7 "PDF Parse — triage digital/scanned, OCR, Claude Haiku normalization (PA vocab)"
python3 -u scrapers/pa_pdf_parse.py \
  || warn "pa_pdf_parse failed (continuing)"
ok "PDF parse done"

# ─── Step 8: PDF Backfill — write deficiencies from sidecars ────────────────
step 8 "PDF Backfill — write deficiencies + total_deficiency_count, PA severity integers"
python3 -u scrapers/pa_pdf_backfill.py \
  || warn "pa_pdf_backfill failed (continuing)"
ok "PDF backfill done"

# ─── Step 9: Final recompute_publishable ────────────────────────────────────
step 9 "Final recompute — PA (picks up has_inspection_text from backfill + 36-mo freshness)"
python3 -u scrapers/recompute_publishable.py --state PA \
  || warn "final recompute failed (continuing)"
ok "Final recompute done"

# ─── Done ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  PA OVERNIGHT RUN COMPLETE"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Log: $LOGFILE"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Verify with:"
echo "  select count(*) from facilities where state_code='PA' and publishable=true;  -- expect ≈ 515"
echo "  select license_type, count(*) from facilities"
echo "    where state_code='PA' and serves_memory_care=true group by 1;"
echo "  select state_severity_raw, severity, immediate_jeopardy, count(*)"
echo "    from deficiencies d join inspections i on i.id=d.inspection_id"
echo "    join facilities f on f.id=i.facility_id where f.state_code='PA'"
echo "    group by 1,2,3 order by 2 desc;"
echo ""
echo "Reference facilities (from pa-memory-care-data-methodology.md Section 6.3):"
echo "  Rittenhouse Village at Lehigh Valley   (license 223010, URL id 22301)"
echo "  Serenity Gardens at Mount Carmel       (license 231010, URL id 23101)"
echo "  Cambridge Village Personal Care Home   (license 456560, URL id 45656)"
echo ""
echo "  select id, name, mc_designation_type, secure_beds, publishable"
echo "    from facilities where state_code='PA'"
echo "      and external_id in ('223010','231010','456560');"
