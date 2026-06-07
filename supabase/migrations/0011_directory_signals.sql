-- ============================================================
-- StarlynnCare Migration 0011 — Directory Signals (APFM, Caring.com)
--
-- APFM (A Place for Mom) and Caring.com both maintain commercial
-- directories of memory-care facilities. Each listing is a strong
-- third-party signal. We treat a listing on EITHER directory as a
-- publish-eligible Tier 1 signal, mirroring chain_curated.
-- ============================================================

ALTER TABLE facilities
  ADD COLUMN mc_signal_apfm_listed   boolean NOT NULL DEFAULT false,
  ADD COLUMN mc_signal_caring_listed boolean NOT NULL DEFAULT false;
