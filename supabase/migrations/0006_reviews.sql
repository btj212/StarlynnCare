-- Family reviews for individual facilities
CREATE TABLE IF NOT EXISTS reviews (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id               uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- Reviewer identity (no account required)
  reviewer_name             text NOT NULL CHECK (char_length(reviewer_name) BETWEEN 1 AND 100),
  reviewer_relationship     text NOT NULL CHECK (reviewer_relationship IN (
                              'Family member of current resident',
                              'Family member of former resident',
                              'Current resident',
                              'Former resident',
                              'Other'
                            )),
  residency_period          text CHECK (char_length(residency_period) <= 100),

  -- Category ratings (1–5, all required on submit)
  rating_staff_engagement   smallint NOT NULL CHECK (rating_staff_engagement   BETWEEN 1 AND 5),
  rating_personal_care      smallint NOT NULL CHECK (rating_personal_care      BETWEEN 1 AND 5),
  rating_activities         smallint NOT NULL CHECK (rating_activities         BETWEEN 1 AND 5),
  rating_food               smallint NOT NULL CHECK (rating_food               BETWEEN 1 AND 5),
  rating_transparency       smallint NOT NULL CHECK (rating_transparency       BETWEEN 1 AND 5),
  rating_safety             smallint NOT NULL CHECK (rating_safety             BETWEEN 1 AND 5),
  rating_night_weekend      smallint NOT NULL CHECK (rating_night_weekend      BETWEEN 1 AND 5),

  -- Optional per-category comments
  comment_staff_engagement  text CHECK (char_length(comment_staff_engagement)  <= 1000),
  comment_personal_care     text CHECK (char_length(comment_personal_care)     <= 1000),
  comment_activities        text CHECK (char_length(comment_activities)        <= 1000),
  comment_food              text CHECK (char_length(comment_food)              <= 1000),
  comment_transparency      text CHECK (char_length(comment_transparency)      <= 1000),
  comment_safety            text CHECK (char_length(comment_safety)            <= 1000),
  comment_night_weekend     text CHECK (char_length(comment_night_weekend)     <= 1000),

  -- Optional overall summary
  overall_summary           text CHECK (char_length(overall_summary) <= 2000),

  -- Moderation — reviews go live only after manual approval
  status                    text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'published', 'rejected')),

  created_at                timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-facility lookups
CREATE INDEX IF NOT EXISTS idx_reviews_facility_status
  ON reviews (facility_id, status, created_at DESC);

-- Row Level Security
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public: read only published reviews
CREATE POLICY "reviews_select_published"
  ON reviews FOR SELECT
  USING (status = 'published');

-- Public: insert only with pending status
CREATE POLICY "reviews_insert_pending"
  ON reviews FOR INSERT
  WITH CHECK (status = 'pending');
