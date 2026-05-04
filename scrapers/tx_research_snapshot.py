#!/usr/bin/env python3
"""
Texas HHSC research scaffold — placeholder for raw snapshot ingestion.

Phase 5: replace DISCOVERY_URLS with verified LTCR endpoints and implement:
  - roster fetch (Alzheimer-certified ALFs by county)
  - per-facility inspection index download
  - raw artifact storage (S3 / Supabase Storage) keyed by (license_id, report_id, fetched_at)

Environment:
  DATABASE_URL — optional; connect only after schema parity with CA ingest is validated.

This file intentionally performs **no production writes**. Use it as the anchor for the
future `tx_citations_ingest.py` modeled on `ccld_citations_ingest.py`.
"""
from __future__ import annotations

import argparse


DISCOVERY_URLS = (
    "Start from HHSC Long-Term Care Regulatory provider search / licensing portals "
    "(exact URLs change — capture in docs/TX_DATA_SOURCES.md during discovery)."
)


def main() -> None:
    parser = argparse.ArgumentParser(description="TX HHSC research scaffold (no network I/O yet).")
    parser.parse_args()
    print("TX ingest scaffold — no HTTP requests executed.")
    print(DISCOVERY_URLS)
    print("Next: record verified HHSC LTCR endpoints in docs/TX_DATA_SOURCES.md.")


if __name__ == "__main__":
    main()
