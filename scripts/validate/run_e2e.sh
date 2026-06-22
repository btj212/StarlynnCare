#!/usr/bin/env bash
# =============================================================================
# StarlynnCare — Complete E2E Test Suite Runner
#
# Runs all validation layers in dependency order:
#   Layer 0  — Source API integrity (real government APIs, no DB needed)
#   Layer 1  — DB invariants (aggregate stats, peer ranking)
#   Layer 2  — DB row shape (per-row field completeness, FK integrity)
#   Layer 5  — Post-ingest checks (per-state freshness, rank distribution)
#   Layer 5b — Hub content drift audit
#   Layer 4  — API route integration (live /api/facilities/* endpoints)
#   E2E      — Soup-to-nuts pipeline (DB → RPC → API → page HTML → watch)
#
# Usage:
#   ./scripts/validate/run_e2e.sh
#   ./scripts/validate/run_e2e.sh --base-url http://localhost:3000
#   ./scripts/validate/run_e2e.sh --state CA
#   ./scripts/validate/run_e2e.sh --skip-layer4      # skip live API tests
#   ./scripts/validate/run_e2e.sh --skip-e2e         # skip full E2E (faster)
#   ./scripts/validate/run_e2e.sh --skip-layer0      # skip source API tests
#
# Requirements:
#   - DATABASE_URL set (or .env.local in repo root)
#   - python3 with: psycopg, requests, python-dotenv, openpyxl
#   - For Layer 4 and E2E: running dev server or BASE_URL pointing at production
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VALIDATE_DIR="$REPO_ROOT/scripts/validate"

# ── Defaults ──────────────────────────────────────────────────────────────────
BASE_URL="${BASE_URL:-https://www.starlynncare.com}"
STATE_FILTER=""
SKIP_LAYER0=false
SKIP_LAYER1=false
SKIP_LAYER2=false
SKIP_LAYER5=false
SKIP_LAYER5B=false
SKIP_LAYER4=false
SKIP_E2E=false
SKIP_WATCH=false
SAMPLE="${E2E_SAMPLE:-10}"

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --base-url)       BASE_URL="$2";   shift 2 ;;
        --state)          STATE_FILTER="$2"; shift 2 ;;
        --sample)         SAMPLE="$2";     shift 2 ;;
        --skip-layer0)    SKIP_LAYER0=true;  shift ;;
        --skip-layer1)    SKIP_LAYER1=true;  shift ;;
        --skip-layer2)    SKIP_LAYER2=true;  shift ;;
        --skip-layer5)    SKIP_LAYER5=true;  shift ;;
        --skip-layer5b)   SKIP_LAYER5B=true; shift ;;
        --skip-layer4)    SKIP_LAYER4=true;  shift ;;
        --skip-e2e)       SKIP_E2E=true;     shift ;;
        --skip-watch)     SKIP_WATCH=true;   shift ;;
        *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
SKIPPED=0

run_layer() {
    local label="$1"
    local cmd="${@:2}"
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  $label"
    echo "════════════════════════════════════════════════════════════"
    if eval "$cmd"; then
        echo "  ✓ $label PASSED"
        PASS=$((PASS + 1))
    else
        echo "  ✗ $label FAILED (exit $?)"
        FAIL=$((FAIL + 1))
    fi
}

skip_layer() {
    local label="$1"
    echo "  ─ SKIP  $label"
    SKIPPED=$((SKIPPED + 1))
}

STATE_ARG=""
if [[ -n "$STATE_FILTER" ]]; then
    STATE_ARG="--state $STATE_FILTER"
fi

# ── Load .env.local for DATABASE_URL if not already set ───────────────────────
if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "$REPO_ROOT/.env.local" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$REPO_ROOT/.env.local"
    set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "ERROR: DATABASE_URL is not set. Add it to .env.local or export it." >&2
    exit 1
fi

# ── Banner ────────────────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════"
echo "  StarlynnCare — Complete E2E Validation Suite"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "  Base URL: $BASE_URL"
[[ -n "$STATE_FILTER" ]] && echo "  State filter: $STATE_FILTER"
echo "════════════════════════════════════════════════════════════"

