-- Evidence rows from automated queue verification (Firecrawl + Sonnet).
-- Human reviewers stay in the loop; this table stores suggestions only.

CREATE TABLE mc_queue_evidence (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  search_query     text        NOT NULL,
  source_url       text,
  evidence_snippet text,
  verdict          text        NOT NULL CHECK (verdict IN ('mc_yes','mc_no','uncertain')),
  confidence       numeric(4,3),
  model            text        NOT NULL,
  scraped_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mc_queue_evidence_facility ON mc_queue_evidence (facility_id, scraped_at DESC);
