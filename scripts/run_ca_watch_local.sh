#!/bin/bash
# Local California watch. The crawl itself does not email families.
# On Sunday, after the crawl, a watched home can be emailed when that home
# gained an inspection, even if some other home was not checked.
# Credentials come from Keychain at runtime and are not written to disk.
# The operator note reads starlynncare-loops-api-key and
# starlynncare-loops-admin-alert-id when the local env file has no real token.

set -euo pipefail

ROOT="/Users/blakejones/Developer/StarlynnCare"
PYTHON="/Library/Frameworks/Python.framework/Versions/3.13/bin/python3"
LOG_DIR="${HOME}/Library/Logs/StarlynnCare"
SUPPORT_DIR="${HOME}/Library/Application Support/StarlynnCare"
LOCK="${SUPPORT_DIR}/ca-watch.lock"
LOG="${LOG_DIR}/ca-watch.log"

mkdir -p "$LOG_DIR" "$SUPPORT_DIR"

if [ -f "$LOG" ]; then
  size="$(stat -f%z "$LOG")"
  if [ "$size" -gt 5242880 ]; then
    rm -f "${LOG}.2"
    if [ -f "${LOG}.1" ]; then
      mv "${LOG}.1" "${LOG}.2"
    fi
    mv "$LOG" "${LOG}.1"
  fi
fi

DATABASE_URL="$(security find-generic-password -s starlynncare-database-url -a starlynncare -w)"
export DATABASE_URL
export CA_CRAWL_MAX_MINUTES="${CA_CRAWL_MAX_MINUTES:-90}"

avail_kb="$(df -k / | awk 'NR==2 {print $4}')"
{
  printf '%s disk_free_kb=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$avail_kb"
} >> "$LOG"
if [ "$avail_kb" -lt 1500000 ]; then
  echo "Refusing California crawl: less than 1.5 GB free." >> "$LOG"
  exit 1
fi

"$PYTHON" - "$LOCK" "$ROOT" "$LOG" "$PYTHON" <<'PY'
import fcntl
import os
import subprocess
import sys

lock_path, root, log_path, python_bin = sys.argv[1:]
lock = open(lock_path, "a", encoding="utf-8")
try:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    print("another California watch is running; skipping")
    sys.exit(0)

with open(log_path, "a", encoding="utf-8") as log:
    result = subprocess.run(
        [
            python_bin,
            "-u",
            "scripts/weekly_inspection_ingest.py",
            "--state",
            "CA",
            "--skip-validate",
        ],
        cwd=root,
        env=os.environ.copy(),
        stdout=log,
        stderr=subprocess.STDOUT,
    )
    log.write("\n--- California Sunday alert check ---\n")
    alert = subprocess.run(
        [python_bin, "-u", "scripts/ca_sunday_alerts.py", "--send"],
        cwd=root,
        env=os.environ.copy(),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    log.write(alert.stdout or "")
    if alert.returncode != 0:
        log.write("California Sunday alert check failed. The crawl result is unchanged.\n")
    sys.path.insert(0, os.path.join(root, "scripts"))
    from report_scan_run import data_check_from_sunday_output

    data_check = data_check_from_sunday_output(alert.stdout or "")
    log.write("\n--- Operator scan note ---\n")
    report = subprocess.run(
        [
            python_bin,
            "-u",
            "scripts/report_scan_run.py",
            "--state",
            "CA",
            "--data-check",
            data_check,
            "--admin-url",
            "https://www.starlynncare.com/california",
        ],
        cwd=root,
        env=os.environ.copy(),
        stdout=log,
        stderr=subprocess.STDOUT,
    )
    if report.returncode != 0:
        log.write("Operator scan note was not sent.\n")
sys.exit(result.returncode)
PY
