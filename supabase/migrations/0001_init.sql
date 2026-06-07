-- ============================================================
-- StarlynnCare Schema v2
-- Run in Supabase SQL Editor
-- ============================================================

-- States — tracks coverage per state
CREATE TABLE states (
  id             serial PRIMARY KEY,
  code           char(2) UNIQUE NOT NULL,
  name           text NOT NULL,
  scraper_name   text,
  last_successful_scrape timestamptz,
  confidence     text CHECK (confidence IN ('high','medium','low')) DEFAULT 'low',
  sla_days       int DEFAULT 14,
  notes          text
);

-- Facilities — core facility record
CREATE TABLE facilities (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code         char(2) NOT NULL REFERENCES states(code),

  -- Identity
  name               text NOT NULL,
  cms_id             text UNIQUE,
  license_number     text,
  license_type       text,

  -- Address (structured)
  street             text,
  city               text,
  zip                text,

  -- URL routing — /florida/gainesville/magnolia-ridge
  city_slug          text NOT NULL,
  slug               text NOT NULL,

  -- Facility characteristics
  beds               int,
  facility_type      text,
  certification_type text,          -- 'medicare', 'medicaid', 'both', 'private'

  -- Ownership chain (critical for pattern analysis)
  operator_name      text,
  management_company text,
  ownership_type     text CHECK (ownership_type IN ('for-profit','non-profit','government')),

  -- Contact
  phone              text,
  website            text,

  -- Quality snapshot (denormalized for query performance)
  cms_star_rating    int CHECK (cms_star_rating BETWEEN 1 AND 5),
  last_inspection_date date,

  -- Geo
  latitude           numeric,
  longitude          numeric,

  -- Metadata
  source_url         text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),

  UNIQUE(state_code, city_slug, slug)
);

CREATE INDEX idx_facilities_city   ON facilities(state_code, city_slug);
CREATE INDEX idx_facilities_slug   ON facilities(state_code, city_slug, slug);
CREATE INDEX idx_facilities_cms    ON facilities(cms_id);
CREATE INDEX idx_facilities_operator ON facilities(operator_name);