# ── Layer 0: Source API integrity ─────────────────────────────────────────────
if $SKIP_LAYER0; then
    skip_layer "Layer 0: Source API integrity"
else
    run_layer "Layer 0: Source API integrity" \
        python3 -u "$VALIDATE_DIR/layer0_source_apis.py" \
        $STATE_ARG \
        --sample "$SAMPLE"
fi

# ── Layer 1: DB invariants ────────────────────────────────────────────────────
if $SKIP_LAYER1; then
    skip_layer "Layer 1: DB invariants"
else
    run_layer "Layer 1: DB invariants" \
        python3 -u "$VALIDATE_DIR/db_invariants.py"
fi

# ── Layer 2: DB row shape ─────────────────────────────────────────────────────
if $SKIP_LAYER2; then
    skip_layer "Layer 2: DB row shape"
else
    run_layer "Layer 2: DB row shape" \
        python3 -u "$VALIDATE_DIR/layer2_db_shape.py" \
        $STATE_ARG \
        --sample "$SAMPLE"
fi

# ── Layer 5: Post-ingest checks (one per covered state) ───────────────────────
if $SKIP_LAYER5; then
    skip_layer "Layer 5: Post-ingest checks"
else
    LAYER5_STATES="${STATE_FILTER:-CA OR WA MN TX UT}"
    LAYER5_EXIT=0
    for st in $LAYER5_STATES; do
        echo ""
        echo "  ── Layer 5: $st"
        if ! python3 -u "$VALIDATE_DIR/post_ingest_check.py" --state "$st"; then
            LAYER5_EXIT=1
        fi
    done
    if [[ $LAYER5_EXIT -eq 0 ]]; then
        echo "  ✓ Layer 5 (all states) PASSED"
        PASS=$((PASS + 1))
    else
        echo "  ✗ Layer 5 (one or more states) FAILED"
        FAIL=$((FAIL + 1))
    fi
fi

# ── Layer 5b: Hub content drift audit ─────────────────────────────────────────
if $SKIP_LAYER5B; then
    skip_layer "Layer 5b: Hub content drift audit"
else
    LAYER5B_ARGS=""
    [[ -n "$STATE_FILTER" ]] && LAYER5B_ARGS="--state $STATE_FILTER"
    run_layer "Layer 5b: Hub content drift" \
        python3 -u "$VALIDATE_DIR/hub_content_drift_check.py" \
        $LAYER5B_ARGS \
        --dry-run
fi

# ── Layer 4: API route integration ────────────────────────────────────────────
if $SKIP_LAYER4; then
    skip_layer "Layer 4: API route integration"
else
    LAYER4_STATE_ARG=""
    [[ -n "$STATE_FILTER" ]] && LAYER4_STATE_ARG="--state $(echo "$STATE_FILTER" | tr '[:upper:]' '[:lower:]')"
    run_layer "Layer 4: API route integration" \
        python3 -u "$VALIDATE_DIR/layer4_api_routes.py" \
        --base-url "$BASE_URL" \
        $LAYER4_STATE_ARG \
        --spot-sample "$SAMPLE"
fi

# ── E2E: Soup-to-nuts pipeline ────────────────────────────────────────────────
if $SKIP_E2E; then
    skip_layer "E2E: Full pipeline"
else
    E2E_ARGS="--base-url $BASE_URL --count 2"
    [[ -n "$STATE_FILTER" ]] && E2E_ARGS="$E2E_ARGS --state $STATE_FILTER"
    $SKIP_WATCH && E2E_ARGS="$E2E_ARGS --skip-watch"
    run_layer "E2E: Full pipeline (DB→RPC→API→page→watch)" \
        python3 -u "$VALIDATE_DIR/e2e_full_pipeline.py" \
        $E2E_ARGS
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  E2E Suite Summary"
echo "  Passed:  $PASS"
echo "  Failed:  $FAIL"
echo "  Skipped: $SKIPPED"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "════════════════════════════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
    echo "  RESULT: FAILED ($FAIL layer(s) failed)"
    exit 1
else
    echo "  RESULT: ALL PASSED"
    exit 0
fi
