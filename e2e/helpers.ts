/**
 * E2E test helpers for StarlynnCare Playwright tests.
 *
 * All helpers that need DB access use real Supabase credentials.
 * No invented/fake data is used — everything is fetched from the real DB.
 */
import { createClient } from "@supabase/supabase-js";

export interface FacilityStub {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  state_code: string;
  serves_memory_care: boolean;
  publishable: boolean;
}

export interface StateStub {
  code: string;
  name: string;
  slug: string;
}

const STATE_SLUGS: Record<string, string> = {
  CA: "california",
  OR: "oregon",
  WA: "washington",
  MN: "minnesota",
  TX: "texas",
  UT: "utah",
};

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Returns a real publishable facility from the DB, or null if credentials absent. */
export async function getRealFacility(): Promise<FacilityStub | null> {
  const db = getDb();
  if (!db) return null;
  const { data } = await db
    .from("facilities")
    .select("id, name, slug, city_slug, state_code, serves_memory_care, publishable")
    .eq("publishable", true)
    .not("slug", "is", null)
    .not("city_slug", "is", null)
    .limit(1)
    .single();
  return data as FacilityStub | null;
}

/** Returns a real publishable memory-care facility, or null. */
export async function getRealMCFacility(): Promise<FacilityStub | null> {
  const db = getDb();
  if (!db) return null;
  const { data } = await db
    .from("facilities")
    .select("id, name, slug, city_slug, state_code, serves_memory_care, publishable")
    .eq("publishable", true)
    .eq("serves_memory_care", true)
    .not("slug", "is", null)
    .not("city_slug", "is", null)
    .limit(1)
    .single();
  return data as FacilityStub | null;
}

/** Returns the URL path for a real facility page. */
export function facilityPath(f: FacilityStub): string {
  const stateSlug = STATE_SLUGS[f.state_code] ?? f.state_code.toLowerCase();
  return `/${stateSlug}/${f.city_slug}/${f.slug}`;
}

/** Returns the URL path for a state hub page. */
export function stateHubPath(stateCode: string): string {
  return `/${STATE_SLUGS[stateCode] ?? stateCode.toLowerCase()}`;
}

/** Returns the URL path for a state facilities browse page. */
export function stateFacilitiesPath(stateCode: string): string {
  return `/${STATE_SLUGS[stateCode] ?? stateCode.toLowerCase()}/facilities`;
}

/** Returns true if required env vars for DB tests are present. */
export function hasDbCredentials(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
