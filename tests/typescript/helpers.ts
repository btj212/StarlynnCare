/**
 * Test helpers for TypeScript integration tests.
 *
 * Uses @supabase/supabase-js (already a project dependency) to connect to the
 * real Supabase instance. All tests skip gracefully when credentials are absent.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Supabase client ──────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

export function getTestClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
  if (!url || !key) return null;
  if (!_client) {
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/** Skip the current test (or describe block) if Supabase credentials are missing. */
export function requireSupabase(): SupabaseClient {
  const client = getTestClient();
  if (!client) {
    // Throw a special object that node:test recognizes as a skip signal
    const err: Error & { code?: string } = new Error(
      "Skipping: NEXT_PUBLIC_SUPABASE_URL / KEY not set"
    );
    err.code = "ERR_TEST_SKIP";
    throw err;
  }
  return client;
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isString(v: unknown): v is string {
  return typeof v === "string";
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

export function isNumber(v: unknown): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}

export function isPositiveInt(v: unknown): v is number {
  return isNumber(v) && Number.isInteger(v) && v > 0;
}

export function isNonNegativeNumber(v: unknown): v is number {
  return isNumber(v) && v >= 0;
}

export function isIsoDate(v: unknown): v is string {
  if (!isString(v)) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function isIsoTimestamp(v: unknown): v is string {
  if (!isString(v)) return false;
  return /^\d{4}-\d{2}-\d{2}T/.test(v);
}

export function isYearMonth(v: unknown): v is string {
  if (!isString(v)) return false;
  return /^\d{4}-\d{2}$/.test(v);
}

export function isValidUrl(v: unknown): v is string {
  if (!isString(v)) return false;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const COVERED_STATE_CODES = ["CA", "OR", "WA", "TX", "MN", "UT", "IL"] as const;
export type CoveredStateCode = (typeof COVERED_STATE_CODES)[number];

export const VALID_CARE_CATEGORIES = new Set([
  "rcfe_memory_care",
  "rcfe_general",
  "alf_memory_care",
  "alf_general",
  "snf_general",
  "snf_dementia_scu",
  "ccrc",
  "unknown",
]);

export const VALID_CAPACITY_TIERS = new Set(["small", "medium", "large", "unknown"]);
export const VALID_SCOPES = new Set(["isolated", "pattern", "widespread"]);
export const VALID_LETTER_GRADES = new Set(["A", "B", "C", "D", "F"]);

export const MINIMUM_PUBLISHED: Record<string, number> = {
  CA: 500,
  OR: 80,
  WA: 150,
  TX: 60,
  MN: 30,
  UT: 10,
  IL: 20,
};
