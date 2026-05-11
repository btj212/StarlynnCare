#!/usr/bin/env python3
"""
Apply pilot tables migration against the database.
Usage: python3 scrapers/apply_pilot_migration.py
"""

import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")

DB_URL = os.environ["DATABASE_URL"]
SQL = (Path(__file__).parent.parent / "supabase/migrations/0022_pilot_tables.sql").read_text()


def main() -> None:
    print("Applying 0022_pilot_tables migration...")
    with psycopg.connect(DB_URL) as conn:
        conn.execute(SQL)
        conn.commit()
    print("Done.")


if __name__ == "__main__":
    main()
