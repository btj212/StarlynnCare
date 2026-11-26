-- What the person who filled in the confirm form agreed to. A row is only ever
-- published after review, and photos are only used when photo_permission is true.
-- consent_version names the wording shown on the form (HOME_CONSENT_VERSION in
-- src/lib/facility/homeResponse.ts); change the wording and bump the version.
-- Rows entered by hand (email or phone replies) have no consent record and no
-- photo permission: the home answered questions, it did not license its photos.

ALTER TABLE public.facility_direct_responses
  ADD COLUMN IF NOT EXISTS authorized_to_answer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_permission boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_link text
    CHECK (photo_link ~ '^https?://' AND char_length(photo_link) <= 500),
  ADD COLUMN IF NOT EXISTS consent_version text;
