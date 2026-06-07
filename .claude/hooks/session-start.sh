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

# Python deps for the scrapers + data-validation pipeline.
python3 -m pip install --quiet --disable-pip-version-check -r scrapers/requirements.txt
