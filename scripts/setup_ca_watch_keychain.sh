#!/bin/bash
# Store DATABASE_URL in the macOS Keychain for the local California crawler.
# This script does not write .env or .env.local.
#
# Usage:
#   DATABASE_URL='postgresql://...' scripts/setup_ca_watch_keychain.sh
#   scripts/setup_ca_watch_keychain.sh    # prompts without echoing

set -euo pipefail

SERVICE="starlynncare-database-url"
ACCOUNT="starlynncare"

if [ -z "${DATABASE_URL:-}" ]; then
  read -r -s -p "DATABASE_URL: " DATABASE_URL
  printf '\n'
fi

case "$DATABASE_URL" in
  postgres://*|postgresql://*) ;;
  *)
    echo "DATABASE_URL must be a postgres URI." >&2
    exit 1
    ;;
esac

security add-generic-password -U -s "$SERVICE" -a "$ACCOUNT" -w "$DATABASE_URL"
unset DATABASE_URL
echo "Stored in Keychain service ${SERVICE}. No env file was written."
