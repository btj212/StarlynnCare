#!/usr/bin/env bash
set -euo pipefail

# Overnight ingest for the 3-county Bay Area expansion.

./scripts/ingest_county.sh "CONTRA COSTA"
./scripts/ingest_county.sh "SAN MATEO"
./scripts/ingest_county.sh "SANTA CLARA"

