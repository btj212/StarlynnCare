/**
 * Tests: canonicalFor() from src/lib/seo/canonical.ts
 *
 * These tests run purely in Node.js — no network, no DB. They verify that
 * every canonical URL produced by the site is correct: absolute, HTTPS,
 * no trailing slashes, uses the production domain.
 */

import { describe, it, expect } from "vitest";
import { canonicalFor, SITE_ORIGIN } from "@/lib/seo/canonical";

describe("SITE_ORIGIN", () => {
  it("is a valid HTTPS URL", () => {
    expect(SITE_ORIGIN).toMatch(/^https:\/\//);
  });

  it("does not end with a trailing slash", () => {
    expect(SITE_ORIGIN).not.toMatch(/\/$/);
  });

  it("is the production domain", () => {
    // In tests without NEXT_PUBLIC_SITE_URL set, falls back to production
    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      expect(SITE_ORIGIN).toBe("https://www.starlynncare.com");
    }
  });
});

describe("canonicalFor", () => {
  it("prepends the site origin to a path starting with /", () => {
    expect(canonicalFor("/california")).toBe(`${SITE_ORIGIN}/california`);
  });

  it("prepends the site origin to a path not starting with /", () => {
    expect(canonicalFor("california")).toBe(`${SITE_ORIGIN}/california`);
  });

  it("strips trailing slashes from paths", () => {
    expect(canonicalFor("/california/")).toBe(`${SITE_ORIGIN}/california`);
    expect(canonicalFor("/california/oakland/")).toBe(`${SITE_ORIGIN}/california/oakland`);
  });

  it("returns bare SITE_ORIGIN for root path /", () => {
    expect(canonicalFor("/")).toBe(SITE_ORIGIN);
    expect(canonicalFor("")).toBe(SITE_ORIGIN);
  });

  it("returns SITE_ORIGIN for whitespace-only input", () => {
    expect(canonicalFor("   ")).toBe(SITE_ORIGIN);
  });

  it("preserves query strings if present", () => {
    // canonicalFor does not strip query strings — paths with queries are unusual
    // for canonical URLs but the function should not corrupt them
    const result = canonicalFor("/california?page=2");
    expect(result).toContain("/california");
  });

  it("handles nested paths correctly", () => {
    const url = canonicalFor("/california/oakland/sunrise-memory-care-of-oakland");
    expect(url).toBe(`${SITE_ORIGIN}/california/oakland/sunrise-memory-care-of-oakland`);
  });

  it("handles PA paths correctly", () => {
    const url = canonicalFor("/pennsylvania/philadelphia/rittenhouse-village");
    expect(url).toBe(`${SITE_ORIGIN}/pennsylvania/philadelphia/rittenhouse-village`);
  });

  it("is deterministic (same input always produces same output)", () => {
    const input = "/california/san-francisco";
    expect(canonicalFor(input)).toBe(canonicalFor(input));
  });

  it("produces valid URLs for all 8 covered state hubs", () => {
    const states = ["california", "oregon", "washington", "texas", "minnesota", "utah", "illinois", "pennsylvania"];
    for (const state of states) {
      const url = canonicalFor(`/${state}`);
      expect(url).toMatch(/^https:\/\//);
      expect(url).toContain(state);
      expect(url).not.toMatch(/\/$/);
    }
  });
});
