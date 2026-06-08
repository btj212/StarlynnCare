/**
 * Tests: inspectionHasRealNarrative and deficiencyHasRealText logic.
 *
 * These functions gate whether a facility profile shows a grade/percentile
 * and AI summaries (MEMORY.md 2026-06). Getting this wrong means either:
 *   - Showing unearned quality claims (YMYL violation if too permissive)
 *   - Hiding valid data from families (bad UX if too strict)
 *
 * Also tests the WA placeholder detection — WA PDFs that haven't been parsed
 * yet come through with a known placeholder pattern.
 */

import { describe, it, expect } from "vitest";
import {
  inspectionHasRealNarrative,
  type InspectionRow,
  type DeficiencyRow,
} from "@/lib/facility/loadFacilityProfile";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInspection(overrides: Partial<InspectionRow> = {}): InspectionRow {
  return {
    id: "test-id",
    inspection_date: "2025-01-15",
    inspection_type: "Annual",
    is_complaint: false,
    complaint_id: null,
    total_deficiency_count: 0,
    narrative_summary: null,
    source_url: null,
    source_agency: "OR-DHS",
    raw_data: null,
    ...overrides,
  };
}

function makeDeficiency(overrides: Partial<DeficiencyRow> = {}): DeficiencyRow {
  return {
    id: "def-id",
    inspection_id: "test-id",
    class: null,
    code: null,
    severity: 2,
    scope: "isolated",
    scope_severity_code: null,
    immediate_jeopardy: false,
    description: null,
    inspector_narrative: null,
    state_severity_raw: null,
    is_repeat: false,
    ...overrides,
  };
}

// ── Path 1: raw_data.narrative ────────────────────────────────────────────────

describe("inspectionHasRealNarrative — raw_data.narrative path", () => {
  it("returns true for a substantive narrative (≥100 chars)", () => {
    const narrative = "A".repeat(101);
    const insp = makeInspection({ raw_data: { narrative } });
    expect(inspectionHasRealNarrative(insp)).toBe(true);
  });

  it("returns false for a short narrative (<100 chars)", () => {
    const insp = makeInspection({ raw_data: { narrative: "Short text." } });
    expect(inspectionHasRealNarrative(insp)).toBe(false);
  });

  it("returns false for null narrative", () => {
    const insp = makeInspection({ raw_data: { narrative: undefined } });
    expect(inspectionHasRealNarrative(insp)).toBe(false);
  });

  it("returns false for empty narrative", () => {
    const insp = makeInspection({ raw_data: { narrative: "" } });
    expect(inspectionHasRealNarrative(insp)).toBe(false);
  });

  it("returns false when narrative is exactly the WA placeholder pattern", () => {
    const placeholder = "—: WA DSHS report: some-pdf.pdf\n".repeat(5);
    const insp = makeInspection({ raw_data: { narrative: placeholder } });
    expect(inspectionHasRealNarrative(insp)).toBe(false);
  });

  it("returns false for all-WA-placeholder multi-PDF concatenation (even if >100 chars)", () => {
    // Every line is a placeholder — total length >100 but content is fake
    const lines = [
      "—: WA DSHS report: visit1.pdf",
      "—: WA DSHS report: visit2.pdf",
      "—: WA DSHS report: visit3.pdf",
      "—: WA DSHS report: visit4.pdf",
      "—: WA DSHS report: visit5.pdf",
    ];
    const narrative = lines.join("\n");
    const insp = makeInspection({ raw_data: { narrative } });
    expect(inspectionHasRealNarrative(insp)).toBe(false);
  });

  it("returns false for narratives that START with the WA placeholder (even if real text follows)", () => {
    // The first check tests the whole narrative string with the WA regex (anchored at ^).
    // If the narrative starts with the placeholder, the real text after it is not reached.
    // This is intentional: the WA bundle builder always prepends the placeholder header.
    const narrative =
      "—: WA DSHS report: visit1.pdf\n" +
      "On April 14, the inspector observed that the facility staff ".repeat(3);
    const insp = makeInspection({ raw_data: { narrative } });
    expect(inspectionHasRealNarrative(insp)).toBe(false);
  });

  it("returns true for real text that happens to mention WA (not starting with placeholder)", () => {
    // Real narrative that mentions WA but does NOT start with the placeholder pattern
    const narrative =
      "On April 14, the inspector reviewed the WA DSHS report for this facility. " +
      "Staff were observed to be following the care plan appropriately. " +
      "No deficiencies were cited during this inspection. The facility's memory ".repeat(2);
    const insp = makeInspection({ raw_data: { narrative } });
    expect(inspectionHasRealNarrative(insp)).toBe(true);
  });

  it("returns false when raw_data is null", () => {
    const insp = makeInspection({ raw_data: null });
    expect(inspectionHasRealNarrative(insp)).toBe(false);
  });

  it("returns false when narrative starts with the WA placeholder regex", () => {
    const insp = makeInspection({
      raw_data: {
        narrative:
          "—: WA DSHS report: This is the beginning of a very long placeholder " +
          "text that happens to exceed 100 characters but is still a fake placeholder",
      },
    });
    expect(inspectionHasRealNarrative(insp)).toBe(false);
  });
});

