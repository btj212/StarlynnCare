/**
 * State slug ⇄ state code mapping for URL routing.
 *
 * The `facilities` table stores the 2-letter `state_code` (e.g. "CA"),
 * but the public URLs use the full-name slug (e.g. "california").
 * This file is the single source of truth for that conversion.
 *
 * Only states actively being published should be listed in
 * `COVERED_STATES` — everything else 404s at the /[state] level.
 */

export interface StateInfo {
  slug: string;
  code: string;
  name: string;
}

export const STATES: ReadonlyArray<StateInfo> = [
  { slug: "california", code: "CA", name: "California" },
  /** Scaffolded for ingest + routing — hubs ship when publishable TX rows exist. */
  { slug: "texas", code: "TX", name: "Texas" },
  { slug: "oregon", code: "OR", name: "Oregon" },
  { slug: "minnesota", code: "MN", name: "Minnesota" },
  { slug: "washington", code: "WA", name: "Washington" },
  { slug: "utah", code: "UT", name: "Utah" },
  { slug: "illinois", code: "IL", name: "Illinois" },
  { slug: "pennsylvania", code: "PA", name: "Pennsylvania" },
  { slug: "arizona", code: "AZ", name: "Arizona" },
];

/** States with at least one publishable facility — used by the home page + sitemap. */
export const COVERED_STATES: ReadonlyArray<StateInfo> = [
  { slug: "california", code: "CA", name: "California" },
  { slug: "texas", code: "TX", name: "Texas" },
  { slug: "oregon", code: "OR", name: "Oregon" },
  { slug: "washington", code: "WA", name: "Washington" },
  { slug: "minnesota", code: "MN", name: "Minnesota" },
  { slug: "utah", code: "UT", name: "Utah" },
  { slug: "illinois", code: "IL", name: "Illinois" },
  { slug: "pennsylvania", code: "PA", name: "Pennsylvania" },
  { slug: "arizona", code: "AZ", name: "Arizona" },
];

export function stateFromSlug(slug: string): StateInfo | null {
  const match = STATES.find((s) => s.slug === slug.toLowerCase());
  return match ?? null;
}

export function stateFromCode(code: string): StateInfo | null {
  const match = STATES.find((s) => s.code === code.toUpperCase());
  return match ?? null;
}
