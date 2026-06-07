#!/bin/bash
# SessionStart hook — installs deps so the app, scrapers, and validation
# scripts are runnable in Claude Code on the web. Local dev (Cursor) manages
# its own environment, so this only runs in the remote/web container.
set -euo pipefail

# Only run in Claude Code on the web; no-op locally.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Node deps for the Next.js app (idempotent; install benefits from container caching).
npm install

# The cloud container's npm version annotates package-lock.json differently
# (adds "dev": true to sharp's optional native binaries, drops some "libc"
# arrays) than the npm that generated the committed lockfile. That produces
# ~40 lines of pure metadata churn on every install and nothing else. The cloud
# sandbox is not where lockfile changes should originate — those come from
# Cursor / a deliberate dependency task — so discard the churn here and treat
# the committed package-lock.json as authoritative. See ERRORS.md 2026-06.
git checkout -- package-lock.json 2>/dev/null || true

# Python deps for the scrapers + data-validation pipeline.
python3 -m pip install --quiet --disable-pip-version-check -r scrapers/requirements.txt