// ── Path 2: deficiency rows ───────────────────────────────────────────────────

describe("inspectionHasRealNarrative — deficiency rows path", () => {
  it("returns true when at least one deficiency has real description text (≥50 chars)", () => {
    const insp = makeInspection({ raw_data: null });
    const defs = [
      makeDeficiency({
        description:
          "The facility failed to ensure that the certified nurse aide " +
          "provided resident with required assistance during meals.",
      }),
    ];
    expect(inspectionHasRealNarrative(insp, defs)).toBe(true);
  });

  it("returns true when at least one deficiency has real inspector_narrative (≥50 chars)", () => {
    const insp = makeInspection({ raw_data: null });
    const defs = [
      makeDeficiency({
        inspector_narrative:
          "Based on interview and record review, the facility failed to " +
          "implement a comprehensive fall prevention program.",
      }),
    ];
    expect(inspectionHasRealNarrative(insp, defs)).toBe(true);
  });

  it("returns false when all deficiency descriptions are null", () => {
    const insp = makeInspection({ raw_data: null });
    const defs = [
      makeDeficiency({ description: null, inspector_narrative: null }),
      makeDeficiency({ description: null, inspector_narrative: null }),
    ];
    expect(inspectionHasRealNarrative(insp, defs)).toBe(false);
  });

  it("returns false when deficiency descriptions are short (<50 chars)", () => {
    const insp = makeInspection({ raw_data: null });
    const defs = [makeDeficiency({ description: "Short." })];
    expect(inspectionHasRealNarrative(insp, defs)).toBe(false);
  });

  it("returns false when deficiency description is a URL", () => {
    const insp = makeInspection({ raw_data: null });
    const defs = [
      makeDeficiency({
        description: "https://fortress.wa.gov/dshs/adsaapps/inspectionreport/..." + "x".repeat(50),
      }),
    ];
    expect(inspectionHasRealNarrative(insp, defs)).toBe(false);
  });

  it("returns false when deficiency description is a WA placeholder", () => {
    const insp = makeInspection({ raw_data: null });
    const defs = [
      makeDeficiency({
        description:
          "WA DSHS report: Some facility report here with enough text to pass length check",
      }),
    ];
    expect(inspectionHasRealNarrative(insp, defs)).toBe(false);
  });

  it("returns false when empty deficiency list passed", () => {
    const insp = makeInspection({ raw_data: null });
    expect(inspectionHasRealNarrative(insp, [])).toBe(false);
  });

  it("returns true when one of multiple deficiencies has real text", () => {
    const insp = makeInspection({ raw_data: null });
    const realText =
      "The surveyor observed that the facility did not maintain adequate " +
      "documentation of the resident's daily care activities.";
    const defs = [
      makeDeficiency({ description: null }),
      makeDeficiency({ description: "Short" }),
      makeDeficiency({ description: realText }),
    ];
    expect(inspectionHasRealNarrative(insp, defs)).toBe(true);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("inspectionHasRealNarrative — edge cases", () => {
  it("narrative with exactly 100 chars passes (boundary condition)", () => {
    const narrative = "A".repeat(100);
    const insp = makeInspection({ raw_data: { narrative } });
    expect(inspectionHasRealNarrative(insp)).toBe(true);
  });

  it("narrative with 99 chars fails (boundary condition)", () => {
    const narrative = "A".repeat(99);
    const insp = makeInspection({ raw_data: { narrative } });
    expect(inspectionHasRealNarrative(insp)).toBe(false);
  });

  it("description with exactly 50 chars passes (boundary condition)", () => {
    const description = "A".repeat(50);
    const insp = makeInspection({ raw_data: null });
    const defs = [makeDeficiency({ description })];
    expect(inspectionHasRealNarrative(insp, defs)).toBe(true);
  });

  it("description with 49 chars fails (boundary condition)", () => {
    const description = "A".repeat(49);
    const insp = makeInspection({ raw_data: null });
    const defs = [makeDeficiency({ description })];
    expect(inspectionHasRealNarrative(insp, defs)).toBe(false);
  });
});
