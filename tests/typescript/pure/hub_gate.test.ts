/**
 * Tests: verifyHubStats and sanitizeHubHtml (pure logic, no IO).
 *
 * These are the TypeScript twins of Python's verify_stats() in
 * generate_hub_content.py. They must stay in lockstep — same STAT_KEYS, same
 * normalization ([,%\s]) — or a number that passes generation could fail approval.
 *
 * MEMORY.md 2026-06: the accuracy spine is the deterministic numeric gate.
 * A wrong number on a YMYL page is not acceptable.
 */

import { describe, it, expect } from "vitest";
import {
  STAT_KEYS,
  verifyHubStats,
  sanitizeHubHtml,
  type StatsSnapshot,
} from "@/lib/content/hubGate";

// ── STAT_KEYS ─────────────────────────────────────────────────────────────────

describe("STAT_KEYS", () => {
  it("contains all four required metrics", () => {
    expect(STAT_KEYS).toContain("facility_count");
    expect(STAT_KEYS).toContain("facilities_with_serious");
    expect(STAT_KEYS).toContain("pct_with_serious");
    expect(STAT_KEYS).toContain("total_beds");
  });

  it("has exactly 4 keys (no accidental additions)", () => {
    expect(STAT_KEYS).toHaveLength(4);
  });
});

// ── verifyHubStats ────────────────────────────────────────────────────────────

describe("verifyHubStats", () => {
  const validSnapshot: StatsSnapshot = {
    facility_count: 93,
    facilities_with_serious: 41,
    pct_with_serious: 44,
    total_beds: 5820,
  };

  it("returns empty array for a perfectly matching body", () => {
    const body = `
      <p>There are <span data-stat="facility_count">93</span> memory care facilities
      in Sacramento, of which <span data-stat="facilities_with_serious">41</span>
      have received a serious citation. That's
      <span data-stat="pct_with_serious">44</span>% of providers.
      Total licensed beds: <span data-stat="total_beds">5,820</span>.</p>
    `;
    const issues = verifyHubStats(body, validSnapshot);
    expect(issues).toEqual([]);
  });

  it("strips commas from displayed value before comparing", () => {
    // 5,820 should match snapshot value 5820
    const body = `<span data-stat="facility_count">93</span> facilities and
      <span data-stat="facilities_with_serious">41</span> serious,
      <span data-stat="pct_with_serious">44</span>%,
      <span data-stat="total_beds">5,820</span>`;
    expect(verifyHubStats(body, validSnapshot)).toEqual([]);
  });

  it("strips percent signs from displayed value before comparing", () => {
    const body = `<span data-stat="facility_count">93</span>
      <span data-stat="facilities_with_serious">41</span>
      <span data-stat="pct_with_serious">44%</span>
      <span data-stat="total_beds">5820</span>`;
    expect(verifyHubStats(body, validSnapshot)).toEqual([]);
  });

  it("strips whitespace from displayed value before comparing", () => {
    const body = `<span data-stat="facility_count"> 93 </span>
      <span data-stat="facilities_with_serious">41</span>
      <span data-stat="pct_with_serious">44</span>
      <span data-stat="total_beds">5820</span>`;
    expect(verifyHubStats(body, validSnapshot)).toEqual([]);
  });

  it("strips inner HTML tags before comparing (e.g. <strong>93</strong>)", () => {
    const body = `<span data-stat="facility_count"><strong>93</strong></span>
      <span data-stat="facilities_with_serious">41</span>
      <span data-stat="pct_with_serious">44</span>
      <span data-stat="total_beds">5820</span>`;
    expect(verifyHubStats(body, validSnapshot)).toEqual([]);
  });

  it("reports mismatch when value is wrong", () => {
    const body = `<span data-stat="facility_count">99</span>
      <span data-stat="facilities_with_serious">41</span>
      <span data-stat="pct_with_serious">44</span>
      <span data-stat="total_beds">5820</span>`;
    const issues = verifyHubStats(body, validSnapshot);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatch(/facility_count/);
    expect(issues[0]).toMatch(/99/);
    expect(issues[0]).toMatch(/93/);
  });

  it("reports unknown data-stat key", () => {
    const body = `<span data-stat="facility_count">93</span>
      <span data-stat="facilities_with_serious">41</span>
      <span data-stat="pct_with_serious">44</span>
      <span data-stat="total_beds">5820</span>
      <span data-stat="median_rating">4.2</span>`;
    const issues = verifyHubStats(body, validSnapshot);
    expect(issues.some((i) => i.includes("median_rating"))).toBe(true);
  });

  it("reports error when facility_count is missing from body", () => {
    const body = `<p>No facilities cited here.</p>`;
    const issues = verifyHubStats(body, validSnapshot);
    expect(issues.some((i) => i.includes("facility_count"))).toBe(true);
  });

  it("is case-sensitive on data-stat key", () => {
    // The key must be exact — Facility_Count is not facility_count
    const body = `<span data-stat="Facility_Count">93</span>
      <span data-stat="facilities_with_serious">41</span>
      <span data-stat="pct_with_serious">44</span>
      <span data-stat="total_beds">5820</span>`;
    const issues = verifyHubStats(body, validSnapshot);
    // "Facility_Count" is not in STAT_KEYS → unknown key issue
    expect(issues.some((i) => i.includes("Facility_Count"))).toBe(true);
  });

  it("handles empty body gracefully", () => {
    const issues = verifyHubStats("", validSnapshot);
    // Must report facility_count missing at minimum
    expect(issues.length).toBeGreaterThan(0);
  });

  it("handles body with no data-stat spans", () => {
    const body = "<p>Generic copy with no stats.</p>";
    const issues = verifyHubStats(body, validSnapshot);
    expect(issues.some((i) => i.includes("facility_count"))).toBe(true);
  });

  it("works with single-quoted data-stat attributes", () => {
    const body = `<span data-stat='facility_count'>93</span>
      <span data-stat='facilities_with_serious'>41</span>
      <span data-stat='pct_with_serious'>44</span>
      <span data-stat='total_beds'>5820</span>`;
    expect(verifyHubStats(body, validSnapshot)).toEqual([]);
  });

  it("handles snapshot values as strings", () => {
    // Snapshot may store numbers as strings in some edge cases
    const stringSnapshot: StatsSnapshot = {
      facility_count: "93",
      facilities_with_serious: "41",
      pct_with_serious: "44",
      total_beds: "5820",
    };
    const body = `<span data-stat="facility_count">93</span>
      <span data-stat="facilities_with_serious">41</span>
      <span data-stat="pct_with_serious">44</span>
      <span data-stat="total_beds">5820</span>`;
    expect(verifyHubStats(body, stringSnapshot)).toEqual([]);
  });

  it("multiple instances of the same key — all must match", () => {
    // If facility_count appears twice in the body, both must match
    const body = `<span data-stat="facility_count">93</span>
      text
      <span data-stat="facility_count">93</span>
      <span data-stat="facilities_with_serious">41</span>
      <span data-stat="pct_with_serious">44</span>
      <span data-stat="total_beds">5820</span>`;
    expect(verifyHubStats(body, validSnapshot)).toEqual([]);
  });

  it("multiple instances with wrong value — reports the mismatch", () => {
    const body = `<span data-stat="facility_count">93</span>
      <span data-stat="facility_count">94</span>
      <span data-stat="facilities_with_serious">41</span>
      <span data-stat="pct_with_serious">44</span>
      <span data-stat="total_beds">5820</span>`;
    const issues = verifyHubStats(body, validSnapshot);
    expect(issues.length).toBeGreaterThan(0);
  });
});