-- Inspections — one record per inspection event
CREATE TABLE inspections (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id          uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- Event identity
  inspection_date      date NOT NULL,
  inspection_type      text,                       -- 'standard', 'complaint', 'follow-up', 'focused'
  is_complaint         boolean DEFAULT false,       -- complaint-driven vs. routine
  complaint_id         text,                        -- state's public complaint reference if available

  -- Outcome summary
  total_deficiency_count int,                      -- denormalized for fast queries
  civil_money_penalty_total numeric,               -- total fines from this inspection in dollars
  special_focus        boolean DEFAULT false,       -- CMS Special Focus Facility designation

  -- Source
  source_url           text NOT NULL,
  source_agency        text NOT NULL,
  scrape_run_id        uuid,
  raw_data             jsonb,                       -- full original payload — replay safety net

  created_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_inspections_facility ON inspections(facility_id, inspection_date DESC);
CREATE INDEX idx_inspections_complaint ON inspections(is_complaint) WHERE is_complaint = true;

-- Deficiencies — findings from an inspection
-- This is the product's core table. Every field matters.
CREATE TABLE deficiencies (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id        uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,

  -- Regulatory citation
  ftag                 text,              -- e.g. 'F600' (abuse), 'F610' (reporting), 'F689' (accident hazard)
  code                 text,              -- state-specific violation code if non-CMS
  category             text,              -- e.g. 'Resident Rights', 'Quality of Care'

  -- Scope / Severity (CMS standard matrix)
  scope                text CHECK (scope IN ('isolated','pattern','widespread')),
  severity             int  CHECK (severity BETWEEN 1 AND 4),
  -- severity: 1=no harm, 2=potential for harm, 3=actual harm, 4=immediate jeopardy
  scope_severity_code  char(1),           -- A–L grid code (industry-standard CMS designation)
  class                text,              -- state classification where applicable (e.g. FL Class I/II/III)

  -- Critical flags
  immediate_jeopardy   boolean DEFAULT false,           -- life/safety threat — families search this
  substandard_quality_of_care boolean DEFAULT false,    -- specific CMS designation
  is_repeat            boolean DEFAULT false,           -- same tag cited in prior inspection

  -- Narrative (the rich content)
  description          text,              -- regulatory language / what rule was broken
  inspector_narrative  text,              -- what the inspector actually observed
  harm_description     text,              -- what harm occurred or could have occurred to residents

  -- Impact
  residents_affected   int,              -- number of residents impacted

  -- Resolution
  plan_of_correction   text,             -- facility's written response / corrective plan
  poc_deadline         date,             -- deadline to correct
  cited_date           date,
  corrected_date       date,
  status               text,             -- 'open', 'corrected', 'partially_corrected'

  -- Financial
  civil_money_penalty  numeric,          -- fine in dollars for this specific deficiency (if itemized)

  created_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_deficiencies_inspection  ON deficiencies(inspection_id);
CREATE INDEX idx_deficiencies_ftag        ON deficiencies(ftag);
CREATE INDEX idx_deficiencies_ij          ON deficiencies(immediate_jeopardy) WHERE immediate_jeopardy = true;
CREATE INDEX idx_deficiencies_repeat      ON deficiencies(is_repeat) WHERE is_repeat = true;

-- Scrape runs — tracks every scraper execution
CREATE TABLE scrape_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code       char(2) NOT NULL REFERENCES states(code),
  scraper_name     text NOT NULL,
  started_at       timestamptz DEFAULT now(),
  completed_at     timestamptz,
  status           text CHECK (status IN ('running','success','partial','failed')) DEFAULT 'running',
  records_found    int,
  records_new      int,
  records_updated  int,
  error_log        text,
  evaluator_result jsonb,
  repair_attempted boolean DEFAULT false,
  repair_result    jsonb
);

CREATE INDEX idx_scrape_runs_state ON scrape_runs(state_code, started_at DESC);

-- Content runs — tracks content chain executions per facility
CREATE TABLE content_runs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id          uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  started_at           timestamptz DEFAULT now(),
  completed_at         timestamptz,
  status               text CHECK (status IN ('running','passed','failed_quality_gate','error')) DEFAULT 'running',
  quality_gate_result  jsonb,
  generated_content    jsonb,
  published            boolean DEFAULT false
);

-- ============================================================
-- Seed: all 50 states
-- ============================================================
INSERT INTO states (code, name) VALUES
  ('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),('CA','California'),
  ('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),('FL','Florida'),('GA','Georgia'),
  ('HI','Hawaii'),('ID','Idaho'),('IL','Illinois'),('IN','Indiana'),('IA','Iowa'),
  ('KS','Kansas'),('KY','Kentucky'),('LA','Louisiana'),('ME','Maine'),('MD','Maryland'),
  ('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),('MS','Mississippi'),('MO','Missouri'),
  ('MT','Montana'),('NE','Nebraska'),('NV','Nevada'),('NH','New Hampshire'),('NJ','New Jersey'),
  ('NM','New Mexico'),('NY','New York'),('NC','North Carolina'),('ND','North Dakota'),('OH','Ohio'),
  ('OK','Oklahoma'),('OR','Oregon'),('PA','Pennsylvania'),('RI','Rhode Island'),('SC','South Carolina'),
  ('SD','South Dakota'),('TN','Tennessee'),('TX','Texas'),('UT','Utah'),('VT','Vermont'),
  ('VA','Virginia'),('WA','Washington'),('WV','West Virginia'),('WI','Wisconsin'),('WY','Wyoming');

-- ============================================================
-- Row Level Security
-- Default-deny; only service role key can write.
-- ============================================================
ALTER TABLE states        ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE deficiencies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_runs  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read states"       ON states       FOR SELECT USING (true);
CREATE POLICY "Public can read facilities"   ON facilities   FOR SELECT USING (true);
CREATE POLICY "Public can read inspections"  ON inspections  FOR SELECT USING (true);
CREATE POLICY "Public can read deficiencies" ON deficiencies FOR SELECT USING (true);
