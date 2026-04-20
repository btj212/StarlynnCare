-- Migration 0004: add photo storage columns to facilities
-- Stores the public URL of the Google Street View exterior image and the
-- required attribution string per the Google Maps Static API terms of service.

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS photo_url        text,
  ADD COLUMN IF NOT EXISTS photo_attribution text;

COMMENT ON COLUMN facilities.photo_url IS
  'Public URL of the exterior photo (Google Street View Static API image uploaded to Supabase Storage)';

COMMENT ON COLUMN facilities.photo_attribution IS
  'Attribution string required by Google Maps Static API terms of service, e.g. "© Google Street View"';