// ── sanitizeHubHtml ───────────────────────────────────────────────────────────

describe("sanitizeHubHtml", () => {
  it("removes <script> tags and their content", () => {
    const html = '<p>Safe</p><script>alert("xss")</script>';
    expect(sanitizeHubHtml(html)).not.toContain("<script");
    expect(sanitizeHubHtml(html)).not.toContain("alert");
  });

  it("removes <style> tags and their content", () => {
    const html = "<style>body { color: red; }</style><p>Text</p>";
    expect(sanitizeHubHtml(html)).not.toContain("<style");
    expect(sanitizeHubHtml(html)).not.toContain("color: red");
  });

  it("removes <iframe> tags", () => {
    const html = '<iframe src="https://evil.com"></iframe>';
    expect(sanitizeHubHtml(html)).not.toContain("iframe");
  });

  it("removes inline event handlers (onclick, onmouseover, etc.)", () => {
    const html = `<p onclick="doEvil()">Text</p>`;
    expect(sanitizeHubHtml(html)).not.toContain("onclick");
  });

  it("removes href=javascript: URLs", () => {
    const html = `<a href="javascript:alert(1)">Click</a>`;
    const result = sanitizeHubHtml(html);
    expect(result).not.toContain("javascript:");
  });

  it("removes src=data: URLs", () => {
    const html = `<img src="data:image/png;base64,abc">`;
    const result = sanitizeHubHtml(html);
    expect(result).not.toContain("data:");
  });

  it("preserves safe HTML elements", () => {
    const html = `<p>A <strong>safe</strong> paragraph with <em>emphasis</em>.</p>`;
    const result = sanitizeHubHtml(html);
    expect(result).toContain("<p>");
    expect(result).toContain("<strong>");
    expect(result).toContain("<em>");
    expect(result).toContain("safe");
  });

  it("preserves data-stat spans (the accuracy spine)", () => {
    const html = `<p>There are <span data-stat="facility_count">93</span> facilities.</p>`;
    const result = sanitizeHubHtml(html);
    expect(result).toContain('data-stat="facility_count"');
    expect(result).toContain("93");
  });

  it("preserves safe http:// href links", () => {
    const html = `<a href="https://www.starlynncare.com/california">California</a>`;
    const result = sanitizeHubHtml(html);
    expect(result).toContain("https://www.starlynncare.com");
  });

  it("handles empty string gracefully", () => {
    expect(sanitizeHubHtml("")).toBe("");
  });

  it("handles plain text (no HTML) gracefully", () => {
    const text = "Plain text, no HTML.";
    expect(sanitizeHubHtml(text)).toBe(text);
  });

  it("removes onload in double quotes", () => {
    const html = `<body onload="doEvil()">content</body>`;
    expect(sanitizeHubHtml(html)).not.toContain("onload");
  });
});
