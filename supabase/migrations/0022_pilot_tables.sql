-- Firecrawl pilot tables
-- Applied directly via psycopg (no Supabase CLI needed)

CREATE TABLE IF NOT EXISTS pilot_news_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_run_id text NOT NULL,
  facility_id uuid REFERENCES facilities(id),
  url text,
  title text,
  snippet text,
  published_at date,
  category text,
  confidence float,
  raw_excerpt text,
  fetched_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pilot_extract_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_run_id text NOT NULL,
  state_code text,
  source text,
  license_number text,
  name text,
  address text,
  city text,
  beds integer,
  raw_json jsonb,
  fetched_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pilot_operator_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_run_id text NOT NULL,
  facility_id uuid REFERENCES facilities(id),
  operator_url text,
  claims_jsonb jsonb,
  surprises_jsonb jsonb,
  fetched_at timestamptz DEFAULT now()
);
