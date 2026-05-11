-- Firecrawl pilot 4: pricing triangulation
-- Applied directly via psycopg (no Supabase CLI needed)

CREATE TABLE IF NOT EXISTS pilot_pricing_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_run_id text NOT NULL,
  facility_id uuid REFERENCES facilities(id),
  source text NOT NULL,
  source_url text,
  starting_price_monthly_usd integer,
  memory_care_price_monthly_usd integer,
  assisted_living_price_monthly_usd integer,
  price_range_min_usd integer,
  price_range_max_usd integer,
  price_disclaimer text,
  is_correct_facility boolean,
  raw_extract jsonb,
  fetched_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pilot_pricing_triangulated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_run_id text NOT NULL,
  facility_id uuid REFERENCES facilities(id) UNIQUE,
  source_count integer,
  triangulated_starting_price_usd integer,
  triangulated_memory_care_price_usd integer,
  price_min_usd integer,
  price_max_usd integer,
  divergence_pct numeric,
  confidence text CHECK (confidence IN ('high','medium','low')),
  vs_state_median_pct numeric,
  computed_at timestamptz DEFAULT now()
);
