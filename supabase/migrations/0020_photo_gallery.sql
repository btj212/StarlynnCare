-- Migration 0020: Multi-image gallery support
-- Adds photo_urls text[] and photo_sources jsonb to facilities.
-- Backfills from existing photo_url + photo_attribution single-image columns.
-- The new array columns enable up to 5 facility photos in the FacilitySnapshot gallery.
--
-- Schema of photo_sources entries:
--   [{ "url": "https://...", "source": "Google Street View", "attribution": "© 2024 Google" }]
--
-- The legacy single-image columns (photo_url, photo_attribution) are preserved for
-- backward compatibility and as the primary fallback for display.

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS photo_urls    text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS photo_sources jsonb   DEFAULT '[]';

-- Backfill: promote existing photo_url into photo_urls[0] and build a photo_sources entry.
UPDATE facilities
SET
  photo_urls = ARRAY[photo_url],
  photo_sources = jsonb_build_array(
    jsonb_build_object(
      'url',         photo_url,
      'source',      'Google Street View',
      'attribution', COALESCE(photo_attribution, '© Google')
    )
  )
WHERE photo_url IS NOT NULL
  AND photo_url <> ''
  AND (photo_urls IS NULL OR array_length(photo_urls, 1) IS NULL);

-- Index for facilities that have at least one photo (useful for gap reports).
CREATE INDEX IF NOT EXISTS facilities_has_photos
  ON facilities USING btree (publishable, state_code)
  WHERE array_length(photo_urls, 1) > 0;

COMMENT ON COLUMN facilities.photo_urls IS
  'Ordered list of photo URLs for the facility gallery (up to 5). Index 0 is the primary image. '
  'Sourced from Google Street View (fetch_streetview.py) and optionally Google Places Photos.';

COMMENT ON COLUMN facilities.photo_sources IS
  'Per-photo source metadata matching photo_urls by index. '
  'Each entry: { "url": string, "source": "Google Street View"|"Google Places", "attribution": string }. '
  'Required by Google Places API terms when using Places Photos.';
