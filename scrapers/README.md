# Scrapers (Sprint 2+)

Python **3.11** recommended.

## Setup

From repo root:

```bash
cd scrapers
python3.11 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Environment

Add **`DATABASE_URL`** to the repo-root **`.env.local`** (same file Next.js uses):

- Supabase Dashboard → **Project Settings → Database** → copy the **URI** connection string (includes `postgresql://…`).
- Prefer **direct connection** (port `5432`) or **transaction pooler** (`6543`) with `?sslmode=require` if supplied.

Also keep `SUPABASE_SERVICE_ROLE_KEY` for tools that call the REST API; **`cms_ingest.py` uses Postgres only**.

## CMS Provider Information ingest

Loads Florida nursing homes from CMS dataset [`4pq5-n9py`](https://data.cms.gov/provider-data/dataset/4pq5-n9py) via the official datastore API (no scraping of aggregators).

```bash
# From repo root, with venv activated:
python scrapers/cms_ingest.py --dry-run    # Fetch only (~694 FL rows expected)
python scrapers/cms_ingest.py               # Upsert facilities + scrape_runs
```

Dry run checks network + API; full run checks `DATABASE_URL` and writes to `facilities` and `scrape_runs`.
