#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run_all.sh — Full end-to-end test suite runner for StarlynnCare
#
# Runs all test layers in order:
#   Layer A: External source health (requires internet)
#   Layer B: Known fixture field assertions (requires DATABASE_URL)
#   Layer C: Signal computation correctness (requires DATABASE_URL)
#   Layer D: Database structural integrity (requires DATABASE_URL)
#   Layer E: Per-state ingest completeness (requires DATABASE_URL)
#   Layer F: Direct Supabase query tests (requires NEXT_PUBLIC_SUPABASE_URL + key)
#   Layer G: API route integration tests (requires running server or production URL)
#
# Prerequisites:
#   pip install pytest pytest-timeout psycopg[binary] python-dotenv requests
#   npm install (project deps already include @supabase/supabase-js and tsx)
#
# Usage:
#   ./tests/run_all.sh                          # run all layers
#   ./tests/run_all.sh --skip-external          # skip Layer A (no internet)
#   ./tests/run_all.sh --only-db                # run only DB layers (B-E)
#   TEST_BASE_URL=https://preview.vercel.app ./tests/run_all.sh
#
# Exit codes:
#   0 = all tests passed
#   1 = one or more tests failed
# ---------------------------------------------------------------------------

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TESTS_DIR="$REPO_ROOT/tests"
SKIP_EXTERNAL=false
ONLY_DB=false

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --skip-external) SKIP_EXTERNAL=true ;;
    --only-db) ONLY_DB=true; SKIP_EXTERNAL=true ;;
  esac
done

OVERALL_EXIT=0
LAYER_RESULTS=()

run_layer() {
  local name="$1"
  local cmd="$2"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if eval "$cmd"; then
    LAYER_RESULTS+=("PASS  $name")
  else
    LAYER_RESULTS+=("FAIL  $name")
    OVERALL_EXIT=1
  fi
}

cd "$REPO_ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  StarlynnCare — Full End-to-End Test Suite"
echo "  $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Layer A — External source health (requires internet)
if [ "$SKIP_EXTERNAL" = false ]; then
  run_layer "Layer A: External Source Health (real API calls)" \
    "python3 -m pytest tests/test_external_sources.py -m external -v --timeout=60"
else
  echo ""
  echo "  SKIP  Layer A: External Source Health (--skip-external)"
  LAYER_RESULTS+=("SKIP  Layer A: External Source Health")
fi

# Layer B — Known fixture field assertions (requires DATABASE_URL)
run_layer "Layer B: Known Fixture Field Assertions (real DB)" \
  "python3 -m pytest tests/test_db_fixtures.py -m db -v"

# Layer C — Signal computation correctness
run_layer "Layer C: Signal Computation Correctness (real DB)" \
  "python3 -m pytest tests/test_signal_computation.py -m db -v"

# Layer D — Database structural integrity
run_layer "Layer D: Database Structural Integrity (real DB)" \
  "python3 -m pytest tests/test_db_integrity.py -m db -v"

# Layer E — Per-state ingest completeness
run_layer "Layer E: Per-State Ingest Completeness (real DB)" \
  "python3 -m pytest tests/test_ingest_completeness.py -m db -v"

# Layer F — Direct Supabase query tests (requires NEXT_PUBLIC_SUPABASE_URL + key)
if [ "$ONLY_DB" = false ]; then
  run_layer "Layer F: Direct Supabase Query Tests (real Supabase)" \
    "npx tsx tests/test_supabase_direct.ts"
fi

# Layer G — API route integration tests (requires live server)
if [ "$ONLY_DB" = false ]; then
  run_layer "Layer G: API Route Integration Tests (${TEST_BASE_URL:-https://starlynn.care})" \
    "npx tsx tests/test_api_routes.ts"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  FINAL RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for result in "${LAYER_RESULTS[@]}"; do
  echo "  $result"
done
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $OVERALL_EXIT
