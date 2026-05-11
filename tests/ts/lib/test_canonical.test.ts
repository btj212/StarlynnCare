/**
 * SEO canonical URL helpers — pure function tests.
 *
 * canonicalFor() is used in every page's generateMetadata() and in every
 * JSON-LD builder. If it misbehaves, every page gets a wrong canonical URL,
 * damaging SEO and structured data.
 *
 * No network. No DB. Pure TypeScript function tests.
 */

import { describe, it, expect } from "vitest";
import { canonicalFor, SITE_ORIGIN } from "@/lib/seo/canonical";

describe("SITE_ORIGIN", () => {
  it("is a non-empty string", () => {
    expect(typeof SITE_ORIGIN).toBe("string");
    expect(SITE_ORIGIN.length).toBeGreaterThan(0);
  });

  it("starts with https://", () => {
    expect(SITE_ORIGIN).toMatch(/^https:\/\//);
  });

  it("has no trailing slash", () => {
    expect(SITE_ORIGIN).not.toMatch(/\/$/);
  });

  it("defaults to starlynncare.com when NEXT_PUBLIC_SITE_URL is unset", () => {
    // In test environment without NEXT_PUBLIC_SITE_URL set,
    // SITE_ORIGIN should fall back to the hardcoded default.
    const url = process.env.NEXT_PUBLIC_SITE_URL;
    if (!url) {
      expect(SITE_ORIGIN).toBe("https://www.starlynncare.com");
    }
  });
});

describe("canonicalFor()", () => {
  it("returns absolute URL for root path", () => {
    const result = canonicalFor("/");
    expect(result).toBe(SITE_ORIGIN);
  });

  it("returns absolute URL for simple path", () => {
    expect(canonicalFor("/california")).toBe(`${SITE_ORIGIN}/california`);
  });

  it("returns absolute URL for deep path", () => {
    expect(canonicalFor("/california/oakland/memory-care-of-oakland-123456"))
      .toBe(`${SITE_ORIGIN}/california/oakland/memory-care-of-oakland-123456`);
  });

  it("adds leading slash when missing", () => {
    expect(canonicalFor("california")).toBe(`${SITE_ORIGIN}/california`);
  });

  it("strips trailing slash from non-root paths", () => {
    expect(canonicalFor("/california/")).toBe(`${SITE_ORIGIN}/california`);
  });

  it("strips trailing slash from deep paths", () => {
    expect(canonicalFor("/california/oakland/")).toBe(`${SITE_ORIGIN}/california/oakland`);
  });

  it("handles multiple trailing slashes", () => {
    const result = canonicalFor("/california///");
    expect(result).toMatch(/\/california$/);
    expect(result).not.toMatch(/\/$/);
  });

  it("handles path with query string gracefully", () => {
    // canonicalFor does not strip query strings — canonical URLs should not have them.
    // This test documents the current behavior (pass-through).
    const result = canonicalFor("/california?foo=bar");
    expect(result).toContain("/california");
  });

  it("returns same origin for repeated calls with same path", () => {
    const a = canonicalFor("/california/oakland");
    const b = canonicalFor("/california/oakland");
    expect(a).toBe(b);
  });

  it("produces distinct URLs for distinct paths", () => {
    const ca = canonicalFor("/california");
    const or = canonicalFor("/oregon");
    expect(ca).not.toBe(or);
  });

  it("canonical URL does not contain double slashes in path", () => {
    const result = canonicalFor("/california/oakland");
    // Remove the https:// prefix before checking for double slashes
    const path = result.replace(/^https?:\/\/[^/]+/, "");
    expect(path).not.toContain("//");
  });

  it("state hub URL has correct structure", () => {
    const result = canonicalFor("/california");
    expect(result).toMatch(/^https:\/\/.+\/california$/);
  });

  it("facility URL has correct structure with 3 path segments", () => {
    const result = canonicalFor("/california/oakland/facility-name-123456");
    const segments = result.replace(SITE_ORIGIN, "").split("/").filter(Boolean);
    expect(segments).toHaveLength(3);
    expect(segments[0]).toBe("california");
    expect(segments[1]).toBe("oakland");
    expect(segments[2]).toBe("facility-name-123456");
  });

  it("handles Oregon state hub", () => {
    expect(canonicalFor("/oregon")).toBe(`${SITE_ORIGIN}/oregon`);
  });

  it("handles Minnesota state hub", () => {
    expect(canonicalFor("/minnesota")).toBe(`${SITE_ORIGIN}/minnesota`);
  });

  it("handles Texas state hub", () => {
    expect(canonicalFor("/texas")).toBe(`${SITE_ORIGIN}/texas`);
  });

  it("handles Washington state hub", () => {
    expect(canonicalFor("/washington")).toBe(`${SITE_ORIGIN}/washington`);
  });

  it("handles methodology page", () => {
    expect(canonicalFor("/methodology")).toBe(`${SITE_ORIGIN}/methodology`);
  });

  it("handles facilities browse page", () => {
    expect(canonicalFor("/california/facilities")).toBe(`${SITE_ORIGIN}/california/facilities`);
  });

  it("handles whitespace-padded path", () => {
    const result = canonicalFor("  /california  ");
    expect(result).toBe(`${SITE_ORIGIN}/california`);
  });

  it("empty string produces site origin", () => {
    const result = canonicalFor("");
    expect(result).toBe(SITE_ORIGIN);
  });
});
